FROM node:22-slim

# Discord voice needs FFmpeg to decode the yt-dlp media stream. Current
# YouTube extraction also needs a supported JavaScript runtime plus yt-dlp's
# EJS challenge-solver scripts. Keep both Node 22 and Deno available so the
# Music bot has a reliable fallback when YouTube changes its client checks.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      ca-certificates \
      ffmpeg \
      python3 \
      python3-pip \
      curl \
      unzip \
    && python3 -m pip install --no-cache-dir --break-system-packages "yt-dlp[default]" \
    && curl -fsSL https://deno.land/install.sh | sh \
    && ln -sf /root/.deno/bin/deno /usr/local/bin/deno \
    && deno --version \
    && yt-dlp --version \
    && rm -rf /var/lib/apt/lists/* /root/.cache

WORKDIR /app

# Keep the package manager pinned by package.json and include patches before install.
COPY . .
RUN npm install -g corepack@latest \
    && corepack pnpm install --frozen-lockfile \
    && corepack pnpm run build

ENV NODE_ENV=production
ENV DENO_DIR=/tmp/deno-cache

EXPOSE 3000
CMD ["node", "dist/index.js"]
