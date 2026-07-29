FROM node:22-bookworm-slim
# Bumped from Node 20 to 22 to ensure compatibility with pnpm

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy dependency files and install
COPY package.json pnpm-lock.yaml* .npmrc* ./

# Use a hoisted linker for better compatibility with Docker and Vue CLI
RUN pnpm config set --location=project node-linker hoisted && \
    pnpm install --no-frozen-lockfile --dangerously-allow-all-builds

# Copy the rest of the source code
COPY . .

# Build the frontend (using the WASM if available)
RUN pnpm run build

# Output to /output - this is where nginx expects it
CMD ["sh", "-c", "cp -r dist/* /output/"]