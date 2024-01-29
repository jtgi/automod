import { Frame } from "@prisma/client";
import { LoaderFunctionArgs, MetaFunction, json } from "@remix-run/node";
import { typedjson } from "remix-typedjson";
import invariant from "tiny-invariant";
import { db } from "~/lib/db.server";
import satori from "satori";
import type { CSSProperties } from "react";
import { Message, getSSLHubRpcClient } from "@farcaster/hub-nodejs";
import { convertSvgToPngBase64 } from "~/lib/utils.server";
import {
  FarcasterEpochTimestamp,
  HubRestAPIClient,
} from "@standard-crypto/farcaster-js-hub-rest";
import axios from "axios";
import {
  neynar,
  pageFollowersDeep,
  pageReactionsDeep,
} from "~/lib/neynar.server";

const hubClient = new HubRestAPIClient();

const skipTrusted = false;

type FrameResponseArgs = {
  title?: string;
  description?: string;
  version?: string;
  image: string;
  buttons?: Array<{
    text: string;
  }>;
  postUrl?: string;
};

const frameResponse = (params: FrameResponseArgs) => {
  const version = params.version || "vNext";
  const html = `
  <!DOCTYPE html>
  <html
    <head>
      ${params.title ? `<title>${params.title}</title>` : ""}
      ${params.title ? `<meta name="og:title" content="${params.title}">` : ""}
      ${
        params.description
          ? `<meta name="description" content="${params.description}">`
          : ""
      }
      <meta name="fc:frame" content="${version}">
      <meta name="fc:frame:image" content="${params.image}">
      ${
        params.postUrl
          ? `<meta name="fc:frame:post_url" content="${params.postUrl}">`
          : ""
      }
      ${
        params.buttons
          ? params.buttons
              .map(
                (b, index) =>
                  `<meta name="fc:frame:button:${index}" content="${b.text}">`
              )
              .join("\n")
          : ""
      }
    </head>
  </html>
  `;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html",
    },
  });
};

export async function action({ request, params }: LoaderFunctionArgs) {
  const data = await request.json();
  const env = process.env;

  invariant(params.slug, "Frame slug is required");

  const frame = await db.frame.findFirst({
    where: { slug: params.slug },
  });

  if (!frame) {
    console.log("no frame found", { frame, params });
    return json({ error: "Invalid frame" }, { status: 400 });
  }

  // farcaster sig auth
  if (!data || !data.untrustedData) {
    console.log("missing untrusted data", data);
    return json({ error: "Missing data", data }, { status: 400 });
  }

  let validatedMessage: Message | undefined = undefined;
  if (!skipTrusted) {
    if (!data.trustedData) {
      console.log("invalid data", { data });
      return json({ error: "Missing trusted data", data }, { status: 400 });
    }

    const HUB_URL = process.env.HUB_URL || "nemes.farcaster.xyz:2283";
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

  if (
    validatedMessage.data?.frameActionBody?.url.toString() !==
    `${env.HOST_URL}/${params.slug}`
  ) {
    console.log("invalid url", {
      actionBody: validatedMessage.data?.frameActionBody,
      url: validatedMessage.data?.frameActionBody?.url.toString(),
    });
    return json({ error: "Invalid url" }, { status: 400 });
  }

  console.log({
    validatedMessage: validatedMessage.data.frameActionBody,
  });

  if (!validatedMessage.data?.frameActionBody?.castId) {
    console.log("missing castId in frame action payload", {
      actionBody: validatedMessage.data?.frameActionBody,
    });
    return json({ error: "Invalid castId" }, { status: 400 });
  }

  const { fid, hash } = validatedMessage.data!.frameActionBody!.castId;
  const castHash = Buffer.from(hash).toString("hex");

  // do some neynar shit
  if (frame.requireSomeoneIFollow) {
    const followers = await pageFollowersDeep({
      fid: validatedMessage.data.frameActionBody.castId.fid,
    });

    const isValid = followers.some((f) => f.fid == validatedMessage?.data?.fid);

    if (!isValid) {
      return frameResponse({
        image: await generateErrorMessage(
          frame,
          `Restricted to followers only`
        ),
      });
    }
  }

  if (frame.requireFollow) {
    const followers = await pageFollowersDeep({
      fid: validatedMessage.data.fid,
    });

    const isValid = followers.some(
      (f) => f.fid == validatedMessage?.data?.frameActionBody?.castId?.fid
    );

    if (!isValid) {
      return frameResponse({
        image: await generateErrorMessage(frame, "Must follow to reveal"),
      });
    }
  }

  if (frame.requireHaveToken) {
    throw new Error("not implemented");
  }

  if (frame.requireHoldNFT) {
    throw new Error("not implemented");
  }

  if (frame.requireLike || frame.requireRecast) {
    const reactions = await pageReactionsDeep({ hash: castHash });

    if (frame.requireRecast) {
      const isValid = reactions.some(
        (c) =>
          c.reactor.fid == validatedMessage?.data?.fid && c.type === "recast"
      );

      if (!isValid) {
        if (!isValid) {
          return frameResponse({
            image: await generateErrorMessage(frame, "Must recast to reveal"),
          });
        }
      }
    }

    if (frame.requireLike) {
      const isValid = reactions.some(
        (c) => c.reactor.fid == validatedMessage?.data?.fid && c.type === "like"
      );

      if (!isValid) {
        return frameResponse({
          image: await generateErrorMessage(frame, "Must like to reveal"),
        });
      }
    }
  }

  const html = `
  <!DOCTYPE html>
  <html>
    <head>
      <title>gm</title>
      <meta name="description" content="gm">
      <meta name="og:title" content="gm">
      <meta name="og:image" content="${process.env.HOST_URL}/elmo.gif">
      <meta name="og:url" content="${process.env.HOST_URL}/elmo.gif">
      <meta name="fc:frame" content="vNext">
      <meta name="fc:frame:image" content="${process.env.HOST_URL}/elmo.gif">
    </head>
    <body>
    gm
    </body>
  </html>
  `;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html",
    },
  });
}

