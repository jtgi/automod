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
  actionDefinitions,
  ruleDefinitions,
  ruleNames,
} from "~/lib/validations.server";
import { commitSession, getSession } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import invariant from "tiny-invariant";
import { isCohost } from "~/lib/warpcast.server";
import { ChannelForm } from "~/components/channel-form";
import { v4 as uuid } from "uuid";

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
      excludeCohosts: ch.data.excludeCohosts,
      excludeUsernames: JSON.stringify(ch.data.excludeUsernames),
      ruleSets: {
        deleteMany: {},
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
  const channel = await requireUserCanModerateChannel({
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

export default function Screen() {
  const { channel, ruleNames, ruleDefinitions, actionDefinitions } = useTypedLoaderData<typeof loader>();

  const patchedRuleSets = channel.ruleSets.map((ruleSet) => {
    const ruleParsed = JSON.parse(ruleSet.rule);

    return {
      ...ruleSet,
      logicType: (ruleParsed.operation === "AND" ? "and" : "or") as "and" | "or",
      ruleParsed: ruleParsed.conditions,
      actionsParsed: JSON.parse(ruleSet.actions),
    };
  });

  return (
    <div className="space-y-4 w-full">
      <ChannelForm
        actionDefinitions={actionDefinitions}
        ruleDefinitions={ruleDefinitions}
        ruleNames={ruleNames}
        defaultValues={{
          ...channel,
          excludeUsernames: channel.excludeUsernamesParsed.join("\n"),
          ruleSets: patchedRuleSets,
        }}
      />
    </div>
  );
}
