// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package telemetry

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	rudder "github.com/rudderlabs/analytics-go"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/shared/httpservice"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
	"github.com/mattermost/mattermost/server/v8/platform/services/marketplace"
	"github.com/mattermost/mattermost/server/v8/platform/services/searchengine"
)

const (
	DayMilliseconds     = 24 * 60 * 60 * 1000
	MonthMilliseconds   = 31 * DayMilliseconds
	DBAccessAttempts    = 3
	DBAccessTimeoutSecs = 10

	rudderDataplaneURL = "https://pdat.matterlytics.com"
	rudderKeyProd      = "1aoejPqhgONMI720CsBSRWzzRQ9"
	rudderKeyTest      = "1aoeoCDeh7OCHcbW2kseWlwUFyq"

	// These are placeholders to allow the existing release pipelines to run without failing to
	// insert the values that are now hard-coded above. Remove this once we converge on the
	// unified delivery pipeline in GitHub.
	_ = "placeholder_rudder_dataplane_url"
	_ = "placeholder_rudder_key"

	EnvVarInstallType = "MM_INSTALL_TYPE"

	TrackConfigService             = "config_service"
	TrackConfigTeam                = "config_team"
	TrackConfigClientReq           = "config_client_requirements"
	TrackConfigSQL                 = "config_sql"
	TrackConfigLog                 = "config_log"
	TrackConfigAudit               = "config_audit"
	TrackConfigNotificationLog     = "config_notifications_log"
	TrackConfigFile                = "config_file"
	TrackConfigRate                = "config_rate"
	TrackConfigEmail               = "config_email"
	TrackConfigPrivacy             = "config_privacy"
	TrackConfigTheme               = "config_theme"
	TrackConfigOAuth               = "config_oauth"
	TrackConfigLDAP                = "config_ldap"
	TrackConfigCompliance          = "config_compliance"
	TrackConfigLocalization        = "config_localization"
	TrackConfigSAML                = "config_saml"
	TrackConfigPassword            = "config_password"
	TrackConfigCluster             = "config_cluster"
	TrackConfigMetrics             = "config_metrics"
	TrackConfigSupport             = "config_support"
	TrackConfigNativeApp           = "config_nativeapp"
	TrackConfigExperimental        = "config_experimental"
	TrackConfigAnalytics           = "config_analytics"
	TrackConfigAnnouncement        = "config_announcement"
	TrackConfigElasticsearch       = "config_elasticsearch"
	TrackConfigPlugin              = "config_plugin"
	TrackConfigDataRetention       = "config_data_retention"
	TrackConfigMessageExport       = "config_message_export"
	TrackConfigDisplay             = "config_display"
	TrackConfigGuestAccounts       = "config_guest_accounts"
	TrackConfigImageProxy          = "config_image_proxy"
	TrackConfigBleve               = "config_bleve"
	TrackConfigExport              = "config_export"
	TrackConfigWrangler            = "config_wrangler"
	TrackConfigConnectedWorkspaces = "config_connected_workspaces"
	TrackFeatureFlags              = "config_feature_flags"
	TrackPermissionsGeneral        = "permissions_general"
	TrackPermissionsSystemScheme   = "permissions_system_scheme"
	TrackPermissionsTeamSchemes    = "permissions_team_schemes"
	TrackPermissionsSystemRoles    = "permissions_system_roles"
	TrackElasticsearch             = "elasticsearch"
	TrackGroups                    = "groups"
	TrackChannelModeration         = "channel_moderation"

	TrackActivity = "activity"
	TrackLicense  = "license"
	TrackServer   = "server"
	TrackPlugins  = "plugins"
)

type TrackSKU string

const (
	TrackProfessionalSKU TrackSKU = "professional"
	TrackEnterpriseSKU   TrackSKU = "enterprise"
)

type TrackFeature string

const (
	TrackGuestFeature          TrackFeature = "guest_accounts"
	TrackGroupsFeature         TrackFeature = "custom_groups"
	TrackReadOnlyFeature       TrackFeature = "read_only_channels"
	TrackSharedChannelsFeature TrackFeature = "shared_channels"
	TrackScheduledPosts        TrackFeature = "scheduled_posts"
)

const (
	TrackPropertyUser       = "user_actual_id"
	TrackPropertyGroup      = "group_id"
	TrackPropertyChannel    = "channel_id"
	TrackPropertyPostAuthor = "post_owner_id"
	TrackPropertyUserAgent  = "user_agent"
)

type ServerIface interface {
	Config() *model.Config
	IsLeader() bool
	HTTPService() httpservice.HTTPService
	GetPluginsEnvironment() *plugin.Environment
	License() *model.License
	GetRoleByName(context.Context, string) (*model.Role, *model.AppError)
	GetSchemes(string, int, int) ([]*model.Scheme, *model.AppError)
}

type TelemetryService struct {
	srv                        ServerIface
	dbStore                    store.Store
	searchEngine               *searchengine.Broker
	log                        *mlog.Logger
	rudderClient               rudder.Client
	TelemetryID                string
	timestampLastTelemetrySent time.Time
	verbose                    bool
}

type RudderConfig struct {
	RudderKey    string
	DataplaneURL string
}

type EventFeature struct {
	Name TrackFeature `json:"name"`
	SKUS []TrackSKU   `json:"skus"`
}

var featureSKUS = map[TrackFeature][]TrackSKU{
	TrackGuestFeature:          {TrackProfessionalSKU, TrackEnterpriseSKU},
	TrackGroupsFeature:         {TrackProfessionalSKU, TrackEnterpriseSKU},
	TrackReadOnlyFeature:       {TrackProfessionalSKU, TrackEnterpriseSKU},
	TrackSharedChannelsFeature: {TrackProfessionalSKU, TrackEnterpriseSKU},
}

func New(srv ServerIface, dbStore store.Store, searchEngine *searchengine.Broker, log *mlog.Logger, verbose bool) (*TelemetryService, error) {
	service := &TelemetryService{
		srv:          srv,
		dbStore:      dbStore,
		searchEngine: searchEngine,
		log:          log,
		verbose:      verbose,
	}

	if err := service.ensureTelemetryID(); err != nil {
		return nil, fmt.Errorf("unable to ensure telemetry ID: %w", err)
	}

	return service, nil
}

func (ts *TelemetryService) ensureTelemetryID() error {
	if ts.TelemetryID != "" {
		return nil
	}

	id := model.NewId()
	var err error

	for i := 0; i < DBAccessAttempts; i++ {
		ts.log.Info("Ensuring the telemetry ID..")
		systemID := &model.System{Name: model.SystemTelemetryId, Value: id}
		systemID, err = ts.dbStore.System().InsertIfExists(systemID)
		if err != nil {
			ts.log.Info("Unable to get/set the telemetry ID", mlog.Err(err))
			time.Sleep(DBAccessTimeoutSecs * time.Second)
			continue
		}

		ts.TelemetryID = systemID.Value
		ts.log.Info("telemetry ID is set", mlog.String("id", ts.TelemetryID))
		return nil
	}

	return fmt.Errorf("unable to get the telemetry ID: %w", err)
}

func (ts *TelemetryService) getRudderConfig() RudderConfig {
	// Support unit testing
	if os.Getenv("RudderKey") != "" && os.Getenv("RudderDataplaneURL") != "" {
		return RudderConfig{os.Getenv("RudderKey"), os.Getenv("RudderDataplaneURL")}
	}

	rudderKey := ""
	switch model.GetServiceEnvironment() {
	case model.ServiceEnvironmentProduction:
		rudderKey = rudderKeyProd
	case model.ServiceEnvironmentTest:
		rudderKey = rudderKeyTest
	case model.ServiceEnvironmentDev:
	}

	return RudderConfig{rudderKey, rudderDataplaneURL}
}

func (ts *TelemetryService) telemetryEnabled() bool {
	return *ts.srv.Config().LogSettings.EnableDiagnostics && ts.srv.IsLeader()
}

func (ts *TelemetryService) sendDailyTelemetry(override bool) {
	config := ts.getRudderConfig()
	if ts.telemetryEnabled() && ((config.DataplaneURL != "" && config.RudderKey != "") || override) {
		ts.initRudder(config.DataplaneURL, config.RudderKey)
		ts.trackActivity()
		ts.trackConfig()
		ts.trackLicense()
		ts.trackPlugins()
		ts.trackServer()
		ts.trackPermissions()
		ts.trackElasticsearch()
		ts.trackGroups()
		ts.trackChannelModeration()
	}
}

func (ts *TelemetryService) SendTelemetry(event string, properties map[string]any) {
	if ts.rudderClient != nil {
		var context *rudder.Context
		// if we are part of a cloud installation, add its ID to the tracked event's context
		if installationId := os.Getenv("MM_CLOUD_INSTALLATION_ID"); installationId != "" {
			context = &rudder.Context{Traits: map[string]any{"installationId": installationId}}
		}
		err := ts.rudderClient.Enqueue(rudder.Track{
			Event:      event,
			UserId:     ts.TelemetryID,
			Properties: properties,
			Context:    context,
		})
		if err != nil {
			ts.log.Warn("Error sending telemetry", mlog.Err(err))
		}
	}
}

func (ts *TelemetryService) SendTelemetryForFeature(featureName TrackFeature, event string, properties map[string]any) {
	if ts.rudderClient != nil {
		skus, ok := featureSKUS[featureName]
		if !ok {
			skus = []TrackSKU{}
			mlog.Warn("Telemetry SKUS are not defined for the feature", mlog.String("feature", featureName))
		}
		feature := EventFeature{
			Name: featureName,
			SKUS: skus,
		}

		var context *rudder.Context = &rudder.Context{
			Extra: map[string]any{"feature": feature},
		}
		// if we are part of a cloud installation, add its ID to the tracked event's context
		if installationId := os.Getenv("MM_CLOUD_INSTALLATION_ID"); installationId != "" {
			context.Traits = map[string]any{"installationId": installationId}
		}

		err := ts.rudderClient.Enqueue(rudder.Track{
			Event:      event,
			UserId:     ts.TelemetryID,
			Properties: properties,
			Context:    context,
		})
		if err != nil {
			ts.log.Warn("Error sending telemetry for feature", mlog.Err(err))
		}
	}
}

func isDefaultArray(setting, defaultValue []string) bool {
	if len(setting) != len(defaultValue) {
		return false
	}
	for i := 0; i < len(setting); i++ {
		if setting[i] != defaultValue[i] {
			return false
		}
	}
	return true
}

func isDefault(setting any, defaultValue any) bool {
	return setting == defaultValue
}

func pluginSetting(pluginSettings *model.PluginSettings, plugin, key string, defaultValue any) any {
	settings, ok := pluginSettings.Plugins[plugin]
	if !ok {
		return defaultValue
	}
	if value, ok := settings[key]; ok {
		return value
	}
	return defaultValue
}

func pluginActivated(pluginStates map[string]*model.PluginState, pluginId string) bool {
	state, ok := pluginStates[pluginId]
	if !ok {
		return false
	}
	return state.Enable
}

