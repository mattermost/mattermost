# Mattermost Development Dashboard
# Run 'make' to launch the interactive development dashboard.
# Run 'make help' for all available targets.

DEVDASH_DIR := tools/devdash
DEVDASH_BIN := $(DEVDASH_DIR)/bin/devdash
INSTALL_DIR := $(HOME)/.local/bin
CONFIG_DIR  := $(HOME)/.config/devdash

.PHONY: default dashboard dashboard-clean run stop check-all clean install uninstall init-cli-tools edit-config help

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

install: $(DEVDASH_BIN) ## Install mmake CLI to ~/.local/bin
	@mkdir -p $(INSTALL_DIR)
	@mkdir -p $(CONFIG_DIR)
	@echo "==> Installing mmake to $(INSTALL_DIR)/mmake..."
	@cp $(DEVDASH_BIN) $(INSTALL_DIR)/mmake
	@# Move existing config to persistent location if not already symlinked
	@if [ -f .devdash.json ] && [ ! -L .devdash.json ]; then \
		mv .devdash.json $(CONFIG_DIR)/.devdash.json; \
	fi
	@if [ ! -f $(CONFIG_DIR)/.devdash.json ]; then \
		echo '{}' > $(CONFIG_DIR)/.devdash.json; \
	fi
	@ln -sf $(CONFIG_DIR)/.devdash.json .devdash.json
	@# Symlink binary back so `make` still works without rebuilding
	@ln -sf $(INSTALL_DIR)/mmake $(DEVDASH_BIN)
	@echo "==> Installed!"
	@echo "    Binary: $(INSTALL_DIR)/mmake"
	@echo "    Config: $(CONFIG_DIR)/.devdash.json"
	@if ! echo "$$PATH" | tr ':' '\n' | grep -qx "$(INSTALL_DIR)"; then \
		echo ""; \
		echo "    NOTE: $(INSTALL_DIR) is not on your PATH."; \
		echo "    Add to your shell rc: export PATH=\"$(INSTALL_DIR):\$$PATH\""; \
	fi

uninstall: ## Remove mmake CLI
	@echo "==> Removing mmake..."
	@rm -f $(INSTALL_DIR)/mmake
	@rm -f $(DEVDASH_BIN)
	@echo "==> Done."

clean: ## Clean all build artifacts
	@$(MAKE) -C server clean
	@$(MAKE) -C webapp clean
	@$(MAKE) dashboard-clean

init-cli-tools: ## Install tmux + mise and generate a starter mise config
	@OS=$$(uname -s); \
	echo "==> Detected OS: $$OS"; \
	echo "==> Installing tmux (if missing)..."; \
	if ! command -v tmux >/dev/null 2>&1; then \
		if [ "$$OS" = "Darwin" ]; then \
			command -v brew >/dev/null 2>&1 || { echo "Error: Homebrew is required on macOS. Install from https://brew.sh"; exit 1; }; \
			brew install tmux; \
		elif [ "$$OS" = "Linux" ]; then \
			if command -v apt-get >/dev/null 2>&1; then \
				sudo apt-get update && sudo apt-get install -y tmux; \
			elif command -v dnf >/dev/null 2>&1; then \
				sudo dnf install -y tmux; \
			elif command -v pacman >/dev/null 2>&1; then \
				sudo pacman -S --noconfirm tmux; \
			else \
				echo "Error: No supported package manager found. Install tmux manually."; exit 1; \
			fi; \
		else \
			echo "Error: Unsupported OS '$$OS'. Install tmux manually."; exit 1; \
		fi; \
	else \
		echo "    tmux already installed."; \
	fi; \
	echo "==> Installing mise (if missing)..."; \
	if ! command -v mise >/dev/null 2>&1; then \
		if [ "$$OS" = "Darwin" ] && command -v brew >/dev/null 2>&1; then \
			brew install mise; \
		else \
			curl https://mise.run | sh; \
		fi; \
	else \
		echo "    mise already installed."; \
	fi
	@MISE_GLOBAL="$${XDG_CONFIG_HOME:-$$HOME/.config}/mise/config.toml"; \
	if [ ! -f mise.toml ] && [ ! -f "$$MISE_GLOBAL" ]; then \
		echo "==> Creating mise config..."; \
		tools/devdash/scripts/init-mise.sh; \
	else \
		echo "==> mise config already exists, skipping. Run 'make edit-config' to modify."; \
	fi
	@mise trust --yes 2>/dev/null || true
	@echo "==> Running mise install..."
	@mise install
	@SHELL_NAME=$$(basename "$$SHELL"); \
	echo "==> Done! Run 'mise activate $$SHELL_NAME >> ~/.$${SHELL_NAME}rc' if not already set up."

edit-config: ## Open mise config in your editor
	@MISE_GLOBAL="$${XDG_CONFIG_HOME:-$$HOME/.config}/mise/config.toml"; \
	if [ ! -f mise.toml ] && [ ! -f "$$MISE_GLOBAL" ]; then \
		echo "==> Creating mise config..."; \
		tools/devdash/scripts/init-mise.sh; \
	fi
	@mise trust --yes 2>/dev/null || true
	@mise edit

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'
