import { User } from "@prisma/client";
import { ActionFunctionArgs } from "@remix-run/node";
import axios from "axios";
import satori from "satori";
import { db } from "~/lib/db.server";
import {
  convertSvgToPngBase64,
  frameResponse,
  generateSystemFrame,
  getSharedEnv,
  parseMessage,
} from "~/lib/utils.server";

export async function action({ request }: ActionFunctionArgs) {
  const data = await request.json();
  const env = getSharedEnv();

  const url = new URL(request.url);
  const candidateFid = url.searchParams.get("fid");

  const message = await parseMessage(data);

  if (candidateFid) {
    const candidate = await db.user.findFirst({
      where: {
        providerId: candidateFid,
      },
    });

    if (!candidate) {
      return frameResponse({
        title: "onframe dating",
        version: "vNext",
        description: "Dating on farcaster",
        image: await generateSystemFrame("That's not a real candidate..."),
        buttons: [
          {
            text: "Play Again",
          },
        ],
      });
    }

    const liked = message.action.tapped_button.index === 2;
    const user = await db.user.findFirstOrThrow({
      where: {
        providerId: String(message.action.interactor.fid),
      },
    });

    await db.seen.create({
      data: {
        userId: user.id,
        toFid: candidateFid,
        result: liked ? "like" : "dislike",
      },
    });

    if (liked) {
      const user = await db.user.findFirstOrThrow({
        where: {
          providerId: String(candidateFid),
        },
      });

      const isMutual = await db.seen.findFirst({
        where: {
          userId: user.id,
          toFid: String(message.action.interactor.fid),
          result: "like",
        },
      });

      if (isMutual) {
        return frameResponse({
          title: "onframe dating",
          version: "vNext",
          description: "Dating on farcaster",
          image: await generateSystemFrame(
            "It's a match! You two should message each other urgently."
          ),
          buttons: [
            {
              text: "Continue",
            },
            {
              text: `@${user.name}`,
              link: `https://warpcast/${user.name}`,
            },
          ],
          postUrl: `${env.hostUrl}/next`,
        });
      }
    }
  }

  return renderNextCandidateFrame(message.action.interactor.fid);
}

export async function renderCandidate(user: User) {
  const userData = JSON.parse(user.userData);

  const imageResponse = await axios.get(user.avatarUrl, {
    responseType: "arraybuffer",
  });
  const base64 = Buffer.from(imageResponse.data, "binary").toString("base64");
  const contentType = imageResponse.headers["content-type"] || "image/jpeg";
  const dataURL = `data:${contentType};base64,${base64}`;

  const fontData = await axios.get(getSharedEnv().hostUrl + "/Inter-Bold.ttf", {
    responseType: "arraybuffer",
  });

  const svg = await satori(
    <div
      style={{
        display: "flex",
        color: "white",
        fontFamily: "Inter",
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
      }}
    >
      <img
        src={dataURL}
        style={{ borderRadius: "50%", width: 200, marginBottom: 5 }}
      />
      <h1>@{user.name}</h1>
      <p>{userData.profile?.bio?.text}</p>
    </div>,
    {
      width: 800,
      height: 418,
      fonts: [
        {
          name: "Inter",
          data: fontData.data,
          style: "normal",
        },
      ],
    }
  );

  return convertSvgToPngBase64(svg);
}

export async function getNextCandidate(user: User) {
  const seenUserIds = await db.seen.findMany({
    where: {
      userId: user.id,
    },
    select: {
      toFid: true, // Assuming 'toFid' refers to the IDs of users that have been seen
    },
  });

  const seenIds = seenUserIds.map((seen) => seen.toFid);
  const next = await db.user.findFirst({
    where: {
      providerId: {
        not: user.providerId,
      },
      seeking: {
        in: [user.sex, "any"],
      },
      sex: user.seeking === "any" ? undefined : user.seeking,
      AND: [
        {
          providerId: {
            notIn: seenIds,
          },
        },
      ],
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  return next;
}

export async function renderNextCandidateFrame(interactorFid: string | number) {
  const user = await db.user.findFirstOrThrow({
    where: {
      providerId: String(interactorFid),
    },
  });

  const next = await getNextCandidate(user);
  if (!next) {
    return frameResponse({
      title: "onframe dating",
      version: "vNext",
      description: "Dating on farcaster",
      image: await generateSystemFrame(
        "Damn. All out of candidates. Try again later."
      ),
      buttons: [
        {
          text: "I'm feelin lucky",
        },
        {
          text: "Matches",
          link: `${getSharedEnv().hostUrl}/~`,
        },
      ],
      postUrl: `${getSharedEnv().hostUrl}/next`,
    });
  }

  return frameResponse({
    title: "onframe dating",
    version: "vNext",
    description: "Dating on farcaster",
    image: await renderCandidate(next),
    buttons: [
      {
        text: "👎",
      },
      {
        text: "👍",
      },
      {
        text: `@${next.name}`,
        link: `https://warpcast/${next.providerId}`,
      },
      {
        text: "Matches",
        link: `${getSharedEnv().hostUrl}/~`,
      },
    ],
    postUrl: `${getSharedEnv().hostUrl}/next?fid=${next.providerId}`,
  });
}
