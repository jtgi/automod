import { Frame } from "@prisma/client";
import { parseUnits } from "viem";
import { erc20Abi, erc721Abi, getAddress, getContract } from "viem";

import { LoaderFunctionArgs, json } from "@remix-run/node";
import invariant from "tiny-invariant";
import { db } from "~/lib/db.server";
import satori from "satori";
import type { CSSProperties } from "react";
import { Message, getSSLHubRpcClient } from "@farcaster/hub-nodejs";
import { convertSvgToPngBase64 } from "~/lib/utils.server";
import {
  getUser,
  pageFollowersDeep,
  pageReactionsDeep,
} from "~/lib/neynar.server";
import { clientsByChainId } from "~/lib/viem.server";

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
  console.log("generating frame response", params);
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
    if (
      validatedMessage.data?.frameActionBody.castId.fid !==
      validatedMessage.data.fid
    ) {
      const followers = await pageFollowersDeep({
        fid: validatedMessage.data.frameActionBody.castId.fid,
      });

      const isValid = followers.some(
        (f) => f.fid == validatedMessage?.data?.fid
      );

      if (!isValid) {
        return frameResponse({
          image: await generateFrame(frame, `Restricted to followers only`),
        });
      }
    }
  }

  if (frame.requireFollow) {
    if (
      validatedMessage.data?.frameActionBody.castId.fid !==
      validatedMessage.data.fid
    ) {
      const followers = await pageFollowersDeep({
        fid: validatedMessage.data.fid,
      });

      const isValid = followers.some(
        (f) => f.fid == validatedMessage?.data?.frameActionBody?.castId?.fid
      );

      if (!isValid) {
        return frameResponse({
          image: await generateFrame(frame, "Must follow to reveal"),
        });
      }
    }
  }

  if (frame.requireHoldERC20) {
    const user = await getUser({ fid: String(validatedMessage.data.fid) });
    if (!user.verifications.length) {
      return frameResponse({
        image: await generateFrame(
          frame,
          "Must link an address to your Farcaster account"
        ),
      });
    }

    invariant(frame.requireERC20NetworkId, "Missing network id");
    invariant(frame.requireERC20ContractAddress, "Missing network id");
    invariant(frame.requireERC20MinBalance, "Missing balance");

    const client = clientsByChainId[frame.requireERC20NetworkId];
    const contract = getContract({
      address: getAddress(frame.requireERC20ContractAddress),
      abi: erc20Abi,
      client,
    });

    const balances = await Promise.all(
      user.verifications.map((add) =>
        contract.read.balanceOf([getAddress(add)])
      )
    );
    const decimals = await contract.read.decimals();
    const minBalanceBigInt = parseUnits(frame.requireERC20MinBalance, decimals);
    const sum = balances.reduce((a, b) => a + b, BigInt(0));
    const isValid = sum >= minBalanceBigInt;

    if (!isValid) {
      const info = await contract.read.symbol();
      return frameResponse({
        image: await generateFrame(
          frame,
          frame.requireERC20MinBalance == "0"
            ? "Must hold a balance to reveal"
            : `Must hold at least ${frame.requireERC20MinBalance} $${info} to reveal`
        ),
      });
    }
  }

  if (frame.requireHoldERC721) {
    const user = await getUser({ fid: String(validatedMessage.data.fid) });
    if (!user.verifications.length) {
      return frameResponse({
        image: await generateFrame(
          frame,
          "Must link an address to your Farcaster account"
        ),
      });
    }

    invariant(frame.requireERC721NetworkId, "Missing network id");
    invariant(frame.requireERC721ContractAddress, "Missing contract address");

    const client = clientsByChainId[frame.requireERC721NetworkId];
    const contract = getContract({
      address: getAddress(frame.requireERC721ContractAddress),
      abi: erc721Abi,
      client,
    });

    if (frame.requireERC721TokenId !== null) {
      const owner = await contract.read.ownerOf([
        BigInt(frame.requireERC721TokenId),
      ]);
      const isValid = user.verifications.some(
        (address) => address.toLowerCase() === owner.toLowerCase()
      );

      if (!isValid) {
        return frameResponse({
          image: await generateFrame(frame, "Must hold NFT to reveal"),
        });
      }
    } else {
      const balances = await Promise.all(
        user.verifications.map((address) =>
          contract.read.balanceOf([getAddress(address)])
        )
      );
      const isValid = balances.some((balance) => balance > BigInt(0));

      if (!isValid) {
        return frameResponse({
          image: await generateFrame(frame, "Must hold NFT to reveal"),
        });
      }
    }
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
            image: await generateFrame(frame, "Must recast to reveal"),
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
          image: await generateFrame(frame, "Must like to reveal"),
        });
      }
    }
  }

  if (frame.type === "text") {
    return frameResponse({
      image: await generateFrame(frame, frame.secretText!),
    });
  } else if (frame.type === "image") {
    return frameResponse({
      image: frame.imageUrl!,
    });
  } else {
    throw new Error("Invalid frame type");
  }
}

async function generateFrame(frame: Frame, message: string) {
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
      content: frame.preRevealText,
    },
    {
      property: "og:title",
      content: `Frame | ${frame.slug}`,
    },
    {
      property: "og:description",
      content: frame.preRevealText,
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

  return frameResponse({
    title: `Frame | ${frame.slug}`,
    description: frame.preRevealText,
    image: imgSrc,
    buttons: [{ text: "Reveal" }],
  });
}
