# E2E testing for the Mattermost web client

This directory contains the E2E testing code for the Mattermost web client.

### How to run locally

##### For test case development

Please refer to the [dedicated developer documentation](https://developers.mattermost.com/contribute/more-info/webapp/e2e-testing/) for instructions.

##### For pipeline debugging

The E2E testing pipeline's scripts depend on the following tools being installed on your system: `docker`, `docker-compose`, `make`, `git`, `jq`, `node`, and some common utilities (`coreutils`, `findutils`, `bash`, `awk`, `sed`, `grep`)

Instructions, tl;dr: create a local branch with your E2E test changes, then open a PR to the `mattermost-server` repo targeting the `master` branch (so that CI will produce the image that docker-compose needs), then run `make` in this directory.

Instructions, detailed:
1. (optional, undefined variables are set to sane defaults) Create the `.ci/env` file, and populate it with the variables you need out of the following list:
  * `SERVER`: either `onprem` (default) or `cloud`.
  * `CWS_URL` (mandatory when `SERVER=cloud`, only used in such case): when spinning up a cloud-like test server that communicates with a test instance of a customer web server.
  * `TEST`: either `cypress` (default), `playwright`, or `none` (to avoid creating the cypress/playwright sidecar containers, e.g. if you only want to launch a server instance)
  * `ENABLED_DOCKER_SERVICES`: a space-separated list of services to start alongside the server. Default to `postgres inbucket`, for smoke test purposes and for lightweight and faster start-up time. Depending on the test requirement being worked on, you may want to override as needed, as such:
    - Cypress full tests require all services to be running: `postgres inbucket minio openldap elasticsearch keycloak`.
    - Cypress smoke tests require only the following: `postgres inbucket`.
    - Playwright full tests require only the following: `postgres inbucket`.
  * The following variables, will be passed over to the server container: `MM_LICENSE` (no enterprise features will be available if this is unset; required when `SERVER=cloud`), and the exploded `MM_ENV` (a comma-separated list of env var specifications)
  * The following variables, which will be passed over to the cypress container: `BRANCH`, `BUILD_ID`, `CI_BASE_URL`, `BROWSER`, `AUTOMATION_DASHBOARD_URL` and `AUTOMATION_DASHBOARD_TOKEN`
  * The `SERVER_IMAGE` variable can also be set if you want to select a custom mattermost-server image. If not specified, the value of the `SERVER_IMAGE_DEFAULT` variable defined in file `.ci/.e2erc` is used.
  * The `TEST_FILTER` variable can also be set, to customize which tests you want Cypress/Playwright to run. If not specified, only the smoke tests will run
    - Its format depends on which tool is used: for Cypress, please check the `e2e-tests/cypress/run_tests.js` file for details. For Playwright, it can simply be populated with arguments you want to give to the `playwright test` command.
  * More variables may be required to configure reporting and cloud interactions. Check the content of the `.ci/report.*.sh` and `.ci/server.cloud_*.sh` scripts for reference.
2. (optional) `make start-dashboard && make generate-test-cycle`: start the automation dashboard in the background, and initiate a test cycle on it, for the given `BUILD_ID`
  * NB: the `BUILD_ID` value should stay the same across the `make generate-test-cycle` command, and the subsequent `make` (see next step). If you need to initiate a new test cycle on the same dashboard, you'll need to change the `BUILD_ID` value and rerun both `make generate-test-cycle` and `make`.
  * Note that part of the dashboard functionality assumes the `BUILD_ID` to have a certain format (see [here](https://github.com/saturninoabril/automation-dashboard/blob/175891781bf1072c162c58c6ec0abfc5bcb3520e/lib/common_utils.ts#L3-L23) for details). This is not relevant for local running, but it's important to note in the testing pipelines.
  * This also automatically sets the `AUTOMATION_DASHBOARD_URL` and `AUTOMATION_DASHBOARD_TOKEN` variables for the cypress container
  * Note that if you run the dashboard locally, but also specify other `AUTOMATION_DASHBOARD_*` variables in your `.ci/env` file, the latter variables will take precedence.
  * The dashboard is used for orchestrating specs with parallel test runs and is typically used in CI.
  * Only Cypress is currently using the dashboard; Playwright is not.
3. `make`: start and prepare the server, then run the Cypress smoke tests
  * You can track the progress of the run in the `http://localhost:4000/cycles` dashboard if you launched it locally
  * For `SERVER=cloud` runs, you'll need to first create a cloud customer against the specified `CWS_URL` service by running `make cloud-init`. The user isn't automatically removed, and may be reused across multiple runs until you run `make cloud-teardown` to delete it.
  * If you want to run the Playwright tests instead of the Cypress ones, you can run `TEST=playwright make`
  * If you just want to run a local server instance, without any further testing, you can run `TEST=none make`
  * If you're using the automation dashboard, you have the option of sharding the E2E test run: you can launch the `make` command in parallel on different machines (NB: you must use the same `BUILD_ID` and `BRANCH` values that you used for `make generate-test-cycle`) to distribute running the test cases across them. When doing this, you should also set on each machine the `CI_BASE_URL` variable to a value that uniquely identifies the instance where `make` is running.
  * This script will also parse the local test results, and write a `e2e-tests/${TEST}/results/summary.json` file containing the following keys: `passed`, `failed` and `failed_expected` (the total number of testcases that were run is the sum of these three numbers)
4. `make stop`: tears down the server (and the dashboard, if running)
  * This will stop and cleanup all of the E2E testing containers, including the database and its persistent volume.
  * This also implicitly runs `make clean`, which also removes any generated environment or docker-compose files.

Notes:
- Setting a variable in `.ci/env` is functionally equivalent to exporting variables in your current shell's environment, before invoking the makefile.
- The `.ci/.env.*` files are auto-generated by the pipeline scripts and aren't meant to be modified manually. The only file you should edit to control the containers' environment is `.ci/env`, as specified in the instructions above.
- All of the variables in `.ci/env` must be set before the `make generate-server` command is run (or, if using the dashboard, before the `make generate-test-cycle` command). Modifying that file afterward has no effect because the containers' env files are generated in that step.
- If you restart the dashboard at any point, you must also restart the server containers, so that it picks up the new IP of the dashboard from the newly generated `.env.dashboard` file
- If new variables need to be passed to any of the containers, here are the general principles to follow when deciding where to populate it:
  * If their value is fixed (e.g. a static server configuration), these may be simply added to the `docker_compose_generator.sh` file, to the appropriate container.
  * If you need to introduce variables that you want to control from `.ci/env`: you need to update the scripts under the `.ci/` dir and configure them to write the new variables' values over to the appropriate `.env.*` file. In particular, avoid defining variables that depend on other variables within the docker-compose override files: this is to ensure uniformity in their availability and simplifies the question of what container has access to which variable considerably.
  * Exceptions are of course accepted wherever it makes sense (e.g. if you need to group variables based on some common functionality)
- The `report` Make target is meant for internal usage. Usage and variables are documented in the respective scripts.
- `make start-server` won't cleanup containers that don't change across runs. This means that you can use it to emulate a Mattermost server upgrade while retaining your database data by simply changing the `SERVER_IMAGE` variable on your machine, and then re-running `make start-server`. But this also means that if you want to run a clean local environment, you may have to manually run `make stop` to cleanup any running containers and their volumes, which include e.g. the database.

##### For code changes:
* `make fmt-ci` to format and check yaml files and shell scripts.

##### For test stressing an E2E testcase

For Cypress:
1. Enter the `cypress/` subdirectory
2. Identify which test files you want to run, and how many times each. For instance: suppose you want to run `create_a_team_spec.js` and `demoted_user_spec.js` (which you can locate with the `find` command, under `cypress/tests/`), each run 3 times
3. Run the chosen testcases the desired amount of times: `node run_tests.js --include-file=create_a_team_spec.js,demoted_user_spec.js --invert --stress-test-count=3`
  * Your system needs to be setup for Cypress usage, to be able to run this command. Refer to the [E2E testing developer documentation](https://developers.mattermost.com/contribute/more-info/webapp/e2e-testing/) for this.
4. The `cypress/results/testPasses.json` file will count, for each of the testfiles, how many times it was run, and how many times each of the testcases contained in it passed. If the attempts and passes numbers do not match, that specific testcase may be flaky.

For Playwright: WIP
