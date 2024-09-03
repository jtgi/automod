/* eslint-disable @typescript-eslint/no-explicit-any */
import { Job, JobsOptions, Queue, UnrecoverableError, Worker } from "bullmq";
import * as Sentry from "@sentry/remix";
import IORedis from "ioredis";
import { ValidateCastArgs, getUsage as getTotalUsage, validateCast } from "~/routes/api.webhooks.neynar";
import { SimulateArgs, SweepArgs, recover, simulate, sweep } from "~/routes/~.channels.$id.tools";
import { db } from "./db.server";
import { neynar, pageChannelCasts } from "./neynar.server";
import { WebhookCast } from "./types";
import { toggleWebhook } from "~/routes/api.channels.$id.toggleEnable";
import { getCast, getWarpcastChannel, publishCast } from "./warpcast.server";
import { automodFid } from "~/routes/~.channels.$id";
import { syncSubscriptions, userPlans } from "./subscription.server";
import { sendNotification } from "./notifications.server";
import axios from "axios";

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
  skipSignerCheck?: boolean;
};

export const delayedSubscriptionQueue = new Queue("subscriptionQueue", {
  connection,
});

if (process.env.NODE_ENV === "production") {
  delayedSubscriptionQueue.add("subscriptionSync", {}, { repeat: { pattern: "0 0 * * *" } });
}

export const propagationDelayQueue = new Queue("propagationDelayQueue", {
  connection,
});

if (process.env.NODE_ENV === "production") {
  propagationDelayQueue.add("propagationDelayCheck", {}, { repeat: { pattern: "*/10 * * * *" } });
}

export const propagationDelayWorker = new Worker(
  "propagationDelayQueue",
  async () => {
    console.log("Checking propagation delay");

    const uuid = process.env.AUTOMOD_FACTORY_UUID!;
    const username = "automod-factory";
    const delayThreshold = 15 * 60 * 1000;

    const checks = await db.propagationDelayCheck.findMany({
      where: {
        arrivedAt: null,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1_000),
        },
      },
    });

    if (!checks.length) {
      const neynarToWarpcast = await neynar.publishCast(
        uuid,
        `neynar -> warpcast\n${new Date().toISOString()}`
      );
      const warpcastToNeynar = await publishCast({
        text: `warpcast -> neynar\n${new Date().toISOString()}`,
        token: process.env.AUTOMOD_FACTORY_WARPCAST_TOKEN!,
      });

      await db.propagationDelayCheck.create({
        data: {
          hash: neynarToWarpcast.hash,
          arrivedAt: null,
          src: "neynar",
          dst: "warpcast",
        },
      });

      await db.propagationDelayCheck.create({
        data: {
          hash: warpcastToNeynar.result.cast.hash,
          arrivedAt: null,
          src: "warpcast",
          dst: "neynar",
        },
      });

      return;
    }

    for (const check of checks) {
      const delay = new Date().getTime() - new Date(check.createdAt).getTime();
      const delaySeconds = Math.floor(delay / 1_000);

      if (delay > delayThreshold) {
        await axios.post("https://webhook-relay.fly.dev/automod", {
          text: `Warning: Cast propagation delay from ${check.src} to ${
            check.dst
          } exceeded ${delaySeconds.toLocaleString()} seconds.\nhttps://explorer.neynar.com/${check.hash}`,
        });
      }

      if (check.dst === "neynar") {
        const rsp = await neynar.fetchBulkCasts([check.hash]);
        if (rsp.result.casts.length !== 0) {
          const cast = rsp.result.casts[0];
          await db.propagationDelayCheck.update({
            where: {
              id: check.id,
            },
            data: {
              arrivedAt: cast.timestamp,
            },
          });
        }
      } else if (check.dst === "warpcast") {
        const cast = await getCast({ hash: check.hash, username });
        if (cast) {
          const delaySeconds = Math.floor(
            (new Date(cast.timestamp).getTime() - check.createdAt.getTime()) / 1_000
          );
          console.log(
            `[propagation-delay] ${check.hash} arrived after ${delaySeconds.toLocaleString()} seconds`
          );
          await db.propagationDelayCheck.update({
            where: {
              id: check.id,
            },
            data: {
              arrivedAt: new Date(cast.timestamp),
            },
          });
        }
      }
    }
  },
  {
    connection,
  }
);

export const subscriptionWorker = new Worker(
  "subscriptionQueue",
  async () => {
    console.log("Checking subscription status for all active users");
    await syncSubscriptions();
  },
  {
    connection,
  }
);

