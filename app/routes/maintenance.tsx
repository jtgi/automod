export default function Screen() {
  return (
    <div
      className="h-full w-full flex flex-col items-center justify-center min-h-screen w-screen text-white"
      style={{
        backgroundImage:
          "radial-gradient( circle farthest-corner at 10% 20%,  rgba(237,3,32,0.87) 20.8%, rgba(242,121,1,0.84) 74.4% )",
      }}
    >
      <span className="text-6xl logo text-white opacity-80">automod</span>
      Under scheduled maintenance. Back shortly.
    </div>
  );
}
