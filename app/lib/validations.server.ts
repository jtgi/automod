/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { detect } from "tinyld";
import * as Sentry from "@sentry/remix";
import mimeType from "mime-types";
import RE2 from "re2";
import { z } from "zod";
import {
  addToBypass,
  cooldown,
  downvote,
  getWarpcastChannelOwner,
  grantRole,
  hideQuietly,
  mute,
  warnAndHide,
} from "./warpcast.server";
import { ModeratedChannel } from "@prisma/client";
import { neynar } from "./neynar.server";
import emojiRegex from "emoji-regex";
import { clientsByChainId } from "./viem.server";
import { erc20Abi, erc721Abi, getAddress, getContract, parseUnits } from "viem";
import {
  formatHash,
  getSetCache,
  isWarpcastCastUrl,
  validateErc1155,
  validateErc20,
  validateErc721,
} from "./utils.server";
import { WebhookCast } from "./types";
import { erc1155Abi, hypersubAbi721 } from "./abis";
import { languages } from "./languages";
import { chainIdToChainName, nftsByWallets } from "./simplehash.server";
import { db } from "./db.server";
import { Cast, CastId } from "@neynar/nodejs-sdk/build/neynar-api/v2";

export type RuleDefinition = {
  name: RuleName;
  friendlyName: string;
  checkType: "user" | "cast";
  description: string;
  category: "all" | "inclusion" | "exclusion";
  invertedDescription?: string;
  hidden: boolean;
  invertable: boolean;
  args: Record<
    string,
    {
      type: string;
      defaultValue?: string | number | boolean;
      placeholder?: string;
      friendlyName: string;
      description: string;
      pattern?: string;
      required?: boolean;
      options?: Array<{ value: string; label: string; hint?: string }>;
    }
  >;
};

