/* eslint-disable @typescript-eslint/no-explicit-any */
import { Job, JobsOptions, Queue, Worker } from "bullmq";
import * as Sentry from "@sentry/remix";
import IORedis from "ioredis";
import { ValidateCastArgs, validateCast } from "~/routes/api.webhooks.neynar";
import { SimulateArgs, SweepArgs, simulate, sweep } from "~/routes/~.channels.$id.tools";
import { db } from "./db.server";
import { getChannel, neynar, pageChannelCasts } from "./neynar.server";
import { CastWithInteractions } from "@neynar/nodejs-sdk/build/neynar-api/v2";

const connection = new IORedis({
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
});

export const castQueue = new Queue("castQueue", {
  connection,
});

export const castWorker = new Worker(
  "castQueue",
  async (job: Job<ValidateCastArgs>) => {
    try {
      await validateCast(job.data);
    } catch (e) {
      const err = e as any;
      Sentry.captureException(e, {
        extra: {
          data: err.response?.data ? err.response.data : err.message,
          status: err.response?.status,
        },
      });
      throw e;
    }
  },
  {
    connection,
    lockDuration: 30_000,
  }
);
castWorker.on("error", (err: Error) => {
  Sentry.captureException(err);
  console.error("job error", err);
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

castWorker.on("failed", async (job, err) => {
  if (job) {
    console.error(`${job.data.channel.id}: cast ${job.data.cast.hash} failed`, err);

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
    console.error("job failed", err);
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
  { connection }
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
  { connection }
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
  { connection }
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
