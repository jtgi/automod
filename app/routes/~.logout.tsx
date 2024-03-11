import { ActionFunctionArgs } from "@remix-run/node";
import { authenticator } from "~/lib/auth.server";

export async function action({ request }: ActionFunctionArgs) {
  return await authenticator.logout(request, {
    redirectTo: "/",
  });
}

export default function Screen() {
  return (
    <div className="flex h-screen flex-row items-center justify-center">
      Whops! You should have already been redirected.
    </div>
  );
}
