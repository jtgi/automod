import fs from "node:fs";
/**
 * 
 * 
 * query {
  GetChannelModerationDetailsPublic(
    input: {
      channelId:"airstack",
    }
  ) {
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
 */

import { getWarpcastChannels } from "~/lib/warpcast.server";
import { gql, GraphQLClient } from "graphql-request";

async function main() {
  // const allChannels = await getWarpcastChannels();
  // const channels = allChannels.filter((channel) => channel.moderatorFid === 440220);

  // console.log(
  //   "airstack channels",
  //   channels.length,
  //   channels.map((channel) => channel.id)
  // );

  const channels = [{ id: "automod" }, { id: "tmp" }, { id: "pysop" }];
  const client = new GraphQLClient(`https://bff-prod.airstack.xyz/graphql`);
  const configs = [];
  for (const channel of channels) {
    console.log(`fetching ${channel.id}`);

    const res = await client.request<ChannelModerationDetails>(gql`
      query {
        GetChannelModerationDetailsPublic(input: { channelId: "${channel.id}" }) {
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
    `);

    console.log(res);
    configs.push(res);
  }

  // fs.writeFileSync("airstack.json", JSON.stringify(configs, null, 2));
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

// TypeScript interfaces and types

interface Query {
  GetChannelModerationDetailsPublic(input: GetChannelModerationDetailsInput): ChannelModerationDetails;
}

interface GetChannelModerationDetailsInput {
  channelId: string;
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
