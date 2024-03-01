import { useMatches } from "@remix-run/react";
import { type ClassValue, clsx } from "clsx";
import { CSSProperties, useEffect, useRef, useState } from "react";
import satori from "satori";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function generateFrameSvg(
  message: string,
  hostUrl: string,
  options?: {
    scale?: number;
  }
) {
  const response = await fetch(`${hostUrl}/Inter-Regular.ttf`);
  const fontBuffer = await response.arrayBuffer();
  const scale = options?.scale || 1;
  const styles: CSSProperties = {
    display: "flex",
    color: "white",
    fontFamily: "Inter Regular",
    backgroundColor: "black",
    height: "100%",
    width: "100%",
    padding: 72 * scale,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    fontSize: 18 * scale,
    fontWeight: 600,
  };

  const svg = await satori(
    <div style={styles}>
      <h1>{message}</h1>
    </div>,
    {
      width: 800 * scale,
      height: 418 * scale,
      fonts: [
        {
          name: "Inter Regular",
          data: fontBuffer,
          style: "normal",
        },
      ],
    }
  );

  return svg;
}

export function useClipboard() {
  const [copied, setCopied] = useState(false);
  const ref = useRef();

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);

      if (ref.current) {
        clearTimeout(ref.current);
      }

      setTimeout(() => setCopied(false), 1_000);
    } catch (err) {}
  };

  return { copy, copied };
}

export function useRouteData<T>(routeId: string): T | undefined {
  const matches = useMatches();
  const data = matches.find((match) => match.id === routeId)?.data;

  return data as T | undefined;
}
