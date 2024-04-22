import { Cast, Channel } from "@neynar/nodejs-sdk/build/neynar-api/v2";
import * as Sentry from "@sentry/remix";
import { ModeratedChannel, ModerationLog, Prisma } from "@prisma/client";
import { v4 as uuid } from "uuid";
import { ActionFunctionArgs, json } from "@remix-run/node";
import { db } from "~/lib/db.server";
import { getChannel, neynar } from "~/lib/neynar.server";
import { requireValidSignature } from "~/lib/utils.server";

import { Action, Rule, actionFunctions, ruleFunctions } from "~/lib/validations.server";
import { getChannelHosts, hideQuietly, isCohost } from "~/lib/warpcast.server";
import { castQueue, defaultProcessCastJobArgs, syncQueue } from "~/lib/bullish.server";
import { WebhookCast } from "~/lib/types";
import { PlanType, userPlans } from "~/lib/auth.server";
import { toggleWebhook } from "./api.channels.$id.toggleEnable";

const FullModeratedChannel = Prisma.validator<Prisma.ModeratedChannelDefaultArgs>()({
  include: {
    user: true,
    ruleSets: {
      where: {
        active: true,
      },
    },
  },
});

export type FullModeratedChannel = Prisma.ModeratedChannelGetPayload<typeof FullModeratedChannel>;

export async function action({ request }: ActionFunctionArgs) {
  const rawPayload = await request.text();
  const webhookNotif = JSON.parse(rawPayload) as {
    type: string;
    data: WebhookCast;
  };

  if (process.env.NODE_ENV === "development") {
    console.log(webhookNotif);
  }

  if (webhookNotif.type !== "cast.created") {
    return json({ message: "Invalid webhook type" }, { status: 400 });
  }

  await requireValidSignature({
    request,
    payload: rawPayload,
    sharedSecret: process.env.NEYNAR_WEBHOOK_SECRET!,
    incomingSignature: request.headers.get("X-Neynar-Signature")!,
  });

  console.log(`[${webhookNotif.data.root_parent_url}]: cast ${webhookNotif.data.hash}`);

  const channelName = webhookNotif.data.root_parent_url?.split("/").pop();

  if (!channelName) {
    console.error(`Couldn't extract channel name: ${webhookNotif.data.root_parent_url}`, webhookNotif.data);
    return json({ message: "Invalid parent_url" }, { status: 400 });
  }

  const [moderatedChannel, alreadyProcessed] = await Promise.all([
    db.moderatedChannel.findFirst({
      where: {
        OR: [{ id: channelName }, { url: webhookNotif.data.root_parent_url }],
        active: true,
      },
      include: {
        user: true,
        ruleSets: {
          where: {
            active: true,
          },
        },
      },
    }),
  ]);

  if (!moderatedChannel) {
    console.error(`Channel ${channelName} is not moderated`, webhookNotif.data);
    return json({ message: "Channel is not moderated" }, { status: 400 });
  }

  if (await isUserOverUsage(moderatedChannel, 0.1)) {
    console.error(`User ${moderatedChannel.userId} is over usage limit. Moderation disabled.`);
    await toggleWebhook({ channelId: moderatedChannel.id, active: false });
    return json({ message: "User is over usage limit" }, { status: 400 });
  }

  if (moderatedChannel.user.plan === "expired") {
    console.error(
      `User's plan ${moderatedChannel.user.id} is expired, ${moderatedChannel.id} moderation disabled`
    );
    await toggleWebhook({ channelId: moderatedChannel.id, active: false });
    return json({ message: "User's plan is expired, moderation disabled" }, { status: 400 });
  }

  if (moderatedChannel.ruleSets.length === 0) {
    console.log(`Channel ${moderatedChannel.id} has no rules. Doing nothing.`);
    return json({ message: "Channel has no rules" });
  }

  if (alreadyProcessed) {
    console.log(`Cast ${webhookNotif.data.hash.substring(0, 10)} already processed`);
    return json({ message: "Already processed" });
  }

  const [cohost, channel] = await Promise.all([
    isCohost({
      fid: +moderatedChannel.userId,
      channel: moderatedChannel.id,
    }),
    getChannel({ name: moderatedChannel.id }).catch(() => null),
  ]);

  if (!cohost) {
    console.log(`User ${moderatedChannel.userId} is no longer a cohost. Disabling moderation.`);
    await db.moderatedChannel.update({
      where: {
        id: moderatedChannel.id,
      },
      data: {
        active: false,
      },
    });

    return json({ message: "Creator of moderated channel is no longer a cohost" }, { status: 400 });
  }

  if (!channel) {
    console.error(
      `There's a moderated channel configured for ${moderatedChannel.id}, warpcast knows about it, but neynar doesn't. Something is wrong.`
    );
    return json({ message: "Channel not found" }, { status: 404 });
  }

  const usage = await db.usage.upsert({
    where: {
      channelId_monthYear: {
        channelId: moderatedChannel.id,
        monthYear: new Date().toISOString().substring(0, 7),
      },
    },
    create: {
      channelId: moderatedChannel.id,
      monthYear: new Date().toISOString().substring(0, 7),
      userId: moderatedChannel.userId,
      castsProcessed: 1,
    },
    update: {
      castsProcessed: {
        increment: 1,
      },
    },
  });

  await Promise.all([
    await db.castLog.upsert({
      where: {
        hash: webhookNotif.data.hash,
      },
      create: {
        hash: webhookNotif.data.hash,
        replyCount: webhookNotif.data.replies.count,
        channelId: channel.id,
        status: "waiting",
      },
      update: {
        status: "waiting",
      },
    }),
    await castQueue.add(
      "processCast",
      {
        channel,
        moderatedChannel,
        cast: webhookNotif.data,
      },
      defaultProcessCastJobArgs(webhookNotif.data.hash)
    ),
  ]);

  if (usage.castsProcessed % 25 === 0) {
    syncQueue.add(
      "syncChannel",
      { channelId: moderatedChannel.id, rootCastsToProcess: 50 },
      {
        jobId: `sync-${moderatedChannel.id}-${usage.castsProcessed}`,
        removeOnFail: 100,
        removeOnComplete: 100,
        backoff: {
          type: "exponential",
          delay: 10_000,
        },
        attempts: 2,
      }
    );
  }

  return json({
    message: "enqueued",
  });
}

