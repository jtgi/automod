import { useLocation } from "@remix-run/react";
import { useEffect } from "react";
import { phClient } from "./posthog.client";
import { User } from "@prisma/client";

export function usePosthog(props: { user: User | null }) {
  const location = useLocation();

  useEffect(() => {
    if (props.user) {
      phClient?.identify(props.user.id, {
        name: props.user.name,
      });
    }
  }, [props.user]);

  useEffect(() => {
    phClient?.capture("$pageview");
  }, [location]);
}
