ifndef CIRCLE_ARTIFACTS
CIRCLE_ARTIFACTS=tmp
endif

bootstrap:
	.buildscript/bootstrap.sh

dependencies:
	@go get -v -t ./...

vet:
	@go vet ./...

test: vet
	@mkdir -p ${CIRCLE_ARTIFACTS}
	@go test -race -coverprofile=${CIRCLE_ARTIFACTS}/cover.out .
	@go tool cover -func ${CIRCLE_ARTIFACTS}/cover.out -o ${CIRCLE_ARTIFACTS}/cover.txt
	@go tool cover -html ${CIRCLE_ARTIFACTS}/cover.out -o ${CIRCLE_ARTIFACTS}/cover.html

build: test
	@go build ./...

e2e:
	@if [ "$(RUN_E2E_TESTS)" != "true" ]; then \
	  echo "Skipping end to end tests."; else \
		go get github.com/segmentio/library-e2e-tester/cmd/tester; \
		tester -segment-write-key=$(SEGMENT_WRITE_KEY) -webhook-auth-username=$(WEBHOOK_AUTH_USERNAME) -webhook-bucket=$(WEBHOOK_BUCKET) -path='cli' -concurrency=2 -skip='advance|alias'; fi

ci: dependencies test e2e

.PHONY: bootstrap dependencies vet test e2e ci
