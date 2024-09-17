import { LoaderFunctionArgs } from "@remix-run/node";
import { Link, NavLink, Outlet } from "@remix-run/react";
import humanNumber from "human-number";
import { ArrowLeft } from "lucide-react";
import { typedjson, useTypedLoaderData } from "remix-typedjson";
import invariant from "tiny-invariant";
import { cn } from "~/lib/utils";
import { requireUser, requireUserCanModerateChannel } from "~/lib/utils.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  invariant(params.id, "id is required");

  const user = await requireUser({ request });
  const channel = await requireUserCanModerateChannel({
    userId: user.id,
    channelId: params.id,
  });

  return typedjson({
    user,
    channel,
  });
}

export default function Screen() {
  const { channel } = useTypedLoaderData<typeof loader>();
  return (
    <div>
      <p className=" font-semibold mb-2">Membership</p>
      <div className="space-y-4">
        <div>
          <div className=" flex gap-2 bg-slate-100 rounded-lg p-1 w-full text-center">
            <NavLink
              end
              preventScrollReset
              className={({ isActive, isPending }) =>
                cn(
                  isActive || isPending ? " bg-white text-black" : "text-gray-400",
                  isPending ? "animate-pulse" : "",
                  "w-full no-underline justify-start px-3 py-1 rounded-lg font-medium text-sm"
                )
              }
              to={`/~/channels/${channel.id}/membership`}
            >
              Requirements
            </NavLink>
            <NavLink
              end
              preventScrollReset
              className={({ isActive, isPending }) =>
                cn(
                  isActive || isPending ? " bg-white text-black" : "text-gray-400",
                  isPending ? "animate-pulse" : "",
                  "w-full no-underline justify-start px-3 py-1 rounded-lg font-medium text-sm"
                )
              }
              to={`/~/channels/${channel.id}/membership/members`}
            >
              Members
            </NavLink>
          </div>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
