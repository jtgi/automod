/* eslint-disable @typescript-eslint/no-explicit-any */
import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";

import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

import { typeddefer, typedjson, useTypedLoaderData } from "remix-typedjson";
import invariant from "tiny-invariant";
import { db } from "~/lib/db.server";
import {
  getSharedEnv,
  requireUser,
  requireUserCanModerateChannel as requireUserCanModerateChannel,
} from "~/lib/utils.server";
import { Form, NavLink } from "@remix-run/react";
import { actionDefinitions, like, unlike } from "~/lib/validations.server";
import { Alert } from "~/components/ui/alert";
import {
  ArrowUpRight,
  ChevronLeftIcon,
  ChevronRightIcon,
  MoreVerticalIcon,
  SlidersHorizontalIcon,
} from "lucide-react";
import { z } from "zod";
import { useLocalStorage } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { getModerationStats30Days } from "~/lib/stats.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  invariant(params.id, "id is required");

  const user = await requireUser({ request });
  const channel = await requireUserCanModerateChannel({
    userId: user.id,
    channelId: params.id,
  });

  const { page, pageSize, skip } = getPageInfo({ request });

  const [moderationLogs, totalModerationLogs] = await Promise.all([
    db.moderationLog.findMany({
      where: {
        channelId: channel.id,
      },
      take: pageSize,
      skip,
      orderBy: {
        createdAt: "desc",
      },
    }),
    db.moderationLog.count({
      where: {
        channelId: channel.id,
      },
    }),
  ]);

  const stats = getModerationStats30Days({ channelId: channel.id });

  return typeddefer({
    user,
    channel,
    moderationLogs,
    actionDefinitions: actionDefinitions,
    env: getSharedEnv(),
    stats,

    page,
    pageSize,
    total: totalModerationLogs,
  });
}

export async function action({ request, params }: ActionFunctionArgs) {
  invariant(params.id, "id is required");

  const user = await requireUser({ request });
  const moderatedChannel = await requireUserCanModerateChannel({
    userId: user.id,
    channelId: params.id,
  });

  const formData = await request.formData();
  const rawData = Object.fromEntries(formData.entries());
  const result = z
    .object({
      logId: z.string(),
      intent: z.enum(["end-cooldown", "unban", "like", "hideQuietly"]),
    })
    .safeParse(rawData);

  if (!result.success) {
    return typedjson(
      {
        message: "Invalid data",
      },
      { status: 422 }
    );
  }

  const log = await db.moderationLog.findUnique({
    where: {
      id: result.data.logId,
    },
  });

  if (!log) {
    return typedjson(
      {
        message: "Log not found",
      },
      { status: 404 }
    );
  }

  if (result.data.intent === "end-cooldown") {
    const updated = await db.cooldown.update({
      where: {
        affectedUserId_channelId: {
          affectedUserId: log.affectedUserFid,
          channelId: moderatedChannel.id,
        },
      },
      data: {
        active: false,
      },
    });

    if (updated) {
      await db.moderationLog.create({
        data: {
          action: "cooldownEnded",
          affectedUserFid: log.affectedUserFid,
          affectedUsername: log.affectedUsername,
          affectedUserAvatarUrl: log.affectedUserAvatarUrl,
          castHash: log.castHash,
          castText: log.castText,
          actor: user.id,
          channelId: moderatedChannel.id,
          reason: `Cooldown ended by @${user.name}`,
        },
      });
    }
  } else if (result.data.intent === "unban") {
    const updated = await db.cooldown.update({
      where: {
        affectedUserId_channelId: {
          affectedUserId: log.affectedUserFid,
          channelId: moderatedChannel.id,
        },
      },
      data: {
        active: false,
      },
    });

    if (updated) {
      await db.moderationLog.create({
        data: {
          action: "unmuted",
          affectedUserFid: log.affectedUserFid,
          affectedUsername: log.affectedUsername,
          affectedUserAvatarUrl: log.affectedUserAvatarUrl,
          castHash: log.castHash,
          castText: log.castText,
          actor: user.id,
          channelId: moderatedChannel.id,
          reason: `Unmuted by @${user.name}`,
        },
      });
    }
  } else if (result.data.intent === "like") {
    invariant(log.castHash, "castHash is required");

    await like({ cast: { hash: log.castHash } as any, channel: moderatedChannel.id });
    await db.moderationLog.create({
      data: {
        action: "like",
        affectedUserFid: log.affectedUserFid,
        affectedUsername: log.affectedUsername,
        affectedUserAvatarUrl: log.affectedUserAvatarUrl,
        castHash: log.castHash,
        castText: log.castText,
        actor: user.id,
        channelId: moderatedChannel.id,
        reason: `Applied manually by @${user.name}`,
      },
    });
  } else if (result.data.intent === "hideQuietly") {
    invariant(log.castHash, "castHash is required");

    await unlike({ cast: { hash: log.castHash } as any, channel: moderatedChannel.id });
    await db.moderationLog.create({
      data: {
        action: "hideQuietly",
        affectedUserFid: log.affectedUserFid,
        affectedUsername: log.affectedUsername,
        affectedUserAvatarUrl: log.affectedUserAvatarUrl,
        castHash: log.castHash,
        castText: log.castText,
        actor: user.id,
        channelId: moderatedChannel.id,
        reason: `Applied manually by @${user.name}`,
      },
    });
  } else {
    return typedjson(
      {
        message: "Invalid intent",
      },
      { status: 422 }
    );
  }

  return typedjson({
    message: "success",
  });
}

