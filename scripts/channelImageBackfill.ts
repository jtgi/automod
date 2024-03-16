import { db } from "~/lib/db.server";
import { getChannel } from "~/lib/neynar.server";

async function main() {
  const channels = await db.moderatedChannel.findMany({
    select: {
      id: true,
    },
    where: {
      imageUrl: null,
    },
  });

  for (const channel of channels) {
    const neynarChannel = await getChannel({ name: channel.id });

    await db.moderatedChannel.update({
      where: {
        id: channel.id,
      },
      data: {
        imageUrl: neynarChannel.image_url,
      },
    });
  }
}

main();
