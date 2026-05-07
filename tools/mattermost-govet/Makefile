.PHONY: all test clean golangci-lint check-style

export GOBIN ?= $(PWD)/bin
GO ?= go

all: test

test:
	$(GO) test ./...

clean:
	rm -rf dist

golangci-lint:
	$(GO) install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@v2.11.4
	$(GOBIN)/golangci-lint run ./...

check-style: golangci-lint
