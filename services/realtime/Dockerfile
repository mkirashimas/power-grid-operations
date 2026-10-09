# Image for the realtime WebSocket service (Cloud Run service pgo-realtime).
# Build from the repository root:
#   docker build -f services/realtime/Dockerfile .

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080
# Only the realtime service and the grid model it imports; the web app is not part of it.
COPY package.json yarn.lock ./
COPY packages/grid-model/package.json packages/grid-model/
COPY services/realtime/package.json services/realtime/
RUN yarn install --frozen-lockfile --non-interactive --production --ignore-scripts \
    && yarn cache clean
COPY packages/grid-model/src packages/grid-model/src
COPY packages/grid-model/data packages/grid-model/data
COPY services/realtime/src services/realtime/src
USER node
EXPOSE 8080
# Node runs the TypeScript directly: no build step.
CMD ["node", "--experimental-strip-types", "--disable-warning=ExperimentalWarning", "services/realtime/src/main.ts"]
