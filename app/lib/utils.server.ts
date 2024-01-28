import svgToImg from "svg-to-img";

export async function convertSvgToPngBase64(
  svgString: string
): Promise<string | null> {
  try {
    const buffer: Buffer = (await svgToImg.from(svgString).toPng()) as Buffer;
    const base64PNG: string = buffer.toString("base64");
    return `data:image/png;base64,${base64PNG}`;
  } catch (error) {
    console.error("Error converting SVG to PNG:", error);
    return null;
  }
}
