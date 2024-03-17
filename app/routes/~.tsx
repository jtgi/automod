import { AuthKitProvider } from "@farcaster/auth-kit";
import { DropdownMenuGroup } from "@radix-ui/react-dropdown-menu";
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
import { cn } from "~/lib/utils";
import { getSharedEnv, requireUser } from "~/lib/utils.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser({ request });
  const session = await getSession(request.headers.get("Cookie"));
  const message = session.get("message") ?? undefined;
  const flashCacheBust = new Date();
  const error = session.get("error") ?? undefined;
  const impersonateAs = session.get("impersonateAs") ?? undefined;

  return typedjson(
    {
      user,
      impersonateAs,
      message,
      flashCacheBust,
      error,
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
  const { env, message, error, impersonateAs, flashCacheBust, user } = useTypedLoaderData<typeof loader>();

  useEffect(() => {
    if (message) {
      toast(message);
    }

    if (error) {
      toast.error(error);
    }
  }, [message, error, flashCacheBust]);

  const farcasterConfig = {
    rpcUrl: `https://optimism-mainnet.infura.io/v3/${env.infuraProjectId}`,
    domain: new URL(env.hostUrl).host.split(":")[0],
    siweUri: `${env.hostUrl}/login`,
  };

  return (
    <AuthKitProvider config={farcasterConfig}>
      {impersonateAs && (
        <div className="fixed top-0 left-0 w-full bg-primary/75 text-white text-center py-2">
          Impersonating as <span className="font-mono">{impersonateAs}</span>.
        </div>
      )}
      <main
        className={cn(
          "w-full max-w-4xl px-8 mx-auto min-h-screen flex flex-col pb-[200px]",
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
