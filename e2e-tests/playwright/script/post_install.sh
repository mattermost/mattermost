#!/bin/bash

if [ -n "$PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD" ]; then
    echo "Skipped browsers download for Playwright"
    exit 0
fi

# Install needed Playwright browsers only -- chromium and firefox only for these are the ones being used by the tests.
# May add more browsers in the future.
# https://playwright.dev/docs/library#browser-downloads
npx playwright install chromium
npx playwright install firefox
