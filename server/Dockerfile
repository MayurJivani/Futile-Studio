# Built by GitHub Actions (.github/workflows/image.yml), pulled by Coolify on Jinx.
# The API only; the site itself is static (dist/), served by Caddy. Built from
# the repo root because the API shares the site's src/data (postcards, projects, ideas).
FROM node:22-slim
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY src/data /app/src/data
COPY server ./
ENV NODE_ENV=production PORT=4000
USER node
CMD ["node", "index.js"]
