/* eslint-disable @typescript-eslint/no-explicit-any */
import { Job, Queue, Worker } from "bullmq";
import * as Sentry from "@sentry/remix";
import IORedis from "ioredis";
import { ValidateCastArgs, validateCast } from "~/routes/api.webhooks.neynar";
import { SimulateArgs, SweepArgs, simulate, sweep } from "~/routes/~.channels.$id.tools";

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

castWorker.on("active", (job) => {
  if (process.env.NODE_ENV === "development") {
    console.log(`[${job.data.channel.id}]: ${job.id} is now active`);
  }
});

castWorker.on("completed", (job) => {
  if (process.env.NODE_ENV === "development") {
    console.log(`${job.data.channel.id}: cast ${job.data.cast.hash} completed`);
  }
});

castWorker.on("failed", (job, err) => {
  if (job) {
    console.error(`${job.data.channel.id}: cast ${job.data.cast.hash} failed`, err);
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

// // sync queue
// export const syncQueue = new Queue("syncQueue", {
//   connection,
// });

// export const syncWorker = new Worker(
//   "syncQueue",
//   async (job: Job<{ channelId: string }>) => {
//     console.log(`[${job.data.channelId}] syncing...`);
//     // get the channel and last timestamp
//     // while current timestamp is > last timestamp
//     // page neynar
//     // if not processed, enqueue it for processing
//     //
//   },
//   { connection }
// );

// syncWorker.on("error", Sentry.captureException);
// syncWorker.on("active", (job) => {
//   if (process.env.NODE_ENV === "development") {
//     console.log(`[${job.data.channelId}] syncing...`);
//   }
// });
