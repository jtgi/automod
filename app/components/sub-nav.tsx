"use client";

import { NavLink } from "@remix-run/react";

import { cn } from "~/lib/utils";

export interface SidebarNavProps extends React.HTMLAttributes<HTMLElement> {
  items: {
    to: string;
    title: string;
    end?: boolean;
  }[];
}

export function SidebarNav({ className, items, ...props }: SidebarNavProps) {
  return (
    <nav
      className={cn("flex gap-2 sm:gap-y-0 sm:flex-col sm:gap-x-0 lg:space-y-1 flex-wrap", className)}
      {...props}
    >
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end || false}
          prefetch="intent"
          className={({ isActive, isPending }) =>
            cn(
              isActive || isPending ? " bg-orange-50 hover:bg-orange-50" : "hover:bg-orange-50/50",
              isPending ? "animate-pulse" : "",
              "no-underline justify-start px-3 py-2 rounded-lg text-foreground font-medium text-sm border border-gray-100 sm:border-none"
            )
          }
        >
          {item.title}
        </NavLink>
      ))}
    </nav>
  );
}
