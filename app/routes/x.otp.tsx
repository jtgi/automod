import { verifyFarcasterUser } from "~/lib/auth.server";
import { Message, getSSLHubRpcClient } from "@farcaster/hub-nodejs";
import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { redirect } from "remix-typedjson";
import { db } from "~/lib/db.server";
import { getSharedEnv } from "~/lib/utils.server";

const skipTrusted = false;

export async function action({ request }: ActionFunctionArgs) {
  const env = getSharedEnv();

  let validatedMessage: Message | undefined = undefined;
  const data = await request.json();

  console.log({ data });

  if (!data || !data.untrustedData) {
    console.log("missing untrusted data", data);
    return json({ error: "Missing data", data }, { status: 400 });
  }

  if (!skipTrusted) {
    if (!data.trustedData) {
      console.log("invalid data", { data });
      return json({ error: "Missing trusted data", data }, { status: 400 });
    }

    const HUB_URL = "nemes.farcaster.xyz:2283";
    const client = getSSLHubRpcClient(HUB_URL);

    const frameMessage = Message.decode(
      Buffer.from(data.trustedData.messageBytes, "hex")
    );
    const result = await client.validateMessage(frameMessage);
    if (
      result.isOk() &&
      result.value.valid &&
      result.value.message?.data?.fid
    ) {
      validatedMessage = result.value.message;
    } else {
      console.log("invalid message", { result });
      return json({ error: "Invalid message" }, { status: 400 });
    }
  } else {
    validatedMessage = { data: data.untrustedData } as Message;
  }

  if (validatedMessage.data?.frameActionBody?.url.toString() !== env.hostUrl) {
    console.log("invalid url", {
      url: validatedMessage.data?.frameActionBody?.url.toString(),
      actionBody: validatedMessage.data?.frameActionBody,
      hostUrl: env.hostUrl,
    });
    return json({ error: "Invalid url" }, { status: 400 });
  }

  console.log("fc validatedMessage", {
    fid: validatedMessage.data!.fid.toString(),
    userData: validatedMessage.data?.userDataBody?.value,
  });

  const user = await verifyFarcasterUser({
    fid: validatedMessage.data!.fid.toString(),
    username: validatedMessage.data?.userDataBody?.value,
    request,
  });

  const otp = await db.otp.create({
    data: {
      userId: user.id,
      active: true,
    },
  });

  return new Response("OK", {
    status: 302,
    headers: {
      location: `${env.hostUrl}/login?code=${otp.code}`,
    },
  });
}
