import { LoaderFunctionArgs } from "@remix-run/node";
import { typedjson } from "remix-typedjson";
import { neynar } from "~/lib/neynar.server";
import { requireUser } from "~/lib/utils.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);

  const username = url.searchParams.get("username");
  if (!username) {
    return typedjson([]);
  }

  await requireUser({ request });
  const users = await neynar.searchUser(username);
  return typedjson(users.result.users);
}
