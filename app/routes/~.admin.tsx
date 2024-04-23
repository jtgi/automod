import { ActionFunctionArgs, LoaderFunctionArgs, json } from "@remix-run/node";
import { Form } from "@remix-run/react";
import { redirect, typedjson, useTypedActionData } from "remix-typedjson";
import { Alert } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { FieldLabel } from "~/components/ui/fields";
import { Input } from "~/components/ui/input";
import { authenticator, commitSession, destroySession, getSession } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { errorResponse, requireSuperAdmin, successResponse } from "~/lib/utils.server";
import { isSweepActive } from "./~.channels.$id.tools";
import { sweepQueue } from "~/lib/bullish.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireSuperAdmin({ request });

  return json({});
}

export async function action({ request }: ActionFunctionArgs) {
  await requireSuperAdmin({ request });

  const formData = await request.formData();
  const action = formData.get("action");

  if (action === "add-user") {
    const fid = (formData.get("fid") as string) ?? "";
    if (!fid) {
      return errorResponse({ request, message: "Please enter a fid" });
    }

    await db.order.upsert({
      where: {
        fid: fid,
      },
      update: {},
      create: {
        fid: fid,
      },
    });

    return successResponse({ request, message: "User added" });
  } else if (action === "impersonate") {
    const username = (formData.get("username") as string) ?? "";

    if (!username) {
      return errorResponse({ request, message: "Please enter a username" });
    }

    const session = await getSession(request.headers.get("Cookie"));
    session.set("impersonateAs", username);
    throw redirect("/auth/god", {
      headers: {
        "Set-Cookie": await commitSession(session),
      },
    });
  } else if (action === "sweep") {
    const channel = (formData.get("channel") as string) ?? "";
    const limit = parseInt((formData.get("limit") as string) ?? "1000");

    if (!channel) {
      return errorResponse({ request, message: "Enter a channel to sweep" });
    }

    if (isNaN(limit)) {
      return errorResponse({ request, message: "Invalid limit" });
    }

    const moderatedChannel = await db.moderatedChannel.findFirstOrThrow({
      where: {
        id: channel,
      },
      include: {
        ruleSets: true,
        user: true,
        roles: {
          include: {
            delegates: true,
          },
        },
        comods: true,
      },
    });

    if (await isSweepActive(moderatedChannel.id)) {
      return errorResponse({ request, message: "Sweep already in progress. Hang tight." });
    }

    await sweepQueue.add(
      "sweep",
      {
        channelId: moderatedChannel.id,
        moderatedChannel,
        limit,
      },
      {
        removeOnComplete: true,
        removeOnFail: true,
        jobId: `sweep-${moderatedChannel.id}`,
        attempts: 3,
      }
    );

    return successResponse({
      request,
      message: "Sweeping! This will take a while. Monitor progress in the logs.",
    });
  }

  return typedjson({ message: "Invalid action" }, { status: 400 });
}

export default function Admin() {
  return (
    <div className="space-y-8">
      <Form method="post" className="space-y-4">
        <FieldLabel label="Grant Access by Fid" className="flex-col items-start">
          <Input name="fid" placeholder="123.." />
        </FieldLabel>
        <Button name="action" value="add-user">
          Grant Access
        </Button>
      </Form>

      <Form method="post" className="space-y-4">
        <FieldLabel label="Impersonate Username" className="flex-col items-start">
          <Input name="username" placeholder="username" />
        </FieldLabel>
        <Button name="action" value="impersonate">
          Impersonate
        </Button>
      </Form>

      <Form method="post" className="space-y-4">
        <FieldLabel label="Sweep Channel" className="flex-col items-start">
          <Input name="channel" placeholder="channel" />
        </FieldLabel>
        <FieldLabel label="Limit" className="flex-col items-start">
          <Input type="number" name="limit" placeholder="limit" defaultValue={1000} />
        </FieldLabel>
        <Button name="action" value="sweep">
          Sweep
        </Button>
      </Form>
    </div>
  );
}
