/* eslint-disable @typescript-eslint/no-explicit-any */
import { Job, JobsOptions, Queue, UnrecoverableError, Worker } from "bullmq";
import * as Sentry from "@sentry/remix";
import IORedis from "ioredis";
import { ValidateCastArgs, isUserOverUsage, validateCast } from "~/routes/api.webhooks.neynar";
import { SimulateArgs, SweepArgs, simulate, sweep } from "~/routes/~.channels.$id.tools";
import { db } from "./db.server";
import { getChannel, neynar, pageChannelCasts } from "./neynar.server";
import { CastWithInteractions } from "@neynar/nodejs-sdk/build/neynar-api/v2";
import { WebhookCast } from "./types";
import { toggleWebhook } from "~/routes/api.channels.$id.toggleEnable";
import { getWarpcastChannel } from "./warpcast.server";
import { automodFid } from "~/routes/~.channels.$id";

const connection = new IORedis({
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
});

export const webhookQueue = new Queue("webhookQueue", {
  connection,
});

export type ValidateCastArgsV2 = {
  webhookNotif: {
    type: string;
    data: WebhookCast;
  };
  channelName: string;
};

export const webhookWorker = new Worker(
  "webhookQueue",
  async (job: Job<ValidateCastArgsV2>) => {
    const { webhookNotif, channelName } = job.data;

    console.log(`[${webhookNotif.data.root_parent_url}]: cast ${webhookNotif.data.hash}`);

    const [moderatedChannel, alreadyProcessed, signerAllocation] = await Promise.all([
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
      db.castLog.findFirst({
        where: {
          hash: webhookNotif.data.hash,
        },
      }),
      db.signerAllocation.findFirst({
        where: {
          channelId: channelName,
        },
        include: {
          signer: true,
        },
      }),
    ]);

    if (!moderatedChannel) {
      console.error(
        `Channel ${channelName} is not moderated`,
        channelName,
        webhookNotif.data.root_parent_url
      );
      throw new UnrecoverableError("Channel is not moderated");
    }

    const warpcastChannel = await getWarpcastChannel({ channel: moderatedChannel.id }).catch((e) => {
      console.error(e);
      return null;
    });

    if (!warpcastChannel) {
      console.error(`Channel is not known by warpcast`, moderatedChannel.id);
      throw new Error(`Channel ${moderatedChannel.id} is not known by warpcast`);
    }

    if (!signerAllocation && warpcastChannel.moderatorFid !== automodFid) {
      console.error(`Moderator fid for ${moderatedChannel.id} is not set to automod.`);
      await toggleWebhook({ channelId: moderatedChannel.id, active: false });
      throw new UnrecoverableError(`Moderator fid for ${moderatedChannel.id} is not set to automod`);
    }

    if (signerAllocation) {
      if (signerAllocation.signer.fid !== String(warpcastChannel.moderatorFid)) {
        console.error(
          `Signer allocation mismatch for ${moderatedChannel.id}. Expected ${signerAllocation.signer.fid}, got ${warpcastChannel.moderatorFid}. Falling back to default.`
        );
      }
    } else if (warpcastChannel.moderatorFid !== automodFid) {
      console.error(
        `Moderator fid for ${moderatedChannel.id} is not set to automod default fid (${automodFid}).`
      );
    }

    if (moderatedChannel.user.plan === "expired") {
      console.error(
        `User's plan ${moderatedChannel.user.id} is expired, ${moderatedChannel.id} moderation disabled`
      );
      await toggleWebhook({ channelId: moderatedChannel.id, active: false });
      throw new UnrecoverableError(
        `User's plan ${moderatedChannel.user.id} is expired, ${moderatedChannel.id} moderation disabled`
      );
    }

    if (moderatedChannel.ruleSets.length === 0) {
      console.log(`Channel ${moderatedChannel.id} has no rules. Doing nothing.`);
      return;
    }

    if (alreadyProcessed) {
      console.log(`Cast ${webhookNotif.data.hash.substring(0, 10)} already processed`);
      return;
    }

    const [usage, channel, isOverUsage] = await Promise.all([
      db.usage.upsert({
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
      }),
      getChannel({ name: moderatedChannel.id }).catch(() => null),
      isUserOverUsage(moderatedChannel, 0.1),
    ]);

    if (isOverUsage) {
      console.error(`User ${moderatedChannel.userId} is over usage limit. Moderation disabled.`);
      await toggleWebhook({ channelId: moderatedChannel.id, active: false });
      throw new UnrecoverableError(`User ${moderatedChannel.userId} is over usage limit`);
    }

    if (!channel) {
      console.error(
        `There's a moderated channel configured for ${moderatedChannel.id}, warpcast knows about it, but neynar doesn't. Something is wrong.`
      );
      throw new UnrecoverableError(`Channel not found: ${moderatedChannel.id}`);
    }

    await Promise.all([
      db.castLog.upsert({
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
      castQueue.add(
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
  },
  {
    connection,
    lockDuration: 30_000,
    concurrency: 100,
    autorun: process.env.NODE_ENV === "production",
  }
);

webhookWorker.on("error", (err: Error) => {
  Sentry.captureException(err);
});

export const castQueue = new Queue("castQueue", {
  connection,
  // temporarily lifo
  defaultJobOptions: {
    lifo: true,
  },
});

export const castWorker = new Worker(
  "castQueue",
  async (job: Job<ValidateCastArgs>) => {
    await validateCast(job.data);
  },
  {
    connection,
    lockDuration: 30_000,
    concurrency: 100,
    autorun: process.env.NODE_ENV === "production",
  }
);
castWorker.on("error", (err: Error) => {
  Sentry.captureException(err);
});

castWorker.on("active", async (job) => {
  if (process.env.NODE_ENV === "development") {
    console.log(`[${job.data.channel.id}]: ${job.id} is now active`);
  }

  await db.castLog.upsert({
    where: {
      hash: job.data.cast.hash,
    },
    create: {
      hash: job.data.cast.hash,
      replyCount: job.data.cast.replies.count,
      channelId: job.data.channel.id,
      status: "active",
    },
    update: {
      status: "active",
    },
  });
});

castWorker.on("completed", async (job) => {
  if (process.env.NODE_ENV === "development") {
    console.log(`${job.data.channel.id}: cast ${job.data.cast.hash} completed`);
  }

  await db.castLog.upsert({
    where: {
      hash: job.data.cast.hash,
    },
    create: {
      hash: job.data.cast.hash,
      replyCount: job.data.cast.replies.count,
      channelId: job.data.channel.id,
      status: "completed",
    },
    update: {
      status: "completed",
    },
  });
});

castWorker.on("failed", async (job, err: any) => {
  const message = err?.response?.data || err?.message || "unknown error";

  if (job) {
    console.error(`[${job.data.channel.id}]: cast ${job.data.cast.hash} failed`, message);

    await db.castLog.upsert({
      where: {
        hash: job.data.cast.hash,
      },
      create: {
        hash: job.data.cast.hash,
        replyCount: job.data.cast.replies.count,
        channelId: job.data.channel.id,
        status: "failed",
      },
      update: {
        status: "failed",
      },
    });
  } else {
    console.error("job failed", message);
  }
});

// sweeeeep
export const sweepQueue = new Queue("sweepQueue", {
  connection,
});

export const sweepWorker = new Worker(
  "sweepQueue",
  async (job: Job<SweepArgs>) => {
    try {
      await sweep({
        channelId: job.data.channelId,
        limit: job.data.limit,
        moderatedChannel: job.data.moderatedChannel,
      });
    } catch (e) {
      Sentry.captureException(e);
      throw e;
    }
  },
  { connection, concurrency: 25, autorun: process.env.NODE_ENV === "production" }
);

sweepWorker.on("error", Sentry.captureException);
sweepWorker.on("active", (job) => {
  if (process.env.NODE_ENV === "development") {
    console.log(`[${job.data.channelId}] sweeping...`);
  }
});
sweepWorker.on("failed", (job, err) => {
  console.error(`[${job?.data.channelId}] failed`, err);
});

sweepWorker.on("completed", (job) => {
  console.log(`[${job.data.channelId}] sweep completed`);
});

// sweeeeep
export const simulationQueue = new Queue("simulationQueue", {
  connection,
});

export const simulationWorker = new Worker(
  "simulationQueue",
  async (job: Job<SimulateArgs>) => {
    let result;
    try {
      result = await simulate({
        channelId: job.data.channelId,
        limit: job.data.limit,
        moderatedChannel: job.data.moderatedChannel,
        proposedModeratedChannel: job.data.proposedModeratedChannel,
        onProgress: async (castsProcessed: number) => {
          await job.updateProgress(castsProcessed);
        },
      });
    } catch (e) {
      Sentry.captureException(e);
      throw e;
    }

    return result;
  },
  { connection, autorun: process.env.NODE_ENV === "production" }
);

simulationWorker.on("error", Sentry.captureException);
simulationWorker.on("active", (job) => {
  if (process.env.NODE_ENV === "development") {
    console.log(`[${job.data.channelId}] simulating...`);
  }
});

simulationWorker.on("failed", (job, err) => {
  console.error(`[${job?.data.channelId}] failed`, err);
});

simulationWorker.on("completed", (job) => {
  console.log(`[${job.data.channelId}] simulation completed`);
});

// sync queue
export const syncQueue = new Queue("syncQueue", {
  connection,
});

export const syncWorker = new Worker(
  "syncQueue",
  async (job: Job<{ channelId: string; rootCastsToProcess: number }>) => {
    const [channel, moderatedChannel] = await Promise.all([
      getChannel({ name: job.data.channelId }),
      db.moderatedChannel.findFirst({
        where: {
          id: job.data.channelId,
        },
        include: {
          ruleSets: true,
        },
      }),
    ]);

    let rootCastsChecked = 0;
    for await (const page of pageChannelCasts({ id: job.data.channelId })) {
      if (process.env.NODE_ENV === "development") {
        console.log(`[${job.data.channelId}] sync: page length ${page.casts.length}`);
      }
      const castHashes = page.casts.map((cast) => cast.hash);
      const alreadyProcessed = await db.castLog.findMany({
        where: {
          hash: {
            in: castHashes,
          },
        },
      });

      for (const rootCast of page.casts) {
        if (process.env.NODE_ENV === "development") {
          console.log(`[${job.data.channelId}] sync: processing cast ${rootCast.hash}`);
        }

        if (rootCastsChecked >= job.data.rootCastsToProcess) {
          return;
        }

        if (
          alreadyProcessed.some(
            (log) => log.hash === rootCast.hash && log.replyCount === rootCast.replies.count
          )
        ) {
          if (process.env.NODE_ENV === "development") {
            console.log(`[${job.data.channelId}] sync: cast ${rootCast.hash} already processed`);
          }
          continue;
        }

        const isProcessingReplies = moderatedChannel?.ruleSets.find((ruleSet) =>
          ["all", "reply"].includes(ruleSet.target)
        );

        if (isProcessingReplies) {
          const { conversation } = await neynar.lookupCastConversation(rootCast.hash, "hash", {
            // for now.
            replyDepth: 1,
          });

          const replyCasts: CastWithInteractions[] = [];
          const processQueue = [conversation.cast];
          while (processQueue.length > 0) {
            const nextCast = processQueue.shift() as CastWithInteractions & {
              direct_replies: Array<CastWithInteractions>;
            };

            replyCasts.push(nextCast);
            processQueue.push(...nextCast.direct_replies);
          }

          const alreadyProcessedReplies = await db.castLog.findMany({
            select: {
              hash: true,
            },
            where: {
              hash: {
                in: replyCasts.map((cast) => cast.hash),
              },
            },
          });

          replyCasts
            .filter((replyCast) => !alreadyProcessedReplies.some((cast) => cast.hash === replyCast.hash))
            .forEach(async (cast) => {
              castQueue.add(
                "processCast",
                {
                  channel,
                  moderatedChannel,
                  cast: cast,
                },
                defaultProcessCastJobArgs(cast.hash)
              );
            });
        } else {
          castQueue.add(
            "processCast",
            {
              channel,
              moderatedChannel,
              cast: rootCast,
            },
            defaultProcessCastJobArgs(rootCast.hash)
          );
        }

        rootCastsChecked++;
      }
    }
  },
  { connection, autorun: process.env.NODE_ENV === "production" }
);

syncWorker.on("error", (err) => {
  Sentry.captureException(err);
});

syncWorker.on("active", (job) => {
  console.log(`[${job.data.channelId}] sync: active`);
});

syncWorker.on("completed", (job) => {
  console.log(`[${job.data.channelId}] sync: completed`);
});

export function defaultProcessCastJobArgs(hash: string): JobsOptions {
  return {
    jobId: `cast-${hash}`,
    removeOnComplete: 20000,
    removeOnFail: 5000,
    backoff: {
      type: "exponential",
      delay: 10_000,
    },
    attempts: 4,
  };
}
