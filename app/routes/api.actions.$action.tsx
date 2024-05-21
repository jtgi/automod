/* eslint-disable @typescript-eslint/no-explicit-any */
import { ActionFunctionArgs, LoaderFunctionArgs, json } from "@remix-run/node";
import { z } from "zod";
import { db } from "~/lib/db.server";
import { getChannel, neynar } from "~/lib/neynar.server";
import { CastAction, MessageResponse } from "~/lib/types";
import { canUserExecuteAction, formatZodError, getSharedEnv, parseMessage } from "~/lib/utils.server";
import { actionFunctions, actionTypes } from "~/lib/validations.server";
import { isRuleTargetApplicable, logModerationAction } from "./api.webhooks.neynar";
import { getChannelHosts } from "~/lib/warpcast.server";
import { actions } from "~/lib/cast-actions.server";
import { grantRoleAction } from "~/lib/utils";
import { castQueue } from "~/lib/bullish.server";

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
          message: formatZodError(validation.error),
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

    if (validation.data.action === "like") {
      if (!isRuleTargetApplicable("root", message.action.cast as any)) {
        return json({ message: "Root casts only. This is a reply." }, { status: 400 });
      }
    }

    const userFid = message.action.interactor.fid;

    const moderatedChannel = await db.moderatedChannel.findFirst({
      where: {
        url: message.action.cast.root_parent_url,
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

    if (!moderatedChannel) {
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
      channelId: moderatedChannel.id,
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

    const [cast, cohosts] = await Promise.all([
      neynar.fetchBulkCasts([message.action.cast.hash]),
      getChannelHosts({ channel: moderatedChannel.id }),
    ]);

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

    if (validation.data.action === "downvote") {
      const actionFunction = actionFunctions[validation.data.action];
      await actionFunction({
        channel: moderatedChannel.id,
        cast: cast.result.casts[0],
        action: {
          type: validation.data.action,
          args: {
            voterFid: String(message.action.interactor.fid),
            voterAvatarUrl: message.action.interactor.pfp_url,
            voterUsername: message.action.interactor.username,
          },
        },
      });
      const [neynarChannel] = await Promise.all([
        getChannel({ name: moderatedChannel.id }).catch(() => null),
        await logModerationAction(
          moderatedChannel.id,
          validation.data.action,
          `Applied by @${message.action.interactor.username}`,
          cast.result.casts[0],
          false,
          {
            actor: `@${message.action.interactor.username}`,
          }
        ),
      ]);

      castQueue.add(
        "processCast",
        {
          channel: neynarChannel,
          moderatedChannel,
          cast: cast.result.casts[0],
        },
        {
          jobId: `cast-${cast.result.casts[0].hash}-downvote-${message.action.interactor.fid}`,
        }
      );

      return json({
        message: `Downvoted`,
      });
    } else {
      const actionFunction = actionFunctions[validation.data.action];
      await actionFunction({
        channel: moderatedChannel.id,
        cast: cast.result.casts[0],
        action: {
          type: validation.data.action,
          args,
        },
      });

      await logModerationAction(
        moderatedChannel.id,
        validation.data.action,
        `Applied by @${message.action.interactor.username}`,
        cast.result.casts[0],
        false,
        {
          actor: `@${message.action.interactor.username}`,
        }
      );
    }

    return json({
      message: `Applied`,
    });
  } catch (e) {
    console.error(e);
    throw e;
  }
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const type = params.action;
  const env = getSharedEnv();

  let actionDef: CastAction | undefined;
  if (type === "grantRole") {
    const url = new URL(request.url);
    const roleId = url.searchParams.get("roleId");
    const channelId = url.searchParams.get("channelId");
    const roleName = url.searchParams.get("roleName");

    if (!roleId || !channelId || !roleName) {
      return json(
        {
          message: "Missing query params",
        },
        {
          status: 400,
        }
      );
    }

    actionDef = grantRoleAction({
      id: roleId,
      name: roleName,
      channelId,
      hostUrl: env.hostUrl,
    });
  } else {
    actionDef = actions.find((a) => a.automodAction === type);
  }

  if (!actionDef) {
    return json(
      {
        message: "Action not found",
      },
      {
        status: 404,
      }
    );
  }

  return json({
    ...actionDef,
  });
}
