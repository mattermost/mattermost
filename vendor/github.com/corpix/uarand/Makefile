.DEFAULT_GOAL = all

version  := $(shell git rev-list --count HEAD).$(shell git rev-parse --short HEAD)

name     := uarand
package  := github.com/corpix/$(name)

.PHONY: all
all:: useragents.go

.PHONY: test
test:
	go test -v ./...

.PHONY: lint
lint:
.PHONY: lint
lint:
	golangci-lint --color=always                                                       \
		--exclude='uses unkeyed fields'                                            \
		--exclude='type .* is unused'                                              \
		--exclude='should merge variable declaration with assignment on next line' \
		--deadline=120s                                                            \
		run ./...

.PHONY: check
check: lint test

.PHONY: useragents.go
useragents.go:
	./scripts/fetch-user-agents | ./scripts/generate-useragents-go $(name) > $@
	go fmt $@
