import { ActionFunctionArgs, json } from "@remix-run/node";
import { z } from "zod";
import { db } from "~/lib/db.server";
import { neynar } from "~/lib/neynar.server";
import { MessageResponse } from "~/lib/types";
import { canUserModerateChannel, formatZodError, parseMessage } from "~/lib/utils.server";
import { actionFunctions } from "~/lib/validations.server";
import { logModerationAction } from "./api.webhooks.neynar";

export const supportedActions = ["mute", "cooldown", "addToBypass"] as const;

export async function action({ request, params }: ActionFunctionArgs) {
  const validation = z
    .object({
      action: z.enum(supportedActions),
    })
    .safeParse(params);

  if (!validation.success) {
    console.error(validation.error);
    return json(
      {
        message: `Oops:${formatZodError(validation.error)}`,
      },
      {
        status: 400,
      }
    );
  }

  const payload = await request.json();

  let message: MessageResponse | null = null;
  try {
    message = await parseMessage(payload);
  } catch (e) {
    console.error(e);
    return json(
      {
        message: (e as Error).message,
      },
      {
        status: 400,
      }
    );
  }

  const userFid = message.action.interactor.fid;

  const channel = await db.moderatedChannel.findFirst({
    where: {
      url: message.action.cast.root_parent_url,
    },
  });

  if (!channel) {
    return json(
      {
        message: "Automod not installed",
      },
      {
        status: 400,
      }
    );
  }

  const { result } = await canUserModerateChannel({
    userId: String(userFid),
    channelId: channel.id,
  });

  if (!result) {
    return json(
      {
        message: "You're not a moderator.",
      },
      {
        status: 400,
      }
    );
  }

  const cast = await neynar.fetchBulkCasts([message.action.cast.hash]);

  const actionFunction = actionFunctions[validation.data.action];
  await actionFunction({
    channel: channel.id,
    cast: cast.result.casts[0],
    action: {
      type: validation.data.action,
      args: {
        duration: 24,
      },
    },
  });

  await logModerationAction(
    channel.id,
    validation.data.action,
    `Applied manually by @${message.action.interactor.username}`,
    cast.result.casts[0],
    false
  );

  return json({
    message: `Success!`,
  });
}
