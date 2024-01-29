# syntax = docker/dockerfile:1

# Adjust NODE_VERSION as desired
ARG NODE_VERSION=18.17.1
FROM node:${NODE_VERSION}-slim as base

LABEL fly_launch_runtime="Remix"

# Remix app lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV="production"
ENV PORT="3000"
ENV DATABASE_URL=file:/data/sqlite.db

# Install pnpm
ARG PNPM_VERSION=8.10.2
ARG PNPM_VERSION=8.10.2
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y openssl sqlite3 && \
    npm install -g pnpm@$PNPM_VERSION

# Throw-away build stage to reduce size of final image
FROM base as build

# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential sqlite3 node-gyp pkg-config python-is-python3

# Install node modules
COPY --link package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod=false

# Copy application code
COPY --link . .

# Build application
RUN pnpm run build

# Remove development dependencies
# RUN pnpm prune --prod


# Final stage for app image
FROM base

# Istall openssl n shit


# Copy built application
COPY --from=build /app /app

# Start the server by default, this can be overwritten at runtime
EXPOSE 3000
ENTRYPOINT [ "./start.sh" ]
