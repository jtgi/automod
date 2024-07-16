import { LoaderFunctionArgs, defer } from "@remix-run/node";
import { Await, Link } from "@remix-run/react";
import { TypedAwait, typeddefer, typedjson, useTypedLoaderData } from "remix-typedjson";
import { db } from "~/lib/db.server";
import { requireUser } from "~/lib/utils.server";
import { getOwnedChannels } from "~/lib/warpcast.server";
import { ChannelCard } from "./~._index";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { ChannelHeader } from "./~.channels.new.3";
import { Button } from "~/components/ui/button";
import { Suspense } from "react";
import { Skeleton } from "~/components/ui/skeleton";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser({ request });
  const channelData = Promise.all([
    db.moderatedChannel.findMany({
      where: {
        userId: user.id,
      },
    }),
    getOwnedChannels({ fid: +user.id }),
  ]);

  return typeddefer({
    user,
    channelData,
  });
}

export default function Screen() {
  const { user, channelData } = useTypedLoaderData<typeof loader>();

  return (
    <Suspense fallback={<ChannelFallback />}>
      <TypedAwait resolve={channelData}>
        {([createdChannels, ownedChannels]) => {
          const channelOptions = ownedChannels.filter((c) => !createdChannels.some((cc) => cc.id === c.id));

          if (channelOptions.length === 0) {
            return (
              <Card>
                <CardHeader>
                  <CardTitle>Hmm, no channels found.</CardTitle>
                  <CardDescription>
                    You have to be the owner of the channel to create an automod configuration.
                  </CardDescription>
                </CardHeader>
                <CardFooter>
                  <Button asChild>
                    <Link to={`/~`} className="no-underline">
                      Okay
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            );
          }

          return (
            <Card>
              <CardHeader>
                <CardTitle>What channel would you like to setup?</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 w-full">
                  {channelOptions.map((channel) => (
                    <Link
                      to={{ pathname: `/~/channels/new/2`, search: `?channelId=${channel.id}` }}
                      className="no-underline"
                      key={channel.id}
                      prefetch="intent"
                    >
                      <ChannelCard channel={channel} />
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        }}
      </TypedAwait>
    </Suspense>
  );
}

function ChannelFallback() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>What channel would you like to setup?</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 w-full">
          <Skeleton className="h-[78px] w-[200px] rounded-lg " />
          <Skeleton className="h-[78px] w-[200px] rounded-lg " />
          <Skeleton className="h-[78px] w-[200px] rounded-lg " />
          <Skeleton className="h-[78px] w-[200px] rounded-lg " />
          <Skeleton className="h-[78px] w-[200px] rounded-lg " />
          <Skeleton className="h-[78px] w-[200px] rounded-lg " />
        </div>
      </CardContent>
    </Card>
  );
}
