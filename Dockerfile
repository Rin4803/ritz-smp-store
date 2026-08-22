FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build application
RUN pnpm build

FROM node:22-alpine AS runner

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

ENV NODE_ENV=production

# Copy built files and dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/server ./server
COPY --from=builder /app/shared ./shared

EXPOSE 3000

CMD ["pnpm", "start"]
