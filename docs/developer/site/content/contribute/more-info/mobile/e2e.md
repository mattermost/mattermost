---
title: "Mobile End-to-End (E2E) Tests"
heading: "Mobile End-to-End (E2E) tests at Mattermost"
description: "This page describes how to write and run End-to-End (E2E) testing for Mobile Apps for both iOS and Android."
date: 2020-09-01T09:00:00-00:00
weight: 5
aliases:
  - /contribute/mobile/e2e
  - /contribute/more-info/mobile/e2e/android/
  - /contribute/more-info/mobile/e2e/ios/
  - /contribute/more-info/mobile/e2e/guide-for-writing/
  - /contribute/more-info/mobile/e2e/environment-vars/
  - /contribute/more-info/mobile/e2e/file-structure/
---

This page describes how to write and run End-to-End (E2E) testing for Mobile Apps for both iOS and Android. Mobile products use {{< newtabref href="https://github.com/wix/Detox" title="Detox" >}}, which is a "gray box end-to-end testing and automation library for mobile apps." See its {{< newtabref href="https://github.com/wix/Detox/tree/master/docs" title="documentation" >}} to learn more.

### File Structure

The folder structure is as follows:
```
|-- detox
  |-- e2e
    |-- support
    |-- test
    |-- config.json
    |-- environment.js
    |-- init.js
  |-- .babelrc
  |-- .detoxrc.json
  |-- package-lock.json
  |-- package.json
```

* `/detox/e2e/support` is the support folder, which is a place to put reusable behavior such as Server API and UI commands, or global overrides that should be available to all test files.
* `/detox/e2e/test`: To start writing tests, create a new file (e.g. `login.e2e.js`) in the `/detox/e2e/test` folder.
    - The subfolder naming convention depends on the test grouping, which is usually based on the general functional area (e.g. `/detox/e2e/test/messaging/` for "Messaging").
    - Test cases that require an Enterprise license should fall under `/detox/e2e/test/enterprise/`. This is to easily identify license requirements, both during local development and production testing for Enterprise features.
* `/detox/.detoxrc.json`: for Detox configuration.
* `/detox/package.json` : for all dependencies related to Detox end-to-end testing.

### Writing an E2E Test
This process has many similarities to [writing an E2E test for the mattermost-webapp project]({{<relref "contribute/more-info/webapp/e2e-testing.md">}}).
Before writing a script, ensure that it has a corresponding test case in Zephyr. All test cases may be found in this {{< newtabref href="https://mattermost.atlassian.net/projects/MM?selectedItem=com.atlassian.plugins.atlassian-connect-plugin%3Acom.kanoah.test-manager__main-project-page#!/design?projectId=10302" title="link" >}}. If test case is not available, feel free to prompt the QA team who will either search from an existing Zephyr entry or if it's a new one, it will be created for you.

1. Create a test file based on the file structure aforementioned above.
2. Include Zephyr identification (ID) and title in the test description, following the format of `it('[Zephyr_id] [title]')` or `it('[Zephyr_id]_[step] [title]')` if the test case has multiple steps. For test case "{{< newtabref href="https://mattermost.atlassian.net/projects/MM?selectedItem=com.atlassian.plugins.atlassian-connect-plugin%3Acom.kanoah.test-manager__main-project-page#!/testCase/MM-T109" title="MM-T109 RN apps: User can't send the same message repeatedly" >}}", it should be:
    ```javascript
    describe('Messaging', () => {
        it('MM-T109 User can\'t send the same message repeatedly', () => {
            // Test steps and assertion here
        }
    }
    ```
4. Target an element using available matchers. For best results, it is recommended to match elements by unique identifiers using `testID`. The identifier should follow the following format to avoid duplication, `<location>.<modifier>.<element>.<identifier>`, where:
  {{<note "NOTE:">}}
  Not all fields are required. When assigning a `testID`, carefully inspect the actual render structure and pick up the minimum fields combination to create a unique value. Some examples include: `send.button` and `post.<post-id>`. 
  {{</note>}}

    * `location` - can be a parent component, a main section, or a UI screen.
    * `modifier` - adds meaning to the `element`.
    * `element` - common terms like `button`, `text_input`, `image`, and the like.
    * `identifier` - could be unique ID of a post, channel, team or user, or a number to represent order.
  
5. Prefix each comment line with appropriate indicator. Each line in a multi-line comment should be prefixed accordingly. Separate and group test step comments and assertion comments for better readability.
    - `#` indicates a test step (e.g. `// # Go to a screen`)
    - `*` indicates an assertion (e.g. `// * Check the title`)
6. Simulate user interaction using available actions, and verify user interface (UI) expectations using `expect`. When using `action`, `match`, or another API specific to a particular platform, verify that the equivalent logic is applied so that the API does not impact other platforms. Always run tests in applicable platforms.

