/* eslint-disable @typescript-eslint/no-explicit-any */
import { ActionFunctionArgs, json } from "@remix-run/node";
import { z } from "zod";
import { db } from "~/lib/db.server";
import { neynar } from "~/lib/neynar.server";
import { MessageResponse } from "~/lib/types";
import {
  canUserExecuteAction,
  canUserModerateChannel,
  formatZodError,
  parseMessage,
} from "~/lib/utils.server";
import { actionFunctions, actionTypes, userIsCohost } from "~/lib/validations.server";
import { logModerationAction } from "./api.webhooks.neynar";
import { getChannelHosts } from "~/lib/warpcast.server";

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    const url = new URL(request.url);
    const validation = z
      .object({
        action: z.enum(actionTypes),
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

    const args: any = {};
    if (validation.data.action === "cooldown") {
      args.duration = parseInt(url.searchParams.get("duration") || "24");
    } else if (validation.data.action === "grantRole") {
      const roleId = url.searchParams.get("roleId");
      if (!roleId) {
        console.error("Missing roleId");
        return json(
          {
            message: "Reinstall this action",
          },
          {
            status: 400,
          }
        );
      }
      args.roleId = roleId;
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

    const isAllowed = await canUserExecuteAction({
      userId: String(userFid),
      channelId: channel.id,
      action: validation.data.action,
    });

    if (!isAllowed) {
      return json(
        {
          message: "You are not allowed to do that",
        },
        {
          status: 400,
        }
      );
    }

    const cast = await neynar.fetchBulkCasts([message.action.cast.hash]);

    const cohosts = await getChannelHosts({
      channel: channel.id,
    });
    if (cohosts.result.hosts.some((h) => h.fid === cast.result.casts[0].author.fid)) {
      return json(
        {
          message: "Can't apply to host",
        },
        {
          status: 400,
        }
      );
    }

    const actionFunction = actionFunctions[validation.data.action];
    await actionFunction({
      channel: channel.id,
      cast: cast.result.casts[0],
      action: {
        type: validation.data.action,
        args,
      },
    });

    await logModerationAction(
      channel.id,
      validation.data.action,
      `Applied manually by @${message.action.interactor.username}`,
      cast.result.casts[0],
      false,
      {
        actor: `@${message.action.interactor.username}`,
      }
    );

    return json({
      message: `Applied`,
    });
  } catch (e) {
    console.error(e);
    throw e;
  }
}
