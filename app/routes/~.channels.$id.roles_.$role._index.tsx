/* eslint-disable react/no-unescaped-entities */
import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useFetcher } from "@remix-run/react";
import { redirect, typedjson, useTypedLoaderData } from "remix-typedjson";
import invariant from "tiny-invariant";
import { commitSession, getSession } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import {
  requireUser,
  requireUserCanModerateChannel,
  errorResponse,
  formatZodError,
  successResponse,
} from "~/lib/utils.server";
import { SliderField } from "~/components/ui/fields";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { Permission, permissionDefs } from "~/lib/permissions.server";
import { Switch } from "~/components/ui/switch";
import { Button } from "~/components/ui/button";
import { z } from "zod";

export async function loader({ request, params }: LoaderFunctionArgs) {
  invariant(params.id, "id is required");
  invariant(params.role, "role is required");

  const user = await requireUser({ request });
  const channel = await requireUserCanModerateChannel({
    userId: user.id,
    channelId: params.id,
  });

  const role = await db.role.findFirst({
    where: {
      channelId: channel.id,
      name: params.role,
    },
  });

  if (!role) {
    throw redirect("/404");
  }

  return typedjson({
    user,
    channel,
    role,
    permissionDefs,
  });
}

export async function action({ request, params }: ActionFunctionArgs) {
  invariant(params.id, "id is required");
  invariant(params.role, "role is required");

  const user = await requireUser({ request });
  const channel = await requireUserCanModerateChannel({
    userId: user.id,
    channelId: params.id,
  });
  const currentRole = await db.role.findFirst({
    where: {
      channelId: channel.id,
      name: params.role,
    },
  });

  if (!currentRole) {
    throw redirect("/404");
  }

  const validPerms = permissionDefs.map((perm) => perm.id) as [string, ...string[]];
  const json = await request.json();
  const result = z
    .object({
      permissions: z.record(z.enum(validPerms), z.boolean()),
    })
    .safeParse(json);

  if (!result.success) {
    return errorResponse({
      request,
      message: formatZodError(result.error),
    });
  }

  const enabledPermissions = Object.keys(result.data.permissions).filter(
    (perm) => result.data.permissions[perm] === true
  );
  await db.role.update({
    where: {
      id: currentRole.id,
    },
    data: {
      permissions: JSON.stringify(enabledPermissions),
    },
  });

  return successResponse({
    request,
    message: "Saved",
  });
}

type FormValues = {
  id: string;
  name: string;
  permissions: { [P in Permission["id"]]: boolean };
};

export default function Screen() {
  const { role, permissionDefs } = useTypedLoaderData<typeof loader>();
  const fetcher = useFetcher();

  const permissionMap = role.permissionsParsed.reduce((acc, perm) => {
    acc[perm] = true;
    return acc;
  }, {} as Record<Permission["id"], boolean>);

  const defaultValues: FormValues = {
    id: role.id,
    name: role.name,
    permissions: permissionMap,
  };

  const methods = useForm<FormValues>({
    defaultValues,
    shouldFocusError: false,
    criteriaMode: "all",
  });

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const onSubmit = (data: FormValues) => {
    fetcher.submit(data, {
      encType: "application/json",
      method: "post",
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="font-medium">Permissions</p>
      </div>
      <FormProvider {...methods}>
        <form method="post" className="w-full space-y-7" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <div className="space-y-4">
              {permissionDefs.map((permission) => (
                <SliderField key={permission.id} label={permission.name} description={permission.description}>
                  <Controller
                    name={`permissions.${permission.id}`}
                    control={control}
                    render={({ field }) => <Switch onCheckedChange={field.onChange} checked={field.value} />}
                  />
                </SliderField>
              ))}
            </div>
          </div>
          <div className="flex flex-col items-end w-full">
            <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto min-w-[100px]">
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </FormProvider>
    </div>
  );
}