export const ruleDefinitions: Record<RuleName, RuleDefinition> = {
  and: {
    name: "and",
    category: "all",
    friendlyName: "And",
    checkType: "cast",
    description: "Combine multiple rules together",
    hidden: true,
    invertable: false,
    args: {},
  },

  or: {
    name: "or",
    category: "all",
    friendlyName: "Or",
    checkType: "cast",
    hidden: true,
    invertable: false,
    description: "Combine multiple rules together",
    args: {},
  },

  alwaysInclude: {
    name: "alwaysInclude",
    category: "inclusion",
    friendlyName: "Always Include",
    checkType: "cast",
    description: "Always includes the cast. Useful if you want to default all in except for a few rules.",
    hidden: false,
    invertable: false,
    args: {},
  },

  containsText: {
    name: "containsText",
    category: "all",
    friendlyName: "Contains Text",
    checkType: "cast",
    description: "Check if the text contains a specific string",
    hidden: false,
    invertable: true,
    args: {
      searchText: {
        type: "string",
        friendlyName: "Search Text",
        description: "The text to search for",
      },
      caseSensitive: {
        type: "boolean",
        friendlyName: "Case Sensitive",
        description: "If checked, 'abc' is different from 'ABC'",
      },
    },
  },

  castInThread: {
    name: "castInThread",
    category: "all",
    friendlyName: "Cast is in Thread",
    checkType: "cast",
    description: "Check if a cast is a part of a thread",
    hidden: true,
    invertable: true,
    args: {
      identifiers: {
        type: "textarea",
        friendlyName: "Warpcast Links or Thread Hashes",
        required: true,
        placeholder: "0x05cf...c9mdi\nhttps://warpcast.com/jtgi/0x05cf551b",
        description: "The first cast in the thread. One per line.",
      },
    },
  },

  containsEmbeds: {
    name: "containsEmbeds",
    category: "all",
    friendlyName: "Contains Embedded Content",
    checkType: "cast",
    description: "Check if the cast contains images, gifs, videos, frames or links",
    hidden: false,
    invertable: true,
    args: {
      images: {
        type: "boolean",
        defaultValue: true,
        friendlyName: "Images",
        description: "Check for images or gifs",
      },
      videos: {
        type: "boolean",
        defaultValue: true,
        friendlyName: "Videos",
        description: "Check for videos",
      },
      frames: {
        type: "boolean",
        defaultValue: true,
        friendlyName: "Frames",
        description: "Check for frames",
      },
      links: {
        type: "boolean",
        defaultValue: true,
        friendlyName: "Links",
        description: "Check for links",
      },
      casts: {
        type: "boolean",
        defaultValue: true,
        friendlyName: "Casts",
        description: "Check for quote casts",
      },
      domain: {
        type: "string",
        friendlyName: "Domain",
        description: "Check for embeds from a specific domain. Applies to all embeds.",
      },
    },
  },

  textMatchesPattern: {
    name: "textMatchesPattern",
    category: "all",
    friendlyName: "Matches Pattern (Regex)",
    checkType: "cast",
    description: "Check if the text matches a specific pattern",
    hidden: false,
    invertable: true,
    args: {
      pattern: {
        type: "string",
        friendlyName: "Pattern",
        required: true,
        description: "The regular expression to match against. No leading or trailing slashes.",
      },
      caseInsensitive: {
        type: "boolean",
        friendlyName: "Ignore Case",
        description: "If checked, 'abc' is the same as 'ABC'",
      },
    },
  },

  textMatchesLanguage: {
    name: "textMatchesLanguage",
    category: "all",
    friendlyName: "Matches Language",
    checkType: "cast",
    description: "Check if the text matches a specific language",
    invertedDescription: "Check if the text is any language *but* the one specified.",
    hidden: true,
    invertable: true,
    args: {
      language: {
        type: "select",
        friendlyName: "Language",
        description: "The language to check for",
        options: languages.map((l) => ({
          label: l.name,
          value: l.code,
        })),
      },
    },
  },

  castLength: {
    name: "castLength",
    category: "all",
    friendlyName: "Cast Length",
    checkType: "cast",
    description: "Check if the cast length is within a range",
    hidden: false,
    invertable: false,
    args: {
      min: {
        type: "number",
        friendlyName: "Less than",
        description: "Setting a value of 5 would trigger this rule if the length was 0 to 4 characters.",
      },
      max: {
        type: "number",
        friendlyName: "More than",
        description: "Setting a value of 10 would trigger this rule if the length was 11 or more characters.",
      },
    },
  },

  containsTooManyMentions: {
    name: "containsTooManyMentions",
    category: "all",
    friendlyName: "Contains Mentions",
    checkType: "cast",
    description: "Check if the text contains a certain amount of mentions",
    invertable: true,
    hidden: false,
    args: {
      maxMentions: {
        type: "number",
        required: true,
        friendlyName: "Max Mentions",
        placeholder: "0",
        description: "The maximum number of mentions allowed",
      },
    },
  },
  containsLinks: {
    name: "containsLinks",
    category: "all",
    friendlyName: "Contains Links",
    checkType: "cast",
    description: "Check if the text contains any links",
    hidden: false,
    invertable: true,
    args: {
      maxLinks: {
        type: "number",
        friendlyName: "Max Links",
        description: "The maximum number of links allowed",
      },
    },
  },

  downvote: {
    name: "downvote",
    category: "all",
    friendlyName: "Downvote",
    checkType: "cast",
    description: "Check if the cast has been downvoted by your community",
    hidden: false,
    invertable: false,
    args: {
      threshold: {
        type: "number",
        friendlyName: "Threshold",
        description: "A threshold of 5 means when the 5th downvote is received, the rule will be violated.",
        pattern: "[0-9]+",
      },
    },
  },

  userDoesNotFollow: {
    name: "userDoesNotFollow",
    category: "all",
    friendlyName: "Following",
    checkType: "user",
    description: "Check if the cast author follows a certain account",
    invertedDescription: "Trigger this rule when users *do* follow the account",
    hidden: false,
    invertable: true,
    args: {
      username: {
        type: "string",
        required: true,
        friendlyName: "Username",
        placeholder: "e.g. jtgi",
        pattern: "^[a-zA-Z0-9_\\.]+$",
        description: "Example: If you enter jtgi, it will check that the cast author follows jtgi.",
      },
    },
  },

  userIsNotFollowedBy: {
    name: "userIsNotFollowedBy",
    category: "all",
    friendlyName: "Followed By",
    checkType: "user",
    description: "Check if the cast author is followed by a certain account",
    invertedDescription: "Trigger this rule when user is followed by the account",
    hidden: false,
    invertable: true,
    args: {
      username: {
        type: "string",
        required: true,
        friendlyName: "Username",
        pattern: "^[a-zA-Z0-9_\\.]+$",
        placeholder: "e.g. jtgi",
        description: "Example: If you enter jtgi, it will check that jtgi follows the cast author.",
      },
    },
  },

  requireActiveHypersub: {
    name: "requireActiveHypersub",
    category: "all",
    friendlyName: "Subscribes on Hypersub",
    checkType: "user",
    description: "Check if the user has an active subscription to a hypersub.",
    hidden: false,
    invertable: true,
    args: {
      chainId: {
        type: "select",
        friendlyName: "Chain",
        description: "",
        required: true,
        options: [
          { value: "1", label: "Ethereum" },
          { value: "10", label: "Optimism" },
          { value: "8453", label: "Base" },
          { value: "7777777", label: "Zora" },
        ],
      },
      contractAddress: {
        type: "string",
        required: true,
        pattern: "0x[a-fA-F0-9]{40}",
        placeholder: "0xdead...",
        friendlyName: "Contract Address",
        description: "",
      },
    },
  },

  requiresErc20: {
    name: "requiresErc20",
    category: "all",
    friendlyName: "Holds ERC-20",
    checkType: "user",
    description: "Check that the user holds a certain amount of ERC-20 tokens in their connected wallets.",
    invertedDescription: "Check for users who do hold the ERC-20",
    hidden: false,
    invertable: true,
    args: {
      chainId: {
        type: "select",
        friendlyName: "Chain",
        description: "",
        required: true,
        options: [
          { value: "1", label: "Ethereum" },
          { value: "10", label: "Optimism" },
          { value: "8453", label: "Base" },
          { value: "7777777", label: "Zora" },
        ],
      },
      contractAddress: {
        type: "string",
        required: true,
        friendlyName: "Contract Address",
        pattern: "0x[a-fA-F0-9]{40}",
        placeholder: "0xdead...",
        description: "",
      },
      minBalance: {
        type: "string",
        required: false,
        placeholder: "Any Amount",
        friendlyName: "Minimum Balance (optional)",
        description: "",
      },
    },
  },

  requiresErc1155: {
    name: "requiresErc1155",
    category: "all",
    friendlyName: "Holds ERC-1155",
    checkType: "user",
    description: "Require users holds a certain ERC-1155 token",
    invertedDescription: "Check for users who *do* hold the ERC-1155 token",
    hidden: false,
    invertable: true,
    args: {
      chainId: {
        type: "select",
        friendlyName: "Chain",
        description: "",
        required: true,
        options: [
          { value: "1", label: "Ethereum" },
          { value: "10", label: "Optimism" },
          { value: "8453", label: "Base" },
          { value: "7777777", label: "Zora" },
        ],
      },
      contractAddress: {
        type: "string",
        required: true,
        pattern: "0x[a-fA-F0-9]{40}",
        placeholder: "0xdead...",
        friendlyName: "Contract Address",
        description: "",
      },
      tokenId: {
        type: "string",
        required: false,
        placeholder: "Any Token",
        pattern: "[0-9]+",
        friendlyName: "Token ID (optional)",
        description: "Optionally check for a specific token id, if left blank any token is valid.",
      },
    },
  },

  requiresErc721: {
    name: "requiresErc721",
    category: "all",
    friendlyName: "Holds ERC-721",
    checkType: "user",
    description: "Require users holds a certain ERC-721 token",
    invertedDescription: "Check for users who *do* hold the ERC-721 token",
    hidden: false,
    invertable: true,
    args: {
      chainId: {
        type: "select",
        friendlyName: "Chain",
        description: "",
        required: true,
        options: [
          { value: "1", label: "Ethereum" },
          { value: "10", label: "Optimism" },
          { value: "8453", label: "Base" },
          { value: "7777777", label: "Zora" },
        ],
      },
      contractAddress: {
        type: "string",
        required: true,
        pattern: "0x[a-fA-F0-9]{40}",
        placeholder: "0xdead...",
        friendlyName: "Contract Address",
        description: "",
      },
      tokenId: {
        type: "string",
        required: false,
        placeholder: "Any Token",
        pattern: "[0-9]+",
        friendlyName: "Token ID (optional)",
        description: "",
      },
    },
  },

  userDoesNotHoldPowerBadge: {
    name: "userDoesNotHoldPowerBadge",
    category: "all",
    friendlyName: "Power Badge",
    checkType: "user",
    description: "Check if the user holds a power badge",
    invertedDescription: "Check for users who *do* hold the power badge",
    hidden: false,
    invertable: true,
    args: {},
  },

  userIsCohost: {
    name: "userIsCohost",
    category: "all",
    friendlyName: "Cohosts or Owner",
    checkType: "user",
    description: "Check if the user is a cohost or owner of the channel",
    hidden: false,
    invertable: true,
    args: {},
  },

  userProfileContainsText: {
    name: "userProfileContainsText",
    category: "all",
    friendlyName: "Profile Contains Text",
    checkType: "user",
    description: "Check if the user's profile contains a specific string",
    hidden: false,

    invertable: true,
    args: {
      searchText: {
        type: "string",
        friendlyName: "Search Text",
        description: "The text to search for",
      },
      caseSensitive: {
        type: "boolean",
        friendlyName: "Case Sensitive",
        description: "If checked, 'abc' is different from 'ABC'",
      },
    },
  },
  userDisplayNameContainsText: {
    name: "userDisplayNameContainsText",
    category: "all",
    friendlyName: "User Display Name Contains Text",
    checkType: "user",
    description: "Check if the user's display name contains a specific string",
    hidden: false,

    invertable: true,
    args: {
      searchText: {
        required: true,
        type: "string",
        friendlyName: "Search Text",
        description: "The text to search for",
      },
      caseSensitive: {
        type: "boolean",
        friendlyName: "Case Sensitive",
        description: "If checked 'abc' is different from 'ABC'",
      },
    },
  },

  userFollowerCount: {
    name: "userFollowerCount",
    category: "all",
    friendlyName: "User Follower Count",
    checkType: "user",
    hidden: false,
    invertable: false,
    description: "Check if the user's follower count is within a range",
    args: {
      min: {
        type: "number",
        friendlyName: "Less than",
        placeholder: "No Minimum",
        description: "If you enter 10, the rule will trigger if the user has less than 10 followers.",
      },
      max: {
        type: "number",
        friendlyName: "More than",
        placeholder: "No Maximum",
        description: "If you enter 50, the rule will trigger if the user has more than 50 followers.",
      },
    },
  },

  userFidInList: {
    name: "userFidInList",
    category: "all",
    friendlyName: "User FID is in List",
    checkType: "user",
    description: "Check if a FID is included on the list",
    invertedDescription: "Check if a FID is not included in the list",
    hidden: false,
    invertable: true,
    args: {
      fids: {
        type: "textarea",
        friendlyName: "Farcaster User IDs",
        required: true,
        placeholder: "3179\n9887\n1220",
        description: "A list of FIDs. One per line. You can find a user's FID on their profile page.",
      },
    },
  },

  userFidInRange: {
    name: "userFidInRange",
    category: "all",
    friendlyName: "User FID",
    checkType: "user",
    description: "Check if the user's FID is within a range",
    hidden: false,
    invertable: false,
    args: {
      minFid: {
        type: "number",
        friendlyName: "Less than",
        placeholder: "No Minimum",
        description: "Setting a value of 5 would trigger this rule if the fid is 5 or above",
      },
      maxFid: {
        type: "number",
        friendlyName: "More than",
        description: "Setting a value of 10 would trigger this rule if the fid is 1 thru 10.",
      },
    },
  },
} as const;

