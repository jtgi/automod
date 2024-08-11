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
import { recoverQueue, sweepQueue } from "~/lib/bullish.server";
import { useSearchParams } from "@remix-run/react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { ArrowUpRight } from "lucide-react";
import { Button } from "~/components/ui/button";
import { useState } from "react";

export async function action({ request, params }: ActionFunctionArgs) {
  invariant(params.id, "id is required");

  const user = await requireUser({ request });
  const modChannel = await requireUserCanModerateChannel({
    userId: user.id,
    channelId: params.id,
  });
  const url = new URL(request.url);
  const isOnboarding = url.searchParams.get("onboarding");

  const data = await request.json();

  if (process.env.NODE_ENV === "development") {
    console.log(JSON.stringify(data, null, 2));
  }

  injectChannelIdToAllRules(data);
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
      include: {
        user: true,
        ruleSets: {
          where: {
            active: true,
          },
        },
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
    toggleWebhook({ channelId: modChannel.id, active: true }).catch(console.error);

    if (isOnboarding) {
      /**
       * If the channel is being enabled for the first time, we want to
       * run a sweep to catch up on any changed rules.
       */
      sweepQueue.add("sweep", {
        channelId: modChannel.id,
        moderatedChannel: modChannel,
        limit: 250,
      });
    } else {
      /**
       * Always run a recovery post channel update. This helps in
       * cases where a channel has been disabled for a while and
       * then reenables. This way they don't have to run a sweep
       * manually.
       */
      recoverQueue.add("recover", {
        channelId: modChannel.id,
        moderatedChannel: modChannel,
        limit: 250,
      });
    }
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

  const [searchParams] = useSearchParams();

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

function injectChannelIdToAllRules(data: any) {
  for (let i = 0; i < data.inclusionRuleSet.ruleParsed.conditions.length; i++) {
    data.inclusionRuleSet.ruleParsed.conditions[i] = {
      ...data.inclusionRuleSet.ruleParsed.conditions[i],
      args: {
        ...data.inclusionRuleSet.ruleParsed.conditions[i].args,
        channelId: data.id,
      },
    };
  }

  for (let i = 0; i < data.exclusionRuleSet.ruleParsed.conditions.length; i++) {
    data.exclusionRuleSet.ruleParsed.conditions[i] = {
      ...data.exclusionRuleSet.ruleParsed.conditions[i],
      args: {
        ...data.exclusionRuleSet.ruleParsed.conditions[i].args,
        channelId: data.id,
      },
    };
  }
}
