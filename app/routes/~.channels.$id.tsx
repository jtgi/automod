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
import { Link } from "@remix-run/react";
import { actionDefinitions } from "~/lib/validations.server";

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

  return (
    <div>
      <p className="uppercase text-[8px] tracking-wider text-gray-500">
        CHANNEL
      </p>

      <div className="flex items-center justify-between">
        <h1>{channel.id}</h1>
        <Button asChild variant={"secondary"}>
          <Link className="no-underline" to={`/~/channels/${channel.id}/edit`}>
            Edit Rules
          </Link>
        </Button>
      </div>

      <div className="py-4">
        <hr />
      </div>

      <h2>Log</h2>
      <div className="divide-y">
        {moderationLogs.map((log) => (
          <div className="flex flex-col sm:flex-row gap-4 py-2">
            <p
              className="text-sm w-[150px] text-gray-400"
              title={log.createdAt.toISOString()}
            >
              {log.createdAt.toLocaleString()}
            </p>
            <div className="flex gap-2">
              <Avatar className="block w-11 h-11">
                <AvatarImage
                  src={log.affectedUserAvatarUrl ?? undefined}
                  alt={"@" + log.affectedUsername}
                />
                <AvatarFallback>
                  {log.affectedUsername.slice(0, 2).toLocaleUpperCase()}
                </AvatarFallback>
              </Avatar>
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
    </div>
  );
}
