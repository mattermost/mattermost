dist: | check-style test package

build-linux: build-linux-amd64 build-linux-arm64

build-linux-amd64:
	@echo Build Linux amd64
ifeq ($(BUILDER_GOOS_GOARCH),"linux_amd64")
	env GOOS=linux GOARCH=amd64 $(GO) build -o $(GOBIN) $(GOFLAGS) -trimpath -tags production -ldflags '$(LDFLAGS)' ./...
else
	mkdir -p $(GOBIN)/linux_amd64
	env GOOS=linux GOARCH=amd64 $(GO) build -o $(GOBIN)/linux_amd64 $(GOFLAGS) -trimpath -tags production -ldflags '$(LDFLAGS)' ./...
endif

build-linux-arm64:
	@echo Build Linux arm64
ifeq ($(BUILDER_GOOS_GOARCH),"linux_arm64")
	env GOOS=linux GOARCH=arm64 $(GO) build -o $(GOBIN) $(GOFLAGS) -trimpath -tags production -ldflags '$(LDFLAGS)' ./...
else
	mkdir -p $(GOBIN)/linux_arm64
	env GOOS=linux GOARCH=arm64 $(GO) build -o $(GOBIN)/linux_arm64 $(GOFLAGS) -trimpath -tags production -ldflags '$(LDFLAGS)' ./...
endif

build-osx:
	@echo Build OSX amd64
ifeq ($(BUILDER_GOOS_GOARCH),"darwin_amd64")
	env GOOS=darwin GOARCH=amd64 $(GO) build -o $(GOBIN) $(GOFLAGS) -trimpath -tags production -ldflags '$(LDFLAGS)' ./...
else
	mkdir -p $(GOBIN)/darwin_amd64
	env GOOS=darwin GOARCH=amd64 $(GO) build -o $(GOBIN)/darwin_amd64 $(GOFLAGS) -trimpath -tags production -ldflags '$(LDFLAGS)' ./...
endif
	@echo Build OSX arm64
ifeq ($(BUILDER_GOOS_GOARCH),"darwin_arm64")
	env GOOS=darwin GOARCH=arm64 $(GO) build -o $(GOBIN) $(GOFLAGS) -trimpath -tags production -ldflags '$(LDFLAGS)' ./...
else
	mkdir -p $(GOBIN)/darwin_arm64
	env GOOS=darwin GOARCH=arm64 $(GO) build -o $(GOBIN)/darwin_arm64 $(GOFLAGS) -trimpath -tags production -ldflags '$(LDFLAGS)' ./...
endif

build-windows:
	@echo Build Windows amd64
ifeq ($(BUILDER_GOOS_GOARCH),"windows_amd64")
	env GOOS=windows GOARCH=amd64 $(GO) build -o $(GOBIN) $(GOFLAGS) -trimpath -tags production -ldflags '$(LDFLAGS)' ./...
else
	mkdir -p $(GOBIN)/windows_amd64
	env GOOS=windows GOARCH=amd64 $(GO) build -o $(GOBIN)/windows_amd64 $(GOFLAGS) -trimpath -tags production -ldflags '$(LDFLAGS)' ./...
endif

build-cmd-linux:
	@echo Build CMD Linux amd64
ifeq ($(BUILDER_GOOS_GOARCH),"linux_amd64")
	env GOOS=linux GOARCH=amd64 $(GO) build -o $(GOBIN) $(GOFLAGS) -trimpath -tags production -ldflags '$(LDFLAGS)' ./cmd/...
else
	mkdir -p $(GOBIN)/linux_amd64
	env GOOS=linux GOARCH=amd64 $(GO) build -o $(GOBIN)/linux_amd64 $(GOFLAGS) -trimpath -tags production -ldflags '$(LDFLAGS)' ./cmd/...
endif
	@echo Build CMD Linux arm64
