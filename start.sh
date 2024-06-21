#!/bin/sh -ex

pnpm exec prisma migrate deploy
pnpm exec prisma generate
pnpm run start