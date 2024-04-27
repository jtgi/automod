/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from "axios";
import fs from "node:fs/promises";

const apikey = "jonathongian_sk_f7481a97-ef7c-41cf-8cc9-b8103e9c9005_ezwlrx05cwlrxt7t";

export async function main(contract: string) {
  let url = `https://api.simplehash.com/api/v0/nfts/owners/base/${contract}?limit=1000`;
  const addresses = new Set<string>();

  while (url !== null) {
    console.log("fetching", url.toString());
    const rsp = await axios.get<any>(url.toString(), {
      headers: {
        "X-API-KEY": apikey,
      },
    });

    const ads = rsp.data.owners.map((o: any) => o.owner_address);
    for (const ad of ads) {
      addresses.add(ad);
    }
    url = rsp.data.next;
  }

  fs.writeFile(`${contract}-addresses.txt`, Array.from(addresses).join("\n"));
}

// main("0x49AF605BC56649C4a67716cf7C7B8790b17b8160");
main("0xA449b4f43D9A33FcdCF397b9cC7Aa909012709fD");
