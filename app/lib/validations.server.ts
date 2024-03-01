import { Cast } from "@neynar/nodejs-sdk/build/neynar-api/v2";
import isSafeRegex from "safe-regex";
import { z } from "zod";
import {
  ban,
  cooldown,
  hideQuietly,
  mute,
  warnAndHide,
} from "./warpcast.server";

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

  textMatchesPattern: {
    friendlyName: "Text Matches Pattern (Regex)",
    description: "Check if the text matches a specific pattern",
    args: {
      pattern: {
        type: "string",
        friendlyName: "Pattern",
        description:
          "The regular expression to match against. No leading or trailing slashes.",
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

  userIsNotActive: {
    friendlyName: "User Is Not Active",
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
  hidden?: boolean;
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

// TODO: Action Args!
export const actionDefinitions: Record<ActionType, ActionDefinition> = {
  mute: {
    friendlyName: "Mute",
    description:
      "All this user's casts will be silently hidden from the channel until you unmute.",
    args: {},
  },
  hideQuietly: {
    friendlyName: "Hide Quietly",
    description: "Hide the cast without notifying the user",
    args: {},
  },
  bypass: {
    friendlyName: "Bypass",
    description: "Bypass the rule and let the cast be visible",
    hidden: true,
    args: {},
  },
  ban: {
    friendlyName: "Permanent Ban",
    description: "Permanently ban them. This cannot be undone at the moment.",
    args: {},
  },
  warnAndHide: {
    friendlyName: "Warn and Hide",
    description:
      "Hide the cast and let them know it was hidden via a notification",
    args: {},
  },
  unmuted: {
    friendlyName: "Unmuted",
    description: "Unmute the user",
    hidden: true,
    args: {},
  },
  cooldownEnded: {
    friendlyName: "End Cooldown",
    description: "End the user's cooldown period",
    hidden: true,
    args: {},
  },
  cooldown: {
    friendlyName: "Cooldown",
    description:
      "New casts from this user will be automatically hidden for the duration specified.",
    args: {
      duration: {
        type: "number",
        friendlyName: "Duration (hours)",
        description: "The duration of the cool down in hours",
      },
    },
  },
} as const;

export const ruleNames = [
  "and",
  "or",
  "containsText",
  "textMatchesPattern",
  "containsTooManyMentions",
  "containsLinks",
  "userProfileContainsText",
  "userDisplayNameContainsText",
  "userFollowerCount",
  "userIsNotActive",
  "userFidInRange",
] as const;

export const actionTypes = [
  "bypass",
  "hideQuietly",
  "ban",
  "mute",
  "warnAndHide",
  "cooldown",
  "cooldownEnded",
  "unmuted",
] as const;

export type RuleName = (typeof ruleNames)[number];
export type ActionType = (typeof actionTypes)[number];

export type CheckFunction = (cast: Cast, rule: Rule) => string | undefined;
export type ActionFunction<T = any> = (args: {
  channel: string;
  cast: Cast;
  action: Action;
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
}).refine((data) => {
  if (data.name === "textMatchesPattern" && !isSafeRegex(data.args.pattern)) {
    return false;
  } else {
    return true;
  }
}, "That regex is too powerful. Please simplify it.");

const ActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("bypass") }),
  z.object({ type: z.literal("hideQuietly") }),
  z.object({ type: z.literal("ban") }),
  z.object({ type: z.literal("warnAndHide") }),
  z.object({ type: z.literal("mute") }),
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
  actionsParsed: z.array(ActionSchema).min(1),
});

export const ModeratedChannelSchema = z.object({
  id: z.string(),
  banThreshold: z.coerce.number().nullable(),
  ruleSets: z.array(RuleSetSchema).min(1),
});

export const ruleFunctions: Record<RuleName, CheckFunction> = {
  and: () => undefined,
  or: () => undefined, // TODO
  textMatchesPattern: textMatchesPattern,
  containsText: containsText,
  containsTooManyMentions: containsTooManyMentions,
  containsLinks: containsLinks,
  userProfileContainsText: userProfileContainsText,
  userDisplayNameContainsText: userDisplayNameContainsText,
  userFollowerCount: userFollowerCount,
  userIsNotActive: userIsNotActive,
  userFidInRange: userFidInRange,
};

export const actionFunctions: Record<ActionType, ActionFunction> = {
  hideQuietly: hideQuietly,
  mute: mute,
  bypass: () => Promise.resolve(),
  cooldownEnded: () => Promise.resolve(),
  unmuted: () => Promise.resolve(),
  ban: ban,
  warnAndHide: warnAndHide,
  cooldown: cooldown,
} as const;

// Rule: contains text, option to ignore case
export function containsText(cast: Cast, rule: Rule) {
  const { searchText, caseSensitive } = rule.args;

  const text = caseSensitive ? cast.text : cast.text.toLowerCase();
  const search = caseSensitive ? searchText : searchText.toLowerCase();

  if (text.includes(search)) {
    return `Text contains the text: ${searchText}`;
  }
}

export function textMatchesPattern(cast: Cast, rule: Rule) {
  const { pattern } = rule.args;
  const regex = new RegExp(pattern, "u");

  if (regex.test(cast.text)) {
    return `Text matches pattern: ${pattern}`;
  }
}

// Rule: contains too many mentions (@...)
export function containsTooManyMentions(cast: Cast, rule: Rule) {
  const { maxMentions } = rule.args;

  const mentions = cast.text.match(/@\w+/g) || [];

  if (mentions.length > maxMentions) {
    return `Too many mentions: ${mentions}. Max: ${maxMentions}`;
  }
}

export function containsLinks(cast: Cast, rule: Rule) {
  const maxLinks = rule.args.maxLinks || 0;
  const regex = /https?:\/\/\S+/gi;
  const matches = cast.text.match(regex) || [];

  if (matches.length > maxLinks) {
    return `Too many links. Max: ${maxLinks}`;
  }
}

export function userProfileContainsText(cast: Cast, rule: Rule) {
  const { searchText, caseSensitive } = rule.args;
  const containsText = !caseSensitive
    ? cast.author.profile.bio.text
        .toLowerCase()
        .includes(searchText.toLowerCase())
    : cast.author.profile.bio.text.includes(searchText);

  if (containsText) {
    return `User profile contains the specified text: ${searchText}`;
  }
}

export function userDisplayNameContainsText(cast: Cast, rule: Rule) {
  const { searchText, caseSensitive } = rule.args;
  const containsText = !caseSensitive
    ? cast.author.display_name.toLowerCase().includes(searchText.toLowerCase())
    : cast.author.display_name.includes(searchText);

  if (containsText) {
    return `User display name contains text: ${searchText}`;
  }
}

export function userFollowerCount(cast: Cast, rule: Rule) {
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
export function userIsNotActive(cast: Cast, _rule: Rule) {
  if (cast.author.active_status !== "active") {
    return `User is not active`;
  }
}

// Rule: user fid must be in range
export function userFidInRange(cast: Cast, rule: Rule) {
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
