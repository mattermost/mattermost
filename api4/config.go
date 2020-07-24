// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"net/http"
	"reflect"
	"strings"

	"github.com/mattermost/mattermost-server/v5/audit"
	"github.com/mattermost/mattermost-server/v5/config"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/utils"
)

func (api *API) InitConfig() {
	api.BaseRoutes.ApiRoot.Handle("/config", api.ApiSessionRequired(getConfig)).Methods("GET")
	api.BaseRoutes.ApiRoot.Handle("/config", api.ApiSessionRequired(updateConfig)).Methods("PUT")
	api.BaseRoutes.ApiRoot.Handle("/config/patch", api.ApiSessionRequired(patchConfig)).Methods("PUT")
	api.BaseRoutes.ApiRoot.Handle("/config/reload", api.ApiSessionRequired(configReload)).Methods("POST")
	api.BaseRoutes.ApiRoot.Handle("/config/client", api.ApiHandler(getClientConfig)).Methods("GET")
	api.BaseRoutes.ApiRoot.Handle("/config/environment", api.ApiSessionRequired(getEnvironmentConfig)).Methods("GET")
}

func getConfig(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionToAny(*c.App.Session(), model.SysconsoleReadPermissions) {
		c.SetPermissionError(model.SysconsoleReadPermissions...)
		return
	}

	auditRec := c.MakeAuditRecord("getConfig", audit.Fail)
	defer c.LogAuditRec(auditRec)

	cfg := c.App.GetSanitizedConfig()

	auditRec.Success()

	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	w.Write([]byte(cfg.ToJson()))
}

func configReload(c *Context, w http.ResponseWriter, r *http.Request) {
	auditRec := c.MakeAuditRecord("configReload", audit.Fail)
	defer c.LogAuditRec(auditRec)

	if !c.App.SessionHasPermissionToAny(*c.App.Session(), model.SysconsoleReadPermissions) {
		c.SetPermissionError(model.SysconsoleReadPermissions...)
		return
	}

	if *c.App.Config().ExperimentalSettings.RestrictSystemAdmin {
		c.Err = model.NewAppError("configReload", "api.restricted_system_admin", nil, "", http.StatusBadRequest)
		return
	}

	c.App.ReloadConfig()

	auditRec.Success()

	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	ReturnStatusOK(w)
}

