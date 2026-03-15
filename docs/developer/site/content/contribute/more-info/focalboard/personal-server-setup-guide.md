---
title: "Personal server setup guide"
heading: "Personal server setup guide"
description: "Learn how to build the Focalboard personal server."
date: 2022-03-24T00:40:23-07:00
weight: 1
aliases:
  - /contribute/focalboard/personal-server-setup-guide
---

This guide will help you configure your developer environment for the Focalboard **Personal Server**. For most features, this is the easiest way to get started working against code that ships across editions. For working with **Mattermost Boards** (Focalboard as a plugin), please refer to the [Mattermost Boards Plugin Guide]({{< ref "/contribute/more-info/focalboard/mattermost-boards-setup-guide" >}}).

## Install prerequisites
### All
* {{< newtabref href="https://git-scm.com/book/en/v2/Getting-Started-Installing-Git" title="Git" >}} (if using Windows, see below)
* {{< newtabref href="https://golang.org/doc/install" title="Go" >}}
* {{< newtabref href="https://nodejs.org/en/download/" title="Node.js" >}} (v10+)
* {{< newtabref href="https://www.npmjs.com/get-npm" title="npm" >}}

### Windows
* Install {{< newtabref href="https://community.chocolatey.org/packages/mingw" title="MinGW-w64" >}} via {{< newtabref href="https://chocolatey.org/" title="Chocolatey" >}}
* Install {{< newtabref href="https://gitforwindows.org/" title="Git for Windows" >}} and use the `git-bash` terminal shell

### Mac
* Install {{< newtabref href="https://apps.apple.com/us/app/xcode/id497799835?mt=12" title="Xcode" >}} (v12+)
* Install the Xcode Command Line Tools via `xcode-select --install`

### Linux
* `sudo apt-get install libgtk-3-dev`
* `sudo apt-get install libwebkit2gtk-4.0-dev`
* `sudo apt-get install autoconf dh-autoreconf`

## Fork the project repositories

Fork the {{< newtabref href="https://github.com/mattermost/focalboard" title="Focalboard GitHub repository" >}} and {{< newtabref href="https://github.com/mattermost/mattermost" title="Mattermost GitHub repository" >}}. Clone both repositories locally in sibling directories.

## Build via the terminal

To build the server:

```
make prebuild
make
```

To run the server:

```
 ./bin/focalboard-server
```

Then navigate your browser to {{< newtabref href="http://localhost:8000" title="`http://localhost:8000`" >}} to access your Focalboard server. The port is configured in `config.json`.

Once the server is running, you can rebuild just the web app via `make webapp` in a separate terminal window. Reload your browser to see the changes.

## Build and run standalone desktop apps

You can build standalone apps that package the server to run locally against {{< newtabref href="https://www.sqlite.org/index.html" title="SQLite" >}}:

* **Windows**:
    * *Requires Windows 10, {{< newtabref href="https://developer.microsoft.com/en-us/windows/downloads/sdk-archive/" title="Windows 10 SDK" >}} 10.0.19041.0, and .NET 4.8 developer pack*
    * Open a `git-bash` prompt.
    * Run `make prebuild`
    * The above prebuild step needs to be run only when you make changes to or want to install your npm dependencies, etc.
    * Once the prebuild is completed, you can keep repeating the below steps to build the app & see the changes.
    * Run `make win-wpf-app`
    * Run `cd win-wpf/msix && focalboard.exe`
* **Mac**:
    * *Requires macOS 11.3+ and Xcode 13.2.1+*
    * Run `make prebuild`
    * The above prebuild step needs to be run only when you make changes to or want to install your npm dependencies, etc.
    * Once the prebuild is completed, you can keep repeating the below steps to build the app & see the changes.
    * Run `make mac-app`
    * Run `open mac/dist/Focalboard.app`
* **Linux**:
    * *Tested on Ubuntu 18.04*
    * Install `webgtk` dependencies
        * Run `sudo apt-get install libgtk-3-dev`
        * Run `sudo apt-get install libwebkit2gtk-4.0-dev`
    * Run `make prebuild`
    * The above prebuild step needs to be run only when you make changes to or want to install your npm dependencies, etc.
    * Once the prebuild is completed, you can keep repeating the below steps to build the app & see the changes.
    * Run `make linux-app`
    * Uncompress `linux/dist/focalboard-linux.tar.gz` to a directory of your choice
    * Run `focalboard-app` from the directory you have chosen
