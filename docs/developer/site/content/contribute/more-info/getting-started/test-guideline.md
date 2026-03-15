---
title: "Test guidelines"
heading: "Test guidelines"
description: "Test guidelines"
date: 2022-03-30T00:00:00+08:00
weight: 6
aliases:
  - /contribute/more-info/getting-started/test-guideline
  - /contribute/more-info/webapp/e2e/interested-in-contributing
---

At Mattermost, we write tests because we want to be confident that our product works as expected for our users. As developers, we write tests as a gift to our future selves or to be confident that changes won't cause regressions or unintended behaviors. We value contributors who write tests as much as any others, and we want the process to be integrated in our core development workflow rather than being an afterthought or follow-up action.

This page stresses the importance of tests, including for every pull request being submitted. It is the foundation of our test guidelines, and serves as a reference on why we do not merge code without tests. This is not to meet higher code coverage but rather to write effective and well-planned use cases depending on the changes being made. But of course, there's always an exception. If, for some reason, it isn't possible to write a test, let the reviewers know by writing a description to start a discussion and to fully understand the situation you are facing.

Test categories
---------------
Not all test types are required in a single pull request. Only write whichever test types are most effective and appropriate.
1. __Unit tests__ - Unit tests verify that individual, isolated parts work as expected.
2. __Integration tests__ - Integration tests verify that several units work together in harmony.
3. __End-to-End (E2E) tests__ - End-to-End tests exercise most of the parts of a large application.

{{<note "Note:">}}
Wisdom and definitions mostly taken from {{<newtabref title="Martin Fowler's Software Testing Guide" href="https://martinfowler.com/testing/">}} and {{<newtabref title="Kent C. Dodds's personal site" href="https://kentcdodds.com/">}}.
{{</note>}}

In general, when are tests necessary?
-------------------------------------
- For all files written in the main language(s) of the repository; this could be JavaScript/Typescript and JSX/TSX files, Go files, or both which are exported such as functions, modules, or components used in various places. 
- Un-exported functions or methods, which have low or no test coverage from the parent exported function/method, that affect critical functionality or behavior of the application.
- New features and bug fixes, especially those originating from customer and community bugs.

When is it fine not to have tests?
--------------------------------------------
- For implementation details of standard libraries or external packages that are implicitly covered by the standard library or external package itself.
- Where the situation may require external services running to effectively test the functionality, such as dependencies on feature flags via {{<newtabref title="Split" href="https://split.io">}}, OAuth with third-party providers such as Google, etc.
- Tests should be made at the most effective and lowest possible level, but if it requires too much effort or complicated setup to accomplish at a unit test level, it would be best to skip and assess feasibility on the next level such as integration or end-to-end testing.
- Mocks and test helpers.
- Types only.
- Interfaces only or interfaces to other repositories, such as with private Enterprise via “interfaces”.
- End-to-end tests codebase.
- Automatically generated code for database migrations, store layers, etc.
- External dependencies, modules, imports, or vendors.

How to run and write tests
------------------
### Server
For writing and running **unit tests** in general, see the [Server workflow]({{<ref "/contribute/more-info/server/developer-workflow">}}) page. If you have written a new endpoint or changed an endpoint for the Mattermost REST API, check out the [REST API]({{<ref "/contribute/more-info/server/rest-api">}}) page.

### Web App
For writing and running **unit tests** in general, see the [Unit tests]({{<ref "contribute/more-info/webapp/unit-testing">}}) page. For writing and running **E2E tests** in general, see the [End-to-End testing]({{<relref "contribute/more-info/webapp/e2e-testing.md">}}) section, and the [End-to-End cheatsheets]({{<relref "contribute/more-info/webapp/e2e-cheatsheets.md">}}) section. 

For writing and running **E2E (and unit) tests for Redux** components, see the [Redux Unit and E2E Testing]({{<relref "contribute/more-info/webapp/redux/testing.md">}}) page.

### Mobile Apps
For writing and running **E2E tests** for both Android and iOS systems, take a look at the [Mobile End-to-End (E2E) Tests]({{<ref "/contribute/more-info/mobile/e2e">}}) page.

### Desktop App
For writing and running **unit and E2E tests** for the desktop app, check out the [Unit and End-to-End (E2E) Tests in the desktop app]({{<ref "/contribute/more-info/desktop/testing">}}) page.
    
# How to Contribute E2E Tests
If you're looking to improve your development skills or improve your familiarity with the Mattermost code base, issues for E2E tests that are marked Help Wanted are a great place to start.
    
* Look for {{<newtabref href="https://github.com/mattermost/mattermost/issues?q=is%3Aissue+is%3Aopen+e2e" title="issues in the mattermost">}} repository that have the `Help Wanted` label and either the `Area/E2E Tests` label or something related to E2E in the issue title.
  * Once you find an issue you would like to work on, comment on the issue to claim it.
* Each issue is filled with specific test steps and verifications that need to be accomplished as a minimum requirement.  Additional steps and assertions for robust test implementation are very welcome. The contents of an E2E issue follow this general format:
  * **Steps**: What the code in the test should do and/or emulate.
  * **Expected**: What the results of the test should be.
  * **Test Folder**: Where the file that holds the test code should be located.
  * **Test code arrangement**: Starter code for the test.
  * **Notes**: Comments on what to add and not to add to the test file, plus resources for contributions, asking questions, etc.
    
If you'd like to see an example of an ideal E2E test contribution, please view these issues and their associated PRs:
* [Write Webapp E2E with Cypress: "MM-T642 Attachment does not collapse"](https://github.com/mattermost/mattermost/issues/18184)
* [Cypress test: "CTRL/CMD+K - Open private channel using arrow keys and Enter"](https://github.com/mattermost/mattermost/issues/14078)

