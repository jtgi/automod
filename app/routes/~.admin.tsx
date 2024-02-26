import { ActionFunctionArgs, LoaderFunctionArgs, json } from "@remix-run/node";
import { Form } from "@remix-run/react";
import { typedjson, useTypedActionData } from "remix-typedjson";
import { Alert } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { FieldLabel } from "~/components/ui/fields";
import { Input } from "~/components/ui/input";
import { db } from "~/lib/db.server";
import { requireAdmin } from "~/lib/utils.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin({ request });

  return json({});
}

export async function action({ request }: ActionFunctionArgs) {
  await requireAdmin({ request });

  const formData = await request.formData();
  const action = formData.get("action");

  if (action === "add-user") {
    const fid = (formData.get("fid") as string) ?? "";
    if (!fid) {
      return typedjson({ message: "Please enter a fid" }, { status: 400 });
    }

    await db.order.upsert({
      where: {
        fid: fid,
      },
      update: {},
      create: {
        fid: fid,
      },
    });

    return typedjson({ message: "User added" });
  }

  return typedjson({ message: "Invalid action" }, { status: 400 });
}

export default function Admin() {
  const actionData = useTypedActionData<typeof action>();
  return (
    <div className="space-y-8">
      {actionData?.message && <Alert>{actionData.message}</Alert>}
      <Form method="post" className="space-y-4">
        <FieldLabel
          label="Grant Access by Fid"
          className="flex-col items-start"
        >
          <Input name="fid" placeholder="123.." />
        </FieldLabel>
        <Button name="action" value="add-user">
          Grant Access
        </Button>
      </Form>
    </div>
  );
}
