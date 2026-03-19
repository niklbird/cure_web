# ─── Rust → WASM builder ─────────────────────────────────────────────────────
# Compiles the cure_web crate to wasm32 and runs wasm-bindgen to produce the
# JS/TS glue + .wasm binary the frontend needs.

FROM rust:1.88-bookworm AS builder

# Install system deps needed for OpenSSL vendoring and other native builds
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    pkg-config \
    libssl-dev \
    perl \
    make \
    musl-tools \
    && rm -rf /var/lib/apt/lists/*

# Install wasm tooling
RUN rustup target add wasm32-unknown-unknown \
    && cargo install wasm-bindgen-cli

WORKDIR /build

# Copy the full Rust workspace (cure_web depends on sibling crates)
COPY Cargo.toml ./
COPY src/lib.rs src/lib.rs
COPY src/main.rs src/main.rs

# The workspace likely has local path dependencies — copy them too.
# Adjust these paths if your directory layout differs.
COPY cure_asn1/ cure_asn1/
COPY cure_pp/ cure_pp/

# Build the WASM target.
# OPENSSL_NO_VENDOR=0 forces openssl-sys to compile OpenSSL from source
# for the target rather than trying to find a system pkg-config package.
# If your crates support a "vendored-openssl" or similar feature, you can
# also enable that instead.
ENV OPENSSL_STATIC=1
RUN cargo build --target wasm32-unknown-unknown --release

# Generate JS bindings
RUN wasm-bindgen \
    target/wasm32-unknown-unknown/release/cure_web.wasm \
    --out-dir /output \
    --target web

# The /output directory now contains:
#   cure_web_bg.wasm
#   cure_web.js
#   cure_web.d.ts
#   cure_web_bg.wasm.d.ts
