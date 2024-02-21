import { Cast } from "@neynar/nodejs-sdk/build/neynar-api/v2";
import { z } from "zod";
import { ban, coolDown, hideQuietly, warnAndHide } from "./warpcast.server";

export type RuleDefinition = {
  friendlyName: string;
  description: string;
  hidden?: boolean;
  args: Record<
    string,
    {
      type: string;
      friendlyName: string;
      description: string;
      required?: boolean;
    }
  >;
};

export const ruleDefinitions: Record<RuleName, RuleDefinition> = {
  and: {
    friendlyName: "And",
    description: "Combine multiple rules together",
    hidden: true,
    args: {},
  },

  or: {
    friendlyName: "Or",
    hidden: true,
    description: "Combine multiple rules together",
    args: {},
  },

  containsText: {
    friendlyName: "Contains Text",
    description: "Check if the text contains a specific string",
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
  containsTooManyMentions: {
    friendlyName: "Contains Too Many Mentions",
    description: "Check if the text contains too many mentions",
    args: {
      maxMentions: {
        type: "number",
        required: true,
        friendlyName: "Max Mentions",
        description: "The maximum number of mentions allowed",
      },
    },
  },
  containsLinks: {
    friendlyName: "Contains Links",
    description: "Check if the text contains any links",
    args: {
      maxLinks: {
        type: "number",
        friendlyName: "Max Links",
        description: "The maximum number of links allowed",
      },
    },
  },
  userProfileContainsText: {
    friendlyName: "User Profile Contains Text",
    description: "Check if the user's profile contains a specific string",
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
    friendlyName: "User Display Name Contains Text",
    description: "Check if the user's display name contains a specific string",
    args: {
      searchText: {
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
    friendlyName: "User Follower Count",
    description: "Check if the user's follower count is within a range",
    args: {
      min: {
        type: "number",
        friendlyName: "Min",
        description: "The minimum number of followers",
      },
      max: {
        type: "number",
        friendlyName: "Max",
        description: "The maximum number of followers",
      },
    },
  },

  userIsActive: {
    friendlyName: "User Is Active",
    description: "Check if the user is active",
    args: {},
  },

  userFidInRange: {
    friendlyName: "User FID In Range",
    description: "Check if the user's FID is within a range",
    args: {
      minFid: {
        type: "number",
        friendlyName: "Min FID",
        description: "The minimum FID",
      },
      maxFid: {
        type: "number",
        friendlyName: "Max FID",
        description: "The maximum FID",
      },
    },
  },
} as const;

export type ActionDefinition = {
  friendlyName: string;
  description: string;
  args: Record<
    string,
    {
      type: string;
      friendlyName: string;
      description: string;
    }
  >;
};

// TODO: Action Args!
export const actionDefinitions: Record<ActionType, ActionDefinition> = {
  hideQuietly: {
    friendlyName: "Hide Quietly",
    description: "Hide the cast without notifying the user",
    args: {},
  },
  ban: {
    friendlyName: "Ban",
    description: "Ban the user",
    args: {},
  },
  warnAndHide: {
    friendlyName: "Warn and Hide",
    description: "Warn the user and hide the cast",
    args: {
      // warnMessage: {
      //   type: "string",
      //   friendlyName: "Warn Message",
      //   description: "The message to send to the user",
      // },
    },
  },
  coolDown: {
    friendlyName: "Cool Down",
    description: "Hide the user's casts for a period of time",
    hidden: true,
    args: {
      // duration: {
      //   type: "number",
      //   friendlyName: "Minutes",
      //   description: "The duration of the cool down in minutes",
      // },
    },
  },
} as const;

export const ruleNames = [
  "and",
  "or",
  "containsText",
  "containsTooManyMentions",
  "containsLinks",
  "userProfileContainsText",
  "userDisplayNameContainsText",
  "userFollowerCount",
  "userIsActive",
  "userFidInRange",
] as const;

export const actionTypes = [
  "hideQuietly",
  "ban",
  "warnAndHide",
  "coolDown",
] as const;

export type RuleName = (typeof ruleNames)[number];
export type ActionType = (typeof actionTypes)[number];

export type CheckFunction = (cast: Cast, rule: Rule) => string | undefined;
export type ActionFunction<T = any> = (args: {
  channel: string;
  cast: Cast;
}) => Promise<T>;

const BaseRuleSchema = z.object({
  name: z.enum(ruleNames),
  type: z.union([z.literal("CONDITION"), z.literal("LOGICAL")]),
  args: z.record(z.any()),
  operation: z.union([z.literal("AND"), z.literal("OR")]).optional(),
});

export type Rule = z.infer<typeof BaseRuleSchema> & {
  conditions?: Rule[];
};

export const RuleSchema: z.ZodType<Rule> = BaseRuleSchema.extend({
  conditions: z.lazy(() => RuleSchema.array()).optional(), // z.lazy is used for recursive schemas
});

export const ActionSchema = z.object({
  type: z.enum(actionTypes),
});

export type Action = z.infer<typeof ActionSchema>;

export const ruleFunctions: Record<RuleName, CheckFunction> = {
  and: () => undefined,
  or: () => undefined, // TODO
  containsText: containsText,
  containsTooManyMentions: containsTooManyMentions,
  containsLinks: containsLinks,
  userProfileContainsText: userProfileContainsText,
  userDisplayNameContainsText: userDisplayNameContainsText,
  userFollowerCount: userFollowerCount,
  userIsActive: userIsActive,
  userFidInRange: userFidInRange,
};

export const actionFunctions: Record<ActionType, ActionFunction> = {
  hideQuietly: hideQuietly,
  ban: ban,
  warnAndHide: warnAndHide,
  coolDown: coolDown,
} as const;

// Rule: contains text, option to ignore case
function containsText(cast: Cast, rule: Rule) {
  const { searchText, caseSensitive } = rule.args;

  const text = caseSensitive ? cast.text.toLowerCase() : cast.text;
  const search = caseSensitive ? searchText.toLowerCase() : searchText;

  if (text.includes(search)) {
    return `Text contains the text: ${searchText}`;
  }
}

// Rule: contains too many mentions (@...)
function containsTooManyMentions(cast: Cast, rule: Rule) {
  const { maxMentions } = rule.args;

  const mentions = cast.text.match(/@\w+/g) || [];

  if (mentions.length > maxMentions) {
    return `Too many mentions: ${mentions}. Max: ${maxMentions}`;
  }
}

// Rule: contains links
function containsLinks(cast: Cast, _rule: Rule) {
  const regex = /https?:\/\/\S+/i;
  if (regex.test(cast.text)) {
    return `Text contains a link: ${cast.text.match(regex)}`;
  }
}

function userProfileContainsText(cast: Cast, rule: Rule) {
  const { searchText, caseSensitive } = rule.args;
  const containsText = caseSensitive
    ? cast.author.profile.bio.text
        .toLowerCase()
        .includes(searchText.toLowerCase())
    : cast.author.profile.bio.text.includes(searchText);

  if (containsText) {
    return `User profile contains the specified text: ${searchText}`;
  }
}

function userDisplayNameContainsText(cast: Cast, rule: Rule) {
  const { searchText, caseSensitive } = rule.args;
  const containsText = caseSensitive
    ? cast.author.display_name.toLowerCase().includes(searchText.toLowerCase())
    : cast.author.display_name.includes(searchText);

  if (containsText) {
    return `User display name contains text: ${searchText}`;
  }
}

function userFollowerCount(cast: Cast, rule: Rule) {
  const { min, max } = rule.args as { min?: number; max?: number };

  if (min) {
    if (cast.author.follower_count < min) {
      return `Follower count less than ${min}`;
    }
  }

  if (max) {
    if (cast.author.follower_count > max) {
      return `Follower count greater than ${max}`;
    }
  }
}

// Rule: user active_status must be active
function userIsActive(cast: Cast, _rule: Rule) {
  if (cast.author.active_status !== "active") {
    return `User is not active`;
  }
}

// Rule: user fid must be in range
function userFidInRange(cast: Cast, rule: Rule) {
  const { minFid, maxFid } = rule.args as { minFid?: number; maxFid?: number };

  if (minFid) {
    if (cast.author.fid < minFid) {
      return `FID ${cast.author.fid} is less than ${minFid}`;
    }
  }

  if (maxFid) {
    if (cast.author.fid > maxFid) {
      return `FID ${cast.author.fid} is greater than ${maxFid}`;
    }
  }
}