export type ActionDefinition = {
  friendlyName: string;
  description: string;
  /**
   * Hide the action from the customer facing UI
   * Example: "Bypass" is hidden because it's a special action.
   * Note: this is prob an abstraction leak, but it's fine for now.
   */
  hidden?: boolean;
  /**
   * Whether the action can be applied to root casts, reply, or all
   * Example: "Boost" only makes sense for root.
   */
  castScope?: "root" | "reply" | "all";
  args: Record<
    string,
    | {
        type: "number" | "string" | "boolean";
        friendlyName: string;
        description: string;
        required?: boolean;
      }
    | {
        type: "radio" | "select";
        friendlyName: string;
        description: string;
        options: Array<{ value: string; label: string }>;
        required?: boolean;
      }
  >;
};

export const actionDefinitions = {
  // deprecate
  mute: {
    friendlyName: "Mute",
    hidden: true,
    castScope: "all",
    description: "All this user's casts will be silently hidden from the channel until you unmute.",
    args: {},
  },
  hideQuietly: {
    friendlyName: "Hide",
    hidden: false,
    castScope: "all",
    description: "Hide the cast from the Main feed",
    args: {},
  },
  addToBypass: {
    friendlyName: "Add to Bypass",
    hidden: true,
    castScope: "all",
    description: "Add the user to the bypass list. This will exclude them from all moderation rules.",
    args: {},
  },
  bypass: {
    friendlyName: "Bypass",
    castScope: "all",
    description: "Bypass the rule and let the cast be visible",
    hidden: true,
    args: {},
  },
  ban: {
    friendlyName: "Ban",
    hidden: false,
    castScope: "all",
    description: "Ban all future posts from appearing in the Main feed",
    args: {},
  },
  downvote: {
    friendlyName: "Downvote",
    hidden: true,
    castScope: "all",
    description:
      "Increase the downvote count. Configure a rule to trigger after a certain threshold of downvotes has been reached.",
    args: {},
  },
  like: {
    friendlyName: "Curate",
    hidden: true,
    castScope: "root",
    description: "Curate the cast into the Main feed. For root casts only.",
    args: {},
  },
  unlike: {
    friendlyName: "Hide",
    hidden: true,
    castScope: "root",
    description: "Hide the cast from the Main feed. For root casts only.",
    args: {},
  },
  warnAndHide: {
    friendlyName: "Warn and Hide",
    castScope: "all",
    hidden: true,
    description: "Hide the cast and let them know it was hidden via a notification",
    args: {},
  },
  unmuted: {
    friendlyName: "Unmuted",
    castScope: "all",
    description: "Unmute the user",
    hidden: true,
    args: {},
  },
  cooldownEnded: {
    friendlyName: "End Cooldown",
    castScope: "all",
    description: "End the user's cooldown period",
    hidden: true,
    args: {},
  },
  unhide: {
    friendlyName: "Unhide",
    castScope: "all",
    description: "Unhide the cast",
    hidden: true,
    args: {},
  },
  cooldown: {
    friendlyName: "Cooldown",
    castScope: "all",
    hidden: false,
    description: "Casts from this user will not be curated into Main for the duration specified.",
    args: {
      duration: {
        type: "number",
        friendlyName: "Duration (hours)",
        description: "The duration of the cool down in hours",
      },
    },
  },
  grantRole: {
    friendlyName: "Grant Role",
    castScope: "all",
    hidden: true,
    description: "Grant a role to a user",
    args: {
      // TODO: this needs to be dynamic, rip.
      role: {
        type: "string",
        friendlyName: "Role",
        description: "The role to grant",
      },
    },
  },
} as const satisfies Record<ActionType, ActionDefinition>;

