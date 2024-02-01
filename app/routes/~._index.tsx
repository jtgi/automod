import { typedjson, useTypedLoaderData } from "remix-typedjson";
import { db } from "~/lib/db.server";
import { LoaderFunctionArgs } from "@remix-run/node";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { useClipboard } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { CheckIcon, CopyIcon, PlusIcon } from "@radix-ui/react-icons";
import { commitSession, getSession } from "~/lib/auth.server";
import { getSharedEnv, requireUser } from "~/lib/utils.server";
import { Link } from "@remix-run/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser({ request });
  const env = getSharedEnv();

  const [frames, session] = await Promise.all([
    db.frame.findMany({
      where: {
        userId: user.id,
      },
    }),
    getSession(request.headers.get("Cookie")),
  ]);

  console.log("newframe", session.get("newFrame"));

  return typedjson(
    {
      user,
      frames,
      env: getSharedEnv(),
      hostUrl: env.hostUrl,
      newlyCreatedUrl: session.get("newFrame")
        ? `${env.hostUrl}/${session.get("newFrame")}`
        : null,
    },
    {
      headers: {
        "Set-Cookie": await commitSession(session),
      },
    }
  );
}

export default function FrameConfig() {
  const { frames, newlyCreatedUrl, env } = useTypedLoaderData<typeof loader>();
  const { copy, copied } = useClipboard();

  return (
    <div>
      {!frames.length && (
        <Card>
          <CardHeader>
            <CardTitle>Welcome</CardTitle>
          </CardHeader>
          <CardContent>
            <div>You dont have any frames yet, create one to get started.</div>
          </CardContent>
          <CardFooter>
            <Button asChild>
              <Link to="/~/frames/new">Create a new frame</Link>
            </Button>
          </CardFooter>
        </Card>
      )}

      {frames.length > 0 && (
        <div className="divide-y">
          <div className="flex items-center justify-between mb-4">
            <p className="font-semibold">Frames</p>
          </div>
          {frames.map((frame) => (
            <div key={frame.id} className="flex items-center justify-between">
              <Link
                className="no-underline flex-auto w-full py-2"
                to={`/~/frames/${frame.slug}/edit`}
              >
                <h2>{frame.slug}</h2>
              </Link>
              <CopyButton frame={frame} env={env} />
            </div>
          ))}
        </div>
      )}
      <div className="max-w-4xl mx-auto fixed bottom-2 left-1/2 -translate-x-1/2 w-full pb-4 px-8">
        <Button className="w-full" asChild>
          <Link className="no-underline" to="/~/frames/new">
            <PlusIcon className="mr-2" /> New Frame
          </Link>
        </Button>
      </div>

      <Dialog defaultOpen={!!newlyCreatedUrl}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Success!</DialogTitle>
            <DialogDescription>Your frame has been created.</DialogDescription>
            <div className="flex items-center justify-center gap-2 py-4">
              <Input value={newlyCreatedUrl!} />
              <Button onClick={() => copy(newlyCreatedUrl!)}>
                {copied ? (
                  <CheckIcon className="w-5 h-5" />
                ) : (
                  <CopyIcon className="w-5 h-5" />
                )}
              </Button>
            </div>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function CopyButton({
  frame,
  env,
}: {
  frame: { slug: string };
  env: { hostUrl: string };
}) {
  const { copy, copied } = useClipboard();

  return (
    <Button
      className="w-[100px]"
      size={"sm"}
      variant={"outline"}
      onClick={() => copy(`${env.hostUrl}/${frame.slug}`)}
    >
      {copied ? "Copied!" : "Copy URL"}
    </Button>
  );
}
