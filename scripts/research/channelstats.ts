import fs from "fs";
import path from "path";

interface Channel {
  id: string;
  name: string;
  moderatorFid?: number;
  followerCount: number;
}

interface ChannelData {
  result: {
    channels: Channel[];
  };
}

function calculateChannelStats() {
  const filePath = path.join(process.cwd(), "scripts", "research", "allchannels.json");
  const rawData = fs.readFileSync(filePath, "utf8");
  const data: ChannelData = JSON.parse(rawData);
  const channels = data.result.channels;

  const totalChannels = channels.length;
  const channelsWithModerator = channels.filter((c) => c.moderatorFid !== undefined);
  const totalChannelsWithModerator = channelsWithModerator.length;

  const moderatorCounts: { [key: number]: number } = {};
  channelsWithModerator.forEach((c) => {
    if (c.moderatorFid) {
      moderatorCounts[c.moderatorFid] = (moderatorCounts[c.moderatorFid] || 0) + 1;
    }
  });

  const followerBuckets = [0, 100, 1000, 10000, 100000, Infinity];
  const bucketCounts = Array(followerBuckets.length).fill(0);
  const bucketModeratorCounts = Array(followerBuckets.length).fill(0);

  channels.forEach((c) => {
    const bucketIndex = followerBuckets.findIndex((b) => c.followerCount < b) - 1;
    bucketCounts[bucketIndex]++;
    if (c.moderatorFid !== undefined) {
      bucketModeratorCounts[bucketIndex]++;
    }
  });

  // Generate CSV content
  let csvContent = "Statistic,Value\n";
  csvContent += `Total Channels,${totalChannels}\n`;
  csvContent += `Channels with Moderator,${totalChannelsWithModerator}\n\n`;

  csvContent += "Moderator FID,Channel Count\n";
  Object.entries(moderatorCounts).forEach(([fid, count]) => {
    csvContent += `${fid},${count}\n`;
  });
  csvContent += "\n";

  csvContent += "Follower Range,Total Channels,Channels with Moderator,Percentage\n";
  for (let i = 0; i < followerBuckets.length - 1; i++) {
    const lowerBound = followerBuckets[i];
    const upperBound = followerBuckets[i + 1];
    const totalInBucket = bucketCounts[i];
    const moderatorInBucket = bucketModeratorCounts[i];
    const percentage = ((moderatorInBucket / totalInBucket) * 100).toFixed(2);
    csvContent += `${lowerBound}-${
      upperBound === Infinity ? "∞" : upperBound
    },${totalInBucket},${moderatorInBucket},${percentage}%\n`;
  }

  // Write CSV to file
  const outputPath = path.join(process.cwd(), "scripts", "research", "channel_stats.csv");
  fs.writeFileSync(outputPath, csvContent);
  console.log(`CSV file has been written to ${outputPath}`);
}

calculateChannelStats();