export type ValidateCastArgs = {
  channel: Channel;
  moderatedChannel: FullModeratedChannel;
  cast: WebhookCast;
  simulation?: boolean;
};

export async function validateCast({
  channel,
  moderatedChannel,
  cast,
  simulation = false,
}: ValidateCastArgs): Promise<Array<ModerationLog>> {
  const logs: Array<ModerationLog> = [];

  // dear future, some casts are missing an author, assuming a
  // race/error with cast hydration and webhooks.
  // refetch, if it fails throw w/exponential backoff.
  if (!cast.author) {
    Sentry.captureMessage(`Cast ${cast.hash} has no author`);
    // typings are wrong, root_parent_url exists on actual response
    const refreshedCast = (await neynar
      .fetchBulkCasts([cast.hash])
      .then((r) => r.result.casts[0])) as WebhookCast;

    if (!refreshedCast.author) {
      Sentry.captureMessage(`Retried, cast ${cast.hash} still has no author`);
      throw new Error(`Cast ${cast.hash} has no author`);
    } else {
      cast = refreshedCast;
    }
  }

  const isExcluded = JSON.parse(moderatedChannel.excludeUsernames).includes(cast.author.username);

  if (isExcluded) {
    console.log(`User @${cast.author.username} is excluded. Doing nothing.`);
    return logs;
  }

  if (moderatedChannel.excludeCohosts) {
    const cohosts = await getChannelHosts({ channel: channel.id });
    if (cohosts.result.hosts.find((c) => c.fid === cast.author.fid)) {
      console.log(`[${channel.id}] @${cast.author.username} is a cohost. Doing nothing.`);
      return logs;
    }
  }

  const cooldown = await db.cooldown.findFirst({
    where: {
      affectedUserId: String(cast.author.fid),
      channelId: moderatedChannel.id,
      active: true,
      OR: [
        {
          expiresAt: {
            gte: new Date(),
          },
        },
        {
          // if null then its a soft-ban
          expiresAt: null,
        },
      ],
    },
  });

  if (cooldown) {
    if (!simulation) {
      await hideQuietly({
        channel: moderatedChannel.id,
        cast,
        action: { type: "hideQuietly" },
      });
    }

    if (cooldown.expiresAt) {
      logs.push(
        await logModerationAction(
          moderatedChannel.id,
          "hideQuietly",
          `User is in cooldown until ${cooldown.expiresAt.toISOString()}`,
          cast,
          simulation
        )
      );
    } else {
      logs.push(
        await logModerationAction(
          moderatedChannel.id,
          "hideQuietly",
          `User is currently muted`,
          cast,
          simulation
        )
      );
    }

    return logs;
  }

  for (const ruleSet of moderatedChannel.ruleSets) {
    if (!isRuleTargetApplicable(ruleSet.target, cast)) {
      continue;
    }

    const rule: Rule = JSON.parse(ruleSet.rule);
    const actions: Action[] = JSON.parse(ruleSet.actions);

    const ruleEvaluation = await evaluateRules(moderatedChannel, cast, rule);

    if (ruleEvaluation.didViolateRule) {
      /**
       * Temporarily disabling ban threshold until I can
       * think more about it
       */
      // if (moderatedChannel.banThreshold) {
      //   const violations = await db.moderationLog.groupBy({
      //     by: ["channelId", "castHash"],
      //     where: {
      //       affectedUserFid: String(cast.author.fid),
      //     },
      //     _count: {
      //       _all: true,
      //     },
      //   });

      //   // note: use >= because this cast that has
      //   // violated the rules is not in the db at this
      //   // point.
      //   if (violations.length >= moderatedChannel.banThreshold) {
      //     const isCo = await isCohost({
      //       fid: cast.author.fid,
      //       channel: channel.id,
      //     });

      //     if (!isCo) {
      //       await ban({
      //         channel: channel.id,
      //         cast,
      //         action: { type: "ban" },
      //       });

      //       await logModerationAction(
      //         moderatedChannel.id,
      //         "ban",
      //         `User exceeded warn threshold of ${moderatedChannel.banThreshold} and is banned.`,
      //         cast
      //       );

      //       return json({ message: "User banned" });
      //     } else {
      //       await logModerationAction(
      //         moderatedChannel.id,
      //         "bypass",
      //         `User exceeded warn threshold of ${moderatedChannel.banThreshold} but is cohost.`,
      //         cast
      //       );
      //     }
      //   }
      // }

      for (const action of actions) {
        if (!simulation) {
          const actionFn = actionFunctions[action.type];

          await actionFn({
            channel: channel.id,
            cast,
            action,
          }).catch((e) => {
            Sentry.captureMessage(`Error in ${action.type} action`, {
              extra: {
                cast,
                action,
              },
            });
            console.error(e?.response?.data || e?.message || e);
            throw e;
          });
        }

        console.log(
          `${simulation ? "[simulation]: " : ""}[${channel.id}]: ${action.type} @${cast.author.username}: ${
            ruleEvaluation.explanation
          }`
        );

        if (
          action.type === "ban" &&
          (await isCohost({
            fid: cast.author.fid,
            channel: channel.id,
          }))
        ) {
          logs.push(
            await logModerationAction(
              moderatedChannel.id,
              "bypass",
              `User would be banned but is a cohost, doing nothing.`,
              cast,
              simulation
            )
          );
          continue;
        }

        logs.push(
          await logModerationAction(
            moderatedChannel.id,
            action.type,
            ruleEvaluation.explanation,
            cast,
            simulation
          )
        );
      }
    }
  }

  return logs;
}

