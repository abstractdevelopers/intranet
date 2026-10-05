# Self-hosted image for UCA Sandbox.
#
# Next.js 16 with `output: "standalone"` produces a traced server in
# `.next/standalone` that carries only the dependencies each route uses, so the
# runtime stage needs no node_modules install.
#
# No secrets are baked in. DATABASE_URL and the rest are injected at runtime by
# Coolify, and the build does not touch the database.

# ---------------------------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
# Prisma needs libssl to pick the right query engine for Alpine (musl).
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json ./
# The package's postinstall runs `prisma generate`, which needs the schema on
# disk, so it is copied in before the install rather than after.
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN npm ci

# ---------------------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Prisma Client must be generated before `next build` traces it. It reads the
# schema only, so no database connection is required here.
RUN npx prisma generate
# NEXT_PUBLIC_* values are inlined into the client bundle at build time, so the
# VAPID public key must be present here, not only at runtime — otherwise push
# subscription silently gets an empty key. Defaults keep the build runnable
# without secrets; Coolify passes the real value as a build arg.
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY=""
ARG NEXT_PUBLIC_APP_URL=""
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---------------------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nextjs -G nodejs

# Standalone output is not copied by default: server.js expects these beside it.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# The generated Prisma client and its musl query engine are required at runtime;
# output tracing does not reliably pick up the .so.node engine, so it is copied
# explicitly. The Prisma CLI is deliberately not shipped — its bin tree is pruned
# by standalone tracing and cannot run here. Migrations are applied from a
# checkout against DIRECT_URL, not from inside this container.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
