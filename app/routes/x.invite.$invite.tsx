import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { db } from "~/lib/db.server";
import invariant from "tiny-invariant";
import { redirect } from "remix-typedjson";

export async function loader({ request, params }: LoaderFunctionArgs) {
  invariant(params.invite, "Invite code is required");

  const invite = await db.inviteCode.findUnique({
    where: {
      code: params.invite,
    },
  });

  if (!invite || !invite.active) {
    throw redirect("/?error=invalid_invite_code");
  }

  return redirect(`/login?invite=${params.invite}`);
}
