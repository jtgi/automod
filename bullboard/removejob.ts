import { sweepQueue } from "~/lib/bullish.server";

export async function killJob(jobId: string) {
  const job = await sweepQueue.getJob(jobId);
  try {
    job?.moveToFailed(new Error("Killed by admin"), "gm");
    job?.remove();
  } catch (e) {
    console.error(e);
  }
}

killJob("sweep:perl");
