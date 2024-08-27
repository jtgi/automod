import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";

import { typedjson, useTypedFetcher, useTypedLoaderData } from "remix-typedjson";
import invariant from "tiny-invariant";
import {
  errorResponse,
  formatZodError,
  getSetCache,
  getSharedEnv,
  requireUser,
  requireUserCanModerateChannel as requireUserCanModerateChannel,
  sleep,
  successResponse,
} from "~/lib/utils.server";
import { Form } from "@remix-run/react";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import { getChannel, neynar, pageChannelCasts } from "~/lib/neynar.server";
import { FullModeratedChannel, validateCast } from "./api.webhooks.neynar";
import { db } from "~/lib/db.server";
import { getSession } from "~/lib/auth.server";
import { Loader2 } from "lucide-react";
import { castQueue, defaultProcessCastJobArgs, recoverQueue, sweepQueue } from "~/lib/bullish.server";
import { ModerationLog } from "@prisma/client";
import { WebhookCast } from "~/lib/types";
import { Input } from "~/components/ui/input";
import { FieldLabel } from "~/components/ui/fields";
import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Alert } from "~/components/ui/alert";
import { ActionType, actionDefinitions } from "~/lib/validations.server";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { CastWithInteractions } from "@neynar/nodejs-sdk/build/neynar-api/v2";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";

const SWEEP_LIMIT = 100;

export async function loader({ request, params }: LoaderFunctionArgs) {
  invariant(params.id, "id is required");

  const user = await requireUser({ request });
  const moderatedChannel = await requireUserCanModerateChannel({
    userId: user.id,
    channelId: params.id,
  });
  const isActive = await isSweepActive(moderatedChannel.id);

  // only channels that have a signer can sweep as far back
  // as they want, because otherwise you can burn through
  // reaction storage for @automod
  const channelsWithSigners = await db.signerAllocation.findMany({
    select: {
      channelId: true,
    },
  });
  const allowSweepTimeRange = channelsWithSigners.map((signer) => signer.channelId);

  return typedjson({
    user,
    isSweepActive: isActive,
    moderatedChannel,
    actionDefinitions,
    allowSweepTimeRange,
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
      intent: z.enum(["sweep", "testCast"]),
    })
    .safeParse(rawData);

  if (!result.success) {
    return errorResponse({
      request,
      message: formatZodError(result.error),
    });
  }

  if (result.data.intent === "sweep") {
    const result = z
      .object({
        untilTimeUtc: z.string().optional(),
      })
      .safeParse(rawData);

    if (!result.success) {
      return errorResponse({
        request,
        message: formatZodError(result.error),
      });
    }

    if (await isSweepActive(moderatedChannel.id)) {
      return successResponse({
        request,
        message: "Sweep already in progress. Hang tight.",
      });
    }

    console.log(`${user.name} started a sweep in ${moderatedChannel.id}`);

    await sweepQueue.add(
      "sweep",
      {
        channelId: moderatedChannel.id,
        moderatedChannel,
        untilTimeUtc: result.data.untilTimeUtc,
        limit: result.data.untilTimeUtc ? undefined : SWEEP_LIMIT,
      },
      {
        removeOnComplete: true,
        removeOnFail: true,
        jobId: `sweep-${moderatedChannel.id}`,
        attempts: 3,
      }
    );

    return successResponse({
      request,
      session,
      message: "Sweeping! This will take a while. Monitor progress in the logs.",
    });
  } else if (result.data.intent === "testCast") {
    const castHashOrWarpcastUrl = rawData.castHashOrWarpcastUrl as string;
    if (!castHashOrWarpcastUrl) {
      return errorResponse({
        request,
        message: "Cast hash or warpcast url is required",
      });
    }

    const castResult = await getSetCache({
      key: `cast:${castHashOrWarpcastUrl}`,
      get: () => {
        const isWarpcastUrl = castHashOrWarpcastUrl.includes("warpcast.com");
        return neynar.lookUpCastByHashOrWarpcastUrl(castHashOrWarpcastUrl, isWarpcastUrl ? "url" : "hash");
      },
    }).catch(() => null);

    if (!castResult) {
      return errorResponse({
        request,
        message: "Couldn't find that cast. Got another?",
      });
    }

    const logs = await validateCast({
      cast: castResult.cast as WebhookCast,
      moderatedChannel,
      simulation: true,
    });

    return typedjson({
      logs,
    });
  } else {
    return errorResponse({
      request,
      message: "Invalid intent",
    });
  }
}

