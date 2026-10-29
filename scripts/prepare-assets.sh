#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
swift build -c release --package-path helper
cp helper/.build/release/memeboard-helper raycast-extension/assets/memeboard-helper
cp rime/meme_tips.lua raycast-extension/assets/meme_tips.lua
cp tests/fixtures/paste-test.png raycast-extension/assets/test.png
chmod 755 raycast-extension/assets/memeboard-helper
