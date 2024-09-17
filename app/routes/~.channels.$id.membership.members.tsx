import { LoaderFunctionArgs } from "@remix-run/node";
import { typedjson, useTypedLoaderData } from "remix-typedjson";
import { MembershipForm } from "~/components/membership-form";
import { getSharedEnv, requireUser, requireUserCanModerateChannel } from "~/lib/utils.server";
import { actionDefinitions, ruleDefinitions, ruleNames } from "~/lib/validations.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await requireUser({ request });
  const channel = await requireUserCanModerateChannel({
    userId: user.id,
    channelId: params.id!,
  });

  const members = [user];

  return typedjson({
    user,
    channel,
    members,
    env: getSharedEnv(),
  });
}

export default function Screen() {
  const { members } = useTypedLoaderData<typeof loader>();
  return (
    <div className="flex flex-col gap-8">
      <section>
        <h1>Members</h1>
        <div>
          {members.map((member) => (
            <div key={member.id}>{member.name}</div>
          ))}
        </div>
      </section>
    </div>
  );
}
