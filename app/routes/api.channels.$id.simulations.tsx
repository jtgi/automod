import { ActionFunctionArgs, LoaderFunctionArgs, json } from "@remix-run/node";
import invariant from "tiny-invariant";
import { simulationQueue } from "~/lib/bullish.server";
import { formatZodError, requireUser, requireUserCanModerateChannel } from "~/lib/utils.server";
import { FullModeratedChannel } from "./api.webhooks.neynar";
import { ModeratedChannelSchema } from "~/lib/validations.server";

export async function action({ request, params }: ActionFunctionArgs) {
  invariant(params.id, "id is required");
  const user = await requireUser({ request });
  const mChannel = await requireUserCanModerateChannel({
    userId: user.id,
    channelId: params.id,
  });

  const data = (await request.json()) as FullModeratedChannel;
  const channelResult = await ModeratedChannelSchema.safeParseAsync(data);

  if (!channelResult.success) {
    console.error(channelResult.error);
    return json({
      message: formatZodError(channelResult.error),
    });
  }

  console.log("proposed moderated channel", channelResult.data);

  const proposedModeratedChannel = {
    ...mChannel,
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
      moderatedChannel: mChannel,
      proposedModeratedChannel,
    },
    {
      removeOnComplete: {
        age: 60 * 60,
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
