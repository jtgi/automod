import { Cast, Channel } from "@neynar/nodejs-sdk/build/neynar-api/v2";
import * as Sentry from "@sentry/remix";
import { ModeratedChannel, ModerationLog, Prisma, RuleSet } from "@prisma/client";
import { v4 as uuid } from "uuid";
import { ActionFunctionArgs, json } from "@remix-run/node";
import { db } from "~/lib/db.server";
import { neynar } from "~/lib/neynar.server";
import { getModerators, requireValidSignature } from "~/lib/utils.server";

import {
  Action,
  Rule,
  SelectOption,
  actionFunctions,
  isCohost,
  ruleFunctions,
} from "~/lib/validations.server";
import { webhookQueue } from "~/lib/bullish.server";
import { WebhookCast } from "~/lib/types";
import { PlanType, userPlans } from "~/lib/auth.server";
import { getWarpcastChannelOwner } from "~/lib/warpcast.server";
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

export type FullModeratedChannel = Prisma.ModeratedChannelGetPayload<typeof FullModeratedChannel> & {
  inclusionRuleSetParsed: (RuleSet & { ruleParsed: Rule; actionsParsed: Array<Action> }) | undefined;
  exclusionRuleSetParsed: (RuleSet & { ruleParsed: Rule; actionsParsed: Array<Action> }) | undefined;
  excludeUsernamesParsed: Array<SelectOption> | undefined;
};

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

  const channelName = webhookNotif.data.root_parent_url?.split("/").pop();

  if (!channelName) {
    console.error(`Couldn't extract channel name: ${webhookNotif.data.root_parent_url}`, webhookNotif.data);
    return json({ message: "Invalid channel name" }, { status: 400 });
  }

  if (isRuleTargetApplicable("reply", webhookNotif.data)) {
    return json({ message: "Ignoring reply" });
  }

  webhookQueue.add(
    "webhookQueue",
    {
      webhookNotif,
      channelName,
    },
    {
      removeOnComplete: true,
      removeOnFail: 10_000,
    }
  );

  return json({
    message: "enqueued",
  });
}

export type ValidateCastArgs = {
  channel: Channel;
  moderatedChannel: FullModeratedChannel;
  cast: WebhookCast;
  executeOnProtocol?: boolean;
  simulation?: boolean;
};

