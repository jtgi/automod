#! /usr/bin/env node

import process from "process";

function main() {
  let input = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("readable", () => {
    let chunk;
    while ((chunk = process.stdin.read())) {
      input += chunk;
    }
  });

  process.stdin.on("end", () => {
    const payload = JSON.parse(input);
    const stats = processPayload(payload);
    console.log(JSON.stringify(stats, null, 2));
  });
}

function processPayload(payload) {
  const casts = payload;
  const stats = {
    warpcastLength: casts.warpcasts.length,
    neynarLength: casts.neynarCasts.length,
    castsInNeynarButNotInWarpcast: casts.delta.map((cast) => cast.hash),
  };

  return stats;
}

main();
