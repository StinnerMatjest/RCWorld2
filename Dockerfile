# Base image
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm install --frozen-lockfile

# Copy application files
COPY . ./

# Build the Next.js application
RUN npm run build

# Production image
FROM node:18-alpine AS runner

# Set working directory
WORKDIR /app

# Install production dependencies
COPY package.json package-lock.json ./
RUN npm install --production --frozen-lockfile

# Copy built files from the builder
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules

# Expose the port that Next.js is running on
EXPOSE 3000

# Command to start the app
CMD ["npm", "start"]
