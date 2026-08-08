# Mattermost Plugin Playbooks Loadtest Browser package

Browser-based load testing package for the Mattermost Playbooks plugin.

## Overview

This package provides Playwright-powered browser automation scenarios for load testing the Mattermost Playbooks plugin. It simulates real user interactions with the Playbooks webapp interface.

For more information about the Mattermost load testing framework, see the https://github.com/mattermost/mattermost-load-test-ng/tree/master/browser.

## Available Simulations

For detailed information about each simulation's flow and actions, see [registry.md](./src/registry.md).

## Usage

This package is designed to be consumed by the [mattermost-load-test-ng](https://github.com/mattermost/mattermost-load-test-ng) browser controller. The simulations are registered in the `SimulationsRegistry` and can be selected by their ID when configuring load tests.

To package the build for use in mattermost-load-test-ng, it should be packaged into a tarball and placed in the `mattermost-load-test-ng/browser/packs` directory.

1. Build and package the project:
   ```bash
   npm run package
   ```

2. The tarball is created in the `packs/` directory with the format:
   ```
   mattermost-plugin-playbooks-loadtest-browser-{version}.tgz
   ```

1. Copy the tarball to the mattermost-load-test-ng browser packs directory:
   ```bash
   cp pack/*.tgz /path/to/mattermost-load-test-ng/browser/packs/
   ```

1. Install it in the mattermost-load-test-ng browser package:
   ```bash
   cd /path/to/mattermost-load-test-ng/browser
   npm install --save ./packs/mattermost-plugin-playbooks-loadtest-browser-{version}.tgz
   ```
