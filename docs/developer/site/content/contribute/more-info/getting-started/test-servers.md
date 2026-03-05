---
title: "Test servers"
heading: "Pull request test servers"
description: "Leverage our cloud infrastructure we can spin up full environments on demand to test code submitted in a PR."
date: 2022-01-28T00:00:00-04:00
weight: 8
aliases:
  - /contribute/getting-started/test-servers
---

As part of the pull request review process, reviewers may need to test and verify proposed changes. Leveraging our Cloud infrastructure, we can spin up full environments on demand to test code submitted in PRs.

Core committers and staff can trigger test server creation on a PR by adding one of the following labels to the PR:

* `Setup Cloud Test Server`: Triggers the creation of a standard test server using the latest commit on the PR and a PostgreSQL database.
* `Setup HA Cloud Test Server`: Triggers the creation of a test server that has high availability.
* `Setup Cloud + CWS Test Server`: Triggers the creation of a test server that connects to our test Customer Web Server.

After adding these labels, a bot will comment on the PR notifying you that a test server is being created. It should take approximately 3-5 minutes for the server to create it. Once it's ready, the bot will comment on the PR again with a link and credentials to the test server for both an admin and a regular user.

If the bot comments that an error has occurred, try removing the label and then re-adding it again. If that still fails, please ask for help in {{< newtabref href="https://community.mattermost.com/core/channels/cloud" title="~Developers: Cloud" >}}. If you need urgent help, please mention `@sresupport` in your message.

Once testing is complete, remove the label and the test server will be destroyed.

Test servers are available on any repositories that have the labels.

# Tips and tricks

* Avoid adding and removing the labels quickly in succession - this can confuse the bot and result in issues. Please be patient. :)
* Pushing new commits to PRs will trigger the bot to automatically update the test server.
* When submitting a new PR or pushing an update to a PR, the docker build/push CI step must complete before a test server can be created/updated.
* Please make sure to remove labels when testing is complete since there is a limited capacity for test servers.
* If you want a test server to have the changes from two different PRs across the webapp and server repositories, ensure:
  * Both server and webapp branches are named the same and are on the main repos and not from forks.
  * The server build completes before the webapp build runs (you can re-trigger the webapp build if it didn't).
  * The test server was created after the webapp build is complete (that included the server build) and present on the PR for the web app.
