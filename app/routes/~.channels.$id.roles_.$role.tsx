/* eslint-disable react/no-unescaped-entities */
import { LoaderFunctionArgs } from "@remix-run/node";
import { Link, NavLink, Outlet } from "@remix-run/react";
import { ArrowLeft } from "lucide-react";
import { redirect, typedjson, useTypedLoaderData } from "remix-typedjson";
import invariant from "tiny-invariant";
import { db } from "~/lib/db.server";
import { cn } from "~/lib/utils";
import { requireUser, requireUserCanModerateChannel } from "~/lib/utils.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  invariant(params.id, "id is required");
  invariant(params.role, "role is required");

  const user = await requireUser({ request });
  const channel = await requireUserCanModerateChannel({
    userId: user.id,
    channelId: params.id,
  });

  const role = await db.role.findFirst({
    where: {
      channelId: channel.id,
      name: params.role,
    },
  });

  if (!role) {
    throw redirect("/404");
  }

  return typedjson({
    user,
    channel,
    role,
  });
}

export default function Screen() {
  const { channel, role } = useTypedLoaderData<typeof loader>();

  return (
    <div>
      <div className="flex items-center gap-1">
        <ArrowLeft className="inline w-3 h-3 text-slate-500" />{" "}
        <Link
          to={`/~/channels/${channel.id}/roles`}
          className="uppercase text-[9px] tracking-wide no-underline text-slate-500"
        >
          ROLES
        </Link>
      </div>
      <p
        className="font-semibold text-lg mb-4"
        style={{
          fontFamily: "Kode Mono",
        }}
      >
        {role.name}
      </p>
      <div className="space-y-4">
        <div className="inline-block">
          <div className=" flex gap-2 bg-slate-100 rounded-lg p-1">
            <NavLink
              end
              className={({ isActive, isPending }) =>
                cn(
                  isActive || isPending ? " bg-white hover:bg-orange-50 text-opacity-100" : "",
                  isPending ? "animate-pulse" : "",
                  "no-underline justify-start px-3 py-1 rounded-lg text-foreground text-opacity-50 font-medium text-sm"
                )
              }
              to={`/~/channels/${channel.id}/roles/${role.name}`}
            >
              Permissions
            </NavLink>
            <NavLink
              end
              className={({ isActive, isPending }) =>
                cn(
                  isActive || isPending ? " bg-white hover:bg-orange-50 text-opacity-100" : "",
                  isPending ? "animate-pulse" : "",
                  "no-underline justify-start px-3 py-1 rounded-lg text-foreground text-opacity-50 font-medium text-sm"
                )
              }
              to={`/~/channels/${channel.id}/roles/${role.name}/members`}
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
