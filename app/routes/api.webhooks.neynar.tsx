import { ActionFunctionArgs, json } from "@remix-run/node";
import { requireValidSignature } from "~/lib/utils.server";

import { webhookQueue } from "~/lib/bullish.server";
import { WebhookCast } from "~/lib/types";
import { isRuleTargetApplicable } from "~/lib/automod.server";

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
