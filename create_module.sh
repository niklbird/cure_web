#!/bin/bash
cargo build --target wasm32-unknown-unknown --release
wasm-bindgen target/wasm32-unknown-unknown/release/cure_web.wasm --out-dir ./pkg --target web
