import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import satori from "satori";
import { Form, json, redirect, useLoaderData } from "@remix-run/react";
import {
  CSSProperties,
  ChangeEvent,
  ChangeEventHandler,
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { Checkbox } from "~/components/ui/checkbox";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { db } from "~/lib/db.server";
import { HexColorPicker } from "react-colorful";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Badge } from "~/components/ui/badge";
import { requireUser } from "~/lib/utils.server";
import { authenticator } from "~/lib/auth.server";
import { typedjson, useTypedLoaderData } from "remix-typedjson";

export const meta: MetaFunction = () => {
  return [
    { title: "Farcaster Landscape" },
    {
      name: "description",
      content: "A collection of Brand3s that are making Farcaster possible",
    },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await authenticator.isAuthenticated(request);

  if (!user) {
    throw redirect("/login");
  }

  return typedjson({
    env: {
      HOST_URL: process.env.HOST_URL,
    },
  });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireUser({ request });

  const formData = await request.formData();
  const data = Object.fromEntries(formData.entries()) as any;

  // TODO: validation
  const frame = await db.frame
    .create({
      data: {
        slug: data.slug,
        type: data.type,
        secretText: data.secretText,
        preRevealText: data.preRevealText,
        revealType: data.revealType,
        requireLike: data.requireLike === "on",
        requireRecast: data.requireRecast === "on",
        requireFollow: data.requireFollow === "on",
        requireSomeoneIFollow: data.requireSomeoneIFollow === "on",
        requireHoldERC721: data.requireHoldERC721 === "on",
        requireHoldERC20: data.requireHoldERC20 === "on",
        backgroundColor: data.backgroundColor,
        textColor: data.textColor,

        requireERC20ContractAddress: data.requireERC20ContractAddress,
        requireERC20MinBalance:
          data.requireERC20MinBalance === ""
            ? null
            : data.requireERC20MinBalance,
        requireERC20NetworkId: data.requireERC20NetworkId,
        requireERC721ContractAddress: data.requireERC721ContractAddress,
        requireERC721NetworkId: data.requireERC721NetworkId,
        requireERC721TokenId:
          data.requireERC721TokenId === "" ? null : data.requireERC721TokenId,
      },
    })
    .catch((e) => e.message);

  if (typeof frame === "string") {
    return json({ error: frame }, { status: 400 });
  }

  return redirect(`/${frame.slug}`);
}

export default function Index() {
  const { env } = useTypedLoaderData<typeof loader>();
  const [contentType, setContentType] = useState<string>("text");
  const [prerevealSvg, setPreRevealSvg] = useState<string>();
  const [revealedSvg, setRevealedSvg] = useState<string>();
  const [backgroundColor, setBackgroundColor] = useState<string>("black");
  const [textColor, setTextColor] = useState<string>("white");
  const [width, setWidth] = useState(800);
  const [formValue, setFormValues] = useState<any>({});
  const scale = Math.min(width / 800, 1.91);

  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => {
      if (previewRef.current) {
        setWidth(previewRef.current.offsetWidth);
      }
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleChange = async (e: FormEvent<HTMLFormElement>) => {
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries()) as any;

    // lol reimplementing formik
    setFormValues(data);

    const response = await fetch(`${env.HOST_URL}/Inter-Regular.ttf`);
    const fontBuffer = await response.arrayBuffer();
    const styles: CSSProperties = {
      display: "flex",
      color: data.textColor || "white",
      fontFamily: "Inter Regular",
      backgroundColor: data.backgroundColor || "black",
      height: "100%",
      width: "100%",
      padding: 72 * scale,
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 32 * scale,
      fontWeight: 600,
    };

    const preReveal = await satori(
      <div style={styles}>
        <h1>{data.preRevealText}</h1>
      </div>,
      {
        width: 800 * scale,
        height: 418 * scale,
        fonts: [
          {
            name: "Inter Regular",
            data: fontBuffer,
            style: "normal",
          },
        ],
      }
    );

    const postReveal = await satori(
      <div style={styles}>
        <h1>{data.secretText}</h1>
      </div>,
      {
        width: 800 * scale,
        height: 418 * scale,
        fonts: [
          {
            name: "Inter Regular",
            data: fontBuffer,
            style: "normal",
          },
        ],
      }
    );

    setPreRevealSvg(preReveal);
    setRevealedSvg(postReveal);
  };

  return (
    <main className="max-w-4xl px-8 mx-auto min-h-screen flex flex-col justify-center pb-[200px]">
      <h1 className="py-12">Framer</h1>
      <div className="flex flex-col sm:flex-row gap-8 relative">
        <Form
          method="post"
          className="space-y-8 sm:w-[400px]"
          onChange={(e) => {
            handleChange(e);
          }}
        >
          <div className="space-y-4">
            <FieldLabel label="Slug" className="flex-col items-start">
              <Input
                name="slug"
                placeholder="e.g. full-send"
                pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
                required
              />
            </FieldLabel>

            <FieldLabel label="Welcome Text" className="flex-col items-start">
              <Textarea name="preRevealText" placeholder="e.g. full send" />
            </FieldLabel>

            <div>
              <FieldLabel
                label="What will be revealed?"
                className="flex-col items-start"
              >
                <Select
                  name="revealType"
                  onValueChange={setContentType}
                  defaultValue="text"
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose a Content Type..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem disabled value="image">
                      Image (coming soon)
                    </SelectItem>
                    <SelectItem disabled value="nft">
                      NFT (coming soon)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FieldLabel>
            </div>

            {contentType === "text" && (
              <FieldLabel label="" className="flex-col items-start">
                <Textarea
                  hidden={contentType !== "text"}
                  name="secretText"
                  placeholder="e.g. telegram.io/invite/gg"
                />
              </FieldLabel>
            )}

            {contentType === "image" && (
              <Field
                name="image"
                label="Upload File"
                inputProps={{
                  type: "file",
                  name: "image",
                  accept: "image/*",
                }}
              />
            )}

            {contentType === "nft" && (
              <fieldset className="space-y-4">
                <FieldLabel label="Network" className="flex-col items-start">
                  <Select>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose a Network..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="base">Base</SelectItem>
                      <SelectItem value="ethereum">Ethereum Mainnet</SelectItem>
                      <SelectItem value="optimism">Optimism</SelectItem>
                      <SelectItem value="zora">Zora</SelectItem>
                      <SelectItem value="arbitrum">Arbitrum</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldLabel>
                <Field
                  name="contractAddress"
                  label="Contract Address"
                  inputProps={{ placeholder: "e.g. 0x37fdh8934..." }}
                />
                <Field
                  name="tokenId"
                  label="Token ID"
                  inputProps={{
                    placeholder: "e.g. 1337",
                  }}
                ></Field>
              </fieldset>
            )}
          </div>

          <hr />

          <div className="space-y-4">
            <p className="font-semibold">Requirements</p>
            <div className="space-y-1">
              <FieldLabel label="Must Like" position="right">
                <Checkbox name="requireLike" />
              </FieldLabel>

              <FieldLabel label="Must Recast" position="right">
                <Checkbox name="requireRecast" />
              </FieldLabel>

              <FieldLabel label="Must Follow Me" position="right">
                <Checkbox name="requireFollow" />
              </FieldLabel>

              <FieldLabel label="Must Be Someone I Follow" position="right">
                <Checkbox name="requireSomeoneIFollow" />
              </FieldLabel>

              <FieldLabel label="Must Hold ERC-721" position="right">
                <Checkbox name="requireHoldERC721" />
              </FieldLabel>

              {formValue.requireHoldERC721 === "on" && (
                <div className="py-4 border-t space-y-2">
                  <div className="flex items-center gap-4">
                    <label className="block mb-2 text-sm font-medium text-gray-700 w-[100px] text-right">
                      Network
                    </label>
                    <Select name="requireERC721NetworkId" required>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Choose a Network..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="42161">Arbitrum</SelectItem>
                        <SelectItem value="8453">Base</SelectItem>
                        <SelectItem value="1">Ethereum Mainnet</SelectItem>
                        <SelectItem value="10">Optimism</SelectItem>
                        <SelectItem value="7777777">Zora</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="block mb-2 text-sm font-medium text-gray-700 w-[100px] text-right">
                      Contract
                    </label>
                    <Input
                      name="requireERC721ContractAddress"
                      required
                      pattern="^(0x)?[0-9a-fA-F]{40}$"
                      placeholder="0x37fdh8934..."
                    />
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="block mb-2 text-sm font-medium text-gray-700 w-[100px] text-right">
                      Token ID{" "}
                      <small className="text-gray-600">(optional)</small>
                    </label>
                    <Input
                      name="requireERC721TokenId"
                      pattern="+\d"
                      placeholder="1337"
                    />
                  </div>
                </div>
              )}

              <FieldLabel label="Must Hold ERC-20" position="right">
                <Checkbox name="requireHoldERC20" />
              </FieldLabel>

              {formValue.requireHoldERC20 === "on" && (
                <div className="py-4 border-t space-y-2">
                  <div className="flex items-center gap-4">
                    <label className="block mb-2 text-sm font-medium text-gray-700 w-[100px] text-right">
                      Network
                    </label>
                    <Select name="requireERC20NetworkId" required>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Choose a Network..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="42161">Arbitrum</SelectItem>
                        <SelectItem value="8453">Base</SelectItem>
                        <SelectItem value="1">Ethereum Mainnet</SelectItem>
                        <SelectItem value="10">Optimism</SelectItem>
                        <SelectItem value="7777777">Zora</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="block mb-2 text-sm font-medium text-gray-700 w-[100px] text-right">
                      Contract
                    </label>
                    <Input
                      name="requireERC20ContractAddress"
                      required
                      pattern="^(0x)?[0-9a-fA-F]{40}$"
                      placeholder="0x37fdh8934..."
                    />
                  </div>

                  <div className="flex items-start gap-4">
                    <label className="block mb-2 text-sm font-medium text-gray-700 w-[100px] text-right">
                      Minimum Balance{" "}
                      <small className="text-gray-600">(optional)</small>
                    </label>
                    <Input
                      name="requireERC20MinBalance"
                      pattern="+\d"
                      placeholder="900"
                    />
                  </div>
                </div>
              )}

              <FieldLabel label="Must Not like Hot Chocolate" position="right">
                <Checkbox name="requireNotLikeHotChocolate" />
              </FieldLabel>
            </div>
          </div>

          <hr />

          <div className="space-y-4">
            <p className="font-semibold">Customize</p>

            <div className="flex items-center gap-8">
              <FieldLabel
                label="Background Color"
                className="flex-col items-start justify-between"
              >
                <Input
                  id="backgroundColor"
                  type="hidden"
                  name="backgroundColor"
                  value={backgroundColor}
                />
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      style={{ backgroundColor }}
                      className="rounded-full p-0 h-10 w-10 border-2"
                    />
                  </PopoverTrigger>
                  <PopoverContent>
                    <HexColorPicker
                      color={backgroundColor}
                      onChange={(color) => {
                        setBackgroundColor(color);
                        handleChange({
                          currentTarget: document.querySelector("form"),
                        } as ChangeEvent<HTMLFormElement>);
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </FieldLabel>

              <FieldLabel
                label="Text Color"
                className="flex-col items-start justify-between"
              >
                <Input type="hidden" name="textColor" value={textColor} />
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      style={{ backgroundColor: textColor }}
                      className="rounded-full p-0 h-10 w-10 border-2"
                    />
                  </PopoverTrigger>
                  <PopoverContent>
                    <HexColorPicker
                      color={textColor}
                      onChange={(color) => {
                        setTextColor(color);
                        handleChange({
                          currentTarget: document.querySelector("form"),
                        } as ChangeEvent<HTMLFormElement>);
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </FieldLabel>
            </div>
          </div>

          <Button className="w-full" size={"lg"}>
            Create
          </Button>
        </Form>
        <div className="sm:w-1/2 relative" ref={previewRef}>
          <div className="sm:fixed">
            <h2>Preview</h2>
            <div className="space-y-8">
              <div>
                <h3>Welcome Screen</h3>
                {prerevealSvg && (
                  <div
                    className="rounded-lg"
                    dangerouslySetInnerHTML={{ __html: prerevealSvg }}
                  ></div>
                )}
              </div>

              <div>
                <h3>After Reveal</h3>
                {revealedSvg && (
                  <div dangerouslySetInnerHTML={{ __html: revealedSvg }}></div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function FieldLabel(
  props: {
    position?: "left" | "right";
    label: React.ReactNode;
    labelProps?: React.HTMLAttributes<HTMLLabelElement>;
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

function Field({
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
