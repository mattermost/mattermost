# E2E testing for the Mattermost web client

This directory contains the E2E testing code for the Mattermost web client.

### How to run locally

The E2E testing scripts depend on the following tools being installed on your system: `docker`, `docker-compose`, `make`, `git`, `jq`, and some common utilities (`coreutils`, `findutils`, `bash`, `awk`, `sed`, `grep`)

Instructions:
1. Create the `.ci/env` file, and populate the following variables:
  * `MM_LICENSE` (optional, only for tests that require an enterprise license)
  * `MME2E_SERVER_IMAGE` (optional, defaults to this commit's `mm-ee-test` image)
  * `MME2E_BRANCH` (optional, defaults to currently checked out branch)
  * `MME2E_BUILD_ID` (optional, defaults to current unix timestamp)
  * `MME2E_TEST_FILTER` (optional, defaults to running smoke tests only)
2. `make start-dashboard` (optional): start the automation-dashboard in the background
  * This also sets the `AUTOMATION_DASHBOARD_URL` and `AUTOMATION_DASHBOARD_TOKEN` variables for the cypress container.
3. `make`: start and prepare the server, then run the cypress tests
  * You can track the progress of the run in the `http://localhost:4000/cycles` dashboard
4. `make stop`: tears down the server (and the dashboard, if running), then cleans up the env placeholder files

Notes:
- Aside from some exceptions (e.g. `MME2E_TEST_FILTER`), most of the variables in `.ci/env` must be set before the `make start-server` command is run. Modifting that file afterwards has no effect, because the containers' env files are generated in that step.
- If you restart the dashboard at any point, you must also restart the server containers, so that it pics up the new IP of the dashboard
- If you started the dashboard locally in the past, but want to point to another dasbhoard later, you can run `make clean-env-placeholders` to remove references to the local dasbhoard (you'll likely need to restart the server)
- Variables in your environment (or sourced from `.ci/env`) are accessible by the CI scripts, but are not automatically avilable in the server/cypress/dashboard containers. If you need to expose an environment variable inside a container, you must modify the scripts `.ci/server.start.sh` and `.ci/dashboard.start.sh`, which are responsible for writing which those containers' env files (see the `.ci/{server,dashboard}.override.yml` files, to check which env files are used by which containers).

##### How to control which tests to run

The `MME2E_TEST_FILTER` variable will control which test files to run Cypress tests against. Please check the `e2e-tests/cypress/run_tests.js` file for details about its format.



##### TODOS

- Run E2E tests in CI
- In CI: upload the server+cypress logs as a job artifact, after the run
- In CI: report back to the `QA: UI Test Automation` channel at the end of the run, with the link to the automation dasbhoard.
  * Will require updating `cypress/save_report.js`
  * No need for the S3 upload, we'll rely only on the automation dashboard
