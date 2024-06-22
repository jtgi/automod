import { LoaderFunctionArgs, json } from "@remix-run/node";
import axios from "axios";
import { db } from "~/lib/db.server";
import { sendNotification } from "~/lib/notifications.server";

export async function loader({ request }: LoaderFunctionArgs) {
  //using as a cheap cron
  checkEvents().catch(console.error);

  return json({ status: "ok" });
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
