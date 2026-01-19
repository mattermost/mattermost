#!/bin/bash
# Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.

# CI-friendly script for running Python integration tests.
# This script provides consistent test invocation across environments.
#
# Usage:
#   ./scripts/run_integration_tests.sh
#   ./scripts/run_integration_tests.sh -v --tb=long  # Pass extra args to pytest

set -e

# Navigate to the python-sdk directory
cd "$(dirname "$0")/.."

echo "Running Python integration tests..."
echo "Working directory: $(pwd)"

# Check if virtual environment exists and activate it
if [ -d ".venv" ]; then
    echo "Using virtual environment at .venv"
    PYTHON=".venv/bin/python"
else
    echo "No virtual environment found, using system Python"
    PYTHON="python3"
fi

# Verify Python is available
if ! command -v "$PYTHON" &> /dev/null; then
    echo "ERROR: Python not found. Please install Python 3.9+ or create a virtual environment."
    exit 1
fi

echo "Python version: $($PYTHON --version)"

# Install package if needed (editable install for development)
if ! $PYTHON -c "import mattermost_plugin" 2>/dev/null; then
    echo "Installing mattermost-plugin-sdk in editable mode..."
    $PYTHON -m pip install -e ".[dev]" --quiet
fi

# Run integration tests
# -v: verbose output
# --tb=short: shorter tracebacks
# Extra arguments passed to this script are forwarded to pytest
echo "Executing: $PYTHON -m pytest tests/test_integration_e2e.py -v --tb=short $@"
$PYTHON -m pytest tests/test_integration_e2e.py -v --tb=short "$@"

echo "Integration tests completed successfully."
