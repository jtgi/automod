import { PrismaClient } from "@prisma/client";

import { singleton } from "./singleton.server";
import { Action, Rule, SelectOption } from "./validations.server";
import { Permission } from "./permissions.server";
import { RuleSet } from "./types";

// Hard-code a unique key, so we can look up the client when this module gets re-imported
const db = singleton("prisma", () =>
  new PrismaClient().$extends({
    result: {
      moderatedChannel: {
        memberRequirementsParsed: {
          needs: {
            memberRequirements: true,
          },
          compute(data): MemberRequirements | null {
            if (data.memberRequirements) {
              return JSON.parse(data.memberRequirements);
            }

            return null;
          },
        },
        inclusionRuleSetParsed: {
          needs: {
            inclusionRuleSet: true,
          },
          compute(data): (RuleSet & { ruleParsed: Rule; actionsParsed: Array<Action> }) | undefined {
            if (data.inclusionRuleSet) {
              const ruleSet = JSON.parse(data.inclusionRuleSet);
              ruleSet.ruleParsed = ruleSet.rule;
              ruleSet.actionsParsed = ruleSet.actions;
              return ruleSet;
            }
          },
        },
        exclusionRuleSetParsed: {
          needs: {
            exclusionRuleSet: true,
          },
          compute(data): (RuleSet & { ruleParsed: Rule; actionsParsed: Array<Action> }) | undefined {
            if (data.exclusionRuleSet) {
              const ruleSet = JSON.parse(data.exclusionRuleSet);
              ruleSet.ruleParsed = ruleSet.rule;
              ruleSet.actionsParsed = ruleSet.actions;
              return ruleSet;
            }
          },
        },
        excludeUsernamesParsed: {
          needs: {
            excludeUsernames: true,
          },
          compute(data): Array<SelectOption> {
            return JSON.parse(data.excludeUsernames);
          },
        },
      },
      role: {
        permissionsParsed: {
          needs: {
            permissions: true,
          },
          compute(data): Array<Permission["id"]> {
            return JSON.parse(data.permissions);
          },
        },
      },
    },
  })
);

export { db };
