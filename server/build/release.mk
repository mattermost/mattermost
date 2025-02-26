dist: | check-style test package

build-linux: build-linux-amd64 build-linux-arm64

build-linux-amd64:
	@echo Build Linux amd64
ifeq ($(BUILDER_GOOS_GOARCH),"linux_amd64")
	env GOOS=linux GOARCH=amd64 $(GO) build -o $(GOBIN) $(GOFLAGS) -trimpath -tags '$(BUILD_TAGS) production' -ldflags '$(LDFLAGS)' ./...
else
	mkdir -p $(GOBIN)/linux_amd64
	env GOOS=linux GOARCH=amd64 $(GO) build -o $(GOBIN)/linux_amd64 $(GOFLAGS) -trimpath -tags '$(BUILD_TAGS) production' -ldflags '$(LDFLAGS)' ./...
endif

build-linux-arm64:
	@echo Build Linux arm64
ifeq ($(BUILDER_GOOS_GOARCH),"linux_arm64")
	env GOOS=linux GOARCH=arm64 $(GO) build -o $(GOBIN) $(GOFLAGS) -trimpath -tags '$(BUILD_TAGS) production' -ldflags '$(LDFLAGS)' ./...
else
	mkdir -p $(GOBIN)/linux_arm64
	env GOOS=linux GOARCH=arm64 $(GO) build -o $(GOBIN)/linux_arm64 $(GOFLAGS) -trimpath -tags '$(BUILD_TAGS) production' -ldflags '$(LDFLAGS)' ./...
endif

build-osx:
	@echo Build OSX amd64
ifeq ($(BUILDER_GOOS_GOARCH),"darwin_amd64")
	env GOOS=darwin GOARCH=amd64 $(GO) build -o $(GOBIN) $(GOFLAGS) -trimpath -tags '$(BUILD_TAGS) production' -ldflags '$(LDFLAGS)' ./...
else
	mkdir -p $(GOBIN)/darwin_amd64
	env GOOS=darwin GOARCH=amd64 $(GO) build -o $(GOBIN)/darwin_amd64 $(GOFLAGS) -trimpath -tags '$(BUILD_TAGS) production' -ldflags '$(LDFLAGS)' ./...
endif
	@echo Build OSX arm64
ifeq ($(BUILDER_GOOS_GOARCH),"darwin_arm64")
	env GOOS=darwin GOARCH=arm64 $(GO) build -o $(GOBIN) $(GOFLAGS) -trimpath -tags '$(BUILD_TAGS) production' -ldflags '$(LDFLAGS)' ./...
else
	mkdir -p $(GOBIN)/darwin_arm64
	env GOOS=darwin GOARCH=arm64 $(GO) build -o $(GOBIN)/darwin_arm64 $(GOFLAGS) -trimpath -tags '$(BUILD_TAGS) production' -ldflags '$(LDFLAGS)' ./...
endif

build-windows:
	@echo Build Windows amd64
ifeq ($(BUILDER_GOOS_GOARCH),"windows_amd64")
	env GOOS=windows GOARCH=amd64 $(GO) build -o $(GOBIN) $(GOFLAGS) -trimpath -tags '$(BUILD_TAGS) production' -ldflags '$(LDFLAGS)' ./...
else
	mkdir -p $(GOBIN)/windows_amd64
	env GOOS=windows GOARCH=amd64 $(GO) build -o $(GOBIN)/windows_amd64 $(GOFLAGS) -trimpath -tags '$(BUILD_TAGS) production' -ldflags '$(LDFLAGS)' ./...
endif

build-cmd-linux:
	@echo Build CMD Linux amd64
ifeq ($(BUILDER_GOOS_GOARCH),"linux_amd64")
	env GOOS=linux GOARCH=amd64 $(GO) build -o $(GOBIN) $(GOFLAGS) -trimpath -tags '$(BUILD_TAGS) production' -ldflags '$(LDFLAGS)' ./cmd/...
