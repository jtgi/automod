import { sweepQueue, sweepWorker } from "~/lib/bullish.server";

export async function killSweeps() {
  await sweepQueue.obliterate({ force: true });
}

export async function killJob(jobId: string) {
  const job = await sweepQueue.getJob(jobId);
  try {
    job?.moveToFailed(new Error("Killed by admin"), "gm");
    job?.remove();
  } catch (e) {
    console.error(e);
  }
}

// killJob("sweep:degen");
killSweeps();
