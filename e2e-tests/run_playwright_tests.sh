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
  npm install glob chalk dotenv axios axios-retry @playwright/test
fi

# Determine which script to run
if [ "$1" == "generate" ]; then
  echo "Generating test cycle..."
  node generate_test_cycle.js "${@:2}"
elif [ "$1" == "run" ]; then
  echo "Running test cycle..."
  node run_test_cycle.js "${@:2}"
else
  echo "Usage: $0 [generate|run] [options]"
  echo ""
  echo "Commands:"
  echo "  generate    Generate a test cycle"
  echo "  run         Run the generated test cycle"
  echo ""
  echo "Examples:"
  echo "  $0 generate"
  echo "  $0 run"
fi
