import { ActionFunctionArgs, json } from "@remix-run/node";
import invariant from "tiny-invariant";
import { db } from "~/lib/db.server";
import { requireUser, requireUserOwnsChannel } from "~/lib/utils.server";

export async function action({ request, params }: ActionFunctionArgs) {
  invariant(params.id, "id is required");
  const user = await requireUser({ request });
  const mChannel = await requireUserOwnsChannel({
    userId: user.id,
    channelId: params.id,
  });

  const updatedChannel = await db.moderatedChannel.update({
    where: {
      id: mChannel.id,
    },
    data: {
      active: !mChannel.active,
    },
  });

  return json(updatedChannel);
}
