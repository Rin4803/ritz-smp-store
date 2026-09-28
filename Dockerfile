FROM node:22-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Keep the package manager pinned by package.json and include patches before install.
COPY . .
RUN npm install -g corepack@latest \
    && corepack pnpm install --frozen-lockfile \
    && corepack pnpm run build

ENV NODE_ENV=production

EXPOSE 3000
CMD ["node", "dist/index.js"]
