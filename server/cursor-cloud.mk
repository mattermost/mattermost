# cursor-cloud.mk
# Dedicated make targets for the Cursor Cloud Agent environment.
# Included by server/Makefile via `-include cursor-cloud.mk`.
#
# These targets are isolated from the normal dev workflow.
# All targets are prefixed with `cursor-cloud-` to avoid conflicts.
#
# Key differences from the standard dev path:
# - MM_NO_DOCKER=true (services run natively, not via docker-compose)
# - Uses config/config-cursor-cloud.json instead of config/config.json
# - Enterprise repo at ../../enterprise (if present)
#
# Usage:
#   make cursor-cloud-setup-config       # Generate the Cloud Agent config
#   make cursor-cloud-run-server         # Run the server
#   make cursor-cloud-test-server        # Run all server tests
#   make cursor-cloud-test-server-quick  # Run short tests only
#   make cursor-cloud-setup-admin        # Create admin user and default team (run after server starts)

CURSOR_CLOUD_CONFIG := config/config-cursor-cloud.json

# -----------------------------------------------
# Setup: generate the Cloud Agent config file
# -----------------------------------------------
.PHONY: cursor-cloud-setup-config
cursor-cloud-setup-config:
	@echo "Generating Cloud Agent config at $(CURSOR_CLOUD_CONFIG)..."
	@if [ ! -f ./config/config.json ]; then \
		echo "Error: config/config.json not found. Run 'make config-reset' first."; \
		exit 1; \
	fi
	@cp ./config/config.json $(CURSOR_CLOUD_CONFIG)
	@jq '.ServiceSettings.SiteURL = "http://localhost:8065" | .ServiceSettings.ListenAddress = ":8065" | .ServiceSettings.EnableLocalMode = true | .ServiceSettings.LocalModeSocketLocation = "/var/tmp/mattermost_cursor_cloud.sock" | .SqlSettings.DriverName = "postgres" | .SqlSettings.DataSource = "postgres://mmuser:mostest@localhost:5432/mattermost_test?sslmode=disable&connect_timeout=10" | .LogSettings.EnableConsole = true | .LogSettings.ConsoleLevel = "INFO" | .LogSettings.EnableSentry = false | .LogSettings.EnableDiagnostics = false | .FileSettings.Directory = "./data/" | .PluginSettings.Directory = "./plugins" | .PluginSettings.ClientDirectory = "./client/plugins" | .PluginSettings.EnableUploads = true | .ElasticsearchSettings.EnableIndexing = false | .ElasticsearchSettings.EnableSearching = false | .LdapSettings.Enable = false | .LdapSettings.EnableSync = false' $(CURSOR_CLOUD_CONFIG) > $(CURSOR_CLOUD_CONFIG).tmp && mv $(CURSOR_CLOUD_CONFIG).tmp $(CURSOR_CLOUD_CONFIG)
	@echo "Cloud Agent config ready: $(CURSOR_CLOUD_CONFIG)"

# -----------------------------------------------
# Run prereqs: setup everything Air needs before
# it can build and run the server.
# -----------------------------------------------
.PHONY: cursor-cloud-run-server-prereqs
cursor-cloud-run-server-prereqs: setup-go-work prepackaged-binaries validate-go-version client
	@echo "Server prerequisites ready (Cloud Agent mode)."
	@echo "Config: $(CURSOR_CLOUD_CONFIG)"
	@if [ ! -f $(CURSOR_CLOUD_CONFIG) ]; then \
		echo "Error: $(CURSOR_CLOUD_CONFIG) not found. Run 'make cursor-cloud-setup-config' first."; \
		exit 1; \
	fi
	mkdir -p $(BUILD_WEBAPP_DIR)/channels/dist/files

# -----------------------------------------------
# Run: start the Mattermost server for Cloud Agent
# (without Air — for manual use or fallback)
# -----------------------------------------------
.PHONY: cursor-cloud-run-server
cursor-cloud-run-server: cursor-cloud-run-server-prereqs
	@echo "Running Mattermost server (Cloud Agent mode)..."
	MM_NO_DOCKER=true \
	MM_CONFIG=$(CURSOR_CLOUD_CONFIG) \
	$(GO) run $(GOFLAGS) -ldflags '$(LDFLAGS)' -tags '$(BUILD_TAGS)' $(PLATFORM_FILES)

# -----------------------------------------------
# Test: run server tests without Docker
# -----------------------------------------------
.PHONY: cursor-cloud-test-server
cursor-cloud-test-server: setup-go-work gotestsum
	@echo "Running server tests (Cloud Agent mode)..."
	MM_NO_DOCKER=true \
	MM_SQLSETTINGS_DATASOURCE="postgres://mmuser:mostest@localhost:5432/mattermost_test?sslmode=disable&connect_timeout=10" \
	MM_SQLSETTINGS_DRIVERNAME=postgres \
	$(GOBIN)/gotestsum --rerun-fails=1 --packages="$(TE_PACKAGES)" -- $(GOFLAGS) -timeout=90m -count=1

# -----------------------------------------------
# Test quick: fast subset of tests (-short flag)
# -----------------------------------------------
.PHONY: cursor-cloud-test-server-quick
cursor-cloud-test-server-quick: setup-go-work gotestsum
	@echo "Running quick server tests (Cloud Agent mode)..."
	MM_NO_DOCKER=true \
	MM_SQLSETTINGS_DATASOURCE="postgres://mmuser:mostest@localhost:5432/mattermost_test?sslmode=disable&connect_timeout=10" \
	MM_SQLSETTINGS_DRIVERNAME=postgres \
	$(GOBIN)/gotestsum --packages="$(TE_PACKAGES)" -- $(GOFLAGS) -short -count=1

# -----------------------------------------------
# Setup admin: create initial admin user and team
# Run AFTER the server is started.
# -----------------------------------------------
.PHONY: cursor-cloud-setup-admin
cursor-cloud-setup-admin:
	@echo "Waiting for server to start..."
	@./scripts/wait-for-system-start.sh
	@echo "Creating admin user..."
	@bin/mmctl user create --email admin@example.com --username admin --password 'Admin@1234' --system-admin --email-verified --local 2>/dev/null || echo "Admin user already exists"
	@echo "Creating default team..."
	@bin/mmctl team create --name dev-team --display-name "Dev Team" --local 2>/dev/null || echo "Team already exists"
	@bin/mmctl team users add dev-team admin --local 2>/dev/null || echo "User already in team"
	@echo "Admin setup complete: username=admin password=Admin@1234"
