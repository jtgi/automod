import { PrismaClient, RuleSet } from "@prisma/client";

import { singleton } from "./singleton.server";
import { Action, Rule, RuleSetSchema, RuleSetSchemaType } from "./validations.server";
import { Permission } from "./permissions.server";

// Hard-code a unique key, so we can look up the client when this module gets re-imported
const db = singleton("prisma", () =>
  new PrismaClient().$extends({
    result: {
      moderatedChannel: {
        inclusionRuleSetParsed: {
          needs: {
            inclusionRuleSet: true,
          },
          compute(data): (RuleSet & { ruleParsed: Rule; actionsParsed: Array<Action> }) | undefined {
            console.log("inclusionrset", data.inclusionRuleSet);
            if (data.inclusionRuleSet) {
              const ruleSet = JSON.parse(data.inclusionRuleSet);
              ruleSet.ruleParsed = JSON.parse(ruleSet.rule);
              ruleSet.actionsParsed = JSON.parse(ruleSet.actions);
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
              ruleSet.ruleParsed = JSON.parse(ruleSet.rule);
              ruleSet.actionsParsed = JSON.parse(ruleSet.actions);
              return ruleSet;
            }
          },
        },
        excludeUsernamesParsed: {
          needs: {
            excludeUsernames: true,
          },
          compute(data): string[] {
            return JSON.parse(data.excludeUsernames);
          },
        },
      },
      ruleSet: {
        ruleParsed: {
          needs: {
            rule: true,
          },
          compute(data): Rule {
            return JSON.parse(data.rule);
            // return RuleSchema.parse(JSON.parse(data.rule));
          },
        },
        actionsParsed: {
          needs: {
            actions: true,
          },
          compute(data): Action {
            return JSON.parse(data.actions);
            // return ActionSchema.parse(JSON.parse(data.actions));
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
