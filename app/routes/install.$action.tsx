/* eslint-disable @typescript-eslint/no-explicit-any */
import { frameResponse, getSharedEnv } from "~/lib/utils.server";
import { actions } from "~/lib/cast-actions.server";
import { LoaderFunctionArgs, redirect } from "@remix-run/node";
import { actionToInstallLink } from "~/lib/utils";

export const action = handler;
export const loader = handler;

async function handler({ params }: LoaderFunctionArgs) {
  const env = getSharedEnv();

  let installAction = params.action;

  // Reverse compatibility with installed actions
  // hide was changed to unlike but a lot of people
  // still have it install and Hide is better than
  // another name.
  if (params.action === "hideQuietly") {
    installAction = "unlike";
  }

  const action = actions.find((a) => a.automodAction === installAction);

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
