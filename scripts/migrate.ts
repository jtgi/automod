import { db } from "~/lib/db.server";
import { Rule, RuleName } from "~/lib/validations.server";
import fs from "node:fs";

async function main() {
  fs.copyFileSync("../sqlite.db.backup", "../prisma/dev.db");
  const channels = await getChannels();

  for (const channel of channels) {
    if (channel.id === "powerbadgecabal") {
      await migratePowerBadgeCabal();
      continue;
    } else if (channel.id === "philosophy") {
      await migratePhilosophy();
      continue;
    } else if (channel.id === "lp") {
      await migrateLP();
      continue;
    } else if (channel.id === "lost-pixel-city") {
      await migrateLostPixelCity();
      continue;
    } else if (channel.id === "tabletop") {
      await migrateTabletop();
      continue;
    } else if (channel.id === "art") {
      await migrateArt();
      continue;
    } else if (channel.id === "defi") {
      await migrateDefi();
      continue;
    } else if (channel.id === "ogs") {
      await migrateOgs();
      continue;
    } else if (channel.id === "design") {
      await migrateDesign();
      continue;
    }

    if (channel.ruleSets.length > 1) {
      const isDifferent = channel.ruleSets.some((ruleSet) => {
        return ruleSet.ruleParsed.operation !== channel.ruleSets[0].ruleParsed.operation;
      });

      if (isDifferent) {
        console.log(`${channel.id}: conflict, skipping.`);
        continue;
      }
    }

    const exclusionConditions: Array<Rule> = [];
    const inclusionConditions: Array<Rule> = [];

    const exclusionSets = new Set();
    const inclusionSets = new Set();
    for (const ruleSet of channel.ruleSets) {
      if (!ruleSet.ruleParsed.conditions) {
        continue;
      }

      for (const rule of ruleSet.ruleParsed.conditions) {
        switch (rule.name) {
          case "castInThread": {
            //omit
            break;
          }
          case "containsEmbeds": {
            if (rule.invert) {
              inclusionSets.add(ruleSet.id);
              inclusionConditions.push(rule);
            } else {
              exclusionSets.add(ruleSet.id);
              exclusionConditions.push(rule);
            }
            break;
          }
          case "castLength": {
            exclusionSets.add(ruleSet.id);
            exclusionConditions.push(rule);
            break;
          }
          case "containsLinks": {
            if (rule.invert) {
              inclusionSets.add(ruleSet.id);
              inclusionConditions.push(rule);
            } else {
              exclusionConditions.push(rule);
              exclusionSets.add(ruleSet.id);
            }
            break;
          }
          case "containsText": {
            if (rule.invert) {
              inclusionSets.add(ruleSet.id);
              inclusionConditions.push(rule);
            } else {
              exclusionConditions.push(rule);
              exclusionSets.add(ruleSet.id);
            }
            break;
          }
          case "containsTooManyMentions": {
            exclusionConditions.push(rule);
            exclusionSets.add(ruleSet.id);
            break;
          }
          case "requireActiveHypersub": {
            inclusionSets.add(ruleSet.id);
            inclusionConditions.push(rule);
            break;
          }
          case "requiresErc1155": {
            inclusionSets.add(ruleSet.id);
            inclusionConditions.push(rule);
            break;
          }
          case "requiresErc20": {
            inclusionSets.add(ruleSet.id);
            inclusionConditions.push(rule);
            break;
          }
          case "requiresErc721": {
            inclusionSets.add(ruleSet.id);
            inclusionConditions.push(rule);
            break;
          }
          case "textMatchesLanguage": {
            // if (rule.invert) {
            //   inclusionSets.add(ruleSet.id);
            //   inclusionConditions.push(rule);
            // } else {
            //   exclusionConditions.push(rule);
            //   exclusionSets.add(ruleSet.id);
            // }
            //todo not reliable
            break;
          }
          case "textMatchesPattern": {
            if (rule.invert) {
              inclusionSets.add(ruleSet.id);
              inclusionConditions.push(rule);
            } else {
              exclusionConditions.push(rule);
              exclusionSets.add(ruleSet.id);
            }
            break;
          }
          case "userDisplayNameContainsText": {
            if (rule.invert) {
              inclusionSets.add(ruleSet.id);
              inclusionConditions.push(rule);
            } else {
              exclusionConditions.push(rule);
              exclusionSets.add(ruleSet.id);
            }
            break;
          }
          case "userDoesNotFollow": {
            if (rule.invert) {
              exclusionConditions.push(rule);
              exclusionSets.add(ruleSet.id);
            } else {
              inclusionSets.add(ruleSet.id);
              inclusionConditions.push(rule);
            }

            break;
          }
          case "userDoesNotHoldPowerBadge": {
            if (rule.invert) {
              exclusionConditions.push(rule);
              exclusionSets.add(ruleSet.id);
            } else {
              inclusionSets.add(ruleSet.id);
              inclusionConditions.push(rule);
            }
            break;
          }
          case "downvote": {
            exclusionConditions.push(rule);
            exclusionSets.add(ruleSet.id);
            break;
          }
          case "userFidInList": {
            if (rule.invert) {
              inclusionSets.add(ruleSet.id);
              inclusionConditions.push(rule);
            } else {
              exclusionConditions.push(rule);
              exclusionSets.add(ruleSet.id);
            }
            break;
          }
          case "userFidInRange": {
            exclusionConditions.push(rule);
            exclusionSets.add(ruleSet.id);
            break;
          }
          case "userFollowerCount": {
            exclusionConditions.push(rule);
            exclusionSets.add(ruleSet.id);
            break;
          }
          case "userIsCohost": {
            if (rule.invert) {
              inclusionSets.add(ruleSet.id);
              inclusionConditions.push(rule);
            } else {
              exclusionConditions.push(rule);
              exclusionSets.add(ruleSet.id);
            }
            break;
          }
          case "userIsNotFollowedBy": {
            if (rule.invert) {
              exclusionConditions.push(rule);
              exclusionSets.add(ruleSet.id);
            } else {
              inclusionSets.add(ruleSet.id);
              inclusionConditions.push(rule);
            }
            break;
          }
          case "userProfileContainsText": {
            if (rule.invert) {
              inclusionSets.add(ruleSet.id);
              inclusionConditions.push(rule);
            } else {
              exclusionSets.add(ruleSet.id);
              exclusionConditions.push(rule);
            }
            break;
          }
          case "and":
          case "or":
            break;
        }
      }
    }

    const ruleSet = channel.ruleSets[0];
    if (!ruleSet) {
      continue;
    }

    let operation: "AND" | "OR" | undefined;
    let name: "and" | "or";
    if (inclusionSets.size > 1) {
      const sample = channel.ruleSets.find((ruleSet) => inclusionSets.has(ruleSet.id));
      if (!sample) {
        throw new Error("no sample");
      }

      operation = "AND";
      name = "and";
    } else {
      operation = ruleSet.ruleParsed.operation === "AND" ? "OR" : "AND";
      name = ruleSet.ruleParsed.operation === "AND" ? "or" : "and";
    }

    const duplicatesAllowed: RuleName[] = [
      "requireActiveHypersub",
      "requiresErc1155",
      "requiresErc20",
      "requiresErc721",
      "userIsNotFollowedBy",
      "userDoesNotFollow",
      "containsText",
      "textMatchesLanguage",
      "textMatchesPattern",
      "userDisplayNameContainsText",
      "userProfileContainsText",
    ];

    const inclusionRule: Rule = {
      type: "LOGICAL",
      // invert because we're negating the original
      // conditions which were negative (de morgans)
      name,
      conditions: [
        ...inclusionConditions.filter((c) => duplicatesAllowed.includes(c.name)),
        ...uniqueBy(
          inclusionConditions.filter((c) => !duplicatesAllowed.includes(c.name)),
          (rule) => rule.name
        ),
      ],
      operation,
      args: {},
    };

    if (exclusionSets.size > 1) {
      const sample = channel.ruleSets.find((ruleSet) => exclusionSets.has(ruleSet.id));
      if (!sample) {
        throw new Error("no sample");
      }

      operation = "OR";
      name = "or";
    } else {
      operation = ruleSet.ruleParsed.operation === "AND" ? "AND" : "OR";
      name = operation === "AND" ? "and" : "or";
    }

    const exclusionRule: Rule = {
      type: "LOGICAL",
      name,
      operation,
      conditions: [
        ...exclusionConditions.filter((c) => duplicatesAllowed.includes(c.name)),
        ...uniqueBy(
          exclusionConditions.filter((c) => !duplicatesAllowed.includes(c.name)),
          (rule) => rule.name
        ),
      ],
      args: {},
    };

    if (inclusionRule.conditions!.length === 0 && exclusionRule.conditions!.length > 0) {
      inclusionRule.conditions?.push({
        name: "alwaysInclude",
        type: "CONDITION",
        args: {},
      });
    }

    await db.moderatedChannel.update({
      where: {
        id: channel.id,
      },
      data: {
        inclusionRuleSet: JSON.stringify({
          rule: inclusionRule,
          actions: [{ type: "like" }],
        }),
        exclusionRuleSet: JSON.stringify({
          rule: exclusionRule,
          actions: [{ type: "hideQuietly" }],
        }),
      },
    });

    console.log(`${channel.id} migrated`);
  }
}

