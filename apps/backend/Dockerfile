# This is an npm workspaces monorepo, so package-lock.json only exists at the repo root.
# Build from there, not from apps/backend:
#   docker build -f apps/backend/Dockerfile -t woodid-backend .
FROM node:20-alpine

# Prisma's query engine needs OpenSSL, which the base Alpine image doesn't include.
RUN apk add --no-cache openssl

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json

RUN npm ci

COPY . .

WORKDIR /app/apps/backend

# The build compiles src/db/client.ts, which imports the generated Prisma client.
# That client is gitignored and doesn't exist until `prisma generate` runs.
RUN npx prisma generate
RUN npm run build

EXPOSE 3000

CMD ["node", "dist/index.js"]