export const ruleNames = [
  "and",
  "or",
  "alwaysInclude",
  "containsText",
  "containsEmbeds",
  "downvote",
  "castInThread",
  "textMatchesPattern",
  "textMatchesLanguage",
  "containsTooManyMentions",
  "containsLinks",
  "castLength",
  "userProfileContainsText",
  "userDisplayNameContainsText",
  "userFollowerCount",
  "userDoesNotFollow",
  "userIsNotFollowedBy",
  "userDoesNotHoldPowerBadge",
  "userFidInList",
  "userFidInRange",
  "userIsCohost",
  "requireActiveHypersub",
  "requiresErc1155",
  "requiresErc721",
  "requiresErc20",
] as const;

export const actionTypes = [
  "bypass",
  "addToBypass",
  "hideQuietly",
  "downvote",
  "ban",
  "unlike",
  "like",
  "mute",
  "warnAndHide",
  "cooldown",
  "cooldownEnded",
  "unhide",
  "unmuted",
  "grantRole",
] as const;

export type RuleName = (typeof ruleNames)[number];
export type ActionType = (typeof actionTypes)[number];

export type CheckFunctionArgs = {
  channel: ModeratedChannel;
  cast: WebhookCast;
  rule: Rule;
};

export type CheckFunctionResult = {
  result: boolean;
  message: string;
};
export type CheckFunction = (props: CheckFunctionArgs) => CheckFunctionResult | Promise<CheckFunctionResult>;
export type ActionFunction<T = any> = (args: {
  channel: string;
  cast: Cast;
  action: Action;
  options?: { executeOnProtocol?: boolean };
}) => Promise<T>;

const BaseRuleSchema = z.object({
  name: z.enum(ruleNames),
  type: z.union([z.literal("CONDITION"), z.literal("LOGICAL")]),
  args: z.record(z.any()),
  operation: z.union([z.literal("AND"), z.literal("OR")]).optional(),
  invert: z.boolean().optional(),
});

export type Rule = z.infer<typeof BaseRuleSchema> & {
  conditions?: Rule[];
};

export const RuleSchema: z.ZodType<Rule> = BaseRuleSchema.extend({
  conditions: z.lazy(() => RuleSchema.array()).optional(), // z.lazy is used for recursive schemas
})
  .refine(
    async (data) => {
      if (data.name === "castInThread") {
        const ids = data.args.identifiers.split(/\r?\n/);
        if (!ids.length) {
          return false;
        }

        for (const id of ids) {
          const cast = await neynar
            .lookUpCastByHashOrWarpcastUrl(id.trim(), isWarpcastCastUrl(id) ? "url" : "hash")
            .catch(() => false);
          return cast !== false;
        }
      } else {
        return true;
      }
    },
    {
      message: "Couldn't find that cast. Double check your identifiers.",
    }
  )
  .refine(
    async (data) => {
      if (data.name === "userFidInList") {
        const ids = data.args.fids.split(/\r?\n/);
        if (!ids.length) {
          return false;
        }

        for (const id of ids) {
          const asNumber = parseInt(id);
          if (isNaN(asNumber)) {
            return false;
          }
        }

        return true;
      } else {
        return true;
      }
    },
    {
      message: "Those FIDs look off. At least one required and they must be valid numbers.",
    }
  )
  .refine(
    (data) => {
      if (data.name === "textMatchesPattern") {
        try {
          new RE2(data.args.pattern);
        } catch (e) {
          return false;
        }

        return true;
      } else {
        return true;
      }
    },
    (value) => ({
      message: `The pattern "${value.name}" is no good. It should be javascript compatible. Backreferences and lookahead assertions are not supported.`,
    })
  )
  .refine(
    async (data) => {
      if (data.name === "requiresErc721") {
        return await validateErc721({
          chainId: data.args.chainId,
          contractAddress: data.args.contractAddress,
        });
      } else {
        return true;
      }
    },
    {
      message: "Couldn't find that ERC-721 contract. Sure you got the right chain?",
    }
  )
  .refine(
    async (data) => {
      if (data.name === "requiresErc1155") {
        return await validateErc1155({
          chainId: data.args.chainId,
          contractAddress: data.args.contractAddress,
          tokenId: data.args.tokenId,
        });
      } else {
        return true;
      }
    },
    {
      message: "Couldn't find that ERC-1155 contract. Sure you got the right chain?",
    }
  )
  .refine(
    async (data) => {
      if (data.name === "requiresErc20") {
        return await validateErc20({
          chainId: data.args.chainId,
          contractAddress: data.args.contractAddress,
        });
      } else {
        return true;
      }
    },
    {
      message: "Couldn't find that ERC-20 contract. Sure you got the right chain?",
    }
  )
  .transform(async (data) => {
    if (data.name === "castInThread") {
      const ids = data.args.identifiers.split(/\r?\n/).map((h: string) => h.trim());

      return {
        ...data,
        args: {
          ...data.args,
          identifiers: ids.join("\n"),
        },
      };
    } else {
      return data;
    }
  });

export const ActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("bypass") }),
  z.object({ type: z.literal("hideQuietly") }),
  z.object({ type: z.literal("like") }),
  z.object({ type: z.literal("unlike") }),
  z.object({ type: z.literal("ban") }),
  z.object({ type: z.literal("addToBypass") }),
  z.object({
    type: z.literal("downvote"),
    args: z.object({
      voterFid: z.string(),
      voterUsername: z.string(),
      voterAvatarUrl: z.string(),
    }),
  }),
  z.object({ type: z.literal("warnAndHide") }),
  z.object({ type: z.literal("mute") }),
  z.object({ type: z.literal("cooldownEnded") }),
  z.object({ type: z.literal("unmuted") }),
  z.object({ type: z.literal("unhide") }),
  z.object({
    type: z.literal("grantRole"),
    args: z.object({ role: z.string() }),
  }),
  z.object({
    type: z.literal("cooldown"),
    args: z.object({ duration: z.coerce.number() }),
  }),
]);

