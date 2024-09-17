/* eslint-disable @typescript-eslint/no-explicit-any */
import { FullModeratedChannel } from "~/lib/types";
import { db } from "./db.server";
import axios, { AxiosError } from "axios";

export type notifTypes = "usage";

export async function sendNotification(props: {
  moderatedChannel: FullModeratedChannel;
  fid: string;
  nonce: string;
  type: notifTypes;
  message: string;
}) {
  const { moderatedChannel, type, fid, nonce, message } = props;
  const alreadySent = await db.notification.findFirst({
    where: {
      userId: moderatedChannel.user.id,
      type,
      nonce,
    },
  });

  if (alreadySent) {
    console.log(`Already sent notification to ${fid}. Skipping.`);
    return;
  }

  try {
    await axios.put(
      "https://api.warpcast.com/v2/ext-send-direct-cast",
      {
        recipientFid: +fid,
        message,
        idempotencyKey: nonce,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WARPCAST_DM_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (e: any) {
    const err = e as AxiosError;
    if (err.response?.status === 403) {
      console.error(`Cannot send notification to ${fid} due to settings`);
      return;
    } else if (err.response?.status === 429) {
      console.error(`Rate limited sending notification to ${fid}. Giving up.`);
      return;
    } else if (err.response && err.response.status >= 400 && err.response.status <= 500) {
      console.log(`Likely double-send issue. Continuing.`);
    }
  }

  await db.notification.create({
    data: {
      userId: moderatedChannel.user.id,
      type,
      message,
      nonce,
    },
  });
}