func MakeConfigSectionToPermissionMap() map[string]*model.Permission {
	sectionToPermission := make(map[string]*model.Permission)

	//environment section
	//Web Server
	sectionToPermission["ServiceSettings.SiteURL"] = model.PERMISSION_WRITE_SYSCONSOLE_ENVIRONMENT
	sectionToPermission["ServiceSettings.ListenAddress"] = model.PERMISSION_WRITE_SYSCONSOLE_ENVIRONMENT
	sectionToPermission["ServiceSettings.Forward80To443"] = model.PERMISSION_WRITE_SYSCONSOLE_ENVIRONMENT
	sectionToPermission["ServiceSettings.ConnectionSecurity"] = model.PERMISSION_WRITE_SYSCONSOLE_ENVIRONMENT
	sectionToPermission["ServiceSettings.TLSCertFile"] = model.PERMISSION_WRITE_SYSCONSOLE_ENVIRONMENT
	sectionToPermission["ServiceSettings.TLSKeyFile"] = model.PERMISSION_WRITE_SYSCONSOLE_ENVIRONMENT
	sectionToPermission["ServiceSettings.UseLetsEncrypt"] = model.PERMISSION_WRITE_SYSCONSOLE_ENVIRONMENT
	sectionToPermission["ServiceSettings.LetsEncryptCertificateCacheFile"] = model.PERMISSION_WRITE_SYSCONSOLE_ENVIRONMENT
	sectionToPermission["ServiceSettings.ReadTimeout"] = model.PERMISSION_WRITE_SYSCONSOLE_ENVIRONMENT
	sectionToPermission["ServiceSettings.WriteTimeout"] = model.PERMISSION_WRITE_SYSCONSOLE_ENVIRONMENT
	sectionToPermission["ServiceSettings.WebserverMode"] = model.PERMISSION_WRITE_SYSCONSOLE_ENVIRONMENT
	sectionToPermission["ServiceSettings.EnableInsecureOutgoingConnections"] = model.PERMISSION_WRITE_SYSCONSOLE_ENVIRONMENT

	//Database
	sectionToPermission["SqlSettings"] = model.PERMISSION_WRITE_SYSCONSOLE_ENVIRONMENT
	sectionToPermission["ServiceSettings.MinimumHashtagLength"] = model.PERMISSION_WRITE_SYSCONSOLE_ENVIRONMENT

	//ElasticSearch
	sectionToPermission["ElasticsearchSettings"] = model.PERMISSION_WRITE_SYSCONSOLE_ENVIRONMENT

	//File Storage
	sectionToPermission["FileSettings"] = model.PERMISSION_WRITE_SYSCONSOLE_ENVIRONMENT

	//Image Proxy
	sectionToPermission["ImageProxySettings"] = model.PERMISSION_WRITE_SYSCONSOLE_ENVIRONMENT

	//SMTP
	sectionToPermission["EmailSettings.SMTPServer"] = model.PERMISSION_WRITE_SYSCONSOLE_ENVIRONMENT
	sectionToPermission["EmailSettings.SMTPPort"] = model.PERMISSION_WRITE_SYSCONSOLE_ENVIRONMENT
	sectionToPermission["EmailSettings.EnableSMTPAuth"] = model.PERMISSION_WRITE_SYSCONSOLE_ENVIRONMENT
	sectionToPermission["EmailSettings.SMTPUsername"] = model.PERMISSION_WRITE_SYSCONSOLE_ENVIRONMENT
	sectionToPermission["EmailSettings.SMTPPassword"] = model.PERMISSION_WRITE_SYSCONSOLE_ENVIRONMENT
	sectionToPermission["EmailSettings.ConnectionSecurity"] = model.PERMISSION_WRITE_SYSCONSOLE_ENVIRONMENT
	sectionToPermission["EmailSettings.SkipServerCertificateVerification"] = model.PERMISSION_WRITE_SYSCONSOLE_ENVIRONMENT
	sectionToPermission["ServiceSettings.EnableSecurityFixAlert"] = model.PERMISSION_WRITE_SYSCONSOLE_ENVIRONMENT

	//Push Notification Server
	sectionToPermission["EmailSettings.SendPushNotifications"] = model.PERMISSION_WRITE_SYSCONSOLE_ENVIRONMENT
	sectionToPermission["TeamSettings.PushNotificationServer"] = model.PERMISSION_WRITE_SYSCONSOLE_ENVIRONMENT
	sectionToPermission["TeamSettings.MaxNotificationsPerChannel"] = model.PERMISSION_WRITE_SYSCONSOLE_ENVIRONMENT

	//High Availability
	sectionToPermission["ClusterSettings"] = model.PERMISSION_WRITE_SYSCONSOLE_ENVIRONMENT

	//Rate Limiting
	sectionToPermission["RateLimitSettings"] = model.PERMISSION_WRITE_SYSCONSOLE_ENVIRONMENT

	//Logging
	sectionToPermission["LogSettings"] = model.PERMISSION_WRITE_SYSCONSOLE_ENVIRONMENT

	//Session Lengths
	sectionToPermission["ServiceSettings.SessionLengthWebInDays"] = model.PERMISSION_WRITE_SYSCONSOLE_ENVIRONMENT
	sectionToPermission["ServiceSettings.SessionLengthMobileInDays"] = model.PERMISSION_WRITE_SYSCONSOLE_ENVIRONMENT
	sectionToPermission["ServiceSettings.SessionLengthSSOInDays"] = model.PERMISSION_WRITE_SYSCONSOLE_ENVIRONMENT
	sectionToPermission["ServiceSettings.SessionCacheInMinutes"] = model.PERMISSION_WRITE_SYSCONSOLE_ENVIRONMENT
	sectionToPermission["ServiceSettings.SessionIdleTimeoutInMinutes"] = model.PERMISSION_WRITE_SYSCONSOLE_ENVIRONMENT

	//Performance Monitoring
	sectionToPermission["MetricsSettings"] = model.PERMISSION_WRITE_SYSCONSOLE_ENVIRONMENT

	//Developer
	sectionToPermission["ServiceSettings.EnableTesting"] = model.PERMISSION_WRITE_SYSCONSOLE_ENVIRONMENT
	sectionToPermission["ServiceSettings.EnableDeveloper"] = model.PERMISSION_WRITE_SYSCONSOLE_ENVIRONMENT
	sectionToPermission["ServiceSettings.AllowedUntrustedInternalConnections"] = model.PERMISSION_WRITE_SYSCONSOLE_ENVIRONMENT

	//Site section
	//Customization
	sectionToPermission["TeamSettings.SiteName"] = model.PERMISSION_WRITE_SYSCONSOLE_SITE
	sectionToPermission["TeamSettings.CustomDescriptionText"] = model.PERMISSION_WRITE_SYSCONSOLE_SITE
	sectionToPermission["TeamSettings.EnableCustomBrand"] = model.PERMISSION_WRITE_SYSCONSOLE_SITE
	sectionToPermission["TeamSettings.CustomBrandText"] = model.PERMISSION_WRITE_SYSCONSOLE_SITE
	sectionToPermission["SupportSettings.HelpLink"] = model.PERMISSION_WRITE_SYSCONSOLE_SITE
	sectionToPermission["SupportSettings.SupportEmail"] = model.PERMISSION_WRITE_SYSCONSOLE_SITE
	sectionToPermission["SupportSettings.TermsOfServiceLink"] = model.PERMISSION_WRITE_SYSCONSOLE_SITE
	sectionToPermission["SupportSettings.PrivacyPolicyLink"] = model.PERMISSION_WRITE_SYSCONSOLE_SITE
	sectionToPermission["SupportSettings.AboutLink"] = model.PERMISSION_WRITE_SYSCONSOLE_SITE
	sectionToPermission["SupportSettings.ReportAProblemLink"] = model.PERMISSION_WRITE_SYSCONSOLE_SITE
	sectionToPermission["NativeAppSettings"] = model.PERMISSION_WRITE_SYSCONSOLE_SITE

	//Localization
	sectionToPermission["LocalizationSettings"] = model.PERMISSION_WRITE_SYSCONSOLE_SITE

	//users and teams
	sectionToPermission["TeamSettings.MaxUsersPerTeam"] = model.PERMISSION_WRITE_SYSCONSOLE_SITE
	sectionToPermission["TeamSettings.MaxChannelsPerTeam"] = model.PERMISSION_WRITE_SYSCONSOLE_SITE
	sectionToPermission["TeamSettings.RestrictDirectMessage"] = model.PERMISSION_WRITE_SYSCONSOLE_SITE
	sectionToPermission["TeamSettings.TeammateNameDisplay"] = model.PERMISSION_WRITE_SYSCONSOLE_SITE
	sectionToPermission["TeamSettings.LockTeammateNameDisplay"] = model.PERMISSION_WRITE_SYSCONSOLE_SITE
	sectionToPermission["TeamSettings.ExperimentalViewArchivedChannels"] = model.PERMISSION_WRITE_SYSCONSOLE_EXPERIMENTAL
	sectionToPermission["PrivacySettings"] = model.PERMISSION_WRITE_SYSCONSOLE_SITE

	//Notifications
	sectionToPermission["TeamSettings.EnableConfirmNotificationsToChannel"] = model.PERMISSION_WRITE_SYSCONSOLE_SITE
	sectionToPermission["EmailSettings.SendEmailNotifications"] = model.PERMISSION_WRITE_SYSCONSOLE_SITE
	sectionToPermission["EmailSettings.EnablePreviewModeBanner"] = model.PERMISSION_WRITE_SYSCONSOLE_SITE
	sectionToPermission["EmailSettings.EnableEmailBatching"] = model.PERMISSION_WRITE_SYSCONSOLE_SITE
	sectionToPermission["EmailSettings.EmailNotificationContentsType"] = model.PERMISSION_WRITE_SYSCONSOLE_SITE
	sectionToPermission["EmailSettings.FeedbackName"] = model.PERMISSION_WRITE_SYSCONSOLE_SITE
	sectionToPermission["EmailSettings.FeedbackEmail"] = model.PERMISSION_WRITE_SYSCONSOLE_SITE
	sectionToPermission["EmailSettings.ReplyToAddress"] = model.PERMISSION_WRITE_SYSCONSOLE_SITE
	sectionToPermission["EmailSettings.PushNotificationContents"] = model.PERMISSION_WRITE_SYSCONSOLE_SITE

	//Announcement Banner
	sectionToPermission["AnnouncementSettings"] = model.PERMISSION_WRITE_SYSCONSOLE_SITE

	//Emojis
	sectionToPermission["ServiceSettings.EnableEmojiPicker"] = model.PERMISSION_WRITE_SYSCONSOLE_SITE
	sectionToPermission["ServiceSettings.EnableCustomEmoji"] = model.PERMISSION_WRITE_SYSCONSOLE_SITE

	//Posts
	sectionToPermission["ServiceSettings.EnableLinkPreviews"] = model.PERMISSION_WRITE_SYSCONSOLE_SITE
	sectionToPermission["ServiceSettings.EnableSVGs"] = model.PERMISSION_WRITE_SYSCONSOLE_SITE
	sectionToPermission["ServiceSettings.EnableLatex"] = model.PERMISSION_WRITE_SYSCONSOLE_SITE
	sectionToPermission["DisplaySettings.CustomUrlSchemes"] = model.PERMISSION_WRITE_SYSCONSOLE_SITE
	sectionToPermission["ServiceSettings.GoogleDeveloperKey"] = model.PERMISSION_WRITE_SYSCONSOLE_SITE

	//File Sharing
	sectionToPermission["FileSettings.EnableFileAttachments"] = model.PERMISSION_WRITE_SYSCONSOLE_SITE
	sectionToPermission["FileSettings.EnableMobileUpload"] = model.PERMISSION_WRITE_SYSCONSOLE_SITE
	sectionToPermission["FileSettings.EnableMobileDownload"] = model.PERMISSION_WRITE_SYSCONSOLE_SITE

	//Public Links
	sectionToPermission["FileSettings.EnablePublicLink"] = model.PERMISSION_WRITE_SYSCONSOLE_SITE
	sectionToPermission["FileSettings.PublicLinkSalt"] = model.PERMISSION_WRITE_SYSCONSOLE_SITE

	//authentication section
	//Signup
	sectionToPermission["TeamSettings.EnableUserCreation"] = model.PERMISSION_WRITE_SYSCONSOLE_AUTHENTICATION
	sectionToPermission["TeamSettings.RestrictCreationToDomains"] = model.PERMISSION_WRITE_SYSCONSOLE_AUTHENTICATION
	sectionToPermission["TeamSettings.EnableOpenServer"] = model.PERMISSION_WRITE_SYSCONSOLE_AUTHENTICATION
	sectionToPermission["TeamSettings.EnableEmailInvitations"] = model.PERMISSION_WRITE_SYSCONSOLE_AUTHENTICATION

	//Email Authentication
	sectionToPermission["EmailSettings.EnableSignUpWithEmail"] = model.PERMISSION_WRITE_SYSCONSOLE_AUTHENTICATION
	sectionToPermission["EmailSettings.EnableSignInWithEmail"] = model.PERMISSION_WRITE_SYSCONSOLE_AUTHENTICATION
	sectionToPermission["EmailSettings.EnableSignInWithUsername"] = model.PERMISSION_WRITE_SYSCONSOLE_AUTHENTICATION
	sectionToPermission["EmailSettings.RequireEmailVerification"] = model.PERMISSION_WRITE_SYSCONSOLE_AUTHENTICATION

	//Password
	sectionToPermission["PasswordSettings"] = model.PERMISSION_WRITE_SYSCONSOLE_AUTHENTICATION
	sectionToPermission["ServiceSettings.MaximumLoginAttempts"] = model.PERMISSION_WRITE_SYSCONSOLE_AUTHENTICATION

	//MFA
	sectionToPermission["ServiceSettings.EnableMultifactorAuthentication"] = model.PERMISSION_WRITE_SYSCONSOLE_AUTHENTICATION
	sectionToPermission["ServiceSettings.EnforceMultifactorAuthentication"] = model.PERMISSION_WRITE_SYSCONSOLE_AUTHENTICATION

	//AD/LDAP
	sectionToPermission["LdapSettings"] = model.PERMISSION_WRITE_SYSCONSOLE_AUTHENTICATION

	//SAML 2.0
	sectionToPermission["SamlSettings"] = model.PERMISSION_WRITE_SYSCONSOLE_AUTHENTICATION

	//Gitlab
	sectionToPermission["GitLabSettings"] = model.PERMISSION_WRITE_SYSCONSOLE_AUTHENTICATION

	//OAuth 2.0
	sectionToPermission["GoogleSettings"] = model.PERMISSION_WRITE_SYSCONSOLE_AUTHENTICATION
	sectionToPermission["Office365Settings"] = model.PERMISSION_WRITE_SYSCONSOLE_AUTHENTICATION

	//Guest Access
	sectionToPermission["GuestAccountsSettings"] = model.PERMISSION_WRITE_SYSCONSOLE_AUTHENTICATION
	//TODO: AllowEmailAccounts

	//plugin settings
	sectionToPermission["PluginSettings"] = model.PERMISSION_WRITE_SYSCONSOLE_PLUGINS

	//integrations section
	//Integration Management
	sectionToPermission["ServiceSettings.EnableIncomingWebhooks"] = model.PERMISSION_WRITE_SYSCONSOLE_INTEGRATIONS
	sectionToPermission["ServiceSettings.EnableOutgoingWebhooks"] = model.PERMISSION_WRITE_SYSCONSOLE_INTEGRATIONS

	sectionToPermission["ServiceSettings.EnableCommands"] = model.PERMISSION_WRITE_SYSCONSOLE_INTEGRATIONS
	sectionToPermission["ServiceSettings.EnableOAuthServiceProvider"] = model.PERMISSION_WRITE_SYSCONSOLE_INTEGRATIONS

	sectionToPermission["ServiceSettings.EnablePostUsernameOverride"] = model.PERMISSION_WRITE_SYSCONSOLE_INTEGRATIONS
	sectionToPermission["ServiceSettings.EnablePostIconOverride"] = model.PERMISSION_WRITE_SYSCONSOLE_INTEGRATIONS

	//TODO: sectionToPermission["ServiceSettings.EnableOnlyAdminIntegrations"] = model.PERMISSION_WRITE_SYSCONSOLE_INTEGRATIONS
	sectionToPermission["ServiceSettings.EnableUserAccessTokens"] = model.PERMISSION_WRITE_SYSCONSOLE_INTEGRATIONS

	//Bot Accounts
	sectionToPermission["ServiceSettings.DisableBotsWhenOwnerIsDeactivated"] = model.PERMISSION_WRITE_SYSCONSOLE_INTEGRATIONS
	sectionToPermission["ServiceSettings.EnableBotAccountCreation"] = model.PERMISSION_WRITE_SYSCONSOLE_INTEGRATIONS

	//GIF
	sectionToPermission["ServiceSettings.EnableGifPicker"] = model.PERMISSION_WRITE_SYSCONSOLE_INTEGRATIONS
	sectionToPermission["ServiceSettings.GfycatApiKey"] = model.PERMISSION_WRITE_SYSCONSOLE_INTEGRATIONS
	sectionToPermission["ServiceSettings.GfycatApiSecret"] = model.PERMISSION_WRITE_SYSCONSOLE_INTEGRATIONS

	//CORS
	sectionToPermission["ServiceSettings.AllowCorsFrom"] = model.PERMISSION_WRITE_SYSCONSOLE_INTEGRATIONS
	sectionToPermission["ServiceSettings.CorsExposedHeaders"] = model.PERMISSION_WRITE_SYSCONSOLE_INTEGRATIONS
	sectionToPermission["ServiceSettings.CorsAllowCredentials"] = model.PERMISSION_WRITE_SYSCONSOLE_INTEGRATIONS
	sectionToPermission["ServiceSettings.CorsDebug"] = model.PERMISSION_WRITE_SYSCONSOLE_INTEGRATIONS

	//compliance section
	//Data retention policy
	sectionToPermission["DataRetentionSettings"] = model.PERMISSION_WRITE_SYSCONSOLE_COMPLIANCE

	//Compliance export
	sectionToPermission["MessageExportSettings"] = model.PERMISSION_WRITE_SYSCONSOLE_COMPLIANCE

	//Compliance monitoring
	sectionToPermission["ComplianceSettings"] = model.PERMISSION_WRITE_SYSCONSOLE_COMPLIANCE

	//Custom Terms of Service
	sectionToPermission["SupportSettings.CustomTermsOfServiceEnabled"] = model.PERMISSION_WRITE_SYSCONSOLE_COMPLIANCE
	sectionToPermission["SupportSettings.CustomTermsOfServiceReAcceptancePeriod"] = model.PERMISSION_WRITE_SYSCONSOLE_COMPLIANCE

	//experimental section
	sectionToPermission["ExperimentalAuditSettings"] = model.PERMISSION_WRITE_SYSCONSOLE_EXPERIMENTAL

	sectionToPermission["ServiceSettings.ExperimentalEnableAuthenticationTransfer"] = model.PERMISSION_WRITE_SYSCONSOLE_EXPERIMENTAL
	sectionToPermission["ServiceSettings.ExperimentalEnableDefaultChannelLeaveJoinMessages"] = model.PERMISSION_WRITE_SYSCONSOLE_EXPERIMENTAL
	sectionToPermission["ServiceSettings.ExperimentalGroupUnreadChannels"] = model.PERMISSION_WRITE_SYSCONSOLE_EXPERIMENTAL
	sectionToPermission["ServiceSettings.ExperimentalChannelOrganization"] = model.PERMISSION_WRITE_SYSCONSOLE_EXPERIMENTAL
	sectionToPermission["ServiceSettings.ExperimentalChannelSidebarOrganization"] = model.PERMISSION_WRITE_SYSCONSOLE_EXPERIMENTAL
	sectionToPermission["ServiceSettings.ExperimentalEnableHardenedMode"] = model.PERMISSION_WRITE_SYSCONSOLE_EXPERIMENTAL
	sectionToPermission["ServiceSettings.ExperimentalStrictCSRFEnforcement"] = model.PERMISSION_WRITE_SYSCONSOLE_EXPERIMENTAL
	sectionToPermission["ServiceSettings.DisplaySettings.ExperimentalTimezone"] = model.PERMISSION_WRITE_SYSCONSOLE_EXPERIMENTAL

	sectionToPermission["TeamSettings.ExperimentalEnableAutomaticReplies"] = model.PERMISSION_WRITE_SYSCONSOLE_EXPERIMENTAL
	sectionToPermission["TeamSettings.ExperimentalHideTownSquareinLHS"] = model.PERMISSION_WRITE_SYSCONSOLE_EXPERIMENTAL
	sectionToPermission["TeamSettings.ExperimentalTownSquareIsReadOnly"] = model.PERMISSION_WRITE_SYSCONSOLE_EXPERIMENTAL
	sectionToPermission["TeamSettings.ExperimentalPrimaryTeam"] = model.PERMISSION_WRITE_SYSCONSOLE_EXPERIMENTAL
	sectionToPermission["TeamSettings.ExperimentalDefaultChannels"] = model.PERMISSION_WRITE_SYSCONSOLE_EXPERIMENTAL

	sectionToPermission["DisplaySettings.ExperimentalTimezone"] = model.PERMISSION_WRITE_SYSCONSOLE_EXPERIMENTAL

	sectionToPermission["TeamSettings.EnableXToLeaveChannelsFromLHS"] = model.PERMISSION_WRITE_SYSCONSOLE_EXPERIMENTAL

	sectionToPermission["ExperimentalSettings"] = model.PERMISSION_WRITE_SYSCONSOLE_EXPERIMENTAL
	return sectionToPermission
}

