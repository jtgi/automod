import { LoaderFunctionArgs } from "@remix-run/node";
import invariant from "tiny-invariant";
import { typedjson } from "remix-typedjson";
import { requirePartnerApiKey } from "~/lib/utils.server";
import { db } from "~/lib/db.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requirePartnerApiKey({ request });
  invariant(params.id, "id is required");

  const results = await db.role.findMany({
    where: {
      channelId: params.id,
    },
    orderBy: {
      name: "asc",
    },
  });

  return typedjson({
    results,
    meta: {},
  });
}
