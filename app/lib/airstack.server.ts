/* eslint-disable @typescript-eslint/no-explicit-any */
import { gql, GraphQLClient } from "graphql-request";
import { neynar, registerWebhook } from "./neynar.server";
import { ChannelModerationDetails } from "scripts/migrateAirstack";
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

  const { data, error } = await fetchQuery(query);
  return data.FarcasterChannelParticipants.FarcasterChannelParticipant !== null;
}

export async function userSocialCapitalRank(props: { fid: number }) {
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
            farScore
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

  return Math.round(data.Socials.Social.farcasterScore.farScore);
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

        inclusionConditions.push({
          name: "userFidInRange",
          type: "CONDITION",
          args: {
            min: rule.fidRangeRule!.value,
          },
        });
        break;
      case "WHITELIST_FIDS": {
        invariant(rule.whitelistFidsRule?.fids, "WHITELIST_FIDS rule is missing fids");

        const rsp = await neynar.fetchBulkUsers(rule.whitelistFidsRule.fids.map((num) => parseInt(num)));
        automodConfig.excludeUsernames = JSON.stringify(
          rsp.users.map((user) => ({
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
        const rsp = await neynar.fetchBulkUsers(rule.coModeratorFidsRule!.fids.map(parseInt));

        await db.role.create({
          data: {
            channelId: moderatedChannel.id,
            name: "Cohost",
            isCohostRole: true,
            description: "Primary moderators for your channel.",
            permissions: JSON.stringify(permissionDefs.map((p) => p.id)),
            delegates: {
              create: rsp.users.map((comod) => ({
                fid: String(comod.fid),
                username: comod.username,
                avatarUrl: comod.pfp_url,
                channelId: moderatedChannel.id,
              })),
            },
          },
        });
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
      untilTimeUtc: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    });
  }

  return notices;
}
