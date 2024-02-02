/* eslint-disable @typescript-eslint/no-explicit-any */
import { redirect, typedjson, useTypedLoaderData } from "remix-typedjson";
import { Input } from "~/components/ui/input";
import { generateFrameSvg } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Frame, User } from "@prisma/client";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, json } from "@remix-run/react";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
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
import { db } from "~/lib/db.server";
import { commitSession, getSession } from "~/lib/auth.server";
import { FrameForm } from "./~.frames.$slug.edit";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser({ request });
  return typedjson({ user, env: getSharedEnv() });
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser({ request });

  const session = await getSession(request.headers.get("Cookie"));
  const formData = await request.formData();
  const data = Object.fromEntries(formData.entries()) as any;

  if (!data.slug || data.slug.length <= 1) {
    session.flash("error", "Slug must be at least 2 characters long");
    return json(
      {
        errors: {
          slug: "Slug must be at least 2 characters long",
        },
      },
      {
        status: 400,
        headers: {
          "Set-Cookie": await commitSession(session),
        },
      }
    );
  }

  if (data.slug === "login") {
    session.flash("error", "Slug is reserved");
    return json(
      {
        errors: {
          slug: "Slug is reserved",
        },
      },
      {
        status: 400,
        headers: {
          "Set-Cookie": await commitSession(session),
        },
      }
    );
  }

  const existingFrame = await db.frame.findUnique({
    where: {
      slug: data.slug,
    },
  });

  if (existingFrame) {
    session.flash("error", "Slug is already taken, try another.");
    return json(
      {
        errors: {
          slug: "Slug already exists",
        },
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
        userId: user.id,
        imageUrl: data.imageUrl,
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
      return e.message;
    });

  if (typeof frame === "string") {
    return json({ error: frame }, { status: 400 });
  }

  session.flash("newFrame", frame.slug);

  return redirect(`/~`, {
    headers: {
      "Set-Cookie": await commitSession(session),
    },
  });
}

export default function NewFrame() {
  const { env } = useTypedLoaderData<typeof loader>();

  return <FrameForm isEditing={false} hostUrl={env.hostUrl} />;
}
