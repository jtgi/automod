import { LoaderFunctionArgs } from "@remix-run/node";
import { Form, useNavigate } from "@remix-run/react";
import { redirect, typedjson, useTypedLoaderData } from "remix-typedjson";
import { getSharedEnv, requireUser } from "~/lib/utils.server";
import { getWarpcastChannel } from "~/lib/warpcast.server";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { FieldLabel } from "~/components/ui/fields";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { ChannelHeader } from "./~.channels.new.3";
import { CurationForm } from "~/components/curation-form";
import { actionDefinitions, getRuleDefinitions, ruleNames } from "~/lib/validations.server";
import { useState } from "react";
import { actionToInstallLink } from "~/lib/utils";
import { addToBypassAction } from "~/lib/cast-actions.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser({ request });
  const url = new URL(request.url);

  if (!url.searchParams.get("channelId")) {
    throw redirect("/~/new/1");
  }

  const channel = await getWarpcastChannel({ channel: url.searchParams.get("channelId")! });

  return typedjson({
    user,
    channel,
    actionDefinitions,
    ruleDefinitions: getRuleDefinitions(user.id),
    ruleNames,
    env: getSharedEnv(),
    bypassInstallLink: actionToInstallLink(addToBypassAction),
  });
}

export default function Screen() {
  const { user, channel, actionDefinitions, bypassInstallLink, ruleDefinitions, ruleNames, env } =
    useTypedLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [feedType, setFeedType] = useState("recommended");

  return (
    <Card>
      <CardHeader>
        <ChannelHeader channel={channel} />
        <CardTitle>What kind of feed do you want?</CardTitle>
        <CardDescription>All options can be mixed with manual moderation directly in feed.</CardDescription>
      </CardHeader>
      <Form
        method="post"
        className="space-y-8"
        onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          const moderationMode = formData.get("feed") as string;

          const url = new URL(window.location.href);
          url.searchParams.set("feed", moderationMode);

          navigate({
            pathname: "/~/channels/new/3",
            search: url.search,
          });
        }}
      >
        <CardContent>
          <RadioGroup
            name="feed"
            className="space-y-4"
            defaultValue="recommended"
            onChange={(e) => {
              // get selected radio
              const selectedRadio = e.target as HTMLInputElement;
              setFeedType(selectedRadio.value);
            }}
          >
            <FieldLabel
              label="Recommended"
              labelProps={{ htmlFor: "recommended" }}
              position="right"
              description="A Warpcast-like feed based on power badge and users you follow."
            >
              <RadioGroupItem className="mt-[2px]" id="recommended" value="recommended" />
            </FieldLabel>

            <FieldLabel
              label="Custom"
              labelProps={{ htmlFor: "custom" }}
              position="right"
              description="Pick and choose from 25+ rules to make the channel feed you want."
            >
              <RadioGroupItem className="mt-[2px]" id="custom" value="custom" />
            </FieldLabel>
            {feedType === "custom" && (
              <CurationForm
                bypassInstallLink={bypassInstallLink}
                actionDefinitions={actionDefinitions}
                ruleDefinitions={ruleDefinitions}
                ruleNames={ruleNames}
                defaultValues={{
                  excludeCohosts: true,
                  inclusionRuleSet: {
                    target: "all",
                    active: true,
                    ruleParsed: [
                      {
                        name: "userDoesNotHoldPowerBadge",
                        type: "CONDITION",
                        args: {},
                      },
                      {
                        name: "userIsNotFollowedBy",
                        type: "CONDITION",
                        args: {
                          users: [
                            {
                              value: +user.id,
                              label: user.name,
                              icon: user.avatarUrl ?? undefined,
                            },
                          ],
                        },
                      },
                    ],
                    actionsParsed: [
                      {
                        type: "like",
                      },
                    ],
                    logicType: "OR",
                  },
                  exclusionRuleSet: {
                    target: "all",
                    active: true,
                    ruleParsed: [],
                    actionsParsed: [
                      {
                        type: "hideQuietly",
                      },
                    ],
                    logicType: "OR",
                  },
                }}
              />
            )}

            <FieldLabel
              label="Manual"
              labelProps={{ htmlFor: "manual" }}
              position="right"
              description="You and optional comoderators will curate good casts with cast actions."
            >
              <RadioGroupItem className="mt-[2px]" id="manual" value="manual" />
            </FieldLabel>
          </RadioGroup>
          <p className="text-sm text-gray-500 mt-6">
            You can change this anytime. If you're not sure, start with Recommended.
          </p>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="ml-auto w-full sm:w-[150px]">
            Next
          </Button>
        </CardFooter>
      </Form>
    </Card>
  );
}
