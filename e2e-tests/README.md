### How to run locally

1. Create the `.ci/env` file, and populate the following variables: `MM_LICENSE`, `SERVER_IMAGE`, `BRANCH`, `BUILD_ID` # TODO perhaps some of these will be automated
2. `make start-dashboard`: start the automation-dashboard in the background
3. `make start-server`: start the mattermost-server and its dependencies
4. `make run-cypress`: this will run the actual cypress tests

Notes:
- If you restart the dashboard, you must also restart the server to have it point to the new dashboard IP
