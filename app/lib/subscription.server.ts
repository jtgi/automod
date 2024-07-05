import { getAddress, getContract } from "viem";
import { db } from "./db.server";
import { base } from "viem/chains";
import { hypersubAbi721, hypersubAbiV2 } from "./abis";
import { neynar } from "./neynar.server";
import { clientsByChainId } from "./viem.server";

export async function syncSubscriptions() {
  const activeUsers = await db.user.findMany({
    where: {
      plan: {
        not: "vip",
      },
    },
  });

  for (const user of activeUsers) {
    const plan = await refreshAccountStatus({ fid: user.id });
    console.log(
      `[subsync] ${user.name} plan: ${plan.plan}, expiry: ${
        plan.expiresAt?.toISOString() || Infinity.toString()
      }`
    );
  }
}

export const planTypes = ["basic", "prime", "ultra", "vip"] as const;
export type PlanType = (typeof planTypes)[number];

export const userPlans = {
  basic: {
    id: "basic",
    displayName: "Basic",
    price: "free",
    maxChannels: 3,
    maxCasts: 3_000,
  },
  prime: {
    id: "prime",
    displayName: "Prime",
    price: "$14.99/mo",
    link: "https://hypersub.withfabric.xyz/s/automod/2",
    maxChannels: 5,
    maxCasts: 25_000,
  },
  ultra: {
    id: "ultra",
    displayName: "Ultra",
    price: "$39.99/mo",
    link: "https://hypersub.withfabric.xyz/s/automod",
    maxChannels: Infinity,
    maxCasts: 250_000,
  },
  vip: {
    id: "vip",
    price: Infinity.toLocaleString(),
    displayName: "VIP",
    maxChannels: Infinity,
    maxCasts: Infinity,
  },
} as const satisfies {
  [key in PlanType]: PlanDef;
};

export type PlanDef = {
  id: PlanType;
  link?: string;
  price: string;
  displayName: string;
  maxChannels: number;
  maxCasts: number;
};

export async function getSubscriptionPlan(args: { fid: string }): Promise<{
  plan: PlanType;
  tokenId: string | null;
  expiresAt: Date | null;
}> {
  const client = clientsByChainId[base.id];
  const primeContractAddress = process.env.PRIME_CONTRACT_ADDRESS!;
  const hypersubV2ContractAddress = process.env.HYPERSUBV2_CONTRACT_ADDRESS!;

  const primeContract = getContract({
    address: getAddress(primeContractAddress),
    abi: hypersubAbi721,
    client,
  });

  const hypersubV2Contract = getContract({
    address: getAddress(hypersubV2ContractAddress),
    abi: hypersubAbiV2,
    client,
  });

  const rsp = await neynar.fetchBulkUsers([+args.fid]);

  if (rsp.users.length === 0) {
    throw new Error(`User not found: ${args.fid}`);
  }

  const user = rsp.users[0];
  for (const address of user.verified_addresses.eth_addresses) {
    const [primeSecondsRemaining, v2SecondsRemaining] = await Promise.all([
      primeContract.read.balanceOf([getAddress(address)]),
      hypersubV2Contract.read.balanceOf([getAddress(address)]),
    ]);

    if (v2SecondsRemaining > 0) {
      const subInfo = await hypersubV2Contract.read.subscriptionOf([getAddress(address)]);

      return {
        plan: subInfo.tierId === 1 ? "ultra" : "prime",
        tokenId: subInfo.tokenId.toString(),
        expiresAt: new Date(subInfo.expiresAt * 1000),
      };
    } else if (primeSecondsRemaining > 0) {
      const subInfo = await primeContract.read.subscriptionOf([getAddress(address)]);
      const tokenId = subInfo[0];

      return {
        plan: "prime",
        tokenId: tokenId.toString(),
        expiresAt: new Date(Date.now() + Number(primeSecondsRemaining * 1000n)),
      };
    }
  }

  return {
    plan: "basic",
    expiresAt: null,
    tokenId: null,
  };
}

export async function refreshAccountStatus(args: { fid: string }) {
  const user = await db.user.findFirst({
    where: {
      id: args.fid,
    },
  });

  if (user!.plan === "vip") {
    return {
      plan: "vip",
      tokenId: null,
      expiresAt: null,
    };
  }

  const plan = await getSubscriptionPlan(args);
  await db.user.update({
    where: {
      id: args.fid,
    },
    data: {
      plan: plan.plan,
      planExpiry: plan.expiresAt,
      planTokenId: plan.tokenId,
    },
  });

  return plan;
}
