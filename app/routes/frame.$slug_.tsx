import invariant from "tiny-invariant";
import { typedjson, useTypedLoaderData } from "remix-typedjson";
import { db } from "~/lib/db.server";
import { LoaderFunctionArgs } from "@remix-run/node";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { useClipboard } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { CheckIcon, CopyIcon } from "@radix-ui/react-icons";

export async function loader({ params }: LoaderFunctionArgs) {
  invariant(params.slug, "Frame slug is required");

  const frame = await db.frame.findFirstOrThrow({
    where: { slug: params.slug },
  });

  return typedjson({
    frame,
    hostUrl: process.env.HOST_URL,
  });
}

export default function FrameConfig() {
  const { hostUrl, frame } = useTypedLoaderData<typeof loader>();
  const { copy, copied } = useClipboard();

  return (
    <div>
      <Dialog defaultOpen>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Success!</DialogTitle>
            <DialogDescription>Your frame has been created.</DialogDescription>
            <div className="flex items-center justify-center gap-2 py-4">
              <Input value={`${hostUrl}/${frame.slug}`} />
              <Button onClick={() => copy(`${hostUrl}/${frame.slug}`)}>
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
