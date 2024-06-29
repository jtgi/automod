/* eslint-disable react/no-unescaped-entities */
import { LoaderFunctionArgs } from "@remix-run/node";
import { Link, Outlet, useFetcher } from "@remix-run/react";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import { typedjson, useTypedLoaderData } from "remix-typedjson";
import invariant from "tiny-invariant";
import { SidebarNav, SidebarNavProps } from "~/components/sub-nav";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Switch } from "~/components/ui/switch";
import { commitSession, getSession } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { requireUser, requireUserCanModerateChannel } from "~/lib/utils.server";
import { getWarpcastChannel } from "~/lib/warpcast.server";

export const automodFid = 368422;
export const automodUsername = "automod";

export async function loader({ request, params }: LoaderFunctionArgs) {
  invariant(params.id, "id is required");
  try {
    const user = await requireUser({ request });
    const channel = await requireUserCanModerateChannel({
      userId: user.id,
      channelId: params.id,
    });

    const session = await getSession(request.headers.get("Cookie"));

    const [warpcastChannel, signerAlloc] = await Promise.all([
      getWarpcastChannel({ channel: channel.id }),
      db.signerAllocation.findFirst({
        where: {
          channelId: channel.id,
        },
        include: {
          signer: true,
        },
      }),
    ]);

    return typedjson(
      {
        user,
        channel,
        warpcastChannel,
        signerFid: signerAlloc?.signer.fid || automodFid,
        signerUsername: signerAlloc?.signer.username || automodUsername,
      },
      {
        headers: {
          "Set-Cookie": await commitSession(session),
        },
      }
    );
  } catch (e) {
    console.error(e);
    throw e;
  }
}

export default function ChannelRoot() {
  const { user, channel, warpcastChannel, signerFid, signerUsername } = useTypedLoaderData<typeof loader>();
  const enableFetcher = useFetcher();
  const [isNotConfigured, setIsNotConfigured] = useState<boolean>(false);

  useEffect(() => {
    setIsNotConfigured(!signerFid || warpcastChannel.moderatorFid !== +signerFid);
  }, []);

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
                { to: `/~/channels/${channel.id}`, title: "Overview", end: true },
                { to: `/~/channels/${channel.id}/activity`, title: "Activity" },
                { to: `/~/channels/${channel.id}/edit`, title: "Rules" },
                {
                  to: `/~/channels/${channel.id}/roles`,
                  title: "Moderators",
                },
                { to: `/~/channels/${channel.id}/tools`, title: "Tools" },
                user.id === channel.userId
                  ? {
                      to: `/~/channels/${channel.id}/collaborators`,
                      title: "Collaborators",
                    }
                  : null,
              ].filter(Boolean) as SidebarNavProps["items"]
            }
          />
        </div>
        <div className="pt-2 w-full">
          <Outlet />
        </div>
      </div>

      <Dialog open={isNotConfigured} onOpenChange={(open) => setIsNotConfigured(open)}>
        <DialogContent onOpenAutoFocus={(evt) => evt.preventDefault()}>
          <DialogHeader>
            <DialogTitle>One last step...</DialogTitle>
            <DialogDescription asChild>
              <div className="flex flex-col gap-4">
                <div>
                  Open up{" "}
                  <a href={`https://warpcast.com/~/channel/${channel.id}`} target="_blank" rel="noreferrer">
                    /{channel.id}
                  </a>{" "}
                  and set{" "}
                  <a href={`https://warpcast.com/${signerUsername}`} target="_blank" rel="noreferrer">
                    @{signerUsername}
                  </a>{" "}
                  as the moderator.
                </div>
                <Button asChild>
                  <a
                    className="no-underline"
                    href={`https://warpcast.com/~/channel/${channel.id}/settings/moderation`}
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
