import type { MetaFunction } from "@remix-run/node";
import { json, useLoaderData } from "@remix-run/react";
import { FarcasterIcon } from "~/components/FarcasterIcon";
import { sheet } from "~/sheets.server";

export const meta: MetaFunction = () => {
  return [
    { title: "Farcaster Landscape" },
    {
      name: "description",
      content: "A collection of Brand3s that are making Farcaster possible",
    },
  ];
};

export async function loader() {
  await sheet.loadInfo();
  const rows = await sheet.sheetsByIndex[0].getRows();
  const links = rows.map((row) => ({
    name: row.get("name"),
    url: row.get("url"),
    iconUrl: row.get("icon url"),
  }));

  return json(
    {
      links,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=3600",
      },
    }
  );
}

export default function Index() {
  const { links } = useLoaderData<typeof loader>();

  return (
    <main className="flex flex-col items-center justify-center min-h-screen space-y-20 px-5">
      <FarcasterIcon className="w-32 h-32" />
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-4xl mx-auto w-full">
        {links.map((link) => (
          <a
            key={link.name}
            href={link.url}
            target="_blank"
            className="bg-white opacity-80 flex items-center gap-1 shadow-lg rounded-full font-bold underline p-1 
             w-full min-w-[200px] hover:opacity-100 transition duration-300 ease-in-out hover:shadow"
            rel="noreferrer"
          >
            {link.iconUrl ? (
              <img
                src={link.iconUrl}
                alt={link.name}
                className="inline-block w-8 h-8 rounded-full"
              />
            ) : (
              <span className="inline-block w-8 h-8 rounded-full bg-[#8865cc]" />
            )}
            {link.name}
          </a>
        ))}
      </div>
      <h1 className="font-bold uppercase text-4xl tracking-wide text-white text-center">
        Farcaster Landscape
      </h1>
    </main>
  );
}