### Running E2E Tests
#### Testing Android Locally
##### Local setup

1. Install the latest Android SDK:

   ```
   sdkmanager "system-images;android-30;google_apis;x86"
   sdkmanager --licenses
   ```
2. Create the emulator using `npm run e2e:android-create-emulator` from the `/detox` folder. Android testing requires an emulator named `detox_pixel_4_xl_api_30` and the script helps to create it automatically.

##### Complete a test run in debug mode
This is the typical flow for local development and test writing:

1. Open a terminal window and run react-native packager by `npm install && npm start` from the root folder.
2. Open a second terminal window and:
    * Change directory to `/detox` folder.
    * Install npm packages by `npm install`.
    * Build the app together with the android test using `npm run e2e:android-build`.
    * Run the test using `npm run e2e:android-test`.
    * For running a single test, follow this example command: `npm run e2e:android-test -- connect_to_server.e2e.ts`. 

##### Complete a test run in release mode
This is the typical flow for CI test run:

1. Build a release app by running `npm install && npm run e2e:android-build-release` from the `/detox` folder.
2. Run a test using `npm run e2e:android-test-release` from the `/detox` folder.

#### Testing iOS Locally
##### Local setup

1. Install {{< newtabref href="https://github.com/wix/AppleSimulatorUtils" title="applesimutils" >}}:
   ```
   brew tap wix/brew
   brew install applesimutils
   ```
2. Set XCode's build location so that the built app, especially debug, is expected at the project's location instead of the Library's folder which is unique/hashed.
3. Open XCode, then go to **XCode > Settings > Locations**.
4. Under **Derived Data**, click **Advanced...**.
5. Select **Custom > Relative to Workspace**, then set **Products** as **Build/Products**.
6. Click **Done** to save the changes.

##### Complete a test run in debug mode

1. In one terminal window, from the root folder run `npm run start` and on another `npm run ios` from the root folder.
2. Once the build is complete and installed, there will be a message informing of the path where the app is installed. Copy that path.  Sample output:
   ```log
   info Building (using "xcodebuild -workspace Mattermost.xcworkspace -configuration Debug -scheme Mattermost -destination id=00008110-00040CA10263801E")
   info Installing "/Users/myuser/Proyectos/mattermost-mobile/ios/Build/Products/Debug-iphonesimulator/Mattermost.app
   info Launching "com.mattermost.rnbeta"
   success Successfully launched the app
   ```
3. Edit `/detox/.detoxrc` and 
   - In **apps > ios.debug**, substitute `binaryPath` by that value. 
   - In **devices > ios.simulator > device**, substitute `type` and `os` with the values corresponding to the ones being used by the simulator. If unsure wich ones, either open the simulator or go to Xcode to see where it is being built.
4. Export the values for `ADMIN_USERNAME` and `ADMIN_PASSWORD` with the appropiate values for your test server. Check the Environment Variables section below to learn more about default values and other variables available.
   ```sh
   export SITE_1_URL="http://localhost:8065"
   export ADMIN_USERNAME="sysadmin"
   export ADMIN_PASSWORD="Sys@dmin-sample1"
   ```
5. In another terminal window, run `npm i` then `npm run e2e:ios-test` from the `/detox` folder.
    * For running a single test, follow this example command: `npm run e2e:ios-test -- connect_to_server.e2e.ts`.
    ```sh
    cd detox
    npm i
    npm run e2e:ios-test
    ```

##### Complete a test run in release mode

1. Build the release app by running `npm run build:ios-sim` from the root folder or `npm run e2e:ios-build-release` from within the `/detox` folder.
2. Run the test using `npm run e2e:ios-test-release` from the `/detox` folder.

#### Environment variables
Test configurations are {{< newtabref href="https://github.com/mattermost/mattermost-mobile/blob/master/detox/e2e/support/test_config.js" title="defined at test_config.js" >}} and environment variables are used to override default values. In most cases you don't need to change the values, because it makes use of the default local developer setup. If you do need to make changes, you may override by exporting, e.g. `export SITE_URL=<site_url>`.

| Variable       | Description                                                                                                         |
|----------------|---------------------------------------------------------------------------------------------------------------------|
| SITE_URL       | Host of test server.<br><br>*Default*: `http://localhost:8065` for iOS or `http://10.0.2.2:8065` for Android.         |
| ADMIN_USERNAME | Admin's username for the test server.<br><br>*Default*: `sysadmin` when server is seeded by `make test-data`.         |
| ADMIN_PASSWORD | Admin's password for the test server.<br><br>*Default*: `Sys@dmin-sample1` when server is seeded by `make test-data`. |
| LDAP_SERVER    | Host of LDAP server.<br><br>*Default*: `localhost`                                                                    |
| LDAP_PORT      | Port of LDAP server.<br><br>*Default*: `389`                                                                          |
