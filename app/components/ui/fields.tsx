import { cn } from "~/lib/utils";
import { Input } from "./input";

export function FieldLabel(
  props: {
    position?: "left" | "right";
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
        </>
      )}
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
