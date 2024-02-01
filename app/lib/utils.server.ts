import sharp from "sharp";
import { authenticator } from "./auth.server";
import { Frame, User } from "@prisma/client";
import { generateFrameSvg } from "./utils";
import { db } from "./db.server";
import { redirect } from "remix-typedjson";

export async function convertSvgToPngBase64(
  svgString: string
): Promise<string | null> {
  try {
    const buffer: Buffer = await sharp(Buffer.from(svgString)).png().toBuffer();
    const base64PNG: string = buffer.toString("base64");
    return `data:image/png;base64,${base64PNG}`;
  } catch (error) {
    console.error("Error converting SVG to PNG:", error);
    return null;
  }
}

export function requireFrameOwner(userId: string, slug: string) {
  const frame = db.frame.findFirst({
    where: {
      slug,
      userId,
    },
  });

  if (!frame) {
    throw redirect(`/403`);
  }

  return frame;
}

export function requireUser({ request }: { request: Request }) {
  return authenticator.isAuthenticated(request, {
    failureRedirect: `/login`,
  });
}

export async function generateFrame(frame: Frame, message: string) {
  const svg = await generateFrameSvgServer(frame, message);
  const imgSrc = await convertSvgToPngBase64(svg);
  if (!imgSrc) {
    throw new Error("Error converting SVG to PNG");
  }

  return imgSrc;
}

export async function generateFrameSvgServer(frame: Frame, message: string) {
  const env = getSharedEnv();
  return generateFrameSvg(frame, message, env.hostUrl!, {
    scale: 1,
  });
}

export function getSharedEnv() {
  return {
    infuraProjectId: process.env.INFURA_PROJECT_ID!,
    hostUrl:
      process.env.NODE_ENV === "production"
        ? process.env.PROD_URL!
        : process.env.DEV_URL!,
  };
}
