import { LoaderFunctionArgs } from "@remix-run/node";
import { Link } from "@remix-run/react";
import { typedjson, useTypedLoaderData } from "remix-typedjson";
import { db } from "~/lib/db.server";
import { requireUser } from "~/lib/utils.server";
import { getOwnedChannels } from "~/lib/warpcast.server";
import { ChannelCard } from "./~._index";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { ChannelHeader } from "./~.channels.new.3";
import { Button } from "~/components/ui/button";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser({ request });
  const [createdChannels, ownedChannels] = await Promise.all([
    db.moderatedChannel.findMany({
      where: {
        userId: user.id,
      },
    }),
    getOwnedChannels({ fid: +user.id }),
  ]);

  return typedjson({
    user,
    createdChannels,
    ownedChannels,
  });
}

export default function Screen() {
  const { user, createdChannels, ownedChannels } = useTypedLoaderData<typeof loader>();
  const channelOptions = ownedChannels.filter((c) => !createdChannels.some((cc) => cc.id === c.id));

  if (channelOptions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No channels to setup</CardTitle>
          <CardDescription>Create a new channel first</CardDescription>
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
}