func ConfigSettingsWhiteList() map[string]string {
	whiteList := make(map[string]string)
	whiteList["ThemeSettings"] = "ThemeSettings"
	whiteList["AnalyticsSettings"] = "AnalyticsSettings"
	whiteList["JobSettings"] = "JobSettings"
	whiteList["ClientRequirements"] = "ClientRequirements"
	whiteList["NotificationLogSettings"] = "NotificationLogSettings"

	return whiteList
}

func updateConfig(c *Context, w http.ResponseWriter, r *http.Request) {
	cfg := model.ConfigFromJson(r.Body)
	if cfg == nil {
		c.SetInvalidParam("config")
		return
	}

	auditRec := c.MakeAuditRecord("updateConfig", audit.Fail)
	defer c.LogAuditRec(auditRec)

	cfg.SetDefaults()

	if !c.App.SessionHasPermissionToAny(*c.App.Session(), model.SysconsoleWritePermissions) {
		c.SetPermissionError(model.SysconsoleWritePermissions...)
		return
	}

	appCfg := c.App.Config()
	if *appCfg.ServiceSettings.SiteURL != "" && *cfg.ServiceSettings.SiteURL == "" {
		c.Err = model.NewAppError("updateConfig", "api.config.update_config.clear_siteurl.app_error", nil, "", http.StatusBadRequest)
		return
	}

	var err1 error
	cfg, err1 = config.Merge(appCfg, cfg, &utils.MergeConfig{
		StructFieldFilter: func(structField reflect.StructField, base, patch reflect.Value, parentStructFieldName string) bool {
			return filterConfigByPermission(c, structField, parentStructFieldName)
		},
	})
	if err1 != nil {
		c.Err = model.NewAppError("updateConfig", "api.config.update_config.restricted_merge.app_error", nil, err1.Error(), http.StatusInternalServerError)
	}

	// Do not allow plugin uploads to be toggled through the API
	cfg.PluginSettings.EnableUploads = appCfg.PluginSettings.EnableUploads

	// Do not allow certificates to be changed through the API
	cfg.PluginSettings.SignaturePublicKeyFiles = appCfg.PluginSettings.SignaturePublicKeyFiles

	c.App.HandleMessageExportConfig(cfg, appCfg)

	err := cfg.IsValid()
	if err != nil {
		c.Err = err
		return
	}

	err = c.App.SaveConfig(cfg, true)
	if err != nil {
		c.Err = err
		return
	}

	cfg = c.App.GetSanitizedConfig()

	auditRec.Success()
	c.LogAudit("updateConfig")

	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	w.Write([]byte(cfg.ToJson()))
}

