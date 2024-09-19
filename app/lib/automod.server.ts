import { Cast } from "@neynar/nodejs-sdk/build/neynar-api/v2";
import * as Sentry from "@sentry/remix";
import { ModeratedChannel, ModerationLog } from "@prisma/client";
import { v4 as uuid } from "uuid";
import { db } from "~/lib/db.server";
import { neynar } from "~/lib/neynar.server";
import { getModerators } from "~/lib/utils.server";

import { Action, Rule, actionFunctions, isCohost, ruleFunctions } from "~/lib/validations.server";
import { FullModeratedChannel, WebhookCast } from "~/lib/types";
import { getWarpcastChannelOwner } from "~/lib/warpcast.server";
import { PlanType, userPlans } from "~/lib/utils";

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function cooldown({ channel, cast, action }: { channel: string; cast: Cast; action: Action }) {
  const { duration } = (action as any).args;

  return db.cooldown.upsert({
    where: {
      affectedUserId_channelId: {
        affectedUserId: String(cast.author.fid),
        channelId: channel,
      },
    },
    update: {
      active: true,
      expiresAt: new Date(Date.now() + duration * 60 * 60 * 1000),
    },
    create: {
      affectedUserId: String(cast.author.fid),
      channelId: channel,
      expiresAt: new Date(Date.now() + duration * 60 * 60 * 1000),
    },
  });
}

export async function mute({ channel, cast }: { channel: string; cast: Cast; action: Action }) {
  return db.cooldown.upsert({
    where: {
      affectedUserId_channelId: {
        affectedUserId: String(cast.author.fid),
        channelId: channel,
      },
    },
    update: {
      active: true,
      expiresAt: null,
    },
    create: {
      affectedUserId: String(cast.author.fid),
      channelId: channel,
      expiresAt: null,
    },
  });
}

export async function hideQuietly({
  channel,
  cast,
  options,
}: {
  channel: string;
  cast: Cast;
  action: Action;
  options?: {
    executeOnProtocol?: boolean;
  };
}) {
  if (options?.executeOnProtocol) {
    await unlike({ channel, cast });
  } else {
    return Promise.resolve();
  }
}

export async function addToBypass({ channel, cast }: { channel: string; cast: Cast; action: Action }) {
  const moderatedChannel = await db.moderatedChannel.findFirstOrThrow({
    where: {
      id: channel,
    },
  });

  const existing = moderatedChannel.excludeUsernamesParsed || [];

  if (existing.some((u) => u.value === cast.author.fid)) {
    return;
  }

  existing.push({
    value: cast.author.fid,
    label: cast.author.username,
    icon: cast.author.pfp_url,
  });

  return db.moderatedChannel.update({
    where: {
      id: channel,
    },
    data: {
      excludeUsernames: JSON.stringify(existing),
    },
  });
}

export async function downvote({ channel, cast, action }: { channel: string; cast: Cast; action: Action }) {
  if (action.type !== "downvote") {
    return;
  }

  const { voterFid, voterAvatarUrl, voterUsername } = action.args;
  await db.moderatedChannel.findFirstOrThrow({
    where: {
      id: channel,
    },
  });

  await db.downvote.upsert({
    where: {
      fid_castHash: {
        fid: String(voterFid),
        castHash: cast.hash,
      },
    },
    update: {},
    create: {
      castHash: cast.hash,
      channelId: channel,
      fid: voterFid,
      username: voterUsername,
      avatarUrl: voterAvatarUrl,
    },
  });
}

/**
 * This does not check permissions
 */
export async function grantRole({ channel, cast, action }: { channel: string; cast: Cast; action: Action }) {
  const { roleId } = (action as any).args;
  await db.role.findFirstOrThrow({
    where: {
      channelId: channel,
      id: roleId,
    },
  });

  const user = await neynar.lookupUserByUsername(cast.author.username);

  return db.delegate.upsert({
    where: {
      fid_roleId_channelId: {
        fid: String(cast.author.fid),
        roleId,
        channelId: channel,
      },
    },
    update: {},
    create: {
      fid: String(cast.author.fid),
      roleId,
      channelId: channel,
      avatarUrl: user.result.user.pfp.url,
      username: cast.author.username,
    },
  });
}

