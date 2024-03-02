/* eslint-disable react/no-unescaped-entities */
import { Plus, X } from "lucide-react";
import {
  Control,
  Controller,
  FormProvider,
  UseFormRegister,
  UseFormWatch,
  useFieldArray,
  useForm,
  useFormContext,
} from "react-hook-form";
import { redirect, typedjson, useTypedLoaderData } from "remix-typedjson";
import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Button } from "~/components/ui/button";
import {
  errorResponse,
  formatZodError,
  getSharedEnv,
  isChannelLead,
  requireUser,
} from "~/lib/utils.server";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Action,
  ActionDefinition,
  ModeratedChannelSchema,
  Rule,
  RuleDefinition,
  RuleName,
  actionDefinitions,
  ruleDefinitions,
  ruleNames,
} from "~/lib/validations.server";
import { Input } from "~/components/ui/input";
import { FieldLabel } from "~/components/ui/fields";
import { Checkbox } from "~/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { useFetcher, useSubmit } from "@remix-run/react";
import { db } from "~/lib/db.server";
import { isCohost } from "~/lib/warpcast.server";
import { getChannel, registerWebhook } from "~/lib/neynar.server";
import { commitSession, getSession } from "~/lib/auth.server";

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser({ request });
  const data = await request.json();

  const { isLead, lead } = await isChannelLead({
    userId: user.id,
    channelId: data.id,
  });

  if (!isLead) {
    return errorResponse({
      request,
      message: `Only the channel lead${
        lead ? ` (@${lead.username})` : ""
      } can setup a bot`,
    });
  }

  const channelResult = ModeratedChannelSchema.safeParse(data);

  if (!channelResult.success) {
    console.error(channelResult.error);
    return errorResponse({
      request,
      message: formatZodError(channelResult.error),
    });
  }

  const channelExists = await db.moderatedChannel.findFirst({
    where: {
      id: channelResult.data.id,
    },
  });

  if (channelExists) {
    return errorResponse({
      request,
      message: "Moderation for that channel already exists",
    });
  }

  const neynarChannel = await getChannel({ name: channelResult.data.id });

  const newChannel = await db.moderatedChannel.create({
    data: {
      id: channelResult.data.id,
      active: true,
      url: neynarChannel.url,
      user: {
        connect: {
          id: user.id,
        },
      },
      banThreshold: channelResult.data.banThreshold,
      ruleSets: {
        create: channelResult.data.ruleSets.map((ruleSet) => {
          return {
            target: ruleSet.target,
            rule: JSON.stringify(ruleSet.ruleParsed),
            actions: JSON.stringify(ruleSet.actionsParsed),
          };
        }),
      },
    },
  });

  await registerWebhook({
    rootParentUrl: neynarChannel.url,
  });

  const session = await getSession(request.headers.get("Cookie"));
  session.flash("newChannel", "yup");

  return redirect(`/~/channels/${newChannel.id}`, {
    headers: {
      "Set-Cookie": await commitSession(session),
    },
  });
}

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser({ request });

  return typedjson({
    user,
    actionDefinitions,
    ruleDefinitions,
    ruleNames,
    env: getSharedEnv(),
  });
}

export default function FrameConfig() {
  const { user, env, ruleNames, ruleDefinitions, actionDefinitions } =
    useTypedLoaderData<typeof loader>();

  return (
    <div className="space-y-4">
      <ChannelForm
        actionDefinitions={actionDefinitions}
        ruleDefinitions={ruleDefinitions}
        ruleNames={ruleNames}
        defaultValues={{
          ruleSets: [],
        }}
      />
    </div>
  );
}

export type FormValues = {
  id?: string;
  banThreshold?: number | null;
  ruleSets: Array<{
    id?: string;
    active: boolean;
    target: string;
    logicType: "and" | "or";
    ruleParsed: Array<Rule>;
    actionsParsed: Array<Action>;
  }>;
};

