import { json, LoaderFunctionArgs } from "@remix-run/node";
import invariant from "tiny-invariant";
import { z } from "zod";
import { db } from "~/lib/db.server";
import { getSharedEnv, requirePartnerApiKey } from "~/lib/utils.server";

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  actions: z.array(z.string()).optional(),
  sortBy: z.enum(["createdAt"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requirePartnerApiKey({ request });

  const { id } = params;
  invariant(id, "channel id required");

  const url = new URL(request.url);
  const queryParams = Object.fromEntries(url.searchParams);

  const { page, limit, actions, sortBy, sortOrder } = querySchema.parse({
    ...queryParams,
    actions: queryParams.actions ? queryParams.actions.split(",") : undefined,
  });

  const baseQuery = {
    where: {
      channelId: id,
      ...(actions && actions.length > 0 ? { action: { in: actions } } : {}),
    },
    orderBy: { [sortBy]: sortOrder },
    take: limit,
    skip: (page - 1) * limit,
  };

  const [moderationLogs, total] = await Promise.all([
    db.moderationLog.findMany(baseQuery),
    db.moderationLog.count({ where: baseQuery.where }),
  ]);

  const totalPages = Math.ceil(total / limit);
  const next =
    page + 1 > totalPages
      ? null
      : `${getSharedEnv().hostUrl}/api/channels/${id}/activity?${new URLSearchParams({
          ...queryParams,
          page: String(Math.min(page + 1, totalPages)),
        })}`;

  return json({
    results: moderationLogs,
    meta: {
      page,
      limit,
      next,
      total,
    },
  });
}
