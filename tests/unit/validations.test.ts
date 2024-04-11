/* eslint-disable no-useless-escape */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { it, expect, describe, vi, Mocked, beforeEach } from "vitest";
import { faker } from "@faker-js/faker";
import { ModeratedChannel, User } from "@prisma/client";
import { Channel as NeynarChannel, User as NeynarUser, Cast } from "@neynar/nodejs-sdk/build/neynar-api/v2";
import {
  Action,
  Rule,
  containsLinks,
  containsEmbeds,
  containsText,
  containsTooManyMentions,
  textMatchesPattern,
  userDisplayNameContainsText,
  userFidInRange,
  userFollowerCount,
  userProfileContainsText,
  castLength,
  userIsNotActive,
} from "~/lib/validations.server";
import RE2 from "re2";
import { NeynarCastWithFrame, WebhookCast } from "~/lib/types";
import { neynar } from "~/lib/neynar.server";

vi.mock("~/lib/neynar.server", () => {
  return {
    neynar: {
      fetchBulkCasts: vi.fn(),
    },
  };
});

export function moderatedChannel(data?: Partial<ModeratedChannel>): ModeratedChannel {
  return {
    id: faker.string.uuid(),
    imageUrl: faker.internet.userName(),
    active: true,
    url: faker.internet.url(),
    userId: faker.string.uuid(),
    excludeCohosts: false,
    excludeUsernames: "[]",
    banThreshold: null,
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    ...data,
  };
}

export function user(data?: Partial<User>): User {
  return {
    id: faker.string.uuid(),
    name: faker.person.firstName(),
    email: faker.internet.email(),
    avatarUrl: faker.image.avatar(),
    planExpiry: null,
    planTokenId: null,
    role: "admin",
    plan: "basic",
    inviteCodeId: null,
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    ...data,
  };
}

type WebhookCallback = {
  created_at: number;
  type: string;
  data: Cast;
};
export function webhookCallback(overrides?: Partial<WebhookCallback>): WebhookCallback {
  return {
    created_at: faker.date.past().getTime(),
    type: faker.lorem.word(),
    data: cast(),
    ...overrides,
  };
}

export function neynarUser(overrides?: Partial<NeynarUser>): NeynarUser {
  return {
    object: "user",
    fid: faker.number.int(),
    custody_address: faker.finance.ethereumAddress(),
    username: faker.internet.userName(),
    display_name: faker.person.fullName(),
    pfp_url: faker.image.avatar(),
    profile: {
      bio: {
        text: faker.lorem.sentences(),
        mentioned_profiles: [],
      },
    },
    follower_count: faker.number.int(),
    following_count: faker.number.int(),
    verifications: [faker.finance.ethereumAddress()],
    active_status: "active",
    ...overrides,
  } as NeynarUser;
}

export function neynarChannel(overrides?: Partial<NeynarChannel>): NeynarChannel {
  return {
    id: faker.string.uuid(),
    url: faker.internet.url(),
    name: faker.internet.userName(),
    description: faker.lorem.sentence(),
    object: "channel",
    image_url: faker.image.url(),
    created_at: faker.date.past().getTime(),
    lead: neynarUser(),
    ...overrides,
  };
}

export function cast(overrides?: Partial<NeynarCastWithFrame>): WebhookCast {
  return {
    hash: faker.number.hex(42),
    parent_hash: null,
    thread_hash: faker.number.hex(42),
    // @ts-ignore
    root_parent_url: faker.number.hex(42),
    parent_url: faker.internet.url(),
    frames: [],
    parent_author: {
      // @ts-ignore
      fid: "518",
    },
    author: neynarUser(),
    text: faker.lorem.sentence(),
    timestamp: faker.date.recent().toISOString(),
    embeds: [],
    ...overrides,
  };
}

export function rule(overrides?: Partial<Rule>): Rule {
  const baseRule: Rule = {
    name: "containsText",
    type: "CONDITION",
    args: {
      searchText: "example",
      caseSensitive: false,
    },
    invert: false,
  };

  if (overrides?.conditions) {
    baseRule.conditions = overrides.conditions.map(rule);
  }

  return { ...baseRule, ...overrides };
}

export function action(overrides?: Partial<Action>): Action {
  return {
    type: "warnAndHide",
    args: {},
    ...overrides,
  } as any;
}

const m = moderatedChannel({
  id: "gm",
  userId: "1",
  imageUrl: "https://example.com/image.jpg",
  url: "https://example.com/channel",
});

