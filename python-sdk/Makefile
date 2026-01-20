# Python SDK Makefile

.PHONY: venv proto-gen build test lint clean help

PYTHON ?= python3
VENV_DIR := .venv
VENV_PYTHON := $(VENV_DIR)/bin/python

## Creates virtual environment and installs dependencies
venv:
	@echo "Creating virtual environment..."
	$(PYTHON) -m venv $(VENV_DIR)
	$(VENV_PYTHON) -m pip install --upgrade pip
	$(VENV_PYTHON) -m pip install -e ".[dev]"
	@echo "Virtual environment ready. Activate with: source $(VENV_DIR)/bin/activate"

## Generates Python gRPC code from .proto files
proto-gen:
	@echo "Generating Python protobuf/gRPC code..."
	$(VENV_PYTHON) scripts/generate_protos.py
	@echo "Proto generation complete."

## Builds the SDK package (wheel and sdist)
build: proto-gen
	@echo "Building SDK package..."
	$(VENV_PYTHON) -m pip install build
	$(VENV_PYTHON) -m build
	@echo "Build complete. Packages in dist/"

## Runs tests
test:
	@echo "Running tests..."
	$(VENV_PYTHON) -m pytest tests/ -v
	@echo "Tests complete."

## Runs type checking
lint:
	@echo "Running type checking..."
	$(VENV_PYTHON) -m mypy src/mattermost_plugin --ignore-missing-imports
	@echo "Type checking complete."

## Cleans build artifacts
clean:
	rm -rf dist/ build/ *.egg-info src/*.egg-info
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .mypy_cache -exec rm -rf {} + 2>/dev/null || true
	@echo "Cleaned build artifacts."

## Shows available targets
help:
	@echo "Python SDK Makefile targets:"
	@echo "  venv       - Create virtual environment and install dependencies"
	@echo "  proto-gen  - Generate Python gRPC code from proto files"
	@echo "  build      - Build SDK package (wheel and sdist)"
	@echo "  test       - Run tests"
	@echo "  lint       - Run type checking with mypy"
	@echo "  clean      - Remove build artifacts"
