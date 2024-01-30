import { cssBundleHref } from "@remix-run/css-bundle";

import rootStyles from "~/root.css";

import farcasterStylesUrl from "@farcaster/auth-kit/styles.css";
import { AuthKitProvider } from "@farcaster/auth-kit";
import type { LinksFunction, LoaderFunctionArgs } from "@remix-run/node";
import {
  Form,
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useLocation,
} from "@remix-run/react";
import { Button } from "./components/ui/button";
import { authenticator, commitSession, getSession } from "./lib/auth.server";
import { typedjson, useTypedLoaderData } from "remix-typedjson";
import { useEffect } from "react";
import { toast } from "sonner";
import { Toaster } from "./components/ui/sonner";

export const links: LinksFunction = () => [
  ...(cssBundleHref ? [{ rel: "stylesheet", href: cssBundleHref }] : []),
  { rel: "stylesheet", href: rootStyles },
  {
    rel: "apple-touch-icon",
    sizes: "180x180",
    href: "/apple-touch-icon.png",
  },
  {
    rel: "icon",
    type: "image/png",
    sizes: "32x32",
    href: "/favicon-32x32.png",
  },
  {
    rel: "icon",
    type: "image/png",
    sizes: "16x16",
    href: "/favicon-16x16.png",
  },
  {
    rel: "manifest",
    href: "/site.webmanifest",
  },
  { rel: "stylesheet", href: farcasterStylesUrl },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com" },
  {
    href: "https://fonts.googleapis.com/css2?family=Lato:ital,wght@0,400;0,700;1,900&display=swap",
    rel: "stylesheet",
  },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await authenticator.isAuthenticated(request);
  const session = await getSession(request.headers.get("Cookie"));
  const message = session.get("message") ?? undefined;

  return typedjson(
    {
      user,
      message,
      env: {
        HOST_URL: process.env.HOST_URL!,
        INFURA_PROJECT_ID: process.env.INFURA_PROJECT_ID!,
      },
    },
    {
      headers: {
        "Set-Cookie": await commitSession(session),
      },
    }
  );
}

export default function App() {
  const { env, user, message } = useTypedLoaderData<typeof loader>();
  const location = useLocation();

  const farcasterConfig = {
    rpcUrl: `https://optimism-mainnet.infura.io/v3/${env.INFURA_PROJECT_ID}`,
    domain: new URL(env.HOST_URL).host.split(":")[0],
    siweUri: `${env.HOST_URL}/login`,
  };

  useEffect(() => {
    if (message) {
      toast(message);
    }
  }, [message, user]);

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="min-h-screen">
        <AuthKitProvider config={farcasterConfig}>
          {location.pathname !== "/login" && location.pathname !== "/beta" && (
            <nav className="flex justify-between max-w-4xl mx-auto p-8">
              <h1 className="logo text-3xl">glass</h1>
              <Form method="post" action="/logout">
                <Button variant={"ghost"}>Logout</Button>
              </Form>
            </nav>
          )}
          <Outlet />
        </AuthKitProvider>
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
        <Toaster position={"bottom-center"} />
      </body>
    </html>
  );
}