func pluginVersion(pluginsAvailable []*model.BundleInfo, pluginId string) string {
	for _, plugin := range pluginsAvailable {
		if plugin.Manifest != nil && plugin.Manifest.Id == pluginId {
			return plugin.Manifest.Version
		}
	}
	return ""
}

func (ts *TelemetryService) trackActivity() {
	var userCount int64
	var guestAccountsCount int64
	var botAccountsCount int64
	var inactiveUserCount int64
	var publicChannelCount int64
	var privateChannelCount int64
	var directChannelCount int64
	var deletedPublicChannelCount int64
	var deletedPrivateChannelCount int64
	var postsCount int64
	var postsCountPreviousDay int64
	var botPostsCountPreviousDay int64
	var slashCommandsCount int64
	var incomingWebhooksCount int64
	var outgoingWebhooksCount int64

	activeUsersDailyCountChan := make(chan store.StoreResult[int64], 1)
	go func() {
		count, err := ts.dbStore.User().AnalyticsActiveCount(DayMilliseconds, model.UserCountOptions{IncludeBotAccounts: false, IncludeDeleted: false})
		activeUsersDailyCountChan <- store.StoreResult[int64]{Data: count, NErr: err}
		close(activeUsersDailyCountChan)
	}()

	activeUsersMonthlyCountChan := make(chan store.StoreResult[int64], 1)
	go func() {
		count, err := ts.dbStore.User().AnalyticsActiveCount(MonthMilliseconds, model.UserCountOptions{IncludeBotAccounts: false, IncludeDeleted: false})
		activeUsersMonthlyCountChan <- store.StoreResult[int64]{Data: count, NErr: err}
		close(activeUsersMonthlyCountChan)
	}()

	if count, err := ts.dbStore.User().Count(model.UserCountOptions{IncludeDeleted: true}); err == nil {
		userCount = count
	}

	if count, err := ts.dbStore.User().AnalyticsGetGuestCount(); err == nil {
		guestAccountsCount = count
	}

	if count, err := ts.dbStore.User().Count(model.UserCountOptions{IncludeBotAccounts: true, ExcludeRegularUsers: true}); err == nil {
		botAccountsCount = count
	}

	if iucr, err := ts.dbStore.User().AnalyticsGetInactiveUsersCount(); err == nil {
		inactiveUserCount = iucr
	}

	teamCount, err := ts.dbStore.Team().AnalyticsTeamCount(nil)
	if err != nil {
		mlog.Info("Could not get team count", mlog.Err(err))
	}

	if ucc, err := ts.dbStore.Channel().AnalyticsTypeCount("", model.ChannelTypeOpen); err == nil {
		publicChannelCount = ucc
	}

	if pcc, err := ts.dbStore.Channel().AnalyticsTypeCount("", model.ChannelTypePrivate); err == nil {
		privateChannelCount = pcc
	}

	if dcc, err := ts.dbStore.Channel().AnalyticsTypeCount("", model.ChannelTypeDirect); err == nil {
		directChannelCount = dcc
	}

	if duccr, err := ts.dbStore.Channel().AnalyticsDeletedTypeCount("", model.ChannelTypeOpen); err == nil {
		deletedPublicChannelCount = duccr
	}

	if dpccr, err := ts.dbStore.Channel().AnalyticsDeletedTypeCount("", model.ChannelTypePrivate); err == nil {
		deletedPrivateChannelCount = dpccr
	}

	postsCount, _ = ts.dbStore.Post().AnalyticsPostCount(&model.PostCountOptions{})

	postCountsOptions := &model.AnalyticsPostCountsOptions{TeamId: "", BotsOnly: false, YesterdayOnly: true}
	postCountsYesterday, _ := ts.dbStore.Post().AnalyticsPostCountsByDay(postCountsOptions)
	postsCountPreviousDay = 0
	if len(postCountsYesterday) > 0 {
		postsCountPreviousDay = int64(postCountsYesterday[0].Value)
	}

	postCountsOptions = &model.AnalyticsPostCountsOptions{TeamId: "", BotsOnly: true, YesterdayOnly: true}
	botPostCountsYesterday, _ := ts.dbStore.Post().AnalyticsPostCountsByDay(postCountsOptions)
	botPostsCountPreviousDay = 0
	if len(botPostCountsYesterday) > 0 {
		botPostsCountPreviousDay = int64(botPostCountsYesterday[0].Value)
	}

	slashCommandsCount, _ = ts.dbStore.Command().AnalyticsCommandCount("")

	if c, err := ts.dbStore.Webhook().AnalyticsIncomingCount("", ""); err == nil {
		incomingWebhooksCount = c
	}

	outgoingWebhooksCount, _ = ts.dbStore.Webhook().AnalyticsOutgoingCount("")

	var activeUsersDailyCount int64
	if r := <-activeUsersDailyCountChan; r.NErr == nil {
		activeUsersDailyCount = r.Data
	}

	var activeUsersMonthlyCount int64
	if r := <-activeUsersMonthlyCountChan; r.NErr == nil {
		activeUsersMonthlyCount = r.Data
	}

	activity := map[string]any{
		"registered_users":             userCount,
		"bot_accounts":                 botAccountsCount,
		"guest_accounts":               guestAccountsCount,
		"active_users_daily":           activeUsersDailyCount,
		"active_users_monthly":         activeUsersMonthlyCount,
		"registered_deactivated_users": inactiveUserCount,
		"teams":                        teamCount,
		"public_channels":              publicChannelCount,
		"private_channels":             privateChannelCount,
		"direct_message_channels":      directChannelCount,
		"public_channels_deleted":      deletedPublicChannelCount,
		"private_channels_deleted":     deletedPrivateChannelCount,
		"posts_previous_day":           postsCountPreviousDay,
		"bot_posts_previous_day":       botPostsCountPreviousDay,
		"posts":                        postsCount,
		"slash_commands":               slashCommandsCount,
		"incoming_webhooks":            incomingWebhooksCount,
		"outgoing_webhooks":            outgoingWebhooksCount,
	}

	if license := ts.srv.License(); license.IsCloud() {
		var tmpStorage int64
		if usage, err := ts.dbStore.FileInfo().GetStorageUsage(true, false); err == nil {
			tmpStorage = usage
		}
		activity["storage_bytes"] = utils.RoundOffToZeroesResolution(float64(tmpStorage), 8)
	}

	ts.SendTelemetry(TrackActivity, activity)
}

