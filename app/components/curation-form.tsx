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

import { loader as jobStatusLoader } from "~/routes/api.channels.$id.simulations.$jobId";
import { Input } from "~/components/ui/input";
import { FieldLabel, SliderField } from "~/components/ui/fields";
import { Checkbox } from "~/components/ui/checkbox";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { useFetcher } from "@remix-run/react";
import { Switch } from "~/components/ui/switch";
import { Bot, Plus, PlusIcon, ServerCrash, X } from "lucide-react";
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
import React, { useEffect, useRef, useState } from "react";
import { Textarea } from "./ui/textarea";
import { Dialog, DialogTitle, DialogContent, DialogDescription, DialogHeader } from "./ui/dialog";
import { action } from "~/routes/api.channels.$id.simulations";
import { JobState as BullJobState } from "bullmq";
import { SimulationResult } from "~/routes/~.channels.$id.tools";
import { ClientOnly } from "remix-utils/client-only";
import { Alert } from "./ui/alert";
import { DialogTrigger } from "@radix-ui/react-dialog";
import { cn } from "~/lib/utils";

export type FormValues = {
  id?: string;
  banThreshold?: number | null;
  excludeUsernames?: string;
  excludeCohosts: boolean;

  ruleSet: {
    id?: string;
    active: boolean;
    target: string;
    logicType: boolean;
    ruleParsed: Array<Rule>;
    actionsParsed: Array<Action>;
  };
};

export function CurationForm(props: {
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

  const onSubmit = (data: FormValues) => {
    fetcher.submit(prepareFormValues(data), {
      encType: "application/json",
      method: "post",
    });
  };

  const channelId = watch("id");

  return (
    <div className="w-full">
      <FormProvider {...methods}>
        <form id="channel-form" method="post" className="w-full space-y-7" onSubmit={handleSubmit(onSubmit)}>
          <fieldset disabled={isSubmitting} className="space-y-6 w-full">
            <div>
              <p className="font-semibold">Who should be curated?</p>
              <p className="text-gray-500 text-sm">
                Setup automated rules to curate casts into Main from Recent.
              </p>
            </div>

            <div>
              <RuleSetEditor
                actionDefinitions={props.actionDefinitions}
                ruleDefinitions={props.ruleDefinitions}
                rulesNames={props.ruleNames}
                watch={watch}
                control={control}
                register={register}
              />
            </div>
          </fieldset>

          <div className="py-6">
            <hr />
          </div>

          <fieldset disabled={isSubmitting} className="space-y-6 w-full">
            <div>
              <p className="font-semibold">Who should be excluded?</p>
            </div>

            <div>
              <RuleSetEditor
                actionDefinitions={props.actionDefinitions}
                ruleDefinitions={props.ruleDefinitions}
                rulesNames={props.ruleNames}
                watch={watch}
                control={control}
                register={register}
              />
            </div>
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
                  Run the last 50 root casts in your channel through your new ruleset. No real actions will be
                  performed.
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
  const ruleSet = data.ruleSet;
  if (!ruleSet.logicType) {
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
  } else {
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
  // @ts-ignore -- some build <> local ts mismatch issue theres no way im wasting more life to debug
  control: Control<FormValues, any, FormValues>;
  register: UseFormRegister<FormValues>;
  watch: UseFormWatch<FormValues>;
}) {
  const { control } = props;
  const {
    fields: ruleFields,
    remove: removeRule,
    append: appendRule,
  } = useFieldArray({
    control,
    name: `ruleSet.ruleParsed`,
  });

  const [isRuleDialogOpen, setIsRuleDialogOpen] = useState(false);

  const duplicatesAllowed: RuleName[] = [
    "requireActiveHypersub",
    "requiresErc1155",
    "requiresErc20",
    "requiresErc721",
    "userIsNotFollowedBy",
    "userDoesNotFollow",
  ];

  return (
    <div>
      <div className="space-y-4">
        <div className="space-y-4">
          {ruleFields.map((ruleField, ruleIndex) => {
            const ruleName = props.watch(`ruleSet.ruleParsed.${ruleIndex}.name`);

            return (
              <Card key={ruleField.id} className="w-full rounded-md">
                <CardHeader>
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <p className="font-semibold">{props.ruleDefinitions[ruleName].friendlyName}</p>
                      <p className="text-gray-500 text-xs">{props.ruleDefinitions[ruleName].description}</p>
                    </div>
                    <Button
                      type="button"
                      className="rounded-full"
                      onClick={() => removeRule(ruleIndex)}
                      variant={"ghost"}
                    >
                      <X className="w-5 h-5" />
                    </Button>
                  </div>
                </CardHeader>
                {Object.entries(props.ruleDefinitions[ruleName].args).length > 0 && (
                  <CardContent>
                    <div className="space-y-6">
                      <RuleArgs ruleDefinition={props.ruleDefinitions[ruleName]} ruleIndex={ruleIndex} />
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
        <Dialog open={isRuleDialogOpen} onOpenChange={setIsRuleDialogOpen}>
          <DialogTrigger asChild>
            <Button variant={"secondary"}>
              <PlusIcon className="w-4 h-4 mr-1" /> Rule
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Add Rule</DialogTitle>
              <DialogDescription>Select a rule to add to the rule set.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 ">
              {Object.entries(props.ruleDefinitions)
                .filter((args) => !args[1].hidden && args[1].checkType === "user")
                .map(([name, ruleDef]) => {
                  if (
                    ruleFields.find((rf) => rf.name === name) &&
                    !duplicatesAllowed.includes(name as RuleName)
                  ) {
                    return (
                      <div
                        key={name}
                        id={name}
                        className={cn("opacity-50 p-4 rounded-md border hover:cursor:not-allowed flex")}
                      >
                        <div>
                          <p className="text-sm font-semibold">{ruleDef.friendlyName}</p>
                          <p className="text-sm text-gray-500">{ruleDef.description}</p>
                        </div>
                      </div>
                    );
                  } else {
                    return (
                      <div
                        key={name}
                        id={name}
                        className={cn(
                          "p-4 rounded-md border hover:border-gray-300 hover:shadow-sm hover:cursor-pointer transition-all flex"
                        )}
                        onClick={() => {
                          appendRule({
                            name: name as RuleName,
                            type: "CONDITION",
                            args: {},
                          });

                          setIsRuleDialogOpen(false);
                        }}
                      >
                        <div>
                          <p className="text-sm font-semibold">{ruleDef.friendlyName}</p>
                          <p className="text-sm text-gray-500">{ruleDef.description}</p>
                        </div>
                      </div>
                    );
                  }
                })}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function RuleArgs(props: { ruleDefinition: RuleDefinition; ruleIndex: number }) {
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
            {...register(`ruleSet.ruleParsed.${props.ruleIndex}.args.${argName}`)}
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
            {...register(`ruleSet.ruleParsed.${props.ruleIndex}.args.${argName}`)}
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
            name={`ruleSet.ruleParsed.${props.ruleIndex}.args.${argName}`}
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
            {...register(`ruleSet.ruleParsed.${props.ruleIndex}.args.${argName}`)}
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
            htmlFor: `ruleSet.ruleParsed.${props.ruleIndex}.args.${argName}`,
          }}
          // description={argDef.description}
          position="right"
        >
          <Controller
            control={control}
            name={`ruleSet.ruleParsed.${props.ruleIndex}.args.${argName}`}
            defaultValue={argDef.defaultValue as boolean | undefined}
            render={({ field: { onChange, name, value } }) => (
              <Checkbox
                id={`ruleSet.ruleParsed.${props.ruleIndex}.args.${argName}`}
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
