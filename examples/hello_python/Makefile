# Hello Python Plugin Makefile
#
# This Makefile provides targets for developing, testing, and packaging
# Python plugins for Mattermost. Use it as a template for your own plugins.

PLUGIN_ID := com.mattermost.hello-python
PLUGIN_VERSION := 0.1.0
BUNDLE_NAME := hello-python-$(PLUGIN_VERSION).tar.gz

# Python configuration
PYTHON ?= python3
VENV_DIR := venv
VENV_PYTHON := $(VENV_DIR)/bin/python

# SDK location (relative to this plugin)
SDK_DIR := ../../python-sdk

.PHONY: venv install dist clean run test lint help

## Creates virtual environment with SDK and dependencies
venv:
	@echo "Creating virtual environment..."
	$(PYTHON) -m venv $(VENV_DIR)
	$(VENV_PYTHON) -m pip install --upgrade pip
	$(VENV_PYTHON) -m pip install -e $(SDK_DIR)
	$(VENV_PYTHON) -m pip install -r requirements.txt
	@echo "Virtual environment ready. Activate with: source $(VENV_DIR)/bin/activate"

## Installs/updates dependencies in existing venv
install:
	$(VENV_PYTHON) -m pip install -e $(SDK_DIR)
	$(VENV_PYTHON) -m pip install -r requirements.txt

## Packages plugin into tar.gz for upload to Mattermost
dist: clean
	@echo "Packaging plugin as $(BUNDLE_NAME)..."
	@mkdir -p dist/server
	@cp plugin.json dist/
	@cp plugin.py dist/server/
	@cp requirements.txt dist/server/
	@# Include SDK as vendored dependency (optional - comment out if server has SDK installed)
	@if [ -d "$(SDK_DIR)/src/mattermost_plugin" ]; then \
		cp -r $(SDK_DIR)/src/mattermost_plugin dist/server/; \
	fi
	@cd dist && tar -czf ../$(BUNDLE_NAME) .
	@rm -rf dist
	@echo "Created $(BUNDLE_NAME)"
	@echo "Upload this file to your Mattermost server via System Console > Plugins"

## Creates distribution without vendored SDK (server must have SDK installed)
dist-minimal:
	@echo "Packaging minimal plugin (no vendored SDK)..."
	@mkdir -p dist/server
	@cp plugin.json dist/
	@cp plugin.py dist/server/
	@cp requirements.txt dist/server/
	@cd dist && tar -czf ../$(BUNDLE_NAME) .
	@rm -rf dist
	@echo "Created $(BUNDLE_NAME) (minimal - requires SDK on server)"

## Removes build artifacts
clean:
	rm -rf dist/ *.tar.gz
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	@echo "Cleaned build artifacts."

## Runs the plugin locally (for testing gRPC connection)
run:
	@echo "Running plugin locally..."
	@echo "Note: This requires MATTERMOST_PLUGIN_* env vars to be set"
	$(VENV_PYTHON) plugin.py

## Runs linting on plugin code
lint:
	@echo "Running type checking..."
	$(VENV_PYTHON) -m mypy plugin.py --ignore-missing-imports || true
	@echo "Linting complete."

## Shows available targets
help:
	@echo "Hello Python Plugin Makefile"
	@echo ""
	@echo "Targets:"
	@echo "  venv          - Create virtual environment with SDK and dependencies"
	@echo "  install       - Install/update dependencies in existing venv"
	@echo "  dist          - Package plugin as tar.gz (includes vendored SDK)"
	@echo "  dist-minimal  - Package plugin without SDK (server must have SDK)"
	@echo "  clean         - Remove build artifacts"
	@echo "  run           - Run plugin locally (requires env vars)"
	@echo "  lint          - Run type checking on plugin code"
	@echo ""
	@echo "Development workflow:"
	@echo "  1. make venv          # Set up environment"
	@echo "  2. source venv/bin/activate"
	@echo "  3. <edit plugin.py>"
	@echo "  4. make dist          # Package for upload"
	@echo "  5. Upload $(BUNDLE_NAME) to Mattermost"