* **Docker**:
    * To run it locally from offical image:
        * `docker run -it -p 80:8000 mattermost/focalboard`
    * To build it for your current architecture:
        * `docker build -f docker/Dockerfile .`
    * To build it for a custom architecture (experimental):
        * `docker build -f docker/Dockerfile --platform linux/arm64 .`

Cross-compilation currently isn't fully supported, so please build on the appropriate platform. Refer to the GitHub Actions workflows (`build-mac.yml`, `build-win.yml`, `build-ubuntu.yml`) for the detailed list of steps on each platform.

## Set up VS Code

* Open a {{< newtabref href="https://code.visualstudio.com/" title="VS Code" >}} terminal window in the project folder.
* Run `make prebuild` to install packages. *Do this whenever dependencies change in `webapp/package.json`.*
* Run `cd webapp && npm run watchdev` to automatically rebuild the web app when files are changed. It also includes source maps from JavaScript to TypeScript.
* Install the {{< newtabref href="https://marketplace.visualstudio.com/items?itemName=golang.Go" title="Go" >}} and {{< newtabref href="https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint" title="ESLint" >}} VS Code extensions (if you haven't already).
* Launch the server:
    * **Windows**: <kbd><kbd>Ctrl</kbd>+<kbd>P</kbd></kbd>, type `debug`, press the <kbd>Space</kbd> key, and select `Go: Launch Server`.
    * **Mac**: <kbd><kbd>Cmd</kbd>+<kbd>P</kbd></kbd>, type `debug`, press the <kbd>Space</kbd> key, and select `Go: Launch Server`.
    * *If you do not see `Go: Launch Server` as an option, check your `./.vscode/launch.json` file and make sure you are not using a VS Code workspace.*
* Navigate a browser to `http://localhost:8000`

You can now edit the web app code and refresh the browser to see your changes efficiently.

**Debugging the web app**: As a starting point, add a breakpoint to the `render()` function in `BoardPage.tsx` and refresh the browser to walk through page rendering.

**Debugging the server**: As a starting point, add a breakpoint to `handleGetBlocks()` in `server/api/api.go` and refresh the browser to see how data is retrieved.

## Rebuild translations

We use `i18n` to localize the web app. Localized string generally use `intl.formatMessage`. When adding or modifying localized strings, run `npm run i18n-extract` in `webapp` to rebuild `webapp/i18n/en.json`.

Translated strings are stored in other json files under `webapp/i18n`, (e.g. `es.json` for Spanish).

## Access the database

By default, data is stored in a sqlite database `focalboard.db`. You can view and edit this directly using `sqlite3 focalboard.db`.

## Unit tests

Run `make ci`, which is similar to the `.gitlab-ci.yml` workflow and includes:

* **Server unit tests**: `make server-test`
* **Web app ESLint**: `cd webapp; npm run check`
* **Web app unit tests**: `cd webapp; npm run test`
* **Web app UI tests**: `cd webapp; npm run cypress:ci`

Unit tests for Focalboard are similar to the [web app and server testing]({{< ref "/contribute/more-info/getting-started/test-guideline" >}}) requirements.

## Staying informed

Are you interested in influencing the future of the Focalboard open source project? Please read the [Focalboard Contribution Guide]({{< ref "/contribute/more-info/focalboard/" >}}). We welcome everyone and appreciate any feedback. ❤️ There are several ways you can get involved:

* **Changes**: See the {{< newtabref href="https://github.com/mattermost/focalboard/blob/main/CHANGELOG.md" title="CHANGELOG" >}} for the latest updates
* **GitHub Discussions**: Join the {{< newtabref href="https://github.com/mattermost/focalboard/discussions" title="Developer Discussion" >}} board
* **Bug Reports**: {{< newtabref href="https://github.com/mattermost/focalboard/issues/new?assignees=&labels=bug&template=bug_report.md&title=" title="File a bug report" >}}
* **Chat**: Join the {{< newtabref href="https://community.mattermost.com/core/channels/focalboard" title="Focalboard community channel" >}}
