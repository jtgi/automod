import { ActionFunctionArgs, json } from "@remix-run/node";
import { refreshAccountStatus } from "~/lib/subscription.server";
import { neynar } from "~/lib/neynar.server";

export async function action({ request }: ActionFunctionArgs) {
  const data: AlchemyWebhook = await request.json();

  console.log(JSON.stringify(data, null, 2));

  if (data.type !== "NFT_ACTIVITY") {
    return json({ message: "ok" }, { status: 200 });
  }

  if (data.event.fromAddress !== "0x0000000000000000000000000000000000000000") {
    return json({ message: "not a mint tx" }, { status: 200 });
  }

  const users = await neynar.fetchBulkUsersByEthereumAddress([data.event.toAddress]);
  const user = users[data.event.toAddress]?.[0];

  if (!user) {
    return json({ message: "user not found" }, { status: 200 });
  }

  const plan = await refreshAccountStatus({ fid: String(user.fid) });

  console.log(`refreshed plan for user ${user.fid}: ${plan.plan}`);

  return json({ message: "ok" }, { status: 200 });
}

export type AlchemyWebhook = {
  webhookId: string;
  id: string;
  createdAt: Date;
  type: string;
  event: Event;
};

export type Event = {
  fromAddress: string;
  toAddress: string;
  erc1155Metadata: Erc1155Metadatum[];
  category: string;
  log: Log;
};

export type Erc1155Metadatum = {
  tokenId: string;
  value: string;
};

export type Log = {
  address: string;
  topics: string[];
  data: string;

  blockNumber: string;
  transactionHash: string;
  transactionIndex: string;
  blockHash: string;
  logIndex: string;
  removed: boolean;
};
