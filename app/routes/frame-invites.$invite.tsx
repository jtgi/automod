import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { db } from "~/lib/db.server";
import {
  convertSvgToPngBase64,
  frameResponse,
  getSharedEnv,
  parseMessage,
} from "~/lib/utils.server";
import invariant from "tiny-invariant";
import { CSSProperties } from "react";
import satori from "satori";

export async function action({ request, params }: ActionFunctionArgs) {
  invariant(params.invite, "Invite code is required");
  const invite = params.invite;
  const env = getSharedEnv();

  const inviteDef = await db.inviteCode.findUnique({
    where: {
      id: invite,
      active: true,
    },
    include: {
      claims: true,
    },
  });

  if (!inviteDef || inviteDef.claims.length >= inviteDef.limit) {
    return new Response("OK", {
      status: 302,
      headers: {
        location: `${env.hostUrl}?error=invalid_invite_code`,
      },
    });
  }

  const data = await request.json();
  const message = await parseMessage(data);

  if (process.env.NODE_ENV === "development") {
    console.log(JSON.stringify(message, null, 2));
  }

  await db.order.upsert({
    where: {
      fid: String(message.action.interactor.fid),
    },
    update: {},
    create: {
      fid: String(message.action.interactor.fid),
    },
  });

  return new Response("OK", {
    status: 302,
    headers: {
      location: `${env.hostUrl}`,
    },
  });
}

export async function loader({ params }: LoaderFunctionArgs) {
  invariant(params.invite, "Invite code is required");

  const invite = await db.inviteCode.findFirstOrThrow({
    where: {
      id: params.invite,
    },
    include: {
      claims: true,
    },
  });

  if (!invite.active || invite.claims.length >= invite.limit) {
    return frameResponse({
      title: "No invites left",
      description: "automod is in private beta and invites are limited.",
      image: await generateFrame({
        message:
          "All invites have been claimed. Follow the channel for updates.",
      }),
    });
  }

  return frameResponse({
    title: "You're invited to automod",
    description:
      "automod is in private beta and invites are limited. Claim yours now.",
    image: await generateFrame({
      message: "Invites are limited. Claim yours now.",
    }),
    postUrl: `${getSharedEnv().hostUrl}/frame-invites/${invite.id}`,
    buttons: [
      {
        text: "Claim Invite",
        isRedirect: true,
      },
    ],
  });
}

async function generateFrame(props: { message: string }) {
  const response = await fetch(
    `${getSharedEnv().hostUrl}/fonts/kode-mono-bold.ttf`
  );
  const fontBuffer = await response.arrayBuffer();
  const styles: CSSProperties = {
    display: "flex",
    color: "white",
    fontFamily: "Kode Mono",
    backgroundColor: "rgba(237,3,32,0.87) 20.8%",
    backgroundImage:
      "radial-gradient(circle farthest-corner at 10% 20%, rgba(237,3,32,0.87) 20.8%, rgba(242,121,1,0.84) 74.4%)",
    height: "100%",
    width: "100%",
    padding: 72,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    fontSize: 40,
    fontWeight: 600,
  };

  const svg = await satori(<div style={styles}>{props.message}</div>, {
    width: 800,
    height: 418,
    fonts: [
      {
        name: "Kode Mono",
        data: fontBuffer,
        style: "normal",
      },
    ],
  });

  return convertSvgToPngBase64(svg);
}
