---
title: "Developer setup for Mattermost mobile apps"
description: "Set up a development environment for the React Native Mattermost mobile apps for iOS and Android."
sidebar_label: "Developer setup"
sidebar_position: 1
---

The following instructions apply to the mobile apps for iOS and Android built in React Native.
Download the iOS version [here](https://apps.apple.com/us/app/mattermost/id1257222717) and the Android version [here](https://play.google.com/store/apps/details?id=com.mattermost.rn).
Source code can be found at the [GitHub Mattermost Mobile app repository](https://github.com/mattermost/mattermost-mobile).

If you run into any issues getting your environment set up, check the [Troubleshooting](https://docs.mattermost.com/deploy/mobile-troubleshoot.html) section of the product docs for common solutions.


<Note title="iOS mobile app">
A macOS computer is required to build the Mattermost iOS mobile app.
</Note>



<Note title="Android mobile app">
Version 17 of the Java SE Development Kit (JDK) is required to develop the Mattermost Android mobile app. You can download the latest OpenJDK release of Java from Oracle, for free, under an open source license. On macOS, you can install a suitable build with Homebrew:

```sh
brew install --cask temurin@17
```

</Note>


## Environment setup

The following instructions apply to both iOS and Android mobile apps.
On macOS, we recommend using [Homebrew](https://brew.sh) as a package manager.

### Install NodeJS and NPM

We recommend using NodeJS v22 and npm v10. Many of our team use [nvm](https://github.com/nvm-sh/nvm) to manage npm and NodeJS versions.

<Tabs>
<TabItem value="node-npm-mac" label="macOS">
To install [NVM](https://github.com/nvm-sh/nvm), follow [these instructions](https://github.com/nvm-sh/nvm#installing-and-updating).

After installing, follow the post-install steps shown by the installer to add the necessary lines to your shell profile (for example `~/.zshrc` or `~/.bash_profile`). Then open a new terminal and run:

```sh
nvm install --lts
```
</TabItem>

<TabItem value="node-npm-linux" label="Linux">
There are three available options for installing NodeJS on Linux:

- Using NVM by following the instructions [here](https://github.com/nvm-sh/nvm#install-script).
- Install using your distribution's package manager.
- Download and install the package from the [NodeJS website](https://nodejs.org/en).

<Note>
The version of NodeJS that your distribution's package manager supports may not be the recommended version to build Mattermost mobile apps.
Please make sure that NodeJS installed by the package manager is at the recommended version.
</Note>
</TabItem>
</Tabs>

### Install Watchman

[Watchman](https://facebook.github.io/watchman) is a file watching program.
When a file changes, Watchman triggers an action, such as re-running a build command if a source file has changed.

The minimum required version of Watchman is 4.9.0.

<Tabs>
<TabItem value="watchman-mac" label="macOS">
To install Watchman using Homebrew, open a terminal and execute:

```sh
brew install watchman
```
</TabItem>

<TabItem value="watchman-linux" label="Linux">
Download the latest package from [here](https://github.com/facebook/watchman/releases).

<Note title="Inotify limits">
Note that you need to increase your `inotify` limits for Watchman to work properly.
</Note>
</TabItem>
</Tabs>

### Install `react-native-cli` tools

```sh
npm -g install react-native-cli
```

### Install Git

<Tabs>
<TabItem value="git-mac" label="macOS">
To install Git using Homebrew, open a terminal and execute:

```sh
brew install git
```
</TabItem>

<TabItem value="git-linux" label="Linux">
Some distributions come with Git preinstalled but you'll most likely have to install it yourself. For most distributions the package is simply called `git`.
</TabItem>
</Tabs>

## Additional setup for iOS (macOS)

### Install XCode

Install [Xcode](https://apps.apple.com/us/app/xcode/id497799835?ls=1&mt=12) to build and run the app on iOS. Use Xcode 16 or later: the app targets iOS 16.4 (see `ios/Podfile`) and CI builds it on GitHub's `macos-15` and `macos-26` runners, so those are the versions the build is exercised against.

After installing, accept the license agreement, either by launching Xcode once or by running:

```sh
sudo xcodebuild -license accept
```

### Install Ruby

A version of Ruby is automatically installed on macOS, but Mattermost React Native app development requires the Ruby version pinned in the repository's `.ruby-version` file (currently 3.2.11). You can check the current version of Ruby by running the following command.
```sh
ruby --version
```

If it isn't, we recommend using [Ruby Version Manager](https://rvm.io) or your preferred package manager to install the required version. The steps below are for using RVM.

1. Install the GPG keys for RVM using the command found [here](https://rvm.io/rvm/install#install-gpg-keys).
    1. If you don't have the `gpg` command, you can install it using Homebrew by running.
        ```sh
        brew install gnupg
        ```
2. Install the stable version of RVM using the following command.
    ```sh
    \curl -sSL https://get.rvm.io | bash -s stable --ruby
    ```
3. To load RVM, either open a new terminal or run the following command.
    ```sh
    source ~/.rvm/scripts/rvm
    ```
4. Install the required version of Ruby
    ```sh
    rvm install 3.2.11
    ```
5. (Optional) If you don't need to use a different version of Ruby for anything else, you'll want to change the default version of Ruby. Without this, you'll need to run `rvm use 3.2.11` any time you want to work on the mobile app.
    ```sh
    rvm alias create default 3.2.11
    ```

:::note[Apple Silicon]
On recent Apple Silicon Macs, installing Ruby through RVM can fail with repeated OpenSSL errors. If you hit those, [`rv`](https://github.com/spinel-coop/rv) (a Ruby version manager) is a reliable alternative:

```sh
brew install rv
rv ruby install 3.2.11
```

To have `rv` switch Ruby versions automatically, install its shell integration once. For example, for `zsh`:

```sh
echo 'eval "$(rv shell init zsh)"' >> ~/.zshrc
```

Run `rv shell <your-shell>` (`bash`, `fish`, etc.) to see the equivalent for your shell, then open a new terminal. After that, `rv` reads the repository's `.ruby-version` file and selects the pinned version automatically when you `cd` into the project.
:::

## Additional setup for Android

### Download and install Android Studio or Android SDK CLI tools

Download and install the [Android Studio app or the Android SDK command line tools](https://developer.android.com/studio/index.html#downloads)


<Note title="Default paths">
This documentation assumes you chose the default path for your Android SDK installation. If you chose a different path, adjust the environment variables below accordingly.
</Note>


#### Environment variables

Make sure you have the following environment variables configured for your platform:

<Tabs>
<TabItem value="droid-common" label="All platforms">
- Set `ANDROID_HOME` to where Android SDK is located (likely `/Users/<username>/Library/Android/sdk` or `/home/<username>/Android/Sdk`)
- Make sure your `PATH` includes `$ANDROID_HOME/platform-tools`, `$ANDROID_HOME/emulator`, and `$ANDROID_HOME/cmdline-tools/latest/bin`
</TabItem>

<TabItem value="droid-mac" label="macOS">
Since macOS Catalina the default shell is zsh, so add the following lines to your `~/.zshrc` file:

```sh
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH
```

Then reload your shell configuration:

```sh
source ~/.zshrc
```


<Note>
If you use a different shell, put these lines in its startup file instead — `~/.bash_profile` for bash, for example — and reload that file.
</Note>
</TabItem>

<TabItem value="droid-linux" label="Linux">
On Linux the home folder is located under `/home/<username>` which results in a slightly different path:

```sh
export ANDROID_HOME=/home/<username>/Android/Sdk
export PATH=$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH
```

Then reload your configuration

```sh
source ~/.bash_profile
```


<Note>
Depending on the shell you're using, this might need to be put into a different file such as `~/.zshrc`. Adjust this accordingly.
</Note>
</TabItem>
</Tabs>

### Install the SDKs and SDK tools

In the SDK Manager using Android Studio or the [Android SDK command line tool](https://developer.android.com/studio/command-line/sdkmanager.html), ensure the following are installed:

The versions below match `android/build.gradle`, which is the source of truth. If a build fails complaining about a missing SDK or build-tools version, check that file first.

- SDK Tools (you may have to select **Show Package Details** to expand packages):
  - Android SDK Build-Tools 36.0.0
  - Android Emulator
  - Android SDK Platform-Tools
  - Android SDK Command-line Tools (latest)
  - NDK (Side by side) 27.1.12297006
  - CMake
  - Google Play services
  - Support Repository
    - Android Support Repository
    - Google Repository

  ![image](sdk_tools.png)

- SDK Platforms, under **Android 16.0**:
  - Android SDK Platform 36
  - Google APIs ARM 64 v8a System Image on Apple Silicon, or Google APIs Intel x86 Atom\_64 System Image on Intel

  ![image](sdk_platforms.png)

### Create an Android Virtual Device

In Android Studio, select **More Actions > Device Manager**, then **Create Virtual Device**. Pick a device definition, then a system image matching the API level and architecture you installed above. Choose an image that includes **Google APIs** so Google Play services are available.

## Obtain the source code

In order to develop and build the Mattermost mobile apps, you'll need to get a copy of the source code. Forking the `mattermost-mobile` repository will also make it easy to contribute your work back to the project in the future.

1. Fork the [mattermost-mobile](https://github.com/mattermost/mattermost-mobile) repository on GitHub.

2. Clone your fork locally:

   a. Open a terminal

   b. Change to a directory you want to hold your local copy

   c. Run `git clone https://github.com/<username>/mattermost-mobile.git` if you want to use HTTPS, or `git clone git@github.com:<username>/mattermost-mobile.git` if you want to use SSH

     
<Note>
`<username>` refers to the username or organization in GitHub that forked the repository
</Note>


3. Change the directory to `mattermost-mobile`.

   ```sh
   cd mattermost-mobile
   ```

4. Install the project dependencies with `npm install`
