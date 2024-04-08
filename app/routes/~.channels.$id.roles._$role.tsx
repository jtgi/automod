/* eslint-disable react/no-unescaped-entities */
import plur from "plur";
import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Link } from "@remix-run/react";
import { redirect, typedjson, useTypedLoaderData } from "remix-typedjson";
import invariant from "tiny-invariant";
import { v4 as uuid } from "uuid";
import { commitSession, getSession } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { requireUser, requireUserIsCohost, requireUserCanModerateChannel } from "~/lib/utils.server";
import { actionDefinitions } from "~/lib/validations.server";
import { SliderField } from "~/components/ui/fields";
import { Controller, FormProvider } from "react-hook-form";
import { Switch } from "@radix-ui/react-switch";
import { permissions } from "~/lib/permissions.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  invariant(params.id, "id is required");
  invariant(params.role, "role is required");

  const user = await requireUser({ request });
  const channel = await requireUserCanModerateChannel({
    userId: user.id,
    channelId: params.id,
  });
  const role = await db.role.findFirst({
    where: {
      channelId: channel.id,
      name: params.role,
    },
    include: {
      permissions: true,
    },
  });

  if (!role) {
    throw redirect("/404");
  }

  return typedjson({
    user,
    channel,
    role,
    permissions,
  });
}

export async function action({ request, params }: ActionFunctionArgs) {
  invariant(params.id, "id is required");

  const user = await requireUser({ request });
  const channel = await requireUserCanModerateChannel({
    userId: user.id,
    channelId: params.id,
  });

  const formData = await request.formData();
  const cohostId = (formData.get("cohostId") as string) ?? undefined;

  if (!cohostId) {
    return typedjson({ message: "cohostId is required" }, { status: 400 });
  }

  const currentStatus = await db.comods.findFirst({
    where: {
      channelId: channel.id,
      fid: cohostId,
    },
  });

  const session = await getSession(request.headers.get("Cookie"));

  if (currentStatus) {
    await db.comods.delete({
      where: {
        id: currentStatus.id,
        channelId: channel.id,
        fid: cohostId,
      },
    });

    session.flash("message", {
      id: uuid(),
      type: "success",
      message: `Removed @${currentStatus.username} as a collaborator`,
    });
  } else {
    const cohost = await requireUserIsCohost({
      fid: +cohostId,
      channelId: params.id,
    });

    await db.comods.create({
      data: {
        channelId: channel.id,
        fid: cohostId,
        username: cohost.username,
        avatarUrl: cohost.pfp.url,
      },
    });

    session.flash("message", {
      id: uuid(),
      type: "success",
      message: `Added @${cohost.username} as a collaborator`,
    });
  }

  return typedjson(
    { message: "success" },
    {
      headers: {
        "Set-Cookie": await commitSession(session),
      },
    }
  );
}

export default function Screen() {
  const { user, channel, role, permissions } = useTypedLoaderData<typeof loader>();

  return (
    <div>
      <p className="font-semibold">Permissions</p>
      <p className="text-gray-500">
        Configure the permissions for the <strong>{role.name}</strong> role.
      </p>

      <FormProvider {...methods}>
        <form id="channel-form" method="post" className="w-full space-y-7" onSubmit={handleSubmit(onSubmit)}>
          <div className="divide-y border-t border-b mt-8">
            {permissions.map((permission) => (
              <SliderField
                key={permission.id}
                label="Cohosts"
                description="Exclude cohosts from all moderation"
              >
                <Controller
                  name={`excludeCohosts`}
                  control={control}
                  render={({ field }) => <Switch onCheckedChange={field.onChange} checked={field.value} />}
                />
              </SliderField>
            ))}
          </div>
        </form>
      </FormProvider>
    </div>
  );
}
