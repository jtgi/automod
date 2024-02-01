/* eslint-disable @typescript-eslint/no-explicit-any */
import invariant from "tiny-invariant";
import {
  redirect,
  typedjson,
  useTypedActionData,
  useTypedLoaderData,
} from "remix-typedjson";
import { db } from "~/lib/db.server";
import { Input } from "~/components/ui/input";
import { generateFrameSvg } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { commitSession, getSession } from "~/lib/auth.server";
import { Frame } from "@prisma/client";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form } from "@remix-run/react";
import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { Checkbox } from "~/components/ui/checkbox";
import { HexColorPicker } from "react-colorful";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Field, FieldLabel } from "~/components/ui/fields";
import { getSharedEnv, requireUser } from "~/lib/utils.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  invariant(params.slug, "Frame slug or id is required");

  const [frame, session] = await Promise.all([
    db.frame.findFirstOrThrow({
      where: { slug: params.slugOrId },
    }),
    getSession(request.headers.get("Cookie")),
  ]);

  return typedjson(
    {
      frame,
      hostUrl: getSharedEnv().hostUrl,
      isNewlyCreated: session.get("newFrame") ?? false,
    },
    {
      headers: {
        "Set-Cookie": await commitSession(session),
      },
    }
  );
}

export async function action({ request }: ActionFunctionArgs) {
  await requireUser({ request });

  const session = await getSession(request.headers.get("Cookie"));
  const formData = await request.formData();
  const data = Object.fromEntries(formData.entries()) as any;

  const existingFrame = await db.frame.findUnique({
    where: {
      slug: data.slug,
    },
  });

  if (existingFrame) {
    session.flash("error", "Slug is already taken, try another.");
    return typedjson(
      {
        errors: {
          slug: "Slug already exists",
        },
        values: data,
      },
      {
        status: 400,
        headers: {
          "Set-Cookie": await commitSession(session),
        },
      }
    );
  }

  // TODO: validation
  const frame = await db.frame
    .create({
      data: {
        slug: data.slug,
        secretText: data.secretText,
        preRevealText: data.preRevealText,
        revealType: data.revealType,
        frameUrl: data.frameUrl ? new URL(data.frameUrl).toString() : null,
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
    .catch((e) => {
      console.error(e);
      return {
        errors: {
          global: e.message,
        },
        values: data,
      };
    });

  if ("errors" in frame) {
    return typedjson({ error: frame, values: data }, { status: 400 });
  }

  session.flash("message", `Updated`);

  return redirect(`/~/frames/${frame.slug}/edit`, {
    headers: {
      "Set-Cookie": await commitSession(session),
    },
  });
}

export default function FrameEdit() {
  const { frame, hostUrl } = useTypedLoaderData<typeof loader>();
  const actionData = useTypedActionData<typeof action>();

  const mergedFrame = {
    ...frame,
    ...actionData?.values,
  };

  return <FrameForm isEditing={true} frame={mergedFrame} hostUrl={hostUrl} />;
}

export function FrameForm(props: {
  isEditing?: boolean;
  frame?: Frame;
  hostUrl: string;
}) {
  const [revealType, setRevealType] = useState<string>(
    props.frame?.revealType ?? "text"
  );

  // todo
  const [prerevealSvg, setPreRevealSvg] = useState<string>();
  const [revealedSvg, setRevealedSvg] = useState<string>();

  const [backgroundColor, setBackgroundColor] = useState<string>(
    props.frame?.backgroundColor ?? "black"
  );
  const [textColor, setTextColor] = useState<string>(
    props.frame?.textColor ?? "white"
  );
  const [width, setWidth] = useState(800);
  const [formValue, setFormValues] = useState<any>(props.frame ?? {});

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

  useEffect(() => {
    if (props.frame) {
      renderPreviews(props.frame);
    }
  }, [width]);

  const renderPreviews = async (frame: Frame) => {
    console.log("renderingpreview", frame.preRevealText);
    const preReveal = await generateFrameSvg(
      frame,
      frame.preRevealText,
      props.hostUrl,
      {
        scale,
      }
    );

    const postReveal = await generateFrameSvg(
      frame,
      frame.secretText || "",
      props.hostUrl,
      {
        scale,
      }
    );

    setPreRevealSvg(preReveal);
    setRevealedSvg(postReveal);
  };

  const handleChange = async (e: FormEvent<HTMLFormElement>) => {
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries()) as any;

    // lol reimplementing formik
    setFormValues(data);

    await renderPreviews(data);
  };

  return (
    <main className="w-full">
      <Form id="create-frame" method="post" onChange={handleChange}>
        <div className="flex flex-col sm:flex-row gap-8 relative">
          <div className="space-y-8 sm:w-[400px]">
            <div className="space-y-4">
              <FieldLabel label="Slug" className="flex-col items-start">
                <Input
                  name="slug"
                  placeholder="e.g. full-send"
                  pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
                  defaultValue={props.frame?.slug}
                  required
                />
              </FieldLabel>

              <FieldLabel label="Welcome Text" className="flex-col items-start">
                <Textarea
                  name="preRevealText"
                  placeholder="e.g. full send"
                  defaultValue={props.frame?.preRevealText}
                />
              </FieldLabel>

              <div>
                <FieldLabel
                  label="What will be revealed?"
                  className="flex-col items-start"
                >
                  <Select
                    name="revealType"
                    onValueChange={setRevealType}
                    defaultValue={revealType}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose a Content Type..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="image">Image</SelectItem>
                      <SelectItem value="frame">Frame</SelectItem>
                      <SelectItem disabled value="nft">
                        NFT (coming soon)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FieldLabel>
              </div>

              {revealType === "text" && (
                <FieldLabel label="" className="flex-col items-start">
                  <Textarea
                    name="secretText"
                    defaultValue={props.frame?.secretText ?? undefined}
                    required
                    placeholder="e.g. telegram.io/invite/gg"
                  />
                </FieldLabel>
              )}

              {revealType === "frame" && (
                <FieldLabel label="Frame Url" className="flex-col items-start">
                  <Input
                    name="frameUrl"
                    defaultValue={props.frame?.frameUrl ?? undefined}
                    required
                    pattern="https://.*"
                    placeholder="e.g. https://www.degens.lol/spin"
                  />
                </FieldLabel>
              )}

              {revealType === "image" && (
                <>
                  {props.frame?.imageUrl === "image" && (
                    <img
                      src={props.frame?.imageUrl}
                      className="w-[100px] h-[100px] object-cover"
                      alt="image"
                    />
                  )}
                  {/* todo change this */}
                  <Field
                    name="image"
                    label="Upload File"
                    inputProps={{
                      type: "file",
                      name: "image",
                      accept: "image/*",
                    }}
                  />
                </>
              )}

              {revealType === "nft" && (
                <fieldset className="space-y-4">
                  <FieldLabel label="Network" className="flex-col items-start">
                    <Select>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Choose a Network..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="base">Base</SelectItem>
                        <SelectItem value="ethereum">
                          Ethereum Mainnet
                        </SelectItem>
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
                <FieldLabel
                  label="Must Like"
                  position="right"
                  labelProps={{
                    htmlFor: "requireLike",
                  }}
                >
                  <Checkbox
                    name="requireLike"
                    id="requireLike"
                    defaultChecked={props.frame?.requireLike}
                  />
                </FieldLabel>

                <FieldLabel
                  label="Must Recast"
                  position="right"
                  labelProps={{
                    htmlFor: "requireRecast",
                  }}
                >
                  <Checkbox
                    id="requireRecast"
                    name="requireRecast"
                    defaultChecked={props.frame?.requireRecast}
                  />
                </FieldLabel>

                <FieldLabel
                  label="Must Follow Me"
                  position="right"
                  labelProps={{
                    htmlFor: "requireFollow",
                  }}
                >
                  <Checkbox
                    id="requireFollow"
                    name="requireFollow"
                    defaultChecked={props.frame?.requireFollow}
                  />
                </FieldLabel>

                <FieldLabel
                  label="Must Be Someone I Follow"
                  position="right"
                  labelProps={{
                    htmlFor: "requireSomeoneIFollow",
                  }}
                >
                  <Checkbox
                    id="requireSomeoneIFollow"
                    name="requireSomeoneIFollow"
                    defaultChecked={props.frame?.requireSomeoneIFollow}
                  />
                </FieldLabel>

                <FieldLabel
                  label="Must Hold ERC-721"
                  position="right"
                  labelProps={{
                    htmlFor: "requireHoldERC721",
                  }}
                >
                  <Checkbox
                    id="requireHoldERC721"
                    name="requireHoldERC721"
                    defaultChecked={props.frame?.requireHoldERC721}
                  />
                </FieldLabel>

                {formValue.requireHoldERC721 === "on" && (
                  <div className="py-4 border-t space-y-2">
                    <div className="flex items-center gap-4">
                      <label className="block mb-2 text-sm font-medium text-gray-700 w-[100px] text-right">
                        Network
                      </label>
                      <Select
                        name="requireERC721NetworkId"
                        required
                        defaultValue={
                          props.frame?.requireERC721NetworkId ?? undefined
                        }
                      >
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
                        defaultValue={
                          props.frame?.requireERC721ContractAddress ?? undefined
                        }
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
                        defaultValue={
                          props.frame?.requireERC721TokenId ?? undefined
                        }
                      />
                    </div>
                  </div>
                )}

                <FieldLabel
                  label="Must Hold ERC-20"
                  position="right"
                  labelProps={{
                    htmlFor: "requireHoldERC20",
                  }}
                >
                  <Checkbox
                    id="requireHoldERC20"
                    name="requireHoldERC20"
                    defaultChecked={props.frame?.requireHoldERC20}
                  />
                </FieldLabel>

                {formValue.requireHoldERC20 === "on" && (
                  <div className="py-4 border-t space-y-2">
                    <div className="flex items-center gap-4">
                      <label className="block mb-2 text-sm font-medium text-gray-700 w-[100px] text-right">
                        Network
                      </label>
                      <Select
                        name="requireERC20NetworkId"
                        required
                        defaultValue={
                          props.frame?.requireERC20NetworkId ?? undefined
                        }
                      >
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
                        defaultValue={
                          props.frame?.requireERC20ContractAddress ?? undefined
                        }
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
                        defaultValue={
                          props.frame?.requireERC20MinBalance ?? undefined
                        }
                      />
                    </div>
                  </div>
                )}
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
                            currentTarget:
                              document.getElementById("create-frame"),
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
                            currentTarget:
                              document.getElementById("create-frame"),
                          } as ChangeEvent<HTMLFormElement>);
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </FieldLabel>
              </div>
            </div>
          </div>

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
                    <div
                      dangerouslySetInnerHTML={{ __html: revealedSvg }}
                    ></div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        <Button className="mt-8 w-full" size={"lg"}>
          {props.isEditing ? "Save" : "Create"}
        </Button>
      </Form>
    </main>
  );
}
