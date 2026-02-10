# Mattermost Development Dashboard
# Run 'make' to launch the interactive development dashboard.
# Run 'make help' for all available targets.

DEVDASH_DIR := tools/devdash
DEVDASH_BIN := $(DEVDASH_DIR)/bin/devdash

.PHONY: default dashboard dashboard-clean run stop check-all clean init-cli-tools edit-config help

default: dashboard

dashboard: $(DEVDASH_BIN) ## Launch the development dashboard TUI
	@$(DEVDASH_BIN)

$(DEVDASH_BIN): $(wildcard $(DEVDASH_DIR)/*.go $(DEVDASH_DIR)/**/*.go $(DEVDASH_DIR)/go.mod)
	@echo "Building devdash..."
	@cd $(DEVDASH_DIR) && go build -o bin/devdash .

dashboard-clean: ## Remove devdash binary
	@rm -f $(DEVDASH_BIN)

run: ## Start both server and webapp
	@$(MAKE) -C server run

stop: ## Stop server and webapp
	@$(MAKE) -C server stop

check-all: ## Run all linters, style, and type checks
	@$(MAKE) -C server check-style
	@$(MAKE) -C webapp check-style
	@$(MAKE) -C webapp check-types

clean: ## Clean all build artifacts
	@$(MAKE) -C server clean
	@$(MAKE) -C webapp clean
	@$(MAKE) dashboard-clean

init-cli-tools: ## Install tmux + mise and generate a starter mise.toml
	@echo "==> Checking for Homebrew..."
	@command -v brew >/dev/null 2>&1 || { echo "Error: Homebrew is required. Install from https://brew.sh"; exit 1; }
	@echo "==> Installing tmux (if missing)..."
	@command -v tmux >/dev/null 2>&1 || brew install tmux
	@echo "==> Installing mise (if missing)..."
	@command -v mise >/dev/null 2>&1 || brew install mise
	@if [ ! -f mise.toml ]; then \
		echo "==> Creating mise.toml..."; \
		tools/devdash/scripts/init-mise.sh; \
	else \
		echo "==> mise.toml already exists, skipping."; \
	fi
	@echo "==> Running mise install..."
	@mise install
	@echo "==> Done! Run 'mise activate zsh >> ~/.zshrc' if not already set up."

edit-config: ## Open mise.toml in your editor
	@if [ ! -f mise.toml ]; then \
		echo "==> Creating mise.toml..."; \
		tools/devdash/scripts/init-mise.sh; \
	fi
	@mise trust --yes 2>/dev/null || true
	@mise edit

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'
