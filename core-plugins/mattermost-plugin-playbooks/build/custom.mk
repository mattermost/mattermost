# Include custom targets and environment variables here

## Generate mocks.
mocks:
ifneq ($(HAS_SERVER),)
	mockgen -destination server/bot/mocks/mock_poster.go github.com/mattermost/mattermost-plugin-playbooks/server/bot Poster
	mockgen -destination server/app/mocks/mock_job_once_scheduler.go github.com/mattermost/mattermost-plugin-playbooks/server/app JobOnceScheduler
	mockgen -destination server/app/mocks/mock_condition_store.go github.com/mattermost/mattermost-plugin-playbooks/server/app ConditionStore
	mockgen -destination server/app/mocks/mock_playbook_store.go github.com/mattermost/mattermost-plugin-playbooks/server/app PlaybookStore
	mockgen -destination server/app/mocks/mock_property_service.go github.com/mattermost/mattermost-plugin-playbooks/server/app PropertyService
	mockgen -destination server/app/mocks/mock_auditor.go github.com/mattermost/mattermost-plugin-playbooks/server/app Auditor
	mockgen -destination server/sqlstore/mocks/mock_kvapi.go github.com/mattermost/mattermost-plugin-playbooks/server/sqlstore KVAPI
	mockgen -destination server/sqlstore/mocks/mock_storeapi.go github.com/mattermost/mattermost-plugin-playbooks/server/sqlstore StoreAPI
	mockgen -destination server/sqlstore/mocks/mock_configurationapi.go github.com/mattermost/mattermost-plugin-playbooks/server/sqlstore ConfigurationAPI
endif

## Runs the redocly server.
.PHONY: docs-server
docs-server:
	npx @redocly/openapi-cli@1.0.0-beta.3 preview-docs server/api/api.yaml

## Re-generate tests-e2e/db-setup/mattermost.sql from the Postgres image expected to be running
## in the developer's Docker environment.
.PHONY: tests-e2e/db-setup/mattermost.sql
tests-e2e/db-setup/mattermost.sql:
	docker exec mattermost-postgres pg_dump \
		--username=mmuser \
		--clean \
		--if-exists \
		--exclude-table ir_incident \
		--exclude-table ir_playbook \
		--exclude-table ir_playbookmember \
		--exclude-table ir_statusposts \
		--exclude-table ir_system \
		--exclude-table ir_timelineevent \
		--exclude-table ir_userinfo \
		--exclude-table ir_viewedchannel \
		mattermost_test > tests-e2e/db-setup/mattermost.sql
