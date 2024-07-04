/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ActionFunctionArgs, LoaderFunctionArgs, defer } from "@remix-run/node";
import { Await, Form, useFetcher, useLoaderData } from "@remix-run/react";
import { redirect, typedjson } from "remix-typedjson";
import { Button } from "~/components/ui/button";
import { FieldLabel } from "~/components/ui/fields";
import { Input } from "~/components/ui/input";
import { commitSession, getSession } from "~/lib/auth.server";

import { db } from "~/lib/db.server";
import { errorResponse, requireSuperAdmin, successResponse } from "~/lib/utils.server";
import { isRecoverActive, isSweepActive } from "./~.channels.$id.tools";
import { recoverQueue, sweepQueue } from "~/lib/bullish.server";
import { Suspense } from "react";
import axios from "axios";
import { automodFid } from "./~.channels.$id";
import { FullModeratedChannel } from "./api.webhooks.neynar";
import { Checkbox } from "~/components/ui/checkbox";
import { refreshAccountStatus } from "~/lib/subscription.server";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireSuperAdmin({ request });
  const dau = getDau();
  return defer({
    dau,
  });
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
    let username = (formData.get("username") as string) ?? "";
    const channel = (formData.get("channelOwner") as string) ?? "";

    if (!username && !channel) {
      return errorResponse({ request, message: "Enter a username or channel owner" });
    }

    if (channel) {
      const channelOwner = await db.moderatedChannel.findFirst({
        select: {
          user: {
            select: {
              name: true,
            },
          },
        },
        where: {
          id: channel,
        },
      });

      if (!channelOwner) {
        return errorResponse({ request, message: "Channel not found" });
      }

      username = channelOwner.user.name;
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
    const reprocessModeratedCasts = (formData.get("reprocessModeratedCasts") as string) ?? "false";
    const recoverType = (formData.get("recoverType") as string) ?? "recover";

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

      if (recoverType === "recover") {
        if (await isRecoverActive(moderatedChannel.id)) {
          return errorResponse({ request, message: "Recovery already in progress. Hang tight." });
        }

        await recoverQueue.add(
          "recover",
          {
            channelId: moderatedChannel.id,
            moderatedChannel,
            limit,
            untilTimeUtc: untilTimeUtc ?? undefined,
            untilHash: untilHash ?? undefined,
            reprocessModeratedCasts: reprocessModeratedCasts === "on",
          },
          {
            removeOnComplete: 300,
            removeOnFail: 300,
            attempts: 3,
          }
        );
      } else if (recoverType === "sweep") {
        if (await isSweepActive(moderatedChannel.id)) {
          return errorResponse({ request, message: "Sweep already in progress. Hang tight." });
        }

        await sweepQueue.add(
          "sweep",
          {
            channelId: moderatedChannel.id,
            moderatedChannel,
            limit,
            untilTimeUtc: untilTimeUtc ?? undefined,
            untilHash: untilHash ?? undefined,
          },
          {
            removeOnComplete: true,
            removeOnFail: true,
            jobId: `sweep-${moderatedChannel.id}`,
            attempts: 3,
          }
        );
      }
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

        if (recoverType === "recover") {
          await recoverQueue.add(
            "recover",
            {
              channelId: moderatedChannel.id,
              moderatedChannel,
              limit,
              untilTimeUtc: untilTimeUtc ?? undefined,
              untilHash: untilHash ?? undefined,
              reprocessModeratedCasts: reprocessModeratedCasts === "on",
            },
            {
              removeOnComplete: 300,
              removeOnFail: 300,
              attempts: 3,
            }
          );
        } else if (recoverType === "sweep") {
          await sweepQueue.add(
            "sweep",
            {
              channelId: moderatedChannel.id,
              moderatedChannel,
              limit,
              untilTimeUtc: untilTimeUtc ?? undefined,
              untilHash: untilHash ?? undefined,
            },
            {
              removeOnComplete: true,
              removeOnFail: true,
              jobId: `sweep-${moderatedChannel.id}`,
              attempts: 3,
            }
          );
        }
      }
    }

    return successResponse({
      request,
      message: `${recoverType}ing! This will take a while.`,
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
  const refreshFetcher = useFetcher<typeof loader>();
  const impersonateFetcher = useFetcher<typeof loader>();
  const recoverFetcher = useFetcher<typeof loader>();
  const statusFetcher = useFetcher<typeof loader>();

  return (
    <div className="flex flex-col sm:flex-row gap-8 w-full">
      <div className="w-full">
        <h3>Admin</h3>
        <div className="space-y-20">
          <refreshFetcher.Form method="post" className="space-y-4">
            <FieldLabel label="Refresh Account Status" className="flex-col items-start">
              <Input name="username" placeholder="jtgi" />
            </FieldLabel>
            <Button name="action" value="refreshAccount" disabled={refreshFetcher.state !== "idle"}>
              Refresh
            </Button>
          </refreshFetcher.Form>

          <impersonateFetcher.Form method="post" className="space-y-4">
            <FieldLabel label="Impersonate Username" className="flex-col items-start">
              <Input name="username" placeholder="username" />
            </FieldLabel>
            <FieldLabel label="Impersonate Channel Owner" className="flex-col items-start">
              <Input name="channelOwner" placeholder="memes" />
            </FieldLabel>
            <Button name="action" value="impersonate" disabled={impersonateFetcher.state !== "idle"}>
              Impersonate
            </Button>
          </impersonateFetcher.Form>

          <recoverFetcher.Form method="post" className="space-y-4">
            <p className="font-medium">Recovery</p>
            <FieldLabel label="Channel (empty for all)" className="flex-col items-start">
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
            <FieldLabel
              label="Reprocess"
              position="right"
              description="Even if an entry in the moderation log already exists, reprocess it."
            >
              <Checkbox className="align-start" name="reprocessModeratedCasts" defaultValue={"off"} />
            </FieldLabel>
            <div className="text-sm">
              <p className="font-medium mb-1">Type</p>
              <RadioGroup name="recoverType" defaultValue="recover">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="recover" id="recover" />
                  <label htmlFor="sweep">Recover</label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="sweep" id="sweep" />
                  <label htmlFor="sweep">Sweep</label>
                </div>
              </RadioGroup>
            </div>
            <Button name="action" value="recover" disabled={recoverFetcher.state !== "idle"}>
              Submit
            </Button>
          </recoverFetcher.Form>

          <statusFetcher.Form method="post" className="space-y-4">
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
              <Button name="action" value="status" disabled={statusFetcher.state !== "idle"}>
                Submit
              </Button>
              <Button
                name="action"
                value="clearStatus"
                variant={"secondary"}
                disabled={statusFetcher.state !== "idle"}
              >
                Clear
              </Button>
            </div>
          </statusFetcher.Form>
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
                    {_dau.setupIncomplete
                      .sort((a, b) => b.followerCount - a.followerCount)
                      .map((c) => (
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
  return moderatedChannel.inclusionRuleSetParsed?.ruleParsed?.conditions?.length === 0;
}

export function hasRules(moderatedChannel: FullModeratedChannel) {
  return moderatedChannel.inclusionRuleSetParsed?.ruleParsed?.conditions?.length !== 0;
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
