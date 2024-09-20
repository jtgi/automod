import { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "remix-typedjson";
import { db } from "~/lib/db.server";
import { getUser } from "~/lib/neynar.server";
import { getSharedEnv, requireSuperAdmin } from "~/lib/utils.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireSuperAdmin({ request });

  const url = new URL(request.url);
  const signerUuid = url.searchParams.get("signerUuid") ?? undefined;
  const fid = url.searchParams.get("fid") ?? undefined;

  if (!signerUuid || !fid) {
    return new Response("Missing signerUuid or fid", { status: 400 });
  }

  const user = await getUser({ fid });

  const signer = await db.signer.create({
    data: {
      signerUuid,
      username: user.username,
      fid: String(user.fid),
      avatarUrl: user.pfp_url || getSharedEnv().hostUrl + "/apple-touch-icon.png",
    },
  });

  return redirect(`/signer?id=${signer.id}`);
}

export default function Screen() {
  return (
    <div className="flex h-screen flex-row items-center justify-center">
      Whops! You should have already been redirected.
    </div>
  );
}