export type Action = z.infer<typeof ActionSchema>;

export const RuleSetSchema = z.object({
  id: z.string().optional(),
  target: z.enum(["all", "root", "reply"]).default("all"),
  ruleParsed: RuleSchema,
  active: z.boolean().default(true),
  actionsParsed: z.array(ActionSchema).min(1, { message: "At least one action is required." }),
});

export type RuleSetSchemaType = z.infer<typeof RuleSetSchema>;

export const ModeratedChannelSchema = z
  .object({
    id: z.string().transform((id) => id.toLowerCase()),
    banThreshold: z.coerce.number().nullable(),
    excludeUsernames: z
      .array(z.string())
      .refine((usernames) =>
        usernames
          .map((u) => u.trim())
          .every((u) => !/\s/.test(u) && u.length <= 30, {
            message: "No spaces, and no more than 30 characters.",
          })
      )
      .transform((usernames) => usernames.map((u) => u.toLowerCase().replaceAll("@", "").trim()))
      .default([]),
    excludeCohosts: z.boolean().default(true),
    ruleSets: z.array(RuleSetSchema),

    inclusionRuleSet: RuleSetSchema,
    exclusionRuleSet: RuleSetSchema,
  })
  .refine(
    (data) => {
      if (
        data.inclusionRuleSet?.ruleParsed?.conditions?.length === 0 &&
        data.exclusionRuleSet?.ruleParsed?.conditions?.length !== 0
      ) {
        return false;
      }
      return true;
    },
    {
      message:
        'You need least one rule that includes casts.\n\nIf you just want to specify what to exclude, add the "Always Include" rule.',
    }
  );

export const ruleFunctions: Record<RuleName, CheckFunction> = {
  and: () => ({ result: true, message: "And rule always passes" }),
  or: () => ({ result: true, message: "Or rule always passes" }),
  alwaysInclude: () => ({ result: true, message: "Everything included by default" }),
  textMatchesPattern: textMatchesPattern,
  textMatchesLanguage: textMatchesLanguage,
  containsText: containsText,
  containsTooManyMentions: containsTooManyMentions,
  containsLinks: containsLinks,
  containsEmbeds: containsEmbeds,
  castInThread: castInThread,
  castLength: castLength,
  downvote: downvoteRule,
  userProfileContainsText: userProfileContainsText,
  userDoesNotFollow: userFollows,
  userIsNotFollowedBy: userFollowedBy,
  userIsCohost: userIsCohostOrOwner,
  userDisplayNameContainsText: userDisplayNameContainsText,
  userFollowerCount: userFollowerCount,
  userDoesNotHoldPowerBadge: userHoldsPowerBadge,
  userFidInList: userFidInList,
  userFidInRange: userFidInRange,
  requireActiveHypersub: holdsActiveHypersub,
  requiresErc721: holdsErc721,
  requiresErc20: holdsErc20,
  requiresErc1155: holdsErc1155,
};

export const actionFunctions: Record<ActionType, ActionFunction> = {
  hideQuietly: hideQuietly,
  mute: mute,
  bypass: () => Promise.resolve(),
  addToBypass: addToBypass,
  downvote: downvote,
  cooldownEnded: () => Promise.resolve(),
  unmuted: () => Promise.resolve(),
  unhide: () => Promise.resolve(),
  ban: ban,
  like: like,
  unlike: unlike,
  warnAndHide: warnAndHide,
  cooldown: cooldown,
  grantRole: grantRole,
} as const;

export async function like(props: { cast: Cast; channel: string }) {
  const signerAlloc = await db.signerAllocation.findFirst({
    where: {
      channelId: props.channel,
    },
    include: {
      signer: true,
    },
  });

  const uuid = signerAlloc?.signer.signerUuid || process.env.NEYNAR_SIGNER_UUID!;
  console.log(`Liking with @${signerAlloc ? signerAlloc.signer.username : "automod"}, ${uuid}`);
  await neynar.publishReactionToCast(uuid, "like", props.cast.hash);
}

export async function unlike(props: { cast: Cast; channel: string }) {
  const signerAlloc = await db.signerAllocation.findFirst({
    where: {
      channelId: props.channel,
    },
    include: {
      signer: true,
    },
  });

  const uuid = signerAlloc?.signer.signerUuid || process.env.NEYNAR_SIGNER_UUID!;
  await neynar.deleteReactionFromCast(uuid, "like", props.cast.hash);
}

export async function ban({ channel, cast }: { channel: string; cast: Cast; action: Action }) {
  // indefinite cooldown
  return db.cooldown.upsert({
    where: {
      affectedUserId_channelId: {
        affectedUserId: String(cast.author.fid),
        channelId: channel,
      },
    },
    update: {
      active: true,
      expiresAt: null,
    },
    create: {
      affectedUserId: String(cast.author.fid),
      channelId: channel,
      expiresAt: null,
    },
  });
}

// Rule: contains text, option to ignore case
export function containsText(props: CheckFunctionArgs) {
  const { cast, rule } = props;
  const { searchText, caseSensitive } = rule.args;

  const text = caseSensitive ? cast.text : cast.text.toLowerCase();
  const search = caseSensitive ? searchText : searchText.toLowerCase();

  const result = text.includes(search);
  return {
    result,
    message: result ? `Cast contains "${searchText}"` : `Cast does not contain "${searchText}"`,
  };
}

export async function castInThread(args: CheckFunctionArgs) {
  const { cast, rule } = args;
  const { identifiers } = rule.args;

  const hashes = await Promise.all(
    identifiers.split(/\r?\n/).map((h: string) => {
      if (isWarpcastCastUrl(h)) {
        return getSetCache({
          key: `cast:${h}`,
          ttlSeconds: 60 * 60 * 24 * 365,
          get: () => neynar.lookUpCastByHashOrWarpcastUrl(h, "url").then((c) => c.cast.hash.toLowerCase()),
        });
      } else {
        return h.toLowerCase().trim();
      }
    })
  );

  if (!cast.thread_hash) {
    throw new Error(`Cast ${cast.hash} has not thread_hash`);
  }

  const result = hashes.includes(cast.thread_hash.toLowerCase());
  return {
    result,
    message: result
      ? `Cast is in thread ${formatHash(cast.thread_hash)}`
      : `Cast is not in thread ${formatHash(cast.thread_hash)}`,
  };
}

