### Background

This document aims to explain the bunch of server and webapp yaml files and their functionality.

The context behind this complexity is that we want new pushes to PR branches to cancel older in-progress and pending CI runs, _but_ we don't want that to happen in master branch. Unfortunately, there is no config knob to control pending workflows and if you set a concurrency group, then pending workflows will _always_ be canceled. Refer to https://github.com/orgs/community/discussions/5435 for discussion.

Therefore, we have a template yaml file which is actually the main CI code. That is then imported by `{server|webapp}-ci-master.yml` and `{server|webapp}-ci-pr.yml`. The `-master.yml` files don't have any concurrency limits, but `-pr.yml` files do.

### Folder structure

server-ci-pr
|
---server-ci-template
	|
	---server-test-template (common code for postgres and mysql tests)

server-ci-master
|
---server-ci-template
	|
	---server-test-template (common code for postgres and mysql tests)

webapp-ci-pr
|
---webapp-ci-template

webapp-ci-master
|
---webapp-ci-template