describe("containsText", () => {
  it("should detect text correctly without case sensitivity", () => {
    const c = cast({ text: "Example Text" });
    const r = rule({ args: { searchText: "example", caseSensitive: false } });
    expect(containsText({ channel: m, cast: c, rule: r })).toBe(`Text contains the text: example`);
  });

  it("should detect text correctly with case sensitivity", () => {
    const c = cast({ text: "Example Text" });
    const r = rule({ args: { searchText: "Example", caseSensitive: true } });
    expect(containsText({ channel: m, cast: c, rule: r })).toBe(`Text contains the text: Example`);
  });

  it("should invert the check if the rule is inverted", () => {
    const c = cast({ text: "Example Text" });
    const r = rule({
      invert: true,
      args: { searchText: "example", caseSensitive: false },
    });
    expect(containsText({ channel: m, cast: c, rule: r })).toBeUndefined();
  });

  it("should return undefined if text is not found", () => {
    const c = cast({ text: "Example Text" });
    const r = rule({ args: { searchText: "notfound", caseSensitive: false } });
    expect(containsText({ channel: m, cast: c, rule: r })).toBeUndefined();
  });
});

describe("textMatchesPattern", () => {
  it("should detect text matches pattern", () => {
    const c = cast({ text: "Example Text" });
    const r = rule({ args: { pattern: "Example" } });
    expect(textMatchesPattern({ channel: m, cast: c, rule: r })).toBe(`Text matches pattern: Example`);
  });

  it("should match regex", () => {
    const c = cast({ text: "this is $token Text" });
    const r = rule({ args: { pattern: "[a-zA-Z]+" } });
    expect(textMatchesPattern({ channel: m, cast: c, rule: r })).toBe(`Text matches pattern: [a-zA-Z]+`);
  });

  it("should handle regex with backslash", () => {
    const c = cast({ text: "this is $token Text" });
    const r = rule({ args: { pattern: "\\$[a-zA-Z]+" } });
    expect(textMatchesPattern({ channel: m, cast: c, rule: r })).toBe(`Text matches pattern: \\$[a-zA-Z]+`);
  });

  it("should invert the check if the rule is inverted", () => {
    const c = cast({ text: "Example Text" });
    const r = rule({ args: { pattern: "Example" }, invert: true });
    expect(new RE2("Example").test("Example Text")).toBe(true);
    expect(textMatchesPattern({ channel: m, cast: c, rule: r })).toBeUndefined();
  });

  it("should return undefined if text does not match the pattern", () => {
    const c = cast({ text: "Example Text" });
    const r = rule({ args: { pattern: "notfound" } });
    expect(textMatchesPattern({ channel: m, cast: c, rule: r })).toBeUndefined();
  });
});

describe("containsTooManyMentions", () => {
  it("should return a message if there are too many mentions", () => {
    const c = cast({ text: "@user1 @user2 @user3" });
    const r = rule({ args: { maxMentions: 2 } });
    expect(containsTooManyMentions({ channel: m, cast: c, rule: r })).toBe(
      "Too many mentions: @user1,@user2,@user3. Max: 2"
    );
  });

  it("should return undefined if the mentions are within limit", () => {
    const c = cast({ text: "@user1 @user2" });
    const r = rule({ args: { maxMentions: 3 } });
    expect(containsTooManyMentions({ channel: m, cast: c, rule: r })).toBeUndefined();
  });

  it("should invert the check if the rule is inverted", () => {
    const c = cast({ text: "@user1 @user2 @user3" });
    const r = rule({ args: { maxMentions: 2 }, invert: true });
    expect(containsTooManyMentions({ channel: m, cast: c, rule: r })).toBeUndefined();
  });
});

describe("containsLinks", () => {
  it("should detect links in the text", () => {
    const c = cast({ text: "Check out this link https://example.com" });
    const r = rule({});
    expect(containsLinks({ channel: m, cast: c, rule: r })).toBe("Too many links. Max: 0");
  });

  it("should detect links based on a threshold", () => {
    const c = cast({
      text: "Check out this link https://example.com and https://example2.com",
    });

    const r1 = rule({ args: { maxLinks: 2 } });
    expect(containsLinks({ channel: m, cast: c, rule: r1 })).toBeUndefined();

    const r2 = rule({ args: { maxLinks: 1 } });
    expect(containsLinks({ channel: m, cast: c, rule: r2 })).toBe("Too many links. Max: 1");
  });

  it("should invert the check if the rule is inverted", () => {
    const c = cast({ text: "Check out this link https://example.com" });
    const r = rule({ args: { maxLinks: 0 }, invert: true });
    expect(containsLinks({ channel: m, cast: c, rule: r })).toBeUndefined();
  });

  it("should return undefined if no links are found", () => {
    const c = cast({ text: "No links here" });
    const r = rule({});
    expect(containsLinks({ channel: m, cast: c, rule: r })).toBeUndefined();
  });
});

