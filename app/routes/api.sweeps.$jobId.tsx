import { json, type LoaderFunctionArgs } from "@remix-run/node";
import invariant from "tiny-invariant";
import { sweepQueue } from "~/lib/bullish.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  invariant(params.jobId, "id is required");

  const job = await sweepQueue.getJob(params.jobId);
  if (!job) {
    return json(
      { status: "job not found" },
      {
        status: 404,
      }
    );
  }

  const status = await job.getState();
}

export default function Screen() {
  return (
    <div className="flex h-screen flex-row items-center justify-center">
      Whops! You should have already been redirected.
    </div>
  );
}
