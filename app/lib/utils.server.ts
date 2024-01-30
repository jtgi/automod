import sharp from "sharp";
import { authenticator } from "./auth.server";
import { Frame } from "@prisma/client";
import { generateFrameSvg } from "./utils";

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

export function requireUser({ request }: { request: Request }) {
  const url = new URL(request.url);
  return authenticator.isAuthenticated(request, {
    failureRedirect: `/login`,
  });
}

export async function generateFrame(
  frame: Frame,
  message: string,
  options?: {
    scale?: number;
    hostUrl?: string;
  }
) {
  const svg = await generateFrameSvgServer(frame, message);
  const imgSrc = await convertSvgToPngBase64(svg);
  if (!imgSrc) {
    throw new Error("Error converting SVG to PNG");
  }

  return imgSrc;
}

export async function generateFrameSvgServer(frame: Frame, message: string) {
  return generateFrameSvg(frame, message, process.env.HOST_URL!, {
    scale: 1,
  });
}
