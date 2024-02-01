/** @type {import('@remix-run/dev').AppConfig} */
export default {
  browserNodeBuiltinsPolyfill: {
    modules: {
      buffer: true,
    }
  },
  serverDependenciesToBundle: [/^@farcaster.*/],
  ignoredRouteFiles: ["**/.*"],
};
