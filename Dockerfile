FROM node:22-slim

# Discord voice needs FFmpeg to decode the yt-dlp media stream. yt-dlp's current
# YouTube extractor also needs a supported JavaScript runtime and EJS scripts;
# Node 22 is already in this image and yt-dlp[default] installs yt-dlp-ejs.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      ca-certificates \
      ffmpeg \
      python3 \
      python3-pip \
    && python3 -m pip install --no-cache-dir --break-system-packages "yt-dlp[default]" \
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
