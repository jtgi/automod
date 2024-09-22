import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { typedjson, useTypedLoaderData } from "remix-typedjson";
import { z } from "zod";
import { MembershipForm } from "~/components/membership-form";
import { checkMembershipQueue } from "~/lib/bullish.server";
import { db } from "~/lib/db.server";
import {
  errorResponse,
  formatZodError,
  getSharedEnv,
  requireUser,
  requireUserCanModerateChannel,
  successResponse,
} from "~/lib/utils.server";
import { actionDefinitions, ruleDefinitions, ruleNames, RuleSchema } from "~/lib/validations.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await requireUser({ request });
  const channel = await requireUserCanModerateChannel({
    userId: user.id,
    channelId: params.id!,
  });

  const members = [user];

  return typedjson({
    user,
    channel,
    members,
    env: getSharedEnv(),
    actionDefinitions,
    ruleDefinitions,
    ruleNames,
  });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const user = await requireUser({ request });
  const channel = await requireUserCanModerateChannel({
    userId: user.id,
    channelId: params.id!,
  });

  const data = await request.json();
  const result = await z
    .object({
      memberRequirements: z.object({
        logicType: z.enum(["OR", "AND"]),
        //todo: this should only allow user rules
        rules: z.array(RuleSchema),
      }),
    })
    .safeParseAsync(data);

  if (!result.success) {
    return errorResponse({
      request,
      message: formatZodError(result.error),
      status: 400,
    });
  }

  const { memberRequirements } = result.data;

  await db.moderatedChannel.update({
    where: {
      id: channel.id,
    },
    data: {
      memberRequirements: JSON.stringify(memberRequirements),
    },
  });

  await checkMembershipQueue.add("checkMembership", { channelId: channel.id });

  return successResponse({
    request,
    message: "Saved.",
  });
}

export default function Screen() {
  const { user, channel, actionDefinitions, ruleDefinitions, ruleNames } =
    useTypedLoaderData<typeof loader>();
  return (
    <div className="flex flex-col gap-8">
      <section>
        <MembershipForm
          user={user}
          actionDefinitions={actionDefinitions}
          ruleDefinitions={ruleDefinitions}
          ruleNames={ruleNames}
          defaultValues={{
            id: channel.id,
            memberRequirements: channel.memberRequirements
              ? JSON.parse(channel.memberRequirements)
              : {
                  logicType: "OR",
                  rules: [],
                },
          }}
        />
      </section>
    </div>
  );
}
