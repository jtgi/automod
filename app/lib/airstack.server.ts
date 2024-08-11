import { gql, GraphQLClient } from "graphql-request";
import { neynar } from "./neynar.server";

const protocolStats = new GraphQLClient(
  `https://gateway-arbitrum.network.thegraph.com/api/${process.env.GRAPH_API_KEY}/subgraphs/id/7zS29h4BDSujQq8R3TFF37JfpjtPQsRUpoC9p4vo4scx`
);

export type TokenLockWallet = {
  tokenLockWallets: [
    {
      beneficiary: string;
      id: string;
    }
  ];
};

export async function getVestingContractsForAddresses(args: { addresses: string[] }) {
  const client = new GraphQLClient(
    `https://gateway-arbitrum.network.thegraph.com/api/${process.env.GRAPH_API_KEY}/subgraphs/id/BuR6zAj2GSVZz6smGbJZkgQx8S6GUS881R493ZYZKSk3`
  );

  const query = gql`
    query MyQuery {
      tokenLockWallets(where: { beneficiary_in: ${JSON.stringify(args.addresses)} }) {
        id
        beneficiary
      }
    }
  `;

  return client.request<TokenLockWallet>(query);
}

export type SubjectTokensResponse = {
  subjectTokens: Array<{
    id: string;
    name: string;
    symbol: string;
    decimals: number;
    pfpUrl?: string;
  }>;
};

export async function searchChannelFanToken({ channelId }: { channelId: string }) {
  const query = gql`
    query MyQuery {
      subjectTokens(where: { symbol: "cid:${channelId}" }, first: 1) {
        name
        id
        symbol
        decimals
      }
    }
  `;

  const data = await protocolStats.request<SubjectTokensResponse>(query);
  console.log(`searchChannelFanToken`, { query, data });
  return data.subjectTokens.length ? data.subjectTokens[0] : null;
}

export async function searchMemberFanTokens({ username }: { username: string }) {
  const query = gql`
    query MyQuery {
      subjectTokens(where: { symbol_starts_with: "fid:", name_starts_with: "${username}" }, first: 10) {
        name
        id
        symbol
        decimals
      }
    }
  `;

  const data = (await protocolStats.request(query)) as SubjectTokensResponse;
  console.log(`searchMemberFanTokens`, { data });

  const fids = data.subjectTokens
    .filter((token) => token.symbol.includes("fid:"))
    .map((token) => Number(token.symbol.split("fid:")[1]))
    .filter(Boolean);
  const profiles = fids.length ? await neynar.fetchBulkUsers(fids).then((res) => res.users) : [];

  data.subjectTokens = data.subjectTokens.map((token) => {
    const profile = profiles.find((profile) => `fid:${profile.fid}` === token.symbol);
    return {
      ...token,
      pfpUrl: profile?.pfp_url,
    };
  });
  return data;
}