export async function userFidInList(args: CheckFunctionArgs) {
  const { cast, rule } = args;
  const { fids } = rule.args;

  const fidsArr = fids.split(/\r?\n/);
  const result = fidsArr.includes(String(cast.author.fid));
  return {
    result,
    message: result ? `FID #${cast.author.fid} is in the list` : `FID #${cast.author.fid} is not in the list`,
  };
}

export function castLength(args: CheckFunctionArgs) {
  const { cast, rule } = args;
  const { min, max } = rule.args as { min?: number; max?: number };

  if (min) {
    if (cast.text.length > min) {
      return {
        result: false,
        message: `Cast is greater than ${min} characters`,
      };
    }
  }

  if (max) {
    if (cast.text.length < max) {
      return {
        result: false,
        message: `Cast is less than ${max} characters`,
      };
    }
  }

  return {
    result: true,
    message: "Cast is within length limits",
  };
}

export async function downvoteRule(args: CheckFunctionArgs) {
  const { cast, rule } = args;
  const { threshold } = rule.args;

  const downvotes = await db.downvote.count({
    where: {
      castHash: cast.hash,
    },
  });

  const result = downvotes >= parseInt(threshold);
  return {
    result,
    message: result ? `Cast reached downvote threshold of ${downvotes}` : `Cast has ${downvotes} downvotes`,
  };
}

export async function containsEmbeds(args: CheckFunctionArgs) {
  const { cast, rule } = args;
  const { images, videos, frames, links, casts } = rule.args;

  const checkForEmbeds: string[] = [];
  images && checkForEmbeds.push("image");
  videos && checkForEmbeds.push("video");
  frames && checkForEmbeds.push("frame");
  links && checkForEmbeds.push("link");
  casts && checkForEmbeds.push("casts");

  let embedsFound: string[] = [];
  const embedTypesFound: string[] = [];

  const foundCasts = cast.embeds.filter((embed): embed is { cast_id: CastId } => {
    return "cast_id" in embed;
  });

  if (foundCasts.length > 0) {
    embedTypesFound.push("casts");
    embedsFound = embedsFound.concat(foundCasts.map((c) => c.cast_id.hash));
  }

  const knownImageCdnHostnames = ["imagedelivery.net", "imgur.com"];
  // even if not specified in args we always search for
  // images and videos because they may only be filtering
  // for `link` embeds in which case these need to be
  // ruled out. its also free and fast.
  const foundImages = cast.embeds.filter((embed): embed is { url: string } => {
    if ("url" in embed) {
      const url = tryParseUrl(embed.url);
      if (!url) {
        return false;
      }

      const mime = mimeType.lookup(embed.url);
      return (mime && mime.startsWith("image")) || knownImageCdnHostnames.includes(url.hostname);
    } else {
      return false;
    }
  });

  if (foundImages.length > 0) {
    embedTypesFound.push("image");
    embedsFound = embedsFound.concat(foundImages.map((i) => i.url));
  }

  const foundVideos = cast.embeds.filter((embed): embed is { url: string } => {
    if ("url" in embed) {
      const mime = mimeType.lookup(embed.url);
      return !!mime && (mime.startsWith("video") || mime.startsWith("application/vnd.apple.mpegurl"));
    } else {
      return false;
    }
  });

  if (foundVideos.length > 0) {
    embedTypesFound.push("video");
    embedsFound = embedsFound.concat(foundVideos.map((i) => i.url));
  }

  // if either is specified we need to fetch the cast
  // since a frame_url looks just like a link url.
  // its debatable whether you'd ever want to filter
  // on this but so it goes..
  if (links || frames) {
    const rsp = await neynar.fetchBulkCasts([cast.hash]);
    const castWithInteractions = rsp.result.casts[0];

    if (!castWithInteractions) {
      throw new Error(`Cast not found. Should be impossible. hash: ${cast.hash}`);
    }

    if (castWithInteractions.frames && castWithInteractions.frames.length > 0) {
      embedTypesFound.push("frame");
      embedsFound = embedsFound.concat(castWithInteractions.frames?.map((f) => f.frames_url) || []);
    }

    const remainingUrls = castWithInteractions.embeds.filter((e): e is { url: string } => {
      if ("url" in e) {
        return !embedsFound.includes(e.url);
      } else {
        return false;
      }
    });

    if (remainingUrls.length > 0) {
      embedTypesFound.push("link");
      embedsFound = embedsFound.concat(remainingUrls.map((i) => i.url));
    }
  }

  const violatingEmbeds = checkForEmbeds.filter((embedType) => embedTypesFound.includes(embedType));
  const result = violatingEmbeds.length > 0;
  return {
    result,
    message: result
      ? `Cast contains ${violatingEmbeds.join(", ")}`
      : `Cast does not contain any forbidden embeds`,
  };
}

export function textMatchesPattern(args: CheckFunctionArgs) {
  const { cast, rule } = args;
  const { pattern, caseInsensitive } = rule.args;

  const re2 = new RE2(pattern, caseInsensitive ? "i" : "");
  const isMatch = re2.test(cast.text);

  return {
    result: isMatch,
    message: isMatch ? `Cast matches pattern ${pattern}` : `Cast does not match pattern ${pattern}`,
  };
}

export function textMatchesLanguage(args: CheckFunctionArgs) {
  const { cast, rule } = args;
  const { language } = rule.args;

  if (!cast.text.length) {
    return {
      result: false,
      message: "Language detection is not available for empty casts.",
    };
  }

  try {
    new URL(cast.text);
    return {
      result: false,
      message: "URLs are not supported for language detection.",
    };
  } catch (e) {
    // not a url
  }

  const regex = emojiRegex();
  const withoutEmojis = cast.text.replaceAll(regex, "");

  if (cast.text.length < 20) {
    // model not reliable here
    return {
      result: true,
      message: "Language detection is not reliable for short casts.",
    };
  }

  const isLanguage = detect(withoutEmojis, { only: [language] }) !== "";
  return {
    result: isLanguage,
    message: isLanguage ? `Cast is in ${language}` : `Cast is not in ${language}`,
  };
}

