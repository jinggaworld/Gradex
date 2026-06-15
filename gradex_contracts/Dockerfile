# Gradex Smart Contracts - Docker Build & Test Environment
# Uses Rust nightly to match rust-toolchain
FROM rust:latest

# Install nightly toolchain (matches rust-toolchain: nightly-2026-01-01)
RUN rustup install nightly-2026-01-01
RUN rustup default nightly-2026-01-01

# Add wasm target for Casper
RUN rustup target add wasm32-unknown-unknown

# Install Odra CLI
RUN cargo install cargo-odra --locked

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy contract source
COPY Cargo.toml Cargo.lock ./
COPY Odra.toml ./
COPY build.rs ./
COPY rust-toolchain ./
COPY bin/ ./bin/
COPY src/ ./src/
COPY tests/ ./tests/

# Default command: run all tests
CMD ["cargo", "odra", "test"]
