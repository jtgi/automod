import { json, LoaderFunctionArgs } from "@remix-run/node";
import invariant from "tiny-invariant";
import { requirePartnerApiKey } from "~/lib/utils.server";
import { db } from "~/lib/db.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requirePartnerApiKey({ request });
  invariant(params.id, "id is required");

  const channel = await db.moderatedChannel.findUnique({
    where: {
      id: params.id,
    },
  });

  if (!channel) {
    return json({ error: "Channel not found" }, { status: 404 });
  }

  const {
    id,
    createdAt,
    updatedAt,
    active,
    imageUrl,
    url,
    feedType,
    userId,
    slowModeHours,
    excludeCohosts,
    excludeUsernamesParsed,
    inclusionRuleSetParsed,
    exclusionRuleSetParsed,
  } = channel;

  return json({
    id,
    createdAt,
    updatedAt,
    active,
    imageUrl,
    url,
    feedType,
    userId,
    slowModeHours,
    excludeCohosts,
    excludeUsers: excludeUsernamesParsed,
    inclusionRuleSet: inclusionRuleSetParsed?.ruleParsed,
    exclusionRuleSet: exclusionRuleSetParsed?.ruleParsed,
  });
}
