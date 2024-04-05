import { getSharedEnv } from "./utils.server";

const env = getSharedEnv();

export const actions = [
  {
    actionType: "post",
    description: "Hide all messages from a user indefinitely",
    name: "Mute",
    icon: "mute",
    postUrl: `${env.hostUrl}/api/actions/mute`,
    image: `${env.hostUrl}/actions/mute.png`,
  },
  {
    actionType: "post",
    description: "Hide all messages from a user for 24 hours",
    name: "24h Cooldown",
    icon: "no-entry",
    postUrl: `${env.hostUrl}/api/actions/cooldown`,
    image: `${env.hostUrl}/actions/cooldown24.png`,
  },
  {
    actionType: "post",
    description: "Exclude the user from all moderation",
    name: "Bypass",
    icon: "shield-check",
    postUrl: `${env.hostUrl}/api/actions/addToBypass`,
    image: `${env.hostUrl}/actions/bypass.png`,
  },
] as const;
