import { ActionFunctionArgs } from "@remix-run/node";

export async function action({ request }: ActionFunctionArgs) {
  const data = await request.json();
  console.log(JSON.stringify(data, null, 2));
}
