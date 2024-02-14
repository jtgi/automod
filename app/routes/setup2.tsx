import { ActionFunctionArgs } from "@remix-run/node";
import invariant from "tiny-invariant";
import { db } from "~/lib/db.server";
import { parseMessage } from "~/lib/utils.server";
import { renderNextCandidateFrame } from "./next";

export async function action({ request }: ActionFunctionArgs) {
  const data = await request.json();

  const url = new URL(request.url);
  const sex = url.searchParams.get("sex");
  invariant(sex, "explode");

  const message = await parseMessage(data);
  const seeking =
    message.action.tapped_button.index === 1
      ? "guy"
      : message.action.tapped_button.index === 2
      ? "girl"
      : "any";

  const user = await db.user.upsert({
    where: {
      providerId: String(message.action.interactor.fid),
    },
    update: {
      seeking,
      sex,
    },
    create: {
      providerId: String(message.action.interactor.fid),
      name: message.action.interactor.username,
      avatarUrl: message.action.interactor.pfp_url,
      seeking,
      sex,
      userData: JSON.stringify(message.action.interactor),
    },
  });

  return renderNextCandidateFrame(user.providerId);
}
