/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/no-unescaped-entities */
import {
  Action,
  Rule,
  RuleDefinition,
  RuleName,
  SelectOption,
  actionDefinitions,
  ruleDefinitions,
} from "~/lib/validations.server";

import { Input } from "~/components/ui/input";
import { FieldLabel, SliderField } from "~/components/ui/fields";
import { Checkbox } from "~/components/ui/checkbox";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Link, useFetcher } from "@remix-run/react";
import { userPlans, cn, meetsMinimumPlan, PlanType } from "~/lib/utils";
import { Switch } from "~/components/ui/switch";
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
import { useState } from "react";
import { Textarea } from "./ui/textarea";
import { Dialog, DialogTitle, DialogContent, DialogDescription, DialogHeader } from "./ui/dialog";
import { ClientOnly } from "remix-utils/client-only";
import { DialogTrigger } from "@radix-ui/react-dialog";
import { ArrowUpRight, CheckCircle2, Loader, Gem, PlusIcon, X } from "lucide-react";
import { UserPicker } from "./user-picker";
import { Role, User } from "@prisma/client";
import { MoxieMemberPicker } from "./moxie-picker";
import { Avatar, AvatarImage } from "./ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

export type FormValues = {
  id: string;

  memberRequirements: {
    logicType: "AND" | "OR";
    rules: Array<Rule>;
  } | null;
};

export function MembershipForm(props: {
  user: User;
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
    fetcher.submit(data, {
      encType: "application/json",
      method: "post",
    });
  };

  return (
    <div className="w-full">
      <FormProvider {...methods}>
        <form id="channel-form" method="post" className="w-full space-y-7" onSubmit={handleSubmit(onSubmit)}>
          <fieldset disabled={isSubmitting} className="space-y-6 w-full">
            <div className="text-md flex items-start gap-2">
              <div>
                When{" "}
                <select
                  className="p-1 bg-primary/10 rounded-md"
                  {...register("memberRequirements.logicType")}
                >
                  <option value="OR">any</option>
                  <option value="AND">all</option>
                </select>{" "}
                of the following rules are met, allow the user to join the channel.
              </div>
            </div>

            <div>
              <RuleSetEditor
                user={props.user}
                actionDefinitions={props.actionDefinitions}
                ruleDefinitions={getUserRules(props.ruleDefinitions)}
                rulesNames={props.ruleNames}
                watch={watch}
                control={control}
                register={register}
                name="memberRequirements.rules"
              />
            </div>
          </fieldset>

          <div className="py-6">
            <hr />
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <Button type="submit" size={"lg"} className="w-full" disabled={fetcher.state !== "idle"}>
              {fetcher.state !== "idle" ? <Loader className="w-4 h-4 animate-spin" /> : "Save"}
            </Button>
          </div>
        </form>
      </FormProvider>
    </div>
  );
}

