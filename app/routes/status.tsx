import { LoaderFunctionArgs } from "@remix-run/node";
import { typedjson, useTypedLoaderData } from "remix-typedjson";
import { db } from "~/lib/db.server";

export async function loader() {
  const checks = await db.propagationDelayCheck.findMany({
    where: {
      arrivedAt: null,
    },
  });

  return typedjson({ checks });
}

export default function Status() {
  const { checks } = useTypedLoaderData<typeof loader>();

  return (
    <div>
      <h1>Sync Status</h1>
      <pre>{JSON.stringify(checks, null, 2)}</pre>
    </div>
  );
}
