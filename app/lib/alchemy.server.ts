import { Alchemy } from "alchemy-sdk";

export const alchemy = new Alchemy({
  apiKey: process.env.ALCHEMY_PROJECT_ID!,
});