export default function Screen() {
  const { isSweepActive, actionDefinitions, user, moderatedChannel, allowSweepTimeRange } =
    useTypedLoaderData<typeof loader>();

  const sweepOptions = useMemo(
    () => [
      { label: "6 hours ago", value: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString() },
      { label: "12 hours ago", value: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString() },
      { label: "24 hours ago", value: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() },
      { label: "36 hours ago", value: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString() },
    ],
    []
  );

  const showOptions = allowSweepTimeRange.includes(moderatedChannel.id) || user.id === "5179";

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
            Apply your moderation rules to the last {SWEEP_LIMIT} casts in Recent. Casts that were manually
            curated or hidden by moderators will be unaffected.
          </p>
        </div>

        <Form method="post" className="space-y-4">
          {showOptions && (
            <FieldLabel label="Until Time" className="items-start flex-col">
              <Select name="untilTimeUtc" defaultValue={sweepOptions[0].value}>
                <SelectTrigger className="w-[150px] sm:w-[200px] md:w-[400px] text-left">
                  <SelectValue placeholder={`Select a time`} />
                </SelectTrigger>
                <SelectContent>
                  {sweepOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldLabel>
          )}
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

      <hr />

      <div className="space-y-3">
        <div>
          <p className="font-medium">Simulate Rules</p>
          <p className="text-sm text-gray-500">
            Enter a cast hash or warpcast url to simulate your moderation rules against.
          </p>
        </div>
      </div>
      <SimulateCast actionDefs={actionDefinitions} />
    </main>
  );
}

function SimulateCast(props: { actionDefs: typeof actionDefinitions }) {
  const [open, setIsOpen] = useState(false);
  const [fetcherKey, setFetcherKey] = useState(new Date().toString());
  const fetcher = useTypedFetcher<typeof action>({
    key: fetcherKey,
  });
  const busy = fetcher.state === "submitting";
  const data = fetcher.data as unknown as { logs: ModerationLog[] } | { message: string } | undefined;
  const logData = data && "logs" in data;

  return (
    <fetcher.Form
      method="post"
      onSubmit={() => {
        setIsOpen(true);
      }}
      className="space-y-4"
    >
      <FieldLabel label="Cast Hash or Warpcast URL" className="items-start flex-col">
        <Input name="castHashOrWarpcastUrl" placeholder="e.g. https://warpcast.com/..." />
      </FieldLabel>

      <Button
        className="w-full sm:w-auto min-w-[150px]"
        name="intent"
        disabled={busy}
        value="testCast"
        variant={"secondary"}
      >
        {busy ? (
          <>
            <Loader2 className="animate-spin inline w-4 h-4 mr-2" />
            Simulating...
          </>
        ) : (
          "Simulate"
        )}
      </Button>
      <Dialog
        open={!!logData}
        onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) {
            setFetcherKey(new Date().toString());
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Simulation Result</DialogTitle>
            <DialogDescription></DialogDescription>
          </DialogHeader>
          {(() => {
            if (!data) {
              return <Loader2 className="animate-spin inline w-4 h-4 mr-2" />;
            }

            if ("message" in data) {
              return <Alert variant={"default"}>{data.message as unknown as string}</Alert>;
            }

            if ("logs" in data && data.logs.length === 0) {
              return <Alert variant={"default"}>Cast does not violate any rules.</Alert>;
            }

            if ("logs" in data && data.logs.length > 0) {
              return (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">Action</TableHead>
                      <TableHead className="w-[50px]">Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>{props.actionDefs[log.action as ActionType].friendlyName}</TableCell>
                        <TableCell>{log.reason}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              );
            }
          })()}
        </DialogContent>
      </Dialog>
    </fetcher.Form>
  );
}

export type SweepArgs = {
  channelId: string;
  moderatedChannel: FullModeratedChannel;
  limit: number;
  untilTimeUtc?: string;
  untilCastHash?: string;
  onProcessed?: () => void;
};

