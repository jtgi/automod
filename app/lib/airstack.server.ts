/* eslint-disable @typescript-eslint/no-explicit-any */
import { gql, GraphQLClient } from "graphql-request";
import { neynar, registerWebhook } from "./neynar.server";
import { Rule } from "./validations.server";
import { getWarpcastChannel, getWarpcastChannelOwner } from "./warpcast.server";
import { ModeratedChannel } from "@prisma/client";
import invariant from "tiny-invariant";
import { db } from "./db.server";
import { permissionDefs } from "./permissions.server";

import { fetchQuery, init } from "@airstack/node";
import { recoverQueue } from "./bullish.server";

init(process.env.AIRSTACK_API_KEY!);

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
  return data.subjectTokens.length ? data.subjectTokens[0] : null;
}

export async function userFollowsChannel(props: { fid: number; channelId: string }) {
  const query = gql`
    query MyQuery {
      FarcasterChannelParticipants(
        input: {
          filter: {
            participant: { _eq: "fc_fid:${props.fid}" }
            channelId: { _eq: "${props.channelId}" }
            channelActions: { _eq: follow }
          }
          blockchain: ALL
        }
      ) {
        FarcasterChannelParticipant {
          lastActionTimestamp
        }
      }
    }
  `;

  const { data } = await fetchQuery(query);
  return !!data.FarcasterChannelParticipants?.FarcasterChannelParticipant;
}

