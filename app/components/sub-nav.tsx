"use client";

import { NavLink } from "@remix-run/react";

import { cn } from "~/lib/utils";

export interface SidebarNavProps extends React.HTMLAttributes<HTMLElement> {
  items: {
    to: string;
    title: string;
  }[];
}

export function SidebarNav({ className, items, ...props }: SidebarNavProps) {
  return (
    <nav className={cn("flex space-x-2 sm:flex-col sm:space-x-0 lg:space-y-1", className)} {...props}>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          prefetch="intent"
          end
          className={({ isActive, isPending }) =>
            cn(
              isActive || isPending ? " bg-orange-50 hover:bg-orange-50" : "hover:bg-orange-50/50",
              isPending ? "animate-pulse" : "",
              "no-underline justify-start px-3 py-2 rounded-lg text-foreground font-medium text-sm"
            )
          }
        >
          {item.title}
        </NavLink>
      ))}
    </nav>
  );
}
