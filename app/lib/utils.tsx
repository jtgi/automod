import { useMatches } from "@remix-run/react";
import { type ClassValue, clsx } from "clsx";
import { CSSProperties, useEffect, useRef, useState } from "react";
import satori from "satori";
import { twMerge } from "tailwind-merge";
import { CastAction } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function generateFrameSvg(
  message: string,
  hostUrl: string,
  options?: {
    scale?: number;
  }
) {
  const response = await fetch(`${hostUrl}/Inter-Regular.ttf`);
  const fontBuffer = await response.arrayBuffer();
  const scale = options?.scale || 1;
  const styles: CSSProperties = {
    display: "flex",
    color: "white",
    fontFamily: "Inter Regular",
    backgroundColor: "black",
    height: "100%",
    width: "100%",
    padding: 72 * scale,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    fontSize: 18 * scale,
    fontWeight: 600,
  };

  const svg = await satori(
    <div style={styles}>
      <h1>{message}</h1>
    </div>,
    {
      width: 800 * scale,
      height: 418 * scale,
      fonts: [
        {
          name: "Inter Regular",
          data: fontBuffer,
          style: "normal",
        },
      ],
    }
  );

  return svg;
}

export function useClipboard() {
  const [copied, setCopied] = useState(false);
  const ref = useRef();

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);

      if (ref.current) {
        clearTimeout(ref.current);
      }

      setTimeout(() => setCopied(false), 1_000);
    } catch (err) {
      // cool
    }
  };

  return { copy, copied };
}

export function useRouteData<T>(routeId: string): T | undefined {
  const matches = useMatches();
  const data = matches.find((match) => match.id === routeId)?.data;

  return data as T | undefined;
}

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>();

  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key);
      setStoredValue(item ? (JSON.parse(item) as T) : initialValue);
    } catch (error) {
      console.error(`Error reading localStorage key "${key}": ${error}`);
      setStoredValue(initialValue);
    }
  }, [key, initialValue]);

  // Save or update value in localStorage
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue as T) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(`Error saving to localStorage key "${key}": ${error}`);
    }
  };

  // Remove item from localStorage
  const removeValue = () => {
    try {
      window.localStorage.removeItem(key);
      setStoredValue(initialValue);
    } catch (error) {
      console.error(`Error removing localStorage key "${key}": ${error}`);
    }
  };

  return [storedValue, setValue, removeValue] as const;
}

export function actionToInstallLink(action: CastAction) {
  const wcUrl = new URL(`https://warpcast.com/~/add-cast-action`);
  wcUrl.searchParams.append("url", action.postUrl);
  return wcUrl.toString();
}

export function grantRoleAction(role: {
  id: string;
  name: string;
  channelId: string;
  hostUrl: string;
}): CastAction {
  return {
    action: {
      type: "post",
    },
    icon: "person-add",
    name: `Grant "${role.name}"`.substring(0, 20),
    description: `Grant the "${role.name}" role in /${role.channelId} to a user`,
    postUrl: `${role.hostUrl}/api/actions/grantRole?roleId=${role.id}&channelId=${role.channelId}&roleName=${role.name}`,
    image: "todo",
    aboutUrl: "https://automod.sh",
    automodAction: "grantRole",
  };
}

export const planTypes = ["basic", "prime", "ultra", "vip"] as const;
export type PlanType = (typeof planTypes)[number];

export function meetsMinimumPlan(args: { userPlan: PlanType; minimumPlan: PlanType }) {
  return userPlans[args.userPlan].level >= userPlans[args.minimumPlan].level;
}

export const userPlans = {
  basic: {
    id: "basic",
    level: 0,
    displayName: "Basic",
    price: "free",
    link: "",
    maxChannels: 3,
    maxCasts: 3_000,
  },
  prime: {
    id: "prime",
    level: 1,
    displayName: "Prime",
    price: "$14.99/mo",
    link: "https://hypersub.withfabric.xyz/s/automod/2",
    maxChannels: 6,
    maxCasts: 25_000,
  },
  ultra: {
    id: "ultra",
    level: 2,
    displayName: "Ultra",
    price: "$39.99/mo",
    link: "https://hypersub.withfabric.xyz/s/automod",
    maxChannels: Infinity,
    maxCasts: 250_000,
  },
  vip: {
    id: "vip",
    level: 3,
    price: Infinity.toLocaleString(),
    displayName: "VIP",
    link: "",
    maxChannels: Infinity,
    maxCasts: Infinity,
  },
} as const satisfies {
  [key in PlanType]: PlanDef;
};

export type PlanDef = {
  id: PlanType;
  level: number;
  link?: string;
  price: string;
  displayName: string;
  maxChannels: number;
  maxCasts: number;
};
