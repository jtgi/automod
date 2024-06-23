/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ActionFunctionArgs, LoaderFunctionArgs, defer, json } from "@remix-run/node";
import { Await, Form, useLoaderData } from "@remix-run/react";
import { redirect, typedjson } from "remix-typedjson";
import { Button } from "~/components/ui/button";
import { FieldLabel } from "~/components/ui/fields";
import { Input } from "~/components/ui/input";
import { commitSession, getSession, refreshAccountStatus } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { errorResponse, requireSuperAdmin, successResponse } from "~/lib/utils.server";
import { isRecoverActive, recover } from "./~.channels.$id.tools";
import { recoverQueue } from "~/lib/bullish.server";
import { FormEvent, Suspense } from "react";
import axios from "axios";
import { automodFid } from "./~.channels.$id";
import { FullModeratedChannel } from "./api.webhooks.neynar";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireSuperAdmin({ request });
  const dau = getDau();
  return defer({
    dau,
  });
}

async function getDau() {
  const rsp = await axios.get(`https://api.warpcast.com/v2/all-channels`);
  const channels = rsp.data.result.channels;
  const moderatedChannels = await db.moderatedChannel.findMany({
    select: {
      id: true,
    },
  });

  const signerFids = await db.signer.findMany({});
  const automodFids = [...signerFids.map((s) => +s.fid), automodFid];
  const active = [];
  const setupIncomplete = [];

  for (const channel of channels) {
    if (automodFids.includes(channel.moderatorFid)) {
      active.push(channel);
    } else {
      if (moderatedChannels.find((mc) => mc.id.toLowerCase() === channel.id.toLowerCase())) {
        setupIncomplete.push(channel);
      }
    }
  }

  return {
    active,
    setupIncomplete,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  await requireSuperAdmin({ request });

  const formData = await request.formData();
  const action = formData.get("action");

  if (action === "refreshAccount") {
    const username = (formData.get("username") as string) ?? "";
    if (!username) {
      return errorResponse({ request, message: "Please enter a username" });
    }

    const fid = await db.user.findFirst({
      select: {
        id: true,
      },
      where: {
        name: username.toLowerCase(),
      },
    });

    if (!fid) {
      return errorResponse({ request, message: "User not found" });
    }

    const plan = await refreshAccountStatus({ fid: fid.id });

    return successResponse({
      request,
      message: `Refreshed. Plan is ${plan.plan}, expiring ${plan.expiresAt?.toISOString()}`,
    });
  } else if (action === "impersonate") {
    const username = (formData.get("username") as string) ?? "";

    if (!username) {
      return errorResponse({ request, message: "Please enter a username" });
    }

    const session = await getSession(request.headers.get("Cookie"));
    session.set("impersonateAs", username);
    throw redirect("/auth/god", {
      headers: {
        "Set-Cookie": await commitSession(session),
      },
    });
  } else if (action === "recover") {
    const channel = (formData.get("channel") as string) ?? "";
    const limit = parseInt((formData.get("limit") as string) ?? "1000");
    const untilTimeLocal = (formData.get("untilTime") as string) ?? "";
    const untilHash = (formData.get("untilHash") as string) ?? "";

    let untilTimeUtc: string | undefined;

    if (untilTimeLocal) {
      untilTimeUtc = new Date(untilTimeLocal).toISOString();
    }

    if (untilTimeLocal && untilHash) {
      return errorResponse({ request, message: "Cannot specify both time and hash" });
    }

    if (isNaN(limit)) {
      return errorResponse({ request, message: "Invalid limit" });
    }

    if (channel) {
      const moderatedChannel = await db.moderatedChannel.findFirstOrThrow({
        where: {
          id: channel,
          active: true,
          ruleSets: {},
        },
        include: {
          ruleSets: true,
          user: true,
          roles: {
            include: {
              delegates: true,
            },
          },
        },
      });

      if (await isRecoverActive(moderatedChannel.id)) {
        return errorResponse({ request, message: "Recovery already in progress. Hang tight." });
      }

      if (hasNoRules(moderatedChannel)) {
        return successResponse({
          request,
          message: "Channel has no automated rules. Nothing to recover.",
        });
      }

      await recoverQueue.add(
        "recover",
        {
          channelId: moderatedChannel.id,
          moderatedChannel,
          limit,
          untilTimeUtc: untilTimeUtc ?? undefined,
          untilHash: untilHash ?? undefined,
        },
        {
          removeOnComplete: 300,
          removeOnFail: 300,
          attempts: 3,
        }
      );
    } else {
      // start for all active channels
      const moderatedChannels = await db.moderatedChannel.findMany({
        where: {
          active: true,
        },
        include: {
          ruleSets: true,
          user: true,
          roles: {
            include: {
              delegates: true,
            },
          },
        },
      });

      for (const moderatedChannel of moderatedChannels) {
        console.log(`[global recovery]: enqueuing ${moderatedChannel.id}`);

        if (hasNoRules(moderatedChannel)) {
          console.log(`[global recovery]: skipping ${moderatedChannel.id} - no rules`);
          continue;
        }

        await recoverQueue.add(
          "recover",
          {
            channelId: moderatedChannel.id,
            moderatedChannel,
            limit,
            untilTimeUtc: untilTimeUtc ?? undefined,
            untilHash: untilHash ?? undefined,
          },
          {
            removeOnComplete: 300,
            removeOnFail: 300,
            attempts: 3,
          }
        );
      }
    }

    return successResponse({
      request,
      message: "Recovering! This will take a while. Monitor progress in the logs.",
    });
  } else if (action === "clearStatus") {
    await db.status.updateMany({
      where: {
        active: true,
      },
      data: {
        active: false,
      },
    });
  } else if (action === "status") {
    const message = (formData.get("message") as string) ?? "";
    const link = (formData.get("link") as string) ?? null;

    await db.status.updateMany({
      where: {
        active: true,
      },
      data: {
        active: false,
      },
    });

    await db.status.create({
      data: {
        message,
        link,
        active: true,
        type: "warning",
      },
    });

    return successResponse({ request, message: "Status updated" });
  }

  return typedjson({ message: "Invalid action" }, { status: 400 });
}

export default function Admin() {
  const { dau } = useLoaderData<typeof loader>();
  return (
    <div className="flex flex-col sm:flex-row gap-8 w-full">
      <div className="w-full">
        <h3>Admin</h3>
        <div className="space-y-20">
          <Form method="post" className="space-y-4">
            <FieldLabel label="Refresh Account Status" className="flex-col items-start">
              <Input name="username" placeholder="jtgi" />
            </FieldLabel>
            <Button name="action" value="refreshAccount">
              Refresh Account
            </Button>
          </Form>

          <Form method="post" className="space-y-4">
            <FieldLabel label="Impersonate Username" className="flex-col items-start">
              <Input name="username" placeholder="username" />
            </FieldLabel>
            <Button name="action" value="impersonate">
              Impersonate
            </Button>
          </Form>

          <Form method="post" className="space-y-4">
            <FieldLabel label="Recover Channel (empty for all)" className="flex-col items-start">
              <Input name="channel" placeholder="all channels" />
            </FieldLabel>
            <FieldLabel label="Until" className="flex-col items-start">
              <Input name="untilTime" placeholder="2024-05-29T08:22:20.329Z" />
            </FieldLabel>
            <p className="text-[8px]">2024-05-29T08:22:20.329Z</p>
            <FieldLabel label="Until Cast Hash" className="flex-col items-start">
              <Input name="untilHash" placeholder="hash" />
            </FieldLabel>
            <FieldLabel label="Limit" className="flex-col items-start">
              <Input type="number" name="limit" placeholder="limit" defaultValue={1000} />
            </FieldLabel>
            <Button name="action" value="recover">
              Recover
            </Button>
          </Form>

          <Form method="post" className="space-y-4">
            <FieldLabel label="Status" className="flex-col items-start">
              <Input name="channel" placeholder="channel" />
            </FieldLabel>
            <FieldLabel label="Message" className="flex-col items-start">
              <Input name="message" required />
            </FieldLabel>
            <FieldLabel label="Link" className="flex-col items-start">
              <Input name="link" />
            </FieldLabel>
            <div className="flex gap-2">
              <Button name="action" value="status">
                Submit
              </Button>
              <Button name="action" value="clearStatus" variant={"secondary"}>
                Clear
              </Button>
            </div>
          </Form>
        </div>
      </div>

      <div className="space-y-20 min-w-[300px] text-sm">
        <Suspense fallback="Loading">
          <Await resolve={dau}>
            {(_dau) => {
              return (
                <>
                  <div className="flex flex-col gap-2">
                    <h3>Active Channels - {_dau.active.length.toLocaleString()}</h3>
                    {_dau.active
                      .sort((a, b) => b.followerCount - a.followerCount)
                      .map((c) => (
                        <ChannelStat key={c.id} c={c} />
                      ))}
                  </div>

                  <div className="flex flex-col gap-2">
                    <h2>Setup Incomplete - {_dau.setupIncomplete.length.toLocaleString()}</h2>
                    {_dau.setupIncomplete.map((c) => (
                      <ChannelStat key={c.id} c={c} />
                    ))}
                  </div>
                </>
              );
            }}
          </Await>
        </Suspense>
      </div>
    </div>
  );
}

function ChannelStat({ c }: { c: any }) {
  return (
    <div className="flex gap-2">
      <div className="w-[200px]">
        <a target="_blank" href={`https://warpcast.com/~/channel/${c.id}`} rel="noreferrer">
          /{c.id}
        </a>
      </div>
      <div>{c.followerCount.toLocaleString()}</div>
    </div>
  );
}

export function hasNoRules(moderatedChannel: FullModeratedChannel) {
  console.log(moderatedChannel.inclusionRuleSetParsed?.ruleParsed?.conditions?.length);
  return moderatedChannel.inclusionRuleSetParsed?.ruleParsed?.conditions?.length === 0;
}

export function hasRules(moderatedChannel: FullModeratedChannel) {
  return moderatedChannel.inclusionRuleSetParsed?.ruleParsed?.conditions?.length !== 0;
}
