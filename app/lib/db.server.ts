import { PrismaClient } from "@prisma/client";

import { singleton } from "./singleton.server";
import { Action, Rule } from "./validations.server";

// Hard-code a unique key, so we can look up the client when this module gets re-imported
const db = singleton("prisma", () =>
  new PrismaClient().$extends({
    result: {
      moderatedChannel: {
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
    },
  })
);

export { db };
