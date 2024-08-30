todo

- socialCapitalRule
  - (2h) add this rule
- hasPowerBadge
- followerCountRule
- followedByOwnerRule
  - (5m) migration script: translate to followsUser
- followsChannelRule
  - (1h) add follows channel rule: https://docs.airstack.xyz/airstack-docs-and-faqs/farcaster/farcaster/farcaster-channels#check-if-farcaster-user-has-followed-a-given-channel
- ownsTokensRule
  - (4h) support OR'ing tokens
- poapInPersonCountRule
  - dropping support
- poapTotalCountRule
  - dropping support
- poapSpecificRule
  - dropping support
- fidRangeRule
- whitelistFidsRule
  - convert to bypass
- bannedFidsRule
  - add bans
- coModeratorFidsRule
  - create comod role
  - add each of them to cohosts

new channel wizard changes

- after selecting channel lookup airstack config and offer to import
- import should migrate according to above, notify users of incompatible rules
  - automod does not automatically detect comoderator likes, you must use cast acitions.
  - poap gating is not supported.
