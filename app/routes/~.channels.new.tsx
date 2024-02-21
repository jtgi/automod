/* eslint-disable react/no-unescaped-entities */
import { X } from "lucide-react";
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

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser({ request });
  const data = await request.json();

  const { isLead, channel } = await isChannelLead(user.id, data.id);
  if (!isLead) {
    return errorResponse({
      request,
      message:
        "Only the channel lead can configure moderation. If the lead has changed, please contact support.",
    });
  }

  const channelResult = ModeratedChannelSchema.safeParse(data);

  if (!channelResult.success) {
    console.error(channelResult.error);
    return errorResponse({
      request,
      message: "Invalid data.",
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
      message: "Channel already exists",
    });
  }

  const newChannel = await db.moderatedChannel.create({
    data: {
      id: channelResult.data.id,
      user: {
        connect: {
          id: user.id,
        },
      },
      banThreshold: channelResult.data.banThreshold,
      ruleSets: {
        create: channelResult.data.ruleSets.map((ruleSet) => {
          return {
            id: ruleSet.id,
            rule: JSON.stringify(ruleSet.ruleParsed),
            actions: JSON.stringify(ruleSet.actionsParsed),
          };
        }),
      },
    },
  });

  return redirect(`/~/channels/${newChannel.id}`);
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
      <h2>New Moderation</h2>
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
        banThreshold: data.banThreshold || 0,
        ruleSets: newRuleSets,
      },
      {
        encType: "application/json",
        method: "post",
      }
    );
  };

  return (
    <div className="flex">
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
              label="Ban Threshold"
              className="flex-col items-start"
              description="The number of warns before a user is banned."
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
                <CardHeader className="bg-slate-50 rounded-xl">
                  <div className="flex items-center justify-between">
                    <CardTitle>Rule Set {ruleSetIndex + 1}</CardTitle>
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
                  ruleParsed: [],
                  actionsParsed: [],
                  logicType: "and",
                })
              }
              className="add-ruleSet-button-class"
            >
              Add Rule Set
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
                  <div className="flex justify-between">
                    <CardTitle className=" font-normal">
                      <FieldLabel
                        label="Type"
                        className="flex-col items-start w-full"
                        description={
                          props.ruleDefinitions[ruleName].description
                        }
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
                      className="rounded-full p-0 "
                      onClick={() => removeRule(ruleIndex)}
                      variant={"ghost"}
                    >
                      <X className="w-5 h-5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <RuleArgs
                      ruleDefinition={props.ruleDefinitions[ruleName]}
                      ruleName={ruleName}
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
          Add Rule
        </Button>
      </div>

      <div className="py-12">
        <hr />
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

            return (
              <div
                key={actionField.id}
                className="flex items-start justify-between gap-8"
              >
                <p className="w-full">
                  <Controller
                    name={`ruleSets.${ruleSetIndex}.actionsParsed.${actionIndex}.type`}
                    control={control}
                    render={({ field }) => (
                      <Select
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
                              <SelectItem key={actionName} value={actionName}>
                                {actionDef.friendlyName}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <span className="text-gray-500 text-xs pl-3">
                    {props.actionDefinitions[actionType].description}
                  </span>
                </p>
                <Button
                  type="button"
                  onClick={() => removeAction(actionIndex)}
                  variant={"ghost"}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            );
          })}
          <Button
            type="button"
            onClick={() => appendAction({ type: "hideQuietly" })}
            variant={"secondary"}
          >
            Add Action
          </Button>
        </div>
      </div>

      <div className="py-12">
        <hr />
      </div>

      <div className="space-y-4 pb-8">
        <p className=" font-medium">Apply actions when...</p>
        <Controller
          name={`ruleSets.${ruleSetIndex}.logicType`}
          control={control}
          render={(controllerProps) => (
            <RadioGroup
              name={`ruleSets.${ruleSetIndex}.logicType`}
              defaultValue="and"
              onValueChange={controllerProps.field.onChange}
              {...controllerProps}
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
    </div>
  );
}

function RuleArgs(props: {
  ruleDefinition: RuleDefinition;
  ruleName: RuleName;
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
