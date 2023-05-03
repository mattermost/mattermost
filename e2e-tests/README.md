### How to run locally

1. Create the `.ci/env` file, and populate the following variables:
  * `MM_LICENSE` (optional, only for enterprise server tests)
  * `SERVER_IMAGE` (optional, defaults to this commit's `mm-ee-test` image)
  * `BRANCH` (optional, defaults to currently checked out branch)
  * `BUILD_ID` (optional, defaults to current unix timestamp)
  * `TEST_FILTER` (optional, defaults to running smoke tests only)
2. `make start-dashboard`: start the automation-dashboard in the background
3. `make start-server`: start the mattermost-server and its dependencies
4. `make prepare-server`: reconfigure the server to prepare it for E2E testing, and initialize cypress requirements
5. `make run-cypress`: this will run the actual cypress tests

Notes:
- If you restart the dashboard, you must also restart the server to have it point to the new dashboard IP
- If you started the dashboard locally in the past, but want to point to another dasbhoard later, you can run `make clean-env-placeholders` to remove references to the local dasbhoard (you'll likely need to restart the server)
- Variables in your environment (or sourced from `.ci/env`) are accessible by the CI scripts, but are not automatically avilable in the server/cypress/dashboard containers. The scripts `.ci/server.start.sh` and `.ci/dashboard.start.sh` are responsible for writing which those containers' env files, so those should be modified if you want to expose a variable from your environment to the containers (see the `.ci/*.override.yml` files, to check which env files are used by which containers)



##### TODOS

- Save the report, after the run (see gitlab's `report` job, and check the variables required by `save_report.js`)
