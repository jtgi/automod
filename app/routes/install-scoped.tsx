/* eslint-disable @typescript-eslint/no-explicit-any */
import path from "node:path";
import { frameResponse, getSharedEnv } from "~/lib/utils.server";
import fs from "node:fs/promises";
import satori from "satori";
import { CSSProperties } from "react";
import sharp from "sharp";
import { actions } from "~/lib/cast-actions.server";
import { ActionFunctionArgs } from "@remix-run/node";
import { db } from "~/lib/db.server";
import { actionToInstallLink } from "~/lib/utils";

export async function action({ request }: ActionFunctionArgs) {
  try {
    const env = getSharedEnv();
    const url = new URL(request.url);
    const data = await request.json();
    const fid = data.untrustedData.fid;

    const delegations = await db.delegate.findMany({
      where: {
        fid: String(fid),
      },
      include: {
        role: true,
      },
    });

    if (delegations.length === 0) {
      return frameResponse({
        title: "Automod Cast Actions",
        description: "You do not have any automod cast actions installed",
        image: `${env.hostUrl}/actions/no-actions-available.png`,
      });
    }

    const actionPermissions = Array.from(
      new Set(
        delegations
          .flatMap((d) => d.role.permissionsParsed)
          .filter((p) => p.includes("action:"))
          .map((p) => p.replace("action:", ""))
      )
    );

    //TODO: get cast action definitions using the available actions
    // based on the index show the next cast action
    const availableActions = actions.filter((a) => actionPermissions.includes(a.automodAction));
    if (!availableActions.length) {
      return frameResponse({
        title: "Automod Cast Actions",
        description: "You do not have any automod cast actions installed",
        image: `${env.hostUrl}/actions/no-actions-available.png`,
      });
    }

    const currentIndex = parseInt(url.searchParams.get("index") ?? "0");
    const currentAction = availableActions[currentIndex];
    const nextIndex = (currentIndex + 1) % availableActions.length;

    return frameResponse({
      title: "Automod Cast Actions",
      description: "Install scoped automod cast actions",
      image: currentAction.image,
      cacheTtlSeconds: 0,
      postUrl: `${env.hostUrl}/install-scoped?index=${nextIndex}`,
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
  } catch (e) {
    console.error(e);
    throw e;
  }
}

export async function loader() {
  const env = getSharedEnv();

  return frameResponse({
    title: "Automod Cast Actions",
    description: "Install automod cast actions",
    postUrl: `${env.hostUrl}/install-scoped?index=0`,
    image: `${env.hostUrl}/actions/install-scoped.png`,
    cacheTtlSeconds: 0,
    buttons: [
      {
        text: "Show Installable Actions",
      },
    ],
  });
}
