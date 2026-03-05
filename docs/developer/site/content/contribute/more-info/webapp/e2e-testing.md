---
title: "End-to-End (E2E) tests"
heading: "End-to-End (E2E) tests for the Mattermost Web app"
description: "This page describes how to run End-to-End (E2E) testing and to build tests for a section or page of the Mattermost web application."
date: "2018-03-19T12:01:23-04:00"
weight: 6
aliases:
  - contribute/webapp/e2e-testing
  - contribute/webapp/e2e
  - contribute/more-info/webapp/e2e/folder-and-file-structure
  - contribute/more-info/webapp/e2e/guide-for-writing
  - contribute/more-info/webapp/e2e/running-e2e
  - contribute/more-info/webapp/e2e/troubleshooting
---

End-to-end tests for the Mattermost web app in general use {{<newtabref href="https://www.cypress.io/" title="Cypress">}} and {{<newtabref href="https://playwright.dev/" title="Playwright">}}. If you're not familiar with Cypress, check out the Cypress {{<newtabref href="https://docs.cypress.io/guides/overview/why-cypress.html#In-a-nutshell" title="Developer Guide">}} and {{<newtabref href="https://docs.cypress.io/api/api/table-of-contents.html" title="API Reference">}}. Feel free to also join us on the Mattermost Community server if you'd like to ask questions and collaborate with us!
{{<note "NOTE:">}}
Playwright is a new framework getting added to the Mattermost web app for test automation (and is currently being used for visual tests). Documentation about Playwright in the web app is in development, so all other content about E2E testing will be related to Cypress.

If you're looking for information related to E2E tests and Redux, please check out [Redux Unit and E2E Testing]({{<relref "/contribute/more-info/webapp/redux/testing.md">}}).
{{</note>}}

### What requires an E2E test?

* Test cases that are defined in {{<newtabref href="https://github.com/mattermost/mattermost/issues?q=label%3A%22Area%2FE2E+Tests%22+label%3A%22Help+Wanted%22+is%3Aopen+is%3Aissue+" title="help-wanted E2E issues">}}.
* New features and stories - For example, check out {{<newtabref href="https://github.com/mattermost/mattermost-webapp/pull/4243" title="MM-19922 Add E2E tests for Mark as Unread #4243">}} which contains E2E tests for the `Mark As Unread` feature. 
* Bug fixes - For example, see {{<newtabref href="https://github.com/mattermost/mattermost-webapp/pull/5908" title="MM-26751: Fix highlighting of at-mentions of self #5908">}}, which fixes a highlighting issue and adds a related test.
* Test cases from {{<newtabref href="https://support.smartbear.com/zephyr-scale-cloud/docs/" title="Zephyr">}} - For example, see {{<newtabref href="https://github.com/mattermost/mattermost-webapp/pull/5850" title="Added Cypress tests MM-T1410, MM-T1415 and MM-T1419 #5850">}} which adds automated tests for `Guest Accounts`. 
    
### File Structure for E2E Testing
E2E tests are located at the root of the repository in {{<newtabref href="https://github.com/mattermost/mattermost/tree/master/e2e-tests" title="the `e2e-tests` folder">}}. The file structure is mostly based on the {{<newtabref href="https://docs.cypress.io/guides/core-concepts/writing-and-organizing-tests#Folder-Structure" title="Cypress scaffold">}}. Here is an overview of some important folders and files:

```
|-- e2e-tests
  |-- cypress
    |-- tests
      |-- fixtures
      |-- integration
      |-- plugins
      |-- support
      |-- utils
    |-- cypress.config.ts
    |-- package.json
```

* `/e2e-tests/cypress/tests/fixtures` or {{<newtabref href="https://docs.cypress.io/guides/core-concepts/writing-and-organizing-tests.html#Fixture-Files" title="Fixture Files">}}:
    - Fixtures are used as external pieces of static data that can be used by tests.
    - Typically used with the `cy.fixture()` command and most often when stubbing network requests.
* `/e2e-tests/cypress/tests/integration` or {{<newtabref href="https://docs.cypress.io/guides/core-concepts/writing-and-organizing-tests.html#Test-files" title="Test Files">}}:
    - Subfolder naming convention depends on test grouping, which is usually based on the general functional area (e.g. `/e2e/cypress/tests/integration/messaging/` for "Messaging").
* `/e2e-tests/cypress/tests/plugins` or {{<newtabref href="https://docs.cypress.io/guides/core-concepts/writing-and-organizing-tests.html#Plugins-file" title="Plugin Files">}}:
    - A convenience mechanism that automatically includes plugins before running every single `spec` file.
