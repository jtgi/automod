import { parseUnits, erc20Abi, erc721Abi, getAddress, getContract } from "viem";

import { LoaderFunctionArgs, json } from "@remix-run/node";
import invariant from "tiny-invariant";
import { db } from "~/lib/db.server";
import { generateFrame, getSharedEnv } from "~/lib/utils.server";
import { pageFollowersDeep } from "~/lib/neynar.server";
import { clientsByChainId } from "~/lib/viem.server";
import axios from "axios";
import { MessageResponse } from "~/lib/types";
import { cache } from "~/lib/cache.server";

type FrameResponseArgs = {
  title?: string;
  description?: string;
  version?: string;
  image: string;
  buttons?: Array<{
    text: string;
    isRedirect?: boolean;
  }>;
  postUrl?: string;
};

export async function action({ request, params }: LoaderFunctionArgs) {
  const data = await request.json();
  const env = getSharedEnv();

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

  const res = await axios.post(
    `https://api.neynar.com/v2/farcaster/frame/validate`,
    {
      message_bytes_in_hex: data.trustedData.messageBytes,
      follow_context: true,
    },
    {
      headers: {
        accept: "application/json",
        api_key: process.env.NEYNAR_API_KEY,
        "content-type": "application/json",
        Accept: "application/json",
      },
    }
  );

  const message = res.data as MessageResponse;
  if (!message.valid) {
    return json({ error: "Invalid message" }, { status: 400 });
  }

  const castInfo = message.action.cast;
  const frameUrlSigned = castInfo.frames[0].frames_url;

  console.log({
    message: message.action,
    castInfo,
    interactor: message.action.interactor,
  });

  if (frameUrlSigned !== `${env.hostUrl}/${params.slug}`) {
    console.log("invalid url", {
      signedUrl: frameUrlSigned,
      expectedUrl: `${env.hostUrl}/${params.slug}`,
    });
    return json({ error: "Invalid url" }, { status: 400 });
  }

  const cacheKey = `frameResult:${message.action.cast.hash}:${message.action.interactor.fid}:${frame.id}`;
  const cached = cache.get<string>(cacheKey);

  if (cached !== "true") {
    if (frame.requireSomeoneIFollow) {
      if (message.action.interactor.fid !== message.action.cast.author.fid) {
        const isValid = message.action.interactor.viewer_context!.following;

        if (!isValid) {
          return frameResponse({
            image: await generateFrame(frame, `Restricted to followers only`),
            buttons: [{ text: "Try Again" }],
          });
        }
      }
    }

    if (frame.requireFollow) {
      if (message.action.interactor.fid !== message.action.cast.author.fid) {
        const isValid = message.action.interactor.viewer_context!.followed_by;

        if (!isValid) {
          return frameResponse({
            image: await generateFrame(frame, "Must follow to reveal"),
            buttons: [{ text: "Try Again" }],
          });
        }
      }
    }

    if (frame.requireHoldERC20) {
      const user = message.action.interactor;

      if (!user.verifications.length) {
        return frameResponse({
          image: await generateFrame(
            frame,
            "Must link an address to your Farcaster account"
          ),
          buttons: [{ text: "Try Again" }],
        });
      }

      invariant(frame.requireERC20NetworkId, "Missing network id");
      invariant(frame.requireERC20ContractAddress, "Missing network id");

      const minBalanceRequired = frame.requireERC20MinBalance || "0";
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
      const minBalanceBigInt = parseUnits(minBalanceRequired, decimals);
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
          buttons: [{ text: "Try Again" }],
        });
      }
    }

    if (frame.requireHoldERC721) {
      const user = message.action.interactor;
      if (!user.verifications.length) {
        return frameResponse({
          image: await generateFrame(
            frame,
            "Must link an address to your Farcaster account"
          ),
          buttons: [{ text: "Try Again" }],
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
          const name = await contract.read.name();

          return frameResponse({
            image: await generateFrame(
              frame,
              `${name} #${frame.requireERC721TokenId} is required`
            ),
            buttons: [{ text: "Try Again" }],
          });
          // TODO: add a nice feature to show the user the token they need to hold
        }
      } else {
        const balances = await Promise.all(
          user.verifications.map((address) =>
            contract.read.balanceOf([getAddress(address)])
          )
        );
        const isValid = balances.some((balance) => balance > BigInt(0));

        if (!isValid) {
          const name = await contract.read.name();
          return frameResponse({
            image: await generateFrame(frame, `${name} holders only`),
            buttons: [{ text: "Try Again" }],
          });
        }
      }
    }

    if (frame.requireLike || frame.requireRecast) {
      if (frame.requireRecast) {
        const isValid = message.action.cast.viewer_context.recasted;

        if (!isValid) {
          return frameResponse({
            image: await generateFrame(frame, "Must recast to reveal"),
            buttons: [{ text: "Try Again" }],
          });
        }
      }

      if (frame.requireLike) {
        const isValid = message.action.cast.viewer_context.liked;

        if (!isValid) {
          return frameResponse({
            image: await generateFrame(frame, "Must like to reveal"),
            buttons: [{ text: "Try Again" }],
          });
        }
      }
    }

    cache.set(cacheKey, "true", 60);
  } else {
    console.log("serving from cache", { cacheKey, cached });
  }

  if (frame.revealType === "text") {
    return frameResponse({
      image: await generateFrame(frame, frame.secretText!),
    });
  } else if (frame.revealType === "image") {
    return frameResponse({
      image: frame.imageUrl!,
    });
  } else if (frame.revealType === "frame") {
    const { data } = await axios.get(frame.frameUrl!);
    return new Response(data, {
      headers: {
        "Content-Type": "text/html",
      },
    });
  } else {
    throw new Error("Invalid frame type");
  }
}

export async function loader({ params }: LoaderFunctionArgs) {
  invariant(params.slug, "Frame slug is required");

  const frame = await db.frame.findFirst({
    where: { slug: params.slug },
  });

  if (!frame) {
    return json({ error: "Invalid frame" }, { status: 400 });
  }

  return frameResponse({
    title: `Glass | ${frame.slug}`,
    description: frame.preRevealText,
    image: await generateFrame(frame, frame.preRevealText),
    buttons: [{ text: "Reveal" }],
  });
}

export function frameResponse(params: FrameResponseArgs) {
  const version = params.version || "vNext";
  const html = `
  <!DOCTYPE html>
  <html>
    <head>
      ${params.title ? `<title>${params.title}</title>` : ""}
      ${
        params.title
          ? `<meta property="og:title" content="${params.title}">`
          : ""
      }
      ${
        params.description
          ? `<meta property="description" content="${params.description}">
      <meta property="og:description" content="${params.description}">`
          : ""
      }
      <meta property="fc:frame" content="${version}">
      <meta property="fc:frame:image" content="${params.image}">
      ${
        params.postUrl
          ? `<meta property="fc:frame:post_url" content="${params.postUrl}">`
          : ""
      }
      ${
        params.buttons
          ? params.buttons
              .map((b, index) => {
                let out = `<meta property="fc:frame:button:${
                  index + 1
                }" content="${b.text}">`;
                if (b.isRedirect) {
                  out += `\n<meta property="fc:frame:button:${
                    index + 1
                  }:action" content="post_redirect">`;
                }
                return out;
              })
              .join("\n")
          : ""
      }
    </head>
    <body>
      <h1>${params.title}</h1>
      <p>${params.description}</p>
      <div>
      <img src="${params.image}" />
      </div>
      ${params.buttons
        ?.map((b, index) => `<button name="button-${index}">${b.text}</button>`)
        .join("\n")}
    </body>
  </html>
  `;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
