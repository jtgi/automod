import { Outlet } from "@remix-run/react";

export default function Screen() {
  return (
    <div className="w-full h-full items-center justify-center flex flex-col">
      <div className="max-w-xl">
        <Outlet />
      </div>
    </div>
  );
}
