---
title: "Build the Android mobile app"
heading: "How to build a Mattermost Android mobile app"
description: "At times, you may want to build your own Mattermost mobile app. Learn how you can go about doing it."
date: 2018-05-20T11:35:32-04:00
weight: 1
aliases:
  - /contribute/mobile/build-your-own/android
---

At times, you may want to build your own Mattermost mobile app. The most common use cases are:

* To white label the Mattermost mobile app.
* To use your own deployment of the Mattermost Push Notification Service (always required if you are building your own version of the mobile app).

# Build preparations

### 1. Package name and source files

* Ensure the package ID of the mobile app remains the same as the one in the original {{< newtabref href="https://github.com/mattermost/mattermost-mobile" title="mattermost-mobile GitHub repository" >}} in `com.mattermost.rnbeta`.
* Source files for the main package remain under the `android/app/src/main/java/com/mattermost/rnbeta` folder.

### 2. Generate a signing key

As Android requires all apps to be digitally signed with a certificate before they can be installed building the Android app for distribution requires the release APK to be signed.

To generate the signed key, use **keytool** which comes with the JDK required to develop the Android app. (see [Developer Setup]({{< ref "/contribute/more-info/mobile/developer-setup#additional-setup-for-android" >}})).

```sh
$ keytool -genkey -v -keystore <my-release-key>.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
```

The above command prompts you for passwords for the keystore and key (make sure you use the same password for both), and asks you to provide the Distinguished Name fields for your key. It then generates the keystore as a file called `<my-release-key>.keystore`.

The keystore contains a single key, valid for 10000 days. The alias is a name that you will use later when signing your app, so remember to take a note of the alias.

---
{{<note "Note:">}}
* Replace `<my-release-key>` with the filename you want to specify.
* Remember to keep your keystore file private and never commit it to version control.
{{</note>}}

---

### 3. Create a new app in Google Play

Create a new application using the {{< newtabref href="https://play.google.com/console/developers" title="Google Play console" >}}. If you already have an app registered in the Google Play console you can skip this step.

### 4. Set up Gradle variables {#gradle}

Now that we have created the keystore file we can tell the build process to use that file:

- Copy or move the `my-release-key.keystore` file under a directory that you can access. It can be in your home directory or anywhere in the file system.
- Edit the `gradle.properties` file in your `$HOME` directory (e.g. `$HOME/.gradle/gradle.properties`), or create it if one does not exist, and add the following:

    ```sh
    MATTERMOST_RELEASE_STORE_FILE=/full/path/to/directory/containing/my-release-key.keystore
    MATTERMOST_RELEASE_KEY_ALIAS=my-key-alias
    MATTERMOST_RELEASE_PASSWORD=*****
    ```
---
{{<note "Note:">}}
* Replace `/full/path/to/directory/containing/my-release-key.keystore` with the full path to the actual keystore file and `********` with the actual keystore password.
* Back up your keystore and don't forget the password.
{{</note>}}

---
---
**Important:**

Once you publish the app on the Play Store, the app needs to be signed with the same key every time you want to distribute a new build. If you lose this key, you will need to republish your app under a different package id (losing all downloads and ratings).

---

### 5. Configure environment variables

To make it easier to customize your build, we've defined a few environment variables that are going to be used by Fastlane during the build process.

