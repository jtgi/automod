import { ActionFunctionArgs, json } from "@remix-run/node";
import invariant from "tiny-invariant";
import { db } from "~/lib/db.server";
import { registerWebhook, unregisterWebhook } from "~/lib/neynar.server";
import { requireUser, requireUserCanModerateChannel } from "~/lib/utils.server";

export async function action({ request, params }: ActionFunctionArgs) {
  invariant(params.id, "id is required");
  const user = await requireUser({ request });
  const mChannel = await requireUserCanModerateChannel({
    userId: user.id,
    channelId: params.id,
  });

  const updatedChannel = await toggleWebhook({ channelId: params.id, active: !mChannel.active });
  return json(updatedChannel);
}

export async function toggleWebhook(args: { channelId: string; active: boolean }) {
  const channel = await db.moderatedChannel.findUniqueOrThrow({
    where: {
      id: args.channelId,
    },
  });

  const [updatedChannel] = await Promise.all([
    db.moderatedChannel.update({
      where: {
        id: args.channelId,
      },
      data: {
        active: args.active,
      },
    }),
    args.active
      ? registerWebhook({ rootParentUrl: channel.url! })
      : unregisterWebhook({ rootParentUrl: channel.url! }),
  ]);

  return updatedChannel;
}
