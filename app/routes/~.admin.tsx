/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Await, useFetcher } from "@remix-run/react";
import { redirect, typeddefer, typedjson, useTypedLoaderData } from "remix-typedjson";
import { Button } from "~/components/ui/button";
import { FieldLabel } from "~/components/ui/fields";
import { Input } from "~/components/ui/input";
import { commitSession, getSession } from "~/lib/auth.server";

import { db } from "~/lib/db.server";
import { errorResponse, requireSuperAdmin, successResponse } from "~/lib/utils.server";
import { isRecoverActive, isSweepActive } from "./~.channels.$id.tools";
import { recoverQueue, delayedSubscriptionQueue, sweepQueue } from "~/lib/bullish.server";
import { Suspense } from "react";
import axios from "axios";
import { automodFid } from "./~.channels.$id";
import { FullModeratedChannel } from "./api.webhooks.neynar";
import { Checkbox } from "~/components/ui/checkbox";
import { refreshAccountStatus } from "~/lib/subscription.server";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { Loader } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { getChannel } from "~/lib/neynar.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireSuperAdmin({ request });
  const dau = getDau();
  const apiKeys = await db.partnerApiKey.findMany({});
  return typeddefer({
    dau,
    apiKeys,
  });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireSuperAdmin({ request });

  const formData = await request.formData();
  const action = formData.get("action");

  if (action === "createPartnerApiKey") {
    const name = formData.get("name") as string;
    const expiresInDays = parseInt(formData.get("expiresInDays") as string, 10);

    if (!name || isNaN(expiresInDays)) {
      return errorResponse({ request, message: "Invalid input" });
    }

    const key = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    await db.partnerApiKey.create({
      data: {
        key,
        name,
        expiresAt,
      },
    });

    return successResponse({ request, message: "API key created successfully" });
  } else if (action === "createChannelFor") {
    const username = (formData.get("username") as string) ?? "";
    const channelId = (formData.get("channelId") as string)?.toLowerCase() ?? "";

    if (!username) {
      return errorResponse({ request, message: "Enter a username" });
    }

    const user = await db.user.findFirst({
      where: {
        name: username.toLowerCase(),
      },
    });

    if (!user) {
      return errorResponse({ request, message: "User not found" });
    }

    if (!channelId) {
      return errorResponse({ request, message: "Enter a channel id" });
    }

    const channel = await db.moderatedChannel.findFirst({
      where: {
        id: channelId,
      },
    });

    if (channel) {
      return errorResponse({ request, message: `Channel already exists, owned by ${channel.userId}` });
    }

    const neynarChannel = await getChannel({ name: channelId }).catch(() => null);
    if (!neynarChannel) {
      return errorResponse({
        request,
        message: "Channel not found on neynar",
      });
    }

    await db.moderatedChannel.create({
      data: {
        id: neynarChannel.id,
        userId: user.id,
        active: true,
        url: neynarChannel.url,
        feedType: "recommended",
        imageUrl: neynarChannel.image_url,
      },
    });

    return successResponse({ request, message: `Created ${neynarChannel.id} for @${username}` });
  } else if (action === "refreshAccount") {
    const username = (formData.get("username") as string) ?? "";
    if (username) {
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
    } else {
      await delayedSubscriptionQueue.add(
        "subscriptionSyncAdmin",
        {},
        { removeOnComplete: true, removeOnFail: true }
      );

      return successResponse({ request, message: "Syncing all subscriptions" });
    }
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
  const { dau, apiKeys } = useTypedLoaderData<typeof loader>();
  const refreshFetcher = useFetcher<typeof loader>();
  const impersonateFetcher = useFetcher<typeof loader>();
  const recoverFetcher = useFetcher<typeof loader>();
  const statusFetcher = useFetcher<typeof loader>();
  const createChannelFetcher = useFetcher<typeof loader>();
  const apiKeysFetcher = useFetcher<typeof loader>();

  return (
    <div className="flex flex-col sm:flex-row gap-8 w-full">
      <div className="w-full">
        <h3>Admin</h3>
        <div className="space-y-20">
          <refreshFetcher.Form method="post" className="space-y-4">
            <FieldLabel label="Refresh Account Status" className="flex-col items-start">
              <Input name="username" placeholder="Refresh All" />
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

          <createChannelFetcher.Form method="post" className="space-y-4">
            <p>Create Channel for User</p>
            <FieldLabel label="Username of Owner" className="flex-col items-start">
              <Input name="username" placeholder="username" required />
            </FieldLabel>
            <FieldLabel label="Channel Id" className="flex-col items-start">
              <Input name="channelId" placeholder="channel id" required />
            </FieldLabel>
            <Button name="action" value="createChannelFor" disabled={createChannelFetcher.state !== "idle"}>
              Create
            </Button>
          </createChannelFetcher.Form>

          <div>
            <h3>API Keys</h3>
            <apiKeysFetcher.Form method="post" className="space-y-4">
              <FieldLabel label="Label" className="flex-col items-start">
                <Input name="name" placeholder="API Key Name" required />
              </FieldLabel>
              <FieldLabel label="Expires In (days)" className="flex-col items-start">
                <Input type="number" name="expiresInDays" placeholder="Expires in (days)" required />
              </FieldLabel>
              <Button name="action" value="createPartnerApiKey" type="submit">
                Create
              </Button>
            </apiKeysFetcher.Form>
            {apiKeys.length > 0 && (
              <ul className="mt-4 text-sm">
                {apiKeys.map((apiKey) => (
                  <li key={apiKey.id} className="flex justify-between">
                    <p>
                      {apiKey.name} (until {apiKey.expiresAt.toLocaleDateString()})
                    </p>
                    <Button size={"xs"} variant={"ghost"} onClick={() => prompt("API Key", apiKey.key)}>
                      View
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-20 min-w-[300px] text-sm">
        <Suspense
          fallback={
            <div className="flex justify-center h-full w-full">
              <Loader className="animate-spin w-5 h-5" />
            </div>
          }
        >
          <Await resolve={dau}>
            {(_dau) => {
              return (
                <>
                  <div className="flex flex-col gap-2">
                    <h3>Account Breakdown</h3>
                    {_dau.usersByPlan.map((u) => (
                      <div key={u.plan} className="flex justify-between items-center">
                        <p>{u.plan}</p>
                        <p>{u._count._all}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col gap-2">
                    <h3>New Signups (72h) - {_dau.newSignups.length.toLocaleString()}</h3>
                    {_dau.newSignups.map((u) => (
                      <div key={u.id} className="flex gap-3 items-center">
                        <Avatar className="w-6 h-6">
                          <AvatarImage src={u.avatarUrl ?? undefined} />
                          <AvatarFallback>{u.name[0]}</AvatarFallback>
                        </Avatar>
                        <a href={`https://warpcast.com/${u.name}`} target="_blank" rel="noreferrer">
                          {u.name}
                        </a>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col gap-2">
                    <h3>New Channels (72h) - {_dau.newChannels.length.toLocaleString()}</h3>
                    {_dau.newChannels.map((c) => (
                      <div key={c.id} className="flex gap-3 items-center">
                        <Avatar className="w-6 h-6">
                          <AvatarImage src={c.imageUrl ?? undefined} />
                          <AvatarFallback>{c.id[0]}</AvatarFallback>
                        </Avatar>
                        <a href={`https://warpcast.com/~/channel/${c.id}`} target="_blank" rel="noreferrer">
                          /{c.id}
                        </a>
                      </div>
                    ))}
                  </div>

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
    <div className="flex gap-2 justify-between">
      <div className="w-full">
        <a target="_blank" href={`https://warpcast.com/~/channel/${c.id}`} rel="noreferrer">
          /{c.id}
        </a>
      </div>
      <div className="font-mono">{c.followerCount.toLocaleString()}</div>
    </div>
  );
}

export function hasNoRules(moderatedChannel: FullModeratedChannel) {
  return moderatedChannel.inclusionRuleSetParsed?.ruleParsed?.conditions?.length === 0;
}

export function hasRules(moderatedChannel: FullModeratedChannel) {
  return moderatedChannel.inclusionRuleSetParsed?.ruleParsed?.conditions?.length !== 0;
}

export async function getDau() {
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

  const usersByPlan = await db.user.groupBy({
    by: ["plan"],
    _count: {
      _all: true,
    },
  });

  const newSignups = await db.user.findMany({
    where: {
      createdAt: {
        gte: new Date(new Date().getTime() - 1000 * 60 * 60 * 72),
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const newChannels = await db.moderatedChannel.findMany({
    where: {
      createdAt: {
        gte: new Date(new Date().getTime() - 1000 * 60 * 60 * 72),
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return {
    active,
    setupIncomplete,
    usersByPlan,
    newChannels,
    newSignups,
  };
}
