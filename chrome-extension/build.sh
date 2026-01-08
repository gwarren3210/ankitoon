#!/bin/bash

# Build script for Chrome extension
# Bundles TypeScript files to JavaScript

echo "Building Chrome extension..."

# Create dist directory structure
mkdir -p dist/background dist/popup dist/lib dist/config

# Copy HTML and CSS files
cp popup/popup.html dist/popup/
cp popup/popup.css dist/popup/
cp manifest.json dist/

# Bundle popup (includes all dependencies)
bun build popup/popup.ts \
  --outfile dist/popup/popup.js \
  --target browser \
  --format esm \
  --sourcemap=none

# Bundle background
bun build background/background.ts \
  --outfile dist/background/background.js \
  --target browser \
  --format esm \
  --sourcemap=none

echo "Build complete! Output in dist/ directory"
echo "Load the dist/ directory as an unpacked extension in Chrome"

