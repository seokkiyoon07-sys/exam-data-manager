# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl openssl-dev

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Dummy DATABASE_URL for build time (actual URL set at runtime)
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"

# Build Next.js
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

# Install OpenSSL for Prisma runtime
RUN apk add --no-cache openssl

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Set permissions
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
