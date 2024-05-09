import { createPublicClient, fallback, http } from "viem";
import { arbitrum, base, mainnet, zora, optimism } from "viem/chains";

const mainnetClient = createPublicClient({
  chain: mainnet,
  transport: http(`https://mainnet.infura.io/v3/${process.env.INFURA_PROJECT_ID}`),
});

const optimismClient = createPublicClient({
  chain: optimism,
  transport: http(`https://optimism-mainnet.infura.io/v3/${process.env.INFURA_PROJECT_ID}`),
});

const baseClient = createPublicClient({
  chain: base,
  transport: fallback(
    [
      http(process.env.BASE_RPC_URL!),
      http(process.env.BASE_RPC_URL2!),
      http(process.env.BASE_RPC_URL3!),
      http(process.env.BASE_RPC_URL4!),
    ],
    { retryCount: 5, retryDelay: 1000 }
  ),
});

const arbitrumClient = createPublicClient({
  chain: arbitrum,
  transport: http(`https://arbitrum-mainnet.infura.io/v3/${process.env.INFURA_PROJECT_ID}`),
});

const zoraClient = createPublicClient({
  chain: zora,
  transport: http(`https://rpc.zora.energy`),
});

export const clientsByChainId = {
  [String(mainnet.id)]: mainnetClient,
  [String(optimism.id)]: optimismClient,
  [String(base.id)]: baseClient,
  [String(arbitrum.id)]: arbitrumClient,
  [String(zora.id)]: zoraClient,
};

export const chainByChainId = {
  [String(mainnet.id)]: mainnet,
  [String(optimism.id)]: optimism,
  [String(base.id)]: base,
  [String(arbitrum.id)]: arbitrum,
  [String(zora.id)]: zora,
};