else
	mkdir -p $(GOBIN)/linux_amd64
	env GOOS=linux GOARCH=amd64 $(GO) build -o $(GOBIN)/linux_amd64 $(GOFLAGS) -trimpath -tags '$(BUILD_TAGS) production' -ldflags '$(LDFLAGS)' ./cmd/...
endif
	@echo Build CMD Linux arm64
ifeq ($(BUILDER_GOOS_GOARCH),"linux_arm64")
	env GOOS=linux GOARCH=arm64 $(GO) build -o $(GOBIN) $(GOFLAGS) -trimpath -tags '$(BUILD_TAGS) production' -ldflags '$(LDFLAGS)' ./cmd/...
else
	mkdir -p $(GOBIN)/linux_arm64
	env GOOS=linux GOARCH=arm64 $(GO) build -o $(GOBIN)/linux_arm64 $(GOFLAGS) -trimpath -tags '$(BUILD_TAGS) production' -ldflags '$(LDFLAGS)' ./cmd/...
endif

build-cmd-osx:
	@echo Build CMD OSX amd64
ifeq ($(BUILDER_GOOS_GOARCH),"darwin_amd64")
	env GOOS=darwin GOARCH=amd64 $(GO) build -o $(GOBIN) $(GOFLAGS) -trimpath -tags '$(BUILD_TAGS) production' -ldflags '$(LDFLAGS)' ./cmd/...
else
	mkdir -p $(GOBIN)/darwin_amd64
	env GOOS=darwin GOARCH=amd64 $(GO) build -o $(GOBIN)/darwin_amd64 $(GOFLAGS) -trimpath -tags '$(BUILD_TAGS) production' -ldflags '$(LDFLAGS)' ./cmd/...
endif
	@echo Build CMD OSX arm64
ifeq ($(BUILDER_GOOS_GOARCH),"darwin_arm64")
	env GOOS=darwin GOARCH=arm64 $(GO) build -o $(GOBIN) $(GOFLAGS) -trimpath -tags '$(BUILD_TAGS) production' -ldflags '$(LDFLAGS)' ./cmd/...
else
	mkdir -p $(GOBIN)/darwin_arm64
	env GOOS=darwin GOARCH=arm64 $(GO) build -o $(GOBIN)/darwin_arm64 $(GOFLAGS) -trimpath -tags '$(BUILD_TAGS) production' -ldflags '$(LDFLAGS)' ./cmd/...
endif

build-cmd-windows:
	@echo Build CMD Windows amd64
ifeq ($(BUILDER_GOOS_GOARCH),"windows_amd64")
	env GOOS=windows GOARCH=amd64 $(GO) build -o $(GOBIN) $(GOFLAGS) -trimpath -tags '$(BUILD_TAGS) production' -ldflags '$(LDFLAGS)' ./cmd/...
else
	mkdir -p $(GOBIN)/windows_amd64
	env GOOS=windows GOARCH=amd64 $(GO) build -o $(GOBIN)/windows_amd64 $(GOFLAGS) -trimpath -tags '$(BUILD_TAGS) production' -ldflags '$(LDFLAGS)' ./cmd/...
endif

build: setup-go-work build-client build-linux build-windows build-osx

build-cmd: setup-go-work build-client build-cmd-linux build-cmd-windows build-cmd-osx

build-client:
	@echo Building mattermost web app

	cd $(BUILD_WEBAPP_DIR) && $(MAKE) dist

