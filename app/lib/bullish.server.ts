import { Job, Queue, Worker } from "bullmq";
import * as Sentry from "@sentry/remix";
import IORedis from "ioredis";
import { ValidateCastArgs, validateCast } from "~/routes/api.webhooks.neynar";
import { SweepArgs, sweep } from "~/routes/~.channels.$id.tools";

const connection = new IORedis(process.env.REDIS_URL!, {
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
      Sentry.captureException(e);
      throw e;
    }
  },
  {
    connection,
    lockDuration: 30_000,
  }
);
castWorker.on("error", Sentry.captureException);

castWorker.on("active", (job) => {
  console.log(`Job ${job.id} is now active and being processed`);
});

castWorker.on("completed", (job) => {
  console.log(`${job.data.channel.id}: cast ${job.data.cast.hash} completed`);
});

castWorker.on("failed", (job, err) => {
  if (job) {
    console.error(
      `${job.data.channel.id}: cast ${job.data.cast.hash} failed`,
      err
    );
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
