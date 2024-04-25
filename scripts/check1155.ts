import { getAddress, getContract } from "viem";
import { base } from "viem/chains";
import { erc1155Abi } from "~/lib/abis";
import { clientsByChainId } from "~/lib/viem.server";

async function main() {
  const baseClient = clientsByChainId[base.id];
  const contract = getContract({
    address: "0x402ae0eb018c623b14ad61268b786edd4ad87c56",
    abi: erc1155Abi,
    client: baseClient,
  });

  const addresses = [
    "0xea4feb8e55a17eed317b2804e1f49040d1b43299",
    "0xaed185ec781d0b3d801c14dc2c82e383893c37cb",
    "0x2cf84928261f655a47d04ec714d3bedf9375de46",
    "0x164a6969A515cCE8621e440e54C20E155CEbB0D7",
  ];

  for (const address of addresses) {
    const proOgPass = await contract.read.balanceOf([getAddress(address), 1n]);
    const proPass = await contract.read.balanceOf([getAddress(address), 2n]);
    console.log({
      address:
        address === "0x164a6969A515cCE8621e440e54C20E155CEbB0D7" ? "farcaster.wuestenigel.eth" : address,
      proOgPassBalance: proOgPass.toString(),
      proPassBalance: proPass.toString(),
    });
  }
}

main();