async function getChannels() {
  return db.moderatedChannel.findMany({
    include: {
      ruleSets: true,
    },
  });
}

main();

async function migratePowerBadgeCabal() {
  await db.moderatedChannel.update({
    where: {
      id: "powerbadgecabal",
    },
    data: {
      exclusionRuleSet: JSON.stringify({
        rule: {
          name: "or",
          type: "LOGICAL",
          args: {},
          operation: "OR",
          conditions: [
            {
              name: "userFidInList",
              type: "CONDITION",
              args: {
                fids: "191637\n409561\n382192\n419741",
              },
            },
            {
              name: "containsText",
              type: "CONDITION",
              args: {
                searchText: "girthy",
              },
            },
            {
              name: "containsText",
              type: "CONDITION",
              args: {
                searchText: "cannon",
              },
            },
            {
              name: "containsText",
              type: "CONDITION",
              args: {
                searchText: "rain",
              },
            },
            {
              name: "containsText",
              type: "CONDITION",
              args: {
                searchText: "/powerfeed",
              },
            },
            {
              name: "containsText",
              type: "CONDITION",
              args: {
                searchText: "/cabal-token",
              },
            },
            {
              name: "containsText",
              type: "CONDITION",
              args: {
                searchText: "$cabal",
              },
            },
            {
              name: "containsText",
              type: "CONDITION",
              args: {
                searchText: "/powermonday",
              },
            },
            {
              name: "containsText",
              type: "CONDITION",
              args: {
                searchText: "powermonday",
              },
            },
            {
              name: "downvote",
              type: "CONDITION",
              args: {
                threshold: "1",
              },
            },
          ],
        },
        actions: [
          {
            type: "hideQuietly",
          },
        ],
      }),
      inclusionRuleSet: JSON.stringify({
        target: "all",
        rule: {
          name: "or",
          type: "LOGICAL",
          args: {},
          operation: "OR",
          conditions: [
            {
              name: "requiresErc1155",
              type: "CONDITION",
              args: {
                contractAddress: "0x14A625E63A9f46f77752E1c9ac9b1f7bB505A061",
                tokenId: "",
                chainId: "8453",
              },
            },
          ],
        },
        actions: [
          {
            type: "like",
          },
        ],
      }),
    },
  });
}

