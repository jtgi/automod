import { gql, GraphQLClient } from "graphql-request";
import { neynar } from "./neynar.server";

const airstack = new GraphQLClient(
  "https://api.studio.thegraph.com/query/23537/moxie_protocol_stats_mainnet/version/latest"
);

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

  const data = (await airstack.request(query)) as SubjectTokensResponse;
  console.log(`searchChannelFanToken`, { data });
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

  const data = (await airstack.request(query)) as SubjectTokensResponse;
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
