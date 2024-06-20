import { FormProvider, useForm } from "react-hook-form";
import { UserPicker } from "~/components/user-picker";

export default function Screen() {
  const methods = useForm({
    defaultValues: {
      bro: [],
    },
    shouldFocusError: false,
    criteriaMode: "all",
  });

  return (
    <FormProvider {...methods}>
      <UserPicker name={"bro"} isMulti={false} />
    </FormProvider>
  );
}
