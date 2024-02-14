import { ActionFunctionArgs } from "@remix-run/node";
import {
  frameResponse,
  generateSystemFrame,
  getSharedEnv,
  parseMessage,
} from "~/lib/utils.server";

export async function action({ request }: ActionFunctionArgs) {
  const data = await request.json();
  const env = getSharedEnv();

  const message = await parseMessage(data);
  const sex = message.action.tapped_button.index === 1 ? "male" : "female";

  return frameResponse({
    title: "onframe dating",
    version: "vNext",
    description: "Dating on farcaster",
    image: await generateSystemFrame(`Who you seeking?`),
    postUrl: `${env.hostUrl}/setup2?sex=${sex}`,
    buttons: [{ text: "Male" }, { text: "Female" }, { text: "Either" }],
  });
}