export async function unlike(props: { cast: Cast; channel: string }) {
  const signerAlloc = await db.signerAllocation.findFirst({
    where: {
      channelId: props.channel,
    },
    include: {
      signer: true,
    },
  });

  const uuid = signerAlloc?.signer.signerUuid || process.env.NEYNAR_SIGNER_UUID!;

  console.log(
    `Unliking with @${signerAlloc ? signerAlloc.signer.username : "automod"}, cast: ${props.cast.hash}`
  );

  await neynar.deleteReactionFromCast(uuid, "like", props.cast.hash);
}

export async function ban({ channel, cast }: { channel: string; cast: Cast; action: Action }) {
  // indefinite cooldown
  return db.cooldown.upsert({
    where: {
      affectedUserId_channelId: {
        affectedUserId: String(cast.author.fid),
        channelId: channel,
      },
    },
    update: {
      active: true,
      expiresAt: null,
    },
    create: {
      affectedUserId: String(cast.author.fid),
      channelId: channel,
      expiresAt: null,
    },
  });
}

export type ValidateCastArgs = {
  moderatedChannel: FullModeratedChannel;
  cast: WebhookCast;
  executeOnProtocol?: boolean;
  simulation?: boolean;
};

export async function validateCast({
  moderatedChannel,
  cast,
  executeOnProtocol = false,
  simulation = false,
}: ValidateCastArgs): Promise<Array<ModerationLog>> {
  const logs: Array<ModerationLog> = [];

  if (!moderatedChannel) {
    Sentry.captureMessage(`Moderated channel not found`, {
      extra: {
        cast,
      },
    });
    throw new Error("Moderated channel not found");
  }

  moderatedChannel = await db.moderatedChannel.findFirstOrThrow({
    where: {
      id: moderatedChannel.id,
    },
    include: {
      user: true,
    },
  });

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
  const channelOwner = await getWarpcastChannelOwner({ channel: moderatedChannel.id });
  const isOwner = channelOwner === cast.author.fid;

  if (isExcluded || isOwner) {
    const message = isOwner
      ? `@${cast.author.username} is the channel owner`
      : `@${cast.author.username} is in the bypass list.`;

    console.log(message);

    const [, log] = await Promise.all([
      simulation
        ? Promise.resolve()
        : actionFunctions["like"]({
            channel: moderatedChannel.id,
            cast,
            action: { type: "like" },
          }),
      logModerationAction(moderatedChannel.id, "like", message, cast, simulation),
    ]);

    logs.push(log);
    return logs;
  }

  if (moderatedChannel.excludeCohosts) {
    const mods = await getModerators({ channel: moderatedChannel.id });
    if (mods.find((c) => c.fid === String(cast.author.fid))) {
      console.log(`[${moderatedChannel.id}] @${cast.author.username} is a moderator. Curating.`);

      const [, log] = await Promise.all([
        simulation
          ? Promise.resolve()
          : actionFunctions["like"]({
              channel: moderatedChannel.id,
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
      console.log(`[${moderatedChannel.id}] User @${cast.author.username} is banned. Skipping.`);
      // they're banned, logging is noise so skip
    }

    return logs;
  }

  if (!moderatedChannel.inclusionRuleSetParsed?.ruleParsed?.conditions?.length) {
    console.log(`[${moderatedChannel.id}] No rules for channel.`);
    await logModerationAction(
      moderatedChannel.id,
      "hideQuietly",
      "No automated curation rules configured.",
      cast,
      simulation
    );
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
            channel: moderatedChannel.id,
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
          channel: moderatedChannel.id,
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
    if (!simulation) {
      await actionFunctions["hideQuietly"]({
        channel: moderatedChannel.id,
        cast,
        action: { type: "hideQuietly" },
        options: {
          executeOnProtocol,
        },
      });
    }
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