async function migratePhilosophy() {
  await db.moderatedChannel.update({
    where: {
      id: "philosophy",
    },
    data: {
      inclusionRuleSet: JSON.stringify({
        rule: {
          name: "or",
          type: "LOGICAL",
          args: {},
          operation: "OR",
          conditions: [
            {
              name: "requireActiveHypersub",
              type: "CONDITION",
              args: {
                contractAddress: "0x016E94A14968E24C8Af03Dc7EB10F9146b3dc41F",
                chainId: "8453",
              },
            },
          ],
        },
        actions: [{ type: "like" }],
      }),
      exclusionRuleSet: JSON.stringify({
        rule: {
          name: "or",
          type: "LOGICAL",
          args: {},
          operation: "OR",
          conditions: [
            {
              name: "containsText",
              type: "CONDITION",
              args: {
                searchText: "$degen",
              },
            },
            {
              name: "containsText",
              type: "CONDITION",
              args: {
                searchText: "$higher",
              },
            },
            {
              name: "containsText",
              type: "CONDITION",
              args: {
                searchText: "$enjoy",
              },
            },
            {
              name: "containsText",
              type: "CONDITION",
              args: {
                searchText: "$wowow",
              },
            },
            {
              name: "containsText",
              type: "CONDITION",
              args: {
                searchText: "wowow",
              },
            },
            {
              name: "userFollowerCount",
              type: "CONDITION",
              args: {
                min: "50",
                max: "",
              },
            },
          ],
        },
        actions: [
          {
            type: "hideQuietly",
          },
        ],
      }),
    },
  });
}

