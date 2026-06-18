FROM node:20-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile --prod

COPY src/ src/

USER node

EXPOSE 3000

CMD ["node", "src/server.js"]