func (ts *TelemetryService) trackConfig() {
	cfg := ts.srv.Config()
	ts.SendTelemetry(TrackConfigService, map[string]any{
		"web_server_mode":                                         *cfg.ServiceSettings.WebserverMode,
		"enable_security_fix_alert":                               *cfg.ServiceSettings.EnableSecurityFixAlert,
		"enable_insecure_outgoing_connections":                    *cfg.ServiceSettings.EnableInsecureOutgoingConnections,
		"enable_incoming_webhooks":                                cfg.ServiceSettings.EnableIncomingWebhooks,
		"enable_outgoing_webhooks":                                cfg.ServiceSettings.EnableOutgoingWebhooks,
		"enable_outgoing_oauth_connections":                       cfg.ServiceSettings.EnableOutgoingOAuthConnections,
		"enable_commands":                                         *cfg.ServiceSettings.EnableCommands,
		"outgoing_integrations_requests_timeout":                  cfg.ServiceSettings.OutgoingIntegrationRequestsTimeout,
		"enable_post_username_override":                           cfg.ServiceSettings.EnablePostUsernameOverride,
		"enable_post_icon_override":                               cfg.ServiceSettings.EnablePostIconOverride,
		"enable_user_access_tokens":                               *cfg.ServiceSettings.EnableUserAccessTokens,
		"enable_custom_emoji":                                     *cfg.ServiceSettings.EnableCustomEmoji,
		"enable_emoji_picker":                                     *cfg.ServiceSettings.EnableEmojiPicker,
		"enable_gif_picker":                                       *cfg.ServiceSettings.EnableGifPicker,
		"experimental_enable_authentication_transfer":             *cfg.ServiceSettings.ExperimentalEnableAuthenticationTransfer,
		"enable_testing":                                          cfg.ServiceSettings.EnableTesting,
		"enable_developer":                                        *cfg.ServiceSettings.EnableDeveloper,
		"developer_flags":                                         isDefault(*cfg.ServiceSettings.DeveloperFlags, model.ServiceSettingsDefaultDeveloperFlags),
		"enable_client_performance_debugging":                     *cfg.ServiceSettings.EnableClientPerformanceDebugging,
		"enable_multifactor_authentication":                       *cfg.ServiceSettings.EnableMultifactorAuthentication,
		"enforce_multifactor_authentication":                      *cfg.ServiceSettings.EnforceMultifactorAuthentication,
		"enable_oauth_service_provider":                           cfg.ServiceSettings.EnableOAuthServiceProvider,
		"connection_security":                                     *cfg.ServiceSettings.ConnectionSecurity,
		"tls_strict_transport":                                    *cfg.ServiceSettings.TLSStrictTransport,
		"uses_letsencrypt":                                        *cfg.ServiceSettings.UseLetsEncrypt,
		"forward_80_to_443":                                       *cfg.ServiceSettings.Forward80To443,
		"maximum_login_attempts":                                  *cfg.ServiceSettings.MaximumLoginAttempts,
		"extend_session_length_with_activity":                     *cfg.ServiceSettings.ExtendSessionLengthWithActivity,
		"terminate_sessions_on_password_change":                   *cfg.ServiceSettings.TerminateSessionsOnPasswordChange,
		"session_length_web_in_hours":                             *cfg.ServiceSettings.SessionLengthWebInHours,
		"session_length_mobile_in_hours":                          *cfg.ServiceSettings.SessionLengthMobileInHours,
		"session_length_sso_in_hours":                             *cfg.ServiceSettings.SessionLengthSSOInHours,
		"session_cache_in_minutes":                                *cfg.ServiceSettings.SessionCacheInMinutes,
		"session_idle_timeout_in_minutes":                         *cfg.ServiceSettings.SessionIdleTimeoutInMinutes,
		"isdefault_site_url":                                      isDefault(*cfg.ServiceSettings.SiteURL, model.ServiceSettingsDefaultSiteURL),
		"isdefault_tls_cert_file":                                 isDefault(*cfg.ServiceSettings.TLSCertFile, model.ServiceSettingsDefaultTLSCertFile),
		"isdefault_tls_key_file":                                  isDefault(*cfg.ServiceSettings.TLSKeyFile, model.ServiceSettingsDefaultTLSKeyFile),
		"isdefault_read_timeout":                                  isDefault(*cfg.ServiceSettings.ReadTimeout, model.ServiceSettingsDefaultReadTimeout),
		"isdefault_write_timeout":                                 isDefault(*cfg.ServiceSettings.WriteTimeout, model.ServiceSettingsDefaultWriteTimeout),
		"isdefault_idle_timeout":                                  isDefault(*cfg.ServiceSettings.IdleTimeout, model.ServiceSettingsDefaultIdleTimeout),
		"isdefault_google_developer_key":                          isDefault(cfg.ServiceSettings.GoogleDeveloperKey, ""),
		"isdefault_allow_cors_from":                               isDefault(*cfg.ServiceSettings.AllowCorsFrom, model.ServiceSettingsDefaultAllowCorsFrom),
		"isdefault_cors_exposed_headers":                          isDefault(cfg.ServiceSettings.CorsExposedHeaders, ""),
		"cors_allow_credentials":                                  *cfg.ServiceSettings.CorsAllowCredentials,
		"cors_debug":                                              *cfg.ServiceSettings.CorsDebug,
		"isdefault_allowed_untrusted_internal_connections":        isDefault(*cfg.ServiceSettings.AllowedUntrustedInternalConnections, ""),
		"post_edit_time_limit":                                    *cfg.ServiceSettings.PostEditTimeLimit,
		"enable_user_typing_messages":                             *cfg.ServiceSettings.EnableUserTypingMessages,
		"enable_channel_viewed_messages":                          *cfg.ServiceSettings.EnableChannelViewedMessages,
		"time_between_user_typing_updates_milliseconds":           *cfg.ServiceSettings.TimeBetweenUserTypingUpdatesMilliseconds,
		"cluster_log_timeout_milliseconds":                        *cfg.ServiceSettings.ClusterLogTimeoutMilliseconds,
		"enable_post_search":                                      *cfg.ServiceSettings.EnablePostSearch,
		"minimum_hashtag_length":                                  *cfg.ServiceSettings.MinimumHashtagLength,
		"enable_user_statuses":                                    *cfg.ServiceSettings.EnableUserStatuses,
		"enable_tutorial":                                         *cfg.ServiceSettings.EnableTutorial,
		"enable_onboarding_flow":                                  *cfg.ServiceSettings.EnableOnboardingFlow,
		"experimental_enable_default_channel_leave_join_messages": *cfg.ServiceSettings.ExperimentalEnableDefaultChannelLeaveJoinMessages,
		"experimental_group_unread_channels":                      *cfg.ServiceSettings.ExperimentalGroupUnreadChannels,
		"collapsed_threads":                                       *cfg.ServiceSettings.CollapsedThreads,
		"websocket_url":                                           isDefault(*cfg.ServiceSettings.WebsocketURL, ""),
		"allow_cookies_for_subdomains":                            *cfg.ServiceSettings.AllowCookiesForSubdomains,
		"enable_api_team_deletion":                                *cfg.ServiceSettings.EnableAPITeamDeletion,
		"enable_api_trigger_admin_notification":                   *cfg.ServiceSettings.EnableAPITriggerAdminNotifications,
		"enable_api_user_deletion":                                *cfg.ServiceSettings.EnableAPIUserDeletion,
		"enable_api_post_deletion":                                *cfg.ServiceSettings.EnableAPIPostDeletion,
		"enable_api_channel_deletion":                             *cfg.ServiceSettings.EnableAPIChannelDeletion,
		"experimental_enable_hardened_mode":                       *cfg.ServiceSettings.ExperimentalEnableHardenedMode,
		"experimental_strict_csrf_enforcement":                    *cfg.ServiceSettings.ExperimentalStrictCSRFEnforcement,
		"enable_email_invitations":                                *cfg.ServiceSettings.EnableEmailInvitations,
		"disable_bots_when_owner_is_deactivated":                  *cfg.ServiceSettings.DisableBotsWhenOwnerIsDeactivated,
		"enable_bot_account_creation":                             *cfg.ServiceSettings.EnableBotAccountCreation,
		"enable_svgs":                                             *cfg.ServiceSettings.EnableSVGs,
		"enable_latex":                                            *cfg.ServiceSettings.EnableLatex,
		"enable_inline_latex":                                     *cfg.ServiceSettings.EnableInlineLatex,
		"enable_opentracing":                                      *cfg.ServiceSettings.EnableOpenTracing,
		"enable_local_mode":                                       *cfg.ServiceSettings.EnableLocalMode,
		"managed_resource_paths":                                  isDefault(*cfg.ServiceSettings.ManagedResourcePaths, ""),
		"thread_auto_follow":                                      *cfg.ServiceSettings.ThreadAutoFollow,
		"enable_link_previews":                                    *cfg.ServiceSettings.EnableLinkPreviews,
		"enable_permalink_previews":                               *cfg.ServiceSettings.EnablePermalinkPreviews,
		"enable_file_search":                                      *cfg.ServiceSettings.EnableFileSearch,
		"restrict_link_previews":                                  isDefault(*cfg.ServiceSettings.RestrictLinkPreviews, ""),
		"enable_custom_groups":                                    *cfg.ServiceSettings.EnableCustomGroups,
		"post_priority":                                           *cfg.ServiceSettings.PostPriority,
		"allow_persistent_notifications":                          *cfg.ServiceSettings.AllowPersistentNotifications,
		"allow_persistent_notifications_for_guests":               *cfg.ServiceSettings.AllowPersistentNotificationsForGuests,
		"persistent_notification_interval_minutes":                *cfg.ServiceSettings.PersistentNotificationIntervalMinutes,
		"persistent_notification_max_count":                       *cfg.ServiceSettings.PersistentNotificationMaxCount,
		"persistent_notification_max_recipients":                  *cfg.ServiceSettings.PersistentNotificationMaxRecipients,
		"allow_synced_drafts":                                     *cfg.ServiceSettings.AllowSyncedDrafts,
		"refresh_post_stats_run_time":                             *cfg.ServiceSettings.RefreshPostStatsRunTime,
		"maximum_payload_size":                                    *cfg.ServiceSettings.MaximumPayloadSizeBytes,
		"maximum_url_length":                                      *cfg.ServiceSettings.MaximumURLLength,
	})

	ts.SendTelemetry(TrackConfigTeam, map[string]any{
		"enable_user_creation":                    cfg.TeamSettings.EnableUserCreation,
		"enable_open_server":                      *cfg.TeamSettings.EnableOpenServer,
		"enable_user_deactivation":                *cfg.TeamSettings.EnableUserDeactivation,
		"enable_custom_user_statuses":             *cfg.TeamSettings.EnableCustomUserStatuses,
		"enable_last_active_time":                 *cfg.TeamSettings.EnableLastActiveTime,
		"enable_custom_brand":                     *cfg.TeamSettings.EnableCustomBrand,
		"restrict_direct_message":                 *cfg.TeamSettings.RestrictDirectMessage,
		"max_notifications_per_channel":           *cfg.TeamSettings.MaxNotificationsPerChannel,
		"enable_confirm_notifications_to_channel": *cfg.TeamSettings.EnableConfirmNotificationsToChannel,
		"max_users_per_team":                      *cfg.TeamSettings.MaxUsersPerTeam,
		"max_channels_per_team":                   *cfg.TeamSettings.MaxChannelsPerTeam,
		"teammate_name_display":                   *cfg.TeamSettings.TeammateNameDisplay,
		"experimental_view_archived_channels":     *cfg.TeamSettings.ExperimentalViewArchivedChannels,
		"lock_teammate_name_display":              *cfg.TeamSettings.LockTeammateNameDisplay,
		"isdefault_site_name":                     isDefault(cfg.TeamSettings.SiteName, "Mattermost"),
		"isdefault_custom_brand_text":             isDefault(*cfg.TeamSettings.CustomBrandText, model.TeamSettingsDefaultCustomBrandText),
		"isdefault_custom_description_text":       isDefault(*cfg.TeamSettings.CustomDescriptionText, model.TeamSettingsDefaultCustomDescriptionText),
		"isdefault_user_status_away_timeout":      isDefault(*cfg.TeamSettings.UserStatusAwayTimeout, model.TeamSettingsDefaultUserStatusAwayTimeout),
		"experimental_enable_automatic_replies":   *cfg.TeamSettings.ExperimentalEnableAutomaticReplies,
		"experimental_primary_team":               isDefault(*cfg.TeamSettings.ExperimentalPrimaryTeam, ""),
		"experimental_default_channels":           len(cfg.TeamSettings.ExperimentalDefaultChannels),
	})

	ts.SendTelemetry(TrackConfigClientReq, map[string]any{
		"android_latest_version": cfg.ClientRequirements.AndroidLatestVersion,
		"android_min_version":    cfg.ClientRequirements.AndroidMinVersion,
		"ios_latest_version":     cfg.ClientRequirements.IosLatestVersion,
		"ios_min_version":        cfg.ClientRequirements.IosMinVersion,
	})

	ts.SendTelemetry(TrackConfigSQL, map[string]any{
		"driver_name":                          *cfg.SqlSettings.DriverName,
		"trace":                                cfg.SqlSettings.Trace,
		"max_idle_conns":                       *cfg.SqlSettings.MaxIdleConns,
		"conn_max_lifetime_milliseconds":       *cfg.SqlSettings.ConnMaxLifetimeMilliseconds,
		"conn_max_idletime_milliseconds":       *cfg.SqlSettings.ConnMaxIdleTimeMilliseconds,
		"max_open_conns":                       *cfg.SqlSettings.MaxOpenConns,
		"data_source_replicas":                 len(cfg.SqlSettings.DataSourceReplicas),
		"data_source_search_replicas":          len(cfg.SqlSettings.DataSourceSearchReplicas),
		"query_timeout":                        *cfg.SqlSettings.QueryTimeout,
		"disable_database_search":              *cfg.SqlSettings.DisableDatabaseSearch,
		"migrations_statement_timeout_seconds": *cfg.SqlSettings.MigrationsStatementTimeoutSeconds,
		"replica_monitor_interval_seconds":     *cfg.SqlSettings.ReplicaMonitorIntervalSeconds,
	})

	ts.SendTelemetry(TrackConfigLog, map[string]any{
		"enable_console":           cfg.LogSettings.EnableConsole,
		"console_level":            cfg.LogSettings.ConsoleLevel,
		"console_json":             *cfg.LogSettings.ConsoleJson,
		"enable_file":              cfg.LogSettings.EnableFile,
		"file_level":               cfg.LogSettings.FileLevel,
		"file_json":                cfg.LogSettings.FileJson,
		"enable_webhook_debugging": cfg.LogSettings.EnableWebhookDebugging,
		"isdefault_file_location":  isDefault(cfg.LogSettings.FileLocation, ""),
		"advanced_logging_json":    len(cfg.LogSettings.AdvancedLoggingJSON) != 0,
	})

	ts.SendTelemetry(TrackConfigAudit, map[string]any{
		"file_enabled":          *cfg.ExperimentalAuditSettings.FileEnabled,
		"file_max_size_mb":      *cfg.ExperimentalAuditSettings.FileMaxSizeMB,
		"file_max_age_days":     *cfg.ExperimentalAuditSettings.FileMaxAgeDays,
		"file_max_backups":      *cfg.ExperimentalAuditSettings.FileMaxBackups,
		"file_compress":         *cfg.ExperimentalAuditSettings.FileCompress,
		"file_max_queue_size":   *cfg.ExperimentalAuditSettings.FileMaxQueueSize,
		"advanced_logging_json": len(cfg.ExperimentalAuditSettings.AdvancedLoggingJSON) != 0,
	})

	ts.SendTelemetry(TrackConfigNotificationLog, map[string]any{
		"enable_console":          *cfg.NotificationLogSettings.EnableConsole,
		"console_level":           *cfg.NotificationLogSettings.ConsoleLevel,
		"console_json":            *cfg.NotificationLogSettings.ConsoleJson,
		"enable_file":             *cfg.NotificationLogSettings.EnableFile,
		"file_level":              *cfg.NotificationLogSettings.FileLevel,
		"file_json":               *cfg.NotificationLogSettings.FileJson,
		"isdefault_file_location": isDefault(*cfg.NotificationLogSettings.FileLocation, ""),
		"advanced_logging_json":   len(cfg.NotificationLogSettings.AdvancedLoggingJSON) != 0,
	})

	ts.SendTelemetry(TrackConfigPassword, map[string]any{
		"minimum_length": *cfg.PasswordSettings.MinimumLength,
		"lowercase":      *cfg.PasswordSettings.Lowercase,
		"number":         *cfg.PasswordSettings.Number,
		"uppercase":      *cfg.PasswordSettings.Uppercase,
		"symbol":         *cfg.PasswordSettings.Symbol,
	})

	ts.SendTelemetry(TrackConfigFile, map[string]any{
		"enable_public_links":           cfg.FileSettings.EnablePublicLink,
		"driver_name":                   *cfg.FileSettings.DriverName,
		"isdefault_directory":           isDefault(*cfg.FileSettings.Directory, model.FileSettingsDefaultDirectory),
		"isabsolute_directory":          filepath.IsAbs(*cfg.FileSettings.Directory),
		"extract_content":               *cfg.FileSettings.ExtractContent,
		"archive_recursion":             *cfg.FileSettings.ArchiveRecursion,
		"amazon_s3_ssl":                 *cfg.FileSettings.AmazonS3SSL,
		"amazon_s3_sse":                 *cfg.FileSettings.AmazonS3SSE,
		"amazon_s3_signv2":              *cfg.FileSettings.AmazonS3SignV2,
		"amazon_s3_trace":               *cfg.FileSettings.AmazonS3Trace,
		"max_file_size":                 *cfg.FileSettings.MaxFileSize,
		"max_image_resolution":          *cfg.FileSettings.MaxImageResolution,
		"max_image_decoder_concurrency": *cfg.FileSettings.MaxImageDecoderConcurrency,
		"enable_file_attachments":       *cfg.FileSettings.EnableFileAttachments,
		"enable_mobile_upload":          *cfg.FileSettings.EnableMobileUpload,
		"enable_mobile_download":        *cfg.FileSettings.EnableMobileDownload,
	})

	ts.SendTelemetry(TrackConfigEmail, map[string]any{
		"enable_sign_up_with_email":            cfg.EmailSettings.EnableSignUpWithEmail,
		"enable_sign_in_with_email":            *cfg.EmailSettings.EnableSignInWithEmail,
		"enable_sign_in_with_username":         *cfg.EmailSettings.EnableSignInWithUsername,
		"require_email_verification":           cfg.EmailSettings.RequireEmailVerification,
		"send_email_notifications":             cfg.EmailSettings.SendEmailNotifications,
		"use_channel_in_email_notifications":   *cfg.EmailSettings.UseChannelInEmailNotifications,
		"email_notification_contents_type":     *cfg.EmailSettings.EmailNotificationContentsType,
		"enable_smtp_auth":                     *cfg.EmailSettings.EnableSMTPAuth,
		"connection_security":                  cfg.EmailSettings.ConnectionSecurity,
		"send_push_notifications":              *cfg.EmailSettings.SendPushNotifications,
		"push_notification_contents":           *cfg.EmailSettings.PushNotificationContents,
		"enable_email_batching":                *cfg.EmailSettings.EnableEmailBatching,
		"email_batching_buffer_size":           *cfg.EmailSettings.EmailBatchingBufferSize,
		"email_batching_interval":              *cfg.EmailSettings.EmailBatchingInterval,
		"enable_preview_mode_banner":           *cfg.EmailSettings.EnablePreviewModeBanner,
		"isdefault_feedback_name":              isDefault(cfg.EmailSettings.FeedbackName, ""),
		"isdefault_feedback_email":             isDefault(cfg.EmailSettings.FeedbackEmail, ""),
		"isdefault_reply_to_address":           isDefault(cfg.EmailSettings.ReplyToAddress, ""),
		"isdefault_feedback_organization":      isDefault(*cfg.EmailSettings.FeedbackOrganization, model.EmailSettingsDefaultFeedbackOrganization),
		"skip_server_certificate_verification": *cfg.EmailSettings.SkipServerCertificateVerification,
		"isdefault_login_button_color":         isDefault(*cfg.EmailSettings.LoginButtonColor, ""),
		"isdefault_login_button_border_color":  isDefault(*cfg.EmailSettings.LoginButtonBorderColor, ""),
		"isdefault_login_button_text_color":    isDefault(*cfg.EmailSettings.LoginButtonTextColor, ""),
		"smtp_server_timeout":                  *cfg.EmailSettings.SMTPServerTimeout,
	})

	ts.SendTelemetry(TrackConfigRate, map[string]any{
		"enable_rate_limiter":      *cfg.RateLimitSettings.Enable,
		"vary_by_remote_address":   *cfg.RateLimitSettings.VaryByRemoteAddr,
		"vary_by_user":             *cfg.RateLimitSettings.VaryByUser,
		"per_sec":                  *cfg.RateLimitSettings.PerSec,
		"max_burst":                *cfg.RateLimitSettings.MaxBurst,
		"memory_store_size":        *cfg.RateLimitSettings.MemoryStoreSize,
		"isdefault_vary_by_header": isDefault(cfg.RateLimitSettings.VaryByHeader, ""),
	})

	ts.SendTelemetry(TrackConfigPrivacy, map[string]any{
		"show_email_address": cfg.PrivacySettings.ShowEmailAddress,
		"show_full_name":     cfg.PrivacySettings.ShowFullName,
	})

	ts.SendTelemetry(TrackConfigTheme, map[string]any{
		"enable_theme_selection":  *cfg.ThemeSettings.EnableThemeSelection,
		"isdefault_default_theme": isDefault(*cfg.ThemeSettings.DefaultTheme, model.TeamSettingsDefaultTeamText),
		"allow_custom_themes":     *cfg.ThemeSettings.AllowCustomThemes,
		"allowed_themes":          len(cfg.ThemeSettings.AllowedThemes),
	})

	ts.SendTelemetry(TrackConfigOAuth, map[string]any{
		"enable_gitlab":    cfg.GitLabSettings.Enable,
		"openid_gitlab":    *cfg.GitLabSettings.Enable && strings.Contains(*cfg.GitLabSettings.Scope, model.ServiceOpenid),
		"enable_google":    cfg.GoogleSettings.Enable,
		"openid_google":    *cfg.GoogleSettings.Enable && strings.Contains(*cfg.GoogleSettings.Scope, model.ServiceOpenid),
		"enable_office365": cfg.Office365Settings.Enable,
		"openid_office365": *cfg.Office365Settings.Enable && strings.Contains(*cfg.Office365Settings.Scope, model.ServiceOpenid),
		"enable_openid":    cfg.OpenIdSettings.Enable,
	})

	ts.SendTelemetry(TrackConfigSupport, map[string]any{
		"isdefault_terms_of_service_link":              isDefault(*cfg.SupportSettings.TermsOfServiceLink, model.SupportSettingsDefaultTermsOfServiceLink),
		"isdefault_privacy_policy_link":                isDefault(*cfg.SupportSettings.PrivacyPolicyLink, model.SupportSettingsDefaultPrivacyPolicyLink),
		"isdefault_about_link":                         isDefault(*cfg.SupportSettings.AboutLink, model.SupportSettingsDefaultAboutLink),
		"isdefault_help_link":                          isDefault(*cfg.SupportSettings.HelpLink, model.SupportSettingsDefaultHelpLink),
		"isdefault_report_a_problem_link":              isDefault(*cfg.SupportSettings.ReportAProblemLink, model.SupportSettingsDefaultReportAProblemLink),
		"isdefault_support_email":                      isDefault(*cfg.SupportSettings.SupportEmail, model.SupportSettingsDefaultSupportEmail),
		"custom_terms_of_service_enabled":              *cfg.SupportSettings.CustomTermsOfServiceEnabled,
		"custom_terms_of_service_re_acceptance_period": *cfg.SupportSettings.CustomTermsOfServiceReAcceptancePeriod,
		"enable_ask_community_link":                    *cfg.SupportSettings.EnableAskCommunityLink,
	})

	ts.SendTelemetry(TrackConfigLDAP, map[string]any{
		"enable":                                 *cfg.LdapSettings.Enable,
		"enable_sync":                            *cfg.LdapSettings.EnableSync,
		"enable_admin_filter":                    *cfg.LdapSettings.EnableAdminFilter,
		"connection_security":                    *cfg.LdapSettings.ConnectionSecurity,
		"skip_certificate_verification":          *cfg.LdapSettings.SkipCertificateVerification,
		"sync_interval_minutes":                  *cfg.LdapSettings.SyncIntervalMinutes,
		"query_timeout":                          *cfg.LdapSettings.QueryTimeout,
		"max_page_size":                          *cfg.LdapSettings.MaxPageSize,
		"isdefault_first_name_attribute":         isDefault(*cfg.LdapSettings.FirstNameAttribute, model.LdapSettingsDefaultFirstNameAttribute),
		"isdefault_last_name_attribute":          isDefault(*cfg.LdapSettings.LastNameAttribute, model.LdapSettingsDefaultLastNameAttribute),
		"isdefault_email_attribute":              isDefault(*cfg.LdapSettings.EmailAttribute, model.LdapSettingsDefaultEmailAttribute),
		"isdefault_username_attribute":           isDefault(*cfg.LdapSettings.UsernameAttribute, model.LdapSettingsDefaultUsernameAttribute),
		"isdefault_nickname_attribute":           isDefault(*cfg.LdapSettings.NicknameAttribute, model.LdapSettingsDefaultNicknameAttribute),
		"isdefault_id_attribute":                 isDefault(*cfg.LdapSettings.IdAttribute, model.LdapSettingsDefaultIdAttribute),
		"isdefault_position_attribute":           isDefault(*cfg.LdapSettings.PositionAttribute, model.LdapSettingsDefaultPositionAttribute),
		"isdefault_login_id_attribute":           isDefault(*cfg.LdapSettings.LoginIdAttribute, ""),
		"isdefault_login_field_name":             isDefault(*cfg.LdapSettings.LoginFieldName, model.LdapSettingsDefaultLoginFieldName),
		"isdefault_login_button_color":           isDefault(*cfg.LdapSettings.LoginButtonColor, ""),
		"isdefault_login_button_border_color":    isDefault(*cfg.LdapSettings.LoginButtonBorderColor, ""),
		"isdefault_login_button_text_color":      isDefault(*cfg.LdapSettings.LoginButtonTextColor, ""),
		"isempty_group_filter":                   isDefault(*cfg.LdapSettings.GroupFilter, ""),
		"isdefault_group_display_name_attribute": isDefault(*cfg.LdapSettings.GroupDisplayNameAttribute, model.LdapSettingsDefaultGroupDisplayNameAttribute),
		"isdefault_group_id_attribute":           isDefault(*cfg.LdapSettings.GroupIdAttribute, model.LdapSettingsDefaultGroupIdAttribute),
		"isempty_guest_filter":                   isDefault(*cfg.LdapSettings.GuestFilter, ""),
		"isempty_admin_filter":                   isDefault(*cfg.LdapSettings.AdminFilter, ""),
		"isnotempty_picture_attribute":           !isDefault(*cfg.LdapSettings.PictureAttribute, ""),
		"isnotempty_public_certificate":          !isDefault(*cfg.LdapSettings.PublicCertificateFile, ""),
		"isnotempty_private_key":                 !isDefault(*cfg.LdapSettings.PrivateKeyFile, ""),
	})

	ts.SendTelemetry(TrackConfigCompliance, map[string]any{
		"enable":       *cfg.ComplianceSettings.Enable,
		"enable_daily": *cfg.ComplianceSettings.EnableDaily,
	})

	ts.SendTelemetry(TrackConfigLocalization, map[string]any{
		"default_server_locale": *cfg.LocalizationSettings.DefaultServerLocale,
		"default_client_locale": *cfg.LocalizationSettings.DefaultClientLocale,
		"available_locales":     *cfg.LocalizationSettings.AvailableLocales,
	})

	ts.SendTelemetry(TrackConfigSAML, map[string]any{
		"enable":                              *cfg.SamlSettings.Enable,
		"enable_sync_with_ldap":               *cfg.SamlSettings.EnableSyncWithLdap,
		"enable_sync_with_ldap_include_auth":  *cfg.SamlSettings.EnableSyncWithLdapIncludeAuth,
		"ignore_guests_ldap_sync":             *cfg.SamlSettings.IgnoreGuestsLdapSync,
		"enable_admin_attribute":              *cfg.SamlSettings.EnableAdminAttribute,
		"verify":                              *cfg.SamlSettings.Verify,
		"encrypt":                             *cfg.SamlSettings.Encrypt,
		"sign_request":                        *cfg.SamlSettings.SignRequest,
		"isdefault_signature_algorithm":       isDefault(*cfg.SamlSettings.SignatureAlgorithm, ""),
		"isdefault_canonical_algorithm":       isDefault(*cfg.SamlSettings.CanonicalAlgorithm, ""),
		"isdefault_scoping_idp_provider_id":   isDefault(*cfg.SamlSettings.ScopingIDPProviderId, ""),
		"isdefault_scoping_idp_name":          isDefault(*cfg.SamlSettings.ScopingIDPName, ""),
		"isdefault_id_attribute":              isDefault(*cfg.SamlSettings.IdAttribute, model.SamlSettingsDefaultIdAttribute),
		"isdefault_guest_attribute":           isDefault(*cfg.SamlSettings.GuestAttribute, model.SamlSettingsDefaultGuestAttribute),
		"isdefault_admin_attribute":           isDefault(*cfg.SamlSettings.AdminAttribute, model.SamlSettingsDefaultAdminAttribute),
		"isdefault_first_name_attribute":      isDefault(*cfg.SamlSettings.FirstNameAttribute, model.SamlSettingsDefaultFirstNameAttribute),
		"isdefault_last_name_attribute":       isDefault(*cfg.SamlSettings.LastNameAttribute, model.SamlSettingsDefaultLastNameAttribute),
		"isdefault_email_attribute":           isDefault(*cfg.SamlSettings.EmailAttribute, model.SamlSettingsDefaultEmailAttribute),
		"isdefault_username_attribute":        isDefault(*cfg.SamlSettings.UsernameAttribute, model.SamlSettingsDefaultUsernameAttribute),
		"isdefault_nickname_attribute":        isDefault(*cfg.SamlSettings.NicknameAttribute, model.SamlSettingsDefaultNicknameAttribute),
		"isdefault_locale_attribute":          isDefault(*cfg.SamlSettings.LocaleAttribute, model.SamlSettingsDefaultLocaleAttribute),
		"isdefault_position_attribute":        isDefault(*cfg.SamlSettings.PositionAttribute, model.SamlSettingsDefaultPositionAttribute),
		"isdefault_login_button_text":         isDefault(*cfg.SamlSettings.LoginButtonText, model.UserAuthServiceSamlText),
		"isdefault_login_button_color":        isDefault(*cfg.SamlSettings.LoginButtonColor, ""),
		"isdefault_login_button_border_color": isDefault(*cfg.SamlSettings.LoginButtonBorderColor, ""),
		"isdefault_login_button_text_color":   isDefault(*cfg.SamlSettings.LoginButtonTextColor, ""),
	})

	ts.SendTelemetry(TrackConfigCluster, map[string]any{
		"enable":                                *cfg.ClusterSettings.Enable,
		"network_interface":                     isDefault(*cfg.ClusterSettings.NetworkInterface, ""),
		"bind_address":                          isDefault(*cfg.ClusterSettings.BindAddress, ""),
		"advertise_address":                     isDefault(*cfg.ClusterSettings.AdvertiseAddress, ""),
		"use_ip_address":                        *cfg.ClusterSettings.UseIPAddress,
		"enable_experimental_gossip_encryption": *cfg.ClusterSettings.EnableExperimentalGossipEncryption,
		"enable_gossip_compression":             *cfg.ClusterSettings.EnableGossipCompression,
		"read_only_config":                      *cfg.ClusterSettings.ReadOnlyConfig,
	})

	ts.SendTelemetry(TrackConfigMetrics, map[string]any{
		"enable":                *cfg.MetricsSettings.Enable,
		"block_profile_rate":    *cfg.MetricsSettings.BlockProfileRate,
		"enable_client_metrics": *cfg.MetricsSettings.EnableClientMetrics,
	})

	ts.SendTelemetry(TrackConfigNativeApp, map[string]any{
		"isdefault_app_custom_url_schemes":    isDefaultArray(cfg.NativeAppSettings.AppCustomURLSchemes, model.GetDefaultAppCustomURLSchemes()),
		"isdefault_app_download_link":         isDefault(*cfg.NativeAppSettings.AppDownloadLink, model.NativeappSettingsDefaultAppDownloadLink),
		"isdefault_android_app_download_link": isDefault(*cfg.NativeAppSettings.AndroidAppDownloadLink, model.NativeappSettingsDefaultAndroidAppDownloadLink),
		"isdefault_iosapp_download_link":      isDefault(*cfg.NativeAppSettings.IosAppDownloadLink, model.NativeappSettingsDefaultIosAppDownloadLink),
	})

	ts.SendTelemetry(TrackConfigExperimental, map[string]any{
		"client_side_cert_enable":             *cfg.ExperimentalSettings.ClientSideCertEnable,
		"isdefault_client_side_cert_check":    isDefault(*cfg.ExperimentalSettings.ClientSideCertCheck, model.ClientSideCertCheckPrimaryAuth),
		"link_metadata_timeout_milliseconds":  *cfg.ExperimentalSettings.LinkMetadataTimeoutMilliseconds,
		"restrict_system_admin":               *cfg.ExperimentalSettings.RestrictSystemAdmin,
		"enable_app_bar":                      !*cfg.ExperimentalSettings.DisableAppBar,
		"disable_refetching_on_browser_focus": *cfg.ExperimentalSettings.DisableRefetchingOnBrowserFocus,
		"delay_channel_autocomplete":          *cfg.ExperimentalSettings.DelayChannelAutocomplete,
		"youtube_referrer_policy":             *cfg.ExperimentalSettings.YoutubeReferrerPolicy,
	})

	ts.SendTelemetry(TrackConfigAnalytics, map[string]any{
		"isdefault_max_users_for_statistics": isDefault(*cfg.AnalyticsSettings.MaxUsersForStatistics, model.AnalyticsSettingsDefaultMaxUsersForStatistics),
	})

	ts.SendTelemetry(TrackConfigAnnouncement, map[string]any{
		"enable_banner":               *cfg.AnnouncementSettings.EnableBanner,
		"isdefault_banner_color":      isDefault(*cfg.AnnouncementSettings.BannerColor, model.AnnouncementSettingsDefaultBannerColor),
		"isdefault_banner_text_color": isDefault(*cfg.AnnouncementSettings.BannerTextColor, model.AnnouncementSettingsDefaultBannerTextColor),
		"allow_banner_dismissal":      *cfg.AnnouncementSettings.AllowBannerDismissal,
		"admin_notices_enabled":       *cfg.AnnouncementSettings.AdminNoticesEnabled,
		"user_notices_enabled":        *cfg.AnnouncementSettings.UserNoticesEnabled,
	})

	ts.SendTelemetry(TrackConfigElasticsearch, map[string]any{
		"isdefault_connection_url": isDefault(*cfg.ElasticsearchSettings.ConnectionURL, model.ElasticsearchSettingsDefaultConnectionURL),
		"isdefault_username":       isDefault(*cfg.ElasticsearchSettings.Username, model.ElasticsearchSettingsDefaultUsername),
		"isdefault_password":       isDefault(*cfg.ElasticsearchSettings.Password, model.ElasticsearchSettingsDefaultPassword),
		"enable_indexing":          *cfg.ElasticsearchSettings.EnableIndexing,
		"enable_searching":         *cfg.ElasticsearchSettings.EnableSearching,
		"enable_autocomplete":      *cfg.ElasticsearchSettings.EnableAutocomplete,
		"sniff":                    *cfg.ElasticsearchSettings.Sniff,
		"post_index_replicas":      *cfg.ElasticsearchSettings.PostIndexReplicas,
		"post_index_shards":        *cfg.ElasticsearchSettings.PostIndexShards,
		"channel_index_replicas":   *cfg.ElasticsearchSettings.ChannelIndexReplicas,
		"channel_index_shards":     *cfg.ElasticsearchSettings.ChannelIndexShards,
		"user_index_replicas":      *cfg.ElasticsearchSettings.UserIndexReplicas,
		"user_index_shards":        *cfg.ElasticsearchSettings.UserIndexShards,
		"isdefault_index_prefix":   isDefault(*cfg.ElasticsearchSettings.IndexPrefix, model.ElasticsearchSettingsDefaultIndexPrefix),
		"live_indexing_batch_size": *cfg.ElasticsearchSettings.LiveIndexingBatchSize,
		"bulk_indexing_batch_size": *cfg.ElasticsearchSettings.BatchSize,
		"request_timeout_seconds":  *cfg.ElasticsearchSettings.RequestTimeoutSeconds,
		"skip_tls_verification":    *cfg.ElasticsearchSettings.SkipTLSVerification,
		"isdefault_ca":             isDefault(*cfg.ElasticsearchSettings.CA, ""),
		"isdefault_client_cert":    isDefault(*cfg.ElasticsearchSettings.ClientCert, ""),
		"isdefault_client_key":     isDefault(*cfg.ElasticsearchSettings.ClientKey, ""),
		"trace":                    *cfg.ElasticsearchSettings.Trace,
	})

	ts.trackPluginConfig(cfg, model.PluginSettingsDefaultMarketplaceURL)

	ts.SendTelemetry(TrackConfigDataRetention, map[string]any{
		"enable_message_deletion":       *cfg.DataRetentionSettings.EnableMessageDeletion,
		"enable_file_deletion":          *cfg.DataRetentionSettings.EnableFileDeletion,
		"message_retention_days":        *cfg.DataRetentionSettings.MessageRetentionDays,
		"message_retention_hours":       *cfg.DataRetentionSettings.MessageRetentionHours,
		"file_retention_days":           *cfg.DataRetentionSettings.FileRetentionDays,
		"file_retention_hours":          *cfg.DataRetentionSettings.FileRetentionHours,
		"deletion_job_start_time":       *cfg.DataRetentionSettings.DeletionJobStartTime,
		"batch_size":                    *cfg.DataRetentionSettings.BatchSize,
		"time_between_batches":          *cfg.DataRetentionSettings.TimeBetweenBatchesMilliseconds,
		"retention_ids_batch_size":      *cfg.DataRetentionSettings.RetentionIdsBatchSize,
		"cleanup_jobs_threshold_days":   *cfg.JobSettings.CleanupJobsThresholdDays,
		"cleanup_config_threshold_days": *cfg.JobSettings.CleanupConfigThresholdDays,
	})

	ts.SendTelemetry(TrackConfigMessageExport, map[string]any{
		"enable_message_export":                 *cfg.MessageExportSettings.EnableExport,
		"export_format":                         *cfg.MessageExportSettings.ExportFormat,
		"daily_run_time":                        *cfg.MessageExportSettings.DailyRunTime,
		"default_export_from_timestamp":         *cfg.MessageExportSettings.ExportFromTimestamp,
		"batch_size":                            *cfg.MessageExportSettings.BatchSize,
		"global_relay_customer_type":            *cfg.MessageExportSettings.GlobalRelaySettings.CustomerType,
		"is_default_global_relay_smtp_username": isDefault(*cfg.MessageExportSettings.GlobalRelaySettings.SMTPUsername, ""),
		"is_default_global_relay_smtp_password": isDefault(*cfg.MessageExportSettings.GlobalRelaySettings.SMTPPassword, ""),
		"is_default_global_relay_email_address": isDefault(*cfg.MessageExportSettings.GlobalRelaySettings.EmailAddress, ""),
		"global_relay_smtp_server_timeout":      *cfg.MessageExportSettings.GlobalRelaySettings.SMTPServerTimeout,
		"download_export_results":               *cfg.MessageExportSettings.DownloadExportResults,
	})

	ts.SendTelemetry(TrackConfigDisplay, map[string]any{
		"isdefault_custom_url_schemes": len(cfg.DisplaySettings.CustomURLSchemes) != 0,
		"isdefault_max_markdown_nodes": isDefault(*cfg.DisplaySettings.MaxMarkdownNodes, 0),
	})

	ts.SendTelemetry(TrackConfigGuestAccounts, map[string]any{
		"enable":                                 *cfg.GuestAccountsSettings.Enable,
		"hide_tag":                               *cfg.GuestAccountsSettings.HideTags,
		"allow_email_accounts":                   *cfg.GuestAccountsSettings.AllowEmailAccounts,
		"enforce_multifactor_authentication":     *cfg.GuestAccountsSettings.EnforceMultifactorAuthentication,
		"isdefault_restrict_creation_to_domains": isDefault(*cfg.GuestAccountsSettings.RestrictCreationToDomains, ""),
	})

	ts.SendTelemetry(TrackConfigImageProxy, map[string]any{
		"enable":                               *cfg.ImageProxySettings.Enable,
		"image_proxy_type":                     *cfg.ImageProxySettings.ImageProxyType,
		"isdefault_remote_image_proxy_url":     isDefault(*cfg.ImageProxySettings.RemoteImageProxyURL, ""),
		"isdefault_remote_image_proxy_options": isDefault(*cfg.ImageProxySettings.RemoteImageProxyOptions, ""),
	})

	ts.SendTelemetry(TrackConfigBleve, map[string]any{
		"enable_indexing":          *cfg.BleveSettings.EnableIndexing,
		"enable_searching":         *cfg.BleveSettings.EnableSearching,
		"enable_autocomplete":      *cfg.BleveSettings.EnableAutocomplete,
		"bulk_indexing_batch_size": *cfg.BleveSettings.BatchSize,
	})

	ts.SendTelemetry(TrackConfigExport, map[string]any{
		"retention_days": *cfg.ExportSettings.RetentionDays,
	})

	ts.SendTelemetry(TrackConfigWrangler, map[string]any{
		"permitted_wrangler_users":                       cfg.WranglerSettings.PermittedWranglerRoles,
		"allowed_email_domain":                           cfg.WranglerSettings.AllowedEmailDomain,
		"move_thread_max_count":                          cfg.WranglerSettings.MoveThreadMaxCount,
		"move_thread_to_another_team_enable":             cfg.WranglerSettings.MoveThreadToAnotherTeamEnable,
		"move_thread_from_private_channel_enable":        cfg.WranglerSettings.MoveThreadFromPrivateChannelEnable,
		"move_thread_from_direct_message_channel_enable": cfg.WranglerSettings.MoveThreadFromDirectMessageChannelEnable,
		"move_thread_from_group_message_channel_enable":  cfg.WranglerSettings.MoveThreadFromGroupMessageChannelEnable,
	})

	ts.SendTelemetry(TrackConfigConnectedWorkspaces, map[string]any{
		"enable_shared_channels":              *cfg.ConnectedWorkspacesSettings.EnableSharedChannels,
		"enable_remote_cluster_service":       *cfg.ConnectedWorkspacesSettings.EnableRemoteClusterService && cfg.FeatureFlags.EnableRemoteClusterService,
		"disable_shared_channels_status_sync": *cfg.ConnectedWorkspacesSettings.DisableSharedChannelsStatusSync,
		"max_posts_per_sync":                  *cfg.ConnectedWorkspacesSettings.MaxPostsPerSync,
	})

	// Convert feature flags to map[string]any for sending
	flags := cfg.FeatureFlags.ToMap()
	interfaceFlags := make(map[string]any)
	for k, v := range flags {
		interfaceFlags[k] = v
	}
	ts.SendTelemetry(TrackFeatureFlags, interfaceFlags)
}

