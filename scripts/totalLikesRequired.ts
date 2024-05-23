/* eslint-disable @typescript-eslint/no-explicit-any */

import fs from "node:fs";

const totalUsage = fs.readFileSync("./research/mayTotalUsage.json", "utf-8");
const totalModerations = fs.readFileSync("./research/mayModerations.json", "utf-8");

const totalUsageParsed = JSON.parse(totalUsage);
const totalModerationsParsed = JSON.parse(totalModerations);

const channelSummary: any = {};

for (const channel of totalUsageParsed) {
  const channelName = channel.channelId;
  const channelModerations = totalModerationsParsed.find(
    (c: any) => c.channelId.toLowerCase() === channelName.toLowerCase()
  );

  if (!channelModerations) {
    continue;
  }

  channelSummary[channelName] = {
    total: channel.castsProcessed,
    moderations: channelModerations.count,
    likesRequired: channel.castsProcessed - channelModerations.count,
  };
}

console.log(JSON.stringify(channelSummary, null, 2));
