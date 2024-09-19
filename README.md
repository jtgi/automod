![CleanShot 2024-09-17 at 13 25 56@2x](https://github.com/user-attachments/assets/449a14a6-69c1-4d82-9678-21bb2585d3bb)

## Overview

Automod is a Farcaster channel moderation service. It allows channel hosts to configure rules to automatically filter casts and manage their channel in teams.

## Technical Overview

All of automod is contained in a single repository and service. It contains the API, Queueing system, Marketing pages and all UI.

### Tech Stack

- **API Framework:** [Remix](https://remix.run)
- **Database:** PostgreSQL / [Prisma](https://www.prisma.io)
- **Queues:** [BullMQ](https://docs.bullmq.io/) with Redis
- **Hosting:** Anywhere that supports docker, node, or remix.

### Project Structure

Automod favors less directories, less files and generally avoids DRYing things up unless its specifically required. Most code is colocated together if it can be which mean you will sometimes find components, route handlers and typings in the same file.

- **/app/routes:** Standard remix routes. Most routes include business logic directly only sharing code where strictly necessary.
- **/app/components:** UI Components.
- **/app/lib:** Clients, utils, and business logic.
  - **/validation.server.ts:** All supported rules and actions, mostly config driven
  - **/automod.server.ts:** Core business logic for validating a cast against the rules configured.
  - **/bullish.server.ts:** Most queues and worker tasks are located here.
- **/public:** Static files and assets
- **/prisma:** Standard prisma migrations
- **/bullboard:** A local server to monitor queues and tasks. See package.json to run.

### Data Model

See the [Prisma Schema](./prisma/schema.prisma) for an overview.

Point of note:
- **ModeratedChannel inclusionRuleSet and exclusionRuleSet:** These are json strings that define the moderation rules. See the zod schema in [validation.server.ts](/app/lib/validation.server.ts) for its shape. You may wonder why the shape isn't simpler. Automod supports recursive logical expressions of rules as well as multiple actions to execute but the UI at time of writing only exposes a single AND/OR and no preset actions. Even this customers get stuck on quite often.
- **RuleSets:** deprecated in favor of `inclusionRuleSet` and `exclusionRuleSet`.

### Key Flows

**How a cast is moderated**

- Automod registers a channel url with Neynar when a new sign up happens
- When a cast comes in to the channel, Neynar triggers a webhook to automod
- Automod adds the cast to a queue to be processed using Redis-backed BullMQ
- A worker picks up the cast, looks up the channel moderation rules and validates the cast
- If it is accepted, a like on protocol is issued and the cast will appear in the moderated feed.

## Getting Started

### Local Development

```sh
git clone https://github.com/yourusername/automod.git
cd automod
pnpm install
cp .env.example .env
# Update .env with your configuration, see [.env.example](/.env.example) for instructions
pnpm run dev
```

## Deployment

- Automod is a standard remix app. You can deploy it anywhere that supports Docker, Remix, or Node.
- A separate Redis and Postgres instance is required as well as other 3rd party api keys, make sure to review the [environment variables](/.env.example) required.


### With Docker

See [Deploy Workflow](.github/workflows/deploy.yml) for an example with Github Actions and Fly.io

### With Remix

Almost all modern hosting companies auto-detect Remix applications. Just run initialize prisma after you install and before you start.

```sh
pnpm exec prisma migrate deploy
pnpm exec prisma generate
pnpm run start
```

### With Node

```sh
pnpm install
pnpm build
pnpm exec prisma migrate deploy
pnpm exec prisma generate
pnpm run start
```

## Support / Operations

### General support

Set your user's role as 'superadmin' and you can access the [/admin](https://automod.sh/~/admin) dashboard.

This will allow you to:

- Login and impersonate any user to help with rule configuration issues.
- Kick off recovery flows for channels in case there is downtime.
- Show an incident banner

### Dealing with downtime and misconfigurations

When Automod or other Farcaster infra goes down it means casts may not be moderated.

Login to [/admin](https://automod.sh/~/admin) console and run a sweep or recovery

- **Recovery:** Moderate historical casts not yet seen, useful when there was downtime and things were missed.
- **Sweep:** Moderate historical casts, even if they've already been seen. Useful if you or a customer ships bad moderation logic and everything must be reprocessed.

### Managing Queues

If you want to stop, start, delete or manage queues, point your env files at production Redis and run `pnpm bullboard` and open `https://localhost:8888/ui`. This should be exposed and hosted remotely but never needed to.

### Logs & Alerting

Sentry is used for client and server errors. All other logs are emitted to stdout via console.

A home made paging service (webhook-relay.fly.dev) is used to trigger critical alerts with sync propagation or dropped webhooks. You can point this wherever you like.

## Estimated Costs
At time of writing automod:
- Powers 550 channels
- ~1 request per second.
- Processes 500k+ casts per month.

All Data APIs are usage based and highly variable. Here's a snapshot of August.
| Service              | Provider                | Cost                                   | Notes                                                                |
|----------------------|-------------------------|----------------------------------------|----------------------------------------------------------------------|
| API                  | fly.io                  | $13/mo                                 | 2 X shared-cpu-2x with 1024 MB memory                                |
| PostgreSQL           | fly.io                  | $35/mo                                 | 2 X shared-cpu-2x with 4096 MB memory (over provisioned)             |
| Redis                | railway.app             | < $1/mo                                |                                                                      |
| Farcaster Data       | Neynar                  | > $100/mo (Contact Neynar)             | Used for cast metadata, webhooks, feeds, frames, etc.                |
| NFT Data             | SimpleHash              | > $100/mo (Contact SimpleHash)         | Needed for 1155 token lookups and Zora Network at high concurrency.  |
| Ethereum JSON Data   | Alchemy/Infura/Coinbase | ~$30/mo                                | Most ERC20/721/1155 token lookups and Sign in With Farcaster.        |
| Airstack Data        | Airstack                | Buy 1 Fan Token, free forever          | FarRank, FarScore                                                    |
| Moxie Data           | The Graph               | < $5/mo                                |                                                                      |

