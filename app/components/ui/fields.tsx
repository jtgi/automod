import { cn } from "~/lib/utils";
import { Input } from "./input";
import { Controller } from "react-hook-form";

export function FieldLabel(
  props: {
    position?: "left" | "right";
    description?: string;
    label: React.ReactNode;
    labelProps?: React.LabelHTMLAttributes<HTMLLabelElement>;
  } & React.HTMLAttributes<HTMLDivElement>
) {
  const _position = props.position || "left";
  const _labelClassName = props.labelProps?.className || "";
  delete props.labelProps?.className;

  return (
    <div className={cn(`flex items-center gap-1`, props.className)}>
      {_position === "left" ? (
        <>
          <label
            className={cn("text-sm font-medium text-gray-700", _labelClassName)}
            {...props.labelProps}
          >
            {props.label}
          </label>
          {props.children}
          {props.description && (
            <div className="text-xs text-gray-500">{props.description}</div>
          )}
        </>
      ) : (
        <>
          {props.children}
          <label
            className={cn("text-sm font-medium text-gray-700", _labelClassName)}
            {...props.labelProps}
          >
            {props.label}
          </label>
          {props.description && (
            <div className="text-xs text-gray-500">{props.description}</div>
          )}
        </>
      )}
    </div>
  );
}

export function SliderField(
  props: {
    label: string;
    description?: string | React.ReactNode;
    labelProps?: React.LabelHTMLAttributes<HTMLLabelElement>;
    children: React.ReactNode;
  } & React.HTMLAttributes<HTMLDivElement>
) {
  const { children, ...rest } = props;
  const descriptionNode = props.description ? (
    typeof props.description === "string" ? (
      <div className="text-xs text-gray-500">{props.description}</div>
    ) : (
      props.description
    )
  ) : null;

  return (
    <div
      {...rest}
      className={cn(
        rest.className,
        "flex items-center justify-between p-3 rounded-lg border border-gray-100"
      )}
    >
      <div className="flex flex-col">
        <label
          {...props.labelProps}
          className={cn(
            props.labelProps?.className,
            "font-medium text-gray-700 text-sm flex items-center leading-6"
          )}
        >
          <p>{props.label}</p>
        </label>
        {descriptionNode}
      </div>
      {children}
    </div>
  );
}

export function Field({
  name,
  label,
  inputProps,
  ...props
}: {
  name: string;
  label: string;
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props}>
      <label
        htmlFor={name}
        className="block mb-2 text-sm font-medium text-gray-700"
      >
        {label}
      </label>
      <Input id={name} name={name} {...inputProps} />
    </div>
  );
}