export function containsTooManyMentions(args: CheckFunctionArgs) {
  const { cast, rule } = args;
  const { maxMentions } = rule.args;

  const mentions = cast.text.match(/@\w+/g) || [];

  const result = mentions.length > maxMentions;

  return {
    result,
    message: result ? `Too many mentions. Max is ${maxMentions}` : `Mentions are within limits`,
  };
}

export function containsLinks(args: CheckFunctionArgs) {
  const { cast, rule } = args;
  const maxLinks = rule.args.maxLinks || 0;
  const regex = /https?:\/\/\S+/gi;
  const matches = cast.text.match(regex) || [];

  const result = matches.length > maxLinks;
  return {
    result,
    message: result ? `Too many links. Max is ${maxLinks}` : `Links are within limits`,
  };
}

export function userProfileContainsText(args: CheckFunctionArgs) {
  const { cast, rule } = args;
  const { searchText, caseSensitive } = rule.args;
  const containsText = !caseSensitive
    ? cast.author.profile.bio.text?.toLowerCase().includes(searchText.toLowerCase())
    : cast.author.profile.bio.text?.includes(searchText);

  return {
    result: containsText,
    message: containsText ? `Profile contains "${searchText}"` : `Profile does not contain "${searchText}"`,
  };
}

export function userDisplayNameContainsText(args: CheckFunctionArgs) {
  const { cast, rule } = args;
  const { searchText, caseSensitive } = rule.args;

  if (!cast.author.display_name) {
    Sentry.captureMessage(`Cast author has no display name: ${cast.author.fid}`, {
      extra: {
        cast,
      },
    });

    return {
      result: false,
      message: "User has no display name",
    };
  }

  const containsText = !caseSensitive
    ? cast.author.display_name.toLowerCase().includes(searchText.toLowerCase())
    : cast.author.display_name.includes(searchText);

  return {
    result: containsText,
    message: containsText
      ? `Display name contains "${searchText}"`
      : `Display name does not contain "${searchText}"`,
  };
}

export function userFollowerCount(props: CheckFunctionArgs) {
  const { cast, rule } = props;
  const { min, max } = rule.args as { min?: number; max?: number };

  if (min) {
    if (cast.author.follower_count < min) {
      return {
        result: true,
        message: `User has less than ${min} followers`,
      };
    }
  }

  if (max) {
    if (cast.author.follower_count > max) {
      return {
        result: true,
        message: `User has more than ${max} followers`,
      };
    }
  }

  return {
    result: false,
    message: "User follower count is within limits",
  };
}

export async function userFollowedBy(args: CheckFunctionArgs) {
  const { cast, rule } = args;
  const { username } = rule.args;

  const user = await getSetCache({
    key: `followedby:${username}:${cast.author.fid}`,
    ttlSeconds: 15,
    get: () => neynar.lookupUserByUsername(username, cast.author.fid),
  });

  if (!user) {
    throw new Error(`User not found: ${username}`);
  }

  // TODO: this should be exposed an option or
  // fixed in a refactor, but for now, because
  // the check is phrased in the negative, if
  // its not inverted, assume we're going to do
  // some bad action, if it is inverted, assume
  // its a positive action (like boost).
  if (cast.author.username === username) {
    return {
      result: true,
      message: "Cast author is the same as the user being checked for follow status",
    };
  }

  const isFollowedBy = user.result.user.viewerContext?.followedBy;

  return {
    result: !!isFollowedBy,
    message: isFollowedBy ? `User is followed by ${username}` : `User is not followed by ${username}`,
  };
}

export async function userFollows(args: CheckFunctionArgs) {
  const { cast, rule } = args;
  const { username } = rule.args;

  const user = await getSetCache({
    key: `follows:${username}:${cast.author.fid}`,
    ttlSeconds: 15,
    get: () => neynar.lookupUserByUsername(username, cast.author.fid),
  });

  if (!user) {
    throw new Error(`User not found: ${username}`);
  }

  // TODO: this should be exposed an option or
  // fixed in a refactor, but for now, because
  // the check is phrased in the negative, if
  // its not inverted, assume we're going to do
  // some bad action, if it is inverted, assume
  // its a positive action (like boost).
  if (cast.author.username === username) {
    return {
      result: true,
      message: "Cast author is the same as the user being checked for follow status",
    };
  }

  const isFollowing = user.result.user.viewerContext?.following;
  return {
    result: !!isFollowing,
    message: isFollowing ? `User follows ${username}` : `User does not follow ${username}`,
  };
}

export async function userIsCohostOrOwner(args: CheckFunctionArgs) {
  const { channel } = args;

  const [isUserCohost, ownerFid] = await Promise.all([
    isCohost({
      fid: args.cast.author.fid,
      channel: channel.id,
    }),
    getWarpcastChannelOwner({ channel: channel.id }),
  ]);

  const isOwner = ownerFid === args.cast.author.fid;
  const isCohostOrOwner = isUserCohost || isOwner;

  return {
    result: isCohostOrOwner,
    message: isCohostOrOwner ? "User is a cohost or owner" : "User is not a cohost or owner",
  };
}

export function userHoldsPowerBadge(args: CheckFunctionArgs) {
  const { cast } = args;
  const author = cast.author as Cast["author"] & { power_badge: boolean };

  return {
    result: author.power_badge,
    message: author.power_badge ? "User holds a power badge" : "User does not hold a power badge",
  };
}

export async function holdsErc721(args: CheckFunctionArgs) {
  const { cast, rule } = args;
  const { chainId, contractAddress, tokenId } = rule.args;
  const client = clientsByChainId[chainId];

  if (!client) {
    throw new Error(`No client found for chainId: ${chainId}`);
  }

  let isOwner = false;
  const contract = getContract({
    address: getAddress(contractAddress),
    abi: erc721Abi,
    client,
  });

  if (tokenId) {
    isOwner = await getSetCache({
      key: `erc721-owner:${contractAddress}:${tokenId}`,
      get: async () => {
        const owner = await contract.read.ownerOf([BigInt(tokenId)]);
        return [cast.author.custody_address, ...cast.author.verifications].some(
          (address) => address.toLowerCase() === owner.toLowerCase()
        );
      },
      ttlSeconds: 60 * 60 * 2,
    });
  } else {
    for (const address of [cast.author.custody_address, ...cast.author.verifications]) {
      const balance = await getSetCache({
        key: `erc721-balance:${contractAddress}:${address}`,
        get: () => contract.read.balanceOf([getAddress(address)]),
        ttlSeconds: 60 * 60 * 2,
      });

      if (balance > 0) {
        isOwner = true;
        break;
      }
    }
  }

  return {
    result: isOwner,
    message: isOwner
      ? `User holds ERC-721 (${formatHash(contractAddress)})`
      : `User does not hold ERC-721 (${formatHash(contractAddress)})`,
  };
}

