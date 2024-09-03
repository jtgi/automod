import { createPublicClient, defineChain, fallback, http } from "viem";
import { arbitrum, base, mainnet, zora, optimism, polygon } from "viem/chains";

const mainnetClient = createPublicClient({
  chain: mainnet,
  transport: fallback(
    [
      http(`https://mainnet.infura.io/v3/${process.env.INFURA_PROJECT_ID}`),
      http(`https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`),
    ],
    {
      retryCount: 3,
      retryDelay: 2000,
    }
  ),
});

const optimismClient = createPublicClient({
  chain: optimism,
  transport: http(`https://optimism-mainnet.infura.io/v3/${process.env.INFURA_PROJECT_ID}`),
});

export const hamChain = defineChain({
  id: 5112,
  name: "Ham",
  nativeCurrency: {
    decimals: 18,
    name: "Ether",
    symbol: "ETH",
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.ham.fun/"],
    },
  },
  blockExplorers: {
    default: { name: "Explorer", url: "https://explorer.ham.fun" },
  },
});

const hamClient = createPublicClient({
  chain: hamChain,
  transport: http(hamChain.rpcUrls.default.http[0]),
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

const polygonClient = createPublicClient({
  chain: polygon,
  transport: http(`https://polygon-mainnet.infura.io/v3/${process.env.INFURA_PROJECT_ID}`),
});

export const clientsByChainId = {
  [String(mainnet.id)]: mainnetClient,
  [String(optimism.id)]: optimismClient,
  [String(base.id)]: baseClient,
  [String(arbitrum.id)]: arbitrumClient,
  [String(zora.id)]: zoraClient,
  [String(polygon.id)]: polygonClient,
  [String(hamChain.id)]: hamClient,
};

export const chainByChainId = {
  [String(mainnet.id)]: mainnet,
  [String(optimism.id)]: optimism,
  [String(base.id)]: base,
  [String(arbitrum.id)]: arbitrum,
  [String(zora.id)]: zora,
  [String(polygon.id)]: polygon,
  [String(hamChain.id)]: hamChain,
};