func filterConfigByPermission(c *Context, structField reflect.StructField, parentStructFieldName string) bool {
	path := parentStructFieldName

	if _, ok := ConfigSettingsWhiteList()[path]; ok {
		return true
	}
	if parentStructFieldName != "" {
		path = parentStructFieldName + "." + structField.Name
	}
	if path != "" {
		permission := MakeConfigSectionToPermissionMap()[path]

		if permission == nil {
			pathComponents := strings.SplitN(path, ".", -1)
			if len(pathComponents) > 0 {
				permission = MakeConfigSectionToPermissionMap()[pathComponents[0]]
			}
		}

		if permission != nil {
			if !c.App.SessionHasPermissionTo(*c.App.Session(), permission) {
				return false
			}
		}

		if *c.App.Config().ExperimentalSettings.RestrictSystemAdmin {
			restricted := structField.Tag.Get("restricted") == "true"
			return !restricted
		}
	}
	return true
}

func getClientConfig(c *Context, w http.ResponseWriter, r *http.Request) {
	format := r.URL.Query().Get("format")

	if format == "" {
		c.Err = model.NewAppError("getClientConfig", "api.config.client.old_format.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	if format != "old" {
		c.SetInvalidParam("format")
		return
	}

	var config map[string]string
	if len(c.App.Session().UserId) == 0 {
		config = c.App.LimitedClientConfigWithComputed()
	} else {
		config = c.App.ClientConfigWithComputed()
	}

	w.Write([]byte(model.MapToJson(config)))
}

func getEnvironmentConfig(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_READ_SYSCONSOLE_ENVIRONMENT) {
		c.SetPermissionError(model.PERMISSION_READ_SYSCONSOLE_ENVIRONMENT)
		return
	}

	envConfig := c.App.GetEnvironmentConfig()

	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	w.Write([]byte(model.StringInterfaceToJson(envConfig)))
}

