/* eslint-disable react/no-unescaped-entities */
import plur from "plur";
import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link } from "@remix-run/react";
import { typedjson, useTypedLoaderData } from "remix-typedjson";
import invariant from "tiny-invariant";
import { v4 as uuid } from "uuid";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { commitSession, getSession } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import {
  requireUser,
  requireUserOwnsChannel,
  requireUserIsCohost,
  requireUserCanModerateChannel,
} from "~/lib/utils.server";
import { getChannelHosts } from "~/lib/warpcast.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  invariant(params.id, "id is required");

  const user = await requireUser({ request });
  const channel = await requireUserCanModerateChannel({
    userId: user.id,
    channelId: params.id,
  });

  return typedjson({
    user,
    channel,
  });
}

export async function action({ request, params }: ActionFunctionArgs) {
  invariant(params.id, "id is required");

  const user = await requireUser({ request });
  const channel = await requireUserCanModerateChannel({
    userId: user.id,
    channelId: params.id,
  });

  const formData = await request.formData();
  const cohostId = (formData.get("cohostId") as string) ?? undefined;

  if (!cohostId) {
    return typedjson({ message: "cohostId is required" }, { status: 400 });
  }

  const currentStatus = await db.comods.findFirst({
    where: {
      channelId: channel.id,
      fid: cohostId,
    },
  });

  const session = await getSession(request.headers.get("Cookie"));

  if (currentStatus) {
    await db.comods.delete({
      where: {
        id: currentStatus.id,
        channelId: channel.id,
        fid: cohostId,
      },
    });

    session.flash("message", {
      id: uuid(),
      type: "success",
      message: `Removed @${currentStatus.username} as a collaborator`,
    });
  } else {
    const cohost = await requireUserIsCohost({
      fid: +cohostId,
      channelId: params.id,
    });

    await db.comods.create({
      data: {
        channelId: channel.id,
        fid: cohostId,
        username: cohost.username,
        avatarUrl: cohost.pfp.url,
      },
    });

    session.flash("message", {
      id: uuid(),
      type: "success",
      message: `Added @${cohost.username} as a collaborator`,
    });
  }

  return typedjson(
    { message: "success" },
    {
      headers: {
        "Set-Cookie": await commitSession(session),
      },
    }
  );
}

export default function Screen() {
  const { user, channel } = useTypedLoaderData<typeof loader>();

  return (
    <div>
      <p className="font-semibold">Add Cohosts to Automod</p>
      <p className="text-gray-500">
        Collaborators can manage all moderation settings except for adding or removing other collaborators.
      </p>

      <div className="divide-y border-t border-b mt-8">
        {channel.roles.map((role) => (
          <div key={role.id} className="flex items-center justify-between">
            <Link className="block no-underline" to={`/~/channels/${channel.id}/roles/${role.name}`}>
              {role.name}
            </Link>
            <p className="text-gray-400 text-xs">
              {role.delegates.length ? plur("Member", role.delegates.length) : ""}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