ifeq ($(BUILDER_GOOS_GOARCH),"linux_arm64")
	env GOOS=linux GOARCH=arm64 $(GO) build -o $(GOBIN) $(GOFLAGS) -trimpath -tags production -ldflags '$(LDFLAGS)' ./cmd/...
else
	mkdir -p $(GOBIN)/linux_arm64
	env GOOS=linux GOARCH=arm64 $(GO) build -o $(GOBIN)/linux_arm64 $(GOFLAGS) -trimpath -tags production -ldflags '$(LDFLAGS)' ./cmd/...
endif

build-cmd-osx:
	@echo Build CMD OSX amd64
ifeq ($(BUILDER_GOOS_GOARCH),"darwin_amd64")
	env GOOS=darwin GOARCH=amd64 $(GO) build -o $(GOBIN) $(GOFLAGS) -trimpath -tags production -ldflags '$(LDFLAGS)' ./cmd/...
else
	mkdir -p $(GOBIN)/darwin_amd64
	env GOOS=darwin GOARCH=amd64 $(GO) build -o $(GOBIN)/darwin_amd64 $(GOFLAGS) -trimpath -tags production -ldflags '$(LDFLAGS)' ./cmd/...
endif
	@echo Build CMD OSX arm64
ifeq ($(BUILDER_GOOS_GOARCH),"darwin_arm64")
	env GOOS=darwin GOARCH=arm64 $(GO) build -o $(GOBIN) $(GOFLAGS) -trimpath -tags production -ldflags '$(LDFLAGS)' ./cmd/...
else
	mkdir -p $(GOBIN)/darwin_arm64
	env GOOS=darwin GOARCH=arm64 $(GO) build -o $(GOBIN)/darwin_arm64 $(GOFLAGS) -trimpath -tags production -ldflags '$(LDFLAGS)' ./cmd/...
endif

build-cmd-windows:
	@echo Build CMD Windows amd64
ifeq ($(BUILDER_GOOS_GOARCH),"windows_amd64")
	env GOOS=windows GOARCH=amd64 $(GO) build -o $(GOBIN) $(GOFLAGS) -trimpath -tags production -ldflags '$(LDFLAGS)' ./cmd/...
else
	mkdir -p $(GOBIN)/windows_amd64
	env GOOS=windows GOARCH=amd64 $(GO) build -o $(GOBIN)/windows_amd64 $(GOFLAGS) -trimpath -tags production -ldflags '$(LDFLAGS)' ./cmd/...
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

	@# Import Mattermost plugin public key
	gpg --import build/plugin-production-public-key.gpg

	@# Download prepackaged plugins
	mkdir -p tmpprepackaged
	@cd tmpprepackaged && for plugin_package in $(PLUGIN_PACKAGES) ; do \
		for ARCH in "osx-amd64" "windows-amd64" "linux-amd64" ; do \
			curl -f -O -L https://plugins-store.test.mattermost.com/release/$$plugin_package-$$ARCH.tar.gz; \
			curl -f -O -L https://plugins-store.test.mattermost.com/release/$$plugin_package-$$ARCH.tar.gz.sig; \
		done; \
	done

package-general:
	@# Create needed directories
	mkdir -p $(DIST_PATH_GENERIC)/bin
	mkdir -p $(DIST_PATH_GENERIC)/logs
	mkdir -p $(DIST_PATH_GENERIC)/prepackaged_plugins

	@# Copy binaries
ifeq ($(BUILDER_GOOS_GOARCH),"$(CURRENT_PACKAGE_ARCH)")
	cp $(GOBIN)/$(MM_BIN_NAME) $(GOBIN)/$(MMCTL_BIN_NAME) $(DIST_PATH_GENERIC)/bin # from native bin dir, not cross-compiled
else
	cp $(GOBIN)/$(CURRENT_PACKAGE_ARCH)/$(MM_BIN_NAME) $(GOBIN)/$(CURRENT_PACKAGE_ARCH)/$(MMCTL_BIN_NAME) $(DIST_PATH_GENERIC)/bin # from cross-compiled bin dir
