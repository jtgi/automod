import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";

import { typedjson } from "remix-typedjson";
import invariant from "tiny-invariant";
import {
  errorResponse,
  formatZodError,
  getSharedEnv,
  requireUser,
  requireUserCanModerateChannel as requireUserCanModerateChannel,
  successResponse,
} from "~/lib/utils.server";
import { useFetcher } from "@remix-run/react";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import { db } from "~/lib/db.server";
import { getSession } from "~/lib/auth.server";
import { Loader2 } from "lucide-react";

export async function loader({ request, params }: LoaderFunctionArgs) {
  invariant(params.id, "id is required");

  const user = await requireUser({ request });
  const moderatedChannel = await requireUserCanModerateChannel({
    userId: user.id,
    channelId: params.id,
  });

  return typedjson({
    user,
    moderatedChannel,
    env: getSharedEnv(),
  });
}

export async function action({ request, params }: ActionFunctionArgs) {
  invariant(params.id, "id is required");

  const user = await requireUser({ request });
  const moderatedChannel = await requireUserCanModerateChannel({
    userId: user.id,
    channelId: params.id,
  });

  const formData = await request.formData();
  const rawData = Object.fromEntries(formData.entries());
  const result = z
    .object({
      intent: z.enum(["deleteChannel"]),
    })
    .safeParse(rawData);

  if (!result.success) {
    return errorResponse({
      request,
      message: formatZodError(result.error),
    });
  }

  if (result.data.intent === "deleteChannel") {
    await db.moderatedChannel.update({
      where: {
        id: moderatedChannel.id,
      },
      data: {
        active: false,
      },
    });

    return successResponse({
      request,
      message: "Channel removed",
    });
  } else {
    return errorResponse({
      request,
      message: "Invalid intent",
    });
  }
}

export default function Screen() {
  const deleteFetcher = useFetcher<typeof loader>();

  return (
    <main className="space-y-6">
      <div>
        <p className="font-semibold">Settings</p>
      </div>

      <hr />

      <div className="space-y-3">
        <div>
          <p className="font-medium">Delete Channel</p>
          <p className="text-sm text-gray-500">
            This will remove your channel from Automod and all of its data including logs, collaborators,
            roles, and rules. It's not recoverable.
          </p>
        </div>

        <deleteFetcher.Form
          method="post"
          onSubmit={(e) => {
            if (!confirm("Are you sure? This is not recoverable")) {
              e.preventDefault();
            }
          }}
        >
          <Button
            className="w-full sm:w-auto min-w-[150px]  border-destructive text-destructive hover:bg-destructive hover:text-white"
            name="intent"
            disabled={deleteFetcher.state !== "idle"}
            value="deleteChannel"
            variant={"outline"}
          >
            {deleteFetcher.state !== "idle" ? (
              <>
                <Loader2 className="animate-spin inline w-4 h-4 mr-2" />
                Deleting...
              </>
            ) : (
              "Delete"
            )}
          </Button>
        </deleteFetcher.Form>
      </div>
    </main>
  );
}