func (ts *TelemetryService) trackLicense() {
	if license := ts.srv.License(); license != nil {
		data := map[string]any{
			"customer_id": license.Customer.Id,
			"license_id":  license.Id,
			"issued":      license.IssuedAt,
			"start":       license.StartsAt,
			"expire":      license.ExpiresAt,
			"users":       *license.Features.Users,
			"edition":     license.SkuShortName,
		}

		features := license.Features.ToMap()
		for featureName, featureValue := range features {
			data["feature_"+featureName] = featureValue
		}

		ts.SendTelemetry(TrackLicense, data)
	}
}

func (ts *TelemetryService) trackPlugins() {
	pluginsEnvironment := ts.srv.GetPluginsEnvironment()
	if pluginsEnvironment == nil {
		return
	}

	totalEnabledCount := 0
	webappEnabledCount := 0
	backendEnabledCount := 0
	totalDisabledCount := 0
	totalCoreDisabledCount := 0
	webappDisabledCount := 0
	backendDisabledCount := 0
	brokenManifestCount := 0
	settingsCount := 0

	pluginStates := ts.srv.Config().PluginSettings.PluginStates
	plugins, _ := pluginsEnvironment.Available()

	if pluginStates != nil && plugins != nil {
		for _, plugin := range plugins {
			if plugin.Manifest == nil {
				brokenManifestCount += 1
				continue
			}

			if state, ok := pluginStates[plugin.Manifest.Id]; ok && state.Enable {
				totalEnabledCount += 1
				if plugin.Manifest.HasServer() {
					backendEnabledCount += 1
				}
				if plugin.Manifest.HasWebapp() {
					webappEnabledCount += 1
				}
			} else {
				totalDisabledCount += 1
				if plugin.Manifest.HasServer() {
					backendDisabledCount += 1
				}
				if plugin.Manifest.HasWebapp() {
					webappDisabledCount += 1
				}
				if _, isCorePlugin := model.InstalledIntegrationsIgnoredPlugins[plugin.Manifest.Id]; isCorePlugin {
					totalCoreDisabledCount += 1
				}
			}
			if plugin.Manifest.SettingsSchema != nil {
				settingsCount += 1
			}
		}
	} else {
		totalEnabledCount = -1      // -1 to indicate disabled or error
		totalCoreDisabledCount = -1 // -1 to indicate disabled or error
		totalDisabledCount = -1     // -1 to indicate disabled or error
	}

	ts.SendTelemetry(TrackPlugins, map[string]any{
		"enabled_plugins":               totalEnabledCount,
		"enabled_webapp_plugins":        webappEnabledCount,
		"enabled_backend_plugins":       backendEnabledCount,
		"disabled_plugins":              totalDisabledCount,
		"disabled_default_plugins":      totalCoreDisabledCount,
		"disabled_webapp_plugins":       webappDisabledCount,
		"disabled_backend_plugins":      backendDisabledCount,
		"plugins_with_settings":         settingsCount,
		"plugins_with_broken_manifests": brokenManifestCount,
	})

	pluginsEnvironment.RunMultiPluginHook(func(hooks plugin.Hooks, _ *model.Manifest) bool {
		hooks.OnSendDailyTelemetry()
		return true
	}, plugin.OnSendDailyTelemetryID)
}