export function ChannelForm(props: {
  actionDefinitions: typeof actionDefinitions;
  ruleDefinitions: typeof ruleDefinitions;
  ruleNames: readonly RuleName[];
  defaultValues: FormValues;
}) {
  const fetcher = useFetcher();
  const methods = useForm<FormValues>({
    defaultValues: props.defaultValues,
    shouldFocusError: false,
  });

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { isSubmitting },
  } = methods;

  const { fields, append, remove } = useFieldArray({
    control,
    name: "ruleSets",
  });

  const onSubmit = (data: FormValues) => {
    const newRuleSets = [];
    for (let ruleSet of data.ruleSets) {
      if (ruleSet.logicType === "and") {
        const rule: Rule = {
          name: "and",
          type: "LOGICAL",
          args: {},
          operation: "AND",
          conditions: ruleSet.ruleParsed,
        };

        newRuleSets.push({
          ...ruleSet,
          rule,
          ruleParsed: rule,
        });
      } else if (ruleSet.logicType === "or") {
        const rule: Rule = {
          name: "or",
          type: "LOGICAL",
          args: {},
          operation: "OR",
          conditions: ruleSet.ruleParsed,
        };

        newRuleSets.push({
          ...ruleSet,
          rule,
          ruleParsed: rule,
        });
      }
    }

    fetcher.submit(
      {
        ...data,
        banThreshold: data.banThreshold || null,
        ruleSets: newRuleSets,
      },
      {
        encType: "application/json",
        method: "post",
      }
    );
  };

  return (
    <div>
      <FormProvider {...methods}>
        <form
          id="channel-form"
          method="post"
          className="w-full space-y-7"
          onSubmit={handleSubmit(onSubmit)}
        >
          <fieldset disabled={isSubmitting} className="space-y-7">
            <FieldLabel label="Channel Name" className="flex-col items-start">
              <Input
                disabled={!!props.defaultValues.id}
                placeholder="base"
                pattern="^[a-zA-Z0-9\-]+$"
                required
                {...register("id", { required: true })}
              />
            </FieldLabel>

            <FieldLabel
              label="Warns Before Permanently Banned"
              className="flex-col items-start"
              description="The number of warns before a user is permanently banned. Banning is not reversable. Example, if its set to 2, when the user breaks rules the 3rd time they are banned."
            >
              <Input
                type="number"
                placeholder="∞"
                {...register("banThreshold")}
              />
            </FieldLabel>
          </fieldset>

          <fieldset disabled={isSubmitting} className="space-y-7">
            {fields.map((ruleSetField, ruleSetIndex) => (
              <Card key={ruleSetField.id}>
                <CardHeader className="bg-slate-50 rounded-xl py-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-foreground">
                      Rule Set {ruleSetIndex + 1}
                    </CardTitle>
                    <Button
                      type="button"
                      variant={"ghost"}
                      onClick={() => {
                        if (
                          confirm(
                            "Are you sure you want to delete this rule set?"
                          )
                        ) {
                          remove(ruleSetIndex);
                        }
                      }}
                      className="rounded-full"
                    >
                      <X className="w-5 h-5" />
                    </Button>
                  </div>
                </CardHeader>

                <hr />

                <CardContent className="pt-4">
                  <RuleSetEditor
                    actionDefinitions={props.actionDefinitions}
                    ruleDefinitions={props.ruleDefinitions}
                    rulesNames={props.ruleNames}
                    ruleSetIndex={ruleSetIndex}
                    watch={watch}
                    control={control}
                    register={register}
                  />
                </CardContent>
              </Card>
            ))}

            <Button
              type="button"
              variant={"secondary"}
              onClick={() =>
                append({
                  id: "",
                  active: true,
                  target: "all" as const,
                  ruleParsed: [],
                  actionsParsed: [],
                  logicType: "and",
                })
              }
              className="add-ruleSet-button-class"
            >
              <Plus className="w-4 h-4 mr-1" /> Rule Set
            </Button>
          </fieldset>

          <div className="py-6">
            <hr />
          </div>

          <Button
            type="submit"
            size={"lg"}
            className="w-full"
            disabled={fetcher.state === "submitting"}
          >
            {fetcher.state === "submitting"
              ? props.defaultValues.id
                ? "Updating..."
                : "Creating..."
              : props.defaultValues.id
              ? "Update"
              : "Create"}
          </Button>
        </form>
      </FormProvider>
    </div>
  );
}

