import { verifyFarcasterUser } from "~/lib/auth.server";
import { Message, getSSLHubRpcClient } from "@farcaster/hub-nodejs";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { db } from "~/lib/db.server";
import { convertSvgToPngBase64, getSharedEnv } from "~/lib/utils.server";
import invariant from "tiny-invariant";
import { frameResponse } from "./$slug";
import { CSSProperties } from "react";
import satori from "satori";

const skipTrusted = false;

export async function action({ request, params }: ActionFunctionArgs) {
  invariant(params.invite, "Invite code is required");
  const invite = params.invite;
  const env = getSharedEnv();

  const inviteDef = await db.inviteCode.findUnique({
    where: {
      code: invite,
      active: true,
    },
    include: {
      claims: true,
    },
  });

  if (!inviteDef) {
    return new Response("OK", {
      status: 302,
      headers: {
        location: `${env.hostUrl}?error=invalid_invite_code`,
      },
    });
  }

  let validatedMessage: Message | undefined = undefined;
  const data = await request.json();

  console.log({ invite: data });

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

  console.log("fc validatedMessage", {
    fid: validatedMessage.data!.fid.toString(),
    userData: validatedMessage.data?.userDataBody?.value,
  });

  const user = await verifyFarcasterUser({
    fid: validatedMessage.data!.fid.toString(),
    username: validatedMessage.data?.userDataBody?.value,
    request,
  });

  if (!user.claimedInviteCodeId) {
    await db.user.update({
      where: {
        id: user.id,
      },
      data: {
        claimedInviteCodeId: inviteDef.id,
      },
    });

    if (inviteDef.claims.length + 1 >= inviteDef.limit) {
      await db.inviteCode.update({
        where: {
          id: inviteDef.id,
        },
        data: {
          active: false,
        },
      });
    }
  }

  await db.preorder.upsert({
    where: {
      providerId: validatedMessage.data!.fid.toString(),
    },
    update: {
      providerId: validatedMessage.data!.fid.toString(),
    },
    create: {
      providerId: validatedMessage.data!.fid.toString(),
    },
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

export async function loader({ request, params }: LoaderFunctionArgs) {
  invariant(params.invite, "Invite code is required");

  const invite = await db.inviteCode.findFirstOrThrow({
    where: {
      code: params.invite,
    },
  });

  console.log({ invite });

  if (!invite.active) {
    return frameResponse({
      title: "No invites left",
      description: "glass is in private beta and invites are limited.",
      image: await generateFrame({
        message: "All invites have been claimed. Stay tuned.",
      }),
    });
  }

  return frameResponse({
    title: "You're invited to glass",
    description:
      "glass is in private beta and invites are limited. Claim yours now.",
    image: await generateFrame({
      message: "Invites are limited. Claim yours now.",
    }),
    postUrl: `${getSharedEnv().hostUrl}/x/invite/${invite.code}`,
    buttons: [
      {
        text: "Claim Invite",
        isRedirect: true,
      },
    ],
  });
}

async function generateFrame(props: { message: string }) {
  const response = await fetch(`${getSharedEnv().hostUrl}/Inter-Regular.ttf`);
  const fontBuffer = await response.arrayBuffer();
  const styles: CSSProperties = {
    display: "flex",
    color: "white",
    fontFamily: "Inter Regular",
    backgroundColor: "black",
    height: "100%",
    width: "100%",
    padding: 72,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    fontSize: 18,
    fontWeight: 600,
  };

  const svg = await satori(
    <div style={styles}>
      <h1>{props.message}</h1>
    </div>,
    {
      width: 800,
      height: 418,
      fonts: [
        {
          name: "Inter Regular",
          data: fontBuffer,
          style: "normal",
        },
      ],
    }
  );

  return convertSvgToPngBase64(svg);
}
