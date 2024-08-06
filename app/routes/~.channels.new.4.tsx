/* eslint-disable @typescript-eslint/no-explicit-any */
import { LoaderFunctionArgs } from "@remix-run/node";
import { Link, useNavigate } from "@remix-run/react";
import { redirect, typedjson, useTypedLoaderData } from "remix-typedjson";
import { getSharedEnv, requireUser } from "~/lib/utils.server";
import { getWarpcastChannel } from "~/lib/warpcast.server";
import { Button } from "~/components/ui/button";
import { db } from "~/lib/db.server";
import { automodFid } from "./~.channels.$id";
import { useEffect, useState } from "react";
import axios from "axios";
import { Check, CheckIcon, CopyIcon, Loader } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { useClipboard } from "~/lib/utils";
import { ChannelHeader } from "./~.channels.new.3";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { recoverQueue } from "~/lib/bullish.server";

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

  if (isAutomodSet) {
    await recoverQueue.add("recover", {
      channelId: channel.id,
      moderatedChannel: channel,
      limit: 250,
    });

    throw redirect(`/~/channels/new/5?channelId=${channel.id}`);
  }

  return typedjson({
    user,
    channel,
    wcChannel,
    isAutomodSet,
    env: getSharedEnv(),
  });
}

export default function Screen() {
  const { channel, isAutomodSet, env } = useTypedLoaderData<typeof loader>();
  const [fidSet, setFidSet] = useState<boolean>(isAutomodSet);

  useEffect(() => {
    const interval = setInterval(() => {
      axios.get(`${env.hostUrl}/api/warpcast/channels/${channel.id}`).then((rsp) => {
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

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <ChannelHeader channel={channel} />
          <CardTitle>Set the moderator to automod</CardTitle>
        </CardHeader>
        <CardContent>
          {fidSet ? (
            <Alert>
              <CheckIcon className="w-4 h-4 inline mr-1" />
              <AlertTitle>Success!</AlertTitle>
              <AlertDescription>Automod is now set as your channel's moderator.</AlertDescription>
            </Alert>
          ) : (
            <div className="flex flex-col gap-4">
              <ol className=" list-decimal list-inside space-y-2 my-4">
                <li>
                  Copy the{" "}
                  <Button size={"xs"} variant={"outline"} onClick={() => copy("automod")}>
                    {copied ? (
                      <>
                        <Check className="w-3 h-3 inline mr-1" />
                        automod
                      </>
                    ) : (
                      <>
                        <CopyIcon className="w-3 h-3 inline mr-1" />
                        automod
                      </>
                    )}
                  </Button>{" "}
                  username.
                </li>
                <li>
                  Open{" "}
                  <a
                    className="no-underline"
                    href={`https://warpcast.com/~/channel/${channel.id}/settings/moderation`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    /{channel.id}
                  </a>{" "}
                  and set the moderator to automod.
                </li>
                <li>Come back here.</li>
              </ol>
              <Alert>
                <AlertTitle>
                  <Loader className="w-4 h-4 inline animate-spin mr-2" />
                  Waiting for changes...
                </AlertTitle>
              </Alert>
            </div>
          )}
        </CardContent>

        {fidSet && (
          <CardFooter>
            <Button asChild>
              <Link
                to={`/~/channels/new/5?channelId=${channel.id}`}
                className="no-underline w-full sm:w-[150px]"
              >
                Next
              </Link>
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
