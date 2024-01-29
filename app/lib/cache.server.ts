import NodeCache from "node-cache";
export const cache = new NodeCache({
  stdTTL: process.env.NODE_ENV !== "production" ? 30 : 60,
});
