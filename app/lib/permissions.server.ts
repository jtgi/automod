import { ActionType, actionDefinitions } from "./validations.server";

export type Permission = {
  name: string;
  description: string;
  id: string;
};

export function actionToPermission(action: ActionType): Permission["id"] {
  return `action:${action}`;
}

export const defaultPerms = [];

export const permissionDefs = !actionDefinitions
  ? [...defaultPerms]
  : ([
      ...defaultPerms,
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
        id: `action:cooldown`,
        name: actionDefinitions["cooldown"].friendlyName,
        description: actionDefinitions["cooldown"].description,
      },
      {
        id: `action:downvote`,
        name: actionDefinitions["downvote"].friendlyName,
        description: actionDefinitions["downvote"].description,
      },
      {
        id: `action:like`,
        name: actionDefinitions["like"].friendlyName,
        description: actionDefinitions["like"].description,
      },
    ] as const satisfies Permission[]);