endif

ifeq ("darwin_arm64","$(CURRENT_PACKAGE_ARCH)")
	echo "No plugins yet for $(CURRENT_PACKAGE_ARCH) platform, skipping..."
else ifeq ("linux_arm64","$(CURRENT_PACKAGE_ARCH)")
	echo "No plugins yet for $(CURRENT_PACKAGE_ARCH) platform, skipping..."
else
	@# Prepackage plugins
	@for plugin_package in $(PLUGIN_PACKAGES) ; do \
		ARCH=$(PLUGIN_ARCH); \
		if [ "$$ARCH" != "linux-amd64" ]; then \
			case $$plugin_package in \
				"mattermost-plugin-calls"*) continue ;; \
			esac; \
		fi; \
		cp tmpprepackaged/$$plugin_package-$$ARCH.tar.gz $(DIST_PATH_GENERIC)/prepackaged_plugins; \
		cp tmpprepackaged/$$plugin_package-$$ARCH.tar.gz.sig $(DIST_PATH_GENERIC)/prepackaged_plugins; \
		HAS_ARCH=`tar -tf $(DIST_PATH_GENERIC)/prepackaged_plugins/$$plugin_package-$$ARCH.tar.gz | grep -oE "dist/plugin-.*"`; \
		if [ "$$HAS_ARCH" != "dist/plugin-$(subst _,-,$(CURRENT_PACKAGE_ARCH))" ]; then \
			echo "Contains $$HAS_ARCH in $$plugin_package-$$ARCH.tar.gz but needs dist/plugin-$(subst _,-,$(CURRENT_PACKAGE_ARCH))"; \
			exit 1; \
		fi; \
		gpg --verify $(DIST_PATH_GENERIC)/prepackaged_plugins/$$plugin_package-$$ARCH.tar.gz.sig $(DIST_PATH_GENERIC)/prepackaged_plugins/$$plugin_package-$$ARCH.tar.gz; \
		if [ $$? -ne 0 ]; then \
			echo "Failed to verify $$plugin_package-$$ARCH.tar.gz|$$plugin_package-$$ARCH.tar.gz.sig"; \
			exit 1; \
		fi; \
	done
endif

package-osx-amd64: package-prep
	DIST_PATH_GENERIC=$(DIST_PATH_OSX_AMD64) CURRENT_PACKAGE_ARCH=darwin_amd64 PLUGIN_ARCH=osx-amd64 MMCTL_PLATFORM="Darwin-x86_64" MM_BIN_NAME=mattermost MMCTL_BIN_NAME=mmctl $(MAKE) package-general
	@# Package
	tar -C $(DIST_PATH_OSX_AMD64)/.. -czf $(DIST_PATH)-$(BUILD_TYPE_NAME)-osx-amd64.tar.gz mattermost ../mattermost
	@# Cleanup
	rm -rf $(DIST_ROOT)/osx_amd64

package-osx-arm64: package-prep
	DIST_PATH_GENERIC=$(DIST_PATH_OSX_ARM64) CURRENT_PACKAGE_ARCH=darwin_arm64 PLUGIN_ARCH=osx-arm64 MMCTL_PLATFORM="Darwin-arm64" MM_BIN_NAME=mattermost MMCTL_BIN_NAME=mmctl $(MAKE) package-general
	@# Package
	tar -C $(DIST_PATH_OSX_ARM64)/.. -czf $(DIST_PATH)-$(BUILD_TYPE_NAME)-osx-arm64.tar.gz mattermost ../mattermost
	@# Cleanup
	rm -rf $(DIST_ROOT)/osx_arm64

package-osx: package-osx-amd64 package-osx-arm64

