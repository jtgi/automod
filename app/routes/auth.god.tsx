import { ActionFunctionArgs } from "@remix-run/node";
import { Loader } from "lucide-react";
import { authenticator } from "~/lib/auth.server";
import { requireSuperAdmin } from "~/lib/utils.server";

export async function loader({ request }: ActionFunctionArgs) {
  await requireSuperAdmin({ request });

  await authenticator.authenticate("god", request, {
    successRedirect: "/~",
    failureRedirect: "/login",
  });
}

export default function Screen() {
  return (
    <div className="flex h-screen flex-row items-center justify-center">
      <Loader className="animate-spin" />
    </div>
  );
}