subscriptionWorker.on("error", (err: Error) => {
  Sentry.captureException(err);
  console.error(`Subscription worker error`, err);
});

subscriptionWorker.on("failed", (job, err) => {
  console.error("Subscription worker failed", err);
});

export const webhookWorker = new Worker(
  "webhookQueue",
  async (job: Job<ValidateCastArgsV2>) => {
    const { webhookNotif, channelName, skipSignerCheck } = job.data;

    console.log(`[${webhookNotif.data.root_parent_url}]: cast ${webhookNotif.data.hash}`);

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
      db.castLog.findFirst({
        where: {
          hash: webhookNotif.data.hash,
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

    const [signerAllocation, warpcastChannel] = await Promise.all([
      db.signerAllocation.findFirst({
        where: {
          channelId: moderatedChannel.id,
        },
        include: {
          signer: true,
        },
      }),
      getWarpcastChannel({ channel: moderatedChannel.id }).catch((e) => {
        console.error(e);
        return null;
      }),
    ]);

    if (!warpcastChannel) {
      console.error(`Channel is not known by warpcast`, moderatedChannel.id);
      throw new Error(`Channel ${moderatedChannel.id} is not known by warpcast`);
    }

    if (!skipSignerCheck) {
      if (!signerAllocation && warpcastChannel.moderatorFid !== automodFid) {
        console.error(`Moderator fid for ${moderatedChannel.id} is not set to automod.`);
        // await toggleWebhook({ channelId: moderatedChannel.id, active: false });
        throw new UnrecoverableError(`Moderator fid for ${moderatedChannel.id} is not set to automod`);
      }

      if (signerAllocation) {
        if (signerAllocation.signer.fid !== String(warpcastChannel.moderatorFid)) {
          console.error(
            `Signer allocation mismatch for ${moderatedChannel.id}. Expected ${signerAllocation.signer.fid}, got ${warpcastChannel.moderatorFid}. Exiting.`
          );

          throw new UnrecoverableError(
            `Signer allocation mismatch for ${moderatedChannel.id}, Expected: ${signerAllocation.signer.fid}, got: ${warpcastChannel.moderatorFid}. Exiting.`
          );
        }
      } else if (warpcastChannel.moderatorFid !== automodFid) {
        console.error(
          `Moderator fid for ${moderatedChannel.id} is not set to automod default fid (${automodFid}).`
        );
      }
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

    if (alreadyProcessed) {
      console.log(`Cast ${webhookNotif.data.hash.substring(0, 10)} already processed`);
      return;
    }

    const [usage, totalUsage] = await Promise.all([
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
      getTotalUsage(moderatedChannel),
    ]);

    const plan = userPlans[moderatedChannel.user.plan as keyof typeof userPlans];
    if (totalUsage >= plan.maxCasts - plan.maxCasts * 0.15 && totalUsage < plan.maxCasts) {
      sendNotification({
        moderatedChannel,
        fid: moderatedChannel.user.id,
        type: "usage",
        nonce: `cast-usage-warning-${moderatedChannel.user.id}-${moderatedChannel.user.plan}-${new Date()
          .toISOString()
          .substring(0, 7)}`,
        message: `Heads up, you've used 85% of your automated moderation limit for the month. Upgrade your plan to avoid any disruption.\n\nFor a full breakdown of your usage and limits, open up https://automod.sh/~/account`,
      });
    } else if (totalUsage >= plan.maxCasts && totalUsage < plan.maxCasts * 1.05) {
      sendNotification({
        moderatedChannel,
        fid: moderatedChannel.user.id,
        type: "usage",
        nonce: `cast-usage-full-${moderatedChannel.user.id}-${moderatedChannel.user.plan}-${new Date()
          .toISOString()
          .substring(0, 7)}`,
        message: `You're over your usage limit for the month. Automatic moderation will be disabled shortly. Upgrade your plan to get back online.\n\nhttps://automod.sh/~/account`,
      });
    } else if (totalUsage >= plan.maxCasts * 1.05) {
      console.error(`User ${moderatedChannel.userId} is over usage limit. Moderation disabled.`);
      await toggleWebhook({ channelId: moderatedChannel.id, active: false });
      throw new UnrecoverableError(`User ${moderatedChannel.userId} is over usage limit`);
    }

    await Promise.all([
      db.castLog.upsert({
        where: {
          hash: webhookNotif.data.hash,
        },
        create: {
          hash: webhookNotif.data.hash,
          replyCount: webhookNotif.data.replies.count,
          channelId: moderatedChannel.id,
          status: "waiting",
        },
        update: {
          status: "waiting",
        },
      }),
      castQueue.add(
        "processCast",
        {
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
    concurrency: 25,
    autorun: process.env.NODE_ENV === "production" || !!process.env.ENABLE_QUEUES,
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
    concurrency: 10,
    autorun: process.env.NODE_ENV === "production" || !!process.env.ENABLE_QUEUES,
  }
);
castWorker.on("error", (err: Error) => {
  Sentry.captureException(err);
});

castWorker.on("active", async (job) => {
  if (process.env.NODE_ENV === "development") {
    console.log(`[${job.data.moderatedChannel.id}]: ${job.id} is now active`);
  }

  await db.castLog.upsert({
    where: {
      hash: job.data.cast.hash,
    },
    create: {
      hash: job.data.cast.hash,
      replyCount: job.data.cast.replies.count,
      channelId: job.data.moderatedChannel.id,
      status: "active",
    },
    update: {
      status: "active",
    },
  });
});

castWorker.on("completed", async (job) => {
  if (process.env.NODE_ENV === "development") {
    console.log(`${job.data.moderatedChannel.id}: cast ${job.data.cast.hash} completed`);
  }

  await db.castLog.upsert({
    where: {
      hash: job.data.cast.hash,
    },
    create: {
      hash: job.data.cast.hash,
      replyCount: job.data.cast.replies.count,
      channelId: job.data.moderatedChannel.id,
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
    console.error(`[${job.data.moderatedChannel?.id}]: cast ${job.data.cast?.hash} failed`, message);

    await db.castLog.upsert({
      where: {
        hash: job.data.cast.hash,
      },
      create: {
        hash: job.data.cast.hash,
        replyCount: job.data.cast.replies.count,
        channelId: job.data.moderatedChannel.id,
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

export const recoverQueue = new Queue("recoverQueue", {
  connection,
  defaultJobOptions: {
    removeOnComplete: 300,
    removeOnFail: 300,
    attempts: 3,
  },
});

export const recoverWorker = new Worker(
  "recoverQueue",
  async (job: Job<SweepArgs>) => {
    try {
      await recover({
        channelId: job.data.channelId,
        limit: job.data.limit,
        untilTimeUtc: job.data.untilTimeUtc,
        untilCastHash: job.data.untilCastHash,
        moderatedChannel: job.data.moderatedChannel,
        skipSignerCheck: job.data.skipSignerCheck,
      });
    } catch (e) {
      Sentry.captureException(e);
      throw e;
    }
  },
  {
    connection,
    concurrency: 25,
    autorun: process.env.NODE_ENV === "production" || !!process.env.ENABLE_QUEUES,
  }
);

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
        untilTimeUtc: job.data.untilTimeUtc,
        untilCastHash: job.data.untilCastHash,
        moderatedChannel: job.data.moderatedChannel,
      });
    } catch (e) {
      Sentry.captureException(e);
      throw e;
    }
  },
  {
    connection,
    concurrency: 25,
    autorun: process.env.NODE_ENV === "production" || !!process.env.ENABLE_QUEUES,
  }
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
  {
    connection,
    autorun: process.env.NODE_ENV === "production" || !!process.env.ENABLE_QUEUES,
  }
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
    const moderatedChannel = await db.moderatedChannel.findFirst({
      where: {
        id: job.data.channelId,
        active: true,
      },
      include: {
        ruleSets: true,
      },
    });

    if (!moderatedChannel) {
      console.error(`[${job.data.channelId}] sync: moderated channel not found`);
      return;
    }

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

        if (alreadyProcessed.some((log) => log.hash === rootCast.hash)) {
          if (process.env.NODE_ENV === "development") {
            console.log(`[${job.data.channelId}] sync: cast ${rootCast.hash} already processed`);
          }
          continue;
        }

        castQueue.add(
          "processCast",
          {
            moderatedChannel,
            cast: rootCast,
          },
          defaultProcessCastJobArgs(rootCast.hash)
        );

        rootCastsChecked++;
      }
    }
  },
  { connection, autorun: process.env.NODE_ENV === "production" || !!process.env.ENABLE_QUEUES }
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
      delay: 2_000,
    },
    attempts: 4,
  };
}
