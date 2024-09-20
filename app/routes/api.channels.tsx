import { json, LoaderFunctionArgs } from "@remix-run/node";
import { db } from "~/lib/db.server";
import { Rule, ruleDefinitions } from "~/lib/validations.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const channel = await db.moderatedChannel.findMany({});

  const channels = channel.map((channel) => {
    const {
      id,
      createdAt,
      updatedAt,
      active,
      imageUrl,
      url,
      feedType,
      userId,
      slowModeHours,
      excludeCohosts,
      excludeUsernamesParsed,
      inclusionRuleSetParsed,
      exclusionRuleSetParsed,
    } = channel;

    return {
      id,
      createdAt,
      updatedAt,
      active,
      imageUrl,
      url,
      feedType,
      userId,
      slowModeHours,
      excludeCohosts,
      excludeUsers: excludeUsernamesParsed,
      membershipRequirements: filterUserRules(inclusionRuleSetParsed?.ruleParsed),
      inclusionRuleSet: inclusionRuleSetParsed?.ruleParsed,
      exclusionRuleSet: exclusionRuleSetParsed?.ruleParsed,
    };
  });

  return json({
    results: channels,
    meta: {
      total: channels.length,
    },
  });
}

export function filterUserRules(rule: Rule | undefined) {
  if (!rule || !rule.conditions) {
    return rule;
  }

  const userScopedRules: Rule[] = [];

  for (const cond of rule.conditions) {
    const ruleDef = ruleDefinitions[cond.name];
    if (ruleDef.checkType === "user") {
      userScopedRules.push(cond);
    }
  }

  return {
    ...rule,
    conditions: userScopedRules,
  };
}
