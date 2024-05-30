/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/no-unescaped-entities */
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  Action,
  ActionDefinition,
  ActionType,
  Rule,
  RuleDefinition,
  RuleName,
  actionDefinitions,
  ruleDefinitions,
} from "~/lib/validations.server";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "~/components/ui/accordion";

import { loader as jobStatusLoader } from "~/routes/api.channels.$id.simulations.$jobId";
import { Input } from "~/components/ui/input";
import { FieldLabel, SliderField } from "~/components/ui/fields";
import { Checkbox } from "~/components/ui/checkbox";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { useFetcher } from "@remix-run/react";
import { Switch } from "~/components/ui/switch";
import { Bot, Plus, ServerCrash, X } from "lucide-react";
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

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Button } from "./ui/button";
import { useEffect, useRef, useState } from "react";
import { cn } from "~/lib/utils";
import { Textarea } from "./ui/textarea";
import { Dialog, DialogTitle, DialogContent, DialogDescription, DialogHeader } from "./ui/dialog";
import { action } from "~/routes/api.channels.$id.simulations";
import { JobState as BullJobState } from "bullmq";
import { SimulationResult } from "~/routes/~.channels.$id.tools";
import { ClientOnly } from "remix-utils/client-only";
import { Alert } from "./ui/alert";

