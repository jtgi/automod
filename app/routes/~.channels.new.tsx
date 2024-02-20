/* eslint-disable react/no-unescaped-entities */
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
import { typedjson, useTypedLoaderData } from "remix-typedjson";
import { LoaderFunctionArgs } from "@remix-run/node";
import { Button } from "~/components/ui/button";
import { getSharedEnv, requireUser } from "~/lib/utils.server";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Action,
  Rule,
  RuleDefinition,
  RuleName,
  ruleDefinitions,
  ruleNames,
} from "~/lib/validations.server";
import { Input } from "~/components/ui/input";
import { FieldLabel } from "~/components/ui/fields";
import { Checkbox } from "~/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser({ request });
  const env = getSharedEnv();

  return typedjson({
    user,
    ruleDefinitions,
    ruleNames,
    env: getSharedEnv(),
  });
}

export default function FrameConfig() {
  const { user, env, ruleNames, ruleDefinitions } =
    useTypedLoaderData<typeof loader>();

  return (
    <div className="space-y-4">
      <h2>New Moderation</h2>
      <ChannelForm
        ruleDefinitions={ruleDefinitions}
        ruleNames={ruleNames}
        defaultValues={{
          ruleSets: [],
        }}
      />
    </div>
  );
}

type FormValues = {
  id?: string;
  banThreshold?: number;
  ruleSets: Array<{
    id?: string;
    ruleParsed: Array<Rule>;
    actionsParsed: Array<Action>;
  }>;
};

export function ChannelForm(props: {
  ruleDefinitions: typeof ruleDefinitions;
  ruleNames: readonly RuleName[];
  defaultValues: FormValues;
}) {
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
    console.log(data);
  };

  const value = watch();

  return (
    <div className="flex">
      <FormProvider {...methods}>
        <form
          method="post"
          className="w-full space-y-7"
          onSubmit={handleSubmit(onSubmit)}
        >
          <fieldset disabled={isSubmitting} className="space-y-7">
            {fields.map((ruleSetField, ruleSetIndex) => (
              <Card key={ruleSetField.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Rule Set {ruleSetIndex + 1}</CardTitle>
                    <Button
                      type="button"
                      variant={"ghost"}
                      onClick={() => {
                        if (confirm("Are you sure?")) {
                          remove(ruleSetIndex);
                        }
                      }}
                      className="text-red-400"
                    >
                      Remove
                    </Button>
                  </div>
                </CardHeader>

                <CardContent>
                  <RuleSetEditor
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
              onClick={() =>
                append({ id: "", ruleParsed: [], actionsParsed: [] })
              }
              className="add-ruleSet-button-class"
            >
              Add RuleSet
            </Button>
          </fieldset>
          <button type="submit" className="submit-button-class">
            Submit
          </button>
        </form>
      </FormProvider>
      <pre className="text-xs">{JSON.stringify(value, null, 2)}</pre>
    </div>
  );
}

function RuleSetEditor(props: {
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
    // @ts-ignore
    name: `ruleSets.${ruleSetIndex}.ruleParsed`,
  });

  const {
    fields: actionFields,
    append: appendAction,
    remove: removeAction,
  } = useFieldArray({
    control,
    // @ts-ignore
    name: `ruleSets.${ruleSetIndex}.actionsParsed`,
  });

  return (
    <div>
      <div className="space-y-4">
        <h3>Rules</h3>
        <div className="space-y-4">
          {ruleFields.map((ruleField, ruleIndex) => {
            const ruleName = props.watch(
              `ruleSets.${ruleSetIndex}.ruleParsed.${ruleIndex}.name`
            );

            return (
              <Card key={ruleField.id}>
                <CardHeader>
                  <CardTitle>
                    {props.ruleDefinitions[ruleName].friendlyName}
                  </CardTitle>
                </CardHeader>
                <CardContent>
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
                        <SelectTrigger>
                          <SelectValue placeholder="Select a rule" />
                        </SelectTrigger>
                        <SelectContent>
                          {rulesNames.map((ruleName) => (
                            <SelectItem key={ruleName} value={ruleName}>
                              {props.ruleDefinitions[ruleName].friendlyName} -{" "}
                              <span className="text-gray-500">
                                {props.ruleDefinitions[ruleName].description}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />

                  <RuleArgs
                    ruleDefinition={props.ruleDefinitions[ruleName]}
                    ruleName={ruleName}
                    ruleIndex={ruleIndex}
                    ruleSetIndex={ruleSetIndex}
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
        <Button
          type="button"
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

      <div>
        <h3>Actions</h3>
        {/* Actions */}
        {actionFields.map((actionField, actionIndex) => (
          <div key={actionField.id}>
            {/* Action inputs */}
            <Button
              type="button"
              onClick={() => removeAction(actionIndex)}
              variant={"destructive"}
            >
              Remove Action
            </Button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => appendAction({ type: "hideQuietly" })}
          className="add-action-button-class"
        >
          Add Action
        </button>
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

  return (
    <div className="space-y-4">
      {Object.entries(ruleDef.args).map(([argName, argDef]) => {
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
              description={argDef.description}
              position="right"
            >
              <Controller
                control={control}
                name={`ruleSets.${props.ruleSetIndex}.ruleParsed.${props.ruleIndex}.args.${argName}`}
                render={({ field: { onChange, name, value } }) => (
                  <Checkbox
                    name={name}
                    onCheckedChange={onChange}
                    checked={value}
                  />
                )}
              />
            </FieldLabel>
          );
        }
      })}
    </div>
  );
}
