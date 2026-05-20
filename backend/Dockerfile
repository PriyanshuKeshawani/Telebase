# Use Node.js LTS (active version) for the build environment
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Copy dependency manifests
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy the rest of the application files
COPY . .

# Generate the Prisma Client
RUN npx prisma generate

# Build TypeScript to Javascript
RUN npm run build

# --- Production Environment ---
FROM node:20-alpine AS runner

WORKDIR /usr/src/app

# Copy production manifests
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy generated Prisma client from builder
COPY --from=builder /usr/src/app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /usr/src/app/node_modules/@prisma/client ./node_modules/@prisma/client

# Copy built code and required configurations
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/prisma ./prisma
COPY --from=builder /usr/src/app/nodemon.json ./

EXPOSE 4000

ENV NODE_ENV=production

# Start the Express API server
CMD ["node", "dist/server.js"]
