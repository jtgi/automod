/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/no-unescaped-entities */
import { redirect, typedjson, useTypedLoaderData } from "remix-typedjson";
import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import {
  errorResponse,
  formatZodError,
  getSharedEnv,
  requireUser,
  requireUserCanModerateChannel,
} from "~/lib/utils.server";
import {
  ModeratedChannelSchema,
  Rule,
  actionDefinitions,
  ruleDefinitions,
  ruleNames,
} from "~/lib/validations.server";
import { commitSession, getSession } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import invariant from "tiny-invariant";
import { ChannelForm } from "~/components/channel-form";
import { v4 as uuid } from "uuid";
import { CurationForm } from "~/components/curation-form";
import { RuleSet } from "@prisma/client";

export async function action({ request, params }: ActionFunctionArgs) {
  invariant(params.id, "id is required");

  const user = await requireUser({ request });
  const modChannel = await requireUserCanModerateChannel({
    userId: user.id,
    channelId: params.id,
  });

  const data = await request.json();

  if (process.env.NODE_ENV === "development") {
    console.log(JSON.stringify(data, null, 2));
  }

  const ch = await ModeratedChannelSchema.safeParseAsync(data);

  if (!ch.success) {
    console.error(JSON.stringify(ch.error, null, 2));
    return errorResponse({
      request,
      message: formatZodError(ch.error),
    });
  }

  if (process.env.NODE_ENV === "development") {
    console.log(JSON.stringify(ch.data, null, 2));
  }

  const updatedChannel = await db.moderatedChannel.update({
    where: {
      id: modChannel.id,
    },
    data: {
      banThreshold: ch.data.banThreshold,
      slowModeHours: ch.data.slowModeHours,
      excludeCohosts: ch.data.excludeCohosts,
      excludeUsernames: JSON.stringify(ch.data.excludeUsernames),
      inclusionRuleSet: JSON.stringify({
        rule: ch.data.inclusionRuleSet?.ruleParsed,
        actions: ch.data.inclusionRuleSet?.actionsParsed,
      }),
      exclusionRuleSet: JSON.stringify({
        rule: ch.data.exclusionRuleSet?.ruleParsed,
        actions: ch.data.exclusionRuleSet?.actionsParsed,
      }),
      ruleSets: {
        // deleteMany: {}, : remove incase we need to rollback
        create: ch.data.ruleSets.map((ruleSet) => {
          return {
            target: ruleSet.target,
            rule: JSON.stringify(ruleSet.ruleParsed),
            actions: JSON.stringify(ruleSet.actionsParsed),
          };
        }),
      },
    },
  });

  const session = await getSession(request.headers.get("Cookie"));
  session.flash("message", {
    id: uuid(),
    type: "success",
    message: "Channel updated!",
  });

  return redirect(`/~/channels/${updatedChannel.id}/edit`, {
    headers: {
      "Set-Cookie": await commitSession(session),
    },
  });
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  invariant(params.id, "id is required");

  const user = await requireUser({ request });
  const [channel, cohostRole] = await Promise.all([
    requireUserCanModerateChannel({
      userId: user.id,
      channelId: params.id,
    }),
    db.role.findFirst({
      where: {
        channelId: params.id,
        isCohostRole: true,
      },
    }),
  ]);

  return typedjson({
    user,
    channel,
    actionDefinitions,
    ruleDefinitions,
    ruleNames,
    cohostRole,
    env: getSharedEnv(),
  });
}

export default function Screen() {
  const { channel, ruleNames, ruleDefinitions, actionDefinitions } = useTypedLoaderData<typeof loader>();

  const patchedRuleSets = channel.ruleSets.map((ruleSet) => patchRule(ruleSet));

  function patchRule(ruleSet: RuleSet) {
    const ruleParsed = JSON.parse(ruleSet.rule);

    return {
      ...ruleSet,
      logicType: ruleParsed.operation === "OR" ? ("or" as const) : ("and" as const),
      ruleParsed: ruleParsed.conditions,
      actionsParsed: JSON.parse(ruleSet.actions),
    };
  }

  function patchNewRuleSet(
    inclusion: boolean,
    ruleSet: RuleSet & {
      ruleParsed: Rule;
      actionsParsed: any;
    }
  ) {
    return {
      id: ruleSet?.id,
      target: ruleSet?.target || "all",
      active: ruleSet?.active || true,
      ruleParsed: ruleSet?.ruleParsed?.conditions || [],
      actionsParsed: ruleSet?.actionsParsed?.length
        ? ruleSet.actionsParsed
        : inclusion
        ? [{ type: "like" }]
        : [{ type: "hideQuietly" }],
      logicType: ruleSet?.ruleParsed?.operation || ("OR" as const),
    };
  }

  return (
    <div className="space-y-4 w-full">
      <div className="">
        <p className="font-semibold">Rules</p>
        <p className="text-gray-500">The following settings control what casts appear in Main.</p>
      </div>

      <div className="py-4">
        <hr />
      </div>

      <CurationForm
        actionDefinitions={actionDefinitions}
        ruleDefinitions={ruleDefinitions}
        ruleNames={ruleNames}
        defaultValues={{
          ...channel,
          excludeUsernames: channel.excludeUsernamesParsed.join("\n"),
          exclusionRuleSet: patchNewRuleSet(false, channel.exclusionRuleSetParsed!),
          inclusionRuleSet: patchNewRuleSet(true, channel.inclusionRuleSetParsed!),
        }}
      />
    </div>
  );
}
