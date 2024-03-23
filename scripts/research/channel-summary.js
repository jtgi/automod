/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from "fs";
const categories = {
  ">100k": [],
  "50k-100k": [],
  "10k-50k": [],
  "5k-10k": [],
  "<5k": [],
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
  } else {
    categories["<5k"].push(channel.channel.id);
  }
});

console.log(JSON.stringify(categories, null, 2));
