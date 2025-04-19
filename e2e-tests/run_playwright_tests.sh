#!/bin/bash
# Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.

# This script helps run the Playwright test cycle generation and execution
# from the correct directory.

# Change to the e2e-tests/playwright directory
cd "$(dirname "$0")/playwright"

# Check if we need to install dependencies
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install glob chalk dotenv axios axios-retry@3.1.9 form-data @playwright/test
fi

# Determine which script to run
if [ "$1" == "generate" ]; then
  echo "Generating test cycle..."
  node generate_test_cycle.js "${@:2}"
elif [ "$1" == "run" ]; then
  if [ -z "$2" ]; then
    echo "Error: CYCLE_ID is required for running tests"
    echo "Usage: $0 run <CYCLE_ID>"
    exit 1
  fi
  echo "Running test cycle with ID: $2"
  CYCLE_ID="$2" node run_test_cycle.js "${@:3}"
else
  echo "Usage: $0 [generate|run] [options]"
  echo ""
  echo "Commands:"
  echo "  generate              Generate a test cycle"
  echo "  run <CYCLE_ID>        Run the test cycle with the specified ID"
  echo ""
  echo "Examples:"
  echo "  $0 generate"
  echo "  $0 run abc123-def456"
fi