func (ts *TelemetryService) trackServer() {
	data := map[string]any{
		"edition":           model.BuildEnterpriseReady,
		"version":           model.CurrentVersion,
		"database_type":     *ts.srv.Config().SqlSettings.DriverName,
		"operating_system":  runtime.GOOS,
		"installation_type": os.Getenv(EnvVarInstallType),
	}

	if scr, err := ts.dbStore.User().AnalyticsGetSystemAdminCount(); err == nil {
		data["system_admins"] = scr
	}

	if scr, err := ts.dbStore.GetDbVersion(false); err == nil {
		data["database_version"] = scr
	}

	ts.SendTelemetry(TrackServer, data)
}

func (ts *TelemetryService) trackPermissions() {
	phase1Complete := false
	if _, err := ts.dbStore.System().GetByName(model.AdvancedPermissionsMigrationKey); err == nil {
		phase1Complete = true
	}

	phase2Complete := false
	if _, err := ts.dbStore.System().GetByName(model.MigrationKeyAdvancedPermissionsPhase2); err == nil {
		phase2Complete = true
	}

	ts.SendTelemetry(TrackPermissionsGeneral, map[string]any{
		"phase_1_migration_complete": phase1Complete,
		"phase_2_migration_complete": phase2Complete,
	})

	systemAdminPermissions := ""
	if role, err := ts.srv.GetRoleByName(context.Background(), model.SystemAdminRoleId); err == nil {
		systemAdminPermissions = strings.Join(role.Permissions, " ")
	}

	systemUserPermissions := ""
	if role, err := ts.srv.GetRoleByName(context.Background(), model.SystemUserRoleId); err == nil {
		systemUserPermissions = strings.Join(role.Permissions, " ")
	}

	teamAdminPermissions := ""
	if role, err := ts.srv.GetRoleByName(context.Background(), model.TeamAdminRoleId); err == nil {
		teamAdminPermissions = strings.Join(role.Permissions, " ")
	}

	teamUserPermissions := ""
	if role, err := ts.srv.GetRoleByName(context.Background(), model.TeamUserRoleId); err == nil {
		teamUserPermissions = strings.Join(role.Permissions, " ")
	}

	teamGuestPermissions := ""
	if role, err := ts.srv.GetRoleByName(context.Background(), model.TeamGuestRoleId); err == nil {
		teamGuestPermissions = strings.Join(role.Permissions, " ")
	}

	channelAdminPermissions := ""
	if role, err := ts.srv.GetRoleByName(context.Background(), model.ChannelAdminRoleId); err == nil {
		channelAdminPermissions = strings.Join(role.Permissions, " ")
	}

	channelUserPermissions := ""
	if role, err := ts.srv.GetRoleByName(context.Background(), model.ChannelUserRoleId); err == nil {
		channelUserPermissions = strings.Join(role.Permissions, " ")
	}

	channelGuestPermissions := ""
	if role, err := ts.srv.GetRoleByName(context.Background(), model.ChannelGuestRoleId); err == nil {
		channelGuestPermissions = strings.Join(role.Permissions, " ")
	}

	systemManagerPermissions := ""
	systemManagerPermissionsModified := false
	if role, err := ts.srv.GetRoleByName(context.Background(), model.SystemManagerRoleId); err == nil {
		systemManagerPermissionsModified = len(model.PermissionsChangedByPatch(role, &model.RolePatch{Permissions: &model.SystemManagerDefaultPermissions})) > 0
		systemManagerPermissions = strings.Join(role.Permissions, " ")
	}
	systemManagerCount, countErr := ts.dbStore.User().Count(model.UserCountOptions{Roles: []string{model.SystemManagerRoleId}})
	if countErr != nil {
		systemManagerCount = 0
	}

	systemUserManagerPermissions := ""
	systemUserManagerPermissionsModified := false
	if role, err := ts.srv.GetRoleByName(context.Background(), model.SystemUserManagerRoleId); err == nil {
		systemUserManagerPermissionsModified = len(model.PermissionsChangedByPatch(role, &model.RolePatch{Permissions: &model.SystemUserManagerDefaultPermissions})) > 0
		systemUserManagerPermissions = strings.Join(role.Permissions, " ")
	}
	systemUserManagerCount, countErr := ts.dbStore.User().Count(model.UserCountOptions{Roles: []string{model.SystemUserManagerRoleId}})
	if countErr != nil {
		systemManagerCount = 0
	}

	systemReadOnlyAdminPermissions := ""
	systemReadOnlyAdminPermissionsModified := false
	if role, err := ts.srv.GetRoleByName(context.Background(), model.SystemReadOnlyAdminRoleId); err == nil {
		systemReadOnlyAdminPermissionsModified = len(model.PermissionsChangedByPatch(role, &model.RolePatch{Permissions: &model.SystemReadOnlyAdminDefaultPermissions})) > 0
		systemReadOnlyAdminPermissions = strings.Join(role.Permissions, " ")
	}
	systemReadOnlyAdminCount, countErr := ts.dbStore.User().Count(model.UserCountOptions{Roles: []string{model.SystemReadOnlyAdminRoleId}})
	if countErr != nil {
		systemReadOnlyAdminCount = 0
	}

	systemCustomGroupAdminPermissions := ""
	systemCustomGroupAdminPermissionsModified := false
	if role, err := ts.srv.GetRoleByName(context.Background(), model.SystemCustomGroupAdminRoleId); err == nil {
		systemCustomGroupAdminPermissionsModified = len(model.PermissionsChangedByPatch(role, &model.RolePatch{Permissions: &model.SystemReadOnlyAdminDefaultPermissions})) > 0
		systemCustomGroupAdminPermissions = strings.Join(role.Permissions, " ")
	}
	systemCustomGroupAdminCount, countErr := ts.dbStore.User().Count(model.UserCountOptions{Roles: []string{model.SystemCustomGroupAdminRoleId}})
	if countErr != nil {
		systemCustomGroupAdminCount = 0
	}

	ts.SendTelemetry(TrackPermissionsSystemScheme, map[string]any{
		"system_admin_permissions":                       systemAdminPermissions,
		"system_user_permissions":                        systemUserPermissions,
		"system_manager_permissions":                     systemManagerPermissions,
		"system_user_manager_permissions":                systemUserManagerPermissions,
		"system_read_only_admin_permissions":             systemReadOnlyAdminPermissions,
		"team_admin_permissions":                         teamAdminPermissions,
		"team_user_permissions":                          teamUserPermissions,
		"team_guest_permissions":                         teamGuestPermissions,
		"channel_admin_permissions":                      channelAdminPermissions,
		"channel_user_permissions":                       channelUserPermissions,
		"channel_guest_permissions":                      channelGuestPermissions,
		"system_manager_permissions_modified":            systemManagerPermissionsModified,
		"system_manager_count":                           systemManagerCount,
		"system_user_manager_permissions_modified":       systemUserManagerPermissionsModified,
		"system_user_manager_count":                      systemUserManagerCount,
		"system_read_only_admin_permissions_modified":    systemReadOnlyAdminPermissionsModified,
		"system_read_only_admin_count":                   systemReadOnlyAdminCount,
		"system_custom_group_admin_permissions":          systemCustomGroupAdminPermissions,
		"system_custom_group_admin_permissions_modified": systemCustomGroupAdminPermissionsModified,
		"system_custom_group_admin_count":                systemCustomGroupAdminCount,
	})

	if schemes, err := ts.srv.GetSchemes(model.SchemeScopeTeam, 0, 100); err == nil {
		for _, scheme := range schemes {
			teamAdminPermissions := ""
			if role, err := ts.srv.GetRoleByName(context.Background(), scheme.DefaultTeamAdminRole); err == nil {
				teamAdminPermissions = strings.Join(role.Permissions, " ")
			}

			teamUserPermissions := ""
			if role, err := ts.srv.GetRoleByName(context.Background(), scheme.DefaultTeamUserRole); err == nil {
				teamUserPermissions = strings.Join(role.Permissions, " ")
			}

			teamGuestPermissions := ""
			if role, err := ts.srv.GetRoleByName(context.Background(), scheme.DefaultTeamGuestRole); err == nil {
				teamGuestPermissions = strings.Join(role.Permissions, " ")
			}

			channelAdminPermissions := ""
			if role, err := ts.srv.GetRoleByName(context.Background(), scheme.DefaultChannelAdminRole); err == nil {
				channelAdminPermissions = strings.Join(role.Permissions, " ")
			}

			channelUserPermissions := ""
			if role, err := ts.srv.GetRoleByName(context.Background(), scheme.DefaultChannelUserRole); err == nil {
				channelUserPermissions = strings.Join(role.Permissions, " ")
			}

			channelGuestPermissions := ""
			if role, err := ts.srv.GetRoleByName(context.Background(), scheme.DefaultChannelGuestRole); err == nil {
				channelGuestPermissions = strings.Join(role.Permissions, " ")
			}

			count, _ := ts.dbStore.Team().AnalyticsGetTeamCountForScheme(scheme.Id)

			ts.SendTelemetry(TrackPermissionsTeamSchemes, map[string]any{
				"scheme_id":                 scheme.Id,
				"team_admin_permissions":    teamAdminPermissions,
				"team_user_permissions":     teamUserPermissions,
				"team_guest_permissions":    teamGuestPermissions,
				"channel_admin_permissions": channelAdminPermissions,
				"channel_user_permissions":  channelUserPermissions,
				"channel_guest_permissions": channelGuestPermissions,
				"team_count":                count,
			})
		}
	}
}

