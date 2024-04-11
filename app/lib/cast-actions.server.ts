import { CastAction } from "./types";
import { getSharedEnv } from "./utils.server";
import { actionDefinitions } from "./validations.server";

const env = getSharedEnv();

export const actions = [
  {
    actionType: "post",
    description: "Hide all messages from a user indefinitely",
    automodAction: "mute",
    name: "Mute",
    icon: "mute",
    postUrl: `${env.hostUrl}/api/actions/mute`,
    image: `${env.hostUrl}/actions/mute.png`,
  },
  {
    actionType: "post",
    description: "Hide all messages from a user for 24 hours",
    automodAction: "cooldown",
    name: "24h Cooldown",
    icon: "no-entry",
    postUrl: `${env.hostUrl}/api/actions/cooldown`,
    image: `${env.hostUrl}/actions/cooldown24.png`,
  },
  {
    actionType: "post",
    description: "Exclude the user from all moderation",
    name: "Bypass",
    automodAction: "addToBypass",
    icon: "shield-check",
    postUrl: `${env.hostUrl}/api/actions/addToBypass`,
    image: `${env.hostUrl}/actions/bypass.png`,
  },
  {
    automodAction: "hideQuietly",
    actionType: "post",
    name: actionDefinitions["hideQuietly"].friendlyName,
    description: actionDefinitions["hideQuietly"].description,
    icon: "eye-closed",
    postUrl: `${env.hostUrl}/api/actions/hideQuietly`,
    image: `${env.hostUrl}/actions/hideQuietly.png`,
  },
  {
    automodAction: "ban",
    actionType: "post",
    name: actionDefinitions["ban"].friendlyName,
    description: actionDefinitions["ban"].description,
    icon: "sign-out",
    postUrl: `${env.hostUrl}/api/actions/ban`,
    image: `${env.hostUrl}/actions/ban.png`,
  },
  {
    automodAction: "warnAndHide",
    actionType: "post",
    name: actionDefinitions["warnAndHide"].friendlyName,
    description: actionDefinitions["warnAndHide"].description,
    icon: "megaphone",
    postUrl: `${env.hostUrl}/api/actions/warnAndHide`,
    image: `${env.hostUrl}/actions/warnAndHide.png`,
  },
] as const satisfies Array<CastAction>;
