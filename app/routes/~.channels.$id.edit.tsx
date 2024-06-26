/* eslint-disable @typescript-eslint/ban-ts-comment */
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
  getRuleDefinitions,
  ruleNames,
} from "~/lib/validations.server";
import { commitSession, getSession } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import invariant from "tiny-invariant";
import { v4 as uuid } from "uuid";
import { CurationForm } from "~/components/curation-form";
import { RuleSet } from "@prisma/client";
import { addToBypassAction } from "~/lib/cast-actions.server";
import { actionToInstallLink } from "~/lib/utils";
import { toggleWebhook } from "./api.channels.$id.toggleEnable";

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

  const shouldFlipEnabled = ch.data.inclusionRuleSet.ruleParsed.conditions?.length !== 0;

  const [updatedChannel, session] = await Promise.all([
    db.moderatedChannel.update({
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
    }),
    getSession(request.headers.get("Cookie")),
  ]);

  if (shouldFlipEnabled) {
    // fire and forget
    toggleWebhook({ channelId: modChannel.id, active: true }).catch(console.error);
  }

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
    ruleDefinitions: getRuleDefinitions(user.id, channel.id),
    ruleNames,
    cohostRole,
    bypassInstallLink: actionToInstallLink(addToBypassAction),
    env: getSharedEnv(),
  });
}

export default function Screen() {
  const { channel, ruleNames, ruleDefinitions, actionDefinitions, cohostRole, bypassInstallLink } =
    useTypedLoaderData<typeof loader>();

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
        bypassInstallLink={bypassInstallLink}
        actionDefinitions={actionDefinitions}
        ruleDefinitions={ruleDefinitions}
        ruleNames={ruleNames}
        cohostRole={cohostRole}
        defaultValues={{
          ...channel,
          excludeUsernames: channel.excludeUsernamesParsed,
          exclusionRuleSet: patchNewRuleSet(false, channel.exclusionRuleSetParsed!),
          inclusionRuleSet: patchNewRuleSet(true, channel.inclusionRuleSetParsed!),
        }}
      />
    </div>
  );
}