export type FormValues = {
  id?: string;
  banThreshold?: number | null;
  excludeUsernames?: string;
  excludeCohosts: boolean;
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
    criteriaMode: "all",
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

  const [openRule, setOpenRule] = useState(0);

  const onSubmit = (data: FormValues) => {
    fetcher.submit(prepareFormValues(data), {
      encType: "application/json",
      method: "post",
    });
  };

  // watch the "id" field with react-hook-form
  const channelId = watch("id");

  return (
    <div className="w-full">
      <FormProvider {...methods}>
        <form id="channel-form" method="post" className="w-full space-y-7" onSubmit={handleSubmit(onSubmit)}>
          {!props.defaultValues.id && (
            <>
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

                {/* <FieldLabel
                label="Warns Before Permanently Banned"
                className="flex-col items-start"
                description="The number of warns before a user is permanently banned. Banning is not reversable. Example, if its set to 2, when the user breaks rules the 3rd time they are banned."
              >
                <Input
                  type="number"
                  placeholder="∞"
                  {...register("banThreshold")}
                />
              </FieldLabel> */}
              </fieldset>

              <div className="py-6">
                <hr />
              </div>
            </>
          )}

          <fieldset disabled={isSubmitting} className="space-y-6 w-full">
            <div>
              <p className="font-semibold">Filtering Rules</p>
              <p className="text-gray-500 text-sm">
                Use rules to filter out the bad stuff. Anything else will be included in Main.
              </p>
            </div>

            <div>
              <Accordion
                type="single"
                collapsible
                className="w-full mb-6"
                value={openRule === undefined ? "item-0" : `item-${openRule}`}
                onValueChange={(value) => setOpenRule(Number(value.split("-")[1]))}
              >
                {fields.map((ruleSetField, ruleSetIndex) => (
                  <AccordionItem
                    key={ruleSetField.id}
                    value={`item-${ruleSetIndex}`}
                    className={ruleSetField.active ? "" : "opacity-50 "}
                  >
                    <AccordionTrigger
                      className={cn(
                        "hover:no-underline no-underline w-full py-2 px-4 border bg-slate-50/50 hover:bg-slate-50 data-[state=open]:rounded-b-none",
                        ruleSetIndex === 0 ? "rounded-t-lg" : "",
                        ruleSetIndex === fields.length - 1
                          ? "data-[state=closed]:rounded-b-lg data-[state=open]:rounded-b-none"
                          : ""
                      )}
                      hideChevron
                    >
                      <p className="font-semibold">
                        Rule Set {ruleSetIndex + 1}{" "}
                        {!ruleSetField.active && <span className="text-yellow-700">(Disabled)</span>}
                      </p>

                      <Button
                        type="button"
                        variant={"ghost"}
                        asChild
                        onClick={() => {
                          if (confirm("Are you sure you want to delete this rule set?")) {
                            remove(ruleSetIndex);
                          }
                        }}
                        className="rounded-full -mr-3 no-underline text-slate-500 hover:text-slate-700 hover:bg-slate-50/50 data-[state=open]:rounded-b-none"
                      >
                        <a href="#delete">
                          <X className="w-5 h-5" />
                        </a>
                      </Button>
                    </AccordionTrigger>

                    <AccordionContent
                      className={`p-6 border ${ruleSetField.active ? "" : "pointer-events-none"}`}
                    >
                      {!ruleSetField.active && (
                        <Alert variant={"destructive"} className="mb-4 text-yellow-700 border-yellow-500">
                          This rule is no longer supported and has been disabled. You may delete it anytime.
                        </Alert>
                      )}
                      <RuleSetEditor
                        actionDefinitions={props.actionDefinitions}
                        ruleDefinitions={props.ruleDefinitions}
                        rulesNames={props.ruleNames}
                        ruleSetIndex={ruleSetIndex}
                        watch={watch}
                        control={control}
                        register={register}
                      />
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>

              <Button
                type="button"
                variant={"secondary"}
                onClick={() => {
                  append({
                    id: "",
                    active: true,
                    target: "all" as const,
                    ruleParsed: [],
                    actionsParsed: [],
                    logicType: "and",
                  });

                  setOpenRule(fields.length);
                }}
                className="w-full sm:w-auto"
              >
                <Plus className="w-4 h-4 mr-1" /> Rule Set
              </Button>
            </div>
          </fieldset>

          <div className="py-6">
            <hr />
          </div>

          <fieldset disabled={isSubmitting} className="space-y-6">
            <div>
              <p className="font-medium">Bypass</p>
              <p className="text-gray-500 text-sm">
                Users in this list will always have their casts curated into Main.
              </p>
            </div>

            <SliderField label="Cohosts" description="Exclude cohosts from all moderation">
              <Controller
                name={`excludeCohosts`}
                control={control}
                render={({ field }) => <Switch onCheckedChange={field.onChange} checked={field.value} />}
              />
            </SliderField>
            <FieldLabel
              label="Farcaster Usernames"
              description="One per line."
              className="flex-col items-start"
            >
              <Textarea
                placeholder="jtgi&#10;wake&#10;deployer"
                {...register("excludeUsernames")}
              />
            </FieldLabel>
          </fieldset>

          <div className="py-6">
            <hr />
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            {props.defaultValues.id || channelId ? (
              <SimulateButton
                // @ts-ignore
                channelId={props.defaultValues.id || channelId}
                actionDefs={props.actionDefinitions}
              />
            ) : (
              <Button variant={"secondary"} className="w-full" disabled>
                Simulate
              </Button>
            )}

            <Button type="submit" size={"lg"} className="w-full" disabled={fetcher.state === "submitting"}>
              {fetcher.state === "submitting"
                ? props.defaultValues.id
                  ? "Updating..."
                  : "Creating..."
                : props.defaultValues.id
                ? "Update"
                : "Create"}
            </Button>
          </div>
        </form>
      </FormProvider>
    </div>
  );
}

function SimulateButton(props: { channelId: string; actionDefs: typeof actionDefinitions }) {
  const [open, setIsOpen] = useState<boolean>(false);
  const [fetcherKey, setFetcherKey] = useState<string | null>(String(new Date().getTime()));

  const submitJobFetcher = useFetcher<typeof action>({
    key: `start-sim-${fetcherKey}`,
  });

  const jobStatusFetcher = useFetcher<typeof jobStatusLoader>({
    key: `job-status-${fetcherKey}`,
  });

  const form = useFormContext<FormValues>();
  const interval = useRef<any>();
  const [simulating, setSimulating] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);

  const onSubmit = () => {
    setSimulating(true);
    const data = form.getValues();
    submitJobFetcher.submit(prepareFormValues(data), {
      encType: "application/json",
      method: "post",
      action: `/api/channels/${props.channelId}/simulations`,
    });
  };

  useEffect(() => {
    if (submitJobFetcher.data && "jobId" in submitJobFetcher.data && submitJobFetcher.data.jobId) {
      const jobId = submitJobFetcher.data.jobId;
      interval.current = setInterval(() => {
        jobStatusFetcher.load(`/api/channels/${props.channelId}/simulations/${jobId}`);
      }, 2000);
    }

    return () => {
      if (interval.current) {
        clearInterval(interval.current);
      }
    };
  }, [submitJobFetcher.state]);

  useEffect(() => {
    if (isFinished(jobStatusFetcher.data)) {
      clearInterval(interval.current);
      setResult(jobStatusFetcher.data.result);
      setSimulating(false);
    }
  }, [jobStatusFetcher.data]);

  const teardown = () => {
    setResult(null);
    setSimulating(false);
    setFetcherKey(String(new Date().getTime()));
  };

  return (
    <ClientOnly>
      {() => (
        <>
          <Dialog
            open={open}
            onOpenChange={(open) => {
              setIsOpen(open);

              if (!open) {
                teardown();
              }
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Simulation</DialogTitle>
                <DialogDescription>
                  Run the last 100 root casts in your channel through your new ruleset. No real actions will
                  be performed.
                </DialogDescription>
              </DialogHeader>
              {isError(submitJobFetcher.data) && (
                <Alert>
                  <p>{submitJobFetcher.data.message}</p>
                </Alert>
              )}
              {!isError(submitJobFetcher.data) &&
                (submitJobFetcher.data || submitJobFetcher.state !== "idle") && (
                  <div>
                    {isFinished(jobStatusFetcher.data) && result && (
                      <SimulationResultDisplay simulation={result} actionDefinitions={props.actionDefs} />
                    )}

                    {isFailure(jobStatusFetcher.data) && (
                      <div className="flex flex-col items-center gap-4 p-8 border rounded-lg">
                        <ServerCrash className="w-12 h-12" />
                        <p className="text-center text-sm">Something went wrong. Sorry.</p>
                      </div>
                    )}

                    {simulating && (
                      <div className="flex flex-col items-center gap-4 p-8 border rounded-lg">
                        <Bot className="w-12 h-12 animate-bounce" />
                        <p className="text-center text-sm">Hang tight, this takes about 15 seconds...</p>
                      </div>
                    )}
                  </div>
                )}
              {isFinished(jobStatusFetcher.data) && (
                <>
                  <div className="py-2">
                    <hr />
                  </div>
                  <Button
                    variant={"secondary"}
                    onClick={() => {
                      setIsOpen(false);
                      teardown();
                    }}
                  >
                    Okay
                  </Button>
                </>
              )}

              {!isFailure(jobStatusFetcher.data) && !simulating && !result && (
                <Button type="button" onClick={() => onSubmit()}>
                  Start Simulation
                </Button>
              )}
            </DialogContent>
          </Dialog>
          <Button
            size={"lg"}
            className="w-full"
            type="button"
            variant="secondary"
            onClick={() => setIsOpen(true)}
          >
            Simulate
          </Button>
        </>
      )}
    </ClientOnly>
  );
}

function SimulationResultDisplay(props: {
  simulation: SimulationResult;
  actionDefinitions: typeof actionDefinitions;
}) {
  const actionCounts: Record<string, { proposed: number; existing: number }> = {};

  let proposedCastsActedOn = 0;
  let existingCastsActedOn = 0;
  for (const result of props.simulation) {
    for (const proposed of result.proposed) {
      actionCounts[proposed.action] = actionCounts[proposed.action] ?? { proposed: 0, existing: 0 };

      actionCounts[proposed.action].proposed++;
    }

    for (const existing of result.existing) {
      actionCounts[existing.action] = actionCounts[existing.action] ?? { proposed: 0, existing: 0 };

      actionCounts[existing.action].existing++;
    }

    proposedCastsActedOn += result.proposed.length;
    existingCastsActedOn += result.existing.length;
  }

  if (proposedCastsActedOn + existingCastsActedOn === 0) {
    return <Alert>No actions would be taken</Alert>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[50px]">Action</TableHead>
          <TableHead className="w-[50px]">Current</TableHead>
          <TableHead className="w-[50px]">Proposed</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Object.entries(actionCounts).map(([action, { proposed, existing }]) => (
          <TableRow key={action}>
            <TableCell>{props.actionDefinitions[action as ActionType].friendlyName}</TableCell>
            <TableCell>{existing}</TableCell>
            <TableCell>{proposed}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableCell>Casts Impacted</TableCell>
        <TableCell>{existingCastsActedOn}</TableCell>
        <TableCell>{proposedCastsActedOn}</TableCell>
      </TableFooter>
    </Table>
  );
}

type JobState = {
  jobId: string;
  state: "unknown" | BullJobState;
  progress: number;
  result: SimulationResult | null;
};

function isError(data?: any): data is { message: string } {
  return data && "message" in data;
}

function isFinished(data?: any): data is JobState {
  return data && "state" in data && (data.state === "completed" || data.state === "failed");
}

function isFailure(data?: any): data is JobState {
  return data && "state" in data && data.state === "failed";
}

function prepareFormValues(data: FormValues) {
  const newRuleSets = [];
  for (const ruleSet of data.ruleSets) {
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

  const excludeUsernamesParsed = data.excludeUsernames?.split(/\r\n|\r|\n/);

  return {
    ...data,
    excludeUsernames: excludeUsernamesParsed ?? null,
    banThreshold: data.banThreshold || null,
    ruleSets: newRuleSets,
  };
}

function RuleSetEditor(props: {
  actionDefinitions: typeof actionDefinitions;
  ruleDefinitions: typeof ruleDefinitions;
  rulesNames: readonly RuleName[];
  ruleSetIndex: number;
  // @ts-ignore -- some build <> local ts mismatch issue theres no way im wasting more life to debug
  control: Control<FormValues, any, FormValues>;
  register: UseFormRegister<FormValues>;
  watch: UseFormWatch<FormValues>;
}) {
  const { ruleSetIndex, control } = props;
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
            Configure checks to verify everytime a cast comes in to your channel.
          </p>
        </div>

        <div className="space-y-4">
          {ruleFields.map((ruleField, ruleIndex) => {
            const ruleName = props.watch(`ruleSets.${ruleSetIndex}.ruleParsed.${ruleIndex}.name`);

            return (
              <Card key={ruleField.id} className="w-full rounded-sm">
                <CardHeader>
                  <div className="flex justify-between items-center gap-2">
                    <FieldLabel label="" className=" grow-0 flex-col items-start w-full">
                      <Controller
                        name={`ruleSets.${ruleSetIndex}.ruleParsed.${ruleIndex}.name` as const}
                        control={control}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <SelectTrigger className="w-[150px] sm:w-[200px] md:w-[400px]">
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
                    <Button
                      type="button"
                      className="rounded-full"
                      onClick={() => removeRule(ruleIndex)}
                      variant={"ghost"}
                    >
                      <X className="w-5 h-5" />
                    </Button>
                  </div>
                  <p className="text-gray-500 text-xs">{props.ruleDefinitions[ruleName].description}</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <RuleArgs
                      ruleDefinition={props.ruleDefinitions[ruleName]}
                      ruleIndex={ruleIndex}
                      ruleSetIndex={ruleSetIndex}
                    />
                    {props.ruleDefinitions[ruleName].invertable && (
                      <div className="flex items-center justify-between p-3 rounded-lg border border-gray-100">
                        <div className="flex flex-col">
                          <label className=" font-medium text-gray-700 text-sm flex items-center gap-1">
                            <p>Invert</p>
                          </label>
                          <p className="text-xs text-gray-500">
                            {props.ruleDefinitions[ruleName].invertedDescription ??
                              "Check for the opposite condition"}
                          </p>
                        </div>
                        <Controller
                          name={`ruleSets.${ruleSetIndex}.ruleParsed.${ruleIndex}.invert`}
                          control={control}
                          render={({ field }) => (
                            <Switch onCheckedChange={field.onChange} checked={field.value} />
                          )}
                        />
                      </div>
                    )}
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
          className="w-full sm:w-auto"
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
          <p className="text-gray-500 text-sm">Configure what actions to take when the rules are met.</p>
        </div>
        <div className="space-y-4">
          {actionFields.map((actionField, actionIndex) => {
            const actionType = props.watch(`ruleSets.${ruleSetIndex}.actionsParsed.${actionIndex}.type`);

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
                              // @ts-ignore -- ts <> build mismatch issue idk
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
                      </p>
                      {action && <p className="text-gray-500 text-xs mt-1">{action.description}</p>}
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
                  <Button type="button" onClick={() => removeAction(actionIndex)} variant={"ghost"}>
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
            className="w-full sm:w-auto"
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
                <RadioGroupItem value="and" id={`ruleSets.${ruleSetIndex}.logicType.and`} />
              </FieldLabel>
              <FieldLabel
                label="Any rule matches"
                position="right"
                labelProps={{
                  htmlFor: `ruleSets.${ruleSetIndex}.logicType.or`,
                }}
              >
                <RadioGroupItem value="or" id={`ruleSets.${ruleSetIndex}.logicType.or`} />
              </FieldLabel>
            </RadioGroup>
          )}
        />
      </div>
    </div>
  );
}

function RuleArgs(props: { ruleDefinition: RuleDefinition; ruleIndex: number; ruleSetIndex: number }) {
  const { register, control } = useFormContext<FormValues>();
  const ruleDef = props.ruleDefinition;

  // check for if rule is currently inverted, if so change description

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
            placeholder={argDef.placeholder}
            defaultValue={argDef.defaultValue as number | undefined}
            {...register(`ruleSets.${props.ruleSetIndex}.ruleParsed.${props.ruleIndex}.args.${argName}`)}
          />
        </FieldLabel>
      );
    }

    if (argDef.type === "textarea") {
      return (
        <FieldLabel
          key={argName}
          label={argDef.friendlyName}
          description={argDef.description}
          className="flex-col items-start"
        >
          <Textarea
            required={argDef.required}
            placeholder={argDef.placeholder}
            defaultValue={argDef.defaultValue as string | undefined}
            {...register(`ruleSets.${props.ruleSetIndex}.ruleParsed.${props.ruleIndex}.args.${argName}`)}
          />
        </FieldLabel>
      );
    }

    if (argDef.type === "select") {
      return (
        <FieldLabel
          key={argName}
          label={argDef.friendlyName}
          description={argDef.description}
          className="flex-col items-start"
        >
          <Controller
            name={`ruleSets.${props.ruleSetIndex}.ruleParsed.${props.ruleIndex}.args.${argName}`}
            defaultValue={argDef.defaultValue as string | undefined}
            control={control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} defaultValue={field.value} required={argDef.required}>
                <SelectTrigger className="w-[150px] sm:w-[200px] md:w-[400px] text-left">
                  <SelectValue placeholder={`Select a ${argDef.friendlyName.toLowerCase()}`} />
                </SelectTrigger>
                <SelectContent>
                  {argDef.options?.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                      {option.hint && <p className="text-gray-500 text-xs">{option.hint}</p>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            pattern={argDef.pattern}
            placeholder={argDef.placeholder}
            defaultValue={argDef.defaultValue as string | undefined}
            {...register(`ruleSets.${props.ruleSetIndex}.ruleParsed.${props.ruleIndex}.args.${argName}`)}
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
            defaultValue={argDef.defaultValue as boolean | undefined}
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
            name={`ruleSets.${props.ruleSetIndex}.actionsParsed.${props.actionIndex}.args.${argName}` as any}
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
