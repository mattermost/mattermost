# E2E testing for the Mattermost web client

This directory contains the E2E testing code for the Mattermost web client.

### How to run locally

The E2E testing scripts depend on the following tools being installed on your system: `docker`, `docker-compose`, `make`, `git`, `jq`, and some common utilities (`coreutils`, `findutils`, `bash`, `awk`, `sed`, `grep`)

Instructions, tl;dr: create a local branch with your E2E test changes, then open a PR to the `mattermost-server` repo targeting the `master` branch (so that CI will produce the image that docker-compose needs), then run `make` in this directory.

Instructions, detailed:
1. Create the `.ci/env` file, and populate the variables you need, keeping in mind that:
  * The following variables will be passed over to the server container: `MM_LICENSE` (no enterprise features will be available if this is unset), and the exploded `MM_ENV` (a comma-separated list of env var specifications)
  * The following variables will be passed over to the cypress container: `BRANCH`, `BUILD_ID`, `CI_BASE_URL`, `AUTOMATION_DASHBOARD_URL` and `AUTOMATION_DASHBOARD_TOKEN`
  * The `SERVER_IMAGE` variable can also be set, if you want to select a custom mattermost-server image
  * The `TEST_FILTER` variable can also be set, to customize which tests you want cypress to run
  * All variables are optional, and will be set to sane defaults
2. (optional) `make start-dashboard`: start the automation-dashboard in the background
  * This also sets the `AUTOMATION_DASHBOARD_URL` and `AUTOMATION_DASHBOARD_TOKEN` variables for the cypress container
  * Note that if you run the dashboard locally, but also specify other `AUTOMATION_DASHBOARD_*` variables in your env, the latter variables will take precedence
3. `make`: start and prepare the server, then run the cypress tests
  * You can track the progress of the run in the `http://localhost:4000/cycles` dashboard, if you launched it locally
4. `make stop`: tears down the server (and the dashboard, if running), then cleans up the env placeholder files

Notes:
- Aside from some exceptions (e.g. `TEST_FILTER`), most of the variables in `.ci/env` must be set before the `make start-server` command is run. Modifying that file afterwards has no effect, because the containers' env files are generated in that step.
- If you restart the dashboard at any point, you must also restart the server containers, so that it picks up the new IP of the dashboard from the newly generated `.env.dashboard` file
- If you started the dashboard locally in the past, but want to point to another dashboard later, you can run `make clean-env-placeholders` to remove references to the local dashboard (you'll likely need to restart the server)
- Dynamically set variables for the server or cypress should be managed within the `.env.*` files, rather than in the docker-compose files, to streamline their management.

##### How to control which tests to run

The `TEST_FILTER` variable will control which test files to run Cypress tests against. Please check the `e2e-tests/cypress/run_tests.js` file for details about its format.
