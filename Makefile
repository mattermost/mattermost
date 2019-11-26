GO ?= go
GO_TEST_FLAGS ?= -race

all: test

test:
	$(GO) test $(GO_TEST_FLAGS) -v ./...

coverage:
	$(GO) test $(GO_TEST_FLAGS) -coverprofile=coverage.txt ./...
	$(GO) tool cover -html=coverage.txt

check-style:
	@if ! [ -x "$$(command -v golangci-lint)" ]; then \
		echo "golangci-lint is not installed. Please see https://github.com/golangci/golangci-lint#install for installation instructions."; \
		exit 1; \
	fi; \

	@echo Running golangci-lint
	golangci-lint run ./...
