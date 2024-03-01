/* eslint-disable react/no-unescaped-entities */
import { LoaderFunctionArgs } from "@remix-run/node";
import { Link, NavLink, Outlet, useFetcher } from "@remix-run/react";
import {
  ArrowLeft,
  Power,
  PowerCircle,
  PowerOff,
  Zap,
  ZapOff,
} from "lucide-react";
import { typedjson, useTypedLoaderData } from "remix-typedjson";
import invariant from "tiny-invariant";
import { SidebarNav } from "~/components/sub-nav";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { requireUser, requireUserOwnsChannel } from "~/lib/utils.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  invariant(params.id, "id is required");

  const user = await requireUser({ request });
  const channel = await requireUserOwnsChannel({
    userId: user.id,
    channelId: params.id,
  });

  return typedjson({
    user,
    channel,
  });
}

export default function ChannelRoot() {
  const { user, channel } = useTypedLoaderData<typeof loader>();

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
          <form
            method="post"
            action={`/api/channels/${channel.id}/toggleEnable`}
          >
            <div className="flex items-center">
              <label htmlFor="enabled" className="text-sm p-3">
                Moderation
              </label>
              <Switch
                className=" scale-75"
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

      <div className="flex flex-col sm:flex-row gap-4 sm:gap-8">
        <div className="shrink-0 sm:min-w-[200px]">
          <SidebarNav
            items={[
              { to: `/~/channels/${channel.id}`, title: "Logs" },
              { to: `/~/channels/${channel.id}/edit`, title: "Rules" },
            ]}
          />
        </div>
        <div className="pt-2">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
