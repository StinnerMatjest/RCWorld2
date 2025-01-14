# syntax = docker/dockerfile:1

# Adjust NODE_VERSION as desired
ARG NODE_VERSION=22.12.0
FROM node:${NODE_VERSION}-slim AS base

LABEL fly_launch_runtime="Next.js"

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Next.js app lives here
WORKDIR /app

# Throw-away build stage to reduce size of final image
FROM base AS builder

# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3

# Install node modules
COPY package-lock.json package.json ./
RUN npm ci --include=dev

# Copy application code
COPY . .

# Build application
RUN npx next build --experimental-build-mode compile

# Remove development dependencies
RUN npm prune --omit=dev

# Final stage for app image
FROM base AS runner

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Create user for running app
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary build artifacts from the builder stage
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./standalone
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app /app

WORKDIR /app

# Ensure proper permissions for the .next directory
RUN mkdir -p /app/.next && chown -R nextjs:nodejs /app/.next

# Copy entrypoint script
COPY docker-entrypoint.js /app/docker-entrypoint.js
RUN chmod +x /app/docker-entrypoint.js

# Set entrypoint
ENTRYPOINT ["/app/docker-entrypoint.js"]

# Set non-root user for running the app
USER nextjs
EXPOSE 3000
CMD ["npm", "run", "start"]