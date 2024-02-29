import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

import { typedjson, useTypedLoaderData } from "remix-typedjson";
import invariant from "tiny-invariant";
import { db } from "~/lib/db.server";
import {
  getSharedEnv,
  requireUser,
  requireUserOwnsChannel,
} from "~/lib/utils.server";
import { Button } from "~/components/ui/button";
import { Form, Link, useFetcher } from "@remix-run/react";
import { actionDefinitions } from "~/lib/validations.server";
import { Switch } from "~/components/ui/switch";
import { Alert } from "~/components/ui/alert";
import { MoreVerticalIcon } from "lucide-react";
import { z } from "zod";

export async function loader({ request, params }: LoaderFunctionArgs) {
  invariant(params.id, "id is required");

  const user = await requireUser({ request });
  const channel = await requireUserOwnsChannel({
    userId: user.id,
    channelId: params.id,
  });

  const moderationLogs = await db.moderationLog.findMany({
    where: {
      channelId: channel.id,
    },
    take: 25,
    orderBy: {
      createdAt: "desc",
    },
  });

  return typedjson({
    user,
    channel,
    moderationLogs,
    actionDefinitions: actionDefinitions,
    env: getSharedEnv(),
  });
}

export async function action({ request, params }: ActionFunctionArgs) {
  invariant(params.id, "id is required");

  const user = await requireUser({ request });
  const channel = await requireUserOwnsChannel({
    userId: user.id,
    channelId: params.id,
  });

  const formData = await request.formData();
  const rawData = Object.fromEntries(formData.entries());
  const result = z
    .object({
      logId: z.string(),
      intent: z.enum(["end-cooldown", "unmute"]),
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
          channelId: channel.id,
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
          actor: user.id,
          channelId: channel.id,
          reason: `Cooldown ended by @${user.name}`,
        },
      });
    }
  } else if (result.data.intent === "unmute") {
    const updated = await db.cooldown.update({
      where: {
        affectedUserId_channelId: {
          affectedUserId: log.affectedUserFid,
          channelId: channel.id,
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
          actor: user.id,
          channelId: channel.id,
          reason: `Unmuted by @${user.name}`,
        },
      });
    }
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
  const { user, channel, moderationLogs, actionDefinitions, env } =
    useTypedLoaderData<typeof loader>();

  const enableFetcher = useFetcher();

  return (
    <div>
      <p className="uppercase text-[8px] tracking-wider text-gray-500">
        CHANNEL
      </p>

      <div className="flex items-center justify-between">
        <h1>{channel.id}</h1>
        <div className="flex items-center gap-7">
          <Button asChild variant={"secondary"}>
            <Link
              className="no-underline"
              to={`/~/channels/${channel.id}/edit`}
            >
              Edit Rules
            </Link>
          </Button>
          <form
            method="post"
            action={`/api/channels/${channel.id}/toggleEnable`}
          >
            <div className="flex items-center gap-2">
              <Switch
                id="enabled"
                defaultChecked={channel.active}
                onClick={(e) =>
                  enableFetcher.submit(e.currentTarget.form, { method: "post" })
                }
              />{" "}
              <label htmlFor="enabled" className="text-sm">
                Enabled
              </label>
            </div>
          </form>
        </div>
      </div>

      <div className="py-4">
        <hr />
      </div>

      <h2>Log</h2>
      {moderationLogs.length === 0 ? (
        <Alert className="mt-2">
          <div className="text-gray-700">
            No moderation logs yet. Anytime your bot executes any action it'll
            show here.
          </div>
        </Alert>
      ) : (
        <div className="divide-y">
          {moderationLogs.map((log) => (
            <div key={log.id} className="flex flex-col sm:flex-row gap-2 py-2">
              <p
                className="text-xs w-[150px] text-gray-400 shrink-0 sm:shrink-1"
                title={log.createdAt.toISOString()}
              >
                {log.createdAt.toLocaleString()}
              </p>
              <div className="flex gap-2 w-full">
                <a
                  className="no-underline"
                  target="_blank"
                  href={`https://warpcast.com/${log.affectedUsername}`}
                >
                  <Avatar className="block w-11 h-11">
                    <AvatarImage
                      src={log.affectedUserAvatarUrl ?? undefined}
                      alt={"@" + log.affectedUsername}
                    />
                    <AvatarFallback>
                      {log.affectedUsername.slice(0, 2).toLocaleUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </a>
                <div className="flex flex-col w-full">
                  <p className="font-semibold">
                    <a
                      href={`https://warpcast.com/${log.affectedUsername}`}
                      target="_blank"
                    >
                      @{log.affectedUsername}
                    </a>
                  </p>
                  <p>
                    {
                      actionDefinitions[
                        log.action as keyof typeof actionDefinitions
                      ].friendlyName
                    }
                    , {parseAndLocalizeDates(log.reason)}
                  </p>
                </div>

                {["cooldown", "mute"].includes(log.action) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger>
                      <MoreVerticalIcon className="w-5 h-5" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {log.action === "cooldown" && (
                        <Form method="post">
                          <input type="hidden" name="logId" value={log.id} />
                          <DropdownMenuItem>
                            <button
                              name="intent"
                              value="end-cooldown"
                              className="w-full h-full cursor-default"
                            >
                              End Cooldown
                            </button>
                          </DropdownMenuItem>
                        </Form>
                      )}
                      {log.action === "mute" && (
                        <Form method="post">
                          <input type="hidden" name="logId" value={log.id} />
                          <DropdownMenuItem>
                            <button
                              name="intent"
                              value="unmute"
                              className="w-full h-full cursor-default"
                            ></button>
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
      )}
    </div>
  );
}

function parseAndLocalizeDates(text: string): string {
  const datePattern = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/g;

  let match;
  while ((match = datePattern.exec(text)) !== null) {
    const date = new Date(match[0]);
    const localTimeString = date.toLocaleString();
    text = text.replace(match[0], localTimeString);
  }

  return text;
}
