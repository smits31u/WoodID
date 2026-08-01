# Build context: this directory (apps/backend), not the repo root:
#   docker build -t woodid-backend apps/backend
#
# This is an npm workspaces monorepo, so the root's package-lock.json isn't reachable from
# this context — Docker can't COPY files from outside the build context. `npm ci` requires
# a local lockfile and fails immediately without one, so dependencies are installed with
# `npm install` against package.json directly instead. Versions are resolved fresh from the
# semver ranges already pinned there, rather than reusing the monorepo root's exact
# lockfile entries.
FROM node:20-alpine

# Prisma's query engine needs OpenSSL, which the base Alpine image doesn't include.
RUN apk add --no-cache openssl

WORKDIR /app

COPY package.json ./

RUN npm install

COPY . .

# The build compiles src/db/client.ts, which imports the generated Prisma client.
# That client is gitignored and doesn't exist until `prisma generate` runs.
RUN npx prisma generate
RUN npm run build

EXPOSE 3000

CMD ["node", "dist/index.js"]
