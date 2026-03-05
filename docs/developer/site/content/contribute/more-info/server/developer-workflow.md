---
title: "Server workflow"
heading: "Mattermost Server workflow"
description: "See what a general workflow for a Mattermost developer working on the mattermost-server repository looks like."
date: 2017-08-20T11:35:32-04:00
weight: 3
aliases:
  - /contribute/server/developer-workflow
---

If you haven't [set up your developer environment]({{< ref "/contribute/developer-setup" >}}), please do so before continuing with this section.

Join the {{< newtabref href="https://community.mattermost.com/core/channels/developers" title="Developers community channel" >}} to ask questions from community members and the Mattermost core team.

### Workflow

Here's a general workflow for a Mattermost developer working on the {{< newtabref href="https://github.com/mattermost/mattermost" title="mattermost" >}} repository:

#### Making code changes
1. Review the repository structure to familiarize yourself with the project:

    * [./server/channels/api4/](https://github.com/mattermost/mattermost/tree/master/server/channels/api4) holds all API and application related code.
    * [./server/public/model/](https://github.com/mattermost/mattermost/tree/master/server/public/model) holds all data model definitions and the Go driver.
    * [./server/channels/store/](https://github.com/mattermost/mattermost/tree/master/server/channels/store) holds all database querying code.
    * [./server/channels/utils/](https://github.com/mattermost/mattermost/tree/master/server/channels/utils) holds all utilities, such as the mail utility.
    * [./server/i18n/](https://github.com/mattermost/mattermost/tree/master/server/i18n) holds all localization files for the server.
2. On your fork, create a feature branch for your changes. Name it `MM-$NUMBER_$DESCRIPTION` where `$NUMBER` is the [Jira](https://mattermost.atlassian.net) ticket number you are working on and `$DESCRIPTION` is a short description of your changes. Example branch names are `MM-18150_plugin-panic-log` and `MM-22037_uppercase-email`.
3. Make the code changes required to complete your ticket.
#### Running and writing tests
4. Ensure that unit tests are written or modified where appropriate. For the server repository in general, Mattermost follows the opinionated way of testing in Go. You can learn more about this process in {{<newtabref title="DigitalOcean's How To Write Unit Tests in Go tutorial" href="https://www.digitalocean.com/community/tutorials/how-to-write-unit-tests-in-go-using-go-test-and-the-testing-package">}}. Test files must always end with `_test.go`, and should be located in the same folder where the code they are checking lives. For example, check out [download.go](https://github.com/mattermost/mattermost/blob/master/server/channels/app/download.go) and [download_test.go](https://github.com/mattermost/mattermost/blob/master/server/channels/app/download_test.go), which are both located in the `app` folder. Please also use {{<newtabref title="testify" href="https://github.com/stretchr/testify">}} for new tests.
5. If you made changes to the store, run `make store-mocks` and `make store-layers` to update test mocks and timing layer.
6. To test your changes, run `make run-server` from the root directory of the server repository. This will start up the server at `http://localhost:8065`. To get changes to the server it must be restarted with `make restart-server`. If you want to test with the web app, you may also run `make run` which will start the server and a watcher for changes to the web app.
7. Once everything works to meet the ticket requirements, stop Mattermost by running `make stop` in the server repository, then run `make check-style` to check your syntax.
8. Run the tests using one or more of the following options:
    * Run `make test` to run all the tests in the project. This may take a long time and provides very little feedback while it's running.
    * Run individual tests by name executing `go test -run "TestName" ./<directory>`.
    * Run all the tests in a package where changes were made executing `go test app`.
    * Create a draft PR with your changes and let our CI servers run the tests for you.
9. Running every single unit test takes a lot of time while making changes, so you can run a subset of the server-side unit tests by using the following:
    ```
    go test -v -run='<test name or regex>' ./<package containing test>
    ```
    For example, if you want to run `TestUpdatePost` in `app/post_test.go`, you would execute the following:

    ```
    go test -v -run='TestUpdatePost' ./app
    ```
10. If you added or changed any localization strings you will need to run `make i18n-extract` to generate the new/updated strings.
#### Testing email notifications

11. When Docker starts, the SMTP server is available on port 2500. A username and password are not required. You can access the Inbucket webmail on port 9000. For additional information on configuring an SMTP email server, including troubleshooting steps, see the {{<newtabref title="SMTP email setup page in the Mattermost user documentation" href="https://docs.mattermost.com/install/smtp-email-setup.html">}}.
#### Testing with GitLab Omnibus

12. To test a locally compiled version of Mattermost with GitLab Omnibus, replace the following GitLab files:
    * The compiled `mattermost` binary in `/opt/gitlab/embedded/bin/mattermost`.
    * The assets (templates, i18n, fonts, webapp) in `/opt/gitlab/embedded/service/mattermost`.
#### Creating a pull request (PR)
13. Commit your changes, push your branch, and [create a pull request]({{< ref "/contribute/more-info/getting-started/contribution-checklist" >}}).
14. Once a PR is submitted it's best practice to avoid rebasing on the base branch or force-pushing. Jesse, a developer at Mattermost, mentions this in his blog article  [Submitting Great PRs](https://mattermost.com/blog/submitting-great-prs/). When the PR is merged, all the PR's commits are automatically squashed into one commit, so you don't need to worry about having multiple commits on the PR.
15. That's it! Rejoice that you've helped make Mattermost better.

### Useful Server makefile commands

Some useful `make` commands include:

* `make run` runs the server, creates a symlink for your mattermost-webapp folder, and starts a watcher for the web app.
* `make stop` stops the server and the web app watcher.
* `make run-server` runs only the server and not the client.
* `make debug-server` will run the server in the `delve` debugger.
* `make stop-server` stops only the server.
* `make update-docker` stops and updates your Docker images. This is needed if any changes are made to `docker-compose.yaml`.
* `make clean-docker` stops and removes your Docker images and is a good way to wipe your database.
* `make clean` cleans your local environment of temporary files.
* `make config-reset` resets the `config/config.json` file to the default.
* `make nuke` wipes your local environment back to a completely fresh start.
* `make package` creates packages for distributing your builds and puts them in the `./dist` directory. You will first need to run `make build` and `make build-client`.

If you would like to run the development environment without Docker you can set the `MM_NO_DOCKER` environment variable. If you do this, you will need to set up your own database and any of the other services needed to run Mattermost.

### Useful Mattermost and mmctl commands

During development you may want to reset the database and generate random data for testing your changes. For this purpose, Mattermost has the following commands in the Mattermost CLI:

1. First, install the server with `go install ./cmd/mattermost` in the server repository.
2. You can reset your database to the initial state using:
    
    ```
    mattermost db reset
    ```
3. The following commands need to be run via the [mmctl](https://docs.mattermost.com/manage/mmctl-command-line-tool.html) tool.

    * You can generate random data to populate the Mattermost database using:

      ```
      mmctl sampledata
      ```

    * Create an account using the following command:

      ```
      mmctl user create --email user@example.com --username test1 --password mypassword
      ```

    * Optionally, you can assign that account System Admin rights with the following command:

      ```
      mmctl user create --email user@example.com --username test1 --password mypassword --system-admin
      ```

### Customize your workflow

#### Makefile variables

You can customize variables of the Makefile by creating a `config.override.mk` file or setting environment variables. To get started, you can copy the `config.mk` file to `config.override.mk` and change the values in your newly copied file.

#### Docker-compose configurations

If you create a `docker-compose.override.yaml` file at the root of the project, it will be automatically loaded by all the `Makefile` tasks using `docker-compose`, allowing you to define your own services or change the configuration of the ones Mattermost provides.
