import { Cast, Channel } from "@neynar/nodejs-sdk/build/neynar-api/v2";
import { ModeratedChannel, Prisma } from "@prisma/client";
import { ActionFunctionArgs, json } from "@remix-run/node";
import invariant from "tiny-invariant";
import { db } from "~/lib/db.server";
import { getChannel, getUser } from "~/lib/neynar.server";
import { requireValidSignature } from "~/lib/utils.server";
import {
  Action,
  Rule,
  actionFunctions,
  ruleFunctions,
} from "~/lib/validations.server";
import { ban, hideQuietly, isCohost, warnAndHide } from "~/lib/warpcast.server";

export const userPlans = {
  basic: {
    maxChannels: 1,
    maxRules: 1,
  },
  pro: {
    maxChannels: 4,
    maxRules: 4,
  },
  elite: {
    maxChannels: 10,
    maxRules: 10,
  },
};

const FullModeratedChannel = Prisma.validator<Prisma.ModeratedChannelArgs>()({
  include: {
    user: true,
    ruleSets: {
      where: {
        active: true,
      },
    },
  },
});

type FullModeratedChannel = Prisma.ModeratedChannelGetPayload<
  typeof FullModeratedChannel
>;

export async function action({ request }: ActionFunctionArgs) {
  const rawPayload = await request.text();
  const webhookNotif = JSON.parse(rawPayload) as { type: string; data: Cast };

  if (webhookNotif.type !== "cast.created") {
    return json({ message: "Invalid webhook type" }, { status: 400 });
  }

  await requireValidSignature({
    request,
    payload: await request.text(),
    sharedSecret: process.env.NEYNAR_WEBHOOK_SECRET!,
    incomingSignature: request.headers.get("X-Neynar-Signature")!,
  });

  const channelName = webhookNotif.data.parent_url?.split("/").pop();

  if (!channelName) {
    console.error(
      `Couldn't extract channel name: ${webhookNotif.data.parent_url}`
    );
    return json({ message: "Invalid parent_url" }, { status: 400 });
  }

  const moderatedChannel = await db.moderatedChannel.findFirst({
    where: { id: channelName, active: true },
    include: {
      user: true,
      ruleSets: {
        where: {
          active: true,
        },
      },
    },
  });

  if (!moderatedChannel) {
    return json({ message: "Channel is not moderated" }, { status: 404 });
  }

  if (moderatedChannel.user.plan === "expired") {
    return json(
      { message: "User's plan is expired, moderation disabled" },
      { status: 403 }
    );
  }

  const cohost = await isCohost({
    fid: +moderatedChannel.userId,
    channel: channelName,
  });

  if (!cohost) {
    console.log(
      `User ${moderatedChannel.userId} is no longer a cohost. Disabling moderation.`
    );
    await db.moderatedChannel.update({
      where: {
        id: channelName,
      },
      data: {
        active: false,
      },
    });

    return json(
      { message: "Creator of moderated channel is no longer a cohost" },
      { status: 403 }
    );
  }

  const channel = await getChannel({ name: channelName }).catch(() => null);
  if (!channel) {
    return json({ message: "Channel not found" }, { status: 404 });
  }

  await validateCast({
    channel,
    moderatedChannel,
    cast: webhookNotif.data,
  });

  return json({});
}

export async function validateCast({
  channel,
  moderatedChannel,
  cast,
}: {
  channel: Channel;
  moderatedChannel: FullModeratedChannel;
  cast: Cast;
}) {
  for (const ruleSet of moderatedChannel.ruleSets) {
    const rule: Rule = JSON.parse(ruleSet.rule);
    const actions: Action[] = JSON.parse(ruleSet.actions);

    const ruleEvaluation = evaluateRules(cast, rule);

    if (ruleEvaluation.didViolateRule) {
      if (moderatedChannel.banThreshold) {
        const violations = await db.moderationLog.groupBy({
          by: ["channelId", "castHash"],
          where: {
            affectedUserFid: String(cast.author.fid),
          },
          _count: {
            _all: true,
          },
        });

        if (
          violations[0] &&
          violations[0]._count._all >= moderatedChannel.banThreshold
        ) {
          await ban({
            channel: channel.name || channel.id,
            cast,
          });

          await logModerationAction(
            moderatedChannel.id,
            "ban",
            `User exceeded warn threshold of ${moderatedChannel.banThreshold} and is banned.`,
            cast
          );

          return json({ message: "User banned" });
        }
      }

      for (const action of actions) {
        const actionFn = actionFunctions[action.type];
        await actionFn({ channel: channel.name || channel.id, cast }).catch(
          (e) => {
            console.error(e.response?.data);
            throw e;
          }
        );

        await logModerationAction(
          moderatedChannel.id,
          action.type,
          ruleEvaluation.explanation,
          cast
        );
      }
    }
  }
}

async function logModerationAction(
  moderatedChannelId: string,
  actionType: string,
  reason: string,
  cast: Cast
) {
  return db.moderationLog.create({
    data: {
      channelId: moderatedChannelId,
      action: actionType,
      reason,
      affectedUsername: cast.author.username,
      affectedUserAvatarUrl: cast.author.pfp_url,
      affectedUserFid: String(cast.author.fid),
      castHash: cast.hash,
    },
  });
}

function evaluateRules(
  cast: Cast,
  rule: Rule
):
  | {
      didViolateRule: true;
      failedRule: Rule;
      explanation: string;
    }
  | {
      didViolateRule: false;
    } {
  if (rule.type === "CONDITION") {
    return evaluateRule(cast, rule);
  } else if (rule.type === "LOGICAL" && rule.conditions) {
    if (rule.operation === "AND") {
      const evaluations = rule.conditions.map((subRule) =>
        evaluateRules(cast, subRule)
      );
      if (evaluations.every((e) => e.didViolateRule)) {
        return {
          didViolateRule: true,
          failedRule: rule,
          explanation: `All of the following rules were violated: ${evaluations
            // @ts-expect-error ts doesnt acknowledge `every`
            // in discriminated union
            .map((e) => e.explanation)
            .join(", ")}`,
        };
      } else {
        return { didViolateRule: false };
      }
    } else if (rule.operation === "OR") {
      const results = rule.conditions.map((subRule) =>
        evaluateRules(cast, subRule)
      );

      const violation = results.find((r) => r.didViolateRule);
      if (violation) {
        return violation;
      } else {
        return { didViolateRule: false };
      }
    }
  }

  return { didViolateRule: false };
}

function evaluateRule(
  cast: Cast,
  rule: Rule
):
  | {
      didViolateRule: true;
      failedRule: Rule;
      explanation: string;
    }
  | {
      didViolateRule: false;
    } {
  const check = ruleFunctions[rule.name];
  const error = check(cast, rule);

  if (error) {
    return {
      didViolateRule: Boolean(error),
      failedRule: rule,
      explanation: error,
    };
  } else {
    return { didViolateRule: false };
  }
}