| Variable                               | Description                                                                                                                                                                                                                                                                                      | Default                    | Required |
|----------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------|----------|
| `COMMIT_CHANGES_TO_GIT`                | Should the Fastlane script ensure that there are no changes to Git before building the app and that every change made during the build is committed back to Git. <br><br>Valid values are: `true`, `false`                                                                                       | `false`                    | No       |
| `BRANCH_TO_BUILD`                      | Defines the Git branch that is going to be used for generating the build. <br><br>**Make sure that, if this value is set, the branch it is set to exists**.                                                                                                                                      | `$GIT_BRANCH`              | No       |
| `GIT_LOCAL_BRANCH`                     | Defines the local branch to be created from `BRANCH_TO_BUILD` to ensure the base branch does not get any new commits on it. <br><br>**Make sure a branch with this name does not yet exist in your local Git repository**.                                                                       | build                      | No       |
| `RESET_GIT_BRANCH`                     | Defines if, once the build is done, the branch should be reset to the initial state before building and whether to also delete the branch created to build the app. <br><br>Valid values are: `true`, `false`                                                                                    | `false`                    | No       |
| `VERSION_NUMBER `                      | Set the version of the app at build time to a specific value, rather than using the one set in the project.                                                                                                                                                                                      |                            | No       |
| `INCREMENT_VERSION_NUMBER_MESSAGE` | Set the commit message when changing the app version number.                                                                                                                                                                                                                                     | Bump app version number to | No       |
| `INCREMENT_BUILD_NUMBER`               | Defines if the app build number should be incremented. <br><br>Valid values are: `true`, `false`                                                                                                                                                                                                 | `false`                    | No       |
| `BUILD_NUMBER`                         | Set the build number of the app at build time to a specific value, rather than incrementing the last build number.                                                                                                                                                                               |                            | No       |
| `INCREMENT_BUILD_NUMBER_MESSAGE`   | Set the commit message when changing the app build number.                                                                                                                                                                                                                                       | Bump app build number to   | No       |
| `ANDROID_BUILD_TASK`                   | The build tasks for Android. This is a comma-separated list of tasks that can have two values: 'assemble' and 'bundle'. <br><br>`assemble` is used for building `APK` file and `bundle` is used for building `AAB` file.                                                                         | assemble                   | No       |
| `APP_NAME`                             | The name of the app as it is going to be shown on the device home screen.                                                                                                                                                                                                                        | Mattermost Beta            | Yes      |
| `APP_SCHEME`                           | The URL naming scheme for the app as used in direct deep links to app content from outside the app.                                                                                                                                                                                              | mattermost                 | No       |
| `REPLACE_ASSETS`                       | Override the assets as described in [White Labeling]({{< ref "/contribute/more-info/mobile/build-your-own/white-label" >}}). <br><br>Valid values are: `true`, `false`                                                                                                                           | `false`                    | No       |
| `MAIN_APP_IDENTIFIER`                  | The package identifier for the app.                                                                                                                                                                                                                                                              |                            | Yes      |
| `BUILD_FOR_RELEASE`                    | Defines if the app should be built in release mode. <br><br>Valid values are: `true`, `false` <br><br>**Make sure you set this value to true if you plan to submit this app Google Play or distribute it in any other way**.                                                                     | `false`                    | Yes      |
| `SEPARATE_APKS`                        | Build one APK per achitecture (armeabi-v7a, x86, arm64-v8a and x86_64) as well as a universal APK. The advantage is the size of the APK is reduced by about 4MB. <br><br>People will download the correct APK from the Play Store based on the CPU architecture of their device.                 | `false`                    | Yes      |
| `SUBMIT_ANDROID_TO_GOOGLE_PLAY`    | Should the app be submitted to the Play Store once it finishes building, use along with `SUPPLY_TRACK`.<br><br>Valid values are: `true`, `false`                                                                                                                                                 | `false`                    | Yes      |
| `SUPPLY_TRACK`                         | The track of the application to use when submitting the app to Google Play Store. Valid values are: `alpha`, `beta`, `production` <br><br>**RIt is not recommended to submit the app to production. First try any of the other tracks and then promote your app using the Google Play console**. | `alpha`                    | Yes      |
| `SUPPLY_PACKAGE_NAME`                  | The package Id of your application, make sure it matches `MAIN_APP_IDENTIFIER`.                                                                                                                                                                                                                  |                            | Yes      |
| `SUPPLY_JSON_KEY`                      | The path to the service account `json` file used to authenticate with Google.<br><br>See the {{< newtabref href=" https://docs.fastlane.tools/actions/supply/#setup" title="Supply documentation" >}} to learn more.                                                                                                           |                            | Yes      |

---
{{<note "Note:">}}
To configure your variables create the file `./mattermost-mobile/fastlane/.env` where `.env` is the filename. You can find the sample file `env_vars_example` {{< newtabref href="https://github.com/mattermost/mattermost-mobile/blob/master/fastlane/env_vars_example" title="here" >}}.
{{</note>}}


---

### 6. Google services

Replace the `google-services.json` file as instructed in the [Android Push Notification Guide]({{< ref "/contribute/more-info/mobile/push-notifications/android" >}}) before you build the app.

## Build the mobile app

Once all the previous steps are done, execute the following command from within the project's directory:

```sh
$ npm run build:android
```

This will start the build process following the environment variables you've set. Once it finishes, it will create the `.apk` file(s) with the `APP_NAME` as the filename in the project's root directory. If you have not set Fastlane to submit the app to the Play Store, you can use this file to manually publish and distribute the app.

## Frequently Asked Questions
### How do I update the lock file?
We use lockfiles to lock dependencies and make sure the builds are reproductible. If we want to update the lockfile to update all dependencies to the latest, we can run these commands:
```
cd android
./gradlew app:dependencies --update-locks "*:*"
```

In case we want to regenerate the lockfile from the scratch, we can delete the `android/buildscript-gradle.lockfile` and then run the following commands:
```
cd android
./gradlew app:dependencies --write-locks
```
