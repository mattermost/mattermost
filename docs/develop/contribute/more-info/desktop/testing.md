---
title: "Unit and End-to-End (E2E) Tests"
sidebar_position: 4
---

For most changes that happen to the desktop app, consider writing an automated test to ensure that the change or fix is maintained in the codebase. Depending on the nature of the change, you will write either a unit test or an E2E test.

### Unit tests
The [Jest](https://jestjs.io/en/) test runner is used to run unit tests in the desktop app. You can run the following command to run the tests: `npm run test:unit`. You can also run subsets of the tests by filtering using `testNamePattern` or `testPathPattern` on the `spec` files.

Unit tests are usually written for parts of the `common` and `main` modules, and usually cover individual functions or classes.
We should endeavor to write our code such that it allows for simple testing, and any new features or bug fixes should likely have an associated unit test if possible. Check out [\[MM-40146\]\[MM-40147\] Unit tests for authManager and certificateManager #1874](https://github.com/mattermost/desktop/pull/1874), which is an example of a unit test pull request (PR).

In order to ensure that most of the app is covered, we try to maintain 70% coverage of the `common` and `main` modules.
You can view a coverage map by running this command: `npm run test:coverage`. 

### E2E tests
We use a combination of two technologies to facilitate E2E testing in the desktop app:
- **[Playwright](https://playwright.dev/):** A testing framework similar to Cypress or Selenium that acts as a Chromium driver for testing. It's used to simulate interactions with the various web environments that make up the Desktop App, including the top bar (servers and tabs) and the individual Mattermost views.
- **[RobotJS](https://robotjs.io/):** A multi-platform OS level automation framework written in NodeJS, used for simulating arbitrary keyboard and mouse inputs. It's generally used to mock actions involving keyboard shortcuts and the Electron menu, as those are not web environments.

To build the app and run the E2E tests, you can run the following command: `npm run test:e2e`. You can also run this command to build the tests without rebuilding the app: `npm run test:e2e:nobuild`. You can also run subsets of the tests by filtering using `grep`, for example: `npm run test:e2e:run -- --grep back_button`. 

E2E tests are usually written to cover parts of the `renderer` module and should generally cover complete workflows, such as creating and editing a server. You will generally need a combination of both Playwright and RobotJS APIs to test most workflows.

An example of an E2E test PR is [ \[MM-39680\] E2E Test for Deep Linking #1843](https://github.com/mattermost/desktop/pull/1843).

#### Notes

There are many interactions (i.e. things that integrate with the operating system), such as notifications, that cannot be adequately tested using the automation frameworks we have. If this is the case, we will generally create a script to test in [Rainforest](https://handbook.mattermost.com/operations/research-and-development/quality/rainforest-process), our crowd-sourced QA platform to perform these tests manually.

Check out the page on [web app unit testing](/developers/contribute/more-info/webapp/unit-testing) to see more of Jest in action. For other CLI commands related to testing, go to [Build and CLI commands](/developers/contribute/more-info/desktop/build-commands).

