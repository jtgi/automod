import { db } from "./db.server";

export type ModerationStats30Days = {
  likes: number;
  hides: number;
  approvalRate: number;
  uniqueCasters: number;
};

export async function getModerationStats30Days({ channelId }: { channelId: string }) {
  const [actionCounts, uniqueCasters] = await Promise.all([
    db.moderationLog.groupBy({
      _count: {
        action: true,
      },
      where: {
        channelId,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
        action: {
          in: ["like", "hideQuietly"],
        },
      },
      by: ["action"],
    }),
    db.$queryRaw<{ count: number }[]>`
    select count(affectedUserFid) as count
    from moderationLog
    where channelId = ${channelId}
    and createdAt >= ${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)}
    and action = 'like'
  `.then((res) => res[0]?.count.toString() || "0"),
  ]);

  const likes = actionCounts.find((c) => c.action === "like")?._count.action || 0;
  const hides = actionCounts.find((c) => c.action === "hideQuietly")?._count.action || 0;
  const approvalRate = likes / (likes + hides);

  return {
    likes,
    hides,
    approvalRate,
    uniqueCasters: parseInt(uniqueCasters),
  };
}
