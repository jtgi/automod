import { ActionFunctionArgs, LoaderFunctionArgs, json } from "@remix-run/node";
import invariant from "tiny-invariant";
import { simulationQueue } from "~/lib/bullish.server";
import { formatZodError, requireUser } from "~/lib/utils.server";
import { ModeratedChannelSchema } from "~/lib/validations.server";
import { db } from "~/lib/db.server";
import { FullModeratedChannel } from "~/lib/types";

export async function action({ request, params }: ActionFunctionArgs) {
  invariant(params.id, "id is required");
  await requireUser({ request });
  const channel = await db.moderatedChannel.findUnique({
    where: {
      id: params.id,
    },
    include: {
      user: true,
    },
  });

  const data = (await request.json()) as FullModeratedChannel;
  const channelResult = await ModeratedChannelSchema.safeParseAsync(data);

  if (!channelResult.success) {
    console.error(channelResult.error);
    return json({
      message: formatZodError(channelResult.error),
    });
  }

  const proposedModeratedChannel = {
    active: true,
    banThreshold: channelResult.data.banThreshold,
    excludeCohosts: channelResult.data.excludeCohosts,
    excludeUsernames: JSON.stringify(channelResult.data.excludeUsernames),
    ...channel,
    ruleSets: channelResult.data.ruleSets.map((ruleSet) => {
      return {
        target: ruleSet.target,
        rule: JSON.stringify(ruleSet.ruleParsed),
        actions: JSON.stringify(ruleSet.actionsParsed),
      };
    }),
  };

  const job = await simulationQueue.add(
    "simulation",
    {
      channelId: params.id,
      limit: 100,
      moderatedChannel: channel,
      proposedModeratedChannel,
    },
    {
      removeOnComplete: {
        age: 60 * 60,
        count: 1000,
      },
    }
  );

  return json(
    {
      jobId: job.id,
    },
    {
      status: 201,
    }
  );
}
