/* eslint-disable react/no-unescaped-entities */
import { redirect, typedjson, useTypedLoaderData } from "remix-typedjson";
import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import {
  errorResponse,
  getSharedEnv,
  requireUser,
  requireUserOwnsChannel,
} from "~/lib/utils.server";
import {
  ModeratedChannelSchema,
  actionDefinitions,
  ruleDefinitions,
  ruleNames,
} from "~/lib/validations.server";
import { commitSession, getSession } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import invariant from "tiny-invariant";
import { ChannelForm } from "./~.channels.new";
import { isCohost } from "~/lib/warpcast.server";

export async function action({ request, params }: ActionFunctionArgs) {
  invariant(params.id, "id is required");

  const user = await requireUser({ request });
  const modChannel = await requireUserOwnsChannel({
    userId: user.id,
    channelId: params.id,
  });

  const data = await request.json();

  const isHost = await isCohost({
    fid: +user.id,
    channel: data.id,
  });

  if (!isHost) {
    return errorResponse({
      request,
      message: "Only cohosts can configure moderation.",
    });
  }

  const ch = ModeratedChannelSchema.safeParse(data);

  if (!ch.success) {
    console.error(JSON.stringify(ch.error, null, 2));
    return errorResponse({
      request,
      message: "Invalid data.",
    });
  }

  const updatedChannel = await db.moderatedChannel.update({
    where: {
      id: modChannel.id,
    },
    data: {
      banThreshold: ch.data.banThreshold,
      ruleSets: {
        deleteMany: {},
        create: ch.data.ruleSets.map((ruleSet) => {
          return {
            rule: JSON.stringify(ruleSet.ruleParsed),
            actions: JSON.stringify(ruleSet.actionsParsed),
          };
        }),
      },
    },
  });

  const session = await getSession(request.headers.get("Cookie"));
  session.flash("message", "Channel updated!");

  return redirect(`/~/channels/${updatedChannel.id}/edit`, {
    headers: {
      "Set-Cookie": await commitSession(session),
    },
  });
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  invariant(params.id, "id is required");

  const user = await requireUser({ request });
  const channel = await requireUserOwnsChannel({
    userId: user.id,
    channelId: params.id,
  });

  return typedjson({
    user,
    channel,
    actionDefinitions,
    ruleDefinitions,
    ruleNames,
    env: getSharedEnv(),
  });
}

export default function FrameConfig() {
  const { user, env, channel, ruleNames, ruleDefinitions, actionDefinitions } =
    useTypedLoaderData<typeof loader>();

  const patchedRuleSets = channel.ruleSets.map((ruleSet) => {
    const ruleParsed = JSON.parse(ruleSet.rule);

    return {
      ...ruleSet,
      logicType: (ruleParsed.operation === "AND" ? "and" : "or") as
        | "and"
        | "or",
      ruleParsed: ruleParsed.conditions,
      actionsParsed: JSON.parse(ruleSet.actions),
    };
  });

  return (
    <div className="space-y-4">
      <ChannelForm
        actionDefinitions={actionDefinitions}
        ruleDefinitions={ruleDefinitions}
        ruleNames={ruleNames}
        defaultValues={{
          ...channel,
          ruleSets: patchedRuleSets,
        }}
      />
    </div>
  );
}
