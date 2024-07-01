/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from "axios";
import { db } from "~/lib/db.server";
import { toggleWebhook } from "~/routes/api.channels.$id.toggleEnable";
import { automodFid } from "~/routes/~.channels.$id";

async function main() {
  const channels = await db.moderatedChannel.findMany({
    where: {
      active: false,
    },
  });
  const signers = await db.signer.findMany();
  const signerFids = signers.map((s) => +s.fid).concat(automodFid);

  const rsp = await axios.get(`https://api.warpcast.com/v2/all-channels`);
  const wcChannels = rsp.data.result.channels;

  const tmp = wcChannels.filter((c: any) => c.id === "tmp");
  const tmp2 = channels.filter((c) => c.id === "tmp");
  console.log({ tmp, tmp2 });
  const shouldEnable = channels.filter((ch) => {
    return wcChannels.some((wcCh: any) => wcCh.id === ch.id && signerFids.includes(wcCh.moderatorFid));
  });

  for (const ch of shouldEnable) {
    await toggleWebhook({ channelId: ch.id, active: true });
  }
}

main()
  .then(() => process.exit(0))
  .catch(console.error);
