/* eslint-disable react/no-unescaped-entities */
import plur from "plur";
import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Link } from "@remix-run/react";
import { redirect, typedjson, useTypedLoaderData } from "remix-typedjson";
import invariant from "tiny-invariant";
import { v4 as uuid } from "uuid";
import { commitSession, getSession } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import {
  requireUser,
  requireUserIsCohost,
  requireUserCanModerateChannel,
  errorResponse,
} from "~/lib/utils.server";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { user } from "tests/unit/validations.test";
import { Input } from "~/components/ui/input";
import { FieldLabel } from "~/components/ui/fields";

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
  const roleName = formData.get("roleName") as string | undefined;

  if (!roleName) {
    return errorResponse({
      request,
      message: "Pick a role name",
    });
  }

  const roleExists = await db.role.findFirst({
    where: {
      channelId: channel.id,
      name: roleName,
    },
  });

  if (roleExists) {
    return errorResponse({
      request,
      message: "Role already exists",
    });
  }

  const role = await db.role.create({
    data: {
      name: roleName,
      channelId: channel.id,
      permissions: "[]",
    },
  });

  return redirect(`/~/channels/${channel.id}/roles/${role.name}`);
}

export default function Screen() {
  const { channel } = useTypedLoaderData<typeof loader>();

  return (
    <div className="space-y-4">
      <div className="flex justify-between gap-4">
        <div>
          <p className="font-semibold">Roles</p>
          <p className="text-gray-500">
            Create roles to allow channel members to take on some moderation responsibilities. For example,
            allow select members to hide others posts but not ban.
          </p>
        </div>
      </div>

      <div className="divide-y border-t border-b mt-8">
        {channel.roles.map((role) => (
          <div key={role.id} className="flex items-center justify-between py-3">
            <Link
              className="block font-medium no-underline hover:underline"
              prefetch="intent"
              to={`/~/channels/${channel.id}/roles/${role.name}`}
            >
              {role.name}
            </Link>
            <p className="text-gray-400 text-xs">
              {role.delegates.length ? plur("Member", role.delegates.length) : ""}
            </p>
          </div>
        ))}
      </div>
      <Dialog>
        <DialogTrigger asChild className="flex w-full flex-col items-end">
          <div>
            <Button variant={"secondary"}>+ New Role</Button>
          </div>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Role</DialogTitle>
          </DialogHeader>
          <form method="post" className="flex flex-col gap-2">
            <Input name="roleName" placeholder="Enter a role name..." />
            <Button className="w-full sm:w-auto">Create</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
