import { PrismaClient } from "@prisma/client";

import { singleton } from "./singleton.server";
import { Action, ActionSchema, Rule, RuleSchema } from "./validations.server";

// Hard-code a unique key, so we can look up the client when this module gets re-imported
const db = singleton("prisma", () =>
  new PrismaClient().$extends({
    result: {
      ruleSet: {
        ruleParsed: {
          needs: {
            rule: true,
          },
          compute(data): Rule {
            return RuleSchema.parse(data.rule);
          },
        },
        actionsParsed: {
          needs: {
            actions: true,
          },
          compute(data): Action {
            return ActionSchema.parse(data.actions);
          },
        },
      },
    },
  })
);

export { db };
