# Mattermost Development Dashboard
# Run 'make' to launch the interactive development dashboard.
# Run 'make help' for all available targets.

DEVDASH_DIR := tools/devdash
DEVDASH_BIN := $(DEVDASH_DIR)/bin/devdash

.PHONY: default dashboard dashboard-clean help
.PHONY: run run-server run-client stop test test-server test-client check-style check-types dist clean

default: dashboard

dashboard: $(DEVDASH_BIN) ## Launch the development dashboard TUI
	@$(DEVDASH_BIN)

$(DEVDASH_BIN): $(wildcard $(DEVDASH_DIR)/*.go $(DEVDASH_DIR)/**/*.go $(DEVDASH_DIR)/go.mod)
	@echo "Building devdash..."
	@cd $(DEVDASH_DIR) && go build -o bin/devdash .

dashboard-clean: ## Remove devdash binary
	@rm -f $(DEVDASH_BIN)

# Pass-through convenience targets

run-server: ## Start the Mattermost server
	@$(MAKE) -C server run-server

run-client: ## Start the webapp dev server
	@$(MAKE) -C webapp run

run: ## Start both server and client
	@$(MAKE) -C server run

stop: ## Stop server and client
	@$(MAKE) -C server stop

test-server: ## Run server tests
	@$(MAKE) -C server test-server

test-client: ## Run webapp tests
	@$(MAKE) -C webapp test

test: ## Run all tests
	@$(MAKE) -C server test

check-style: ## Run all linters
	@$(MAKE) -C server check-style

check-types: ## Run TypeScript type checking
	@$(MAKE) -C webapp check-types

dist: ## Build distribution
	@$(MAKE) -C webapp dist

clean: ## Clean all build artifacts
	@$(MAKE) -C server clean
	@$(MAKE) -C webapp clean
	@$(MAKE) dashboard-clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'
