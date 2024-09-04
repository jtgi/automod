import { Link } from "lucide-react";
import { typedjson, useTypedLoaderData } from "remix-typedjson";
import { db } from "~/lib/db.server";

export async function loader() {
  const checks = await db.propagationDelayCheck.findMany({
    take: 5,
    orderBy: {
      createdAt: "desc",
    },
  });

  return typedjson({ checks });
}

export default function Status() {
  const { checks } = useTypedLoaderData<typeof loader>();

  return (
    <div className="flex flex-col gap-4 p-12">
      <h1>Sync Status</h1>
      {checks.map((check) => (
        <table key={check.id}>
          <thead>
            <tr>
              <th>Created At</th>
              <th>Arrived At</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{check.createdAt.toLocaleString()}</td>
              <td>{check.arrivedAt?.toLocaleString() || "-"}</td>
              <td>
                <Link to={`https://explorer.neynyar.com/${check.hash}`}>Explorer</Link>
              </td>
            </tr>
          </tbody>
        </table>
      ))}
    </div>
  );
}
