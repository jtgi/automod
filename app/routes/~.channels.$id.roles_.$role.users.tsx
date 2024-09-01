/* eslint-disable react/no-unescaped-entities */
import { ActionFunctionArgs, LoaderFunctionArgs, json } from "@remix-run/node";
import { Form, useNavigation, useSubmit } from "@remix-run/react";
import { redirect, typedjson, useTypedLoaderData } from "remix-typedjson";
import invariant from "tiny-invariant";
import { db } from "~/lib/db.server";
import {
  requireUser,
  requireUserCanModerateChannel,
  successResponse,
  errorResponse,
} from "~/lib/utils.server";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { neynar } from "~/lib/neynar.server";
import { Loader } from "lucide-react";
import { cn } from "~/lib/utils";
import { useEffect, useRef } from "react";

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
  });

  if (!role) {
    throw redirect("/404");
  }

  const delegates = await db.delegate.findMany({
    where: {
      channelId: channel.id,
      roleId: role.id,
    },
  });

  return typedjson({
    user,
    channel,
    role,
    delegates,
  });
}

export async function action({ request, params }: ActionFunctionArgs) {
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
  });

  if (!role) {
    return errorResponse({
      request,
      message: "Role not found",
    });
  }

  const formData = await request.formData();
  const intent = formData.get("intent") as string | undefined;

  if (intent === "add") {
    let username = formData.get("username") as string | undefined;
    if (!username) {
      return errorResponse({
        request,
        message: "Enter a username",
      });
    }

    username = username.replace("@", "").trim();

    const user = await neynar.lookupUserByUsername(username).catch(() => null);
    if (!user) {
      return errorResponse({
        request,
        message: `Couldn't find @${username}, sure that's right?`,
      });
    }

    await db.delegate.upsert({
      where: {
        fid_roleId_channelId: {
          fid: String(user.result.user.fid),
          roleId: role.id,
          channelId: channel.id,
        },
      },
      update: {},
      create: {
        fid: String(user.result.user.fid),
        roleId: role.id,
        channelId: channel.id,
        username: user.result.user.username,
        avatarUrl: user.result.user.pfp.url,
      },
    });

    return successResponse({
      request,
      message: `Added @${user.result.user.username}`,
    });
  } else if (intent === "revoke") {
    const fid = formData.get("fid") as string | undefined;
    if (!fid) {
      return errorResponse({
        request,
        message: "Need a fid",
      });
    }

    await db.delegate.delete({
      where: {
        fid_roleId_channelId: {
          fid,
          roleId: role.id,
          channelId: channel.id,
        },
      },
    });

    return json({});
  } else {
    return errorResponse({
      request,
      message: "hey...stop it",
    });
  }
}

export default function Screen() {
  const { delegates } = useTypedLoaderData<typeof loader>();
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

  return (
    <div className="space-y-4">
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
      {delegates.length > 0 && (
        <div className="divide-y border-t border-b">
          {delegates.map((member) => (
            <Form key={member.fid} method="post" className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <Avatar className="w-9 h-9 shrink-0">
                  <AvatarImage src={member.avatarUrl ?? undefined} alt={"@" + member.username} />
                  <AvatarFallback>{member.username.slice(0, 2).toLocaleUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <p className=" font-medium">{member.username}</p>
                  <p className="text-gray-400 text-xs">#{member.fid}</p>
                </div>
              </div>
              <div>
                <input type="hidden" name="intent" value="revoke" />
                <input type="hidden" name="fid" value={member.fid} />
                <Button variant="ghost" size="sm" disabled={nav.state === "submitting"}>
                  Revoke
                </Button>
              </div>
            </Form>
          ))}
        </div>
      )}
    </div>
  );
}
