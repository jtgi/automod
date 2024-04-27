/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from "axios";
import fs from "node:fs";

const apiKey = "NEYNAR_API_DOCS";
async function main(addresses: string[]) {
  const users = [];
  for (let i = 0; i < addresses.length; i += 350) {
    console.log(`fetching ${i} to ${i + 350}`);
    const url = `https://api.neynar.com/v2/farcaster/user/bulk-by-address?addresses=${addresses
      .slice(i, i + 350)
      .join(",")}`;
    const rsp = await axios.get<any>(url, {
      headers: {
        accept: "application/json",
        api_key: apiKey,
      },
    });
    users.push(...Object.values(rsp.data).flatMap((x) => x));
  }

  fs.writeFileSync("./farcaster-users.json", JSON.stringify(users, null, 2));
}

const addresses = fs
  .readFileSync("./0x49AF605BC56649C4a67716cf7C7B8790b17b8160-addresses.txt", "utf-8")
  .split("\n");

const a2 = fs.readFileSync("./0xA449b4f43D9A33FcdCF397b9cC7Aa909012709fD-addresses.txt", "utf-8").split("\n");
main([...addresses, ...a2]);