export async function farRank(props: { fid: number }) {
  const query = gql`
    query MyQuery {
      Socials(
        input: {
          filter: { dappName: { _eq: farcaster }, identity: { _eq: "fc_fid:${props.fid}" } }
          blockchain: ethereum
        }
      ) {
        Social {
          farcasterScore {
            farRank
          }
        }
      }
    }
  `;

  const { data, error } = await fetchQuery(query);

  if (error) {
    console.error(error);
    return null;
  }

  const rank = data.Socials.Social[0]?.farcasterScore?.farRank;

  if (!rank) {
    return null;
  }

  return data.Socials.Social[0].farcasterScore.farRank;
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

export async function getChannelModerationConfig(props: { channelId: string }) {
  const client = new GraphQLClient(`https://bff-prod.airstack.xyz/graphql`);

  const query = gql`
  query {
    GetChannelModerationDetailsPublic(input: { channelId: "${props.channelId}" }) {
      channelId
      shouldEnforceAllRules
      channelModerationRules {
        ruleType
        socialCapitalRule {
          operatorType
          value
        }
        hasPowerBadgeRule {
          hasPowerBadge
        }
        followerCountRule {
          operatorType
          value
        }
        followedByOwnerRule {
          followedByOwner
        }
        followedByOwnerRule {
          followedByOwner
        }
        followsChannelRule {
          followsChannel
        }
        ownsTokensRule {
          token {
            operatorType
            tokenAddress
            tokenId
            tokenType
            blockchain
            value
          }
        }
        poapInPersonCountRule {
          operatorType
          value
        }
        poapTotalCountRule {
          operatorType
          value
        }
        poapSpecificRule {
          operatorType
          value
        }
        fidRangeRule {
          operatorType
          value
        }
        whitelistFidsRule {
          fids
        }
        bannedFidsRule {
          fids
        }
        coModeratorFidsRule {
          fids
        }
      }
    }
  }
`;

  const data = await client.request<{ GetChannelModerationDetailsPublic: ChannelModerationDetails }>(query);
  return data.GetChannelModerationDetailsPublic.channelModerationRules.length
    ? data.GetChannelModerationDetailsPublic
    : null;
}

export async function migrateModerationConfig(props: { userId: string; config: ChannelModerationDetails }) {
  // todo: convert airstack channel config to automod

  const { config } = props;
  const wcChannel = await getWarpcastChannel({ channel: props.config.channelId });
  const moderatedChannel = await db.moderatedChannel.upsert({
    where: {
      id: props.config.channelId,
    },
    create: {
      id: props.config.channelId,
      userId: props.userId,
      active: true,
      url: wcChannel.url,
      imageUrl: wcChannel.imageUrl,
      excludeCohosts: true,
    },
    update: {},
  });

  const notices: string[] = [];
  const automodConfig: Partial<ModeratedChannel> = {
    excludeCohosts: true,
  };

  const inclusionConditions: Rule[] = [];
  for (const rule of config.channelModerationRules) {
    switch (rule.ruleType) {
      case "HAS_POWER_BADGE": {
        inclusionConditions.push({
          name: "userDoesNotHoldPowerBadge",
          type: "CONDITION",
          args: {},
        });
        break;
      }

      case "FOLLOWED_BY_OWNER": {
        const ownerFid = await getWarpcastChannelOwner({ channel: config.channelId });
        const user = await neynar.fetchBulkUsers([ownerFid]).then((res) => res.users[0]);

        inclusionConditions.push({
          name: "userIsNotFollowedBy",
          type: "CONDITION",
          args: {
            users: [
              {
                label: user.username,
                value: user.fid,
                icon: user.pfp_url,
              },
            ],
          },
        });
        break;
      }

      case "FOLLOWS_CHANNEL": {
        inclusionConditions.push({
          name: "userFollowsChannel",
          type: "CONDITION",
          args: {
            channelSlug: config.channelId,
          },
        });
        break;
      }

      case "OWNS_TOKENS": {
        //miraculously nobody used tokens
        break;
      }

      case "POAP_IN_PERSON_COUNT": {
        notices.push("POAP_IN_PERSON");
        break;
      }

      case "POAP_TOTAL_COUNT":
        notices.push("POAP_TOTAL_COUNT");
        break;

      case "POAP_SPECIFIC":
        notices.push("POAP_SPECIFIC");
        break;

      case "FID_RANGE":
        // operator is always less than
        console.log({ rule });
        inclusionConditions.push({
          name: "userFidInRange",
          type: "CONDITION",
          args: {
            minFid: rule.fidRangeRule!.value,
          },
        });
        break;
      case "WHITELIST_FIDS": {
        invariant(rule.whitelistFidsRule?.fids, "WHITELIST_FIDS rule is missing fids");

        const fids = rule.whitelistFidsRule.fids.map((num: string) => parseInt(num));
        const users = [];

        for (let i = 0; i < fids.length; i += 100) {
          const batch = fids.slice(i, i + 100);
          const batchUsers = await neynar.fetchBulkUsers(batch).then((res) => res.users);
          users.push(...batchUsers);
        }

        automodConfig.excludeUsernames = JSON.stringify(
          users.map((user) => ({
            label: user.username,
            value: user.fid,
            icon: user.pfp_url,
          }))
        );
        break;
      }
      case "BANNED_FIDS":
        for (const fid of rule.bannedFidsRule?.fids ?? []) {
          await db.cooldown.upsert({
            where: {
              affectedUserId_channelId: {
                affectedUserId: fid,
                channelId: config.channelId,
              },
            },
            update: {},
            create: {
              affectedUserId: fid,
              channelId: config.channelId,
              expiresAt: null, //ban
            },
          });
        }
        break;
      case "CO_MODERATOR_FIDS": {
        const fids = rule.coModeratorFidsRule!.fids.map((n: string) => parseInt(n));
        const users = [];

        for (let i = 0; i < fids.length; i += 100) {
          const batch = fids.slice(i, i + 100);
          const batchUsers = await neynar.fetchBulkUsers(batch).then((res) => res.users);
          users.push(...batchUsers);
        }

        const cohostRole = await db.role.findFirst({
          where: {
            isCohostRole: true,
          },
        });

        if (!cohostRole) {
          await db.role.create({
            data: {
              channelId: moderatedChannel.id,
              name: "Cohost",
              isCohostRole: true,
              description: "Primary moderators for your channel.",
              permissions: JSON.stringify(permissionDefs.map((p) => p.id)),
              delegates: {
                create: users.map((comod) => ({
                  fid: String(comod.fid),
                  username: comod.username,
                  avatarUrl: comod.pfp_url,
                  channelId: moderatedChannel.id,
                })),
              },
            },
          });
        } else {
          await db.role.create({
            data: {
              channelId: moderatedChannel.id,
              name: "Cohost",
              isCohostRole: true,
              description: "Primary moderators for your channel.",
              permissions: JSON.stringify(permissionDefs.map((p) => p.id)),
              delegates: {
                create: users.map((comod) => ({
                  fid: String(comod.fid),
                  username: comod.username,
                  avatarUrl: comod.pfp_url,
                  channelId: moderatedChannel.id,
                })),
              },
            },
          });
        }
        break;
      }
      case "FOLLOWER_COUNT":
        inclusionConditions.push({
          name: "userFollowerCount",
          type: "CONDITION",
          args: {
            // "MORE_THAN" all that's supported
            max: rule.followerCountRule!.value,
          },
        });
        break;
      case "FOLLOWS_OWNER": {
        const ownerFid = await getWarpcastChannelOwner({ channel: config.channelId });
        const user = await neynar.fetchBulkUsers([ownerFid]).then((res) => res.users[0]);

        inclusionConditions.push({
          name: "userDoesNotFollow",
          type: "CONDITION",
          args: {
            users: [
              {
                label: user.username,
                value: user.fid,
                icon: user.pfp_url,
              },
            ],
          },
        });

        break;
      }
      case "SOCIAL_CAPITAL_RANK": {
        inclusionConditions.push({
          name: "airstackSocialCapitalRank",
          type: "CONDITION",
          args: {
            minRank: rule.socialCapitalRule!.value,
          },
        });
        break;
      }
      default:
        console.error(`Unknown rule type: ${rule.ruleType}`);
    }

    const inclusionRule = {
      rule: {
        name: props.config.shouldEnforceAllRules ? "and" : "or",
        type: "LOGICAL",
        args: {},
        conditions: inclusionConditions,
      },
      actions: [
        {
          type: "like",
        },
      ],
    };
    await db.moderatedChannel.update({
      where: {
        id: moderatedChannel.id,
      },
      data: {
        ...automodConfig,
        inclusionRuleSet: JSON.stringify(inclusionRule),
        exclusionRuleSet: JSON.stringify({
          rule: {},
          actions: [
            {
              type: "hideQuietly",
            },
          ],
        }),
      },
    });
  }

  await registerWebhook({
    rootParentUrl: wcChannel.url,
  });

  if (process.env.NODE_ENV === "production") {
    await recoverQueue.add("recover", {
      channelId: moderatedChannel.id,
      moderatedChannel,
      limit: 1_000,
      skipSignerCheck: true,
      untilTimeUtc: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    });
  }

  return notices;
}

export interface ChannelModerationDetails {
  channelId: string;
  shouldEnforceAllRules: boolean;
  channelModerationRules: ChannelModerationRule[];
}

interface ChannelModerationRule {
  ruleType: ChannelModerationRuleType;
  socialCapitalRule?: SocialCapitalRule;
  hasPowerBadgeRule?: HasPowerBadgeRule;
  followerCountRule?: FollowerCountRule;
  followedByOwnerRule?: FollowedByOwnerRule;
  followsOwnerRule?: FollowsOwnerRule;
  followsChannelRule?: FollowsChannelRule;
  ownsTokensRule?: OwnsTokensRule;
  poapInPersonCountRule?: PoapInPersonCountRule;
  poapTotalCountRule?: PoapTotalCountRule;
  poapSpecificRule?: PoapSpecificRule;
  fidRangeRule?: FidRangeRule;
  whitelistFidsRule?: WhitelistFidsRule;
  bannedFidsRule?: BannedFidsRule;
  coModeratorFidsRule?: CoModeratorFidsRule;
  rawRuleStructure?: Record<string, any>;
}

type ChannelModerationRuleType =
  | "SOCIAL_CAPITAL_RANK"
  | "HAS_POWER_BADGE"
  | "FOLLOWER_COUNT"
  | "FOLLOWED_BY_OWNER"
  | "FOLLOWS_OWNER"
  | "FOLLOWS_CHANNEL"
  | "OWNS_TOKENS"
  | "POAP_IN_PERSON_COUNT"
  | "POAP_TOTAL_COUNT"
  | "POAP_SPECIFIC"
  | "FID_RANGE"
  | "WHITELIST_FIDS"
  | "BANNED_FIDS"
  | "CO_MODERATOR_FIDS";

interface SocialCapitalRule {
  operatorType: SocialCapitalOperatorType;
  value: number;
}

interface HasPowerBadgeRule {
  hasPowerBadge: boolean;
}

interface FollowerCountRule {
  operatorType: FollowerCountOperatorType;
  value: number;
}

interface FollowedByOwnerRule {
  followedByOwner: boolean;
}

interface FollowsOwnerRule {
  followsOwner: boolean;
}

interface FollowsChannelRule {
  followsChannel: boolean;
}

interface OwnsTokensRule {
  token: ChannelToken[];
}

interface ChannelToken {
  operatorType: TokenOperatorType;
  tokenAddress: string;
  tokenId: string;
  tokenType: TokenType;
  blockchain: ChannelBlockchain;
  value?: number;
}

interface PoapInPersonCountRule {
  operatorType: PoapCountOperatorType;
  value: number;
}

interface PoapTotalCountRule {
  operatorType: PoapCountOperatorType;
  value: number;
}

interface PoapSpecificRule {
  operatorType: PoapSpecificOperatorType;
  value: string[]; // EventId
}

interface FidRangeRule {
  operatorType: FidRangeOperatorType;
  value: number;
}

interface WhitelistFidsRule {
  fids: string[];
}

interface BannedFidsRule {
  fids: string[];
}

interface CoModeratorFidsRule {
  fids: string[];
}

type SocialCapitalOperatorType = "GREATER_THAN" | "LESS_THAN" | "EQUAL";

type FollowerCountOperatorType = "GREATER_THAN" | "LESS_THAN" | "EQUAL";

type TokenOperatorType = "GREATER_THAN" | "LESS_THAN" | "EQUAL";

type PoapCountOperatorType = "GREATER_THAN" | "LESS_THAN" | "EQUAL";

type PoapSpecificOperatorType = "IN";

type FidRangeOperatorType = "GREATER_THAN" | "LESS_THAN" | "EQUAL";

type ChannelBlockchain = "ETHEREUM" | "BASE" | "DEGEN" | "ZORA" | "GOLD" | "HAM";

// Note: TokenType was not defined in the original schema, so we'll leave it as a placeholder
type TokenType = string; // You may want to define specific token types here if known
