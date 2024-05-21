import { results } from "./results";

const ruleMap = new Map<string, number>();
for (const result of results) {
  const rule = JSON.parse(result.rule);

  for (const condition of rule.conditions) {
    const key = condition.name;

    if (ruleMap.has(key)) {
      ruleMap.set(key, ruleMap.get(key)! + 1);
    } else {
      ruleMap.set(key, 1);
    }
  }
}

const sorted = new Map([...ruleMap.entries()].sort((a, b) => b[1] - a[1]));
console.log("Rule count:");
// print counts
for (const [key, value] of sorted) {
  console.log(value, key);
}

console.log("\n\n");

for (const result of results) {
  const rule = JSON.parse(result.rule);
  const actions = JSON.parse(result.actions);

  console.log("==============================");
  console.log("channel:", result.channelId);
  console.log("target:", result.target);
  console.log("==============================");

  for (const condition of rule.conditions) {
    console.log("rule:", condition.name);
    console.log("invert:", condition.invert === undefined ? false : condition.invert);
    console.log(
      "args: ",
      Object.entries(condition.args)
        .map(([key, value]) => `${key}: ${value}`)
        .join(", ")
    );
    console.log();
  }

  for (const action of actions) {
    console.log("action:", action.type);
    if (action.args) {
      console.log(
        "args:",
        Object.entries(action.args)
          .map(([key, value]) => `${key}: ${value}`)
          .join(", ")
      );
    }
    console.log();
  }

  console.log("\n\n");
}
