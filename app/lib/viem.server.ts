import { createPublicClient, http } from "viem";
import { arbitrum, base, mainnet, zora, optimism } from "viem/chains";

const mainnetClient = createPublicClient({
  chain: mainnet,
  transport: http(
    `https://mainnet.infura.io/v3/${process.env.INFURA_PROJECT_ID}`
  ),
});

const optimismClient = createPublicClient({
  chain: optimism,
  transport: http(
    `https://optimism-mainnet.infura.io/v3/${process.env.INFURA_PROJECT_ID}`
  ),
});

const baseClient = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_RPC_URL!),
});

const arbitrumClient = createPublicClient({
  chain: arbitrum,
  transport: http(
    `https://arbitrum-mainnet.infura.io/v3/${process.env.INFURA_PROJECT_ID}`
  ),
});

const zoraClient = createPublicClient({
  chain: zora,
  transport: http(
    `https://rpc.zora.energy`
  ),
});



export const clientsByChainId = {
  [String(mainnet.id)]: mainnetClient,
  [String(optimism.id)]: optimismClient,
  [String(base.id)]: baseClient,
  [String(arbitrum.id)]: arbitrumClient,
  [String(zora.id)]: zoraClient
};

export const chainByChainId = {
  [String(mainnet.id)]: mainnet,
  [String(optimism.id)]: optimism,
  [String(base.id)]: base,
  [String(arbitrum.id)]: arbitrum,
  [String(zora.id)]: zora
};