* `/e2e-tests/cypress/tests/support` or {{<newtabref href="https://docs.cypress.io/guides/core-concepts/writing-and-organizing-tests.html#Support-file" title="Support Files">}}:
    - A support file is a place for reusable behaviour such as custom commands or global overrides that are available and can be applied to all `spec` files.
* `/e2e-tests/cypress/tests/utils`: this folder contains common utility functions.
* `/e2e-tests/cypress/cypress.config.ts`: this file is for Cypress {{<newtabref href="https://docs.cypress.io/guides/references/configuration.html#Options" title="configuration">}}.
* `/e2e-tests/cypress/package.json`: this file is for all the dependencies related to Cypress end-to-end testing.

### Writing End-to-End Tests

#### Where should a new test go?
You will need to either add the new test to an existing `spec` file, or create a new file. Sometimes, you will be informed (for example through issue descriptions) of the specific folder the test file should go in, or the actual test file being amended. As aforementioned, the `e2e-tests/cypress/tests/integration` folder is where all of the tests live, with subdirectories that roughly divide the tests by functional areas. Cypress is configured to look for and run tests that match the pattern of `*_spec.ts`, so a good new test file name for an issue like {{<newtabref href="https://github.com/mattermost/mattermost/issues/18184" title=`Write Web App E2E with Cypress: "MM-T642 Attachment does not collapse" #18184`>}} would be `attachment_does_not_collapse_spec.ts`, to ensure that it gets picked up.
> *Note*: There may be some JavaScript `spec` files, but new tests should be written in TypeScript. If you are adding a test to an existing `spec` file, convert that file to TypeScript if necessary.

If you don't know where a test should go, first check the names of the subdirectories, and select a folder that describes the functional area of the test best. From there, look to see if there is already a `spec` file that may be similar to what you are testing; if there is one, it would be possible to add the test to the pre-existing file.

#### Test metadata on spec files
Test metadata is used to identify each `spec` file before it is forwarded for a Cypress run, and the metadata is located at the start of a `spec` file. Currently, supported test metadata fields include the following:

* **Stage** - Indicates the environment for testing; valid values for this include `@prod`, `@smoke`, `@pull_request`. "Stage" metadata in `spec` files are owned and controlled by the Quality Assurance (QA) team who carefully analyze the stability of tests and promote/demote them into certain stages. This is not required when submitting a `spec` file and it should be removed when modifying an existing `spec` file.

* **Group** - Indicates test group or category, which is primarily based on functional areas and existing release testing groups. Valid values for this include: `@settings` for Settings, `@playbooks` for Playbooks, etc. This is required when submitting a `spec` file. 

* **Skip** - This is a way to skip running a `spec` file depending on the capabilities of the test environment. This is required when submitting a `spec` file if there is a test that has certain limitations or requirements. Forms of capabilities include:
  - **Platform-related**: valid values include - `@darwin` for Mac, `@linux` for Linux flavors like Ubuntu, `@win32` for Windows, etc.
  - **Browser-related**: valid values include - `@electron`, `@chrome`, `@firefox`, `@edge`, etc.
  - **User interface-related**: valid values include `@headless` or `@headed`.

A `spec` file can have zero or more metadata values separated by spaces (for example, `// Stage: @prod @smoke`). A more full example of what metadata would look like at the start of a `spec` file (for example, `attachment_does_not_collapse_spec.ts`) would be:

```
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @incoming_webhook
```

The metadata is part of a comment block that also includes information on copyright and license, and a section to explain how to tag comments in your code appropriately.

#### Setting up test code

