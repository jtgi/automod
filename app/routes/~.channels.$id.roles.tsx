/* eslint-disable react/no-unescaped-entities */
import plur from "plur";
import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useSubmit } from "@remix-run/react";
import { redirect, typedjson, useTypedLoaderData } from "remix-typedjson";
import invariant from "tiny-invariant";
import { db } from "~/lib/db.server";
import { requireUser, requireUserCanModerateChannel, errorResponse, getSharedEnv } from "~/lib/utils.server";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { MoreVerticalIcon } from "lucide-react";
import { CastAction } from "~/lib/types";
import { actionToInstallLink } from "~/lib/utils";

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
    env: getSharedEnv(),
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
  const intent = formData.get("intent") as string | undefined;

  if (!intent) {
    return errorResponse({
      request,
      message: "Can't do that.",
    });
  }

  if (intent === "createRole") {
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
  } else if (intent === "deleteRole") {
    const roleId = formData.get("roleId") as string | undefined;

    if (!roleId) {
      return errorResponse({
        request,
        message: "Role not found",
      });
    }

    await db.role.delete({
      where: {
        id: roleId,
      },
    });

    return redirect(`/~/channels/${channel.id}/roles`);
  }
}

export default function Screen() {
  const { channel, env } = useTypedLoaderData<typeof loader>();
  const deleteRole = useSubmit();

  return (
    <div className="space-y-4">
      <div className="flex justify-between gap-4">
        <div>
          <p className="font-semibold">Community Mods</p>
          <p className="text-gray-500">
            Create roles with limited permissions to allow channel members to take on some moderation
            responsibilities.{" "}
            {channel.roles.length === 0 && (
              <Popover>
                <PopoverTrigger className="underline decoration-dashed">How could I use this?</PopoverTrigger>
                <PopoverContent>
                  <div className="text-sm space-y-2">
                    <p>
                      Let's say you run a large channel like <span className="font-mono">/design</span> with
                      60k+ members. Staying on top of moderation can be a big job. You likely have a small
                      population of motivated members who would happily contribute to moderating the channel.
                    </p>
                    <p>
                      You could make them a cohost, but then they'll be able to add/remove other cohosts and
                      ban other members. It's a bit much.
                    </p>
                    <p>
                      With automod roles, you can create a role with just the right level of access. For
                      example, only allowing them to hide posts–nothing more. A much more appropriate level of
                      access.
                    </p>
                  </div>
                </PopoverContent>
              </Popover>
            )}
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
            <div className="flex gap-3 items-center">
              {role.delegates.length > 0 && (
                <p className="text-gray-400 text-xs">
                  {role.delegates.length} {role.delegates.length ? plur("Member", role.delegates.length) : ""}
                </p>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger>
                  <MoreVerticalIcon className="w-5 h-5 text-gray-400" />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <Form method="post">
                    <DropdownMenuItem>
                      <Link
                        className="no-underline text-foreground"
                        to={actionToInstallLink({
                          actionType: "post",
                          icon: "person-add",
                          name: `Grant "${role.name}"`.substring(0, 20),
                          description: `Grant the "${role.name}" role in /${role.channelId} to a user`,
                          postUrl: `${env.hostUrl}/api/actions/grantRole?roleId=${role.id}`,
                          image: "todo",
                          automodAction: "grantRole",
                        })}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Install Action to Grant Role
                      </Link>
                    </DropdownMenuItem>
                  </Form>
                  <Form method="post">
                    <input type="hidden" name="roleId" value={role.id} />
                    <DropdownMenuItem>
                      <button
                        name="intent"
                        value="deleteRole"
                        className="w-full h-full cursor-default text-left"
                        onClick={(e) => {
                          if (confirm("Are you sure you want to delete this role?")) {
                            deleteRole(e.currentTarget.form);
                          }
                        }}
                      >
                        Delete
                      </button>
                    </DropdownMenuItem>
                  </Form>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}
      </div>
      <Dialog>
        <DialogTrigger asChild>
          <Button className="w-full sm:w-auto" variant={"secondary"}>
            + New Role
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Role</DialogTitle>
          </DialogHeader>
          <form method="post" className="flex flex-col gap-2">
            <input type="hidden" name="intent" value="createRole" />
            <Input name="roleName" placeholder="Enter a role name..." />
            <Button className="w-full sm:w-auto">Create</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}