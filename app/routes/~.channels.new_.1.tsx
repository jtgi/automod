import { LoaderFunctionArgs } from "@remix-run/node";
import { Link } from "@remix-run/react";
import { typedjson, useTypedLoaderData } from "remix-typedjson";
import { db } from "~/lib/db.server";
import { requireUser } from "~/lib/utils.server";
import { getOwnedChannels } from "~/lib/warpcast.server";
import { ChannelCard } from "./~._index";

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
      <div>
        <h1>You don't have any channels to setup Automod with.</h1>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1>What channel would you like to setup Automod with?</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 w-full">
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
    </div>
  );
}
