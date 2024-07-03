import { getSubscriptionPlan } from "~/lib/subscription.server";

async function main() {
  const plan = await getSubscriptionPlan({
    fid: process.env.FID!,
  });
  console.log(plan);
}

main();
