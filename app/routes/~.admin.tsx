/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ActionFunctionArgs, LoaderFunctionArgs, json } from "@remix-run/node";
import { Form } from "@remix-run/react";
import { redirect, typedjson } from "remix-typedjson";
import { Button } from "~/components/ui/button";
import { FieldLabel } from "~/components/ui/fields";
import { Input } from "~/components/ui/input";
import { commitSession, getSession } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { errorResponse, requireSuperAdmin, successResponse } from "~/lib/utils.server";
import { isRecoverActive } from "./~.channels.$id.tools";
import { recoverQueue } from "~/lib/bullish.server";
import { FormEvent } from "react";

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
    const untilTimeLocal = (formData.get("untilTime") as string) ?? "";
    const untilHash = (formData.get("untilHash") as string) ?? "";

    let untilTimeUtc: string | undefined;

    if (untilTimeLocal) {
      untilTimeUtc = new Date(untilTimeLocal).toISOString();
    }

    if (untilTimeLocal && untilHash) {
      return errorResponse({ request, message: "Cannot specify both time and hash" });
    }

    if (isNaN(limit)) {
      return errorResponse({ request, message: "Invalid limit" });
    }

    if (channel) {
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
        },
      });

      if (await isRecoverActive(moderatedChannel.id)) {
        return errorResponse({ request, message: "Recovery already in progress. Hang tight." });
      }

      await recoverQueue.add(
        "recover",
        {
          channelId: moderatedChannel.id,
          moderatedChannel,
          limit,
          untilTimeUtc: untilTimeUtc ?? undefined,
          untilHash: untilHash ?? undefined,
        },
        {
          removeOnComplete: 300,
          removeOnFail: 300,
          attempts: 3,
        }
      );
    } else {
      // start for all active channels
      const moderatedChannels = await db.moderatedChannel.findMany({
        where: {
          active: true,
        },
        include: {
          ruleSets: true,
          user: true,
          roles: {
            include: {
              delegates: true,
            },
          },
        },
      });

      for (const moderatedChannel of moderatedChannels) {
        console.log(`[global recovery]: enqueuing ${moderatedChannel.id}`);
        await recoverQueue.add(
          "recover",
          {
            channelId: moderatedChannel.id,
            moderatedChannel,
            limit,
            untilTimeUtc: untilTimeUtc ?? undefined,
            untilHash: untilHash ?? undefined,
          },
          {
            removeOnComplete: 300,
            removeOnFail: 300,
            attempts: 3,
          }
        );
      }
    }

    return successResponse({
      request,
      message: "Recovering! This will take a while. Monitor progress in the logs.",
    });
  } else if (action === "status") {
    const message = (formData.get("message") as string) ?? "";
    const link = (formData.get("link") as string) ?? null;

    await db.status.updateMany({
      where: {
        active: true,
      },
      data: {
        active: false,
      },
    });

    await db.status.create({
      data: {
        message,
        link,
        active: true,
        type: "warning",
      },
    });

    return successResponse({ request, message: "Status updated" });
  }

  return typedjson({ message: "Invalid action" }, { status: 400 });
}

export default function Admin() {
  return (
    <div className="space-y-20">
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
        <FieldLabel label="Recover Channel (empty for all)" className="flex-col items-start">
          <Input name="channel" placeholder="all channels" />
        </FieldLabel>
        <FieldLabel label="Until" className="flex-col items-start">
          <Input name="untilTime" placeholder="2024-05-29T08:22:20.329Z" />
        </FieldLabel>
        <p className="text-[8px]">2024-05-29T08:22:20.329Z</p>
        <FieldLabel label="Until Cast Hash" className="flex-col items-start">
          <Input name="untilHash" placeholder="hash" />
        </FieldLabel>
        <FieldLabel label="Limit" className="flex-col items-start">
          <Input type="number" name="limit" placeholder="limit" defaultValue={1000} />
        </FieldLabel>
        <Button name="action" value="sweep">
          Recover
        </Button>
      </Form>

      <Form method="post" className="space-y-4">
        <FieldLabel label="Status" className="flex-col items-start">
          <Input name="channel" placeholder="channel" />
        </FieldLabel>
        <FieldLabel label="Message" className="flex-col items-start">
          <Input name="message" required />
        </FieldLabel>
        <FieldLabel label="Link" className="flex-col items-start">
          <Input name="link" />
        </FieldLabel>
        <Button name="action" value="status">
          Submit
        </Button>
      </Form>
    </div>
  );
}
