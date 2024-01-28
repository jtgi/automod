import invariant from "tiny-invariant";
import { typedjson, useTypedLoaderData } from "remix-typedjson";
import { db } from "~/lib/db.server";
import { LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ params }: LoaderFunctionArgs) {
  invariant(params.slug, "Frame slug is required");

  const frame = await db.frame.findFirst({
    where: { slug: params.slug },
  });

  return typedjson({
    frame,
  });
}

export default function FrameConfig() {
  const { frame } = useTypedLoaderData<typeof loader>();

  return (
    <div>
      <h1>Frame Config</h1>
      <pre>{JSON.stringify(frame, null, 2)}</pre>
    </div>
  );
}
