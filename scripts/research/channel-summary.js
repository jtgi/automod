/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from "fs";
const categories = {
  ">100k": [],
  "50k-100k": [],
  "10k-50k": [],
  "5k-10k": [],
  "1k-5k": [],
  "500-1k": [],
  "<500": [],
};

const jsonData = JSON.parse(fs.readFileSync("./channel-activity.json", "utf8"));

jsonData.channels.forEach((channel) => {
  const volume = parseInt(channel.cast_count_30d, 10);
  if (volume > 100000) {
    categories[">100k"].push(channel.channel.id);
  } else if (volume > 50000) {
    categories["50k-100k"].push(channel.channel.id);
  } else if (volume > 10000) {
    categories["10k-50k"].push(channel.channel.id);
  } else if (volume > 5000) {
    categories["5k-10k"].push(channel.channel.id);
  } else if (volume > 1000) {
    categories["1k-5k"].push(channel.channel.id);
  } else if (volume > 500) {
    categories["500-1k"].push(channel.channel.id);
  } else {
    categories["<500"].push(channel.channel.id);
  }
});

// count and pct total per segment
const summary = {
  ">100k": {
    count: categories[">100k"].length,
    pct: (categories[">100k"].length / jsonData.channels.length) * 100,
  },
  "50k-100k": {
    count: categories["50k-100k"].length,
    pct: (categories["50k-100k"].length / jsonData.channels.length) * 100,
  },
  "10k-50k": {
    count: categories["10k-50k"].length,
    pct: (categories["10k-50k"].length / jsonData.channels.length) * 100,
  },
  "5k-10k": {
    count: categories["5k-10k"].length,
    pct: (categories["5k-10k"].length / jsonData.channels.length) * 100,
  },
  "1k-5k": {
    count: categories["1k-5k"].length,
    pct: (categories["1k-5k"].length / jsonData.channels.length) * 100,
  },
  "500-1k": {
    count: categories["500-1k"].length,
    pct: (categories["500-1k"].length / jsonData.channels.length) * 100,
  },

  "<500": {
    count: categories["<500"].length,
    pct: (categories["<500"].length / jsonData.channels.length) * 100,
  },
};

console.log(
  JSON.stringify(
    {
      categories,
      summary,
    },
    null,
    2
  )
);
