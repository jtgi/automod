import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";

import { typedjson, useTypedLoaderData } from "remix-typedjson";
import invariant from "tiny-invariant";
import {
  errorResponse,
  formatZodError,
  getSharedEnv,
  requireUser,
  requireUserCanModerateChannel as requireUserCanModerateChannel,
  sleep,
  successResponse,
} from "~/lib/utils.server";
import { Form } from "@remix-run/react";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import { getChannel, pageChannelCasts } from "~/lib/neynar.server";
import { FullModeratedChannel, validateCast } from "./api.webhooks.neynar";
import { db } from "~/lib/db.server";
import { getSession } from "~/lib/auth.server";
import { Loader2 } from "lucide-react";
import { sweepQueue } from "~/lib/bullish.server";
import { ModerationLog } from "@prisma/client";
import { WebhookCast } from "~/lib/types";
import { CastWithInteractions } from "@neynar/nodejs-sdk/build/neynar-api/v2";

const SWEEP_LIMIT = 1000;

export async function loader({ request, params }: LoaderFunctionArgs) {
  invariant(params.id, "id is required");

  const user = await requireUser({ request });
  const moderatedChannel = await requireUserCanModerateChannel({
    userId: user.id,
    channelId: params.id,
  });
  const isActive = await isSweepActive(moderatedChannel.id);

  return typedjson({
    user,
    isSweepActive: isActive,
    moderatedChannel,
    env: getSharedEnv(),
  });
}

export async function action({ request, params }: ActionFunctionArgs) {
  invariant(params.id, "id is required");

  const user = await requireUser({ request });
  const moderatedChannel = await requireUserCanModerateChannel({
    userId: user.id,
    channelId: params.id,
  });
  const session = await getSession(request.headers.get("Cookie"));

  const formData = await request.formData();
  const rawData = Object.fromEntries(formData.entries());
  const result = z
    .object({
      intent: z.enum(["sweep"]),
    })
    .safeParse(rawData);

  if (!result.success) {
    return errorResponse({
      request,
      message: formatZodError(result.error),
    });
  }

  if (result.data.intent === "sweep") {
    if (await isSweepActive(moderatedChannel.id)) {
      return successResponse({
        request,
        message: "Sweep already in progress. Hang tight.",
      });
    }

    await sweepQueue.add(
      "sweep",
      {
        channelId: moderatedChannel.id,
        moderatedChannel,
        limit: SWEEP_LIMIT,
      },
      {
        removeOnComplete: 100,
        removeOnFail: 100,
        jobId: `sweep:${moderatedChannel.id}`,
        attempts: 3,
      }
    );

    return successResponse({
      request,
      session,
      message: "Sweeping! This will take a while. Monitor progress in the logs.",
    });
  } else {
    return errorResponse({
      request,
      message: "Invalid intent",
    });
  }
}

export default function Screen() {
  const { isSweepActive } = useTypedLoaderData<typeof loader>();

  return (
    <main className="space-y-6">
      <div>
        <p className="font-semibold">Tools</p>
      </div>
      <hr />
      <div className="space-y-3">
        <div>
          <p className="font-medium">Sweep</p>
          <p className="text-sm text-gray-500">
            Apply your moderation rules to the last {SWEEP_LIMIT} casts in your channel. Applies to root level
            casts only.
          </p>
        </div>

        <Form method="post">
          <Button
            className="w-full sm:w-auto min-w-[150px]"
            name="intent"
            disabled={isSweepActive}
            value="sweep"
            variant={"secondary"}
          >
            {isSweepActive ? (
              <>
                <Loader2 className="animate-spin inline w-4 h-4 mr-2" />
                Sweeping...
              </>
            ) : (
              "Sweep"
            )}
          </Button>
        </Form>
      </div>
    </main>
  );
}

export type SweepArgs = {
  channelId: string;
  moderatedChannel: FullModeratedChannel;
  limit: number;
  onProcessed?: () => void;
};

export async function sweep(args: SweepArgs) {
  const channel = await getChannel({ name: args.channelId });

  let castsChecked = 0;
  for await (const page of pageChannelCasts({ id: args.channelId })) {
    if (castsChecked >= args.limit) {
      console.log(`${channel.id} sweep: reached limit of ${args.limit} casts checked, stopping sweep`);
      break;
    }

    castsChecked += page.casts.length;

    const alreadyProcessed = await db.moderationLog.findMany({
      select: {
        castHash: true,
      },
      where: {
        castHash: {
          in: page.casts.map((cast) => cast.hash),
        },
      },
    });

    const alreadyProcessedHashes = new Set(
      alreadyProcessed.filter((log): log is { castHash: string } => !!log.castHash).map((log) => log.castHash)
    );

    const unprocessedCasts = page.casts.filter((cast) => !alreadyProcessedHashes.has(cast.hash));

    for (const cast of unprocessedCasts) {
      console.log(`${channel.id} sweep: processing cast ${cast.hash}...`);

      await validateCast({
        cast: cast as unknown as WebhookCast,
        channel,
        moderatedChannel: args.moderatedChannel,
      });

      await sleep(500);
    }
  }
}

async function isSweepActive(channelId: string) {
  const job = await getSweepJob(channelId);
  if (!job) {
    return false;
  }

  const state = await job.getState();
  return state === "active";
}

async function getSweepJob(channelId: string) {
  return sweepQueue.getJob(`sweep:${channelId}`);
}

export type SimulateArgs = {
  channelId: string;
  moderatedChannel: FullModeratedChannel | null;
  proposedModeratedChannel: FullModeratedChannel;
  limit: number;
  onProgress?: (castsProcessed: number) => Promise<void>;
};

export type SimulationResult = Array<{
  hash: string;
  existing: ModerationLog[];
  proposed: ModerationLog[];
}>;

export async function simulate(args: SimulateArgs) {
  const channel = await getChannel({ name: args.channelId });

  const aggregatedResults: SimulationResult = [];
  let castsChecked = 0;
  for await (const page of pageChannelCasts({ id: args.channelId })) {
    if (castsChecked >= args.limit) {
      console.log(`${channel.id} sweep: reached limit of ${args.limit} casts checked, stopping sweep`);
      break;
    }

    castsChecked += page.casts.length;
    for (const cast of page.casts) {
      console.log(`${channel.id} sweep: processing cast ${cast.hash}...`);

      const [existing, proposed] = await Promise.all([
        args.moderatedChannel
          ? validateCast({
              // neynars typings are wrong, casts include root_parent_urls
              cast: cast as unknown as WebhookCast,
              channel,
              moderatedChannel: args.moderatedChannel,
              simulation: true,
            })
          : Promise.resolve([]),
        validateCast({
          // neynars typings are wrong
          cast: cast as unknown as WebhookCast,
          channel,
          moderatedChannel: args.proposedModeratedChannel,
          simulation: true,
        }),
      ]);

      aggregatedResults.push({
        hash: cast.hash,
        existing,
        proposed,
      });
      await args.onProgress?.(castsChecked);

      await sleep(500);
    }
  }

  return aggregatedResults;
}
