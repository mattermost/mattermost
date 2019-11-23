# test-te used to just run the team edition tests, but now runs whatever is available
test-te: test-server

# test-ee used to just run the enterprise edition tests, but now runs whatever is available
test-ee: test-server

## Runs govet against all packages. This is now subsumed by make golangci-lint.
govet:
	@echo Running GOVET
	env GO111MODULE=off $(GO) get golang.org/x/tools/go/analysis/passes/shadow/cmd/shadow
	$(GO) vet $(GOFLAGS) $(ALL_PACKAGES) || exit 1
	$(GO) vet -vettool=$(GOPATH)/bin/shadow $(GOFLAGS) $(ALL_PACKAGES) || exit 1
	$(GO) run $(GOFLAGS) ./plugin/checker

gofmt: ## Runs gofmt against all packages. This is now subsumed by make golangci-lint.
	@echo Running GOFMT

	@for package in $(TE_PACKAGES) $(EE_PACKAGES); do \
		 echo "Checking "$$package; \
		 files=$$($(GO) list $(GOFLAGS) -f '{{range .GoFiles}}{{$$.Dir}}/{{.}} {{end}}' $$package); \
		 if [ "$$files" ]; then \
			 gofmt_output=$$(gofmt -d -s $$files 2>&1); \
			 if [ "$$gofmt_output" ]; then \
				 echo "$$gofmt_output"; \
				 echo "gofmt failure"; \
				 exit 1; \
			 fi; \
		 fi; \
	done
	@echo "gofmt success"; \

# clean old docker images
clean-old-docker:
	@echo Removing docker containers

	@if [ $(shell docker ps -a --no-trunc --quiet --filter name=^/mattermost-mysql$$ | wc -l) -eq 1 ]; then \
		echo removing mattermost-mysql; \
		docker stop mattermost-mysql > /dev/null; \
		docker rm -v mattermost-mysql > /dev/null; \
	fi

	@if [ $(shell docker ps -a --no-trunc --quiet --filter name=^/mattermost-mysql-unittest$$ | wc -l) -eq 1 ]; then \
		echo removing mattermost-mysql-unittest; \
		docker stop mattermost-mysql-unittest > /dev/null; \
		docker rm -v mattermost-mysql-unittest > /dev/null; \
	fi

	@if [ $(shell docker ps -a --no-trunc --quiet --filter name=^/mattermost-postgres$$ | wc -l) -eq 1 ]; then \
		echo removing mattermost-postgres; \
		docker stop mattermost-postgres > /dev/null; \
		docker rm -v mattermost-postgres > /dev/null; \
	fi

	@if [ $(shell docker ps -a --no-trunc --quiet --filter name=^/mattermost-postgres-unittest$$ | wc -l) -eq 1 ]; then \
		echo removing mattermost-postgres-unittest; \
		docker stop mattermost-postgres-unittest > /dev/null; \
		docker rm -v mattermost-postgres-unittest > /dev/null; \
	fi

	@if [ $(shell docker ps -a | grep -ci mattermost-openldap) -eq 1 ]; then \
		echo removing mattermost-openldap; \
		docker stop mattermost-openldap > /dev/null; \
		docker rm -v mattermost-openldap > /dev/null; \
	fi

	@if [ $(shell docker ps -a | grep -ci mattermost-inbucket) -eq 1 ]; then \
		echo removing mattermost-inbucket; \
		docker stop mattermost-inbucket > /dev/null; \
		docker rm -v mattermost-inbucket > /dev/null; \
	fi

	@if [ $(shell docker ps -a | grep -ci mattermost-minio) -eq 1 ]; then \
		echo removing mattermost-minio; \
		docker stop mattermost-minio > /dev/null; \
		docker rm -v mattermost-minio > /dev/null; \
	fi

	@if [ $(shell docker ps -a | grep -ci mattermost-elasticsearch) -eq 1 ]; then \
		echo removing mattermost-elasticsearch; \
		docker stop mattermost-elasticsearch > /dev/null; \
		docker rm -v mattermost-elasticsearch > /dev/null; \
	fi
