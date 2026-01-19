#!/bin/bash
# Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.

# CI-friendly script for running Go integration tests.
# This script provides consistent test invocation across environments.
#
# Usage:
#   ./scripts/run_integration_tests.sh
#   ./scripts/run_integration_tests.sh -race  # Pass extra args to go test

set -e

# Navigate to the server/public directory (module root)
cd "$(dirname "$0")/../.."

echo "Running Go integration tests..."
echo "Working directory: $(pwd)"

# Verify Go is available
if ! command -v go &> /dev/null; then
    echo "ERROR: Go not found. Please install Go 1.21+."
    exit 1
fi

echo "Go version: $(go version)"

# Run integration tests
# -v: verbose output
# -run: filter to integration tests
# -count=1: disable test caching for clean runs
# Extra arguments passed to this script are forwarded to go test
echo "Executing: go test -v -run \"TestPythonPlugin|TestIntegration\" ./pluginapi/grpc/server/... -count=1 $@"
go test -v -run "TestPythonPlugin|TestIntegration" ./pluginapi/grpc/server/... -count=1 "$@"

echo "Integration tests completed successfully."
