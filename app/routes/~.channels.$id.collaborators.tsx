/* eslint-disable react/no-unescaped-entities */
import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, useNavigation, useSubmit } from "@remix-run/react";
import { Loader } from "lucide-react";
import { useEffect, useRef } from "react";
import { typedjson, useTypedLoaderData } from "remix-typedjson";
import invariant from "tiny-invariant";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { db } from "~/lib/db.server";
import { getUsername } from "~/lib/neynar.server";
import { cn } from "~/lib/utils";
import { requireUser, requireUserOwnsChannel, errorResponse, successResponse } from "~/lib/utils.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  invariant(params.id, "id is required");

  const user = await requireUser({ request });
  const channel = await requireUserOwnsChannel({
    userId: user.id,
    channelId: params.id,
  });

  const comods = await db.comods.findMany({
    where: {
      channelId: channel.id,
    },
  });

  return typedjson({
    user,
    channel,
    comods,
  });
}

export async function action({ request, params }: ActionFunctionArgs) {
  invariant(params.id, "id is required");

  const user = await requireUser({ request });
  const channel = await requireUserOwnsChannel({
    userId: user.id,
    channelId: params.id,
  });

  const formData = await request.formData();
  const username = (formData.get("username") as string) ?? undefined;
  const intent = (formData.get("intent") as string) ?? undefined;

  if (intent === "revoke") {
    const fid = (formData.get("fid") as string) ?? undefined;

    if (!fid) {
      return errorResponse({
        request,
        message: "fid is required",
      });
    }

    await db.comods.delete({
      where: {
        fid_channelId: {
          channelId: channel.id,
          fid,
        },
      },
    });

    return successResponse({ request, message: `Removed` });
  } else {
    if (!username) {
      return typedjson({ message: "username is required" }, { status: 400 });
    }

    let newUser;
    try {
      newUser = await getUsername({ username });
    } catch (e) {
      return errorResponse({
        request,
        message: `Couldn't find @${username}. Got that right?`,
      });
    }

    if (newUser.fid === +user.id) {
      return errorResponse({
        request,
        message: "You can't add yourself as a collaborator.",
      });
    }

    await db.comods.create({
      data: {
        channelId: channel.id,
        fid: String(newUser.fid),
        username: newUser.username,
        avatarUrl: newUser.pfp.url,
      },
    });

    return successResponse({
      request,
      message: `Added @${newUser.username}`,
    });
  }
}

export default function Screen() {
  const { user, comods } = useTypedLoaderData<typeof loader>();
  const nav = useNavigation();
  const submit = useSubmit();

  const isAdding = nav.state === "submitting" && nav.formData?.get("intent") === "add";
  const formRef = useRef<HTMLFormElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isAdding) {
      formRef.current?.reset();
      usernameRef.current?.focus();
    }
  }, [isAdding]);

  const allComods = [
    {
      fid: user.id,
      username: user.name,
      avatarUrl: user.avatarUrl,
    },
    ...comods.filter((h) => h.username !== "automod").sort((a, b) => a.username.localeCompare(b.username)),
  ];

  return (
    <div>
      <p className="font-semibold">Collaborators</p>
      <p className="text-gray-500">
        Collaborators have access to automod and can manage all moderation settings.
      </p>

      <div className="py-4">
        <hr />
      </div>

      <div className="space-y-4 mt-4">
        <Form method="post" className="flex items-center gap-2" ref={formRef}>
          <input type="hidden" name="intent" value="add" />
          <Input
            ref={usernameRef}
            name="username"
            disabled={nav.state === "submitting"}
            className={cn(nav.state === "submitting" && "animate-pulse")}
            placeholder="Enter a username..."
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                submit(e.currentTarget.form);
              }
            }}
          />
          <Button disabled={nav.state === "submitting"} type="submit" className="min-w-[100px]">
            {nav.state === "submitting" ? <Loader className="w-4 h-4 animate-spin" /> : "Add"}
          </Button>
        </Form>
        <div className="divide-y border-t border-b mt-8">
          {allComods.map((cohost) => (
            <Form key={cohost.fid} method="post" className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <Avatar className="w-9 h-9">
                  <AvatarImage src={cohost.avatarUrl ?? undefined} alt={"@" + cohost.username} />
                  <AvatarFallback>{cohost.username.slice(0, 2).toLocaleUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <p className=" font-medium">{cohost.username}</p>
                  <p className="text-gray-400 text-xs">#{cohost.fid}</p>
                </div>
              </div>
              {cohost.fid != user.id && (
                <div>
                  <input type="hidden" name="intent" value="revoke" />
                  <input type="hidden" name="fid" value={cohost.fid} />
                  <Button variant="ghost" size="sm">
                    Revoke
                  </Button>
                </div>
              )}
            </Form>
          ))}
        </div>
      </div>
    </div>
  );
}
