# syntax=docker/dockerfile:1.7
# Practice web (@osp/web) — Next.js standalone, ARM64 Fargate.
FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY apps/agent/package.json apps/agent/package.json
COPY packages/core/package.json packages/core/package.json
RUN pnpm install --frozen-lockfile --filter @osp/web...

FROM base AS builder
COPY --from=deps /app/ ./
COPY tsconfig.base.json ./
COPY packages/core packages/core
COPY apps/web apps/web
COPY profiles profiles
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=""
ARG NEXT_PUBLIC_OSP_APP_NAME=Capveon
ARG NEXT_PUBLIC_OSP_PRODUCT=Practice
ARG NEXT_PUBLIC_OSP_MARK=arch
ARG NEXT_PUBLIC_OSP_TAGLINE="Live calls against the people who own the system."
ARG NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
ARG NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
ARG NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/
ARG NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY \
    NEXT_PUBLIC_OSP_APP_NAME=$NEXT_PUBLIC_OSP_APP_NAME \
    NEXT_PUBLIC_OSP_PRODUCT=$NEXT_PUBLIC_OSP_PRODUCT \
    NEXT_PUBLIC_OSP_MARK=$NEXT_PUBLIC_OSP_MARK \
    NEXT_PUBLIC_OSP_TAGLINE=$NEXT_PUBLIC_OSP_TAGLINE \
    NEXT_PUBLIC_CLERK_SIGN_IN_URL=$NEXT_PUBLIC_CLERK_SIGN_IN_URL \
    NEXT_PUBLIC_CLERK_SIGN_UP_URL=$NEXT_PUBLIC_CLERK_SIGN_UP_URL \
    NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=$NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL \
    NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=$NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL
RUN pnpm --filter @osp/web exec tsx ../../packages/core/src/scripts/write-bundle.ts \
  && mkdir -p apps/web/public \
  && pnpm --filter @osp/web build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN groupadd -r nodejs && useradd -r -g nodejs nextjs
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
