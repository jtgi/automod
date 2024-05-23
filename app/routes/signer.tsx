/* eslint-disable @typescript-eslint/no-explicit-any */
import { useLoaderData, useNavigate } from "@remix-run/react";
import { Loader } from "lucide-react";
import { useState, useEffect } from "react";
import { ClientOnly } from "remix-utils/client-only";
import { Button } from "~/components/ui/button";
import { getSharedEnv } from "~/lib/utils.server";

export async function loader() {
  return {
    env: getSharedEnv(),
  };
}

export default function Screen() {
  const { env } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [loggingIn, setLoggingIn] = useState(false);

  const onSuccess = (data: { signer_uuid: string; fid: string }) => {
    setLoggingIn(true);

    const params = new URLSearchParams();
    params.append("signerUuid", data.signer_uuid);
    params.append("fid", data.fid);

    navigate(`/api/signer?${params}`, {
      replace: true,
    });
  };

  useEffect(() => {
    function appendButton() {
      let script = document.getElementById("siwn-script") as HTMLScriptElement | null;

      if (!script) {
        script = document.createElement("script");
        script.id = "siwn-script";
        document.body.appendChild(script);
      }

      script.src = "https://neynarxyz.github.io/siwn/raw/1.2.0/index.js";
      script.async = true;
      script.defer = true;

      document.body.appendChild(script);
    }

    function bindSignInSuccess() {
      const win = window as any;

      if (!win._onSignInSuccess) {
        win._onSignInSuccess = onSuccess;
      }
    }

    appendButton();
    bindSignInSuccess();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-full w-full">
      <ClientOnly fallback={<Button size="lg">Loading...</Button>}>
        {() => {
          return (
            <>
              {loggingIn ? (
                <Button size={"lg"} className="w-[200px]">
                  <Loader className="animate-spin w-5 h-5" />
                </Button>
              ) : (
                <div
                  onClick={() => setLoggingIn(true)}
                  className="neynar_signin"
                  data-theme="dark"
                  data-styles='{ "font-size": "16px", "font-weight": "bold" }'
                  data-client_id={env.neynarClientId}
                  data-success-callback="_onSignInSuccess"
                />
              )}
            </>
          );
        }}
      </ClientOnly>
    </div>
  );
}
