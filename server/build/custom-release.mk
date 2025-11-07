ifneq ($(origin CUSTOMIZE_SOURCE_DIR), undefined)
	$(error CUSTOMIZE_SOURCE_DIR is already set (origin=$(origin CUSTOMIZE_SOURCE_DIR)))
endif

CUSTOMIZE_SOURCE_DIR = $(BUILD_WEBAPP_DIR)/channels/dist

customize-assets:
	@echo "🚀 Starting customize-assets"
	@echo "CUSTOM_SERVICE_NAME = $(CUSTOM_SERVICE_NAME)"
	@echo "CUSTOM_PLATFORM_NAME = $(CUSTOM_PLATFORM_NAME)"
	@echo "CUSTOM_JP_PLATFORM_NAME = $(CUSTOM_JP_PLATFORM_NAME)"
	@echo "CUSTOMIZE_SOURCE_DIR = $(CUSTOMIZE_SOURCE_DIR)"

	@echo "replacing service and platform names in i18n files..."
	sed -i'' -e '/"about\.notice"/!{ /"about\.copyright"/!s/Mattermost/$(CUSTOM_JP_PLATFORM_NAME)/g; }' $(CUSTOMIZE_SOURCE_DIR)/i18n/ja.*.json
	sed -i'' -e 's/GitLab/$(CUSTOM_SERVICE_NAME)/g' -e 's/{service}/$(CUSTOM_SERVICE_NAME)/g' -e '/"about\.notice"/!{ /"about\.copyright"/!s/Mattermost/$(CUSTOM_PLATFORM_NAME)/g; }' $(CUSTOMIZE_SOURCE_DIR)/i18n/*.json
	sed -i'' -e 's/Mattermost/$(CUSTOM_JP_PLATFORM_NAME)/g' i18n/ja.json
	sed -i'' -e 's/{{.Service}}/$(CUSTOM_SERVICE_NAME)/g' -e 's/Mattermost/$(CUSTOM_PLATFORM_NAME)/g' i18n/*.json

	@echo "removing GitLab icon from login screen..."
	icon_str='"svg",{width:"[0-9]\+",height:"[0-9]\+",viewBox:"0 0 [0-9]\+ [0-9]\+",fill:"none",xmlns:"http:\/\/www.w3.org\/2000\/svg","aria-label":t({id:"generic_icons.login.gitlab",defaultMessage:"Gitlab Icon"})}'; \
	echo "icon_str: $${icon_str}"; \
	grep -l "$${icon_str}" $(CUSTOMIZE_SOURCE_DIR)/*.js | while read -r file; do \
		if [ -n "$${file}" ]; then \
			echo "-> Found file: $${file}. Modifying content..."; \
			sed -i'' \
				-e "s|$${icon_str}|\"span\",{}|g" \
				-e 's/external-login-button-label//g' \
				"$${file}"; \
		else \
			echo "::error title=Removing GitLab icon Error::GitLab icon pattern not found."; \
			exit 1; \
		fi; \
	done;

	@echo "hiding Mattermost logo at the top left..."
	hfroute_header='o().createElement("div",{className:c()("hfroute-header",{"has-free-banner":r,"has-custom-site-name":b})}'; \
	echo "hfroute_header: $${hfroute_header}"; \
	grep -l "$${hfroute_header}" $(CUSTOMIZE_SOURCE_DIR)/*.js | while read -r file_hfroute_header; do \
		if [ -n "$${file_hfroute_header}" ]; then \
			echo "-> Found file: $${file_hfroute_header}. Modifying content..."; \
			hidden_hfroute_header='o().createElement("div",{className:c()("hfroute-header",{"has-free-banner":r,"has-custom-site-name":b}),style:{visibility:"hidden"}}'; \
			sed -i'' -e "s|$${hfroute_header}|$${hidden_hfroute_header}|g" "$${file_hfroute_header}"; \
		else \
			echo "::error title=Hiding Mattermost logo Error::hfroute-header not found."; \
			exit 1; \
		fi; \
	done

	@echo "hiding loading screen icon..."
	echo ".LoadingAnimation__compass { display: none; }" >> $(CUSTOMIZE_SOURCE_DIR)/css/initial_loading_screen.css

	@echo "✅ Completed customize-assets"
