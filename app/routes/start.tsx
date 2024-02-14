import { ActionFunctionArgs } from "@remix-run/node";
import { db } from "~/lib/db.server";
import {
  frameResponse,
  generateSystemFrame,
  getSharedEnv,
  parseMessage,
} from "~/lib/utils.server";
import { renderNextCandidateFrame } from "./next";

export async function action({ request }: ActionFunctionArgs) {
  const data = await request.json();
  const env = getSharedEnv();

  const message = await parseMessage(data);

  const user = await db.user.findFirst({
    where: {
      providerId: String(message.action.interactor.fid),
    },
  });

  if (!user) {
    return frameResponse({
      title: "onframe dating",
      version: "vNext",
      description: "Dating on farcaster",
      image: await generateSystemFrame("Setup your profile. I'm a..."),
      buttons: [
        {
          text: "Male",
        },
        {
          text: "Female",
        },
      ],
      postUrl: `${env.hostUrl}/setup1`,
    });
  }

  return renderNextCandidateFrame(user.providerId);
}
