# Base image
FROM node:18-alpine AS builder
WORKDIR /app

# Install dependencies and build
COPY package.json package-lock.json ./
RUN npm install --frozen-lockfile
COPY . ./
RUN npm run build

# Production image
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV production

# Standalone automatically copies the config, so we just grab the standalone folder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Run the standalone server directly
CMD ["node", "server.js"]