import axios from "axios";
import { getSetCache } from "./utils.server";
import { base, mainnet, optimism, zora } from "viem/chains";

export function nftsByWallets(props: { chains: string[]; contractAddresses: string[]; wallets: string[] }) {
  const cacheKey = `nftsByWallets:${props.chains.join(",")}:${props.contractAddresses.join(
    ","
  )}:${props.wallets.join(",")}`;

  return getSetCache({
    key: cacheKey,
    ttlSeconds: 60 * 15,
    get: async () => {
      const url = new URL(`https://api.simplehash.com/api/v0/nfts/owners`);
      url.searchParams.set("chains", props.chains.join(","));
      url.searchParams.set("contract_addresses", props.contractAddresses.join(","));
      url.searchParams.set("wallet_addresses", props.wallets.join(","));
      url.searchParams.set("count", "1");

      const rsp = await axios
        .get(url.toString(), {
          headers: {
            "X-API-KEY": process.env.SIMPLE_HASH_API_KEY!,
          },
        })
        .catch(() => console.error("oh fuck"));

      return rsp?.data || {};
    },
  });
}

export function chainIdToChainName(props: { chainId: string }) {
  const mapping: Map<string, string> = new Map([
    [String(zora.id), "zora"],
    [String(base.id), "base"],
    [String(optimism.id), "optimism"],
    [String(mainnet.id), "ethereum"],
  ]);

  return mapping.get(props.chainId);
}
