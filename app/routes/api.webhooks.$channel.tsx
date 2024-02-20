import { Cast, Channel } from "@neynar/nodejs-sdk/build/neynar-api/v2";
import { ModeratedChannel, Prisma } from "@prisma/client";
import { ActionFunctionArgs, json } from "@remix-run/node";
import invariant from "tiny-invariant";
import { db } from "~/lib/db.server";
import { getChannel, getUser } from "~/lib/neynar.server";
import {
  Action,
  Rule,
  actionDefinitions,
  ruleFunctions,
} from "~/lib/validations.server";
import { ban, hideQuietly, warnAndHide } from "~/lib/warpcast.server";

/**
 * invite flow
 * - user sees landing page
 * - user pays, redirect sets channel limit from plan
 * - generate invite link and send to user
 * - user clicks link, logs in with farcaster
 * - user clicks "new channel mod"
 * - user clicks "invite automod to your channel"
 *   - automod follows channel
 * - user adds automod as cohost
 * - security consideration
 *   - when an automod rule is created for a channel we must check:
 *     - the user is a cohost of a channel
 *     - another ruleset for the channel doesn't already exist, if it does, it must be detached first.
 *     - no transfers or team based stuff for v0, i'll do it manually
 * - user configures rules
 * - saves
 * - automod adds warpcast channel url to neynar subscription
 *
 * new cast comes in
 * - automod looks up rule set by channel
 * - automod checks rule set
 * - automod logs if any action
 */

const userPlans = {
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

export async function action({ request, params }: ActionFunctionArgs) {
  invariant(params.channel, "Channel is required");

  const moderatedChannel = await db.moderatedChannel.findFirst({
    where: { id: params.channel, active: true },
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

  const channel = await getChannel({ name: params.channel }).catch(() => null);
  if (!channel) {
    return json({ message: "Channel not found" }, { status: 404 });
  }

  if (String(channel.lead?.fid) !== moderatedChannel.userId) {
    return json(
      {
        message: `Only @${channel.lead?.username} can configure moderation for this channel. If the lead has changed, please contact support.`,
      },
      { status: 403 }
    );
  }

  const webhookNotif = (await request.json()) as { type: string; data: Cast };

  if (webhookNotif.type !== "cast.created") {
    return json({ message: "Invalid webhook type" }, { status: 400 });
  }

  const cast = webhookNotif.data;
  await validateCast({
    channel,
    moderatedChannel,
    cast,
  });

  return json({});
}

async function validateCast({
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

    const ruleEvaluation = evaluateRules(cast, rule); // Assuming evaluateRules from previous context

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
          violations[0]._count._all > moderatedChannel.banThreshold
        ) {
          await ban({
            channel: channel.name || channel.id,
            cast,
          });
          await logModerationAction(
            moderatedChannel.id,
            "ban",
            `User is banned for violating more than ${moderatedChannel.banThreshold} rules.`,
            cast
          );
          return json({ message: "User banned" });
        }
      }

      for (const action of actions) {
        const actionFn = actionDefinitions[action.type];
        await actionFn({ channel: channel.name || channel.id, cast }).catch(
          (e) => {
            console.error(e);
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