function RuleSetEditor(props: {
  user: User;
  actionDefinitions: typeof actionDefinitions;
  ruleDefinitions: typeof ruleDefinitions;
  rulesNames: readonly RuleName[];
  // @ts-ignore -- some build <> local ts mismatch issue theres no way im wasting more life to debug
  control: Control<FormValues, any, FormValues>;
  register: UseFormRegister<FormValues>;
  watch: UseFormWatch<FormValues>;
  name: "memberRequirements.rules";
}) {
  const { control } = props;
  const {
    fields: ruleFields,
    remove: removeRule,
    append: appendRule,
  } = useFieldArray({
    control,
    name: props.name,
  });

  const [isRuleDialogOpen, setIsRuleDialogOpen] = useState(false);

  return (
    <div>
      <div className="space-y-4">
        <div className="space-y-4">
          {ruleFields.map((ruleField, ruleIndex) => {
            const ruleName = props.watch(`${props.name}.${ruleIndex}.name`);

            return (
              <Card key={ruleField.id} className="w-full rounded-lg">
                <CardHeader>
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex gap-3 items-start">
                      {props.ruleDefinitions[ruleName].author !== "automod" &&
                        props.ruleDefinitions[ruleName].authorIcon && (
                          <Avatar className="w-[33px] h-[33px] ring-white ring-4 shadow-xl shrink-0 mt-1">
                            <AvatarImage src={props.ruleDefinitions[ruleName].authorIcon} />
                          </Avatar>
                        )}
                      <div>
                        <p className="font-medium text-md">{props.ruleDefinitions[ruleName].friendlyName}</p>
                        <p className="text-gray-500 text-xs">{props.ruleDefinitions[ruleName].description}</p>
                      </div>
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
                      <RuleArgs
                        ruleDefinition={props.ruleDefinitions[ruleName]}
                        ruleIndex={ruleIndex}
                        name={props.name}
                      />
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
        <Dialog open={isRuleDialogOpen} onOpenChange={setIsRuleDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto" variant={"secondary"}>
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
                .sort(([_a, adef], [_b, bdef]) => adef.friendlyName.localeCompare(bdef.friendlyName))
                .filter((args) => !args[1].hidden)
                .map(([name, ruleDef]) => {
                  const isRuleAvailable = ruleDef.minimumPlan
                    ? meetsMinimumPlan({
                        userPlan: props.user.plan as PlanType,
                        minimumPlan: ruleDef.minimumPlan,
                      })
                    : true;

                  if (!isRuleAvailable) {
                    // return a teaser disabled rule
                    return (
                      <Popover key={name}>
                        <PopoverTrigger>
                          <div
                            key={name}
                            id={name}
                            className={cn(
                              "p-4 rounded-md border border-orange-100 shadow-md shadow-orange-300 hover:cursor:not-allowed flex text-left"
                            )}
                          >
                            <div>
                              <p className="text-sm font-semibold">
                                {ruleDef.friendlyName} <Gem className="w-3 h-3 inline -mt-1" />
                              </p>
                              <p className="text-sm text-gray-500">{ruleDef.description}</p>
                              <div className="flex gap-1 items-center mt-4">
                                {ruleDef.authorIcon && (
                                  <img src={ruleDef.authorIcon} className="w-4 h-4 rounded-full" />
                                )}
                                {ruleDef.author && <p className="text-xs text-gray-500">{ruleDef.author}</p>}
                              </div>
                            </div>
                          </div>
                        </PopoverTrigger>
                        <PopoverContent>
                          <p className="text-sm">
                            <Gem className="w-3 h-3 inline -mt-1" /> Upgrade to{" "}
                            <Link
                              target="_blank"
                              to={userPlans[ruleDef.minimumPlan as PlanType]!.link}
                              rel="noreferrer"
                            >
                              {userPlans[ruleDef.minimumPlan as PlanType]!.displayName}
                            </Link>{" "}
                            to use this rule.
                          </p>
                        </PopoverContent>
                      </Popover>
                    );
                  }

                  //@ts-ignore
                  if (ruleFields.find((rf) => rf.name === name) && !ruleDef.allowMultiple) {
                    return (
                      <div
                        key={name}
                        id={name}
                        className={cn("opacity-50 p-4 rounded-md border hover:cursor:not-allowed flex")}
                      >
                        <div>
                          <p className="text-sm font-semibold">{ruleDef.friendlyName}</p>
                          <p className="text-sm text-gray-500">{ruleDef.description}</p>
                          <div className="flex gap-1 items-center mt-4">
                            {ruleDef.authorIcon && (
                              <img src={ruleDef.authorIcon} className="w-4 h-4 rounded-full" />
                            )}
                            {ruleDef.author && <p className="text-xs text-gray-500">{ruleDef.author}</p>}
                          </div>
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
                        <div className="flex flex-col">
                          <div className="flex-auto">
                            <p className="text-sm font-semibold">{ruleDef.friendlyName}</p>
                            <p className="text-xs text-gray-500">{ruleDef.description}</p>
                          </div>
                          {ruleDef.author !== "automod" && (
                            <div className="flex gap-1 items-center mt-4">
                              {ruleDef.authorIcon && (
                                <img src={ruleDef.authorIcon} className="w-4 h-4 rounded-full" />
                              )}
                              {ruleDef.author && <p className="text-xs text-gray-500">{ruleDef.author}</p>}
                            </div>
                          )}
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

function RuleArgs(props: {
  ruleDefinition: RuleDefinition;
  ruleIndex: number;
  name: "memberRequirements.rules";
}) {
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
            {...register(`${props.name}.${props.ruleIndex}.args.${argName}`)}
          />
        </FieldLabel>
      );
    }

    if (argDef.type === "moxieMemberFanTokenPicker") {
      return (
        <ClientOnly key={argName}>
          {() => (
            <FieldLabel
              label={argDef.friendlyName}
              description={argDef.description}
              className="flex-col items-start"
            >
              <MoxieMemberPicker
                name={`${props.name}.${props.ruleIndex}.args.${argName}`}
                isMulti={false}
                required={argDef.required}
              />
            </FieldLabel>
          )}
        </ClientOnly>
      );
    }

    if (argDef.type === "farcasterUserPicker") {
      return (
        <ClientOnly key={argName}>
          {() => (
            <FieldLabel
              label={argDef.friendlyName}
              description={argDef.description}
              className="flex-col items-start"
            >
              <UserPicker
                name={`${props.name}.${props.ruleIndex}.args.${argName}`}
                isMulti={false}
                required={argDef.required}
              />
            </FieldLabel>
          )}
        </ClientOnly>
      );
    }

    if (argDef.type === "farcasterUserPickerMulti") {
      return (
        <ClientOnly key={argName}>
          {() => (
            <FieldLabel
              key={argName}
              label={argDef.friendlyName}
              description={argDef.description}
              className="flex-col items-start"
            >
              <UserPicker
                name={`${props.name}.${props.ruleIndex}.args.${argName}`}
                isMulti={true}
                required={argDef.required}
              />
            </FieldLabel>
          )}
        </ClientOnly>
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
            {...register(`${props.name}.${props.ruleIndex}.args.${argName}`)}
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
            name={`${props.name}.${props.ruleIndex}.args.${argName}`}
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
            {...register(`${props.name}.${props.ruleIndex}.args.${argName}`)}
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
            name={`${props.name}.${props.ruleIndex}.args.${argName}`}
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

function ruleCategory(defs: typeof ruleDefinitions, category: "inclusion" | "exclusion") {
  const out: Record<string, RuleDefinition> = {};
  Object.entries(defs).forEach(([name, def]) => {
    if (def.category === category || def.category === "all") {
      out[name] = def;
    }
  });

  return out;
}

function getUserRules(defs: typeof ruleDefinitions) {
  const out: Record<string, RuleDefinition> = {};
  Object.entries(defs).forEach(([name, def]) => {
    if (def.checkType === "user") {
      out[name] = def;
    }
  });
  return out;
}
