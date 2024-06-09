import { AuthKitProvider } from "@farcaster/auth-kit";
import { LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, Outlet } from "@remix-run/react";
import { useEffect } from "react";
import { typedjson, useTypedLoaderData } from "remix-typedjson";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { commitSession, getSession } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { cn } from "~/lib/utils";
import { getSharedEnv, requireUser } from "~/lib/utils.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser({ request });

  const session = await getSession(request.headers.get("Cookie"));
  const message =
    (session.get("message") as { id: string; type: string; message: string } | null) ?? undefined;
  const impersonateAs = session.get("impersonateAs") ?? undefined;

  const [status] = await Promise.all([
    db.status.findFirst({
      where: {
        active: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
  ]);

  return typedjson(
    {
      user,
      impersonateAs,
      message,
      status,
      env: getSharedEnv(),
    },
    {
      headers: {
        "Set-Cookie": await commitSession(session),
      },
    }
  );
}

export default function Index() {
  const { status, env, message, impersonateAs, user } = useTypedLoaderData<typeof loader>();

  useEffect(() => {
    if (message) {
      if (message.type === "success") {
        toast(message.message);
      } else if (message.type === "error") {
        toast.error(message.message);
      }
    }
  }, [message?.id]);

  const farcasterConfig = {
    rpcUrl: `https://optimism-mainnet.infura.io/v3/${env.infuraProjectId}`,
    domain: new URL(env.hostUrl).host.split(":")[0],
    siweUri: `${env.hostUrl}/login`,
  };

  return (
    <AuthKitProvider config={farcasterConfig}>
      {status && (
        <div
          className={cn(
            "top-0 left-0 w-full text-white text-center p-3",
            status.type === "warning" ? " bg-orange-500" : "",
            status.type === "info" ? "bg-primary" : ""
          )}
        >
          {status.message}
          {status.link && (
            <a href={status.link} target="_blank" rel="noreferrer" className="underline ml-2 text-white">
              More
            </a>
          )}
        </div>
      )}

      {impersonateAs && (
        <div className="fixed top-0 left-0 w-full bg-primary/75 text-white text-center py-2">
          Impersonating as <span className="font-mono">{impersonateAs}</span>.
        </div>
      )}

      <main
        className={cn(
          "w-full max-w-4xl px-8 mx-auto min-h-screen flex flex-col pb-[200px] overflow-hidden",
          impersonateAs ? "pt-[40px]" : ""
        )}
      >
        <nav className="w-full flex justify-between max-w-4xl mx-auto py-8">
          <Link to="/~" className="no-underline">
            <h1 className="logo text-3xl">automod</h1>
          </Link>
          <div className="flex space-x-4">
            <DropdownMenu>
              <DropdownMenuTrigger>
                <Avatar className="shadow p-1 w-11 h-11 hover:shadow-orange-500 transition-all duration-400">
                  <AvatarImage className="rounded-full" src={user.avatarUrl ?? undefined} alt={user.name} />
                  <AvatarFallback className="text-white bg-primary">
                    {user.name.slice(0, 2).toLocaleUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>

              <DropdownMenuContent>
                <DropdownMenuLabel
                  style={{
                    fontFamily: "Kode Mono",
                  }}
                >
                  @{user.name}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {user.role === "superadmin" && (
                  <DropdownMenuItem>
                    <Link to="/~/admin">Admin</Link>
                  </DropdownMenuItem>
                )}
                <Form method="post" action="/~/logout">
                  <DropdownMenuItem onClick={(e) => e.currentTarget.closest("form")?.submit()}>
                    Logout
                  </DropdownMenuItem>
                </Form>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </nav>
        <Outlet />
      </main>
    </AuthKitProvider>
  );
}