package-linux-amd64: package-prep
	DIST_PATH_GENERIC=$(DIST_PATH_LIN_AMD64) CURRENT_PACKAGE_ARCH=linux_amd64 PLUGIN_ARCH=linux-amd64 MMCTL_PLATFORM="Linux-x86_64" MM_BIN_NAME=mattermost MMCTL_BIN_NAME=mmctl $(MAKE) package-general
	@# Package
	tar -C $(DIST_PATH_LIN_AMD64)/.. -czf $(DIST_PATH)-$(BUILD_TYPE_NAME)-linux-amd64.tar.gz mattermost ../mattermost
	@# Cleanup
	rm -rf $(DIST_ROOT)/linux_amd64

package-linux-arm64: package-prep
	DIST_PATH_GENERIC=$(DIST_PATH_LIN_ARM64) CURRENT_PACKAGE_ARCH=linux_arm64 PLUGIN_ARCH=linux-arm64 MMCTL_PLATFORM="Linux-aarch64" MM_BIN_NAME=mattermost MMCTL_BIN_NAME=mmctl $(MAKE) package-general
	@# Package
	tar -C $(DIST_PATH_LIN_ARM64)/.. -czf $(DIST_PATH)-$(BUILD_TYPE_NAME)-linux-arm64.tar.gz mattermost ../mattermost
	@# Cleanup
	rm -rf $(DIST_ROOT)/linux_arm64

package-linux: package-linux-amd64 package-linux-arm64

package-windows: package-prep
	@# Create needed directories
	mkdir -p $(DIST_PATH_WIN)/bin
	mkdir -p $(DIST_PATH_WIN)/logs
	mkdir -p $(DIST_PATH_WIN)/prepackaged_plugins

	@# Copy binary
ifeq ($(BUILDER_GOOS_GOARCH),"windows_amd64")
	cp $(GOBIN)/mattermost.exe $(GOBIN)/mmctl.exe $(DIST_PATH_WIN)/bin # from native bin dir, not cross-compiled
else
	cp $(GOBIN)/windows_amd64/mattermost.exe $(GOBIN)/windows_amd64/mmctl.exe $(DIST_PATH_WIN)/bin # from cross-compiled bin dir
endif
	@# Prepackage plugins
	@for plugin_package in $(PLUGIN_PACKAGES) ; do \
		ARCH="windows-amd64"; \
		case $$plugin_package in \
			"mattermost-plugin-calls"*) continue ;; \
		esac; \
		cp tmpprepackaged/$$plugin_package-$$ARCH.tar.gz $(DIST_PATH_WIN)/prepackaged_plugins; \
		cp tmpprepackaged/$$plugin_package-$$ARCH.tar.gz.sig $(DIST_PATH_WIN)/prepackaged_plugins; \
		HAS_ARCH=`tar -tf $(DIST_PATH_WIN)/prepackaged_plugins/$$plugin_package-$$ARCH.tar.gz | grep -oE "dist/plugin-.*"`; \
		if [ "$$HAS_ARCH" != "dist/plugin-windows-amd64.exe" ]; then \
			echo "Contains $$HAS_ARCH in $$plugin_package-$$ARCH.tar.gz but needs dist/plugin-windows-amd64.exe"; \
			exit 1; \
		fi; \
		gpg --verify $(DIST_PATH_WIN)/prepackaged_plugins/$$plugin_package-$$ARCH.tar.gz.sig $(DIST_PATH_WIN)/prepackaged_plugins/$$plugin_package-$$ARCH.tar.gz; \
		if [ $$? -ne 0 ]; then \
			echo "Failed to verify $$plugin_package-$$ARCH.tar.gz|$$plugin_package-$$ARCH.tar.gz.sig"; \
			exit 1; \
		fi; \
	done
	@# Package
	cd $(DIST_PATH_WIN)/.. && zip -9 -r -q -l ../mattermost-$(BUILD_TYPE_NAME)-windows-amd64.zip mattermost ../mattermost && cd ../..
	@# Cleanup
	rm -rf $(DIST_ROOT)/windows

package: package-osx package-linux package-windows
	rm -rf tmpprepackaged
	rm -rf $(DIST_PATH)
