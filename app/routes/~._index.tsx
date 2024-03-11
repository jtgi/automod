/* eslint-disable react/no-unescaped-entities */
import { typedjson, useTypedLoaderData } from "remix-typedjson";
import { db } from "~/lib/db.server";
import { LoaderFunctionArgs } from "@remix-run/node";
import { useClipboard } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { getSharedEnv, requireUser } from "~/lib/utils.server";
import { Link } from "@remix-run/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser({ request });
  const env = getSharedEnv();

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
  const { channels, user, env } = useTypedLoaderData<typeof loader>();

  return (
    <div className="space-y-4">
      {channels.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Welcome</CardTitle>
            <CardDescription>
              Creating a bot for your channel just takes a few seconds.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link className="no-underline" to="/~/channels/new">
                + New Channel
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
              <Link
                to={`/~/channels/${channel.id}`}
                className="no-underline"
                key={channel.id}
              >
                <Card>
                  <CardHeader>
                    <CardTitle>{channel.id}</CardTitle>
                    <CardDescription>
                      <div className="flex items-center justify-between">
                        {channel.ruleSets.length}{" "}
                        {channel.ruleSets.length === 1 ? "rule" : "rules"}
                        {channel.comods.some((h) => h.fid === user.id) && (
                          <Badge variant={"outline"}>Collaborator</Badge>
                        )}
                      </div>
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function CopyButton({
  frame,
  env,
}: {
  frame: { slug: string };
  env: { hostUrl: string };
}) {
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
