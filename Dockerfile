# CI-style gate: the image only builds when every mermaid diagram parses.
FROM node:22-alpine

WORKDIR /guide
COPY package.json package-lock.json ./
RUN npm ci --silent --no-audit --no-fund

COPY . .
RUN node scripts/check-mermaid.mjs
