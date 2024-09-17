## Overview

Automod is a Farcaster channel moderation service. It allows channel hosts to configure rules to automatically filter casts and manage their channel in teams.

## Technical Overview

All of automod is contained in a single repository and service. It contains the API, Queueing system, Marketing pages and all UI.

### Tech Stack

- **API Framework:** [Remix](https://remix.run)
- **Database:** PostgreSQL / [Prisma](https://www.prisma.io)
- **Queues:** [BullMQ](https://docs.bullmq.io/) with Redis
- **Hosting:** Anywhere that supports docker

### Project Structure

Automod favors less directories, less files and generally avoids DRYing things up unless its specifically required. Most code is colocated together if it can be which mean you will sometimes find components, route handlers and typings in the same file. Embrace it :P

- **app/routes:** Standard remix routes. Most routes include business logic directly only sharing code where strictly necessary.
- **app/components:** UI Components.
- **app/lib:** Clients, utils, and business logic.
  - **/validation.server.ts:** All supported rules and actions, mostly config driven
  - **/automod.server.ts:** Core business logic for validating a cast against the rules configured.
- **public:** Static files and assets
- **prisma:** Standard prisma migrations
- **bullboard:** A local server to monitor queues and tasks. See package.json to run.

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
# Update .env with your configuration, see .env.example for instructions
pnpm run dev
```

## Deployment

Automod is just a standard remix app. You can deploy it anywhere that supports Docker, Remix, or Node.

### With Remix

Almost all modern hosting companies auto-detect Remix applications. Just run initialize prisma after you install and before you start.

```sh
pnpm exec prisma migrate deploy
pnpm exec prisma generate
pnpm run start
```

### With Docker

- See [Deploy Workflow](.github/workflows/deploy.yml) for an example with Github Actions and Fly.io

### With Node

```sh
pnpm install
pnpm build
pnpm exec prisma migrate deploy
pnpm exec prisma generate
pnpm run start
```