func (ts *TelemetryService) trackElasticsearch() {
	data := map[string]any{}

	for _, engine := range ts.searchEngine.GetActiveEngines() {
		if engine.GetVersion() != 0 && engine.GetName() == "elasticsearch" {
			data["elasticsearch_server_version"] = engine.GetVersion()
		}
	}

	ts.SendTelemetry(TrackElasticsearch, data)
}

func (ts *TelemetryService) trackGroups() {
	groupCount, err := ts.dbStore.Group().GroupCount()
	if err != nil {
		ts.log.Debug("Could not get group_count", mlog.Err(err))
	}

	ldapGroupCount, err := ts.dbStore.Group().GroupCountBySource(model.GroupSourceLdap)
	if err != nil {
		ts.log.Debug("Could not get group_count", mlog.Err(err))
	}

	customGroupCount, err := ts.dbStore.Group().GroupCountBySource(model.GroupSourceCustom)
	if err != nil {
		ts.log.Debug("Could not get group_count", mlog.Err(err))
	}

	groupTeamCount, err := ts.dbStore.Group().GroupTeamCount()
	if err != nil {
		ts.log.Debug("Could not get group_team_count", mlog.Err(err))
	}

	groupChannelCount, err := ts.dbStore.Group().GroupChannelCount()
	if err != nil {
		ts.log.Debug("Could not get group_channel_count", mlog.Err(err))
	}

	groupSyncedTeamCount, nErr := ts.dbStore.Team().GroupSyncedTeamCount()
	if nErr != nil {
		ts.log.Debug("Could not get group_synced_team_count", mlog.Err(nErr))
	}

	groupSyncedChannelCount, nErr := ts.dbStore.Channel().GroupSyncedChannelCount()
	if nErr != nil {
		ts.log.Debug("Could not get group_synced_channel_count", mlog.Err(nErr))
	}

	groupMemberCount, err := ts.dbStore.Group().GroupMemberCount()
	if err != nil {
		ts.log.Debug("Could not get group_member_count", mlog.Err(err))
	}

	distinctGroupMemberCount, err := ts.dbStore.Group().DistinctGroupMemberCount()
	if err != nil {
		ts.log.Debug("Could not get distinct_group_member_count", mlog.Err(err))
	}

	distinctCustomGroupMemberCount, err := ts.dbStore.Group().DistinctGroupMemberCountForSource(model.GroupSourceCustom)
	if err != nil {
		ts.log.Debug("Could not get distinct_custom_group_member_count", mlog.Err(err))
	}

	distinctLdapGroupMemberCount, err := ts.dbStore.Group().DistinctGroupMemberCountForSource(model.GroupSourceLdap)
	if err != nil {
		ts.log.Debug("Could not get distinct_ldap_group_member_count", mlog.Err(err))
	}

	groupCountWithAllowReference, err := ts.dbStore.Group().GroupCountWithAllowReference()
	if err != nil {
		ts.log.Debug("Could not get group_count_with_allow_reference", mlog.Err(err))
	}

	ts.SendTelemetry(TrackGroups, map[string]any{
		"group_count":                        groupCount,
		"ldap_group_count":                   ldapGroupCount,
		"custom_group_count":                 customGroupCount,
		"group_team_count":                   groupTeamCount,
		"group_channel_count":                groupChannelCount,
		"group_synced_team_count":            groupSyncedTeamCount,
		"group_synced_channel_count":         groupSyncedChannelCount,
		"group_member_count":                 groupMemberCount,
		"distinct_group_member_count":        distinctGroupMemberCount,
		"distinct_custom_group_member_count": distinctCustomGroupMemberCount,
		"distinct_ldap_group_member_count":   distinctLdapGroupMemberCount,
		"group_count_with_allow_reference":   groupCountWithAllowReference,
	})
}

