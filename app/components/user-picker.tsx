/* eslint-disable @typescript-eslint/no-explicit-any */
import AsyncSelect from "react-select/async";
import { components } from "react-select";
import axios from "axios";
import { User } from "@neynar/nodejs-sdk/build/neynar-api/v2";
import { Avatar, AvatarImage } from "~/components/ui/avatar";
import { AvatarFallback } from "@radix-ui/react-avatar";
import { FarcasterIcon } from "~/components/FarcasterIcon";
import { Controller, useFormContext } from "react-hook-form";

export function UserPicker(props: { name: string; isMulti: boolean }) {
  const { control } = useFormContext();

  return (
    <Controller
      name={props.name}
      control={control}
      render={({ field }) => (
        <AsyncSelect
          {...field}
          noOptionsMessage={(e) => (e.inputValue ? "No users found. Weird." : null)}
          isMulti={props.isMulti}
          cacheOptions
          defaultOptions
          isClearable={!props.isMulti}
          styles={{
            placeholder: (base) => ({
              ...base,
              fontSize: "0.875rem",
            }),
            control: (base) => ({
              ...base,
              boxShadow: "0 !important",
              borderColor: "#f0f0f0",
              "&:hover": {
                borderColor: "hsl(24.6 95% 53.1%)",
              },
              "&:active": {
                borderColor: "hsl(24.6 95% 53.1%)",
              },
              "&:focus": {
                borderColor: "hsl(24.6 95% 53.1%)",
              },
            }),
            multiValue: (base) => ({
              ...base,
              backgroundColor: "#f0f0f0",
              borderRadius: "0.25rem",
            }),
            option: (base, state) => {
              return {
                ...base,
                "&:active": {
                  backgroundColor: "rgb(255 247 237)",
                },
                backgroundColor: state.isSelected || state.isFocused ? "rgb(255 247 237)" : "inherit",
              };
            },
          }}
          placeholder="Enter a username..."
          components={{
            Option: ProfileOption,
            MultiValue: ProfileMultiValue,
            SingleValue: ProfileSingleValue,
            LoadingIndicator: LoadingIndicator,
            DropdownIndicator: () => null,
            IndicatorSeparator: () => null,
          }}
          loadOptions={(value) =>
            axios
              .get(`/api/searchFarcasterUser?username=${value}`)
              .then((res) =>
                res.data.map((user: User) => ({ value: user.fid, label: user.username, icon: user.pfp_url }))
              )
          }
        />
      )}
    />
  );
}

function ProfileOption(props: any) {
  const { data } = props;
  return (
    <components.Option {...props}>
      <div className="flex items-center gap-2">
        <Avatar className="w-11 h-11 border-white border-4 shadow-sm">
          <AvatarImage src={data.icon} />
          <AvatarFallback>{data.label.slice(0, 2)}</AvatarFallback>
        </Avatar>
        <div>
          <p style={{ fontFamily: "Kode Mono" }}>{data.label}</p>
          <p className="text-gray-400 text-sm">#{data.value}</p>
        </div>
      </div>
    </components.Option>
  );
}

const LoadingIndicator = () => {
  return <FarcasterIcon className={"mr-2 w-4 h-4 animate-bounce text-purple-400"} />;
};

function ProfileSingleValue(props: any) {
  const { data } = props;
  return (
    <components.SingleValue {...props}>
      <div className="flex items-center gap-2">
        <Avatar className="w-6 h-6 border-white border-2 shadow-md">
          <AvatarImage src={data.icon} />
          <AvatarFallback>{data.label.slice(0, 2)}</AvatarFallback>
        </Avatar>
        <div>
          <p className="input-select-label" style={{ fontFamily: "Kode Mono" }}>
            {data.label}
          </p>
        </div>
      </div>
    </components.SingleValue>
  );
}

function ProfileMultiValue(props: any) {
  const { data } = props;
  return (
    <components.MultiValue {...props}>
      <div className="flex items-center gap-2">
        <Avatar className="w-4 h-4 border-white border-2 shadow-md">
          <AvatarImage src={data.icon} />
          <AvatarFallback>{data.label.slice(0, 2)}</AvatarFallback>
        </Avatar>
        <div>
          <p className="input-select-label" style={{ fontFamily: "Kode Mono" }}>
            {data.label}
          </p>
        </div>
      </div>
    </components.MultiValue>
  );
}
