/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from "~/lib/db.server";
import fs from "node:fs";
import { neynar } from "~/lib/neynar.server";
import { User } from "@neynar/nodejs-sdk/build/neynar-api/v1";

async function main() {
  fs.copyFileSync("../prisma/dev.db", "../prisma/dev.db.bak");
  const channels = await db.moderatedChannel.findMany({});

  for (const channel of channels) {
    if (!channel.excludeUsernamesParsed) {
      continue;
    }

    if (!channel.excludeUsernamesParsed.length) {
      continue;
    }

    if (typeof channel.excludeUsernamesParsed[0] !== "string") {
      continue;
    }

    if (channel.excludeUsernamesParsed.length === 1 && !channel.excludeUsernamesParsed[0]) {
      continue;
    }

    console.log(`[${channel.id}]`, JSON.stringify(channel.excludeUsernamesParsed, null, 2));

    const results = await Promise.all(
      channel.excludeUsernamesParsed
        .filter((u) => !!u)
        .map((username) =>
          neynar
            .lookupUserByUsername(username as unknown as string)
            .then((rsp) => rsp.result.user)
            .catch((err) => {
              console.error(`Failed to lookup user ${username}`, err?.message);
              return null;
            })
        )
    );

    const users = results.filter((u) => u !== null) as unknown as User[];
    const updated = users.map((u) => ({
      value: u.fid,
      label: u.username,
      icon: u.pfp.url,
    }));

    await db.moderatedChannel.update({
      where: {
        id: channel.id,
      },
      data: {
        excludeUsernames: JSON.stringify(updated),
      },
    });
  }
}

main()
  .then(() => console.log("done"))
  .catch(console.error);
