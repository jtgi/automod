import { Cast } from "@neynar/nodejs-sdk/build/neynar-api/v2";
import { z } from "zod";
import { ban, coolDown, hideQuietly, warnAndHide } from "./warpcast.server";

export const ruleNames = [
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

const ActionSchema = z.object({
  type: z.enum(actionTypes),
});

export type Action = z.infer<typeof ActionSchema>;

export const ruleDefinitions: Record<RuleName, CheckFunction> = {
  containsText: containsText,
  containsTooManyMentions: containsTooManyMentions,
  containsLinks: containsLinks,
  userProfileContainsText: userProfileContainsText,
  userDisplayNameContainsText: userDisplayNameContainsText,
  userFollowerCount: userFollowerCount,
  userIsActive: userIsActive,
  userFidInRange: userFidInRange,
};

export const actionDefinitions: Record<ActionType, ActionFunction> = {
  hideQuietly: hideQuietly,
  ban: ban,
  warnAndHide: warnAndHide,
  coolDown: coolDown,
} as const;

// Rule: contains text, option to ignore case
function containsText(cast: Cast, rule: Rule) {
  const { searchText, ignoreCase } = rule.args;

  const text = ignoreCase ? cast.text.toLowerCase() : cast.text;
  const search = ignoreCase ? searchText.toLowerCase() : searchText;

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
  const { searchText, ignoreCase } = rule.args;
  const containsText = ignoreCase
    ? cast.author.profile.bio.text
        .toLowerCase()
        .includes(searchText.toLowerCase())
    : cast.author.profile.bio.text.includes(searchText);

  if (containsText) {
    return `User profile contains the specified text: ${searchText}`;
  }
}

function userDisplayNameContainsText(cast: Cast, rule: Rule) {
  const { searchText, ignoreCase } = rule.args;
  const containsText = ignoreCase
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