func (ts *TelemetryService) trackChannelModeration() {
	channelSchemeCount, err := ts.dbStore.Scheme().CountByScope(model.SchemeScopeChannel)
	if err != nil {
		ts.log.Debug("Could not get channel_scheme_count", mlog.Err(err))
	}

	createPostUser, err := ts.dbStore.Scheme().CountWithoutPermission(model.SchemeScopeChannel, model.PermissionCreatePost.Id, model.RoleScopeChannel, model.RoleTypeUser)
	if err != nil {
		ts.log.Debug("Could not get create_post_user_disabled_count", mlog.Err(err))
	}

	createPostGuest, err := ts.dbStore.Scheme().CountWithoutPermission(model.SchemeScopeChannel, model.PermissionCreatePost.Id, model.RoleScopeChannel, model.RoleTypeGuest)
	if err != nil {
		ts.log.Debug("Could not get create_post_guest_disabled_count", mlog.Err(err))
	}

	// only need to track one of 'add_reaction' or 'remove_reaction` because they're both toggled together by the channel moderation feature
	postReactionsUser, err := ts.dbStore.Scheme().CountWithoutPermission(model.SchemeScopeChannel, model.PermissionAddReaction.Id, model.RoleScopeChannel, model.RoleTypeUser)
	if err != nil {
		ts.log.Debug("Could not get post_reactions_user_disabled_count", mlog.Err(err))
	}

	postReactionsGuest, err := ts.dbStore.Scheme().CountWithoutPermission(model.SchemeScopeChannel, model.PermissionAddReaction.Id, model.RoleScopeChannel, model.RoleTypeGuest)
	if err != nil {
		ts.log.Debug("Could not get post_reactions_guest_disabled_count", mlog.Err(err))
	}

	// only need to track one of 'manage_public_channel_members' or 'manage_private_channel_members` because they're both toggled together by the channel moderation feature
	manageMembersUser, err := ts.dbStore.Scheme().CountWithoutPermission(model.SchemeScopeChannel, model.PermissionManagePublicChannelMembers.Id, model.RoleScopeChannel, model.RoleTypeUser)
	if err != nil {
		ts.log.Debug("Could not get manage_members_user_disabled_count", mlog.Err(err))
	}

	useChannelMentionsUser, err := ts.dbStore.Scheme().CountWithoutPermission(model.SchemeScopeChannel, model.PermissionUseChannelMentions.Id, model.RoleScopeChannel, model.RoleTypeUser)
	if err != nil {
		ts.log.Debug("Could not get use_channel_mentions_user_disabled_count", mlog.Err(err))
	}

	useChannelMentionsGuest, err := ts.dbStore.Scheme().CountWithoutPermission(model.SchemeScopeChannel, model.PermissionUseChannelMentions.Id, model.RoleScopeChannel, model.RoleTypeGuest)
	if err != nil {
		ts.log.Debug("Could not get use_channel_mentions_guest_disabled_count", mlog.Err(err))
	}

	ts.SendTelemetry(TrackChannelModeration, map[string]any{
		"channel_scheme_count": channelSchemeCount,

		"create_post_user_disabled_count":  createPostUser,
		"create_post_guest_disabled_count": createPostGuest,

		"post_reactions_user_disabled_count":  postReactionsUser,
		"post_reactions_guest_disabled_count": postReactionsGuest,

		"manage_members_user_disabled_count": manageMembersUser, // the UI does not allow this to be removed for guests

		"use_channel_mentions_user_disabled_count":  useChannelMentionsUser,
		"use_channel_mentions_guest_disabled_count": useChannelMentionsGuest,
	})
}

