/* eslint-disable react/no-unescaped-entities */
import { LoaderFunctionArgs } from "@remix-run/node";
import { Link, Outlet, useFetcher } from "@remix-run/react";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { typedjson, useTypedLoaderData } from "remix-typedjson";
import invariant from "tiny-invariant";
import { SidebarNav, SidebarNavProps } from "~/components/sub-nav";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Switch } from "~/components/ui/switch";
import { commitSession, getSession } from "~/lib/auth.server";
import { requireUser, requireUserCanModerateChannel } from "~/lib/utils.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  invariant(params.id, "id is required");

  const user = await requireUser({ request });
  const channel = await requireUserCanModerateChannel({
    userId: user.id,
    channelId: params.id,
  });

  const url = new URL(request.url);
  const session = await getSession(request.headers.get("Cookie"));
  const isNewChannel = session.get("newChannel") !== undefined || url.searchParams.get("newChannel") !== null;

  return typedjson(
    {
      user,
      channel,
      isNewChannel,
    },
    {
      headers: {
        "Set-Cookie": await commitSession(session),
      },
    }
  );
}

export default function ChannelRoot() {
  const { channel, isNewChannel } = useTypedLoaderData<typeof loader>();
  const enableFetcher = useFetcher();

  return (
    <div>
      <Link
        className="text-[9px] tracking-wider text-gray-500 no-underline items-center flex gap-1 mb-1"
        to={"/~"}
      >
        <ArrowLeft className="inline w-3 h-3" />
        <p>BACK</p>
      </Link>
      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ fontFamily: "Kode Mono" }}>/{channel.id}</h1>
        </div>
        <div className="pl-2 flex items-center gap-7">
          <form method="post" action={`/api/channels/${channel.id}/toggleEnable`}>
            <div className="flex items-center">
              <label htmlFor="enabled" className="text-sm p-3">
                Enabled
              </label>
              <Switch
                id="enabled"
                defaultChecked={channel.active}
                onClick={(e) =>
                  enableFetcher.submit(e.currentTarget.form, {
                    method: "post",
                  })
                }
              />{" "}
            </div>
          </form>
        </div>
      </div>

      <div className="py-4">
        <hr />
      </div>

      <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 relative">
        <div className="shrink-0 sm:min-w-[200px]">
          <SidebarNav
            items={
              [
                { to: `/~/channels/${channel.id}`, title: "Logs", end: true },
                { to: `/~/channels/${channel.id}/edit`, title: "Rules" },
                {
                  to: `/~/channels/${channel.id}/roles`,
                  title: "Moderators",
                },
                { to: `/~/channels/${channel.id}/tools`, title: "Tools" },
                {
                  to: `/~/channels/${channel.id}/collaborators`,
                  title: "Collaborators",
                },
              ].filter(Boolean) as SidebarNavProps["items"]
            }
          />
        </div>
        <div className="pt-2 w-full">
          <Outlet />
        </div>
      </div>

      <Dialog defaultOpen={!!isNewChannel}>
        <DialogContent onOpenAutoFocus={(evt) => evt.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Success! One last step...</DialogTitle>
            <DialogDescription asChild>
              <div className="flex flex-col gap-4">
                <div>
                  Open up{" "}
                  <a href={`https://warpcast.com/~/channel/${channel.id}`} target="_blank" rel="noreferrer">
                    /{channel.id}
                  </a>{" "}
                  and add{" "}
                  <a href="https://warpcast.com/automod" target="_blank" rel="noreferrer">
                    @automod
                  </a>{" "}
                  as a cohost to enable moderation.
                </div>
                <Button asChild>
                  <a
                    className="no-underline"
                    href={`https://warpcast.com/~/channel/${channel.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open /{channel.id} <ArrowUpRight className="inline ml-1 w-3 h-3" />
                  </a>
                </Button>
              </div>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}
