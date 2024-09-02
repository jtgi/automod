/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { LoaderFunctionArgs } from "@remix-run/node";
import { typedjson, useTypedLoaderData } from "remix-typedjson";
import { Link } from "@remix-run/react";
import { getSharedEnv, redirectWithMessage, requireUser } from "~/lib/utils.server";
import { getWarpcastChannels } from "~/lib/warpcast.server";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "~/components/ui/card";
import { ArrowUpRight, Check, CheckCircle2, CopyIcon, Loader } from "lucide-react";
import { useClipboard } from "~/lib/utils";
import axios from "axios";
import { useState, useEffect } from "react";
import { automodFid } from "./~.channels.$id";

export const airstackFid = 440220;

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUser({ request });

  const channelIds = new URL(request.url).searchParams.getAll("channelIds");
  const allChannels = await getWarpcastChannels();

  const setupComplete = channelIds.every((channelId) => {
    return allChannels.find((channel) => channel.id === channelId)?.moderatorFid === automodFid;
  });

  return typedjson({
    env: getSharedEnv(),
    setupComplete,
    channelIds,
  });
}

export default function Screen() {
  const { env, channelIds } = useTypedLoaderData<typeof loader>();
  const [fidSet, setFidSet] = useState<Record<string, boolean>>({});
  const complete = Object.keys(fidSet).length === channelIds.length && Object.values(fidSet).every(Boolean);

  useEffect(() => {
    const intervalId = setInterval(() => {
      const promises = channelIds.map((channelId) =>
        axios.get(`${env.hostUrl}/api/warpcast/channels/${channelId}`)
      );
      Promise.all(promises).then((responses) => {
        const updatedFidSet: Record<string, boolean> = {};
        responses.forEach((response, index) => {
          const channelId = channelIds[index];
          updatedFidSet[channelId] = response.data.result.channel.moderatorFid === automodFid;
        });
        setFidSet(updatedFidSet);
        if (complete) {
          clearInterval(intervalId as unknown as number);
        }
      });
    }, 3000);

    return () => clearInterval(intervalId as unknown as number);
  }, [env, channelIds, complete]);

  const { copy, copied } = useClipboard();

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Last step, set the moderator to automod for each channel.</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <p className="font-medium">Instructions</p>
            <ol className="list-decimal list-inside space-y-2">
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
              <li>Open each channel's settings and set the moderator to automod.</li>
              <li>Come back here.</li>
            </ol>
          </div>
          <div className="py-6">
            <hr />
          </div>
          {channelIds.length > 1 && <p className="font-medium">Channels</p>}
          <div className="divide-y divide-gray-200">
            {channelIds.map((channelId) => (
              <div key={channelId} className="flex flex-row justify-between gap-2 py-2">
                <div>
                  {fidSet[channelId] ? (
                    <CheckCircle2 className="w-5 h-5 inline mr-1 text-green-700" />
                  ) : (
                    <Loader className="w-5 h-5 inline animate-spin mr-2" />
                  )}
                  <span style={{ fontFamily: "Kode Mono" }}>/{channelId}</span>
                </div>
                <div>
                  <a
                    className="no-underline text-xs"
                    href={`https://warpcast.com/~/channel/${channelId}/settings/moderation`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open Settings
                  </a>{" "}
                  <ArrowUpRight className="w-3 h-3 inline text-primary" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
        {complete && (
          <CardFooter>
            <Button asChild>
              <Link to={`/~/import/airstack/3`} className="no-underline w-full sm:w-[150px]">
                Next
              </Link>
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
