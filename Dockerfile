# Base image
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install dependencies
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# Copy application files
COPY . .

# Build the Next.js application
RUN yarn build

# Production image
FROM node:18-alpine AS runner
WORKDIR /app

# Install dependencies (production-only)
COPY package.json yarn.lock ./
RUN yarn install --production --frozen-lockfile

# Copy built files
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules

# Expose port
EXPOSE 3000

# Start the Next.js application
CMD ["yarn", "start"]
