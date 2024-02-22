import { assert, it, expect, describe, test } from "vitest";
import { faker } from "@faker-js/faker";
import { User } from "@prisma/client";
import {
  Channel as NeynarChannel,
  User as NeynarUser,
} from "@neynar/nodejs-sdk/build/neynar-api/v2";
import {
  Action,
  Rule,
  containsLinks,
  containsText,
  containsTooManyMentions,
  userDisplayNameContainsText,
  userFidInRange,
  userFollowerCount,
  userIsNotActive,
  userProfileContainsText,
} from "~/lib/validations.server";
import { Cast, UserProfile } from "@neynar/nodejs-sdk/build/neynar-api/v2";

export function user(data?: Partial<User>): User {
  return {
    id: faker.string.uuid(),
    name: faker.person.firstName(),
    email: faker.internet.email(),
    avatarUrl: faker.image.avatar(),
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
export function webhookCallback(
  overrides?: Partial<WebhookCallback>
): WebhookCallback {
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
  };
}

export function neynarChannel(
  overrides?: Partial<NeynarChannel>
): NeynarChannel {
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

export function cast(overrides?: Partial<Cast>): Cast {
  return {
    hash: faker.number.hex(42),
    parent_hash: null,
    parent_url: faker.internet.url(),
    parent_author: {
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
  };

  if (overrides?.conditions) {
    baseRule.conditions = overrides.conditions.map(rule);
  }

  return { ...baseRule, ...overrides };
}

export function action(overrides?: Partial<Action>): Action {
  return {
    type: "warnAndHide",
    ...overrides,
  };
}

describe("containsText", () => {
  it("should detect text correctly without case sensitivity", () => {
    const c = cast({ text: "Example Text" });
    const r = rule({ args: { searchText: "example", caseSensitive: false } });
    expect(containsText(c, r)).toBe(`Text contains the text: example`);
  });

  it("should detect text correctly with case sensitivity", () => {
    const c = cast({ text: "Example Text" });
    const r = rule({ args: { searchText: "Example", caseSensitive: true } });
    expect(containsText(c, r)).toBe(`Text contains the text: Example`);
  });

  it("should return undefined if text is not found", () => {
    const c = cast({ text: "Example Text" });
    const r = rule({ args: { searchText: "notfound", caseSensitive: false } });
    expect(containsText(c, r)).toBeUndefined();
  });
});

describe("containsTooManyMentions", () => {
  it("should return a message if there are too many mentions", () => {
    const c = cast({ text: "@user1 @user2 @user3" });
    const r = rule({ args: { maxMentions: 2 } });
    expect(containsTooManyMentions(c, r)).toBe(
      "Too many mentions: @user1,@user2,@user3. Max: 2"
    );
  });

  it("should return undefined if the mentions are within limit", () => {
    const c = cast({ text: "@user1 @user2" });
    const r = rule({ args: { maxMentions: 3 } });
    expect(containsTooManyMentions(c, r)).toBeUndefined();
  });
});

describe("containsLinks", () => {
  it("should detect links in the text", () => {
    const c = cast({ text: "Check out this link https://example.com" });
    const r = rule({});
    expect(containsLinks(c, r)).toBe("Too many links. Max: 0");
  });

  it("should detect links based on a threshold", () => {
    const c = cast({
      text: "Check out this link https://example.com and https://example2.com",
    });

    const r1 = rule({ args: { maxLinks: 2 } });
    expect(containsLinks(c, r1)).toBeUndefined();

    const r2 = rule({ args: { maxLinks: 1 } });
    expect(containsLinks(c, r2)).toBe("Too many links. Max: 1");
  });

  it("should return undefined if no links are found", () => {
    const c = cast({ text: "No links here" });
    const r = rule({});
    expect(containsLinks(c, r)).toBeUndefined();
  });
});

describe("userProfileContainsText", () => {
  it("should detect text in user profile bio without case sensitivity", () => {
    const c = cast({
      author: { profile: { bio: { text: "Developer and writer." } } } as any,
    });

    const r = rule({ args: { searchText: "developer", caseSensitive: false } });
    expect(userProfileContainsText(c, r)).toBe(
      "User profile contains the specified text: developer"
    );
  });

  it("should detect text in user profile bio with case sensitivity", () => {
    const c = cast({
      author: { profile: { bio: { text: "Developer and writer." } } },
    } as any);
    const r = rule({ args: { searchText: "Developer", caseSensitive: true } });
    expect(userProfileContainsText(c, r)).toBe(
      "User profile contains the specified text: Developer"
    );
  });

  it("should return undefined if text is not found in user profile bio", () => {
    const c = cast({
      author: { profile: { bio: { text: "Developer and writer." } } },
    } as any);
    const r = rule({ args: { searchText: "artist", caseSensitive: false } });
    expect(userProfileContainsText(c, r)).toBeUndefined();
  });
});

describe("userDisplayNameContainsText", () => {
  it("should detect text in user display name without case sensitivity", () => {
    const c = cast({ author: { display_name: "JohnDoe" } as any });
    const r = rule({ args: { searchText: "johndoe", caseSensitive: false } });
    expect(userDisplayNameContainsText(c, r)).toBe(
      "User display name contains text: johndoe"
    );
  });

  it("should detect text in user display name with case sensitivity", () => {
    const c = cast({ author: { display_name: "JohnDoe" } as any });
    const r = rule({ args: { searchText: "JohnDoe", caseSensitive: true } });
    expect(userDisplayNameContainsText(c, r)).toBe(
      "User display name contains text: JohnDoe"
    );
  });

  it("should return undefined if text is not found in user display name", () => {
    const c = cast({ author: { display_name: "JohnDoe" } as any });
    const r = rule({ args: { searchText: "JaneDoe", caseSensitive: false } });
    expect(userDisplayNameContainsText(c, r)).toBeUndefined();
  });
});

describe("userFollowerCount", () => {
  it("should return message if follower count is less than minimum", () => {
    const c = cast({ author: { follower_count: 50 } as any });
    const r = rule({ args: { min: 100 } });
    expect(userFollowerCount(c, r)).toBe("Follower count less than 100");
  });

  it("should return message if follower count is greater than maximum", () => {
    const c = cast({ author: { follower_count: 500 } as any });
    const r = rule({ args: { max: 300 } });
    expect(userFollowerCount(c, r)).toBe("Follower count greater than 300");
  });

  it("should return undefined if follower count is within the specified range", () => {
    const c = cast({ author: { follower_count: 200 } as any });
    const r = rule({ args: { min: 100, max: 300 } });
    expect(userFollowerCount(c, r)).toBeUndefined();
  });
});

describe("userIsNotActive", () => {
  it("should return undefined if user is active", () => {
    const c = cast({ author: { active_status: "active" } as any });
    const r = rule({});
    expect(userIsNotActive(c, r)).toBeUndefined();
  });

  it("should return a message if user is not active", () => {
    const c = cast({ author: { active_status: "inactive" } as any });
    const r = rule({});
    expect(userIsNotActive(c, r)).toBe("User is not active");
  });
});

describe("userFidInRange", () => {
  it("should return message if FID is less than minimum", () => {
    const c = cast({ author: { fid: 500 } as any });
    const r = rule({ args: { minFid: 1000 } });
    expect(userFidInRange(c, r)).toBe("FID 500 is less than 1000");
  });

  it("should return message if FID is greater than maximum", () => {
    const c = cast({ author: { fid: 2000 } as any });
    const r = rule({ args: { maxFid: 1500 } });
    expect(userFidInRange(c, r)).toBe("FID 2000 is greater than 1500");
  });

  it("should return undefined if FID is within the specified range", () => {
    const c = cast({ author: { fid: 1200 } as any });
    const r = rule({ args: { minFid: 1000, maxFid: 1500 } });
    expect(userFidInRange(c, r)).toBeUndefined();
  });
});
