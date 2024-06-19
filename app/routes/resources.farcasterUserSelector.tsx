/* eslint-disable @typescript-eslint/no-explicit-any */
import { LoaderFunctionArgs } from "@remix-run/node";
import AsyncSelect from "react-select/async";
import { components } from "react-select";
import { Form } from "@remix-run/react";
import { typedjson, useTypedFetcher } from "remix-typedjson";
import { neynar } from "~/lib/neynar.server";
import { Input } from "../components/ui/input";
import { useEffect } from "react";
import axios from "axios";
import { User } from "@neynar/nodejs-sdk/build/neynar-api/v2";
import { Avatar, AvatarImage } from "~/components/ui/avatar";
import { AvatarFallback } from "@radix-ui/react-avatar";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);

  const username = url.searchParams.get("username");
  if (!username) {
    return typedjson([]);
  }

  const users = await neynar.searchUser(username);
  return typedjson(users.result.users);
}

export function UserSelector() {
  function ProfileOption(props: any) {
    const { data } = props;
    return (
      <components.MultiValue {...props}>
        <Avatar className="w-10 h-10">
          <AvatarImage src={data.icon} />
          <AvatarFallback>{data.label.slice(0, 2)}</AvatarFallback>
        </Avatar>
        <components.MultiValueContainer {...props}></components.MultiValueContainer>
      </components.MultiValue>
    );
  }

  function ProfileMultiValue(props: any) {
    const { data } = props;
    return (
      <div className="flex items-center gap-4 p-1 bg-gray-200 rounded-lg">
        <Avatar className="w-4 h-4">
          <AvatarImage src={data.icon} />
          <AvatarFallback>{data.label.slice(0, 2)}</AvatarFallback>
        </Avatar>
        <div>
          <p className="input-select-label">{data.label}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Form method="get">
        <AsyncSelect
          isMulti
          cacheOptions
          defaultOptions
          components={{
            MultiValue: ProfileMultiValue,
            Option: ProfileOption,
          }}
          loadOptions={(value) =>
            axios
              .get(`/resources/farcasterUserSelector?username=${value}`)
              .then((res) =>
                res.data.map((user: User) => ({ value: user.fid, label: user.username, icon: user.pfp_url }))
              )
          }
        />
      </Form>
    </div>
  );
}
