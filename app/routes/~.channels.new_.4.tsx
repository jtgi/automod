/* eslint-disable @typescript-eslint/no-explicit-any */
import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Link, useFetcher } from "@remix-run/react";
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
import { automodFid } from "./~.channels.$id";
import { useEffect, useState } from "react";
import axios from "axios";
import { ArrowUpRight, CheckIcon, Loader } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { useClipboard } from "~/lib/utils";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await requireUser({ request });
  const url = new URL(request.url);
  const channelId = url.searchParams.get("channelId")!;
  const [channel, wcChannel] = await Promise.all([
    db.moderatedChannel.findUniqueOrThrow({
      where: {
        id: channelId,
      },
    }),
    getWarpcastChannel({ channel: channelId }),
  ]);

  const isAutomodSet = automodFid === wcChannel.moderatorFid;

  return typedjson({
    user,
    channel,
    wcChannel,
    isAutomodSet,
  });
}

export default function Screen() {
  const { channel, wcChannel, isAutomodSet } = useTypedLoaderData<typeof loader>();
  const [fidSet, setFidSet] = useState(isAutomodSet);

  useEffect(() => {
    const interval = setInterval(() => {
      axios.get(`https://api.warpcast.com/v1/channel?channelId=${channel.id}`).then((rsp) => {
        const updatedWcChannel = rsp.data.result.channel;
        if (updatedWcChannel.moderatorFid === automodFid) {
          clearInterval(interval);
          setFidSet(true);
        }
      });
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const { copy, copied } = useClipboard();
  if (fidSet) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            <CheckIcon className="w-5 h-5 inline text-green-600" /> Setup Complete
          </CardTitle>
          <CardDescription>Enjoy</CardDescription>
        </CardHeader>
        <CardContent></CardContent>
        <CardFooter>
          <Button asChild>
            <Link to={`/~/channels/${channel.id}`} className="no-underline">
              Continue
            </Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <h1>Last step! Set your channel's moderator to automod</h1>
      <Card>
        <CardHeader>
          <CardTitle>
            <Loader className="animate-spin w-5 h-5 inline" /> Waiting for automod to be set as moderator...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <ol className=" list-decimal list-inside space-y-2">
              <li>
                <Button size={"xs"} variant={"outline"} onClick={() => copy("automod")}>
                  {copied ? "Copied!" : "Copy @automod username"}
                </Button>
              </li>
              <li>
                Open{" "}
                <a
                  className="no-underline"
                  href={`https://warpcast.com/~/channel/${channel.id}/settings/moderation`}
                  target="_blank"
                  rel="noreferrer"
                >
                  /{channel.id} <ArrowUpRight className="inline ml-1 w-3 h-3" />
                </a>{" "}
                and set the moderator to automod.
              </li>
              <li>Come back here</li>
            </ol>
          </div>
        </CardContent>
        {fidSet && (
          <CardFooter>
            <Button asChild>
              <Link to={`/~/channels/${channel.id}`} className="no-underline">
                Done
              </Link>
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
