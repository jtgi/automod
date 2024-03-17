/* eslint-disable react/no-unescaped-entities */
import { typedjson, useTypedLoaderData } from "remix-typedjson";
import { db } from "~/lib/db.server";
import { LoaderFunctionArgs } from "@remix-run/node";
import { useClipboard } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { getSharedEnv, requireUser } from "~/lib/utils.server";
import { Link } from "@remix-run/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser({ request });

  const channels = await db.moderatedChannel.findMany({
    where: {
      OR: [
        {
          comods: {
            some: {
              fid: user.id,
            },
          },
        },
        {
          userId: user.id,
        },
      ],
    },
    include: {
      ruleSets: true,
      comods: true,
    },
  });

  return typedjson({
    user,
    channels,
    env: getSharedEnv(),
  });
}

export default function FrameConfig() {
  const { channels, user } = useTypedLoaderData<typeof loader>();

  return (
    <div className="space-y-4">
      {channels.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Welcome</CardTitle>
            <CardDescription>Creating a bot for your channel just takes a few seconds.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link className="no-underline" to="/~/channels/new">
                + New Bot
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {channels.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <h2>Bots</h2>
            <Button asChild>
              <Link className="no-underline" to="/~/channels/new">
                + New Bot
              </Link>
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
            {channels.map((channel) => (
              <Link to={`/~/channels/${channel.id}`} className="no-underline" key={channel.id}>
                <div className="flex gap-2 rounded-lg p-4 shadow border hover:border-orange-200 hover:shadow-orange-200 transition-all duration-300">
                  <img
                    src={channel.imageUrl ?? undefined}
                    alt={channel.id}
                    className="h-12 w-12 rounded-full block"
                  />
                  <div className="w-full overflow-hidden">
                    <h3
                      title={channel.id}
                      className=" text-ellipsis whitespace-nowrap overflow-hidden"
                      style={{ fontFamily: "Kode Mono" }}
                    >
                      /{channel.id}
                    </h3>
                    <div className="flex w-full justify-between">
                      <p className="text-sm text-gray-400">
                        {channel.ruleSets.length === 0 ? (
                          "No rules yet."
                        ) : (
                          <>
                            {channel.ruleSets.length} {channel.ruleSets.length === 1 ? "rule" : "rules"}
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function CopyButton({ frame, env }: { frame: { slug: string }; env: { hostUrl: string } }) {
  const { copy, copied } = useClipboard();

  return (
    <Button
      className="w-[100px]"
      size={"sm"}
      variant={"outline"}
      onClick={() => copy(`${env.hostUrl}/${frame.slug}`)}
    >
      {copied ? "Copied!" : "Copy URL"}
    </Button>
  );
}
