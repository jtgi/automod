import { LoaderFunctionArgs, json } from "@remix-run/node";
import axios from "axios";
import { db } from "~/lib/db.server";
import { neynar } from "~/lib/neynar.server";
import { getCast } from "~/lib/warpcast.server";

export async function loader({ request }: LoaderFunctionArgs) {
  checkEvents().catch(console.error);

  // run only every 10min
  const now = new Date();
  if (now.getMinutes() % 10 !== 0) {
    checkPropagationDelay().catch(console.error);
  }

  return json({ status: "ok" });
}

export async function checkPropagationDelay() {
  const uuid = "210bbf80-11ce-46a0-9b32-6bd46de7f1e8";
  const username = "automod-shimo";

  const checks = await db.propagationDelayCheck.findMany({
    where: {
      arrivedAt: null,
      createdAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1_000),
      },
    },
  });

  if (!checks.length) {
    const cast = await neynar.publishCast(uuid, `neynar -> warpcast\n${new Date().toISOString()}`);

    await db.propagationDelayCheck.create({
      data: {
        hash: cast.hash,
        arrivedAt: null,
        src: "neynar",
        dst: "warpcast",
      },
    });

    return;
  }

  for (const check of checks) {
    const delay = new Date().getTime() - new Date(check.createdAt).getTime();

    if (delay > 30 * 60 * 1000) {
      await axios.post("https://webhook-relay.fly.dev/automod", {
        text: `Warning: Propagation delay for ${
          check.hash
        } is ${delay}ms. Warpcast link: https://warpcast.com/${username}/${check.hash.substring(0, 10)}`,
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
}

async function checkEvents() {
  const castsProcessedLastMinute = await db.castLog.findMany({
    where: {
      createdAt: {
        gte: new Date(Date.now() - 10 * 1_000 * 60),
      },
    },
  });

  if (castsProcessedLastMinute.length < 5) {
    console.log("Warning: Less than 5 casts processed in the last 10 minutes");
    await axios.post("https://webhook-relay.fly.dev/automod", {
      text: "Warning: Less than 5 casts processed in the last 10 minutes",
    });
  }
}