async function migrateLP() {
  await db.moderatedChannel.update({
    where: {
      id: "lp",
    },
    data: {
      inclusionRuleSet: JSON.stringify({
        rule: {
          name: "or",
          type: "LOGICAL",
          args: {},
          operation: "OR",
          conditions: [
            {
              name: "requiresErc20",
              type: "CONDITION",
              args: {
                contractAddress: "0x5b5dee44552546ecea05edea01dcd7be7aa6144a",
                minBalance: "250000",
                chainId: "8453",
              },
            },
            {
              name: "requiresErc721",
              type: "CONDITION",
              args: {
                contractAddress: "0x8ce608ce2b5004397faef1556bfe33bdfbe4696d",
                tokenId: "",
                chainId: "8453",
              },
            },
          ],
        },
        actions: [
          {
            type: "like",
          },
        ],
      }),
      exclusionRuleSet: JSON.stringify({
        rule: {
          name: "or",
          type: "LOGICAL",
          args: {},
          operation: "OR",
          conditions: [
            {
              name: "containsText",
              type: "CONDITION",
              args: {
                searchText: "casterbites.com/lp",
              },
            },
            {
              name: "containsText",
              type: "CONDITION",
              args: {
                searchText: "frame.farlaunch.xyz/activity/cast-join-cast",
              },
            },
            {
              name: "containsText",
              type: "CONDITION",
              args: {
                searchText: "frame.farlaunch.xyz/activity/cast-0305?type=DEGEN",
              },
            },
          ],
        },
        actions: [
          {
            type: "hideQuietly",
          },
        ],
      }),
    },
  });
}

async function migrateLostPixelCity() {
  await db.moderatedChannel.update({
    where: {
      id: "lost-pixel-city",
    },
    data: {
      inclusionRuleSet: JSON.stringify({
        rule: {
          name: "or",
          type: "LOGICAL",
          args: {},
          operation: "OR",
          conditions: [
            {
              name: "requiresErc1155",
              type: "CONDITION",
              args: {
                contractAddress: "0xDC9430d36a30dFD732c16C63238B31c5a84fd98e",
                tokenId: "",
                chainId: "8453",
              },
            },
          ],
        },
        actions: [
          {
            type: "like",
          },
        ],
      }),
      exclusionRuleSet: JSON.stringify({
        rule: {
          name: "or",
          type: "LOGICAL",
          args: {},
          operation: "OR",
          conditions: [],
        },
        actions: [
          {
            type: "hideQuietly",
          },
        ],
      }),
    },
  });
}

async function migrateTabletop() {
  await db.moderatedChannel.update({
    where: {
      id: "tabletop",
    },
    data: {
      inclusionRuleSet: JSON.stringify({
        rule: {
          name: "or",
          type: "LOGICAL",
          args: {},
          operation: "OR",
          conditions: [
            {
              name: "userDoesNotHoldPowerBadge",
              type: "CONDITION",
              args: {
                searchText: "",
              },
            },
            {
              name: "userIsNotFollowedBy",
              type: "CONDITION",
              args: {
                searchText: "",
                contractAddress: "",
                chainId: "8453",
                username: "ispeaknerd.eth",
              },
            },
            {
              name: "requireActiveHypersub",
              type: "CONDITION",
              args: {
                searchText: "",
                contractAddress: "0x4a314Abf12b66A7192b0AAEC23D5a7b902b2B07f",
                chainId: "8453",
              },
            },
          ],
        },
        actions: [
          {
            type: "like",
          },
        ],
      }),
      exclusionRuleSet: JSON.stringify({
        rule: {
          name: "and",
          type: "LOGICAL",
          args: {},
          operation: "AND",
          conditions: [
            {
              name: "downvote",
              type: "CONDITION",
              args: {
                searchText: "",
                min: "",
                max: "",
                threshold: "5",
              },
            },
          ],
        },
        actions: [
          {
            type: "hideQuietly",
          },
        ],
      }),
    },
  });
}

