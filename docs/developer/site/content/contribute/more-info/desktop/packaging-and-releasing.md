---
title: "Package and release"
heading: "Package and release the desktop app"
description: "Learn how to build, package and release the desktop app"
date: 2019-01-22T00:00:00-05:00
weight: 4
aliases:
  - /contribute/desktop/packaging-and-releasing
---

## Build

You can build the Desktop App by running the following command:

    npm run build

You can build the Desktop App for development and watch for changes in the main process with this command:

    npm run watch

Our application uses `webpack` to bundle the scripts together for the main and renderer process.  
There are bundles generated for each page used the renderer process, and one bundle for the main process.  
A bundle is also generated for the E2E tests when needed.

You can predefine certain variables in the app before building, by editing the build config under `src/common/config/buildConfig.ts`. For example, you can predefine servers, or disable server management.

## Package

Our app uses `electron-builder` to package the app into a distributable format for release.  
You can find the configuration for the builder in the `electron-builder.json` file in the root directory.

You can run the packager using this command:

    npm run package:<os>

where **\<os\>** is one of the following values: `windows, mac, mac-with-universal, mas, linux`

All of the above values will generate builds for `x64` and `arm64` architectures:
- `windows`: `exe`, `zip` and `msi` formats
- `mac`: `dmg` and `zip` formats
- `mac-with-universal`: universal binary for all architectures - `dmg`
- `mas`: universal Mac App Store-compliant build
- `linux`: `deb`, `rpm` and `tar.gz` formats

You can build for more specific targets using the commands [here]({{< ref "/contribute/more-info/desktop/build-commands#packaging" >}})

#### After pack script

We include an `afterPack` script to run functions after the application is built into a binary. This is a good place to inject code and make any modifications to the binary after build.

#### Code sign

In order to generate signed builds of the application for Windows and macOS, you'll need a certificate file for each of the operating systems.

These files are under control of Mattermost and aren't generally distributed, but you can obtain your own certificate and sign the app yourself if necessary.

For macOS, you'll need a valid `Mac Developer` or `Developer ID Application` certificate from the Apple Developer Program.

For Windows, you'll need a valid code signing certificate.

More information on Code Signing can be found here: https://www.electron.build/code-signing

## Release

Releasing a new version of the Desktop App can be done by running the shell script `release.sh` under the `scripts/` folder.  
It will increment the version number in `package.json` for you, create a tag and generate a commit for you. It will also give you the `git` command to run to push all these changes to your repository.

It has the following options:
```
// generates a patch version release candidate, will increment x of v0.0.x (so v5.0.1 becomes v5.0.2-rc1)
$ ./scripts/release.sh patch

// generates a release candidate version, on top of a current release candidate (so v5.0.2-rc1 becomes v5.0.2-rc2)
$ ./scripts/release.sh rc

// generates a final version, on top of a current release candidate (so v5.0.2-rc2 becomes v5.0.2)
$ ./scripts/release.sh final
```
