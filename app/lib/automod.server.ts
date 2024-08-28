import { Cast } from "@neynar/nodejs-sdk/build/neynar-api/v2";
import { neynar } from "./neynar.server";
import { Action } from "./validations.server";
import { db } from "./db.server";

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function cooldown({ channel, cast, action }: { channel: string; cast: Cast; action: Action }) {
  const { duration } = (action as any).args;

  return db.cooldown.upsert({
    where: {
      affectedUserId_channelId: {
        affectedUserId: String(cast.author.fid),
        channelId: channel,
      },
    },
    update: {
      active: true,
      expiresAt: new Date(Date.now() + duration * 60 * 60 * 1000),
    },
    create: {
      affectedUserId: String(cast.author.fid),
      channelId: channel,
      expiresAt: new Date(Date.now() + duration * 60 * 60 * 1000),
    },
  });
}

export async function mute({ channel, cast, action }: { channel: string; cast: Cast; action: Action }) {
  return db.cooldown.upsert({
    where: {
      affectedUserId_channelId: {
        affectedUserId: String(cast.author.fid),
        channelId: channel,
      },
    },
    update: {
      active: true,
      expiresAt: null,
    },
    create: {
      affectedUserId: String(cast.author.fid),
      channelId: channel,
      expiresAt: null,
    },
  });
}

export async function hideQuietly({
  channel,
  cast,
  action,
  options,
}: {
  channel: string;
  cast: Cast;
  action: Action;
  options?: {
    executeOnProtocol?: boolean;
  };
}) {
  if (options?.executeOnProtocol) {
    await unlike({ channel, cast });
  } else {
    return Promise.resolve();
  }
}

export async function addToBypass({
  channel,
  cast,
  action,
}: {
  channel: string;
  cast: Cast;
  action: Action;
}) {
  const moderatedChannel = await db.moderatedChannel.findFirstOrThrow({
    where: {
      id: channel,
    },
  });

  const existing = moderatedChannel.excludeUsernamesParsed || [];

  if (existing.some((u) => u.value === cast.author.fid)) {
    return;
  }

  existing.push({
    value: cast.author.fid,
    label: cast.author.username,
    icon: cast.author.pfp_url,
  });

  return db.moderatedChannel.update({
    where: {
      id: channel,
    },
    data: {
      excludeUsernames: JSON.stringify(existing),
    },
  });
}

export async function downvote({ channel, cast, action }: { channel: string; cast: Cast; action: Action }) {
  if (action.type !== "downvote") {
    return;
  }

  const { voterFid, voterAvatarUrl, voterUsername } = action.args;
  await db.moderatedChannel.findFirstOrThrow({
    where: {
      id: channel,
    },
  });

  await db.downvote.upsert({
    where: {
      fid_castHash: {
        fid: String(voterFid),
        castHash: cast.hash,
      },
    },
    update: {},
    create: {
      castHash: cast.hash,
      channelId: channel,
      fid: voterFid,
      username: voterUsername,
      avatarUrl: voterAvatarUrl,
    },
  });
}

/**
 * This does not check permissions
 */
export async function grantRole({ channel, cast, action }: { channel: string; cast: Cast; action: Action }) {
  const { roleId } = (action as any).args;
  await db.role.findFirstOrThrow({
    where: {
      channelId: channel,
      id: roleId,
    },
  });

  const user = await neynar.lookupUserByUsername(cast.author.username);

  return db.delegate.upsert({
    where: {
      fid_roleId_channelId: {
        fid: String(cast.author.fid),
        roleId,
        channelId: channel,
      },
    },
    update: {},
    create: {
      fid: String(cast.author.fid),
      roleId,
      channelId: channel,
      avatarUrl: user.result.user.pfp.url,
      username: cast.author.username,
    },
  });
}

export async function unlike(props: { cast: Cast; channel: string }) {
  const signerAlloc = await db.signerAllocation.findFirst({
    where: {
      channelId: props.channel,
    },
    include: {
      signer: true,
    },
  });

  const uuid = signerAlloc?.signer.signerUuid || process.env.NEYNAR_SIGNER_UUID!;

  console.log(
    `Unliking with @${signerAlloc ? signerAlloc.signer.username : "automod"}, cast: ${props.cast.hash}`
  );

  await neynar.deleteReactionFromCast(uuid, "like", props.cast.hash);
}

export async function ban({ channel, cast }: { channel: string; cast: Cast; action: Action }) {
  // indefinite cooldown
  return db.cooldown.upsert({
    where: {
      affectedUserId_channelId: {
        affectedUserId: String(cast.author.fid),
        channelId: channel,
      },
    },
    update: {
      active: true,
      expiresAt: null,
    },
    create: {
      affectedUserId: String(cast.author.fid),
      channelId: channel,
      expiresAt: null,
    },
  });
}