export default function Screen() {
  const { page, pageSize, total, moderationLogs, actionDefinitions, stats } =
    useTypedLoaderData<typeof loader>();
  const [showCastText, setShowCastText] = useLocalStorage("showCastText", true);

  const prevPage = Math.max(page - 1, 0);
  const nextPage = page + 1 > Math.ceil(total / pageSize) ? null : page + 1;

  return (
    <div>
      <div className="flex justify-between border-b">
        <div id="log-top">
          <p className="font-semibold">Activity</p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="rounded-full">
              <SlidersHorizontalIcon className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <DropdownMenuCheckboxItem checked={showCastText} onCheckedChange={setShowCastText}>
              Show Cast Text
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {moderationLogs.length === 0 ? (
        <Alert className="mt-2">
          <div className="text-gray-700">
            No moderation logs yet. Anytime automod executes an action a log will show here.
          </div>
        </Alert>
      ) : (
        <>
          <div className="divide-y">
            {moderationLogs.map((log) => (
              <div key={log.id} className="flex flex-col md:flex-row gap-2 py-2">
                <p
                  className="text-xs w-[150px] text-gray-400 shrink-0 sm:shrink-1"
                  title={log.createdAt.toISOString()}
                >
                  {log.createdAt.toLocaleString()}
                </p>
                <div className="flex gap-2 w-full items-start">
                  <a
                    className="no-underline"
                    target="_blank"
                    href={`https://warpcast.com/${log.affectedUsername}`}
                    rel="noreferrer"
                  >
                    <Avatar className="block w-11 h-11">
                      <AvatarImage
                        src={log.affectedUserAvatarUrl ?? undefined}
                        alt={"@" + log.affectedUsername}
                      />
                      <AvatarFallback>{log.affectedUsername.slice(0, 2).toLocaleUpperCase()}</AvatarFallback>
                    </Avatar>
                  </a>
                  <div className="flex flex-col w-full">
                    <p className="font-semibold">
                      <a
                        href={`https://warpcast.com/${log.affectedUsername}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        @{log.affectedUsername}
                      </a>
                    </p>
                    <p className="break-word text-sm overflow-ellipsis overflow-hidden">
                      {actionDefinitions[log.action as keyof typeof actionDefinitions].friendlyName},{" "}
                      {formatText(log.reason)}
                    </p>

                    {log.castText && showCastText && (
                      <Alert className="my-2 text-sm text-gray-500 italic  break-all">{log.castText}</Alert>
                    )}

                    {log.castHash && (
                      <p>
                        <a
                          className="text-[8px] no-underline hover:underline uppercase tracking-wide"
                          href={`https://warpcast.com/${log.affectedUsername}/${log.castHash.substring(
                            0,
                            10
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View on Warpcast
                        </a>
                        <ArrowUpRight className="inline w-2 h-2 mt-[2px] text-primary" />
                      </p>
                    )}
                  </div>

                  {["cooldown", "mute", "hideQuietly", "warnAndHide"].includes(log.action) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger>
                        <MoreVerticalIcon className="w-5 h-5" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        {log.action === "hideQuietly" && log.reason.includes("in cooldown until") && (
                          <Form method="post">
                            <input type="hidden" name="logId" value={log.id} />
                            <DropdownMenuItem>
                              <button
                                name="intent"
                                value="end-cooldown"
                                className="w-full h-full cursor-default text-left"
                              >
                                End Cooldown
                              </button>
                            </DropdownMenuItem>
                          </Form>
                        )}

                        {log.action === "like" && (
                          <Form method="post">
                            <input type="hidden" name="logId" value={log.id} />
                            <DropdownMenuItem>
                              <button
                                name="intent"
                                value="hideQuietly"
                                className="w-full h-full cursor-default text-left"
                              >
                                Hide
                              </button>
                            </DropdownMenuItem>
                          </Form>
                        )}

                        {log.action === "ban" && (
                          <Form method="post">
                            <input type="hidden" name="logId" value={log.id} />
                            <DropdownMenuItem>
                              <button
                                name="intent"
                                value="unban"
                                className="w-full h-full cursor-default text-left"
                              >
                                Unban
                              </button>
                            </DropdownMenuItem>
                          </Form>
                        )}
                        {(log.action === "hideQuietly" || log.action === "warnAndHide") && (
                          <Form method="post">
                            <input type="hidden" name="logId" value={log.id} />
                            <DropdownMenuItem>
                              <button
                                name="intent"
                                value="like"
                                className="w-full h-full cursor-default text-left"
                              >
                                Curate
                              </button>
                            </DropdownMenuItem>
                          </Form>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-12 flex justify-between">
            <Button
              variant={"outline"}
              size={"sm"}
              className="no-underline"
              disabled={prevPage === 0}
              asChild
            >
              <NavLink
                preventScrollReset
                to={`?page=${prevPage}&pageSize=${pageSize}`}
                prefetch="intent"
                className={`text-gray-500 ${
                  prevPage === 0 ? "cursor-not-allowed pointer-events-none opacity-50" : ""
                }`}
                onClick={(e) => {
                  if (prevPage !== 0) {
                    document.getElementById("log-top")?.scrollIntoView({ behavior: "smooth" });
                  } else {
                    e.preventDefault();
                  }
                }}
              >
                <ChevronLeftIcon className="w-4 h-4 inline" />
                Previous
              </NavLink>
            </Button>
            <Button
              variant={"outline"}
              size={"sm"}
              className="no-underline"
              disabled={nextPage === null}
              asChild
            >
              <NavLink
                preventScrollReset
                to={`?page=${nextPage}&pageSize=${pageSize}`}
                prefetch="intent"
                className={`text-gray-500 ${
                  nextPage === null ? "cursor-not-allowed pointer-events-none opacity-50" : ""
                }`}
                onClick={(e) => {
                  if (nextPage !== null) {
                    document.getElementById("log-top")?.scrollIntoView({ behavior: "smooth" });
                  } else {
                    e.preventDefault();
                  }
                }}
              >
                Next
                <ChevronRightIcon className="w-4 h-4 inline" />
              </NavLink>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function formatText(text: string): string {
  const datePattern = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/g;

  const matches = text.match(datePattern) ?? [];
  if (matches.length) {
    for (const match of matches) {
      const date = new Date(match);
      const localTimeString = date.toLocaleString();
      text = text.replace(match, localTimeString);
    }

    return text;
  } else {
    return text;
  }
}

const defaultPageSize = 50;

function getPageInfo({ request }: { request: Request }) {
  const url = new URL(request.url);
  const page = Math.max(parseInt(url.searchParams.get("page") || "1"), 1);
  const pageSize = Math.max(
    Math.min(parseInt(url.searchParams.get("pageSize") || `${defaultPageSize}`), 100),
    0
  );
  const skip = (page - 1) * pageSize;

  return {
    page: isNaN(page) ? 1 : page,
    pageSize: isNaN(pageSize) ? defaultPageSize : pageSize,
    skip: isNaN(skip) ? 0 : skip,
  };
}
