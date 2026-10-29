.PHONY: setup check format format-check build dev check-rime check-helper install-rime uninstall-rime

setup:
	npm ci --prefix raycast-extension

check: format-check
	npm --prefix raycast-extension run typecheck
	npm --prefix raycast-extension test

format:
	npm --prefix raycast-extension run format
	swift format format --in-place helper/Package.swift helper/Sources/*/*.swift helper/Tests/*/*.swift spikes/*.swift

format-check:
	npm --prefix raycast-extension run format:check

build:
	npm --prefix raycast-extension run prepare-assets
	npm --prefix raycast-extension run build

dev:
	npm --prefix raycast-extension run dev

check-rime:
	python3 spikes/lua-run.py tests/rime.test.lua
	./scripts/test-rime-engine.sh

install-rime:
	npm --prefix raycast-extension run install-rime

uninstall-rime:
	npm --prefix raycast-extension run uninstall-rime

check-helper:
	swift test --package-path helper
