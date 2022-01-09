all: test

GO=go

.PHONY: test
test:
	$(GO) clean -testcache
	make test-drivers
	make test-rest

.PHONY: test-rest
test-rest:
	$(GO) clean -testcache
	$(GO) test -race -v --tags=!drivers,sources ./...

.PHONY: test-drivers
test-drivers:
	$(GO) clean -testcache
	$(GO) test -race -v --tags=drivers,!sources ./...

.PHONY: update-dependencies
update-dependencies:
	$(GO) get -u ./...
	$(GO) mod vendor
	$(GO) mod tidy

.PHONY: vendor
vendor:
	$(GO) mod vendor
	$(GO) mod tidy

.PHONY: check
check:
	$(GO) fmt ./...

.PHONY: run-databases
run-databases:
	docker-compose up --no-recreate -d

.PHONY: install
install:
	$(GO) install -mod=readonly -trimpath ./cmd/morph