describe("castLength", () => {
  it("should return a message if the cast is too long", () => {
    const c = cast({ text: "a".repeat(300) });
    const r = rule({ args: { max: 200 } });
    expect(castLength({ channel: m, cast: c, rule: r })).toBe("Cast length exceeds 200 characters");
  });

  it("should return undefined if the cast is within the limit", () => {
    const c = cast({ text: "a".repeat(100) });
    const r = rule({ args: { min: undefined, max: 200 } });
    expect(castLength({ channel: m, cast: c, rule: r })).toBeUndefined();
  });

  it("should return a message if the cast is too short", () => {
    const c = cast({ text: "a".repeat(100) });
    const r = rule({ args: { min: 200 } });
    expect(castLength({ channel: m, cast: c, rule: r })).toBe("Cast length is less than 200 characters");
  });
});

describe("containsEmbeds", () => {
  beforeEach(() => {
    (neynar as Mocked<typeof neynar>).fetchBulkCasts.mockReset();
  });

  it("should detect frames", async () => {
    const c = cast({
      frames: [{ frames_url: "https://google.com" } as any],
      text: "Check out this frame",
    });

    (neynar as Mocked<typeof neynar>).fetchBulkCasts.mockResolvedValue({
      result: {
        casts: [c as any],
      },
    });

    const r = rule({
      args: {
        frames: true,
      },
    });

    expect(await containsEmbeds({ channel: m, cast: c, rule: r })).toBe("Contains embedded content: frame");
  });

  it("should detect only links", async () => {
    const c = cast({
      frames: [{ frames_url: "https://google.com" } as any],
      embeds: [{ url: "https://example.com/image.jpg" }, { url: "https://divide.cash" }],
      text: "Check out this frame",
    });

    (neynar as Mocked<typeof neynar>).fetchBulkCasts.mockResolvedValue({
      result: {
        casts: [c as any],
      },
    });

    const r = rule({
      args: {
        links: true,
      },
    });

    expect(await containsEmbeds({ channel: m, cast: c, rule: r })).toBe("Contains embedded content: link");
  });

  it("should detect images", async () => {
    const c = cast({
      embeds: [{ url: "https://example.com/image.jpg" }],
      text: "Check out this image",
    });
    const r = rule({
      args: {
        images: true,
        videos: true,
      },
    });

    expect(await containsEmbeds({ channel: m, cast: c, rule: r })).toBe("Contains embedded content: image");
  });

  it("should detect video and not image", async () => {
    const c = cast({
      embeds: [
        { url: "https://example.com/image.jpg" },
        {
          url: "https://example.com/video.m3u8",
        },
      ],
      text: "Check out this image",
    });
    const r = rule({
      args: {
        images: false,
        videos: true,
      },
    });

    expect(await containsEmbeds({ channel: m, cast: c, rule: r })).toBe("Contains embedded content: video");
  });

  it("should support invert", async () => {
    const c = cast({
      embeds: [
        { url: "https://example.com/image.jpg" },
        {
          url: "https://example.com/video.m3u8",
        },
      ],
      text: "Check out this image",
    });

    const r = rule({
      args: {
        images: false,
        videos: true,
      },
      invert: true,
    });

    expect(await containsEmbeds({ channel: m, cast: c, rule: r })).toBeUndefined();
  });

  it("should fail if inverted and embed type not found", async () => {
    const c = cast({
      embeds: [
        {
          url: "https://example.com/video.m3u8",
        },
      ],
      text: "Check out this image",
    });

    const r = rule({
      args: {
        images: true,
        videos: true,
      },
      invert: true,
    });

    expect(await containsEmbeds({ channel: m, cast: c, rule: r })).toBe(
      "Does not contain embedded content: image"
    );
  });
});

describe("userProfileContainsText", () => {
  it("should detect text in user profile bio without case sensitivity", () => {
    const c = cast({
      author: { profile: { bio: { text: "Developer and writer." } } } as any,
    });

    const r = rule({ args: { searchText: "developer", caseSensitive: false } });
    expect(userProfileContainsText({ channel: m, cast: c, rule: r })).toBe(
      "User profile contains the specified text: developer"
    );
  });

  it("should detect text in user profile bio with case sensitivity", () => {
    const c = cast({
      author: { profile: { bio: { text: "Developer and writer." } } },
    } as any);
    const r = rule({ args: { searchText: "Developer", caseSensitive: true } });
    expect(userProfileContainsText({ channel: m, cast: c, rule: r })).toBe(
      "User profile contains the specified text: Developer"
    );
  });

  it("should invert the check if the rule is inverted", () => {
    const c = cast({
      author: { profile: { bio: { text: "just a writer." } } },
    } as any);
    const r = rule({
      args: { searchText: "developer", caseSensitive: false, invert: true },
    });
    expect(userProfileContainsText({ channel: m, cast: c, rule: r })).toBeUndefined();
  });

  it("should return undefined if text is not found in user profile bio", () => {
    const c = cast({
      author: { profile: { bio: { text: "Developer and writer." } } },
    } as any);
    const r = rule({ args: { searchText: "artist", caseSensitive: false } });
    expect(userProfileContainsText({ channel: m, cast: c, rule: r })).toBeUndefined();
  });
});

