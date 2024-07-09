import { LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useNavigate } from "@remix-run/react";
import { redirect, typedjson, useTypedLoaderData } from "remix-typedjson";
import { db } from "~/lib/db.server";
import { requireUser } from "~/lib/utils.server";
import { getOwnedChannels, getWarpcastChannel } from "~/lib/warpcast.server";
import { ChannelCard } from "./~._index";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { FieldLabel } from "~/components/ui/fields";
import { Button } from "~/components/ui/button";

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
  });
}

export default function Screen() {
  const { user, channel } = useTypedLoaderData<typeof loader>();
  const navigate = useNavigate();

  return (
    <div className="space-y-8">
      <h1>What kind of feed do you want in /{channel.name}?</h1>

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
        <RadioGroup name="feed" className="space-y-4" defaultValue="recommended">
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

          <FieldLabel
            label="Manual"
            labelProps={{ htmlFor: "manual" }}
            position="right"
            description="You and optional comoderators will curate good casts with cast actions."
          >
            <RadioGroupItem className="mt-[2px]" id="manual" value="manual" />
          </FieldLabel>
        </RadioGroup>
        <p className="text-sm text-gray-500">
          You can change this anytime in settings. If you're not sure, start with Recommended.
        </p>

        <Button className="ml-auto w-full sm:w-[150px]">Next</Button>
      </Form>
    </div>
  );
}
