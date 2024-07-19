/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from "./db.server";
import { getSetCache } from "./utils.server";

export type ModerationStats30Days = {
  likes: number;
  hides: number;
  approvalRate: number;
  uniqueCasters: number;
};

export async function getModerationStats30Days({ channelId }: { channelId: string }) {
  const cacheKey = `moderationStats30Days:${channelId}`;

  return getSetCache({
    key: cacheKey,
    ttlSeconds: 60 * 60 * 4,
    get: async () => {
      const [totalCount, likeCount, hideCount, uniqueCasters] = await Promise.all([
        db.$queryRaw<{ count: number }[]>`
        select count(distinct("hash")) as count
        from "CastLog"
        where "channelId" = ${channelId}
        and "createdAt" >= ${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)}`.then((res: any) =>
          parseInt(res[0]?.count.toString() || "0")
        ),
        db.$queryRaw<{ count: number }[]>`
        select count(distinct("castHash")) as count
        from "ModerationLog"
        where "channelId" = ${channelId}
        and "createdAt" >= ${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)}
        and action = 'like'`.then((res: any) => parseInt(res[0]?.count.toString() || "0")),
        db.$queryRaw<{ count: number }[]>`
        select count(distinct("castHash")) as count
        from "ModerationLog"
        where "channelId" = ${channelId}
        and "createdAt" >= ${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)}
        and action = 'hideQuietly'`.then((res: any) => parseInt(res[0]?.count.toString() || "0")),
        db.$queryRaw<{ count: number }[]>`
        select count(distinct("affectedUserFid")) as count
        from "ModerationLog"
        where "channelId" = ${channelId}
        and "createdAt" >= ${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)}
        and action = 'like'
      `.then((res: any) => res[0]?.count.toString() || "0"),
      ]);

      return {
        likes: likeCount,
        hides: hideCount,
        approvalRate: totalCount === 0 ? 0 : likeCount / totalCount,
        uniqueCasters: parseInt(uniqueCasters),
      };
    },
  });
}
