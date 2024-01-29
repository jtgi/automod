import sharp from "sharp";

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
