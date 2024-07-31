/* eslint-disable @typescript-eslint/no-explicit-any */
import AsyncSelect from "react-select/async";
import { components } from "react-select";
import { Avatar, AvatarImage } from "~/components/ui/avatar";
import { AvatarFallback } from "@radix-ui/react-avatar";
import { FarcasterIcon } from "~/components/FarcasterIcon";
import { Controller, useFormContext } from "react-hook-form";
import { useCallback } from "react";
import { SubjectTokensResponse } from "~/lib/airstack.server";
import axios from "axios";

export function MoxieMemberPicker(props: { name: string; isMulti: boolean; required?: boolean }) {
  const { control } = useFormContext();

  const loadOptions = useCallback(
    debounce(
      (value: string, callback: (options: { value: string; label: string; icon: string }[]) => void) => {
        if (!value) return callback([]);
        axios
          .get<SubjectTokensResponse>(`/api/searchMoxieMemberTokens?username=${value}`)
          .then((res) => {
            const options = res.data.subjectTokens.map((token) => ({
              value: token.id,
              label: token.name,
              icon: token.pfpUrl || "/icons/moxie.png",
            }));
            callback(options);
          })
          .catch(() => callback([]));
      },
      400
    ),
    []
  );

  return (
    <Controller
      name={props.name}
      control={control}
      render={({ field }) => (
        <AsyncSelect
          {...field}
          instanceId={props.name}
          noOptionsMessage={(e) => (e.inputValue ? "No users found. Weird." : null)}
          required={props.required}
          cacheOptions
          isMulti={props.isMulti}
          defaultOptions
          isClearable={!props.isMulti}
          styles={{
            placeholder: (base) => ({
              ...base,
              fontSize: "0.875rem",
            }),
            valueContainer: (base, state) => ({
              ...base,
              padding: state.hasValue ? "5px" : "2px 8px",
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
          loadOptions={loadOptions}
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
          <AvatarFallback>{data.label?.slice(0, 2)}</AvatarFallback>
        </Avatar>
        <div>
          <p style={{ fontFamily: "Kode Mono" }}>{data.label}</p>
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
          <AvatarFallback>{data.label?.slice(0, 2)}</AvatarFallback>
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
          <AvatarFallback>{data.label?.slice(0, 2)}</AvatarFallback>
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

function debounce(
  func: (
    value: string,
    callback: (options: { value: string; label: string; icon: string }[]) => void
  ) => void,
  wait: number
) {
  let timeout: NodeJS.Timeout;
  return function (
    value: string,
    callback: (options: { value: string; label: string; icon: string }[]) => void
  ) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(value, callback), wait);
  };
}
