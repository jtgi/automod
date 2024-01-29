import sharp from "sharp";
import { authenticator } from "./auth.server";

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