func patchConfig(c *Context, w http.ResponseWriter, r *http.Request) {
	cfg := model.ConfigFromJson(r.Body)
	if cfg == nil {
		c.SetInvalidParam("config")
		return
	}

	auditRec := c.MakeAuditRecord("patchConfig", audit.Fail)
	defer c.LogAuditRec(auditRec)

	if !c.App.SessionHasPermissionToAny(*c.App.Session(), model.SysconsoleReadPermissions) {
		c.SetPermissionError(model.SysconsoleReadPermissions...)
		return
	}

	appCfg := c.App.Config()
	if *appCfg.ServiceSettings.SiteURL != "" && *cfg.ServiceSettings.SiteURL == "" {
		c.Err = model.NewAppError("patchConfig", "api.config.update_config.clear_siteurl.app_error", nil, "", http.StatusBadRequest)
		return
	}

	filterFn := func(structField reflect.StructField, base, patch reflect.Value, parentStructFieldName string) bool {
		return filterConfigByPermission(c, structField, parentStructFieldName)
	}

	// Do not allow plugin uploads to be toggled through the API
	cfg.PluginSettings.EnableUploads = appCfg.PluginSettings.EnableUploads

	if cfg.MessageExportSettings.EnableExport != nil {
		c.App.HandleMessageExportConfig(cfg, appCfg)
	}

	updatedCfg, mergeErr := config.Merge(appCfg, cfg, &utils.MergeConfig{
		StructFieldFilter: filterFn,
	})

	if mergeErr != nil {
		c.Err = model.NewAppError("patchConfig", "api.config.update_config.restricted_merge.app_error", nil, mergeErr.Error(), http.StatusInternalServerError)
		return
	}

	err := updatedCfg.IsValid()
	if err != nil {
		c.Err = err
		return
	}

	err = c.App.SaveConfig(updatedCfg, true)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()

	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	w.Write([]byte(c.App.GetSanitizedConfig().ToJson()))
}
