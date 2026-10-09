# Production image for the web app. Build from the repository root:
#   docker build -f apps/web/Dockerfile .

FROM node:22-slim AS deps
WORKDIR /repo
# Workspace manifests only, so this layer is cached until dependencies change.
# Add each new workspace's package.json here.
COPY package.json yarn.lock ./
COPY apps/web/package.json apps/web/
COPY packages/downsample/package.json packages/downsample/
COPY packages/grid-model/package.json packages/grid-model/
COPY packages/ui/package.json packages/ui/
RUN yarn install --frozen-lockfile --non-interactive

FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Storybook first: it is served from public/storybook.
RUN yarn build:storybook && yarn workspace @pgo/web build

FROM node:22-slim AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=8080
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 8080
CMD ["node", "apps/web/server.js"]
