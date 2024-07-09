/* eslint-disable @typescript-eslint/no-explicit-any */
import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useFetcher } from "@remix-run/react";
import { redirect, typedjson, useTypedLoaderData } from "remix-typedjson";
import { errorResponse, formatZodError, isUserChannelLead, requireUser } from "~/lib/utils.server";
import { getWarpcastChannel } from "~/lib/warpcast.server";
import { FieldLabel } from "~/components/ui/fields";
import { ClientOnly } from "remix-utils/client-only";
import { UserPicker } from "~/components/user-picker";
import { FormProvider, useForm } from "react-hook-form";
import { Button } from "~/components/ui/button";
import { z } from "zod";
import { db } from "~/lib/db.server";
import { permissionDefs } from "~/lib/permissions.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser({ request });
  const url = new URL(request.url);

  if (!url.searchParams.has("channelId")) {
    throw redirect("/~/channels/new/1");
  }

  if (!url.searchParams.has("feed")) {
    throw redirect("/~/channels/new/2");
  }

  const channel = await getWarpcastChannel({ channel: url.searchParams.get("channelId")! });

  return typedjson({
    user,
    channel,
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser({ request });
  const data = await request.json();

  const result = z
    .object({
      comods: z.array(z.object({ value: z.number(), label: z.string(), icon: z.string().optional() })),
      channelId: z.string(),
      feed: z.enum(["recommended", "custom", "manual"]),
    })
    .safeParse(data);

  if (!result.success) {
    return errorResponse({
      request,
      message: formatZodError(result.error),
    });
  }

  const isLead = isUserChannelLead({
    channelId: result.data.channelId,
    userId: user.id,
  });
  if (!isLead) {
    throw redirect("/403");
  }

  function getRules(feed: "recommended" | "custom" | "manual") {
    if (feed === "recommended" || feed === "custom") {
      return {
        excludeCohosts: true,
        inclusionRuleSet: JSON.stringify({
          rule: {
            name: "or",
            type: "LOGICAL",
            args: {},
            operation: "OR",
            conditions: [
              {
                name: "userDoesNotHoldPowerBadge",
                type: "CONDITION",
                args: {},
              },
              {
                name: "userIsNotFollowedBy",
                type: "CONDITION",
                args: {
                  users: [
                    {
                      value: +user.id,
                      label: user.name,
                      icon: user.avatarUrl ?? undefined,
                    },
                  ],
                },
              },
            ],
          },
          actions: [
            {
              type: "like",
            },
          ],
        }),
        exclusionRuleSet: JSON.stringify({
          rule: {},
          actions: [
            {
              type: "hideQuietly",
            },
          ],
        }),
      };
    } else {
      return {
        excludeCohosts: true,
      };
    }
  }
  const ruleSets = getRules(result.data.feed);

  const moderatedChannel = await db.moderatedChannel.create({
    data: {
      id: result.data.channelId,
      userId: user.id,
      feedType: result.data.feed,
      ...ruleSets,
    },
  });

  await db.role.create({
    data: {
      channelId: moderatedChannel.id,
      name: "Cohost",
      isCohostRole: true,
      description: "Primary moderators for your channel.",
      permissions: JSON.stringify(permissionDefs.map((p) => p.id)),
      delegates: {
        create: result.data.comods.map((comod) => ({
          fid: String(comod.value),
          username: comod.label,
          avatarUrl: comod.icon,
          channelId: moderatedChannel.id,
        })),
      },
    },
  });

  return redirect(`/~/channels/new/4?channelId=${moderatedChannel.id}`);
}

export default function Screen() {
  const { channel } = useTypedLoaderData<typeof loader>();
  const fetcher = useFetcher();

  const methods = useForm({
    shouldFocusError: false,
    criteriaMode: "all",
  });

  const onSubmit = (data: any) => {
    const url = new URL(window.location.href);

    fetcher.submit(
      {
        comods: data.comods,
        channelId: channel.id,
        feed: url.searchParams.get("feed")!,
      },
      {
        method: "post",
        encType: "application/json",
      }
    );
  };

  return (
    <div className="space-y-8">
      <h1>Who would you like to moderate this channel with?</h1>

      <p className=" text-gray-500">
        Moderators will be able to pick what casts show in your channel's Main feed. They can curate casts,
        hide them or ban users.
      </p>

      <FormProvider {...methods}>
        <form method="post" className="space-y-8" onSubmit={methods.handleSubmit(onSubmit)}>
          <ClientOnly>
            {() => (
              <FieldLabel
                labelProps={{
                  className: "w-full",
                }}
                label={
                  <div className="flex justify-between gap-4 w-full">
                    <p className="font-medium flex-auto">Farcaster Usernames</p>
                  </div>
                }
                description=""
                className="flex-col items-start w-full"
              >
                <UserPicker name="comods" isMulti={true} />
              </FieldLabel>
            )}
          </ClientOnly>
          <p className="text-sm text-gray-500">You can change this anytime.</p>
          <Button className="w-full sm:w-[150px]">Next</Button>
        </form>
      </FormProvider>
    </div>
  );
}
