---
title: "Web app workflow"
heading: "Web app workflow"
description: "See what a general workflow for a developer working on the Mattermost web app looks like."
date: 2017-08-20T11:35:32-04:00
weight: 3
aliases:
  - /contribute/webapp/developer-workflow
---

This page contains most of the information required for a developer to work with the Mattermost web app. Note that everything in this document will refer to working in the `webapp` directory of {{< newtabref href="https://github.com/mattermost/mattermost" title="the main Mattermost repository" >}} unless otherwise stated.

### Workflow

1. If you haven't done so already, [set up your developer environment]({{< ref "/contribute/developer-setup" >}}).

2. On your fork, create a feature branch for your changes. Name it `MM-$NUMBER_$DESCRIPTION` where `$NUMBER` is the {{< newtabref href="https://mattermost.atlassian.net" title="Jira" >}} ticket number you are working on and `$DESCRIPTION` is a short description of your changes. Example branch names are `MM-18150_plugin-panic-log` and `MM-22037_uppercase-email`. You can also use the name `GH-$NUMBER_$DESCRIPTION` for tickets come from {{< newtabref href="https://github.com/mattermost/mattermost/issues" title="GitHub Issues" >}}.

3. Make the code changes required to complete your ticket, making sure to write or modify unit tests where appropriate. Use `make test` to run the unit tests.

4. To run your changes locally, you'll need to run both the client and server. The server and client can either be run together or separately as follows:
    * You can run both together by using `make run` from the server directory. Both server and web app will be run together and can be stopped by using `make stop`. If you run into problems getting the server running this way, you may want to consider running them separately in case the output from one is hiding errors from the other.

    * You can run the server independently by running `make run-server` from its directory and, using another terminal, you can run the web app by running `make run` from the web app directory. Each can be stopped by running `make stop-server` or `make stop` from their respective directories.

    Once you've done either of those, your server will be available at `http://localhost:8065` by default. Changes to the web app will be built automatically, but changes to the server will only be applied if you restart the server by running `make restart-server` from the server directory.

5. If you added or changed any translatable text, you will need to update the English translation files to make them available to translators for other languages. You can do that by navigating to `channels` and running `make i18n-extract` to update `src/i18n/en.json`.
    * Remember to double check that any newly added strings have the correct values in case they weren't detected correctly.
    * Generally, only `en.json` should be modified directly from this repository. Other languages' translation files are updated using {{< newtabref href="https://translate.mattermost.com" title="Weblate" >}}.

6. Before submitting a PR, make sure to check your coding style and run the automated tests on your changes. These are checked automatically by CI, but they should be run manually before submitting changes to ensure the review process goes smoothly.
    * To check the code style and run the linter, run `make check-style`. If any problems are encountered, they may be able to be automatically fixed by using `make fix-style`.
    * To run the type checker, use `make check-types`.
    * To run the unit tests, run `make test`.

7. Commit your changes, push your branch and {{< newtabref href="https://developers.mattermost.com/blog/submitting-great-prs/" title="create a pull request" >}}.

8. Respond to feedback on your pull request and make changes as necessary by committing to your branch and pushing it. Your branch should be kept roughly up to date by {{< newtabref href="https://git-scm.com/book/en/v2/Git-Branching-Basic-Branching-and-Merging#_basic_merging" title="merging" >}} master into it periodically. This can either be done using {{< newtabref href="https://git-scm.com/docs/git-merge" title="`git merge`" >}} or, as long as there are no conflicts, by commenting `/update-branch` on the PR.

9. That's it! Rejoice that you've helped make Mattermost better.

### Useful Mattermost commands

During development you may want to reset the database and generate random data for testing your changes. See [the corresponding section of the server developer workflow]({{< ref "/contribute/more-info/server/developer-workflow#useful-mattermost-commands" >}}) for how to do that.