function uniqueBy<T>(arr: T[], fn: (item: T) => string) {
  const seen = new Set();
  return arr.filter((item) => {
    const key = fn(item);
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

async function migrateArt() {
  await db.moderatedChannel.update({
    where: {
      id: "art",
    },
    data: {
      exclusionRuleSet: JSON.stringify({
        rule: {
          name: "or",
          type: "LOGICAL",
          args: {},
          operation: "OR",
          conditions: [
            {
              name: "castLength",
              type: "CONDITION",
              args: {
                min: "1",
                max: "",
              },
            },
            {
              name: "containsText",
              type: "CONDITION",
              args: {
                searchText: " FIRE",
              },
            },
            {
              name: "containsText",
              type: "CONDITION",
              args: {
                searchText: "$fire",
              },
            },
            {
              name: "containsText",
              type: "CONDITION",
              args: {
                searchText: "tip",
              },
            },
            {
              name: "containsText",
              type: "CONDITION",
              args: {
                searchText: "$DEGEN",
              },
            },
            {
              name: "containsText",
              type: "CONDITION",
              args: {
                searchText: "ham",
              },
            },
            {
              name: "containsText",
              type: "CONDITION",
              args: {
                searchText: "allowance",
              },
            },
            {
              name: "containsText",
              type: "CONDITION",
              args: {
                searchText: "DRIP",
              },
            },
            {
              name: "containsText",
              type: "CONDITION",
              args: {
                searchText: "airdrop",
              },
            },
          ],
        },
        actions: [
          {
            type: "hideQuietly",
          },
        ],
      }),
      inclusionRuleSet: JSON.stringify({
        rule: {
          name: "or",
          type: "LOGICAL",
          args: {},
          operation: "OR",
          conditions: [
            {
              name: "userDoesNotHoldPowerBadge",
              type: "CONDITION",
              args: {},
            },
          ],
        },
        actions: [
          {
            type: "like",
          },
        ],
      }),
    },
  });
}

async function migrateDefi() {
  await db.moderatedChannel.update({
    where: {
      id: "defi",
    },
    data: {
      exclusionRuleSet: JSON.stringify({
        rule: {
          name: "or",
          type: "LOGICAL",
          args: {},
          operation: "OR",
          conditions: [
            {
              name: "userFidInList",
              type: "CONDITION",
              args: {
                fids: "382802",
              },
            },
          ],
        },
        actions: [
          {
            type: "hideQuietly",
          },
        ],
      }),
      inclusionRuleSet: JSON.stringify({
        rule: {
          name: "or",
          type: "LOGICAL",
          args: {},
          operation: "OR",
          conditions: [
            {
              name: "userDoesNotHoldPowerBadge",
              type: "CONDITION",
              args: {},
            },
          ],
        },
        actions: [
          {
            type: "like",
          },
        ],
      }),
    },
  });
}

async function migrateOgs() {
  await db.moderatedChannel.update({
    where: {
      id: "ogs",
    },
    data: {
      exclusionRuleSet: JSON.stringify({
        rule: {
          name: "or",
          type: "LOGICAL",
          args: {},
          operation: "OR",
          conditions: [
            {
              name: "downvote",
              type: "CONDITION",
              args: {
                threshold: "10",
              },
            },
          ],
        },
        actions: [
          {
            type: "hideQuietly",
          },
        ],
      }),
      inclusionRuleSet: JSON.stringify({
        rule: {
          name: "or",
          type: "LOGICAL",
          args: {},
          operation: "OR",
          conditions: [
            {
              name: "textMatchesPattern",
              type: "CONDITION",
              args: {
                pattern: "^🔵$",
              },
            },
          ],
        },
        actions: [
          {
            type: "like",
          },
        ],
      }),
    },
  });
}

async function migrateDesign() {
  await db.moderatedChannel.update({
    where: {
      id: "design",
    },
    data: {
      exclusionRuleSet: JSON.stringify({
        rule: {
          name: "and",
          type: "LOGICAL",
          args: {},
          operation: "AND",
          conditions: [
            {
              name: "containsEmbeds",
              type: "CONDITION",
              args: {
                domain: "",
                images: true,
                videos: true,
                frames: true,
                links: true,
                casts: true,
              },
            },
            {
              name: "castLength",
              type: "CONDITION",
              args: {
                min: "5",
                max: "",
              },
            },
          ],
        },
        actions: [
          {
            type: "hideQuietly",
          },
        ],
      }),
      inclusionRuleSet: JSON.stringify({
        rule: {
          name: "or",
          type: "LOGICAL",
          args: {},
          operation: "OR",
          conditions: [
            {
              name: "userDoesNotHoldPowerBadge",
              type: "CONDITION",
              args: {},
            },
          ],
        },
        actions: [
          {
            type: "like",
          },
        ],
      }),
    },
  });
}
