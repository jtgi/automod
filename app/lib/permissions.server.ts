import { ActionType, actionDefinitions } from "./validations.server";

export type Permission = {
  name: string;
  description: string;
  id: `action:${ActionType}`;
};

export function actionToPermission(action: ActionType): Permission["id"] {
  return `action:${action}`;
}

export const permissionDefs = !actionDefinitions
  ? []
  : ([
      {
        id: `action:ban`,
        name: actionDefinitions["ban"].friendlyName,
        description: actionDefinitions["ban"].description,
      },
      {
        id: `action:hideQuietly`,
        name: actionDefinitions["hideQuietly"].friendlyName,
        description: actionDefinitions["hideQuietly"].description,
      },
      {
        id: `action:warnAndHide`,
        name: actionDefinitions["warnAndHide"].friendlyName,
        description: actionDefinitions["warnAndHide"].description,
      },
      {
        id: `action:mute`,
        name: actionDefinitions["mute"].friendlyName,
        description: actionDefinitions["mute"].description,
      },
      {
        id: `action:cooldown`,
        name: actionDefinitions["cooldown"].friendlyName,
        description: actionDefinitions["cooldown"].description,
      },
    ] as const satisfies Permission[]);
