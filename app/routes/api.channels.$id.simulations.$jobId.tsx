import { LoaderFunctionArgs, json } from "@remix-run/node";
import invariant from "tiny-invariant";
import { simulationQueue } from "~/lib/bullish.server";
import { requireUser } from "~/lib/utils.server";
import { SimulationResult } from "./~.channels.$id.tools";
import { Job } from "bullmq";

export async function loader({ request, params }: LoaderFunctionArgs) {
  invariant(params.id, "id is required");
  invariant(params.jobId, "jobId is required");

  await requireUser({ request });

  const job = await Job.fromId<SimulationResult>(simulationQueue, params.jobId);

  if (!job) {
    return json(
      {
        message: "job not found",
      },
      { status: 404 }
    );
  }

  const state = await job.getState();

  return json({
    jobId: params.jobId,
    state,
    progress: job.progress as number,
    result: (job.returnvalue as SimulationResult | undefined) || null,
  });
}