package-prep:
	@ echo Packaging mattermost
	@# Remove any old files
	rm -Rf $(DIST_ROOT)

	@# Resource directories
	mkdir -p $(DIST_PATH)/config
	cp -L config/README.md $(DIST_PATH)/config
	OUTPUT_CONFIG=$(PWD)/$(DIST_PATH)/config/config.json go run ./scripts/config_generator
	cp -RL fonts $(DIST_PATH)
	cp -RL templates $(DIST_PATH)
	rm -rf $(DIST_PATH)/templates/*.mjml $(DIST_PATH)/templates/partials/
	cp -RL i18n $(DIST_PATH)

	@# Disable developer settings
	sed -i'' -e 's|"ConsoleLevel": "DEBUG"|"ConsoleLevel": "INFO"|g' $(DIST_PATH)/config/config.json
	sed -i'' -e 's|"SiteURL": "http://localhost:8065"|"SiteURL": ""|g' $(DIST_PATH)/config/config.json

	@# Reset email sending to original configuration
	sed -i'' -e 's|"SendEmailNotifications": true,|"SendEmailNotifications": false,|g' $(DIST_PATH)/config/config.json
	sed -i'' -e 's|"FeedbackEmail": "test@example.com",|"FeedbackEmail": "",|g' $(DIST_PATH)/config/config.json
	sed -i'' -e 's|"ReplyToAddress": "test@example.com",|"ReplyToAddress": "",|g' $(DIST_PATH)/config/config.json
	sed -i'' -e 's|"SMTPServer": "localhost",|"SMTPServer": "",|g' $(DIST_PATH)/config/config.json
	sed -i'' -e 's|"SMTPPort": "2500",|"SMTPPort": "",|g' $(DIST_PATH)/config/config.json
	chmod 600 $(DIST_PATH)/config/config.json

	@# Package web app
	mkdir -p $(DIST_PATH)/client
	cp -RL $(BUILD_WEBAPP_DIR)/channels/dist/* $(DIST_PATH)/client

	@# Help files
ifeq ($(BUILD_ENTERPRISE_READY),true)
	cp $(BUILD_ENTERPRISE_DIR)/ENTERPRISE-EDITION-LICENSE.txt $(DIST_PATH)
	cp -L $(BUILD_ENTERPRISE_DIR)/cloud/config/cloud_defaults.json $(DIST_PATH)/config
else
	cp build/MIT-COMPILED-LICENSE.md $(DIST_PATH)
endif
	cp ../NOTICE.txt $(DIST_PATH)
	cp ../README.md $(DIST_PATH)
	if [ -f bin/manifest.txt ]; then \
		cp bin/manifest.txt $(DIST_PATH); \
	fi

fetch-prepackaged-plugins:
	@# Import Mattermost plugin public key
	gpg --import build/plugin-production-public-key.gpg
	@# Download prepackaged plugins
	mkdir -p tmpprepackaged
	@echo "Downloading prepackaged plugins ... "
	@cd tmpprepackaged && for plugin_package in $(PLUGIN_PACKAGES) ; do \
		curl -f -O -L https://plugins.releases.mattermost.com/release/$$plugin_package-$(PLUGIN_ARCH).tar.gz; \
		curl -f -O -L https://plugins.releases.mattermost.com/release/$$plugin_package-$(PLUGIN_ARCH).tar.gz.sig; \
	done
	@echo "Done"

package-general:
	@# Create needed directories
	mkdir -p $(DIST_PATH_GENERIC)/bin
	mkdir -p $(DIST_PATH_GENERIC)/logs

	@# Copy binaries
ifeq ($(BUILDER_GOOS_GOARCH),"$(CURRENT_PACKAGE_ARCH)")
	cp $(GOBIN)/$(MM_BIN_NAME) $(GOBIN)/$(MMCTL_BIN_NAME) $(DIST_PATH_GENERIC)/bin # from native bin dir, not cross-compiled
else
	cp $(GOBIN)/$(CURRENT_PACKAGE_ARCH)/$(MM_BIN_NAME) $(GOBIN)/$(CURRENT_PACKAGE_ARCH)/$(MMCTL_BIN_NAME) $(DIST_PATH_GENERIC)/bin # from cross-compiled bin dir
endif

package-plugins: fetch-prepackaged-plugins
	@# Create needed directories
	mkdir -p $(DIST_PATH_GENERIC)/prepackaged_plugins

	@# Prepackage plugins
	@for plugin_package in $(PLUGIN_PACKAGES) ; do \
		ARCH=$(PLUGIN_ARCH); \
		cp tmpprepackaged/$$plugin_package-$$ARCH.tar.gz $(DIST_PATH_GENERIC)/prepackaged_plugins; \
		cp tmpprepackaged/$$plugin_package-$$ARCH.tar.gz.sig $(DIST_PATH_GENERIC)/prepackaged_plugins; \
		gpg --verify $(DIST_PATH_GENERIC)/prepackaged_plugins/$$plugin_package-$$ARCH.tar.gz.sig $(DIST_PATH_GENERIC)/prepackaged_plugins/$$plugin_package-$$ARCH.tar.gz; \
		if [ $$? -ne 0 ]; then \
			echo "Failed to verify $$plugin_package-$$ARCH.tar.gz|$$plugin_package-$$ARCH.tar.gz.sig"; \
			exit 1; \
		fi; \
	done

package-osx-amd64: package-prep
	DIST_PATH_GENERIC=$(DIST_PATH_OSX_AMD64) CURRENT_PACKAGE_ARCH=darwin_amd64 MM_BIN_NAME=mattermost MMCTL_BIN_NAME=mmctl $(MAKE) package-general
	@# Package
	tar -C $(DIST_PATH_OSX_AMD64)/.. -czf $(DIST_PATH)-$(BUILD_TYPE_NAME)-darwin-amd64.tar.gz mattermost ../mattermost
	@# Cleanup
	rm -rf $(DIST_ROOT)/darwin_amd64

package-osx-arm64: package-prep
	DIST_PATH_GENERIC=$(DIST_PATH_OSX_ARM64) CURRENT_PACKAGE_ARCH=darwin_arm64 MM_BIN_NAME=mattermost MMCTL_BIN_NAME=mmctl $(MAKE) package-general
	@# Package
	tar -C $(DIST_PATH_OSX_ARM64)/.. -czf $(DIST_PATH)-$(BUILD_TYPE_NAME)-darwin-arm64.tar.gz mattermost ../mattermost
	@# Cleanup
	rm -rf $(DIST_ROOT)/darwin_arm64

package-osx: package-osx-amd64 package-osx-arm64

package-linux-amd64: package-prep
	DIST_PATH_GENERIC=$(DIST_PATH_LIN_AMD64) PLUGIN_ARCH=linux-amd64 $(MAKE) package-plugins
	DIST_PATH_GENERIC=$(DIST_PATH_LIN_AMD64) CURRENT_PACKAGE_ARCH=linux_amd64 MM_BIN_NAME=mattermost MMCTL_BIN_NAME=mmctl $(MAKE) package-general
	@# Package
	tar -C $(DIST_PATH_LIN_AMD64)/.. -czf $(DIST_PATH)-$(BUILD_TYPE_NAME)-linux-amd64.tar.gz mattermost ../mattermost
	@# Cleanup
	rm -rf $(DIST_ROOT)/linux_amd64

package-linux-arm64: package-prep
	DIST_PATH_GENERIC=$(DIST_PATH_LIN_ARM64) CURRENT_PACKAGE_ARCH=linux_arm64 MM_BIN_NAME=mattermost MMCTL_BIN_NAME=mmctl $(MAKE) package-general
	@# Package
	tar -C $(DIST_PATH_LIN_ARM64)/.. -czf $(DIST_PATH)-$(BUILD_TYPE_NAME)-linux-arm64.tar.gz mattermost ../mattermost
	@# Cleanup
	rm -rf $(DIST_ROOT)/linux_arm64

package-linux: package-linux-amd64 package-linux-arm64

package-windows: package-prep
	DIST_PATH_GENERIC=$(DIST_PATH_WIN) CURRENT_PACKAGE_ARCH=windows_amd64 MM_BIN_NAME=mattermost.exe MMCTL_BIN_NAME=mmctl.exe $(MAKE) package-general
	@# Package
	cd $(DIST_PATH_WIN)/.. && zip -9 -r -q -l ../mattermost-$(BUILD_TYPE_NAME)-windows-amd64.zip mattermost ../mattermost && cd ../..
	@# Cleanup
	rm -rf $(DIST_ROOT)/windows

package: package-linux package-osx
	rm -rf tmpprepackaged
	rm -rf $(DIST_PATH)
