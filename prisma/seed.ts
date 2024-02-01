// cryptoadz: 0x1cb1a5e65610aeff2551a50f76a87a7d3fb649c6

import { Prisma } from "@prisma/client";
import { db } from "~/lib/db.server";

async function seed() {
  const user = await db.user.upsert({
    where: {
      providerId: "5179",
    },
    create: {
      providerId: "5179",
    },
    update: {
      providerId: "5179",
    },
  });

  const preorder = await db.preorder.upsert({
    where: {
      providerId: user.providerId,
    },
    create: {
      providerId: user.providerId,
    },
    update: {
      providerId: user.providerId,
    },
  });

  const frameArgs: Prisma.FrameUncheckedCreateInput = {
    userId: user.id,
    slug: "test",
    preRevealText: "pre-reveal text",
    secretText: "secret",
    revealType: "text",
    requireLike: true,
    requireFollow: true,
    requireRecast: true,
    requireSomeoneIFollow: true,
    requireHoldERC721: true,
    requireHoldERC20: true,
    backgroundColor: "blue",
    textColor: "red",

    requireERC20ContractAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", //usdc
    requireERC20NetworkId: "8453",
    requireERC20MinBalance: "0.50",

    requireERC721ContractAddress: "0x1cb1a5e65610aeff2551a50f76a87a7d3fb649c6", //toadz
    requireERC721NetworkId: "1",
    requireERC721TokenId: null,
  };

  const frame = await db.frame.upsert({
    where: {
      slug: "test",
    },
    update: frameArgs,
    create: frameArgs,
  });
}

seed()
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
