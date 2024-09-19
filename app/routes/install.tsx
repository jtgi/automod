/* eslint-disable @typescript-eslint/no-explicit-any */
import path from "node:path";
import { frameResponse, getSharedEnv } from "~/lib/utils.server";
import fs from "node:fs/promises";
import satori from "satori";
import { CSSProperties } from "react";
import sharp from "sharp";
import { actions } from "~/lib/cast-actions.server";
import { ActionFunctionArgs } from "@remix-run/node";
import { actionToInstallLink } from "~/lib/utils";

export async function action({ request }: ActionFunctionArgs) {
  const env = getSharedEnv();
  const url = new URL(request.url);
  const currentIndex = parseInt(url.searchParams.get("index") ?? "1");
  const currentAction = actions[currentIndex];
  const nextIndex = (currentIndex + 1) % actions.length;

  return frameResponse({
    title: "Automod Cast Actions",
    description: "Install automod cast actions",
    image: currentAction.image,
    cacheTtlSeconds: 0,
    postUrl: `${env.hostUrl}/install?index=${nextIndex}`,
    buttons: [
      {
        text: "Install",
        link: actionToInstallLink(currentAction),
      },
      {
        text: "Next",
      },
    ],
  });
}

export async function loader() {
  const env = getSharedEnv();
  const action = actions[0];

  return frameResponse({
    title: "Automod Cast Actions",
    description: "Install automod cast actions",
    postUrl: `${env.hostUrl}/install?index=1`,
    image: action.image,
    cacheTtlSeconds: 0,
    buttons: [
      {
        text: "Install",
        link: actionToInstallLink(action),
      },
      actions.length > 1
        ? {
            text: "Next",
          }
        : null,
    ].filter(Boolean) as any[],
  });
}
