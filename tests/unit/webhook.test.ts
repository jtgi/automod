import * as warpcast from "~/lib/warpcast.server";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import axios from "axios";
import {
  action,
  cast,
  neynarChannel,
  neynarUser,
  rule,
  user,
} from "./validations.test";
import { validateCast } from "~/routes/api.webhooks.neynar";
import { prisma } from "tests/setup";

vi.mock("axios", () => {
  const axiosDefaultMock = vi.fn(() =>
    Promise.resolve({ data: "default response" })
  ) as any;
  axiosDefaultMock.get = vi.fn(() => Promise.resolve({ data: "get response" }));
  axiosDefaultMock.post = vi.fn(() =>
    Promise.resolve({ data: "post response" })
  );
  axiosDefaultMock.put = vi.fn(() => Promise.resolve({ data: "put response" }));
  return { default: axiosDefaultMock };
});

describe("validateCast", () => {
  const nc0 = neynarChannel({
    id: "jtgi",
    name: "jtgi",
    lead: neynarUser({ fid: 5179 }),
  });

  const u0 = user({
    id: "5179",
    name: "jtgi",
    email: "gm@gm.com",
  });

  beforeEach(async () => {
    vi.resetAllMocks();

    await prisma.user.create({
      data: u0,
    });
  });

  afterEach(async () => {
    try {
      await prisma.moderationLog.deleteMany();
      await prisma.ruleSet.deleteMany();
      await prisma.moderatedChannel.deleteMany();
      await prisma.inviteCode.deleteMany();
      await prisma.otp.deleteMany();
      await prisma.user.deleteMany();
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  it("simply contains text", async () => {
    const mc = await prisma.moderatedChannel.create({
      data: {
        id: "jtgi",
        userId: u0.id,
        banThreshold: 3,
        ruleSets: {
          create: [
            {
              rule: JSON.stringify(
                rule({
                  name: "containsText",
                  type: "CONDITION",
                  args: {
                    searchText: "spam",
                    caseSensitive: true,
                  },
                })
              ),
              actions: JSON.stringify([
                action({ type: "warnAndHide" }),
                action({ type: "ban" }),
              ]),
            },
          ],
        },
      },
      include: { user: true, ruleSets: { where: { active: true } } },
    });

    await validateCast({
      channel: nc0,
      moderatedChannel: mc,
      cast: cast({
        text: "spam",
        hash: "gm",
        author: neynarUser({
          fid: 5179,
          username: "jtgi",
          pfp_url: "https://google.com",
        }),
      }),
    });

    expect(axios.put).toHaveBeenCalledWith(
      `https://client.warpcast.com/v2/debug-cast-embeds`,
      {
        castHash: "gm",
        downvote: true,
        isWarning: true,
      },
      expect.objectContaining({
        headers: expect.anything(),
      })
    );

    expect(axios.put).toHaveBeenCalledWith(
      `https://client.warpcast.com/v1/user-channel-ban`,
      {
        channelKey: "jtgi",
        fid: 5179,
        banned: true,
      },
      expect.objectContaining({
        headers: expect.anything(),
      })
    );

    const logs = await prisma.moderationLog.findMany({
      where: { channelId: mc.id },
    });

    expect(logs).toHaveLength(2);
    expect(logs[0]).toMatchObject(
      expect.objectContaining({
        action: "warnAndHide",
        castHash: "gm",
        affectedUserFid: "5179",
        affectedUsername: "jtgi",
        affectedUserAvatarUrl: "https://google.com",
        reason: "Text contains the text: spam",
      })
    );
    expect(logs[1]).toMatchObject(
      expect.objectContaining({
        action: "ban",
        castHash: "gm",
        affectedUserFid: "5179",
        affectedUsername: "jtgi",
        affectedUserAvatarUrl: "https://google.com",
        reason: "Text contains the text: spam",
      })
    );
  });

  it("simply doesn't match text", async () => {
    const mc = await prisma.moderatedChannel.create({
      data: {
        id: "jtgi",
        userId: u0.id,
        banThreshold: 3,
        excludeCohosts: true,
        ruleSets: {
          create: [
            {
              rule: JSON.stringify(
                rule({
                  name: "or",
                  type: "LOGICAL",
                  args: {},
                  conditions: [
                    rule({
                      name: "containsText",
                      type: "CONDITION",
                      args: {
                        searchText: "wowowo",
                        caseSensitive: true,
                      },
                    }),
                    rule({
                      name: "containsText",
                      type: "CONDITION",
                      args: {
                        searchText: "ok",
                        caseSensitive: true,
                      },
                    }),
                  ],
                })
              ),
              actions: JSON.stringify([action({ type: "warnAndHide" })]),
            },
          ],
        },
      },
      include: { user: true, ruleSets: { where: { active: true } } },
    });

    await validateCast({
      channel: nc0,
      moderatedChannel: mc,
      cast: cast({
        text: "nothing",
        hash: "nomatch-cast",
        author: neynarUser({
          fid: 5179,
          username: "jtgi",
          pfp_url: "https://google.com",
        }),
      }),
    });

    expect(axios.put).not.toHaveBeenCalled();

    const logs = await prisma.moderationLog.findMany({
      where: { channelId: mc.id },
    });

    expect(logs).toHaveLength(0);
  });

  it("triggers action when ANDs match", async () => {
    const mc = await prisma.moderatedChannel.create({
      data: {
        id: "jtgi",
        userId: u0.id,
        banThreshold: 3,
        ruleSets: {
          create: [
            {
              rule: JSON.stringify(
                rule({
                  name: "and",
                  type: "LOGICAL",
                  operation: "AND",
                  args: {},
                  conditions: [
                    rule({
                      name: "containsText",
                      type: "CONDITION",
                      args: {
                        searchText: "spam",
                        caseSensitive: true,
                      },
                    }),
                    rule({
                      name: "containsText",
                      type: "CONDITION",
                      args: {
                        searchText: "wowowo",
                        caseSensitive: true,
                      },
                    }),
                  ],
                })
              ),
              actions: JSON.stringify([action({ type: "warnAndHide" })]),
            },
          ],
        },
      },
      include: { user: true, ruleSets: { where: { active: true } } },
    });

    await validateCast({
      channel: nc0,
      moderatedChannel: mc,
      cast: cast({
        text: "spam wowowo and other things",
      }),
    });

    expect(axios.put).toHaveBeenCalledOnce();

    const logs = await prisma.moderationLog.findMany({
      where: { channelId: mc.id },
    });

    expect(logs).toHaveLength(1);
  });

  it("does not trigger action unless all ANDs match", async () => {
    const mc = await prisma.moderatedChannel.create({
      data: {
        id: "jtgi",
        userId: u0.id,
        banThreshold: 3,
        ruleSets: {
          create: [
            {
              rule: JSON.stringify(
                rule({
                  name: "and",
                  type: "LOGICAL",
                  operation: "AND",
                  args: {},
                  conditions: [
                    rule({
                      name: "containsText",
                      type: "CONDITION",
                      args: {
                        searchText: "spam",
                        caseSensitive: true,
                      },
                    }),
                    rule({
                      name: "containsText",
                      type: "CONDITION",
                      args: {
                        searchText: "wowowo",
                        caseSensitive: true,
                      },
                    }),
                    rule({
                      name: "containsText",
                      type: "CONDITION",
                      args: {
                        searchText: "jingle bells",
                        caseSensitive: true,
                      },
                    }),
                  ],
                })
              ),
              actions: JSON.stringify([action({ type: "warnAndHide" })]),
            },
          ],
        },
      },
      include: { user: true, ruleSets: { where: { active: true } } },
    });

    await validateCast({
      channel: nc0,
      moderatedChannel: mc,
      cast: cast({
        text: "spam wowowo and other things",
      }),
    });

    expect(axios.put).not.toHaveBeenCalled();

    const logs = await prisma.moderationLog.findMany({
      where: { channelId: mc.id },
    });

    expect(logs).toHaveLength(0);
  });

  it("triggers action if any OR condition matches", async () => {
    const mc = await prisma.moderatedChannel.create({
      data: {
        id: "jtgi",
        userId: u0.id,
        banThreshold: 3,
        ruleSets: {
          create: [
            {
              rule: JSON.stringify(
                rule({
                  name: "or",
                  type: "LOGICAL",
                  operation: "OR",
                  args: {},
                  conditions: [
                    rule({
                      name: "containsText",
                      type: "CONDITION",
                      args: {
                        searchText: "spam",
                        caseSensitive: true,
                      },
                    }),
                    rule({
                      name: "containsText",
                      type: "CONDITION",
                      args: {
                        searchText: "wowowo",
                        caseSensitive: true,
                      },
                    }),
                  ],
                })
              ),
              actions: JSON.stringify([action({ type: "warnAndHide" })]),
            },
          ],
        },
      },
      include: { user: true, ruleSets: { where: { active: true } } },
    });

    await validateCast({
      channel: nc0,
      moderatedChannel: mc,
      cast: cast({
        text: "spam only", // wowow is omitted
      }),
    });

    expect(axios.put).toHaveBeenCalledOnce();

    const logs = await prisma.moderationLog.findMany({
      where: { channelId: mc.id },
    });

    expect(logs).toHaveLength(1);
  });

  it("does not trigger action unless ORs match", async () => {
    const mc = await prisma.moderatedChannel.create({
      data: {
        id: "jtgi",
        userId: u0.id,
        banThreshold: 3,
        ruleSets: {
          create: [
            {
              rule: JSON.stringify(
                rule({
                  name: "or",
                  type: "LOGICAL",
                  operation: "OR",
                  args: {},
                  conditions: [
                    rule({
                      name: "containsText",
                      type: "CONDITION",
                      args: {
                        searchText: "spam",
                        caseSensitive: true,
                      },
                    }),
                    rule({
                      name: "containsText",
                      type: "CONDITION",
                      args: {
                        searchText: "wowowo",
                        caseSensitive: true,
                      },
                    }),
                  ],
                })
              ),
              actions: JSON.stringify([action({ type: "warnAndHide" })]),
            },
          ],
        },
      },
      include: { user: true, ruleSets: { where: { active: true } } },
    });

    await validateCast({
      channel: nc0,
      moderatedChannel: mc,
      cast: cast({
        text: "nothing to see here", // spam and wowow is omitted
      }),
    });

    expect(axios.put).not.toHaveBeenCalled();

    const logs = await prisma.moderationLog.findMany({
      where: { channelId: mc.id },
    });

    expect(logs).toHaveLength(0);
  });

  it("should only check root casts", async () => {
    const mc = await prisma.moderatedChannel.create({
      data: {
        id: "jtgi",
        userId: u0.id,
        banThreshold: 3,
        ruleSets: {
          create: [
            {
              rule: JSON.stringify(
                rule({
                  name: "containsText",
                  type: "CONDITION",
                  args: {
                    searchText: "spam",
                    caseSensitive: true,
                  },
                })
              ),
              target: "root",
              actions: JSON.stringify([action({ type: "warnAndHide" })]),
            },
          ],
        },
      },
      include: { user: true, ruleSets: { where: { active: true } } },
    });

    await validateCast({
      channel: nc0,
      moderatedChannel: mc,
      cast: cast({
        text: "spam",
        hash: "gm",
        // This is a reply to another cast
        parent_hash: "parent",
      }),
    });

    const logs = await prisma.moderationLog.findMany({
      where: { channelId: mc.id },
    });

    expect(logs).toHaveLength(0);
  });

  it("should only check reply casts", async () => {
    const mc = await prisma.moderatedChannel.create({
      data: {
        id: "jtgi",
        userId: u0.id,
        banThreshold: 3,
        ruleSets: {
          create: [
            {
              rule: JSON.stringify(
                rule({
                  name: "containsText",
                  type: "CONDITION",
                  args: {
                    searchText: "spam",
                    caseSensitive: true,
                  },
                })
              ),
              target: "reply",
              actions: JSON.stringify([action({ type: "warnAndHide" })]),
            },
          ],
        },
      },
      include: { user: true, ruleSets: { where: { active: true } } },
    });

    await validateCast({
      channel: nc0,
      moderatedChannel: mc,
      cast: cast({
        text: "spam",
        hash: "gm",
        // This is a root level cast
        parent_hash: null,
      }),
    });

    const logs = await prisma.moderationLog.findMany({
      where: { channelId: mc.id },
    });

    expect(logs).toHaveLength(0);
  });

  it("should put user in cooldown", async () => {
    const mc = await prisma.moderatedChannel.create({
      data: {
        id: "jtgi",
        userId: u0.id,
        banThreshold: 3,
        ruleSets: {
          create: [
            {
              rule: JSON.stringify(
                rule({
                  name: "containsText",
                  type: "CONDITION",
                  args: {
                    searchText: "spam",
                    caseSensitive: true,
                  },
                })
              ),
              actions: JSON.stringify([
                action({ type: "cooldown", args: { duration: 1 } }),
              ]),
            },
          ],
        },
      },
      include: { user: true, ruleSets: { where: { active: true } } },
    });

    await validateCast({
      channel: nc0,
      moderatedChannel: mc,
      cast: cast({
        text: "spam",
        hash: "gm",
        author: neynarUser({
          fid: 5179,
          username: "jtgi",
          pfp_url: "https://google.com",
        }),
      }),
    });

    const logs = await prisma.moderationLog.findMany({
      where: { channelId: mc.id },
    });

    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe("cooldown");

    await validateCast({
      channel: nc0,
      moderatedChannel: mc,
      cast: cast({
        text: "text that doenst break rules",
        hash: "gm",
        author: neynarUser({
          fid: 5179,
          username: "jtgi",
          pfp_url: "https://google.com",
        }),
      }),
    });

    const logs2 = await prisma.moderationLog.findMany({
      where: { channelId: mc.id },
    });

    expect(logs2).toHaveLength(2);
    expect(logs2[1].action).toBe("hideQuietly");
  });

  it("should exclude usernames", async () => {
    const mc = await prisma.moderatedChannel.create({
      data: {
        id: "jtgi",
        userId: u0.id,
        banThreshold: 3,
        excludeUsernames: JSON.stringify(["jtgi"]),
        ruleSets: {
          create: [
            {
              rule: JSON.stringify(
                rule({
                  name: "containsText",
                  type: "CONDITION",
                  args: {
                    searchText: "spam",
                    caseSensitive: true,
                  },
                })
              ),
              actions: JSON.stringify([action({ type: "warnAndHide" })]),
            },
          ],
        },
      },
      include: { user: true, ruleSets: { where: { active: true } } },
    });

    await validateCast({
      channel: nc0,
      moderatedChannel: mc,
      cast: cast({
        text: "spam",
        hash: "gm",
        author: neynarUser({
          fid: 5179,
          username: "jtgi",
          pfp_url: "https://google.com",
        }),
      }),
    });

    const logs = await prisma.moderationLog.findMany({
      where: { channelId: mc.id },
    });

    expect(logs).toHaveLength(0);
  });

  it("should mute the user", async () => {
    const mc = await prisma.moderatedChannel.create({
      data: {
        id: "jtgi",
        userId: u0.id,
        banThreshold: 3,
        excludeCohosts: true,
        ruleSets: {
          create: [
            {
              rule: JSON.stringify(
                rule({
                  name: "containsText",
                  type: "CONDITION",
                  args: {
                    searchText: "spam",
                    caseSensitive: true,
                  },
                })
              ),
              actions: JSON.stringify([action({ type: "mute" })]),
            },
          ],
        },
      },
      include: { user: true, ruleSets: { where: { active: true } } },
    });

    await validateCast({
      channel: nc0,
      moderatedChannel: mc,
      cast: cast({
        text: "spam",
        hash: "gm",
        author: neynarUser({
          fid: 5179,
          username: "jtgi",
          pfp_url: "https://google.com",
        }),
      }),
    });

    const logs = await prisma.moderationLog.findMany({
      where: { channelId: mc.id },
    });

    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe("mute");

    await validateCast({
      channel: nc0,
      moderatedChannel: mc,
      cast: cast({
        text: "text that doenst break rules",
        hash: "gm",
        author: neynarUser({
          fid: 5179,
          username: "jtgi",
          pfp_url: "https://google.com",
        }),
      }),
    });

    const logs2 = await prisma.moderationLog.findMany({
      where: { channelId: mc.id },
    });

    expect(logs2).toHaveLength(2);
    expect(logs2[1].action).toBe("hideQuietly");
  });

  // it("ban threshold works", async () => {
  //   const mc = await prisma.moderatedChannel.create({
  //     data: {
  //       id: "jtgi",
  //       userId: u0.id,
  //       banThreshold: 1,
  //       ruleSets: {
  //         create: [
  //           {
  //             rule: JSON.stringify(
  //               rule({
  //                 name: "containsText",
  //                 type: "CONDITION",
  //                 args: {
  //                   searchText: "spam",
  //                   caseSensitive: true,
  //                 },
  //               })
  //             ),
  //             actions: JSON.stringify([action({ type: "warnAndHide" })]),
  //           },
  //           {
  //             rule: JSON.stringify(
  //               rule({
  //                 name: "containsText",
  //                 type: "CONDITION",
  //                 args: {
  //                   searchText: "pepe",
  //                   caseSensitive: true,
  //                 },
  //               })
  //             ),
  //             actions: JSON.stringify([action({ type: "warnAndHide" })]),
  //           },
  //         ],
  //       },
  //     },
  //     include: { user: true, ruleSets: { where: { active: true } } },
  //   });

  //   const c1 = cast({
  //     author: neynarUser({
  //       fid: 5179,
  //       username: "jtgi",
  //       pfp_url: "https://google.com",
  //     }),
  //     text: "spam and pepe",
  //     hash: "gm",
  //   });

  //   await validateCast({
  //     channel: nc0,
  //     moderatedChannel: mc,
  //     cast: c1,
  //   });

  //   expect(axios.put).toHaveBeenCalledTimes(2);
  //   const logs = await prisma.moderationLog.findMany({
  //     where: { channelId: mc.id },
  //   });

  //   expect(logs).toHaveLength(2);
  //   expect(logs[0].action).toBe("warnAndHide");

  //   // 2nd violation with a different cast hash,
  //   // now they should get banned
  //   await validateCast({
  //     channel: nc0,
  //     moderatedChannel: mc,
  //     cast: cast({
  //       author: neynarUser({
  //         fid: 5179,
  //         username: "jtgi",
  //         pfp_url: "https://google.com",
  //       }),
  //       text: "spam",
  //       hash: "not-gm",
  //     }),
  //   });

  //   const logs2 = await prisma.moderationLog.findMany({
  //     where: { channelId: mc.id },
  //   });
  //   expect(logs2).toHaveLength(3);
  //   expect(logs2[2].action).toBe("ban");
  //   expect(logs2[2].reason).toBe(
  //     `User exceeded warn threshold of 1 and is banned.`
  //   );
  // });
});
