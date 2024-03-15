import { Job, Queue, Worker } from "bullmq";
import * as Sentry from "@sentry/remix";
import IORedis from "ioredis";
import { ValidateCastArgs, validateCast } from "~/routes/api.webhooks.neynar";

const connection = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
  family: 6,
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
    console.log(job.data);
  },
  {
    connection,
    lockDuration: 30_000,
  }
);

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
