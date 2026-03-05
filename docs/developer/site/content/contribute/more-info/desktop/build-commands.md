---
title: "Build and CLI commands"
heading: "Build and CLI command reference"
description: "Some useful build commands for the desktop app"
date: 2019-01-22T00:00:00-05:00
weight: 2
aliases:
  - /contribute/desktop/build-commands
---

## Build

Here's a list of all the commands used by the Desktop App. These can all be found in `package.json`, and should be run using `npm`, using the following syntax: ```npm run <command>```.

#### Testing and Verification

* `check` - Runs ESLint, checks types, validates the build config and runs the unit tests
    * `check-build-config` - Builds and validates the build config
    * `check-types` - Runs the TypeScript compiler against the code to check the types for errors
* `lint:js` - Runs ESLint against the code and displays results
    * `lint:js-quiet` - Same as above, but with the --quiet option
    * `fix:js` - Save as above, but attempts to fix some of the issues
* `test` - Builds and runs all of the automated tests for the Desktop App
    * `test:e2e` - Builds and runs the E2E tests for the Desktop App
        * `test:e2e:no-rebuild` - Runs the E2E tests without rebuilding the entire app
        * `test:e2e:run` - Runs the E2E tests without building them
        * `test:e2e:send-report` - Uploads E2E results
    * `test:unit` - Runs the unit tests for the main module
        * `test:unit-coverage` - Runs the unit tests and displays a coverage breakdown

#### Building and Running

* `build` - An amalgam of the following build commands, used to build the Desktop App:
    * `build:main` - Builds the source code used by the Electron Main process
    * `build:renderer` - Builds the source code used by the Electron Renderer process
    * `build:preload` - Builds the source code used by the preload scripts run in the preload context of the Electron Renderer process
* `build-prod` - Builds the app in production mode
    * `build-prod-mas` - Builds the app in production mode for Mac App Store distribution
    * `build-prod-upgrade` - Builds the app in production mode with auto-update functionality
* `build-test`- Builds the app for E2E testing
    * `build-test:e2e` - Builds only the E2E tests and not the app
    * `build-test:robotjs` - Builds the RobotJS test module for the current Electron version
* `start` - Runs the Desktop App using the current code built in the dist/ folder
* `restart` - Re-runs the build process and then starts the app (amalgam of build and start)
* `watch` - Runs the app, but watches for code changes and re-compiles on the fly when a file is changed

#### Packaging

* `package` - Builds and creates distributable packages for all OSes
    * `package:windows` - Builds and creates distributable packages for Windows
        * `package:windows-zip` - Builds and create distributable ZIP packages for Windows
        * `package:windows-installers` - Builds and creates distributable MSI and EXE packages for Windows
    * `package:mac` - Builds and creates distributable packages for macOS
        * `package:mac-with-universal` - Same as above, but includes a universal binary
    * `package:mas` - Builds and creates distributable packages for Mac App Store
        * `package:mas-dev` - Same as above, but builds the development version for testing
    * `package:linux` - Builds and creates distributable packages for Linux
        * `package:linux-tar` - Builds and creates distributable .tar.gz packagesfor Linux
        * `package:linux-pkg` - Builds and creates distributable .deb packages for Ubuntu/Debian and .rpm for Red Hat/Fedora
        * `package:linux-appImage` - Builds and creates distributable .AppImage packages for Linux

#### Workspace Utility

* `clean` - Removes all installed Node modules and built code
    * `clean-install` - Same as above, but then runs npm install to reinstall the Node modules
    * `clean-dist` - Only removes the built code
* `prune` - Runs ts-prune to display unused code
* `i18n-extract` - Scrape the codebase and adds missing translations to the translation file
* `create-linux-dev-shortcut`: Creates a shortcut for Linux developers to ensure deep linking works

## CLI options
Some useful CLI options the desktop app uses are shown below. You can also display these options by running: `npm run start help`.

```
--version, -v: Prints the application version
--dataDir, -d: Set the path to where user data is stored
--disableDevMode, -p: Disable development mode to allow for testing as if it was Production
```

## Environment variables

Some common environment variables that are used include:

- `NODE_ENV`: Defines the Node environment
    - `PRODUCTION`: Used for Production mode
    - `DEVELOPMENT`: Development mode
    - `TEST`: Used when running automated tests
- `MM_DEBUG_MODALS`: Used for debugging modals, set to `1` to show Developer Tools when a modal is opened
