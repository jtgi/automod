/* eslint-disable @typescript-eslint/no-explicit-any */
import { frameResponse, getSharedEnv } from "~/lib/utils.server";
import { actions } from "~/lib/cast-actions.server";
import { LoaderFunctionArgs, redirect } from "@remix-run/node";
import { actionToInstallLink } from "~/lib/utils";

export const action = handler;
export const loader = handler;

async function handler({ params }: LoaderFunctionArgs) {
  const env = getSharedEnv();
  const action = actions.find((a) => a.automodAction === params.action);

  if (!action) {
    return redirect("/404");
  }

  return frameResponse({
    title: `Automod | Install ${action.name}`,
    description: action.description,
    postUrl: `${env.hostUrl}/install?index=1`,
    image: action.image,
    cacheTtlSeconds: 0,
    buttons: [
      {
        text: `Install ${action.name}`,
        link: actionToInstallLink(action),
      },
    ],
  });
}
