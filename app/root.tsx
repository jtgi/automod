import { cssBundleHref } from "@remix-run/css-bundle";

import rootStyles from "~/root.css";

import farcasterStylesUrl from "@farcaster/auth-kit/styles.css";
import type { LinksFunction } from "@remix-run/node";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./components/ui/card";
import { Alert } from "./components/ui/alert";
import { Button } from "./components/ui/button";

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

export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1"
        />
        <Meta />
        <Links />
      </head>
      <body className="min-h-screen">
        <Outlet />
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
        <Toaster position={"bottom-center"} />
      </body>
    </html>
  );
}

export const ErrorBoundary = () => {
  const error = useRouteError() as any;
  const isRouteError = isRouteErrorResponse(error);

  console.error(error);

  return (
    <html>
      <head>
        <title>Oh no!</title>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1"
        />
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
              <CardDescription>
                Sorry about that. The error has been logged.
              </CardDescription>
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