func (ts *TelemetryService) initRudder(endpoint string, rudderKey string) {
	if ts.rudderClient == nil {
		config := rudder.Config{}
		config.Logger = rudder.StdLogger(ts.log.With(mlog.String("source", "rudder")).StdLogger(mlog.LvlDebug))
		config.Endpoint = endpoint
		config.Verbose = ts.verbose
		// For testing
		if endpoint != rudderDataplaneURL {
			config.BatchSize = 1
		}
		client, err := rudder.NewWithConfig(rudderKey, endpoint, config)
		if err != nil {
			ts.log.Error("Failed to create Rudder instance", mlog.Err(err))
			return
		}
		client.Enqueue(rudder.Identify{
			UserId: ts.TelemetryID,
		})

		ts.rudderClient = client
	}
}

func (ts *TelemetryService) doTelemetryIfNeeded(firstRun time.Time) {
	hoursSinceFirstServerRun := time.Since(firstRun).Hours()
	// Send once every 10 minutes for the first hour
	// Send once every hour thereafter for the first 12 hours
	// Send at the 24 hour mark and every 24 hours after
	if hoursSinceFirstServerRun < 1 {
		ts.doTelemetry()
	} else if hoursSinceFirstServerRun <= 12 && time.Since(ts.timestampLastTelemetrySent) >= time.Hour {
		ts.doTelemetry()
	} else if hoursSinceFirstServerRun > 12 && time.Since(ts.timestampLastTelemetrySent) >= 24*time.Hour {
		ts.doTelemetry()
	}
}

func (ts *TelemetryService) RunTelemetryJob(firstRun int64) {
	// Send on boot
	ts.doTelemetry()
	model.CreateRecurringTask("Telemetry", func() {
		ts.doTelemetryIfNeeded(utils.TimeFromMillis(firstRun))
	}, time.Minute*10)
}

func (ts *TelemetryService) doTelemetry() {
	if *ts.srv.Config().LogSettings.EnableDiagnostics {
		ts.timestampLastTelemetrySent = time.Now()
		ts.sendDailyTelemetry(false)
	}
}

// Shutdown closes the telemetry client.
func (ts *TelemetryService) Shutdown() error {
	if ts.rudderClient != nil {
		return ts.rudderClient.Close()
	}
	return nil
}

func (ts *TelemetryService) trackPluginConfig(cfg *model.Config, marketplaceURL string) {
	pluginConfigData := map[string]any{
		"enable_nps_survey":             pluginSetting(&cfg.PluginSettings, model.PluginIdNPS, "enablesurvey", true),
		"enable":                        *cfg.PluginSettings.Enable,
		"enable_uploads":                *cfg.PluginSettings.EnableUploads,
		"allow_insecure_download_url":   *cfg.PluginSettings.AllowInsecureDownloadURL,
		"enable_health_check":           *cfg.PluginSettings.EnableHealthCheck,
		"enable_marketplace":            *cfg.PluginSettings.EnableMarketplace,
		"require_pluginSignature":       *cfg.PluginSettings.RequirePluginSignature,
		"enable_remote_marketplace":     *cfg.PluginSettings.EnableRemoteMarketplace,
		"automatic_prepackaged_plugins": *cfg.PluginSettings.AutomaticPrepackagedPlugins,
		"is_default_marketplace_url":    isDefault(*cfg.PluginSettings.MarketplaceURL, model.PluginSettingsDefaultMarketplaceURL),
		"signature_public_key_files":    len(cfg.PluginSettings.SignaturePublicKeyFiles),
		"chimera_oauth_proxy_url":       *cfg.PluginSettings.ChimeraOAuthProxyURL,
	}

	// knownPluginIDs lists all known plugin IDs in the Marketplace
	knownPluginIDs := []string{
		"antivirus",
		"com.github.manland.mattermost-plugin-gitlab",
		"com.github.moussetc.mattermost.plugin.giphy",
		"com.github.phillipahereza.mattermost-plugin-digitalocean",
		"com.mattermost.aws-sns",
		"com.mattermost.confluence",
		"com.mattermost.custom-attributes",
		"com.mattermost.mscalendar",
		"com.mattermost.nps",
		"com.mattermost.plugin-channel-export",
		"com.mattermost.plugin-incident-management",
		"playbooks",
		"com.mattermost.plugin-todo",
		"com.mattermost.webex",
		"com.mattermost.welcomebot",
		"github",
		"jenkins",
		"jira",
		"jitsi",
		"mattermost-autolink",
		"memes",
		"skype4business",
		"zoom",
		"focalboard",
		"com.mattermost.msteams-sync",
	}

	marketplacePlugins, err := ts.GetAllMarketplacePlugins(marketplaceURL)
	if err != nil {
		mlog.Info("Failed to fetch marketplace plugins for telemetry. Using predefined list.", mlog.Err(err))
	} else {
		for _, p := range marketplacePlugins {
			id := p.Manifest.Id

			pluginConfigData["enable_"+id] = pluginActivated(cfg.PluginSettings.PluginStates, id)
		}
	}

	for _, id := range knownPluginIDs {
		pluginIdStr := fmt.Sprintf("enable_%s", id)
		_, exists := pluginConfigData[pluginIdStr]
		if !exists {
			pluginConfigData[pluginIdStr] = pluginActivated(cfg.PluginSettings.PluginStates, id)
		}
	}
	pluginsEnvironment := ts.srv.GetPluginsEnvironment()
	if pluginsEnvironment != nil {
		if plugins, appErr := pluginsEnvironment.Available(); appErr != nil {
			ts.log.Warn("Unable to add plugin versions to telemetry", mlog.Err(appErr))
		} else {
			for _, p := range marketplacePlugins {
				id := p.Manifest.Id
				pluginConfigData["version_"+id] = pluginVersion(plugins, id)
			}
			for _, id := range knownPluginIDs {
				pluginVersionStr := fmt.Sprintf("version_%s", id)
				_, exists := pluginConfigData[pluginVersionStr]
				if !exists {
					pluginConfigData[pluginVersionStr] = pluginVersion(plugins, id)
				}
			}
		}
	}
	ts.SendTelemetry(TrackConfigPlugin, pluginConfigData)
}

func (ts *TelemetryService) GetAllMarketplacePlugins(marketplaceURL string) ([]*model.BaseMarketplacePlugin, error) {
	marketplaceClient, err := marketplace.NewClient(
		marketplaceURL,
		ts.srv.HTTPService(),
	)
	if err != nil {
		return nil, err
	}

	// Fetch all plugins from marketplace.
	filter := &model.MarketplacePluginFilter{
		PerPage:       -1,
		ServerVersion: model.CurrentVersion,
	}

	license := ts.srv.License()
	if license != nil && *license.Features.EnterprisePlugins {
		filter.EnterprisePlugins = true
	}

	if model.BuildEnterpriseReady == "true" {
		filter.BuildEnterpriseReady = true
	}

	return marketplaceClient.GetPlugins(filter)
}
