/* eslint-disable @typescript-eslint/no-unused-vars */
import { json, LoaderFunctionArgs } from "@remix-run/node";
import { z } from "zod";
import { db } from "~/lib/db.server";
import { formatZodError, requirePartnerApiKey } from "~/lib/utils.server";
import { Readable, PassThrough } from "stream";

import { stringify } from "csv-stringify";
import { ModerationLog } from "@prisma/client";

const MAX_DATE_RANGE_DAYS = 365; // Maximum allowed date range in days

const querySchema = z
  .object({
    start: z.coerce.date().optional(),
    end: z.coerce.date().optional(),
  })
  .refine(
    (data) => {
      if (data.start && data.end) {
        return data.start < data.end;
      }
      return true;
    },
    {
      message: "Start date must be before end date",
    }
  );

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requirePartnerApiKey({ request });

  const { id } = params;
  if (!id) throw new Error("Channel ID is required");

  const url = new URL(request.url);
  const queryParams = Object.fromEntries(url.searchParams);
  const result = querySchema.safeParse(queryParams);

  if (!result.success) {
    return json(
      {
        message: formatZodError(result.error),
      },
      {
        status: 400,
      }
    );
  }

  const { start: rawStart, end: rawEnd } = result.data;
  const [start, end] = await getDateRange(id, rawStart, rawEnd);

  const filename = `${id}_activity_${start.toISOString().split("T")[0]}_to_${
    end.toISOString().split("T")[0]
  }.csv`;

  const stream = new PassThrough();

  await exportModerationLogs(id, start, end, stream);

  const readableStream = new ReadableStream({
    start(controller) {
      stream.on("data", (chunk) => controller.enqueue(chunk));
      stream.on("end", () => controller.close());
      stream.on("error", (err) => controller.error(err));
    },
  });

  return new Response(readableStream, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

async function getDateRange(channelId: string, rawStart?: Date, rawEnd?: Date): Promise<[Date, Date]> {
  const end = rawEnd || new Date();

  let start: Date;
  if (rawStart) {
    start = rawStart;
  } else {
    const earliestLog = await db.moderationLog.findFirst({
      where: { channelId },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    });
    start = earliestLog?.createdAt || end;
  }

  // Ensure the date range doesn't exceed the maximum allowed
  const maxStart = new Date(end);
  maxStart.setDate(maxStart.getDate() - MAX_DATE_RANGE_DAYS);
  if (start < maxStart) {
    start = maxStart;
  }

  return [start, end];
}

async function exportModerationLogs(channelId: string, start: Date, end: Date, outputStream: PassThrough) {
  const stringifier = stringify({
    header: true,
    columns: [
      "createdAt",
      "action",
      "actor",
      "reason",
      "affectedUsername",
      "affectedUserFid",
      "castHash",
      "castText",
    ],
  });

  stringifier.pipe(outputStream);

  for await (const batch of fetchModerationLogs(channelId, start, end)) {
    for (const log of batch) {
      stringifier.write(omitId(log));
    }
  }

  stringifier.end();
}

function omitId({ id, ...rest }: ModerationLog): Omit<ModerationLog, "id"> {
  return rest;
}

async function* fetchModerationLogs(channelId: string, start: Date, end: Date) {
  const batchSize = 1000;
  let lastId: string | undefined;

  while (true) {
    const logs = await db.moderationLog.findMany({
      where: {
        channelId,
        createdAt: { gte: start, lte: end },
        ...(lastId ? { id: { gt: lastId } } : {}),
      },
      orderBy: { id: "asc" },
      take: batchSize,
    });

    if (logs.length === 0) break;

    yield logs;

    lastId = logs[logs.length - 1].id;
  }
}
