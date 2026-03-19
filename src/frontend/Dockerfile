FROM node:20-bookworm-slim

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy dependency files and install
COPY package.json pnpm-lock.yaml* .npmrc* ./

# Use a hoisted linker for better compatibility with Docker and Vue CLI
RUN pnpm config set node-linker hoisted && \
    pnpm install --no-frozen-lockfile

# Copy the rest of the source code
COPY . .

# Build the frontend (using the WASM if available)
RUN pnpm run build

# Output to /output - this is where nginx expects it
CMD ["sh", "-c", "cp -r dist/* /output/"]
