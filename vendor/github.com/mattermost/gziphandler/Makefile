.PHONY: build check-style install run test verify-gomod

# Variables
GO=go

# Test runs go test command
test:
	$(GO) test -cover -race ./...

# Checks code style by running golangci-lint on codebase.
check-style:
	@if ! [ -x "$$(command -v golangci-lint)" ]; then \
		echo "golangci-lint is not installed. Please see https://github.com/golangci/golangci-lint#install for installation instructions."; \
		exit 1; \
	fi; \

	@echo Running golangci-lint
	golangci-lint run ./...

# Check modules
verify-gomod:
	$(GO) mod download
	$(GO) mod verify
