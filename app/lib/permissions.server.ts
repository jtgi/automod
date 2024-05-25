import { actions } from "./cast-actions.server";
import { actionToInstallLink } from "./utils";
import { ActionType, actionDefinitions } from "./validations.server";

export type Permission = {
  name: string;
  description: string;
  castActionInstallUrl?: string;
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
        castActionInstallUrl: actionToInstallLink(actions.find((a) => a.automodAction === "ban")!),
      },
      {
        id: `action:cooldown`,
        name: actionDefinitions["cooldown"].friendlyName,
        description: "Casts from this user will not be curated into Main for 24 hours.",
        castActionInstallUrl: actionToInstallLink(actions.find((a) => a.automodAction === "cooldown")!),
      },
      {
        id: `action:downvote`,
        name: actionDefinitions["downvote"].friendlyName,
        description: actionDefinitions["downvote"].description,
        castActionInstallUrl: actionToInstallLink(actions.find((a) => a.automodAction === "downvote")!),
      },
      {
        id: `action:like`,
        name: actionDefinitions["like"].friendlyName,
        description: actionDefinitions["like"].description,
        castActionInstallUrl: actionToInstallLink(actions.find((a) => a.automodAction === "like")!),
      },
      {
        id: `action:hideQuietly`,
        name: actionDefinitions["hideQuietly"].friendlyName,
        description: actionDefinitions["hideQuietly"].description,
        castActionInstallUrl: actionToInstallLink(actions.find((a) => a.automodAction === "hideQuietly")!),
      },
    ] as const satisfies Permission[]);
