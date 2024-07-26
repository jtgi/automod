import { LoaderFunctionArgs } from "@remix-run/node";
import invariant from "tiny-invariant";
import { z } from "zod";
import { db } from "~/lib/db.server";
import { requirePartnerApiKey, getSharedEnv } from "~/lib/utils.server";
import { typedjson } from "remix-typedjson";

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum(["username", "createdAt"]).default("username"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requirePartnerApiKey({ request });
  invariant(params.id, "id is required");
  invariant(params.roleId, "roleId is required");

  const url = new URL(request.url);
  const queryParams = Object.fromEntries(url.searchParams);

  const { page, limit, sortBy, sortOrder } = querySchema.parse(queryParams);

  const baseQuery = {
    where: {
      channelId: params.id,
      roleId: params.roleId,
    },
    orderBy: { [sortBy]: sortOrder },
    take: limit,
    skip: (page - 1) * limit,
  };

  const [delegates, total] = await Promise.all([
    db.delegate.findMany(baseQuery),
    db.delegate.count({ where: baseQuery.where }),
  ]);

  const totalPages = Math.ceil(total / limit);
  const next =
    page + 1 > totalPages
      ? null
      : `${getSharedEnv().hostUrl}/api/channels/${params.id}/roles/${
          params.roleId
        }/delegates?${new URLSearchParams({
          ...queryParams,
          page: String(Math.min(page + 1, totalPages)),
        })}`;

  return typedjson({
    results: delegates,
    meta: {
      page,
      limit,
      next,
      total,
    },
  });
}
