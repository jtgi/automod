import { withSentry } from "@sentry/remix";
import { cssBundleHref } from "@remix-run/css-bundle";

import rootStyles from "~/root.css";

import farcasterStylesUrl from "@farcaster/auth-kit/styles.css";
import type { LinksFunction, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import {
  Link,
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
  useRouteError,
} from "@remix-run/react";
import { Toaster } from "./components/ui/sonner";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./components/ui/card";
import { Alert } from "./components/ui/alert";
import { Button } from "./components/ui/button";
import { getSharedEnv } from "./lib/utils.server";
import { authenticator } from "./lib/auth.server";
import { usePosthog } from "./lib/posthog";
import { typedjson, useTypedLoaderData } from "remix-typedjson";

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
    href: "https://fonts.googleapis.com/css2?family=Kode+Mono:wght@700&display=swap",
    rel: "stylesheet",
  },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await authenticator.isAuthenticated(request);

  return typedjson({
    env: getSharedEnv(),
    user,
  });
}

export const meta: MetaFunction = () => {
  return [
    { title: "automod | channel moderation on autopilot" },
    {
      property: "og:title",
      content: "automod | channel moderation on autopilot",
    },
    {
      name: "description",
      content:
        "Fight farcaster channel spam and enforce channel norms with bots. Takes seconds to setup. No code required.",
    },
  ];
};

function App() {
  const { env, user } = useTypedLoaderData<typeof loader>();

  usePosthog({ user, enabled: env.nodeEnv === "production" });

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="min-h-screen w-full">
        <Outlet />
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
        <Toaster position={"bottom-center"} />
      </body>
    </html>
  );
}

export default withSentry(App);

export const ErrorBoundary = () => {
  const error = useRouteError() as any;
  const isRouteError = isRouteErrorResponse(error);

  console.error(error);

  return (
    <html>
      <head>
        <title>Oh no!</title>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <Meta />
        <Links />
      </head>

      <body className="flex min-h-screen flex-col items-center justify-center p-6">
        {isRouteError ? (
          <Card>
            <CardHeader className="text-center">
              <CardTitle>
                <h1>{error.status}</h1>
              </CardTitle>
              <CardDescription>{error.statusText}</CardDescription>
            </CardHeader>
            <CardContent>Man, you really did it now.</CardContent>
            <CardFooter>
              <Button className="w-full" asChild>
                <Link to="/" className="no-underline hover:no-underline">
                  Sorry
                </Link>
              </Button>
            </CardFooter>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Something went wrong</CardTitle>
              <CardDescription>Sorry about that. The error has been logged.</CardDescription>
            </CardHeader>
            {error?.message && (
              <CardContent>
                <Alert>
                  <pre className="break-words">{error?.message}</pre>
                </Alert>
              </CardContent>
            )}
            <CardFooter>
              <Button className="w-full" asChild>
                <Link to="/" className="no-underline hover:no-underline">
                  Okay
                </Link>
              </Button>
            </CardFooter>
          </Card>
        )}
        <Scripts />
      </body>
    </html>
  );
};
