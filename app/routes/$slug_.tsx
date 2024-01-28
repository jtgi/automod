import { Frame } from "@prisma/client";
import { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { typedjson } from "remix-typedjson";
import invariant from "tiny-invariant";
import { db } from "~/lib/db.server";
import satori from "satori";
import type { CSSProperties } from "react";
import { convertSvgToPngBase64 } from "~/lib/utils.server";

export async function action({ request }: LoaderFunctionArgs) {
  console.log("action");
  //   const data = await request.json();

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

export async function loader({ params }: LoaderFunctionArgs) {
  invariant(params.slug, "Frame slug is required");

  const frame = await db.frame.findFirstOrThrow({
    where: { slug: params.slug },
  });

  //   todo change to fs
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