Underneath the comment header, we can add the starter code as defined from the "Test code arrangement" part of the issue. Each test (no matter the situation you're writing a test for) should have a corresponding test case in Zephyr. Therefore, the `describe` block encompassing the test code should correspond to folder name in Zephyr (e.g. "Incoming webhook"), and the `it` block should contain `Zephyr test case number` as `Test Key`, and then the test title. For {{<newtabref href="https://github.com/mattermost/mattermost/issues/18184" title=`Write Web App E2E with Cypress: "MM-T642 Attachment does not collapse" #18184`>}}, in the spec file made for it (`attachment_does_not_collapse_spec.ts`), the starter code would be:
  ```javascript
  describe('Integrations/Incoming Webhook', () => {
    it('MM-T642 Attachment does not collapse', () => {
      // Put test steps and assertions here
    });
  });
  ```
For those writing E2E from Help Wanted tickets with `Area/E2E Tests` label, the `Test Key` is available in the Github issue itself. The `Test Key` is used for mapping test cases per Release Testing specification. It will be used to measure coverage between manual and automated tests. In case the `Test Key` is not available, feel free to prompt the QA team who will either search for an existing Zephyr entry or if it's a new one, it will be created for you.

#### Using Cypress Hooks

Before writing the main body of the test in the `it` block, it can help to write some setup code for test isolation using {{<newtabref href="https://docs.cypress.io/guides/core-concepts/writing-and-organizing-tests#Hooks" title="hooks">}}. In a `before()` hook, you can run tests in isolation using the custom command `cy.apiInitSetup()`. This command creates a new team, channel, and user which can only be used by the spec file itself. Make use of the `cy.apiInitSetup()` function as much as possible, as it is recommended to log in as a new user and visit the generated team and/or channel. Avoid the use of `sysadmin` user or default `ad-1` team if possible.

For `attachment_does_not_collapse_spec.ts` for example:
  ```javascript
  let incomingWebhook;
  let testChannel;

  before(() => {
    // # Create and visit new channel and create incoming webhook
    cy.apiInitSetup().then(({team, channel}) => {
      testChannel = channel;

      const newIncomingHook = {
        channel_id: channel.id,
        channel_locked: true,
        description: 'Incoming webhook - attachment does not collapse',
        display_name: 'attachment-does-not-collapse',
      };

      cy.apiCreateWebhook(newIncomingHook).then((hook) => {
        incomingWebhook = hook;
      });

      cy.visit(`/${team.name}/channels/${channel.name}`);
      });
  });
  ```
The `before()` hook is also a good place to add checks if a test requires a certain kind of server license. If test(s) require a certain licensed feature, use the function `cy.apiRequireLicenseForFeature('<feature name>')`. To check if the server has a license in general, use `cy.apiRequireLicense()`. You can also add hard requirements in the `before()` hook, such as: `cy.shouldNotRunOnCloudEdition()`, `cy.shouldRunOnTeamEdition()`, `cy.shouldHavePluginUploadEnabled()`, `cy.shouldHaveElasticsearchDisabled()`, and `cy.requireWebhookServer()`. For more information on custom commands and how to select elements, check out the [End-to-End (E2E) cheatsheets]({{<relref "contribute/more-info/webapp/e2e-cheatsheets.md">}}).

Putting what you've gone through so far all together, you should have code that looks similar to this template:

```javascript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// **********************************************************************
// - Use [#] in comment to indicate a test step (e.g. # Go to a page)
// - Use [*] in comment to indicate an assertion (e.g. * Check the title)
// - Query an element with @testing-library/cypress as much as possible
// **********************************************************************

// Group: @change_group

describe('Change to Functional Group', () => {
    before(() => {
        // Add hard requirement(s) to immediately fail and throw a descriptive error if not met
        // cy.shouldNotRunOnCloudEdition();

        // Add license requirement(s)
        // cy.apiRequireLicense();

        // Init basic setup for test isolation
        cy.apiInitSetup({loginAfter: true}).then(({team, channel, user}) => {
            // Assign return values to variable/s
            // # Visit a channel
            // Do other setup per test data preconditions
        });
    });

    // Add a title of "[Zephyr_id] - [Zephyr title]" for test case with single step,
    // or "[Zephyr_id]_[step_number] - [Zephyr title]" for test case with multiple steps
    it('[Zephyr_id] - [Zephyr title]', () => {
        // Put test steps and assertions here
    });
});
```

#### Main body of the test

{{<note "NOTE:">}}
Use `camelCase` when assigning to `data-testid` or element ID. Also, watch out for potential breaking changes in the snapshot from [unit testing]({{<ref "/contribute/more-info/webapp/unit-testing">}}).  Run `make test` to see if all unit tests are passing, and run `npm run updatesnapshot` or `npm run test -- -u` if necessary to update snapshot tests.
{{</note>}}

Now, inside the body of the `it` block , we will write in code the "Steps" part of the E2E issue. The following steps and code are from {{<newtabref href="https://github.com/mattermost/mattermost/issues/18184" title=`Write Web App E2E with Cypress: "MM-T642 Attachment does not collapse" #18184`>}}. Check out the complete file at: {{<newtabref href="https://github.com/mattermost/mattermost-webapp/pull/11231/files" title="`attachment_does_not_collapse_spec.ts`">}}.

  * **Create an incoming webhook and send it through POST with attachment**:
    ```javascript
    // # Post the incoming webhook with a text attachment
    const content = '[very long lorem ipsum test text]';
    const payload = {
      channel: testChannel.name,
      attachments: [{fallback: 'testing attachment does not collapse', pretext: 'testing attachment does not collapse', text: content}],
    };
    cy.postIncomingWebhook({url: incomingWebhook.url, data: payload, waitFor: 'attachment-pretext'});
    ```
  * **View the webhook post that has the attachment**: you are already in the channel that has the attachment post, as specified by the line `cy.visit('/${team.name}/channels/${channel.name}')`; from the setup section of the code.

  * **Type /collapse and press Enter**: 
    ```javascript
    // * Check "show more" button is visible and click
    cy.getLastPostId().then((postId) => {
      const postMessageId = `#${postId}_message`;
      cy.get(postMessageId).within(() => {
        cy.get('#showMoreButton').scrollIntoView().should('be.visible').and('have.text', 'Show more').click();
      });
    });
    // # Type /collapse and press Enter
    const collapseCommand = 'collapse';
    cy.uiGetPostTextBox().type(`/${collapseCommand} {enter}`);
    ```

  * **Observe the integration post with the Message Attachment**: where you ascertain what is expected of the test.
    ```javascript
    cy.getNthPostId(-2).then((postId) => {
    const postMessageId = `#${postId}_message`;
    cy.get(postMessageId).within(() => {
      // * Verify "show more" button says "Show less"
      cy.get('#showMoreButton').scrollIntoView().should('be.visible').and('have.text', 'Show less');
      // * Verify gradient
      cy.get('#collapseGradient').should('not.be.visible');
    });
    ```

### Running E2E Tests
#### On your local development machine / Gitpod

1. If the server is not running, launch it by running `make run` in the `server` directory. Then, confirm that the Mattermost instance has started successfully. You can also run `make test-data` in the `server` directory to preload your server instance with initial seed data (you may need to restart the server again).
    - Each test case should handle the required system or user settings, but if you encounter an unexpected error while testing, you may want to reset the configuration of the server to the default by going to the `server` directory and running `make config-reset`.
2. Change the directory to `e2e-tests/cypress`, and install dependencies by running `npm i`.
3. You can then run tests in a variety of different ways by using the following commands in the `e2e-tests/cypress` directory:

    - **Running all E2E tests**: `npm run cypress:run`. This does not include the `spec` files in the `/e2e-tests/cypress/tests/integration/enterprise` folder because they need an Enterprise license to run successfully.
    - **Running tests selectively based on `spec` metadata**: For example, if you want to run all the tests in a specific group, such as those in "accessibility", the command would be: `node run_tests.js --group='@accessibility'`.
    - **Using the Cypress desktop app**: `npm run cypress:open`. This will start up the Cypress desktop app, where you will be able to do partial testing depending on the `spec` selected in the app. If you are using Gitpod, the Cypress app will open up in the VNC desktop, which is accessible at port `6080`.
4. Don't forget to check your coding styles! See the [Web app workflow]({{<ref "/contribute/more-info/webapp/developer-workflow">}}) page for helpful commands to run.

#### In a Continuous Integration (CI) pipeline

All tests are run by Mattermost in a CI pipeline, and they are grouped according to test stability.

1. __Daily production tests against development branch (master)__: Initiated on the master branch by using the command `node run_tests.js --stage='@prod'`. These production tests are selected and also labeled with `@prod` in the test metadata. See <a target="_blank" href="https://community.mattermost.com/core/pl/g6wx1d84ibdf7r5frjap4rb55a">link</a> for an example test run posted in our community channel.
2. __Daily production tests against release branch__: Same as above except the test is initiated against the release branch. See <a target="_blank" href="https://community.mattermost.com/core/pl/8r4f17fkutbxxcwumk5mzwpp5c">link</a> for an example test run.
3. __Daily unstable tests against development branch (master)__: Initiated on the master branch by using the command `node run_tests.js --stage='@prod' --invert` to run all tests except production tests. These are called "unstable tests" as they either consistently or intermittently fail due to automation bugs, and not because of product bugs.

#### Environment variables

Several environment variables (env variables) are used when testing with Cypress in order to easily change things when running tests in CI and to cater to different values across developer machines. 

Environment variables are {{< newtabref href="https://github.com/mattermost/mattermost/blob/master/e2e-tests/cypress/cypress.config.ts" title="defined in cypress.config.ts" >}} under the `env` key. In most cases you don't need to change the values, because it makes use of the default local developer setup. If you do need to make changes, the easiest method is to override by exporting `CYPRESS_*`, where `*` is the key of the variable, for example: `CYPRESS_adminUsername`. See the {{<newtabref href="https://docs.cypress.io/guides/guides/environment-variables.html#Setting" title="Cypress documentation on environment variables">}} for details.

| Variable                  | Description                                                                                                                                                                                                                     |
|---------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| CYPRESS\_adminUsername    | Admin's username for the test server.<br><br>*Default*: `sysadmin` when server is seeded by `make test-data`.                                                                                                                     |
| CYPRESS\_adminPassword    | Admin's password for the test server.<br><br>*Default*: `Sys@dmin-sample1` when server is seeded by `make test-data`.                                                                                                             |
| CYPRESS\_dbClient         | The database of the test server. It should match the server config `SqlSettings.DriverName`.<br><br>*Default*: `postgres` <br>*Valid values*: `postgres` or `mysql`                                                                 |
| CYPRESS\_dbConnection     | The database connection string of the test server. It should match the server config `SqlSettings.DataSource`.<br><br> *Default*: `"postgres://mmuser:mostest@localhost/mattermost_test?sslmode=disable\u0026connect_timeout=10"` |
| CYPRESS\_enableVisualTest | Use for visual regression testing.<br><br>*Default*: `false`<br>*Valid values*: `true` or `false`                                                                                                                                   |
| CYPRESS\_ldapServer       | Host of the Lightweight Directory Access Protocol (LDAP) server.<br><br>*Default*: `localhost`                                                                                                                                                                                |
| CYPRESS\_ldapPort         | Port of the LDAP server.<br><br>*Default*: `389`                                                                                                                                                                                      |
| CYPRESS\_runLDAPSync      | Option to run LDAP sync.<br><br>*Default*: `true`<br>*Valid values*: `true` or `false`                                                                                                                                              |
| CYPRESS\_resetBeforeTest  | When set to `true`, it deletes all teams and their channels where `sysadmin` is a member except `eligendi` team and its channels.<br><br>*Default*: `false`<br>*Valid values*: `true` or `false`                                    |
| CYPRESS\_webhookBaseUrl   | A server used for testing webhook integrations.<br><br>*Default*: `http://localhost:3000` when initiated with the command `npm run start:webhook` in the `e2e-tests/cypress` directory.                                                                                                   |

### Submitting your pull request (PR)

Review the [Test Guidelines]({{<ref "/contribute/more-info/getting-started/test-guideline">}}) for details on how to submit your PR

### Troubleshooting
#### Test(s) failing due to a known issue
If test(s) are failing due to another known issue, follow these steps to amend your test:
1. Append the Jira issue key in the test title, following the format of ` -- KNOWN ISSUE: [Jira_key]`. For example:
    ```javascript
    describe('Upload Files', () => {
      it('MM-T2261 Upload SVG and post -- KNOWN ISSUE: MM-38982', () => {
        // Test steps and assertion here
      });
    });
    ```
2. Move the test case into a separate `spec` file following the format of `<existing_spec_file_name_[1-9].js>`. For example:
     `accessibility_account_settings_spec_1.js` and demote the spec file (i.e. remove `// Stage: @prod` from the spec file)
3. If all the test cases are failing in a spec file, update each title as mentioned above and demote the spec file.
4. Link the failed test case(s) to the Jira issue (the known issue). In the Jira bug, select the **Zephyr Scale** tab. Select the **add an existing one** link, then select test case(s), and finally select **Add**.
5. Conversely, remove the Jira issue key if the issue has been resolved and the test is passing.

#### Cypress failed to start after running `npm run cypress:run`
In this problem, either the command line exits immediately without running any test or it logs out like the following with the error message:
```sh
✖  Verifying Cypress can run /Users/user/Library/Caches/Cypress/3.1.3/Cypress.app
   → Cypress Version: 3.1.3
Cypress failed to start.

This is usually caused by a missing library or dependency.
```
The solution to this problem is to clear node options by initiating `unset NODE_OPTIONS` in the command line. Running `npm run cypress:run` should then proceed with Cypress testing.

#### Running any Cypress spec gives `ENOSPC`

This error may occur in Ubuntu when running any Cypress spec:

```
code: 'ENOSPC',
errno: 'ENOSPC',
```
The solution to this problem is to run the following command: `echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf && sudo sysctl -p`. 