export async function holdsActiveHypersub(args: CheckFunctionArgs) {
  const { cast, rule } = args;
  const { chainId, contractAddress } = rule.args;
  const client = clientsByChainId[chainId];

  if (!client) {
    throw new Error(`No client found for chainId: ${chainId}`);
  }

  let isSubscribed = false;
  const contract = getContract({
    address: getAddress(contractAddress),
    abi: hypersubAbi721,
    client,
  });

  for (const address of [cast.author.custody_address, ...cast.author.verifications]) {
    const balance = await getSetCache({
      key: `hypersub:${contractAddress}:${address}`,
      get: () => contract.read.balanceOf([getAddress(address)]),
      ttlSeconds: 60 * 60 * 2,
    });

    if (balance > 0) {
      isSubscribed = true;
      break;
    }
  }

  return {
    result: isSubscribed,
    message: isSubscribed
      ? `User holds an active hypersub (${formatHash(contractAddress)})`
      : `User does not hold an active hypersub (${formatHash(contractAddress)})`,
  };
}

export async function holdsErc1155(args: CheckFunctionArgs) {
  const { cast, rule } = args;
  const { chainId, contractAddress, tokenId } = rule.args;
  const client = clientsByChainId[chainId];

  if (!client) {
    throw new Error(`No client found for chainId: ${chainId}`);
  }

  if (!tokenId) {
    const chain = chainIdToChainName({ chainId });

    if (!chain) {
      throw new Error(`No chain found for chainId: ${chainId}`);
    }

    const nfts = await nftsByWallets({
      wallets: [cast.author.custody_address, ...cast.author.verifications.filter((v) => v.startsWith("0x"))],
      contractAddresses: [contractAddress],
      chains: [chain],
    });

    const isOwner = nfts.count && nfts.count > 0;
    return {
      result: isOwner,
      message: isOwner
        ? `User holds ERC-1155 (${formatHash(contractAddress)})`
        : `User does not hold ERC-1155 (${formatHash(contractAddress)})`,
    };
  } else {
    const contract = getContract({
      address: getAddress(contractAddress),
      abi: erc1155Abi,
      client,
    });

    let isOwner = false;
    for (const address of [cast.author.custody_address, ...cast.author.verifications]) {
      const balance = await getSetCache({
        key: `erc1155-${contractAddress}-${address}-${tokenId}`,
        get: () => contract.read.balanceOf([getAddress(address), BigInt(tokenId)]),
        ttlSeconds: 60 * 60 * 2,
      });

      if (balance > 0) {
        isOwner = true;
        break;
      }
    }

    return {
      result: isOwner,
      message: isOwner
        ? `User holds ERC-1155 (${formatHash(contractAddress)}), Token #${tokenId}`
        : `User does not hold ERC-1155 (${formatHash(contractAddress)}), Token #${tokenId}`,
    };
  }
}

export async function holdsErc20(args: CheckFunctionArgs) {
  const { cast, rule } = args;
  const { chainId, contractAddress, minBalance } = rule.args;
  const client = clientsByChainId[chainId];

  if (!client) {
    throw new Error(`No client found for chainId: ${chainId}`);
  }

  const cacheKey = `erc20-balance:${contractAddress}:${minBalance}:${
    cast.author.custody_address
  }:${cast.author.verifications.join(`,`)}`;

  const { result: hasEnough } = await getSetCache({
    key: cacheKey,
    get: async () =>
      verifyErc20Balance({
        wallets: [cast.author.custody_address, ...cast.author.verifications],
        chainId,
        contractAddress,
        minBalanceRequired: minBalance,
      }),
    ttlSeconds: 60 * 60 * 2,
  });

  return {
    result: hasEnough,
    message: hasEnough
      ? `User holds ERC-20 (${formatHash(contractAddress)})`
      : `User does not hold enough ERC-20 (${formatHash(contractAddress)})`,
  };
}

export async function verifyErc20Balance({
  wallets,
  chainId,
  contractAddress,
  minBalanceRequired,
}: {
  wallets: string[];
  chainId: string;
  contractAddress: string;
  minBalanceRequired?: string;
}) {
  const client = clientsByChainId[chainId];
  const contract = getContract({
    address: getAddress(contractAddress),
    abi: erc20Abi,
    client,
  });

  const balances = (await Promise.all(
    wallets.map((add) => contract.read.balanceOf([getAddress(add)]))
  )) as bigint[];
  const decimals = await contract.read.decimals();
  const minBalanceBigInt = parseUnits(minBalanceRequired ?? "0", decimals);
  const sum = balances.reduce((a, b) => a + b, BigInt(0));

  return {
    result: sum >= minBalanceBigInt && sum > BigInt(0),
    balance: sum,
    contract,
  };
}

// Rule: user fid must be in range
export function userFidInRange(args: CheckFunctionArgs) {
  const { cast, rule } = args;
  const { minFid, maxFid } = rule.args as { minFid?: number; maxFid?: number };

  // if (minFid && maxFid && maxFid < minFid) {
  //   if (cast.author.fid > maxFid && cast.author.fid < minFid) {
  //     return {
  //       result: true,
  //       message: `FID #${cast.author.fid} is within range`,
  //     };
  //   }
  // }

  if (minFid) {
    if (cast.author.fid < minFid) {
      return {
        result: false,
        message: `FID #${cast.author.fid} is less than ${minFid}`,
      };
    }
  }

  if (maxFid) {
    if (cast.author.fid > maxFid) {
      return {
        result: false,
        message: `FID #${cast.author.fid} is greater than ${maxFid}`,
      };
    }
  }

  return {
    result: true,
    message: `FID #${cast.author.fid} is within range`,
  };
}

function tryParseUrl(url: string) {
  try {
    return new URL(url);
  } catch (e) {
    return undefined;
  }
}

export async function isCohost(props: { fid: number; channel: string }) {
  const role = await db.role.findFirst({
    where: {
      channelId: props.channel,
      isCohostRole: true,
    },
    include: {
      delegates: true,
    },
  });

  if (!role) {
    return false;
  }

  return role.delegates.some((d) => d.fid === String(props.fid));
}