export async function validateCast({
  channel,
  moderatedChannel,
  cast,
  executeOnProtocol = false,
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

  const isExcluded = moderatedChannel.excludeUsernamesParsed?.some((u) => u.value === cast.author.fid);
  const isOwner = channel.lead?.fid === cast.author.fid;

  if (isExcluded || isOwner) {
    console.log(`User @${cast.author.username} is in the bypass list.`);

    const [, log] = await Promise.all([
      simulation
        ? Promise.resolve()
        : actionFunctions["like"]({
            channel: channel.id,
            cast,
            action: { type: "like" },
          }),
      logModerationAction(
        moderatedChannel.id,
        "like",
        `@${cast.author.username} is in the bypass list.`,
        cast,
        simulation
      ),
    ]);

    logs.push(log);
    return logs;
  }

  if (moderatedChannel.excludeCohosts) {
    const mods = await getModerators({ channel: channel.id });
    if (mods.find((c) => c.fid === String(cast.author.fid))) {
      console.log(`[${channel.id}] @${cast.author.username} is a moderator. Curating.`);

      const [, log] = await Promise.all([
        simulation
          ? Promise.resolve()
          : actionFunctions["like"]({
              channel: channel.id,
              cast,
              action: { type: "like" },
            }),
        logModerationAction(
          moderatedChannel.id,
          "like",
          `@${cast.author.username} is in the bypass list.`,
          cast,
          simulation
        ),
      ]);

      logs.push(log);
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
          // if null then its a ban
          expiresAt: null,
        },
      ],
    },
  });

  if (cooldown) {
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
      console.log(`[${channel.id}] User @${cast.author.username} is banned. Skipping.`);
      // they're banned, logging is noise so skip
    }

    return logs;
  }

  if (!moderatedChannel.inclusionRuleSetParsed?.ruleParsed?.conditions?.length) {
    console.log(`[${channel.id}] No rules for channel.`);
    return logs;
  }

  if (moderatedChannel.exclusionRuleSetParsed?.ruleParsed?.conditions?.length) {
    const exclusionCheck = await evaluateRules(
      moderatedChannel,
      cast,
      moderatedChannel.exclusionRuleSetParsed?.ruleParsed
    );

    // exclusion overrides inclusion so we check it first
    // some checks are expensive so we do this serially
    if (exclusionCheck.passedRule) {
      for (const action of moderatedChannel.exclusionRuleSetParsed.actionsParsed) {
        if (!simulation) {
          const actionFn = actionFunctions[action.type];

          await actionFn({
            channel: channel.id,
            cast,
            action,
            options: {
              executeOnProtocol,
            },
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

        logs.push(
          await logModerationAction(
            moderatedChannel.id,
            action.type,
            exclusionCheck.explanation,
            cast,
            simulation
          )
        );
      }

      return logs;
    }
  }

  const inclusionCheck = await evaluateRules(
    moderatedChannel,
    cast,
    moderatedChannel.inclusionRuleSetParsed.ruleParsed
  );

  if (inclusionCheck.passedRule) {
    for (const action of moderatedChannel.inclusionRuleSetParsed.actionsParsed) {
      if (!simulation) {
        const actionFn = actionFunctions[action.type];

        await actionFn({
          channel: channel.id,
          cast,
          action,
          options: {
            executeOnProtocol,
          },
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

        if (moderatedChannel.slowModeHours > 0) {
          await db.cooldown.upsert({
            where: {
              affectedUserId_channelId: {
                channelId: moderatedChannel.id,
                affectedUserId: String(cast.author.fid),
              },
            },
            create: {
              channelId: moderatedChannel.id,
              affectedUserId: String(cast.author.fid),
              active: true,
              expiresAt: new Date(Date.now() + moderatedChannel.slowModeHours * 60 * 60 * 1000),
            },
            update: {
              active: true,
              expiresAt: new Date(Date.now() + moderatedChannel.slowModeHours * 60 * 60 * 1000),
            },
          });
        }
      }

      logs.push(
        await logModerationAction(
          moderatedChannel.id,
          action.type,
          inclusionCheck.explanation,
          cast,
          simulation
        )
      );
    }
    return logs;
  } else {
    logs.push(
      await logModerationAction(
        moderatedChannel.id,
        "hideQuietly",
        inclusionCheck.explanation,
        cast,
        simulation
      )
    );
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
): Promise<{
  passedRule: boolean;
  explanation: string;
}> {
  if (rule.type === "CONDITION") {
    return evaluateRule(moderatedChannel, cast, rule);
  } else if (rule.type === "LOGICAL" && rule.conditions) {
    if (rule.operation === "AND") {
      const evaluations = await Promise.all(
        rule.conditions.map((subRule) => evaluateRules(moderatedChannel, cast, subRule))
      );
      if (evaluations.every((e) => e.passedRule)) {
        return {
          passedRule: true,
          explanation: `${evaluations.map((e) => e.explanation).join(", ")}`,
        };
      } else {
        const failure = evaluations.find((e) => !e.passedRule)!;
        return { passedRule: false, explanation: `${failure.explanation}` };
      }
    } else if (rule.operation === "OR") {
      const results = await Promise.all(
        rule.conditions.map((subRule) => evaluateRules(moderatedChannel, cast, subRule))
      );

      const onePassed = results.find((r) => r.passedRule);
      if (onePassed) {
        return onePassed;
      } else {
        const explanation =
          results.length > 1
            ? `Failed all checks: ${results.map((e) => e.explanation).join(", ")}`
            : results[0].explanation;

        return {
          passedRule: false,
          explanation,
        };
      }
    }
  }

  return { passedRule: false, explanation: "No rules" };
}

async function evaluateRule(
  channel: ModeratedChannel,
  cast: WebhookCast,
  rule: Rule
): Promise<{ passedRule: boolean; explanation: string }> {
  const check = ruleFunctions[rule.name];
  if (!check) {
    throw new Error(`No function for rule ${rule.name}`);
  }

  const result = await check({ channel, cast, rule });

  return {
    passedRule: result.result,
    explanation: result.message,
  };
}

export function isRuleTargetApplicable(target: string, cast: Cast) {
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

export async function getUsage(moderatedChannel: FullModeratedChannel) {
  const plan = userPlans[moderatedChannel.user.plan as PlanType];
  if (!plan) {
    console.log(
      `Channel ${moderatedChannel.id}, User ${moderatedChannel.userId} has no plan`,
      moderatedChannel.user.plan
    );
    return 0;
  }

  const usages = await db.usage.findMany({
    where: {
      userId: moderatedChannel.userId,
      monthYear: new Date().toISOString().substring(0, 7),
    },
  });

  if (!usages.length) {
    console.log(
      `Channel ${moderatedChannel.id}, User ${moderatedChannel.userId} has no usage`,
      moderatedChannel.user.plan
    );
    return 0;
  }

  return usages.reduce((acc, u) => acc + u.castsProcessed, 0);
}

export async function isUserOverUsage(moderatedChannel: FullModeratedChannel, buffer = 0) {
  const plan = userPlans[moderatedChannel.user.plan as PlanType];
  if (!plan) {
    console.log(
      `Channel ${moderatedChannel.id}, User ${moderatedChannel.userId} has no plan`,
      moderatedChannel.user.plan
    );
    return false;
  }

  const usages = await db.usage.findMany({
    where: {
      userId: moderatedChannel.userId,
      monthYear: new Date().toISOString().substring(0, 7),
    },
  });

  if (!usages.length) {
    console.log(
      `Channel ${moderatedChannel.id}, User ${moderatedChannel.userId} has no usage`,
      moderatedChannel.user.plan
    );
    return false;
  }

  const totalCasts = usages.reduce((acc, u) => acc + u.castsProcessed, 0);

  const maxCastsWithBuffer = plan.maxCasts * (1 + buffer);
  if (totalCasts >= maxCastsWithBuffer) {
    return true;
  }

  return false;
}

export async function isCohostOrOwner({ fid, channel }: { fid: string; channel: string }) {
  const [isUserCohost, ownerFid] = await Promise.all([
    isCohost({
      fid: +fid,
      channel,
    }),
    getWarpcastChannelOwner({ channel }),
  ]);

  const isOwner = ownerFid === +fid;

  return isUserCohost || isOwner;
}