describe("userDisplayNameContainsText", () => {
  it("should detect text in user display name without case sensitivity", () => {
    const c = cast({ author: { display_name: "JohnDoe" } as any });
    const r = rule({ args: { searchText: "johndoe", caseSensitive: false } });
    expect(userDisplayNameContainsText({ channel: m, cast: c, rule: r })).toBe(
      "User display name contains text: johndoe"
    );
  });

  it("should detect text in user display name with case sensitivity", () => {
    const c = cast({ author: { display_name: "JohnDoe" } as any });
    const r = rule({ args: { searchText: "JohnDoe", caseSensitive: true } });
    expect(userDisplayNameContainsText({ channel: m, cast: c, rule: r })).toBe(
      "User display name contains text: JohnDoe"
    );
  });

  it("should invert the check if the rule is inverted", () => {
    const c = cast({ author: { display_name: "john" } as any });
    const r = rule({
      args: { searchText: "sean", caseSensitive: false, invert: true },
    });
    expect(userDisplayNameContainsText({ channel: m, cast: c, rule: r })).toBeUndefined();
  });

  it("should return undefined if text is not found in user display name", () => {
    const c = cast({ author: { display_name: "JohnDoe" } as any });
    const r = rule({ args: { searchText: "JaneDoe", caseSensitive: false } });
    expect(userDisplayNameContainsText({ channel: m, cast: c, rule: r })).toBeUndefined();
  });
});

describe("userFollowerCount", () => {
  it("should return message if follower count is less than minimum", () => {
    const c = cast({ author: { follower_count: 50 } as any });
    const r = rule({ args: { min: 100 } });
    expect(userFollowerCount({ channel: m, cast: c, rule: r })).toBe("Follower count less than 100");
  });

  it("should return message if follower count is greater than maximum", () => {
    const c = cast({ author: { follower_count: 500 } as any });
    const r = rule({ args: { max: 300 } });
    expect(userFollowerCount({ channel: m, cast: c, rule: r })).toBe("Follower count greater than 300");
  });

  it("should return undefined if follower count is within the specified range", () => {
    const c = cast({ author: { follower_count: 200 } as any });
    const r = rule({ args: { min: 100, max: 300 } });
    expect(userFollowerCount({ channel: m, cast: c, rule: r })).toBeUndefined();
  });
});

describe("userIsNotActive", () => {
  it("should return undefined if user is active", () => {
    const c = cast({ author: { active_status: "active" } as any });
    const r = rule({});
    expect(userIsNotActive({ channel: m, cast: c, rule: r })).toBeUndefined();
  });

  it('should invert the rule if "invert" is set', () => {
    const c = cast({ author: { active_status: "active" } as any });
    const r = rule({ invert: true });
    expect(userIsNotActive({ channel: m, cast: c, rule: r })).toBe("User is active");
  });

  it("should return a message if user is not active", () => {
    const c = cast({ author: { active_status: "inactive" } as any });
    const r = rule({});
    expect(userIsNotActive({ channel: m, cast: c, rule: r })).toBe("User is not active");
  });
});

describe("userFidInRange", () => {
  it("should return message if FID is less than minimum", () => {
    const c = cast({ author: { fid: 500 } as any });
    const r = rule({ args: { minFid: 1000 } });
    expect(userFidInRange({ channel: m, cast: c, rule: r })).toBe("FID 500 is less than 1000");
  });

  it("should return message if FID is greater than maximum", () => {
    const c = cast({ author: { fid: 2000 } as any });
    const r = rule({ args: { maxFid: 1500 } });
    expect(userFidInRange({ channel: m, cast: c, rule: r })).toBe("FID 2000 is greater than 1500");
  });

  it("should return undefined if FID is within the specified range", () => {
    const c = cast({ author: { fid: 1200 } as any });
    const r = rule({ args: { minFid: 1000, maxFid: 1500 } });
    expect(userFidInRange({ channel: m, cast: c, rule: r })).toBeUndefined();
  });
});
