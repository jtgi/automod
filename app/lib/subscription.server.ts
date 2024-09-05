import { getAddress, getContract } from "viem";
import { db } from "./db.server";
import { base } from "viem/chains";
import { hypersubAbi721, hypersubAbiV2 } from "./abis";
import { neynar } from "./neynar.server";
import { clientsByChainId } from "./viem.server";
import { PlanType } from "./utils";

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

export async function getSubscriptionPlan(args: { fid: string; walletAddress?: string }): Promise<{
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
  const addresses = [args.walletAddress, ...user.verified_addresses.eth_addresses].filter(
    Boolean
  ) as string[];
  for (const address of addresses) {
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

  if (!user) {
    return {
      plan: "basic",
      expiresAt: null,
      tokenId: null,
    };
  }

  if (user.plan === "vip") {
    return {
      plan: "vip",
      tokenId: null,
      expiresAt: null,
    };
  }

  const plan = await getSubscriptionPlan({
    fid: args.fid,
    walletAddress: user.planWalletAddress ?? undefined,
  });

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