async function generateErrorMessage(frame: Frame, message: string) {
  const response = await fetch(`${process.env.HOST_URL}/Inter-Regular.ttf`);
  const fontBuffer = await response.arrayBuffer();
  const styles: CSSProperties = {
    display: "flex",
    color: frame.textColor || "white",
    fontFamily: "Inter Regular",
    backgroundColor: frame.backgroundColor || "black",
    height: "100%",
    width: "100%",
    padding: 72,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 32,
    fontWeight: 600,
  };

  const preReveal = await satori(
    <div style={styles}>
      <h1>{message}</h1>
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

  const imgSrc = await convertSvgToPngBase64(preReveal);
  if (!imgSrc) {
    throw new Error("Error converting SVG to PNG");
  }

  return imgSrc;
}

export async function loader({ params }: LoaderFunctionArgs) {
  invariant(params.slug, "Frame slug is required");

  const frame = await db.frame.findFirstOrThrow({
    where: { slug: params.slug },
  });

  //   todo change to fs
  //  todo abstract this probably
  const response = await fetch(`${process.env.HOST_URL}/Inter-Regular.ttf`);
  const fontBuffer = await response.arrayBuffer();
  const styles: CSSProperties = {
    display: "flex",
    color: frame.textColor || "white",
    fontFamily: "Inter Regular",
    backgroundColor: frame.backgroundColor || "black",
    height: "100%",
    width: "100%",
    padding: 72,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 32,
    fontWeight: 600,
  };

  const preReveal = await satori(
    <div style={styles}>
      <h1>{frame.preRevealText}</h1>
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

  const imgSrc = await convertSvgToPngBase64(preReveal);
  if (!imgSrc) {
    throw new Error("Error converting SVG to PNG");
  }

  const meta = [
    {
      property: "description",
      content: frame.text,
    },
    {
      property: "og:title",
      content: `Frame | ${frame.slug}`,
    },
    {
      property: "og:description",
      content: frame.text,
    },
    {
      property: "fc:frame",
      content: "vNext",
    },
    {
      property: "fc:frame:image",
      content: imgSrc,
    },
    {
      property: "fc:frame:button:1",
      content: "Reveal",
    },
  ];

  const html = `
  <!DOCTYPE html>
  <html>
    <head>
      <title>Frame | ${frame.slug}</title>
      ${meta
        .map((m) => `<meta name="${m.property}" content="${m.content}" />`)
        .join("\n")}
    </head>
    <body>
    <pre>
    <img src="${imgSrc}" />
    ${JSON.stringify(frame, null, 2)}
    </pre>
    </body>
  </html>
  `;

  return new Response(html, {
    headers: {
      "content-type": "text/html;charset=UTF-8",
    },
    status: 200,
  });
}