export async function logModerationAction(
  moderatedChannelId: string,
  actionType: string,
  reason: string,
  cast: Cast,
  simulation: boolean,
  options?: {
    actor?: string;
  }
): Promise<ModerationLog> {
  if (!simulation) {
    return db.moderationLog.create({
      data: {
        channelId: moderatedChannelId,
        action: actionType,
        actor: options?.actor || "system",
        reason,
        affectedUsername: cast.author.username || String(cast.author.fid) || "unknown",
        affectedUserAvatarUrl: cast.author.pfp_url,
        affectedUserFid: String(cast.author.fid),
        castText: cast.text,
        castHash: cast.hash,
      },
    });
  } else {
    return {
      id: `sim-${uuid()}`,
      channelId: moderatedChannelId,
      action: actionType,
      actor: "system",
      reason,
      affectedUsername: cast.author.username,
      affectedUserAvatarUrl: cast.author.pfp_url || null,
      affectedUserFid: String(cast.author.fid),
      castHash: cast.hash,
      castText: cast.text,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}

async function evaluateRules(
  moderatedChannel: ModeratedChannel,
  cast: WebhookCast,
  rule: Rule
): Promise<
  | {
      didViolateRule: true;
      failedRule: Rule;
      explanation: string;
    }
  | {
      didViolateRule: false;
    }
> {
  if (rule.type === "CONDITION") {
    return evaluateRule(moderatedChannel, cast, rule);
  } else if (rule.type === "LOGICAL" && rule.conditions) {
    if (rule.operation === "AND") {
      const evaluations = await Promise.all(
        rule.conditions.map((subRule) => evaluateRules(moderatedChannel, cast, subRule))
      );
      if (evaluations.every((e) => e.didViolateRule)) {
        return {
          didViolateRule: true,
          failedRule: rule,
          explanation: `${evaluations
            // @ts-expect-error ts doesnt acknowledge `every`
            // in discriminated union
            .map((e) => e.explanation)
            .join(", ")}`,
        };
      } else {
        return { didViolateRule: false };
      }
    } else if (rule.operation === "OR") {
      const results = await Promise.all(
        rule.conditions.map((subRule) => evaluateRules(moderatedChannel, cast, subRule))
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

async function evaluateRule(
  channel: ModeratedChannel,
  cast: WebhookCast,
  rule: Rule
): Promise<
  | {
      didViolateRule: true;
      failedRule: Rule;
      explanation: string;
    }
  | {
      didViolateRule: false;
    }
> {
  const check = ruleFunctions[rule.name];
  if (!check) {
    throw new Error(`No function for rule ${rule.name}`);
  }

  const error = await check({ channel, cast, rule });

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

function isRuleTargetApplicable(target: string, cast: Cast) {
  switch (target) {
    case "all":
      return true;
    case "root":
      return cast.parent_hash == null;
    case "reply":
      return cast.parent_hash !== null;
    default:
      return true;
  }
}

async function isUserOverUsage(moderatedChannel: FullModeratedChannel, buffer = 0) {
  const plan = userPlans[moderatedChannel.user.plan as PlanType];
  if (!plan) {
    return false;
  }

  const usage = await db.usage.findFirst({
    where: {
      userId: moderatedChannel.userId,
      monthYear: new Date().toISOString().substring(0, 7),
    },
  });

  if (!usage) {
    return false;
  }

  const maxCastsWithBuffer = plan.maxCasts * (1 + buffer);
  if (usage.castsProcessed >= maxCastsWithBuffer) {
    return true;
  }

  return false;
}