function RuleSetEditor(props: {
  actionDefinitions: typeof actionDefinitions;
  ruleDefinitions: typeof ruleDefinitions;
  rulesNames: readonly RuleName[];
  ruleSetIndex: number;
  // @ts-ignore
  control: Control<FormValues, any, FormValues>;
  register: UseFormRegister<FormValues>;
  watch: UseFormWatch<FormValues>;
}) {
  const { rulesNames, ruleSetIndex, control } = props;
  const {
    fields: ruleFields,
    remove: removeRule,
    append: appendRule,
  } = useFieldArray({
    control,
    name: `ruleSets.${ruleSetIndex}.ruleParsed`,
  });

  const {
    fields: actionFields,
    append: appendAction,
    remove: removeAction,
  } = useFieldArray({
    control,
    name: `ruleSets.${ruleSetIndex}.actionsParsed`,
  });

  return (
    <div>
      <div className="space-y-4">
        <div>
          <p className=" font-medium">Rules</p>
          <p className="text-gray-500 text-sm">
            Configure checks to verify everytime a cast comes in to your
            channel.
          </p>
        </div>

        <div className="space-y-4">
          {ruleFields.map((ruleField, ruleIndex) => {
            const ruleName = props.watch(
              `ruleSets.${ruleSetIndex}.ruleParsed.${ruleIndex}.name`
            );

            return (
              <Card key={ruleField.id} className="w-full rounded-sm">
                <CardHeader>
                  <div className="flex justify-between items-center gap-8">
                    <CardTitle className="font-normal w-full text-foreground">
                      <FieldLabel
                        label=""
                        className="flex-col items-start w-full"
                      >
                        <Controller
                          name={
                            `ruleSets.${ruleSetIndex}.ruleParsed.${ruleIndex}.name` as const
                          }
                          control={control}
                          render={({ field }) => (
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select a rule" />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(props.ruleDefinitions)
                                  .filter((args) => !args[1].hidden)
                                  .map(([name, ruleDef]) => (
                                    <SelectItem key={name} value={name}>
                                      {ruleDef.friendlyName}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </FieldLabel>
                    </CardTitle>
                    <Button
                      type="button"
                      className="rounded-full"
                      onClick={() => removeRule(ruleIndex)}
                      variant={"ghost"}
                    >
                      <X className="w-5 h-5" />
                    </Button>
                  </div>
                  <p className="text-gray-500 text-xs">
                    {props.ruleDefinitions[ruleName].description}
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <RuleArgs
                      ruleDefinition={props.ruleDefinitions[ruleName]}
                      ruleIndex={ruleIndex}
                      ruleSetIndex={ruleSetIndex}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <Button
          type="button"
          variant={"secondary"}
          onClick={() =>
            appendRule({
              name: "containsText",
              type: "CONDITION",
              args: {},
            })
          }
        >
          <Plus className="w-4 h-4 mr-1" /> Rule
        </Button>
      </div>

      <div className="py-12">
        <hr className=" border-slate-300" />
      </div>

      <div className="space-y-4">
        <div>
          <p className=" font-medium">Actions</p>
          <p className="text-gray-500 text-sm">
            Configure what actions to take when the rules are met.
          </p>
        </div>
        <div className="space-y-4">
          {actionFields.map((actionField, actionIndex) => {
            const actionType = props.watch(
              `ruleSets.${ruleSetIndex}.actionsParsed.${actionIndex}.type`
            );

            const action = props.actionDefinitions[actionType];

            return (
              <div key={actionField.id}>
                <div className="flex items-start justify-between gap-8">
                  <div className="w-full space-y-4">
                    <div>
                      <p className="w-full">
                        <Controller
                          name={`ruleSets.${ruleSetIndex}.actionsParsed.${actionIndex}.type`}
                          control={control}
                          render={({ field }) => (
                            <Select
                              // @ts-ignore
                              defaultValue={actionField.type}
                              onValueChange={field.onChange}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select an action" />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(props.actionDefinitions)
                                  .filter((args) => !args[1].hidden)
                                  .map(([actionName, actionDef]) => (
                                    <SelectItem
                                      key={actionName}
                                      value={actionName}
                                    >
                                      {actionDef.friendlyName}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </p>
                      {action && (
                        <p className="text-gray-500 text-xs mt-1">
                          {action.description}
                        </p>
                      )}
                    </div>
                    {action && Object.entries(action.args).length > 0 && (
                      <div>
                        <ActionArgs
                          actionDefinition={action}
                          actionIndex={actionIndex}
                          ruleSetIndex={ruleSetIndex}
                        />
                        <div className="py-4">
                          <hr />
                        </div>
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    onClick={() => removeAction(actionIndex)}
                    variant={"ghost"}
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            );
          })}
          <Button
            type="button"
            onClick={() => appendAction({ type: "hideQuietly" })}
            variant={"secondary"}
          >
            <Plus className="w-4 h-4 mr-1" /> Action
          </Button>
        </div>
      </div>

      <div className="py-12">
        <hr />
      </div>

      <div className="space-y-4">
        <p className=" font-medium">Apply actions when...</p>
        <Controller
          name={`ruleSets.${ruleSetIndex}.logicType`}
          control={control}
          render={(controllerProps) => (
            <RadioGroup
              name={`ruleSets.${ruleSetIndex}.logicType`}
              onValueChange={controllerProps.field.onChange}
              defaultValue={controllerProps.field.value}
            >
              <FieldLabel
                label="All rules match"
                position="right"
                labelProps={{
                  htmlFor: `ruleSets.${ruleSetIndex}.logicType.and`,
                }}
              >
                <RadioGroupItem
                  value="and"
                  id={`ruleSets.${ruleSetIndex}.logicType.and`}
                />
              </FieldLabel>
              <FieldLabel
                label="Any rule matches"
                position="right"
                labelProps={{
                  htmlFor: `ruleSets.${ruleSetIndex}.logicType.or`,
                }}
              >
                <RadioGroupItem
                  value="or"
                  id={`ruleSets.${ruleSetIndex}.logicType.or`}
                />
              </FieldLabel>
            </RadioGroup>
          )}
        />
      </div>

      <div className="py-12">
        <hr />
      </div>

      <div className="space-y-4 pb-8">
        <p className="font-medium">What casts should be checked?</p>
        <Controller
          name={`ruleSets.${ruleSetIndex}.target`}
          control={control}
          render={(controllerProps) => (
            <RadioGroup
              name={`ruleSets.${ruleSetIndex}.target`}
              onValueChange={controllerProps.field.onChange}
              defaultValue={controllerProps.field.value}
            >
              <FieldLabel
                label="All"
                position="right"
                labelProps={{
                  htmlFor: `ruleSets.${ruleSetIndex}.target.all`,
                }}
              >
                <RadioGroupItem
                  value="all"
                  id={`ruleSets.${ruleSetIndex}.target.all`}
                />
              </FieldLabel>
              <FieldLabel
                label="Root Level"
                description=" - Only casts at the root level of the channel."
                position="right"
                labelProps={{
                  htmlFor: `ruleSets.${ruleSetIndex}.target.root`,
                }}
              >
                <RadioGroupItem
                  value="root"
                  id={`ruleSets.${ruleSetIndex}.target.root`}
                />
              </FieldLabel>
              <FieldLabel
                label="Replies"
                description=" - Only replies to other casts."
                position="right"
                labelProps={{
                  htmlFor: `ruleSets.${ruleSetIndex}.target.replies`,
                }}
              >
                <RadioGroupItem
                  value="reply"
                  id={`ruleSets.${ruleSetIndex}.target.replies`}
                />
              </FieldLabel>
            </RadioGroup>
          )}
        />
      </div>
    </div>
  );
}

function RuleArgs(props: {
  ruleDefinition: RuleDefinition;
  ruleIndex: number;
  ruleSetIndex: number;
}) {
  const { register, control } = useFormContext<FormValues>();
  const ruleDef = props.ruleDefinition;

  return Object.entries(ruleDef.args).map(([argName, argDef]) => {
    if (argDef.type === "number") {
      return (
        <FieldLabel
          key={argName}
          label={argDef.friendlyName}
          description={argDef.description}
          className="flex-col items-start"
        >
          <Input
            type="number"
            required={argDef.required}
            {...register(
              `ruleSets.${props.ruleSetIndex}.ruleParsed.${props.ruleIndex}.args.${argName}`
            )}
          />
        </FieldLabel>
      );
    }
    if (argDef.type === "string") {
      return (
        <FieldLabel
          key={argName}
          label={argDef.friendlyName}
          description={argDef.description}
          className="flex-col items-start"
        >
          <Input
            required={argDef.required}
            {...register(
              `ruleSets.${props.ruleSetIndex}.ruleParsed.${props.ruleIndex}.args.${argName}`
            )}
          />
        </FieldLabel>
      );
    }
    if (argDef.type === "boolean") {
      return (
        <FieldLabel
          key={argName}
          label={argDef.friendlyName}
          className="gap-2"
          labelProps={{
            htmlFor: `ruleSets.${props.ruleSetIndex}.ruleParsed.${props.ruleIndex}.args.${argName}`,
          }}
          // description={argDef.description}
          position="right"
        >
          <Controller
            control={control}
            name={`ruleSets.${props.ruleSetIndex}.ruleParsed.${props.ruleIndex}.args.${argName}`}
            render={({ field: { onChange, name, value } }) => (
              <Checkbox
                id={`ruleSets.${props.ruleSetIndex}.ruleParsed.${props.ruleIndex}.args.${argName}`}
                name={name}
                onCheckedChange={onChange}
                checked={value}
              />
            )}
          />
        </FieldLabel>
      );
    }
  });
}

function ActionArgs(props: {
  actionDefinition: ActionDefinition;
  actionIndex: number;
  ruleSetIndex: number;
}) {
  const { register, control } = useFormContext<FormValues>();
  const actionDef = props.actionDefinition;

  return Object.entries(actionDef.args).map(([argName, argDef]) => {
    if (argDef.type === "number") {
      return (
        <FieldLabel
          key={argName}
          label={argDef.friendlyName}
          description={argDef.description}
          className="flex-col items-start"
        >
          <Input
            type="number"
            required={argDef.required}
            {...register(
              `ruleSets.${props.ruleSetIndex}.actionsParsed.${props.actionIndex}.args.${argName}` as any
            )}
          />
        </FieldLabel>
      );
    }
    if (argDef.type === "string") {
      return (
        <FieldLabel
          key={argName}
          label={argDef.friendlyName}
          description={argDef.description}
          className="flex-col items-start"
        >
          <Input
            required={argDef.required}
            {...register(
              `ruleSets.${props.ruleSetIndex}.actionsParsed.${props.actionIndex}.args.${argName}` as any
            )}
          />
        </FieldLabel>
      );
    }
    if (argDef.type === "boolean") {
      return (
        <FieldLabel
          key={argName}
          label={argDef.friendlyName}
          className="gap-2"
          labelProps={{
            htmlFor: `ruleSets.${props.ruleSetIndex}.actionsParsed.${props.actionIndex}.args.${argName}`,
          }}
          // description={argDef.description}
          position="right"
        >
          <Controller
            control={control}
            name={
              `ruleSets.${props.ruleSetIndex}.actionsParsed.${props.actionIndex}.args.${argName}` as any
            }
            render={({ field: { onChange, name, value } }) => (
              <Checkbox
                id={`ruleSets.${props.ruleSetIndex}.actionsParsed.${props.actionIndex}.args.${argName}`}
                name={name}
                onCheckedChange={onChange}
                checked={value}
              />
            )}
          />
        </FieldLabel>
      );
    }
  });
}
