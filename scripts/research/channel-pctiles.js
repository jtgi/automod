import fs from "fs";
const jsonData = JSON.parse(fs.readFileSync("./channel-activity.json", "utf8"));

const castCounts = jsonData.channels.map((channel) => parseInt(channel.cast_count_30d, 10));

// Sort the array to prepare for percentile calculation
castCounts.sort((a, b) => a - b);

// Function to calculate percentile
function percentile(arr, p) {
  if (arr.length === 0) return 0;
  if (p === 0) return arr[0];
  if (p === 1) return arr[arr.length - 1];

  const index = (arr.length - 1) * p,
    lower = Math.floor(index),
    upper = lower + 1,
    weight = index % 1;

  if (upper >= arr.length) return arr[lower];
  return arr[lower] * (1 - weight) + arr[upper] * weight;
}

// Calculate percentiles to define boundaries
const p25 = percentile(castCounts, 0.25);
const p50 = percentile(castCounts, 0.5);
const p75 = percentile(castCounts, 0.75);

// Categorizing based on calculated percentiles
const categories = {
  "0-25%": [],
  "25-50%": [],
  "50-75%": [],
  "75-100%": [],
};

jsonData.channels.forEach((channel) => {
  const volume = parseInt(channel.cast_count_30d, 10);
  if (volume <= p25) {
    categories["0-25%"].push(channel.channel.id);
  } else if (volume <= p50) {
    categories["25-50%"].push(channel.channel.id);
  } else if (volume <= p75) {
    categories["50-75%"].push(channel.channel.id);
  } else {
    categories["75-100%"].push(channel.channel.id);
  }
});

console.log(JSON.stringify(categories, null, 2));