export async function sweep(args: SweepArgs) {
  let castsChecked = 0;
  for await (const page of pageChannelCasts({ id: args.channelId })) {
    const modOverrides = await db.moderationLog.findMany({
      select: {
        castHash: true,
      },
      where: {
        castHash: {
          in: page.casts.map((cast) => cast.hash),
        },
        actor: {
          not: "system",
        },
      },
    });

    const modOverrideHashes = new Set(
      modOverrides.filter((log): log is { castHash: string } => !!log.castHash).map((log) => log.castHash)
    );

    const unprocessedCasts = page.casts.filter((cast) => !modOverrideHashes.has(cast.hash));

    for (const cast of unprocessedCasts) {
      if (isFinished(args.channelId, cast, castsChecked, args)) {
        return;
      }

      console.log(`${args.channelId} sweep: processing cast ${cast.hash}...`);

      await validateCast({
        cast: cast as unknown as WebhookCast,
        moderatedChannel: args.moderatedChannel,
        executeOnProtocol: true,
      });

      castsChecked++;
      await sleep(500);
    }
  }
}

/**
 * Recover is similar to sweep but it only processes
 * casts that have not yet been moderated. This is
 * useful post incident or post downtime.
 */
export async function recover(
  args: SweepArgs & {
    reprocessModeratedCasts?: boolean;
  }
) {
  const channel = await getChannel({ name: args.channelId });

  let castsChecked = 0;
  for await (const page of pageChannelCasts({ id: args.channelId })) {
    let alreadyProcessedHashes = new Set();
    if (!args.reprocessModeratedCasts) {
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

      alreadyProcessedHashes = new Set(
        alreadyProcessed
          .filter((log): log is { castHash: string } => !!log.castHash)
          .map((log) => log.castHash)
      );
    } else {
      alreadyProcessedHashes = new Set();
    }

    const unprocessedCasts = page.casts.filter((cast) => !alreadyProcessedHashes.has(cast.hash));

    for (const cast of unprocessedCasts) {
      if (isFinished(channel.id, cast, castsChecked, args)) {
        console.log(`${channel.id} recover: finished.`);
        return;
      }

      try {
        await castQueue.add(
          "processCast",
          {
            channel,
            moderatedChannel: args.moderatedChannel,
            cast,
          },
          defaultProcessCastJobArgs(cast.hash)
        );
      } catch (e) {
        console.error(e);
      }

      castsChecked++;
    }
  }
}

export async function isSweepActive(channelId: string) {
  const job = await getSweepJob(channelId);
  if (!job) {
    return false;
  }

  const state = await job.getState();
  return state === "active";
}

export async function isRecoverActive(channelId: string) {
  const job = await recoverQueue.getJob(`recover-${channelId}`);
  if (!job) {
    return false;
  }

  const state = await job.getState();
  return state === "active";
}

async function getSweepJob(channelId: string) {
  return sweepQueue.getJob(`sweep-${channelId}`);
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
  const aggregatedResults: SimulationResult = [];
  let castsChecked = 0;
  for await (const page of pageChannelCasts({ id: args.channelId })) {
    if (castsChecked >= args.limit) {
      console.log(
        `${args.channelId} sweep: reached limit of ${args.limit} casts checked, stopping simulation`
      );
      break;
    }

    castsChecked += page.casts.length;
    for (const cast of page.casts) {
      console.log(`${args.channelId} sweep: processing cast ${cast.hash}...`);

      const [existing, proposed] = await Promise.all([
        args.moderatedChannel
          ? validateCast({
              // neynars typings are wrong, casts include root_parent_urls
              cast: cast as unknown as WebhookCast,
              moderatedChannel: args.moderatedChannel,
              simulation: true,
            })
          : Promise.resolve([]),
        validateCast({
          // neynars typings are wrong
          cast: cast as unknown as WebhookCast,
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

function isFinished(channelId: string, cast: CastWithInteractions, castsChecked: number, args: SweepArgs) {
  if (args.untilTimeUtc) {
    const castTime = new Date(cast.timestamp).getTime();
    const untilTime = new Date(args.untilTimeUtc).getTime();

    if (castTime < untilTime) {
      console.log(`${channelId} sweep/recover: reached untilTime ${args.untilTimeUtc}, stopping.`);
      return true;
    }
  }

  if (args.untilCastHash) {
    if (cast.hash === args.untilCastHash) {
      console.log(`${channelId} sweep/recover: reached untilCastHash ${args.untilCastHash}, stopping.`);
      return true;
    }
  }

  if (castsChecked >= args.limit) {
    console.log(`${channelId} sweep/recover: reached limit of ${args.limit} casts checked, stopping.`);
    return true;
  }

  return false;
}
