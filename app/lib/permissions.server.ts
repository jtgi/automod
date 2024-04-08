import { ActionType, actionDefinitions } from "./validations.server";

export type Permission = {
  name: string;
  description: string;
  id: ActionType;
};

export const permissions = (["ban", "hideQuietly", "warnAndHide", "mute", "cooldown"] as const).map(
  (action) => ({
    id: `action.${action}`,
    name: actionDefinitions[action].friendlyName,
    description: actionDefinitions[action].description,
  })
);
