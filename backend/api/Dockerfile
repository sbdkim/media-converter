FROM node:20-slim

WORKDIR /app
COPY package.json ./
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg python3 python3-pip ca-certificates \
  && pip3 install --no-cache-dir yt-dlp \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/* \
  && npm install --omit=dev
COPY src ./src

ENV PORT=8080
EXPOSE 8080

CMD ["node", "src/server.js"]
