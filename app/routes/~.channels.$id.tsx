import { Prisma } from "@prisma/client";
import { LoaderFunctionArgs } from "@remix-run/node";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";

import {
  typedjson,
  useTypedActionData,
  useTypedLoaderData,
} from "remix-typedjson";
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
import { Bird, Loader, TrashIcon } from "lucide-react";
import { Switch } from "~/components/ui/switch";
import { Alert } from "~/components/ui/alert";

// prisma type with channel moderation logs

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
            <div className="flex flex-col sm:flex-row gap-2 py-2">
              <p
                className="text-xs w-[150px] text-gray-400"
                title={log.createdAt.toISOString()}
              >
                {log.createdAt.toLocaleString()}
              </p>
              <div className="flex gap-2">
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
                <div className="flex flex-col">
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
                    , {log.reason}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
