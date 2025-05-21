// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"crypto/tls"
	"encoding/json"
	"io"
	"math"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"reflect"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/mattermost/ldap"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/utils"
)

const (
	ConnSecurityNone     = ""
	ConnSecurityPlain    = "PLAIN"
	ConnSecurityTLS      = "TLS"
	ConnSecurityStarttls = "STARTTLS"

	ImageDriverLocal = "local"
	ImageDriverS3    = "amazons3"

	DatabaseDriverMysql    = "mysql"
	DatabaseDriverPostgres = "postgres"

	SearchengineElasticsearch = "elasticsearch"

	MinioAccessKey = "minioaccesskey"
	MinioSecretKey = "miniosecretkey"
	MinioBucket    = "mattermost-test"

	PasswordMaximumLength = 72
	PasswordMinimumLength = 5

	ServiceGitlab    = "gitlab"
	ServiceGoogle    = "google"
	ServiceOffice365 = "office365"
	ServiceOpenid    = "openid"

	GenericNoChannelNotification = "generic_no_channel"
	GenericNotification          = "generic"
	GenericNotificationServer    = "https://push-test.mattermost.com"
	MmSupportAdvisorAddress      = "support-advisor@mattermost.com"
	FullNotification             = "full"
	IdLoadedNotification         = "id_loaded"

	DirectMessageAny  = "any"
	DirectMessageTeam = "team"

	ShowUsername         = "username"
	ShowNicknameFullName = "nickname_full_name"
	ShowFullName         = "full_name"

	PermissionsAll          = "all"
	PermissionsChannelAdmin = "channel_admin"
	PermissionsTeamAdmin    = "team_admin"
	PermissionsSystemAdmin  = "system_admin"

	FakeSetting = "********************************"

	RestrictEmojiCreationAll         = "all"
	RestrictEmojiCreationAdmin       = "admin"
	RestrictEmojiCreationSystemAdmin = "system_admin"

	PermissionsDeletePostAll         = "all"
	PermissionsDeletePostTeamAdmin   = "team_admin"
	PermissionsDeletePostSystemAdmin = "system_admin"

	GroupUnreadChannelsDisabled   = "disabled"
	GroupUnreadChannelsDefaultOn  = "default_on"
	GroupUnreadChannelsDefaultOff = "default_off"

	CollapsedThreadsDisabled   = "disabled"
	CollapsedThreadsDefaultOn  = "default_on"
	CollapsedThreadsDefaultOff = "default_off"
	CollapsedThreadsAlwaysOn   = "always_on"

	EmailBatchingBufferSize = 256
	EmailBatchingInterval   = 30

	EmailNotificationContentsFull    = "full"
	EmailNotificationContentsGeneric = "generic"

	EmailSMTPDefaultServer = "localhost"
	EmailSMTPDefaultPort   = "10025"

	CacheTypeLRU   = "lru"
	CacheTypeRedis = "redis"

	SitenameMaxLength = 30

	ServiceSettingsDefaultSiteURL                = "http://localhost:8065"
	ServiceSettingsDefaultTLSCertFile            = ""
	ServiceSettingsDefaultTLSKeyFile             = ""
	ServiceSettingsDefaultReadTimeout            = 300
	ServiceSettingsDefaultWriteTimeout           = 300
	ServiceSettingsDefaultIdleTimeout            = 60
	ServiceSettingsDefaultMaxLoginAttempts       = 10
	ServiceSettingsDefaultAllowCorsFrom          = ""
	ServiceSettingsDefaultListenAndAddress       = ":8065"
	ServiceSettingsDefaultGiphySdkKeyTest        = "s0glxvzVg9azvPipKxcPLpXV0q1x1fVP"
	ServiceSettingsDefaultDeveloperFlags         = ""
	ServiceSettingsDefaultUniqueReactionsPerPost = 50
	ServiceSettingsDefaultMaxURLLength           = 2048
	ServiceSettingsMaxUniqueReactionsPerPost     = 500

	TeamSettingsDefaultSiteName              = "Mattermost"
	TeamSettingsDefaultMaxUsersPerTeam       = 50
	TeamSettingsDefaultCustomBrandText       = ""
	TeamSettingsDefaultCustomDescriptionText = ""
	TeamSettingsDefaultUserStatusAwayTimeout = 300

	SqlSettingsDefaultDataSource = "postgres://mmuser:mostest@localhost/mattermost_test?sslmode=disable&connect_timeout=10&binary_parameters=yes"

	FileSettingsDefaultDirectory                   = "./data/"
	FileSettingsDefaultS3UploadPartSizeBytes       = 5 * 1024 * 1024   // 5MB
	FileSettingsDefaultS3ExportUploadPartSizeBytes = 100 * 1024 * 1024 // 100MB

	ImportSettingsDefaultDirectory     = "./import"
	ImportSettingsDefaultRetentionDays = 30

	ExportSettingsDefaultDirectory     = "./export"
	ExportSettingsDefaultRetentionDays = 30

	EmailSettingsDefaultFeedbackOrganization = ""

	SupportSettingsDefaultTermsOfServiceLink = "https://mattermost.com/pl/terms-of-use/"
	SupportSettingsDefaultPrivacyPolicyLink  = "https://mattermost.com/pl/privacy-policy/"
	SupportSettingsDefaultAboutLink          = "https://mattermost.com/pl/about-mattermost"
	SupportSettingsDefaultHelpLink           = "https://mattermost.com/pl/help/"
	SupportSettingsDefaultReportAProblemLink = "https://mattermost.com/pl/report-a-bug"
	SupportSettingsDefaultSupportEmail       = ""
	SupportSettingsDefaultReAcceptancePeriod = 365

	SupportSettingsReportAProblemTypeLink    = "link"
	SupportSettingsReportAProblemTypeMail    = "email"
	SupportSettingsReportAProblemTypeHidden  = "hidden"
	SupportSettingsReportAProblemTypeDefault = "default"
	SupportSettingsDefaultReportAProblemType = SupportSettingsReportAProblemTypeDefault

	LdapSettingsDefaultFirstNameAttribute        = ""
	LdapSettingsDefaultLastNameAttribute         = ""
	LdapSettingsDefaultEmailAttribute            = ""
	LdapSettingsDefaultUsernameAttribute         = ""
	LdapSettingsDefaultNicknameAttribute         = ""
	LdapSettingsDefaultIdAttribute               = ""
	LdapSettingsDefaultPositionAttribute         = ""
	LdapSettingsDefaultLoginFieldName            = ""
	LdapSettingsDefaultGroupDisplayNameAttribute = ""
	LdapSettingsDefaultGroupIdAttribute          = ""
	LdapSettingsDefaultPictureAttribute          = ""
	LdapSettingsDefaultMaximumLoginAttempts      = 10

	SamlSettingsDefaultIdAttribute        = ""
	SamlSettingsDefaultGuestAttribute     = ""
	SamlSettingsDefaultAdminAttribute     = ""
	SamlSettingsDefaultFirstNameAttribute = ""
	SamlSettingsDefaultLastNameAttribute  = ""
	SamlSettingsDefaultEmailAttribute     = ""
	SamlSettingsDefaultUsernameAttribute  = ""
	SamlSettingsDefaultNicknameAttribute  = ""
	SamlSettingsDefaultLocaleAttribute    = ""
	SamlSettingsDefaultPositionAttribute  = ""

	SamlSettingsSignatureAlgorithmSha1    = "RSAwithSHA1"
	SamlSettingsSignatureAlgorithmSha256  = "RSAwithSHA256"
	SamlSettingsSignatureAlgorithmSha512  = "RSAwithSHA512"
	SamlSettingsDefaultSignatureAlgorithm = SamlSettingsSignatureAlgorithmSha1

	SamlSettingsCanonicalAlgorithmC14n    = "Canonical1.0"
	SamlSettingsCanonicalAlgorithmC14n11  = "Canonical1.1"
	SamlSettingsDefaultCanonicalAlgorithm = SamlSettingsCanonicalAlgorithmC14n

	NativeappSettingsDefaultAppDownloadLink        = "https://mattermost.com/pl/download-apps"
	NativeappSettingsDefaultAndroidAppDownloadLink = "https://mattermost.com/pl/android-app/"
	NativeappSettingsDefaultIosAppDownloadLink     = "https://mattermost.com/pl/ios-app/"

	ExperimentalSettingsDefaultLinkMetadataTimeoutMilliseconds                       = 5000
	ExperimentalSettingsDefaultUsersStatusAndProfileFetchingPollIntervalMilliseconds = 3000

	AnalyticsSettingsDefaultMaxUsersForStatistics = 2500

	AnnouncementSettingsDefaultBannerColor                  = "#f2a93b"
	AnnouncementSettingsDefaultBannerTextColor              = "#333333"
	AnnouncementSettingsDefaultNoticesJsonURL               = "https://notices.mattermost.com/"
	AnnouncementSettingsDefaultNoticesFetchFrequencySeconds = 3600

	TeamSettingsDefaultTeamText = "default"

	ElasticsearchSettingsDefaultConnectionURL               = "http://localhost:9200"
	ElasticsearchSettingsDefaultUsername                    = "elastic"
	ElasticsearchSettingsDefaultPassword                    = "changeme"
	ElasticsearchSettingsDefaultPostIndexReplicas           = 1
	ElasticsearchSettingsDefaultPostIndexShards             = 1
	ElasticsearchSettingsDefaultChannelIndexReplicas        = 1
	ElasticsearchSettingsDefaultChannelIndexShards          = 1
	ElasticsearchSettingsDefaultUserIndexReplicas           = 1
	ElasticsearchSettingsDefaultUserIndexShards             = 1
	ElasticsearchSettingsDefaultAggregatePostsAfterDays     = 365
	ElasticsearchSettingsDefaultPostsAggregatorJobStartTime = "03:00"
	ElasticsearchSettingsDefaultIndexPrefix                 = ""
	ElasticsearchSettingsDefaultLiveIndexingBatchSize       = 10
	ElasticsearchSettingsDefaultRequestTimeoutSeconds       = 30
	ElasticsearchSettingsDefaultBatchSize                   = 10000
	ElasticsearchSettingsESBackend                          = "elasticsearch"
	ElasticsearchSettingsOSBackend                          = "opensearch"

	BleveSettingsDefaultIndexDir  = ""
	BleveSettingsDefaultBatchSize = 10000

	DataRetentionSettingsDefaultMessageRetentionDays           = 365
	DataRetentionSettingsDefaultMessageRetentionHours          = 0
	DataRetentionSettingsDefaultFileRetentionDays              = 365
	DataRetentionSettingsDefaultFileRetentionHours             = 0
	DataRetentionSettingsDefaultBoardsRetentionDays            = 365
	DataRetentionSettingsDefaultDeletionJobStartTime           = "02:00"
	DataRetentionSettingsDefaultBatchSize                      = 3000
	DataRetentionSettingsDefaultTimeBetweenBatchesMilliseconds = 100
	DataRetentionSettingsDefaultRetentionIdsBatchSize          = 100

	OutgoingIntegrationRequestsDefaultTimeout = 30

	PluginSettingsDefaultDirectory         = "./plugins"
	PluginSettingsDefaultClientDirectory   = "./client/plugins"
	PluginSettingsDefaultEnableMarketplace = true
	PluginSettingsDefaultMarketplaceURL    = "https://api.integrations.mattermost.com"
	PluginSettingsOldMarketplaceURL        = "https://marketplace.integrations.mattermost.com"

	ComplianceExportDirectoryFormat                = "compliance-export-2006-01-02-15h04m"
	ComplianceExportPath                           = "export"
	ComplianceExportPathCLI                        = "cli"
	ComplianceExportTypeCsv                        = "csv"
	ComplianceExportTypeActiance                   = "actiance"
	ComplianceExportTypeGlobalrelay                = "globalrelay"
	ComplianceExportTypeGlobalrelayZip             = "globalrelay-zip"
	ComplianceExportChannelBatchSizeDefault        = 100
	ComplianceExportChannelHistoryBatchSizeDefault = 10

	GlobalrelayCustomerTypeA9     = "A9"
	GlobalrelayCustomerTypeA10    = "A10"
	GlobalrelayCustomerTypeCustom = "CUSTOM"

	ClientSideCertCheckPrimaryAuth   = "primary"
	ClientSideCertCheckSecondaryAuth = "secondary"

	ImageProxyTypeLocal     = "local"
	ImageProxyTypeAtmosCamo = "atmos/camo"

	GoogleSettingsDefaultScope           = "profile email"
	GoogleSettingsDefaultAuthEndpoint    = "https://accounts.google.com/o/oauth2/v2/auth"
	GoogleSettingsDefaultTokenEndpoint   = "https://www.googleapis.com/oauth2/v4/token"
	GoogleSettingsDefaultUserAPIEndpoint = "https://people.googleapis.com/v1/people/me?personFields=names,emailAddresses,nicknames,metadata"

	Office365SettingsDefaultScope           = "User.Read"
	Office365SettingsDefaultAuthEndpoint    = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
	Office365SettingsDefaultTokenEndpoint   = "https://login.microsoftonline.com/common/oauth2/v2.0/token"
	Office365SettingsDefaultUserAPIEndpoint = "https://graph.microsoft.com/v1.0/me"

	CloudSettingsDefaultCwsURL        = "https://customers.mattermost.com"
	CloudSettingsDefaultCwsAPIURL     = "https://portal.internal.prod.cloud.mattermost.com"
	CloudSettingsDefaultCwsURLTest    = "https://portal.test.cloud.mattermost.com"
	CloudSettingsDefaultCwsAPIURLTest = "https://api.internal.test.cloud.mattermost.com"

	OpenidSettingsDefaultScope = "profile openid email"

	LocalModeSocketPath = "/var/tmp/mattermost_local.socket"

	ConnectedWorkspacesSettingsDefaultMaxPostsPerSync = 50 // a bit more than 4 typical screenfulls of posts

	// These storage classes are the valid values for the x-amz-storage-class header. More documentation here https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutObject.html#AmazonS3-PutObject-request-header-StorageClass
	StorageClassStandard           = "STANDARD"
	StorageClassReducedRedundancy  = "REDUCED_REDUNDANCY"
	StorageClassStandardIA         = "STANDARD_IA"
	StorageClassOnezoneIA          = "ONEZONE_IA"
	StorageClassIntelligentTiering = "INTELLIGENT_TIERING"
	StorageClassGlacier            = "GLACIER"
	StorageClassDeepArchive        = "DEEP_ARCHIVE"
	StorageClassOutposts           = "OUTPOSTS"
	StorageClassGlacierIR          = "GLACIER_IR"
	StorageClassSnow               = "SNOW"
	StorageClassExpressOnezone     = "EXPRESS_ONEZONE"
)

func GetDefaultAppCustomURLSchemes() []string {
	return []string{"mmauth://", "mmauthbeta://"}
}

var ServerTLSSupportedCiphers = map[string]uint16{
	"TLS_RSA_WITH_RC4_128_SHA":                tls.TLS_RSA_WITH_RC4_128_SHA,
	"TLS_RSA_WITH_3DES_EDE_CBC_SHA":           tls.TLS_RSA_WITH_3DES_EDE_CBC_SHA,
	"TLS_RSA_WITH_AES_128_CBC_SHA":            tls.TLS_RSA_WITH_AES_128_CBC_SHA,
	"TLS_RSA_WITH_AES_256_CBC_SHA":            tls.TLS_RSA_WITH_AES_256_CBC_SHA,
	"TLS_RSA_WITH_AES_128_CBC_SHA256":         tls.TLS_RSA_WITH_AES_128_CBC_SHA256,
	"TLS_RSA_WITH_AES_128_GCM_SHA256":         tls.TLS_RSA_WITH_AES_128_GCM_SHA256,
	"TLS_RSA_WITH_AES_256_GCM_SHA384":         tls.TLS_RSA_WITH_AES_256_GCM_SHA384,
	"TLS_ECDHE_ECDSA_WITH_RC4_128_SHA":        tls.TLS_ECDHE_ECDSA_WITH_RC4_128_SHA,
	"TLS_ECDHE_ECDSA_WITH_AES_128_CBC_SHA":    tls.TLS_ECDHE_ECDSA_WITH_AES_128_CBC_SHA,
	"TLS_ECDHE_ECDSA_WITH_AES_256_CBC_SHA":    tls.TLS_ECDHE_ECDSA_WITH_AES_256_CBC_SHA,
	"TLS_ECDHE_RSA_WITH_RC4_128_SHA":          tls.TLS_ECDHE_RSA_WITH_RC4_128_SHA,
	"TLS_ECDHE_RSA_WITH_3DES_EDE_CBC_SHA":     tls.TLS_ECDHE_RSA_WITH_3DES_EDE_CBC_SHA,
	"TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA":      tls.TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA,
	"TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA":      tls.TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA,
	"TLS_ECDHE_ECDSA_WITH_AES_128_CBC_SHA256": tls.TLS_ECDHE_ECDSA_WITH_AES_128_CBC_SHA256,
	"TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA256":   tls.TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA256,
	"TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256":   tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,
	"TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256": tls.TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256,
	"TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384":   tls.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,
	"TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384": tls.TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384,
	"TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305":    tls.TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305,
	"TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305":  tls.TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305,
}

type ServiceSettings struct {
	SiteURL             *string `access:"environment_web_server,authentication_saml,write_restrictable"`
	WebsocketURL        *string `access:"write_restrictable,cloud_restrictable"`
	LicenseFileLocation *string `access:"write_restrictable,cloud_restrictable"`                        // telemetry: none
	ListenAddress       *string `access:"environment_web_server,write_restrictable,cloud_restrictable"` // telemetry: none
	ConnectionSecurity  *string `access:"environment_web_server,write_restrictable,cloud_restrictable"`
	TLSCertFile         *string `access:"environment_web_server,write_restrictable,cloud_restrictable"`
	TLSKeyFile          *string `access:"environment_web_server,write_restrictable,cloud_restrictable"`
	TLSMinVer           *string `access:"write_restrictable,cloud_restrictable"` // telemetry: none
	TLSStrictTransport  *bool   `access:"write_restrictable,cloud_restrictable"`
	// In seconds.
	TLSStrictTransportMaxAge            *int64   `access:"write_restrictable,cloud_restrictable"` // telemetry: none
	TLSOverwriteCiphers                 []string `access:"write_restrictable,cloud_restrictable"` // telemetry: none
	UseLetsEncrypt                      *bool    `access:"environment_web_server,write_restrictable,cloud_restrictable"`
	LetsEncryptCertificateCacheFile     *string  `access:"environment_web_server,write_restrictable,cloud_restrictable"` // telemetry: none
	Forward80To443                      *bool    `access:"environment_web_server,write_restrictable,cloud_restrictable"`
	TrustedProxyIPHeader                []string `access:"write_restrictable,cloud_restrictable"` // telemetry: none
	ReadTimeout                         *int     `access:"environment_web_server,write_restrictable,cloud_restrictable"`
	WriteTimeout                        *int     `access:"environment_web_server,write_restrictable,cloud_restrictable"`
	IdleTimeout                         *int     `access:"write_restrictable,cloud_restrictable"`
	MaximumLoginAttempts                *int     `access:"authentication_password,write_restrictable,cloud_restrictable"`
	GoroutineHealthThreshold            *int     `access:"write_restrictable,cloud_restrictable"` // telemetry: none
	EnableOAuthServiceProvider          *bool    `access:"integrations_integration_management"`
	EnableIncomingWebhooks              *bool    `access:"integrations_integration_management"`
	EnableOutgoingWebhooks              *bool    `access:"integrations_integration_management"`
	EnableOutgoingOAuthConnections      *bool    `access:"integrations_integration_management"`
	EnableCommands                      *bool    `access:"integrations_integration_management"`
	OutgoingIntegrationRequestsTimeout  *int64   `access:"integrations_integration_management"` // In seconds.
	EnablePostUsernameOverride          *bool    `access:"integrations_integration_management"`
	EnablePostIconOverride              *bool    `access:"integrations_integration_management"`
	GoogleDeveloperKey                  *string  `access:"site_posts,write_restrictable,cloud_restrictable"`
	EnableLinkPreviews                  *bool    `access:"site_posts"`
	EnablePermalinkPreviews             *bool    `access:"site_posts"`
	RestrictLinkPreviews                *string  `access:"site_posts"`
	EnableTesting                       *bool    `access:"environment_developer,write_restrictable,cloud_restrictable"`
	EnableDeveloper                     *bool    `access:"environment_developer,write_restrictable,cloud_restrictable"`
	DeveloperFlags                      *string  `access:"environment_developer,cloud_restrictable"`
	EnableClientPerformanceDebugging    *bool    `access:"environment_developer,write_restrictable,cloud_restrictable"`
	EnableSecurityFixAlert              *bool    `access:"environment_smtp,write_restrictable,cloud_restrictable"`
	EnableInsecureOutgoingConnections   *bool    `access:"environment_web_server,write_restrictable,cloud_restrictable"`
	AllowedUntrustedInternalConnections *string  `access:"environment_web_server,write_restrictable,cloud_restrictable"`
	EnableMultifactorAuthentication     *bool    `access:"authentication_mfa"`
	EnforceMultifactorAuthentication    *bool    `access:"authentication_mfa"`
	EnableUserAccessTokens              *bool    `access:"integrations_integration_management"`
	AllowCorsFrom                       *string  `access:"integrations_cors,write_restrictable,cloud_restrictable"`
	CorsExposedHeaders                  *string  `access:"integrations_cors,write_restrictable,cloud_restrictable"`
	CorsAllowCredentials                *bool    `access:"integrations_cors,write_restrictable,cloud_restrictable"`
	CorsDebug                           *bool    `access:"integrations_cors,write_restrictable,cloud_restrictable"`
	AllowCookiesForSubdomains           *bool    `access:"write_restrictable,cloud_restrictable"`
	ExtendSessionLengthWithActivity     *bool    `access:"environment_session_lengths,write_restrictable,cloud_restrictable"`
	TerminateSessionsOnPasswordChange   *bool    `access:"environment_session_lengths,write_restrictable,cloud_restrictable"`

	// Deprecated
	SessionLengthWebInDays  *int `access:"environment_session_lengths,write_restrictable,cloud_restrictable"` // telemetry: none
	SessionLengthWebInHours *int `access:"environment_session_lengths,write_restrictable,cloud_restrictable"`
	// Deprecated
	SessionLengthMobileInDays  *int `access:"environment_session_lengths,write_restrictable,cloud_restrictable"` // telemetry: none
	SessionLengthMobileInHours *int `access:"environment_session_lengths,write_restrictable,cloud_restrictable"`
	// Deprecated
	SessionLengthSSOInDays  *int `access:"environment_session_lengths,write_restrictable,cloud_restrictable"` // telemetry: none
	SessionLengthSSOInHours *int `access:"environment_session_lengths,write_restrictable,cloud_restrictable"`

	SessionCacheInMinutes                             *int    `access:"environment_session_lengths,write_restrictable,cloud_restrictable"`
	SessionIdleTimeoutInMinutes                       *int    `access:"environment_session_lengths,write_restrictable,cloud_restrictable"`
	WebsocketSecurePort                               *int    `access:"write_restrictable,cloud_restrictable"` // telemetry: none
	WebsocketPort                                     *int    `access:"write_restrictable,cloud_restrictable"` // telemetry: none
	WebserverMode                                     *string `access:"environment_web_server,write_restrictable,cloud_restrictable"`
	EnableGifPicker                                   *bool   `access:"integrations_gif"`
	GiphySdkKey                                       *string `access:"integrations_gif"`
	EnableCustomEmoji                                 *bool   `access:"site_emoji"`
	EnableEmojiPicker                                 *bool   `access:"site_emoji"`
	PostEditTimeLimit                                 *int    `access:"user_management_permissions"`
	TimeBetweenUserTypingUpdatesMilliseconds          *int64  `access:"experimental_features,write_restrictable,cloud_restrictable"`
	EnableCrossTeamSearch                             *bool   `access:"write_restrictable,cloud_restrictable"`
	EnablePostSearch                                  *bool   `access:"write_restrictable,cloud_restrictable"`
	EnableFileSearch                                  *bool   `access:"write_restrictable"`
	MinimumHashtagLength                              *int    `access:"environment_database,write_restrictable,cloud_restrictable"`
	EnableUserTypingMessages                          *bool   `access:"experimental_features,write_restrictable,cloud_restrictable"`
	EnableChannelViewedMessages                       *bool   `access:"experimental_features,write_restrictable,cloud_restrictable"`
	EnableUserStatuses                                *bool   `access:"write_restrictable,cloud_restrictable"`
	ExperimentalEnableAuthenticationTransfer          *bool   `access:"experimental_features"`
	ClusterLogTimeoutMilliseconds                     *int    `access:"write_restrictable,cloud_restrictable"`
	EnableTutorial                                    *bool   `access:"experimental_features"`
	EnableOnboardingFlow                              *bool   `access:"experimental_features"`
	ExperimentalEnableDefaultChannelLeaveJoinMessages *bool   `access:"experimental_features"`
	ExperimentalGroupUnreadChannels                   *string `access:"experimental_features"`
	EnableAPITeamDeletion                             *bool
	EnableAPITriggerAdminNotifications                *bool
	EnableAPIUserDeletion                             *bool
	EnableAPIPostDeletion                             *bool
	EnableDesktopLandingPage                          *bool
	ExperimentalEnableHardenedMode                    *bool `access:"experimental_features"`
	ExperimentalStrictCSRFEnforcement                 *bool `access:"experimental_features,write_restrictable,cloud_restrictable"`
	EnableEmailInvitations                            *bool `access:"authentication_signup"`
	DisableBotsWhenOwnerIsDeactivated                 *bool `access:"integrations_bot_accounts"`
	EnableBotAccountCreation                          *bool `access:"integrations_bot_accounts"`
	EnableSVGs                                        *bool `access:"site_posts"`
	EnableLatex                                       *bool `access:"site_posts"`
	EnableInlineLatex                                 *bool `access:"site_posts"`
	PostPriority                                      *bool `access:"site_posts"`
	AllowPersistentNotifications                      *bool `access:"site_posts"`
	AllowPersistentNotificationsForGuests             *bool `access:"site_posts"`
	PersistentNotificationIntervalMinutes             *int  `access:"site_posts"`
	PersistentNotificationMaxCount                    *int  `access:"site_posts"`
	PersistentNotificationMaxRecipients               *int  `access:"site_posts"`
	EnableAPIChannelDeletion                          *bool
	EnableLocalMode                                   *bool   `access:"cloud_restrictable"`
	LocalModeSocketLocation                           *string `access:"cloud_restrictable"` // telemetry: none
	EnableAWSMetering                                 *bool   // telemetry: none
	SplitKey                                          *string `access:"experimental_feature_flags,write_restrictable"` // telemetry: none
	FeatureFlagSyncIntervalSeconds                    *int    `access:"experimental_feature_flags,write_restrictable"` // telemetry: none
	DebugSplit                                        *bool   `access:"experimental_feature_flags,write_restrictable"` // telemetry: none
	ThreadAutoFollow                                  *bool   `access:"experimental_features"`
	CollapsedThreads                                  *string `access:"experimental_features"`
	ManagedResourcePaths                              *string `access:"environment_web_server,write_restrictable,cloud_restrictable"`
	EnableCustomGroups                                *bool   `access:"site_users_and_teams"`
	AllowSyncedDrafts                                 *bool   `access:"site_posts"`
	UniqueEmojiReactionLimitPerPost                   *int    `access:"site_posts"`
	RefreshPostStatsRunTime                           *string `access:"site_users_and_teams"`
	MaximumPayloadSizeBytes                           *int64  `access:"environment_file_storage,write_restrictable,cloud_restrictable"`
	MaximumURLLength                                  *int    `access:"environment_file_storage,write_restrictable,cloud_restrictable"`
	ScheduledPosts                                    *bool   `access:"site_posts"`
	EnableWebHubChannelIteration                      *bool   `access:"write_restrictable,cloud_restrictable"` // telemetry: none
	FrameAncestors                                    *string `access:"write_restrictable,cloud_restrictable"` // telemetry: none
}

var MattermostGiphySdkKey string

func (s *ServiceSettings) SetDefaults(isUpdate bool) {
	if s.EnableEmailInvitations == nil {
		// If the site URL is also not present then assume this is a clean install
		if s.SiteURL == nil {
			s.EnableEmailInvitations = NewPointer(false)
		} else {
			s.EnableEmailInvitations = NewPointer(true)
		}
	}

	if s.SiteURL == nil {
		if s.EnableDeveloper != nil && *s.EnableDeveloper {
			s.SiteURL = NewPointer(ServiceSettingsDefaultSiteURL)
		} else {
			s.SiteURL = NewPointer("")
		}
	}

	if s.WebsocketURL == nil {
		s.WebsocketURL = NewPointer("")
	}

	if s.LicenseFileLocation == nil {
		s.LicenseFileLocation = NewPointer("")
	}

	if s.ListenAddress == nil {
		s.ListenAddress = NewPointer(ServiceSettingsDefaultListenAndAddress)
	}

	if s.EnableLinkPreviews == nil {
		s.EnableLinkPreviews = NewPointer(true)
	}

	if s.EnablePermalinkPreviews == nil {
		s.EnablePermalinkPreviews = NewPointer(true)
	}

	if s.RestrictLinkPreviews == nil {
		s.RestrictLinkPreviews = NewPointer("")
	}

	if s.EnableTesting == nil {
		s.EnableTesting = NewPointer(false)
	}

	if s.EnableDeveloper == nil {
		s.EnableDeveloper = NewPointer(false)
	}

	if s.DeveloperFlags == nil {
		s.DeveloperFlags = NewPointer("")
	}

	if s.EnableClientPerformanceDebugging == nil {
		s.EnableClientPerformanceDebugging = NewPointer(false)
	}

	if s.EnableSecurityFixAlert == nil {
		s.EnableSecurityFixAlert = NewPointer(true)
	}

	if s.EnableInsecureOutgoingConnections == nil {
		s.EnableInsecureOutgoingConnections = NewPointer(false)
	}

	if s.AllowedUntrustedInternalConnections == nil {
		s.AllowedUntrustedInternalConnections = NewPointer("")
	}

	if s.EnableMultifactorAuthentication == nil {
		s.EnableMultifactorAuthentication = NewPointer(false)
	}

	if s.EnforceMultifactorAuthentication == nil {
		s.EnforceMultifactorAuthentication = NewPointer(false)
	}

	if s.EnableUserAccessTokens == nil {
		s.EnableUserAccessTokens = NewPointer(false)
	}

	if s.GoroutineHealthThreshold == nil {
		s.GoroutineHealthThreshold = NewPointer(-1)
	}

	if s.GoogleDeveloperKey == nil {
		s.GoogleDeveloperKey = NewPointer("")
	}

	if s.EnableOAuthServiceProvider == nil {
		s.EnableOAuthServiceProvider = NewPointer(true)
	}

	if s.EnableIncomingWebhooks == nil {
		s.EnableIncomingWebhooks = NewPointer(true)
	}

	if s.EnableOutgoingWebhooks == nil {
		s.EnableOutgoingWebhooks = NewPointer(true)
	}

	if s.EnableOutgoingOAuthConnections == nil {
		s.EnableOutgoingOAuthConnections = NewPointer(false)
	}

	if s.OutgoingIntegrationRequestsTimeout == nil {
		s.OutgoingIntegrationRequestsTimeout = NewPointer(int64(OutgoingIntegrationRequestsDefaultTimeout))
	}

	if s.ConnectionSecurity == nil {
		s.ConnectionSecurity = NewPointer("")
	}

	if s.TLSKeyFile == nil {
		s.TLSKeyFile = NewPointer(ServiceSettingsDefaultTLSKeyFile)
	}

	if s.TLSCertFile == nil {
		s.TLSCertFile = NewPointer(ServiceSettingsDefaultTLSCertFile)
	}

	if s.TLSMinVer == nil {
		s.TLSMinVer = NewPointer("1.2")
	}

	if s.TLSStrictTransport == nil {
		s.TLSStrictTransport = NewPointer(false)
	}

	if s.TLSStrictTransportMaxAge == nil {
		s.TLSStrictTransportMaxAge = NewPointer(int64(63072000))
	}

	if s.TLSOverwriteCiphers == nil {
		s.TLSOverwriteCiphers = []string{}
	}

	if s.UseLetsEncrypt == nil {
		s.UseLetsEncrypt = NewPointer(false)
	}

	if s.LetsEncryptCertificateCacheFile == nil {
		s.LetsEncryptCertificateCacheFile = NewPointer("./config/letsencrypt.cache")
	}

	if s.ReadTimeout == nil {
		s.ReadTimeout = NewPointer(ServiceSettingsDefaultReadTimeout)
	}

	if s.WriteTimeout == nil {
		s.WriteTimeout = NewPointer(ServiceSettingsDefaultWriteTimeout)
	}

	if s.IdleTimeout == nil {
		s.IdleTimeout = NewPointer(ServiceSettingsDefaultIdleTimeout)
	}

	if s.MaximumLoginAttempts == nil {
		s.MaximumLoginAttempts = NewPointer(ServiceSettingsDefaultMaxLoginAttempts)
	}

	if s.Forward80To443 == nil {
		s.Forward80To443 = NewPointer(false)
	}

	if s.TrustedProxyIPHeader == nil {
		s.TrustedProxyIPHeader = []string{}
	}

	if s.TimeBetweenUserTypingUpdatesMilliseconds == nil {
		s.TimeBetweenUserTypingUpdatesMilliseconds = NewPointer(int64(5000))
	}

	if s.EnableCrossTeamSearch == nil {
		s.EnableCrossTeamSearch = NewPointer(true)
	}

	if s.EnablePostSearch == nil {
		s.EnablePostSearch = NewPointer(true)
	}

	if s.EnableFileSearch == nil {
		s.EnableFileSearch = NewPointer(true)
	}

	if s.MinimumHashtagLength == nil {
		s.MinimumHashtagLength = NewPointer(3)
	}

	if s.EnableUserTypingMessages == nil {
		s.EnableUserTypingMessages = NewPointer(true)
	}

	if s.EnableChannelViewedMessages == nil {
		s.EnableChannelViewedMessages = NewPointer(true)
	}

	if s.EnableUserStatuses == nil {
		s.EnableUserStatuses = NewPointer(true)
	}

	if s.ClusterLogTimeoutMilliseconds == nil {
		s.ClusterLogTimeoutMilliseconds = NewPointer(2000)
	}

	if s.EnableTutorial == nil {
		s.EnableTutorial = NewPointer(true)
	}

	if s.EnableOnboardingFlow == nil {
		s.EnableOnboardingFlow = NewPointer(true)
	}

	// Must be manually enabled for existing installations.
	if s.ExtendSessionLengthWithActivity == nil {
		s.ExtendSessionLengthWithActivity = NewPointer(!isUpdate)
	}

	// Must be manually enabled for existing installations.
	if s.TerminateSessionsOnPasswordChange == nil {
		s.TerminateSessionsOnPasswordChange = NewPointer(!isUpdate)
	}

	if s.SessionLengthWebInDays == nil {
		if isUpdate {
			s.SessionLengthWebInDays = NewPointer(180)
		} else {
			s.SessionLengthWebInDays = NewPointer(30)
		}
	}

	if s.SessionLengthWebInHours == nil {
		var webTTLDays int
		if s.SessionLengthWebInDays == nil {
			if isUpdate {
				webTTLDays = 180
			} else {
				webTTLDays = 30
			}
		} else {
			webTTLDays = *s.SessionLengthWebInDays
		}
		s.SessionLengthWebInHours = NewPointer(webTTLDays * 24)
	}

	if s.SessionLengthMobileInDays == nil {
		if isUpdate {
			s.SessionLengthMobileInDays = NewPointer(180)
		} else {
			s.SessionLengthMobileInDays = NewPointer(30)
		}
	}

	if s.SessionLengthMobileInHours == nil {
		var mobileTTLDays int
		if s.SessionLengthMobileInDays == nil {
			if isUpdate {
				mobileTTLDays = 180
			} else {
				mobileTTLDays = 30
			}
		} else {
			mobileTTLDays = *s.SessionLengthMobileInDays
		}
		s.SessionLengthMobileInHours = NewPointer(mobileTTLDays * 24)
	}

	if s.SessionLengthSSOInDays == nil {
		s.SessionLengthSSOInDays = NewPointer(30)
	}

	if s.SessionLengthSSOInHours == nil {
		var ssoTTLDays int
		if s.SessionLengthSSOInDays == nil {
			ssoTTLDays = 30
		} else {
			ssoTTLDays = *s.SessionLengthSSOInDays
		}
		s.SessionLengthSSOInHours = NewPointer(ssoTTLDays * 24)
	}

	if s.SessionCacheInMinutes == nil {
		s.SessionCacheInMinutes = NewPointer(10)
	}

	if s.SessionIdleTimeoutInMinutes == nil {
		s.SessionIdleTimeoutInMinutes = NewPointer(43200)
	}

	if s.EnableCommands == nil {
		s.EnableCommands = NewPointer(true)
	}

	if s.EnablePostUsernameOverride == nil {
		s.EnablePostUsernameOverride = NewPointer(false)
	}

	if s.EnablePostIconOverride == nil {
		s.EnablePostIconOverride = NewPointer(false)
	}

	if s.WebsocketPort == nil {
		s.WebsocketPort = NewPointer(80)
	}

	if s.WebsocketSecurePort == nil {
		s.WebsocketSecurePort = NewPointer(443)
	}

	if s.AllowCorsFrom == nil {
		s.AllowCorsFrom = NewPointer(ServiceSettingsDefaultAllowCorsFrom)
	}

	if s.CorsExposedHeaders == nil {
		s.CorsExposedHeaders = NewPointer("")
	}

	if s.CorsAllowCredentials == nil {
		s.CorsAllowCredentials = NewPointer(false)
	}

	if s.CorsDebug == nil {
		s.CorsDebug = NewPointer(false)
	}

	if s.AllowCookiesForSubdomains == nil {
		s.AllowCookiesForSubdomains = NewPointer(false)
	}

	if s.WebserverMode == nil {
		s.WebserverMode = NewPointer("gzip")
	} else if *s.WebserverMode == "regular" {
		*s.WebserverMode = "gzip"
	}

	if s.EnableCustomEmoji == nil {
		s.EnableCustomEmoji = NewPointer(true)
	}

	if s.EnableEmojiPicker == nil {
		s.EnableEmojiPicker = NewPointer(true)
	}

	if s.EnableGifPicker == nil {
		s.EnableGifPicker = NewPointer(true)
	}

	if s.GiphySdkKey == nil || *s.GiphySdkKey == "" {
		s.GiphySdkKey = NewPointer("")
	}

	if s.ExperimentalEnableAuthenticationTransfer == nil {
		s.ExperimentalEnableAuthenticationTransfer = NewPointer(true)
	}

	if s.PostEditTimeLimit == nil {
		s.PostEditTimeLimit = NewPointer(-1)
	}

	if s.ExperimentalEnableDefaultChannelLeaveJoinMessages == nil {
		s.ExperimentalEnableDefaultChannelLeaveJoinMessages = NewPointer(true)
	}

	if s.ExperimentalGroupUnreadChannels == nil {
		s.ExperimentalGroupUnreadChannels = NewPointer(GroupUnreadChannelsDisabled)
	} else if *s.ExperimentalGroupUnreadChannels == "0" {
		s.ExperimentalGroupUnreadChannels = NewPointer(GroupUnreadChannelsDisabled)
	} else if *s.ExperimentalGroupUnreadChannels == "1" {
		s.ExperimentalGroupUnreadChannels = NewPointer(GroupUnreadChannelsDefaultOn)
	}

	if s.EnableAPITeamDeletion == nil {
		s.EnableAPITeamDeletion = NewPointer(false)
	}

	if s.EnableAPITriggerAdminNotifications == nil {
		s.EnableAPITriggerAdminNotifications = NewPointer(false)
	}

	if s.EnableAPIUserDeletion == nil {
		s.EnableAPIUserDeletion = NewPointer(false)
	}

	if s.EnableAPIPostDeletion == nil {
		s.EnableAPIPostDeletion = NewPointer(false)
	}

	if s.EnableAPIChannelDeletion == nil {
		s.EnableAPIChannelDeletion = NewPointer(false)
	}

	if s.ExperimentalEnableHardenedMode == nil {
		s.ExperimentalEnableHardenedMode = NewPointer(false)
	}

	if s.ExperimentalStrictCSRFEnforcement == nil {
		s.ExperimentalStrictCSRFEnforcement = NewPointer(false)
	}

	if s.DisableBotsWhenOwnerIsDeactivated == nil {
		s.DisableBotsWhenOwnerIsDeactivated = NewPointer(true)
	}

	if s.EnableBotAccountCreation == nil {
		s.EnableBotAccountCreation = NewPointer(false)
	}

	if s.EnableDesktopLandingPage == nil {
		s.EnableDesktopLandingPage = NewPointer(true)
	}

	if s.EnableSVGs == nil {
		if isUpdate {
			s.EnableSVGs = NewPointer(true)
		} else {
			s.EnableSVGs = NewPointer(false)
		}
	}

	if s.EnableLatex == nil {
		if isUpdate {
			s.EnableLatex = NewPointer(true)
		} else {
			s.EnableLatex = NewPointer(false)
		}
	}

	if s.EnableInlineLatex == nil {
		s.EnableInlineLatex = NewPointer(true)
	}

	if s.EnableLocalMode == nil {
		s.EnableLocalMode = NewPointer(false)
	}

	if s.LocalModeSocketLocation == nil {
		s.LocalModeSocketLocation = NewPointer(LocalModeSocketPath)
	}

	if s.EnableAWSMetering == nil {
		s.EnableAWSMetering = NewPointer(false)
	}

	if s.SplitKey == nil {
		s.SplitKey = NewPointer("")
	}

	if s.FeatureFlagSyncIntervalSeconds == nil {
		s.FeatureFlagSyncIntervalSeconds = NewPointer(30)
	}

	if s.DebugSplit == nil {
		s.DebugSplit = NewPointer(false)
	}

	if s.ThreadAutoFollow == nil {
		s.ThreadAutoFollow = NewPointer(true)
	}

	if s.CollapsedThreads == nil {
		s.CollapsedThreads = NewPointer(CollapsedThreadsAlwaysOn)
	}

	if s.ManagedResourcePaths == nil {
		s.ManagedResourcePaths = NewPointer("")
	}

	if s.EnableCustomGroups == nil {
		s.EnableCustomGroups = NewPointer(true)
	}

	if s.PostPriority == nil {
		s.PostPriority = NewPointer(true)
	}

	if s.AllowPersistentNotifications == nil {
		s.AllowPersistentNotifications = NewPointer(true)
	}

	if s.AllowPersistentNotificationsForGuests == nil {
		s.AllowPersistentNotificationsForGuests = NewPointer(false)
	}

	if s.PersistentNotificationIntervalMinutes == nil {
		s.PersistentNotificationIntervalMinutes = NewPointer(5)
	}

	if s.PersistentNotificationMaxCount == nil {
		s.PersistentNotificationMaxCount = NewPointer(6)
	}

	if s.PersistentNotificationMaxRecipients == nil {
		s.PersistentNotificationMaxRecipients = NewPointer(5)
	}

	if s.AllowSyncedDrafts == nil {
		s.AllowSyncedDrafts = NewPointer(true)
	}

	if s.UniqueEmojiReactionLimitPerPost == nil {
		s.UniqueEmojiReactionLimitPerPost = NewPointer(ServiceSettingsDefaultUniqueReactionsPerPost)
	}

	if *s.UniqueEmojiReactionLimitPerPost > ServiceSettingsMaxUniqueReactionsPerPost {
		s.UniqueEmojiReactionLimitPerPost = NewPointer(ServiceSettingsMaxUniqueReactionsPerPost)
	}

	if s.RefreshPostStatsRunTime == nil {
		s.RefreshPostStatsRunTime = NewPointer("00:00")
	}

	if s.MaximumPayloadSizeBytes == nil {
		s.MaximumPayloadSizeBytes = NewPointer(int64(300000))
	}

	if s.MaximumURLLength == nil {
		s.MaximumURLLength = NewPointer(ServiceSettingsDefaultMaxURLLength)
	}

	if s.ScheduledPosts == nil {
		s.ScheduledPosts = NewPointer(true)
	}

	if s.EnableWebHubChannelIteration == nil {
		s.EnableWebHubChannelIteration = NewPointer(false)
	}

	if s.FrameAncestors == nil {
		s.FrameAncestors = NewPointer("")
	}
}

type CacheSettings struct {
	CacheType          *string `access:",write_restrictable,cloud_restrictable"`
	RedisAddress       *string `access:",write_restrictable,cloud_restrictable"` // telemetry: none
	RedisPassword      *string `access:",write_restrictable,cloud_restrictable"` // telemetry: none
	RedisDB            *int    `access:",write_restrictable,cloud_restrictable"` // telemetry: none
	RedisCachePrefix   *string `access:",write_restrictable,cloud_restrictable"` // telemetry: none
	DisableClientCache *bool   `access:",write_restrictable,cloud_restrictable"` // telemetry: none
}

func (s *CacheSettings) SetDefaults() {
	if s.CacheType == nil {
		s.CacheType = NewPointer(CacheTypeLRU)
	}

	if s.RedisAddress == nil {
		s.RedisAddress = NewPointer("")
	}

	if s.RedisPassword == nil {
		s.RedisPassword = NewPointer("")
	}

	if s.RedisDB == nil {
		s.RedisDB = NewPointer(-1)
	}

	if s.RedisCachePrefix == nil {
		s.RedisCachePrefix = NewPointer("")
	}

	if s.DisableClientCache == nil {
		s.DisableClientCache = NewPointer(false)
	}
}

func (s *CacheSettings) isValid() *AppError {
	if *s.CacheType != CacheTypeLRU && *s.CacheType != CacheTypeRedis {
		return NewAppError("Config.IsValid", "model.config.is_valid.cache_type.app_error", nil, "", http.StatusBadRequest)
	}

	if *s.CacheType == CacheTypeRedis && *s.RedisAddress == "" {
		return NewAppError("Config.IsValid", "model.config.is_valid.empty_redis_address.app_error", nil, "", http.StatusBadRequest)
	}

	if *s.CacheType == CacheTypeRedis && *s.RedisDB < 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.invalid_redis_db.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

type ClusterSettings struct {
	Enable                             *bool   `access:"environment_high_availability,write_restrictable"`
	ClusterName                        *string `access:"environment_high_availability,write_restrictable,cloud_restrictable"` // telemetry: none
	OverrideHostname                   *string `access:"environment_high_availability,write_restrictable,cloud_restrictable"` // telemetry: none
	NetworkInterface                   *string `access:"environment_high_availability,write_restrictable,cloud_restrictable"`
	BindAddress                        *string `access:"environment_high_availability,write_restrictable,cloud_restrictable"`
	AdvertiseAddress                   *string `access:"environment_high_availability,write_restrictable,cloud_restrictable"`
	UseIPAddress                       *bool   `access:"environment_high_availability,write_restrictable,cloud_restrictable"`
	EnableGossipCompression            *bool   `access:"environment_high_availability,write_restrictable,cloud_restrictable"`
	EnableExperimentalGossipEncryption *bool   `access:"environment_high_availability,write_restrictable,cloud_restrictable"`
	ReadOnlyConfig                     *bool   `access:"environment_high_availability,write_restrictable,cloud_restrictable"`
	GossipPort                         *int    `access:"environment_high_availability,write_restrictable,cloud_restrictable"` // telemetry: none
}

func (s *ClusterSettings) SetDefaults() {
	if s.Enable == nil {
		s.Enable = NewPointer(false)
	}

	if s.ClusterName == nil {
		s.ClusterName = NewPointer("")
	}

	if s.OverrideHostname == nil {
		s.OverrideHostname = NewPointer("")
	}

	if s.NetworkInterface == nil {
		s.NetworkInterface = NewPointer("")
	}

	if s.BindAddress == nil {
		s.BindAddress = NewPointer("")
	}

	if s.AdvertiseAddress == nil {
		s.AdvertiseAddress = NewPointer("")
	}

	if s.UseIPAddress == nil {
		s.UseIPAddress = NewPointer(true)
	}

	if s.EnableExperimentalGossipEncryption == nil {
		s.EnableExperimentalGossipEncryption = NewPointer(false)
	}

	if s.EnableGossipCompression == nil {
		s.EnableGossipCompression = NewPointer(true)
	}

	if s.ReadOnlyConfig == nil {
		s.ReadOnlyConfig = NewPointer(true)
	}

	if s.GossipPort == nil {
		s.GossipPort = NewPointer(8074)
	}
}

type MetricsSettings struct {
	Enable                    *bool    `access:"environment_performance_monitoring,write_restrictable,cloud_restrictable"`
	BlockProfileRate          *int     `access:"environment_performance_monitoring,write_restrictable,cloud_restrictable"`
	ListenAddress             *string  `access:"environment_performance_monitoring,write_restrictable,cloud_restrictable"` // telemetry: none
	EnableClientMetrics       *bool    `access:"environment_performance_monitoring,write_restrictable,cloud_restrictable"`
	EnableNotificationMetrics *bool    `access:"environment_performance_monitoring,write_restrictable,cloud_restrictable"`
	ClientSideUserIds         []string `access:"environment_performance_monitoring,write_restrictable,cloud_restrictable"` // telemetry: none
}

func (s *MetricsSettings) SetDefaults() {
	if s.ListenAddress == nil {
		s.ListenAddress = NewPointer(":8067")
	}

	if s.Enable == nil {
		s.Enable = NewPointer(false)
	}

	if s.BlockProfileRate == nil {
		s.BlockProfileRate = NewPointer(0)
	}

	if s.EnableClientMetrics == nil {
		s.EnableClientMetrics = NewPointer(true)
	}

	if s.EnableNotificationMetrics == nil {
		s.EnableNotificationMetrics = NewPointer(true)
	}

	if s.ClientSideUserIds == nil {
		s.ClientSideUserIds = []string{}
	}
}

func (s *MetricsSettings) isValid() *AppError {
	const maxLength = 5
	if len(s.ClientSideUserIds) > maxLength {
		return NewAppError("MetricsSettings.IsValid", "model.config.is_valid.metrics_client_side_user_ids.app_error", map[string]any{"MaxLength": maxLength, "CurrentLength": len(s.ClientSideUserIds)}, "", http.StatusBadRequest)
	}
	for _, id := range s.ClientSideUserIds {
		if !IsValidId(id) {
			return NewAppError("MetricsSettings.IsValid", "model.config.is_valid.metrics_client_side_user_id.app_error", map[string]any{"Id": id}, "", http.StatusBadRequest)
		}
	}
	return nil
}

type ExperimentalSettings struct {
	ClientSideCertEnable                                  *bool   `access:"experimental_features,cloud_restrictable"`
	ClientSideCertCheck                                   *string `access:"experimental_features,cloud_restrictable"`
	LinkMetadataTimeoutMilliseconds                       *int64  `access:"experimental_features,write_restrictable,cloud_restrictable"`
	RestrictSystemAdmin                                   *bool   `access:"*_read,write_restrictable"`
	EnableSharedChannels                                  *bool   `access:"experimental_features"` // Deprecated: use `ConnectedWorkspacesSettings.EnableSharedChannels`
	EnableRemoteClusterService                            *bool   `access:"experimental_features"` // Deprecated: use `ConnectedWorkspacesSettings.EnableRemoteClusterService`
	DisableAppBar                                         *bool   `access:"experimental_features"`
	DisableRefetchingOnBrowserFocus                       *bool   `access:"experimental_features"`
	DelayChannelAutocomplete                              *bool   `access:"experimental_features"`
	DisableWakeUpReconnectHandler                         *bool   `access:"experimental_features"`
	UsersStatusAndProfileFetchingPollIntervalMilliseconds *int64  `access:"experimental_features"`
	YoutubeReferrerPolicy                                 *bool   `access:"experimental_features"`
}

func (s *ExperimentalSettings) SetDefaults() {
	if s.ClientSideCertEnable == nil {
		s.ClientSideCertEnable = NewPointer(false)
	}

	if s.ClientSideCertCheck == nil {
		s.ClientSideCertCheck = NewPointer(ClientSideCertCheckSecondaryAuth)
	}

	if s.LinkMetadataTimeoutMilliseconds == nil {
		s.LinkMetadataTimeoutMilliseconds = NewPointer(int64(ExperimentalSettingsDefaultLinkMetadataTimeoutMilliseconds))
	}

	if s.RestrictSystemAdmin == nil {
		s.RestrictSystemAdmin = NewPointer(false)
	}

	if s.EnableSharedChannels == nil {
		s.EnableSharedChannels = NewPointer(false)
	}

	if s.EnableRemoteClusterService == nil {
		s.EnableRemoteClusterService = NewPointer(false)
	}

	if s.DisableAppBar == nil {
		s.DisableAppBar = NewPointer(false)
	}

	if s.DisableRefetchingOnBrowserFocus == nil {
		s.DisableRefetchingOnBrowserFocus = NewPointer(false)
	}

	if s.DelayChannelAutocomplete == nil {
		s.DelayChannelAutocomplete = NewPointer(false)
	}

	if s.DisableWakeUpReconnectHandler == nil {
		s.DisableWakeUpReconnectHandler = NewPointer(false)
	}

	if s.UsersStatusAndProfileFetchingPollIntervalMilliseconds == nil {
		s.UsersStatusAndProfileFetchingPollIntervalMilliseconds = NewPointer(int64(ExperimentalSettingsDefaultUsersStatusAndProfileFetchingPollIntervalMilliseconds))
	}

	if s.YoutubeReferrerPolicy == nil {
		s.YoutubeReferrerPolicy = NewPointer(false)
	}
}

type AnalyticsSettings struct {
	MaxUsersForStatistics *int `access:"write_restrictable,cloud_restrictable"`
}

func (s *AnalyticsSettings) SetDefaults() {
	if s.MaxUsersForStatistics == nil {
		s.MaxUsersForStatistics = NewPointer(AnalyticsSettingsDefaultMaxUsersForStatistics)
	}
}

type SSOSettings struct {
	Enable            *bool   `access:"authentication_openid"`
	Secret            *string `access:"authentication_openid"` // telemetry: none
	Id                *string `access:"authentication_openid"` // telemetry: none
	Scope             *string `access:"authentication_openid"` // telemetry: none
	AuthEndpoint      *string `access:"authentication_openid"` // telemetry: none
	TokenEndpoint     *string `access:"authentication_openid"` // telemetry: none
	UserAPIEndpoint   *string `access:"authentication_openid"` // telemetry: none
	DiscoveryEndpoint *string `access:"authentication_openid"` // telemetry: none
	ButtonText        *string `access:"authentication_openid"` // telemetry: none
	ButtonColor       *string `access:"authentication_openid"` // telemetry: none
}

func (s *SSOSettings) setDefaults(scope, authEndpoint, tokenEndpoint, userAPIEndpoint, buttonColor string) {
	if s.Enable == nil {
		s.Enable = NewPointer(false)
	}

	if s.Secret == nil {
		s.Secret = NewPointer("")
	}

	if s.Id == nil {
		s.Id = NewPointer("")
	}

	if s.Scope == nil {
		s.Scope = NewPointer(scope)
	}

	if s.DiscoveryEndpoint == nil {
		s.DiscoveryEndpoint = NewPointer("")
	}

	if s.AuthEndpoint == nil {
		s.AuthEndpoint = NewPointer(authEndpoint)
	}

	if s.TokenEndpoint == nil {
		s.TokenEndpoint = NewPointer(tokenEndpoint)
	}

	if s.UserAPIEndpoint == nil {
		s.UserAPIEndpoint = NewPointer(userAPIEndpoint)
	}

	if s.ButtonText == nil {
		s.ButtonText = NewPointer("")
	}

	if s.ButtonColor == nil {
		s.ButtonColor = NewPointer(buttonColor)
	}
}

type Office365Settings struct {
	Enable            *bool   `access:"authentication_openid"`
	Secret            *string `access:"authentication_openid"` // telemetry: none
	Id                *string `access:"authentication_openid"` // telemetry: none
	Scope             *string `access:"authentication_openid"`
	AuthEndpoint      *string `access:"authentication_openid"` // telemetry: none
	TokenEndpoint     *string `access:"authentication_openid"` // telemetry: none
	UserAPIEndpoint   *string `access:"authentication_openid"` // telemetry: none
	DiscoveryEndpoint *string `access:"authentication_openid"` // telemetry: none
	DirectoryId       *string `access:"authentication_openid"` // telemetry: none
}

func (s *Office365Settings) setDefaults() {
	if s.Enable == nil {
		s.Enable = NewPointer(false)
	}

	if s.Id == nil {
		s.Id = NewPointer("")
	}

	if s.Secret == nil {
		s.Secret = NewPointer("")
	}

	if s.Scope == nil {
		s.Scope = NewPointer(Office365SettingsDefaultScope)
	}

	if s.DiscoveryEndpoint == nil {
		s.DiscoveryEndpoint = NewPointer("")
	}

	if s.AuthEndpoint == nil {
		s.AuthEndpoint = NewPointer(Office365SettingsDefaultAuthEndpoint)
	}

	if s.TokenEndpoint == nil {
		s.TokenEndpoint = NewPointer(Office365SettingsDefaultTokenEndpoint)
	}

	if s.UserAPIEndpoint == nil {
		s.UserAPIEndpoint = NewPointer(Office365SettingsDefaultUserAPIEndpoint)
	}

	if s.DirectoryId == nil {
		s.DirectoryId = NewPointer("")
	}
}

func (s *Office365Settings) SSOSettings() *SSOSettings {
	ssoSettings := SSOSettings{}
	ssoSettings.Enable = s.Enable
	ssoSettings.Secret = s.Secret
	ssoSettings.Id = s.Id
	ssoSettings.Scope = s.Scope
	ssoSettings.DiscoveryEndpoint = s.DiscoveryEndpoint
	ssoSettings.AuthEndpoint = s.AuthEndpoint
	ssoSettings.TokenEndpoint = s.TokenEndpoint
	ssoSettings.UserAPIEndpoint = s.UserAPIEndpoint
	return &ssoSettings
}

type ReplicaLagSettings struct {
	DataSource       *string `access:"environment,write_restrictable,cloud_restrictable"` // telemetry: none
	QueryAbsoluteLag *string `access:"environment,write_restrictable,cloud_restrictable"` // telemetry: none
	QueryTimeLag     *string `access:"environment,write_restrictable,cloud_restrictable"` // telemetry: none
}

type SqlSettings struct {
	DriverName                        *string               `access:"environment_database,write_restrictable,cloud_restrictable"`
	DataSource                        *string               `access:"environment_database,write_restrictable,cloud_restrictable"` // telemetry: none
	DataSourceReplicas                []string              `access:"environment_database,write_restrictable,cloud_restrictable"`
	DataSourceSearchReplicas          []string              `access:"environment_database,write_restrictable,cloud_restrictable"`
	MaxIdleConns                      *int                  `access:"environment_database,write_restrictable,cloud_restrictable"`
	ConnMaxLifetimeMilliseconds       *int                  `access:"environment_database,write_restrictable,cloud_restrictable"`
	ConnMaxIdleTimeMilliseconds       *int                  `access:"environment_database,write_restrictable,cloud_restrictable"`
	MaxOpenConns                      *int                  `access:"environment_database,write_restrictable,cloud_restrictable"`
	Trace                             *bool                 `access:"environment_database,write_restrictable,cloud_restrictable"`
	AtRestEncryptKey                  *string               `access:"environment_database,write_restrictable,cloud_restrictable"` // telemetry: none
	QueryTimeout                      *int                  `access:"environment_database,write_restrictable,cloud_restrictable"`
	DisableDatabaseSearch             *bool                 `access:"environment_database,write_restrictable,cloud_restrictable"`
	MigrationsStatementTimeoutSeconds *int                  `access:"environment_database,write_restrictable,cloud_restrictable"`
	ReplicaLagSettings                []*ReplicaLagSettings `access:"environment_database,write_restrictable,cloud_restrictable"` // telemetry: none
	ReplicaMonitorIntervalSeconds     *int                  `access:"environment_database,write_restrictable,cloud_restrictable"`
}

func (s *SqlSettings) SetDefaults(isUpdate bool) {
	if s.DriverName == nil {
		s.DriverName = NewPointer(DatabaseDriverPostgres)
	}

	if s.DataSource == nil {
		s.DataSource = NewPointer(SqlSettingsDefaultDataSource)
	}

	if s.DataSourceReplicas == nil {
		s.DataSourceReplicas = []string{}
	}

	if s.DataSourceSearchReplicas == nil {
		s.DataSourceSearchReplicas = []string{}
	}

	if isUpdate {
		// When updating an existing configuration, ensure an encryption key has been specified.
		if s.AtRestEncryptKey == nil || *s.AtRestEncryptKey == "" {
			s.AtRestEncryptKey = NewPointer(NewRandomString(32))
		}
	} else {
		// When generating a blank configuration, leave this key empty to be generated on server start.
		s.AtRestEncryptKey = NewPointer("")
	}

	if s.MaxIdleConns == nil {
		s.MaxIdleConns = NewPointer(20)
	}

	if s.MaxOpenConns == nil {
		s.MaxOpenConns = NewPointer(300)
	}

	if s.ConnMaxLifetimeMilliseconds == nil {
		s.ConnMaxLifetimeMilliseconds = NewPointer(3600000)
	}

	if s.ConnMaxIdleTimeMilliseconds == nil {
		s.ConnMaxIdleTimeMilliseconds = NewPointer(300000)
	}

	if s.Trace == nil {
		s.Trace = NewPointer(false)
	}

	if s.QueryTimeout == nil {
		s.QueryTimeout = NewPointer(30)
	}

	if s.DisableDatabaseSearch == nil {
		s.DisableDatabaseSearch = NewPointer(false)
	}

	if s.MigrationsStatementTimeoutSeconds == nil {
		s.MigrationsStatementTimeoutSeconds = NewPointer(100000)
	}

	if s.ReplicaLagSettings == nil {
		s.ReplicaLagSettings = []*ReplicaLagSettings{}
	}

	if s.ReplicaMonitorIntervalSeconds == nil {
		s.ReplicaMonitorIntervalSeconds = NewPointer(5)
	}
}

type LogSettings struct {
	EnableConsole          *bool           `access:"environment_logging,write_restrictable,cloud_restrictable"`
	ConsoleLevel           *string         `access:"environment_logging,write_restrictable,cloud_restrictable"`
	ConsoleJson            *bool           `access:"environment_logging,write_restrictable,cloud_restrictable"`
	EnableColor            *bool           `access:"environment_logging,write_restrictable,cloud_restrictable"` // telemetry: none
	EnableFile             *bool           `access:"environment_logging,write_restrictable,cloud_restrictable"`
	FileLevel              *string         `access:"environment_logging,write_restrictable,cloud_restrictable"`
	FileJson               *bool           `access:"environment_logging,write_restrictable,cloud_restrictable"`
	FileLocation           *string         `access:"environment_logging,write_restrictable,cloud_restrictable"`
	EnableWebhookDebugging *bool           `access:"environment_logging,write_restrictable,cloud_restrictable"`
	EnableDiagnostics      *bool           `access:"environment_logging,write_restrictable,cloud_restrictable"` // telemetry: none
	VerboseDiagnostics     *bool           `access:"environment_logging,write_restrictable,cloud_restrictable"` // telemetry: none
	EnableSentry           *bool           `access:"environment_logging,write_restrictable,cloud_restrictable"` // telemetry: none
	AdvancedLoggingJSON    json.RawMessage `access:"environment_logging,write_restrictable,cloud_restrictable"`
	MaxFieldSize           *int            `access:"environment_logging,write_restrictable,cloud_restrictable"`
}

func NewLogSettings() *LogSettings {
	settings := &LogSettings{}
	settings.SetDefaults()
	return settings
}

func (s *LogSettings) isValid() *AppError {
	cfg := make(mlog.LoggerConfiguration)
	err := json.Unmarshal(s.AdvancedLoggingJSON, &cfg)
	if err != nil {
		return NewAppError("LogSettings.isValid", "model.config.is_valid.log.advanced_logging.json", map[string]any{"Error": err}, "", http.StatusBadRequest).Wrap(err)
	}

	err = cfg.IsValid()
	if err != nil {
		return NewAppError("LogSettings.isValid", "model.config.is_valid.log.advanced_logging.parse", map[string]any{"Error": err}, "", http.StatusBadRequest).Wrap(err)
	}

	return nil
}

func (s *LogSettings) SetDefaults() {
	if s.EnableConsole == nil {
		s.EnableConsole = NewPointer(true)
	}

	if s.ConsoleLevel == nil {
		s.ConsoleLevel = NewPointer("DEBUG")
	}

	if s.EnableColor == nil {
		s.EnableColor = NewPointer(false)
	}

	if s.EnableFile == nil {
		s.EnableFile = NewPointer(true)
	}

	if s.FileLevel == nil {
		s.FileLevel = NewPointer("INFO")
	}

	if s.FileLocation == nil {
		s.FileLocation = NewPointer("")
	}

	if s.EnableWebhookDebugging == nil {
		s.EnableWebhookDebugging = NewPointer(true)
	}

	if s.EnableDiagnostics == nil {
		s.EnableDiagnostics = NewPointer(true)
	}

	if s.VerboseDiagnostics == nil {
		s.VerboseDiagnostics = NewPointer(false)
	}

	if s.EnableSentry == nil {
		s.EnableSentry = NewPointer(*s.EnableDiagnostics)
	}

	if s.ConsoleJson == nil {
		s.ConsoleJson = NewPointer(true)
	}

	if s.FileJson == nil {
		s.FileJson = NewPointer(true)
	}

	if utils.IsEmptyJSON(s.AdvancedLoggingJSON) {
		s.AdvancedLoggingJSON = []byte("{}")
	}

	if s.MaxFieldSize == nil {
		s.MaxFieldSize = NewPointer(2048)
	}
}

// GetAdvancedLoggingConfig returns the advanced logging config as a []byte.
func (s *LogSettings) GetAdvancedLoggingConfig() []byte {
	if !utils.IsEmptyJSON(s.AdvancedLoggingJSON) {
		return s.AdvancedLoggingJSON
	}

	return []byte("{}")
}

type ExperimentalAuditSettings struct {
	FileEnabled         *bool           `access:"experimental_features,write_restrictable,cloud_restrictable"`
	FileName            *string         `access:"experimental_features,write_restrictable,cloud_restrictable"` // telemetry: none
	FileMaxSizeMB       *int            `access:"experimental_features,write_restrictable,cloud_restrictable"`
	FileMaxAgeDays      *int            `access:"experimental_features,write_restrictable,cloud_restrictable"`
	FileMaxBackups      *int            `access:"experimental_features,write_restrictable,cloud_restrictable"`
	FileCompress        *bool           `access:"experimental_features,write_restrictable,cloud_restrictable"`
	FileMaxQueueSize    *int            `access:"experimental_features,write_restrictable,cloud_restrictable"`
	AdvancedLoggingJSON json.RawMessage `access:"experimental_features"`
	Certificate         *string         `access:"experimental_features"` // telemetry: none
}

func (s *ExperimentalAuditSettings) SetDefaults() {
	if s.FileEnabled == nil {
		s.FileEnabled = NewPointer(false)
	}

	if s.FileName == nil {
		s.FileName = NewPointer("")
	}

	if s.FileMaxSizeMB == nil {
		s.FileMaxSizeMB = NewPointer(100)
	}

	if s.FileMaxAgeDays == nil {
		s.FileMaxAgeDays = NewPointer(0) // no limit on age
	}

	if s.FileMaxBackups == nil { // no limit on number of backups
		s.FileMaxBackups = NewPointer(0)
	}

	if s.FileCompress == nil {
		s.FileCompress = NewPointer(false)
	}

	if s.FileMaxQueueSize == nil {
		s.FileMaxQueueSize = NewPointer(1000)
	}

	if utils.IsEmptyJSON(s.AdvancedLoggingJSON) {
		s.AdvancedLoggingJSON = []byte("{}")
	}

	if s.Certificate == nil {
		s.Certificate = NewPointer("")
	}
}

// GetAdvancedLoggingConfig returns the advanced logging config as a []byte.
func (s *ExperimentalAuditSettings) GetAdvancedLoggingConfig() []byte {
	if !utils.IsEmptyJSON(s.AdvancedLoggingJSON) {
		return s.AdvancedLoggingJSON
	}

	return []byte("{}")
}

type NotificationLogSettings struct {
	EnableConsole       *bool           `access:"write_restrictable,cloud_restrictable"`
	ConsoleLevel        *string         `access:"write_restrictable,cloud_restrictable"`
	ConsoleJson         *bool           `access:"write_restrictable,cloud_restrictable"`
	EnableColor         *bool           `access:"write_restrictable,cloud_restrictable"` // telemetry: none
	EnableFile          *bool           `access:"write_restrictable,cloud_restrictable"`
	FileLevel           *string         `access:"write_restrictable,cloud_restrictable"`
	FileJson            *bool           `access:"write_restrictable,cloud_restrictable"`
	FileLocation        *string         `access:"write_restrictable,cloud_restrictable"`
	AdvancedLoggingJSON json.RawMessage `access:"write_restrictable,cloud_restrictable"`
}

func (s *NotificationLogSettings) SetDefaults() {
	if s.EnableConsole == nil {
		s.EnableConsole = NewPointer(true)
	}

	if s.ConsoleLevel == nil {
		s.ConsoleLevel = NewPointer("DEBUG")
	}

	if s.EnableFile == nil {
		s.EnableFile = NewPointer(true)
	}

	if s.FileLevel == nil {
		s.FileLevel = NewPointer("INFO")
	}

	if s.FileLocation == nil {
		s.FileLocation = NewPointer("")
	}

	if s.ConsoleJson == nil {
		s.ConsoleJson = NewPointer(true)
	}

	if s.EnableColor == nil {
		s.EnableColor = NewPointer(false)
	}

	if s.FileJson == nil {
		s.FileJson = NewPointer(true)
	}

	if utils.IsEmptyJSON(s.AdvancedLoggingJSON) {
		s.AdvancedLoggingJSON = []byte("{}")
	}
}

// GetAdvancedLoggingConfig returns the advanced logging config as a []byte.
func (s *NotificationLogSettings) GetAdvancedLoggingConfig() []byte {
	if !utils.IsEmptyJSON(s.AdvancedLoggingJSON) {
		return s.AdvancedLoggingJSON
	}

	return []byte("{}")
}

type PasswordSettings struct {
	MinimumLength    *int  `access:"authentication_password"`
	Lowercase        *bool `access:"authentication_password"`
	Number           *bool `access:"authentication_password"`
	Uppercase        *bool `access:"authentication_password"`
	Symbol           *bool `access:"authentication_password"`
	EnableForgotLink *bool `access:"authentication_password"`
}

func (s *PasswordSettings) SetDefaults() {
	if s.MinimumLength == nil {
		s.MinimumLength = NewPointer(8)
	}

	if s.Lowercase == nil {
		s.Lowercase = NewPointer(false)
	}

	if s.Number == nil {
		s.Number = NewPointer(false)
	}

	if s.Uppercase == nil {
		s.Uppercase = NewPointer(false)
	}

	if s.Symbol == nil {
		s.Symbol = NewPointer(false)
	}

	if s.EnableForgotLink == nil {
		s.EnableForgotLink = NewPointer(true)
	}
}

type FileSettings struct {
	EnableFileAttachments              *bool   `access:"site_file_sharing_and_downloads"`
	EnableMobileUpload                 *bool   `access:"site_file_sharing_and_downloads"`
	EnableMobileDownload               *bool   `access:"site_file_sharing_and_downloads"`
	MaxFileSize                        *int64  `access:"environment_file_storage,cloud_restrictable"`
	MaxImageResolution                 *int64  `access:"environment_file_storage,cloud_restrictable"`
	MaxImageDecoderConcurrency         *int64  `access:"environment_file_storage,cloud_restrictable"`
	DriverName                         *string `access:"environment_file_storage,write_restrictable,cloud_restrictable"`
	Directory                          *string `access:"environment_file_storage,write_restrictable,cloud_restrictable"`
	EnablePublicLink                   *bool   `access:"site_public_links,cloud_restrictable"`
	ExtractContent                     *bool   `access:"environment_file_storage,write_restrictable"`
	ArchiveRecursion                   *bool   `access:"environment_file_storage,write_restrictable"`
	PublicLinkSalt                     *string `access:"site_public_links,cloud_restrictable"`                           // telemetry: none
	InitialFont                        *string `access:"environment_file_storage,cloud_restrictable"`                    // telemetry: none
	AmazonS3AccessKeyId                *string `access:"environment_file_storage,write_restrictable,cloud_restrictable"` // telemetry: none
	AmazonS3SecretAccessKey            *string `access:"environment_file_storage,write_restrictable,cloud_restrictable"` // telemetry: none
	AmazonS3Bucket                     *string `access:"environment_file_storage,write_restrictable,cloud_restrictable"` // telemetry: none
	AmazonS3PathPrefix                 *string `access:"environment_file_storage,write_restrictable,cloud_restrictable"` // telemetry: none
	AmazonS3Region                     *string `access:"environment_file_storage,write_restrictable,cloud_restrictable"` // telemetry: none
	AmazonS3Endpoint                   *string `access:"environment_file_storage,write_restrictable,cloud_restrictable"` // telemetry: none
	AmazonS3SSL                        *bool   `access:"environment_file_storage,write_restrictable,cloud_restrictable"`
	AmazonS3SignV2                     *bool   `access:"environment_file_storage,write_restrictable,cloud_restrictable"`
	AmazonS3SSE                        *bool   `access:"environment_file_storage,write_restrictable,cloud_restrictable"`
	AmazonS3Trace                      *bool   `access:"environment_file_storage,write_restrictable,cloud_restrictable"`
	AmazonS3RequestTimeoutMilliseconds *int64  `access:"environment_file_storage,write_restrictable,cloud_restrictable"` // telemetry: none
	AmazonS3UploadPartSizeBytes        *int64  `access:"environment_file_storage,write_restrictable,cloud_restrictable"` // telemetry: none
	AmazonS3StorageClass               *string `access:"environment_file_storage,write_restrictable,cloud_restrictable"` // telemetry: none
	// Export store settings
	DedicatedExportStore                     *bool   `access:"environment_file_storage,write_restrictable"`
	ExportDriverName                         *string `access:"environment_file_storage,write_restrictable"`
	ExportDirectory                          *string `access:"environment_file_storage,write_restrictable"` // telemetry: none
	ExportAmazonS3AccessKeyId                *string `access:"environment_file_storage,write_restrictable"` // telemetry: none
	ExportAmazonS3SecretAccessKey            *string `access:"environment_file_storage,write_restrictable"` // telemetry: none
	ExportAmazonS3Bucket                     *string `access:"environment_file_storage,write_restrictable"` // telemetry: none
	ExportAmazonS3PathPrefix                 *string `access:"environment_file_storage,write_restrictable"` // telemetry: none
	ExportAmazonS3Region                     *string `access:"environment_file_storage,write_restrictable"` // telemetry: none
	ExportAmazonS3Endpoint                   *string `access:"environment_file_storage,write_restrictable"` // telemetry: none
	ExportAmazonS3SSL                        *bool   `access:"environment_file_storage,write_restrictable"`
	ExportAmazonS3SignV2                     *bool   `access:"environment_file_storage,write_restrictable"`
	ExportAmazonS3SSE                        *bool   `access:"environment_file_storage,write_restrictable"`
	ExportAmazonS3Trace                      *bool   `access:"environment_file_storage,write_restrictable"`
	ExportAmazonS3RequestTimeoutMilliseconds *int64  `access:"environment_file_storage,write_restrictable"` // telemetry: none
	ExportAmazonS3PresignExpiresSeconds      *int64  `access:"environment_file_storage,write_restrictable"` // telemetry: none
	ExportAmazonS3UploadPartSizeBytes        *int64  `access:"environment_file_storage,write_restrictable"` // telemetry: none
	ExportAmazonS3StorageClass               *string `access:"environment_file_storage,write_restrictable"` // telemetry: none
}

func (s *FileSettings) SetDefaults(isUpdate bool) {
	if s.EnableFileAttachments == nil {
		s.EnableFileAttachments = NewPointer(true)
	}

	if s.EnableMobileUpload == nil {
		s.EnableMobileUpload = NewPointer(true)
	}

	if s.EnableMobileDownload == nil {
		s.EnableMobileDownload = NewPointer(true)
	}

	if s.MaxFileSize == nil {
		s.MaxFileSize = NewPointer(int64(100 * 1024 * 1024)) // 100MB (IEC)
	}

	if s.MaxImageResolution == nil {
		s.MaxImageResolution = NewPointer(int64(7680 * 4320)) // 8K, ~33MPX
	}

	if s.MaxImageDecoderConcurrency == nil {
		s.MaxImageDecoderConcurrency = NewPointer(int64(-1)) // Default to NumCPU
	}

	if s.DriverName == nil {
		s.DriverName = NewPointer(ImageDriverLocal)
	}

	if s.Directory == nil || *s.Directory == "" {
		s.Directory = NewPointer(FileSettingsDefaultDirectory)
	}

	if s.EnablePublicLink == nil {
		s.EnablePublicLink = NewPointer(false)
	}

	if s.ExtractContent == nil {
		s.ExtractContent = NewPointer(true)
	}

	if s.ArchiveRecursion == nil {
		s.ArchiveRecursion = NewPointer(false)
	}

	if isUpdate {
		// When updating an existing configuration, ensure link salt has been specified.
		if s.PublicLinkSalt == nil || *s.PublicLinkSalt == "" {
			s.PublicLinkSalt = NewPointer(NewRandomString(32))
		}
	} else {
		// When generating a blank configuration, leave link salt empty to be generated on server start.
		s.PublicLinkSalt = NewPointer("")
	}

	if s.InitialFont == nil {
		// Defaults to "nunito-bold.ttf"
		s.InitialFont = NewPointer("nunito-bold.ttf")
	}

	if s.AmazonS3AccessKeyId == nil {
		s.AmazonS3AccessKeyId = NewPointer("")
	}

	if s.AmazonS3SecretAccessKey == nil {
		s.AmazonS3SecretAccessKey = NewPointer("")
	}

	if s.AmazonS3Bucket == nil {
		s.AmazonS3Bucket = NewPointer("")
	}

	if s.AmazonS3PathPrefix == nil {
		s.AmazonS3PathPrefix = NewPointer("")
	}

	if s.AmazonS3Region == nil {
		s.AmazonS3Region = NewPointer("")
	}

	if s.AmazonS3Endpoint == nil || *s.AmazonS3Endpoint == "" {
		// Defaults to "s3.amazonaws.com"
		s.AmazonS3Endpoint = NewPointer("s3.amazonaws.com")
	}

	if s.AmazonS3SSL == nil {
		s.AmazonS3SSL = NewPointer(true) // Secure by default.
	}

	if s.AmazonS3SignV2 == nil {
		s.AmazonS3SignV2 = new(bool)
		// Signature v2 is not enabled by default.
	}

	if s.AmazonS3SSE == nil {
		s.AmazonS3SSE = NewPointer(false) // Not Encrypted by default.
	}

	if s.AmazonS3Trace == nil {
		s.AmazonS3Trace = NewPointer(false)
	}

	if s.AmazonS3RequestTimeoutMilliseconds == nil {
		s.AmazonS3RequestTimeoutMilliseconds = NewPointer(int64(30000))
	}

	if s.AmazonS3UploadPartSizeBytes == nil {
		s.AmazonS3UploadPartSizeBytes = NewPointer(int64(FileSettingsDefaultS3UploadPartSizeBytes))
	}

	if s.AmazonS3StorageClass == nil {
		s.AmazonS3StorageClass = NewPointer("")
	}

	if s.DedicatedExportStore == nil {
		s.DedicatedExportStore = NewPointer(false)
	}

	if s.ExportDriverName == nil {
		s.ExportDriverName = NewPointer(ImageDriverLocal)
	}

	if s.ExportDirectory == nil || *s.ExportDirectory == "" {
		s.ExportDirectory = NewPointer(FileSettingsDefaultDirectory)
	}

	if s.ExportAmazonS3AccessKeyId == nil {
		s.ExportAmazonS3AccessKeyId = NewPointer("")
	}

	if s.ExportAmazonS3SecretAccessKey == nil {
		s.ExportAmazonS3SecretAccessKey = NewPointer("")
	}

	if s.ExportAmazonS3Bucket == nil {
		s.ExportAmazonS3Bucket = NewPointer("")
	}

	if s.ExportAmazonS3PathPrefix == nil {
		s.ExportAmazonS3PathPrefix = NewPointer("")
	}

	if s.ExportAmazonS3Region == nil {
		s.ExportAmazonS3Region = NewPointer("")
	}

	if s.ExportAmazonS3Endpoint == nil || *s.ExportAmazonS3Endpoint == "" {
		// Defaults to "s3.amazonaws.com"
		s.ExportAmazonS3Endpoint = NewPointer("s3.amazonaws.com")
	}

	if s.ExportAmazonS3SSL == nil {
		s.ExportAmazonS3SSL = NewPointer(true) // Secure by default.
	}

	if s.ExportAmazonS3SignV2 == nil {
		s.ExportAmazonS3SignV2 = new(bool)
		// Signature v2 is not enabled by default.
	}

	if s.ExportAmazonS3SSE == nil {
		s.ExportAmazonS3SSE = NewPointer(false) // Not Encrypted by default.
	}

	if s.ExportAmazonS3Trace == nil {
		s.ExportAmazonS3Trace = NewPointer(false)
	}

	if s.ExportAmazonS3RequestTimeoutMilliseconds == nil {
		s.ExportAmazonS3RequestTimeoutMilliseconds = NewPointer(int64(30000))
	}

	if s.ExportAmazonS3PresignExpiresSeconds == nil {
		s.ExportAmazonS3PresignExpiresSeconds = NewPointer(int64(21600)) // 6h
	}

	if s.ExportAmazonS3UploadPartSizeBytes == nil {
		s.ExportAmazonS3UploadPartSizeBytes = NewPointer(int64(FileSettingsDefaultS3ExportUploadPartSizeBytes))
	}

	if s.ExportAmazonS3StorageClass == nil {
		s.ExportAmazonS3StorageClass = NewPointer("")
	}
}

type EmailSettings struct {
	EnableSignUpWithEmail             *bool   `access:"authentication_email"`
	EnableSignInWithEmail             *bool   `access:"authentication_email"`
	EnableSignInWithUsername          *bool   `access:"authentication_email"`
	SendEmailNotifications            *bool   `access:"site_notifications"`
	UseChannelInEmailNotifications    *bool   `access:"experimental_features"`
	RequireEmailVerification          *bool   `access:"authentication_email"`
	FeedbackName                      *string `access:"site_notifications"`
	FeedbackEmail                     *string `access:"site_notifications,cloud_restrictable"`
	ReplyToAddress                    *string `access:"site_notifications,cloud_restrictable"`
	FeedbackOrganization              *string `access:"site_notifications"`
	EnableSMTPAuth                    *bool   `access:"environment_smtp,write_restrictable,cloud_restrictable"`
	SMTPUsername                      *string `access:"environment_smtp,write_restrictable,cloud_restrictable"` // telemetry: none
	SMTPPassword                      *string `access:"environment_smtp,write_restrictable,cloud_restrictable"` // telemetry: none
	SMTPServer                        *string `access:"environment_smtp,write_restrictable,cloud_restrictable"` // telemetry: none
	SMTPPort                          *string `access:"environment_smtp,write_restrictable,cloud_restrictable"` // telemetry: none
	SMTPServerTimeout                 *int    `access:"cloud_restrictable"`
	ConnectionSecurity                *string `access:"environment_smtp,write_restrictable,cloud_restrictable"`
	SendPushNotifications             *bool   `access:"environment_push_notification_server"`
	PushNotificationServer            *string `access:"environment_push_notification_server"` // telemetry: none
	PushNotificationContents          *string `access:"site_notifications"`
	PushNotificationBuffer            *int    // telemetry: none
	EnableEmailBatching               *bool   `access:"site_notifications"`
	EmailBatchingBufferSize           *int    `access:"experimental_features"`
	EmailBatchingInterval             *int    `access:"experimental_features"`
	EnablePreviewModeBanner           *bool   `access:"site_notifications"`
	SkipServerCertificateVerification *bool   `access:"environment_smtp,write_restrictable,cloud_restrictable"`
	EmailNotificationContentsType     *string `access:"site_notifications"`
	LoginButtonColor                  *string `access:"experimental_features"`
	LoginButtonBorderColor            *string `access:"experimental_features"`
	LoginButtonTextColor              *string `access:"experimental_features"`
}

func (s *EmailSettings) SetDefaults(isUpdate bool) {
	if s.EnableSignUpWithEmail == nil {
		s.EnableSignUpWithEmail = NewPointer(true)
	}

	if s.EnableSignInWithEmail == nil {
		s.EnableSignInWithEmail = NewPointer(*s.EnableSignUpWithEmail)
	}

	if s.EnableSignInWithUsername == nil {
		s.EnableSignInWithUsername = NewPointer(true)
	}

	if s.SendEmailNotifications == nil {
		s.SendEmailNotifications = NewPointer(true)
	}

	if s.UseChannelInEmailNotifications == nil {
		s.UseChannelInEmailNotifications = NewPointer(false)
	}

	if s.RequireEmailVerification == nil {
		s.RequireEmailVerification = NewPointer(false)
	}

	if s.FeedbackName == nil {
		s.FeedbackName = NewPointer("")
	}

	if s.FeedbackEmail == nil {
		s.FeedbackEmail = NewPointer("test@example.com")
	}

	if s.ReplyToAddress == nil {
		s.ReplyToAddress = NewPointer("test@example.com")
	}

	if s.FeedbackOrganization == nil {
		s.FeedbackOrganization = NewPointer(EmailSettingsDefaultFeedbackOrganization)
	}

	if s.EnableSMTPAuth == nil {
		if s.ConnectionSecurity == nil || *s.ConnectionSecurity == ConnSecurityNone {
			s.EnableSMTPAuth = NewPointer(false)
		} else {
			s.EnableSMTPAuth = NewPointer(true)
		}
	}

	if s.SMTPUsername == nil {
		s.SMTPUsername = NewPointer("")
	}

	if s.SMTPPassword == nil {
		s.SMTPPassword = NewPointer("")
	}

	if s.SMTPServer == nil || *s.SMTPServer == "" {
		s.SMTPServer = NewPointer(EmailSMTPDefaultServer)
	}

	if s.SMTPPort == nil || *s.SMTPPort == "" {
		s.SMTPPort = NewPointer(EmailSMTPDefaultPort)
	}

	if s.SMTPServerTimeout == nil || *s.SMTPServerTimeout == 0 {
		s.SMTPServerTimeout = NewPointer(10)
	}

	if s.ConnectionSecurity == nil || *s.ConnectionSecurity == ConnSecurityPlain {
		s.ConnectionSecurity = NewPointer(ConnSecurityNone)
	}

	if s.SendPushNotifications == nil {
		s.SendPushNotifications = NewPointer(!isUpdate)
	}

	if s.PushNotificationServer == nil {
		if isUpdate {
			s.PushNotificationServer = NewPointer("")
		} else {
			s.PushNotificationServer = NewPointer(GenericNotificationServer)
		}
	}

	if s.PushNotificationContents == nil {
		s.PushNotificationContents = NewPointer(FullNotification)
	}

	if s.PushNotificationBuffer == nil {
		s.PushNotificationBuffer = NewPointer(1000)
	}

	if s.EnableEmailBatching == nil {
		s.EnableEmailBatching = NewPointer(false)
	}

	if s.EmailBatchingBufferSize == nil {
		s.EmailBatchingBufferSize = NewPointer(EmailBatchingBufferSize)
	}

	if s.EmailBatchingInterval == nil {
		s.EmailBatchingInterval = NewPointer(EmailBatchingInterval)
	}

	if s.EnablePreviewModeBanner == nil {
		s.EnablePreviewModeBanner = NewPointer(true)
	}

	if s.EnableSMTPAuth == nil {
		if *s.ConnectionSecurity == ConnSecurityNone {
			s.EnableSMTPAuth = NewPointer(false)
		} else {
			s.EnableSMTPAuth = NewPointer(true)
		}
	}

	if *s.ConnectionSecurity == ConnSecurityPlain {
		*s.ConnectionSecurity = ConnSecurityNone
	}

	if s.SkipServerCertificateVerification == nil {
		s.SkipServerCertificateVerification = NewPointer(false)
	}

	if s.EmailNotificationContentsType == nil {
		s.EmailNotificationContentsType = NewPointer(EmailNotificationContentsFull)
	}

	if s.LoginButtonColor == nil {
		s.LoginButtonColor = NewPointer("#0000")
	}

	if s.LoginButtonBorderColor == nil {
		s.LoginButtonBorderColor = NewPointer("#2389D7")
	}

	if s.LoginButtonTextColor == nil {
		s.LoginButtonTextColor = NewPointer("#2389D7")
	}
}

type RateLimitSettings struct {
	Enable           *bool  `access:"environment_rate_limiting,write_restrictable,cloud_restrictable"`
	PerSec           *int   `access:"environment_rate_limiting,write_restrictable,cloud_restrictable"`
	MaxBurst         *int   `access:"environment_rate_limiting,write_restrictable,cloud_restrictable"`
	MemoryStoreSize  *int   `access:"environment_rate_limiting,write_restrictable,cloud_restrictable"`
	VaryByRemoteAddr *bool  `access:"environment_rate_limiting,write_restrictable,cloud_restrictable"`
	VaryByUser       *bool  `access:"environment_rate_limiting,write_restrictable,cloud_restrictable"`
	VaryByHeader     string `access:"environment_rate_limiting,write_restrictable,cloud_restrictable"`
}

func (s *RateLimitSettings) SetDefaults() {
	if s.Enable == nil {
		s.Enable = NewPointer(false)
	}

	if s.PerSec == nil {
		s.PerSec = NewPointer(10)
	}

	if s.MaxBurst == nil {
		s.MaxBurst = NewPointer(100)
	}

	if s.MemoryStoreSize == nil {
		s.MemoryStoreSize = NewPointer(10000)
	}

	if s.VaryByRemoteAddr == nil {
		s.VaryByRemoteAddr = NewPointer(true)
	}

	if s.VaryByUser == nil {
		s.VaryByUser = NewPointer(false)
	}
}

type PrivacySettings struct {
	ShowEmailAddress *bool `access:"site_users_and_teams"`
	ShowFullName     *bool `access:"site_users_and_teams"`
}

func (s *PrivacySettings) setDefaults() {
	if s.ShowEmailAddress == nil {
		s.ShowEmailAddress = NewPointer(true)
	}

	if s.ShowFullName == nil {
		s.ShowFullName = NewPointer(true)
	}
}

type SupportSettings struct {
	TermsOfServiceLink                     *string `access:"site_customization,write_restrictable,cloud_restrictable"`
	PrivacyPolicyLink                      *string `access:"site_customization,write_restrictable,cloud_restrictable"`
	AboutLink                              *string `access:"site_customization,write_restrictable,cloud_restrictable"`
	HelpLink                               *string `access:"site_customization"`
	ReportAProblemLink                     *string `access:"site_customization,write_restrictable,cloud_restrictable"`
	ReportAProblemType                     *string `access:"site_customization,write_restrictable,cloud_restrictable"`
	ReportAProblemMail                     *string `access:"site_customization,write_restrictable,cloud_restrictable"`
	AllowDownloadLogs                      *bool   `access:"site_customization,write_restrictable,cloud_restrictable"`
	ForgotPasswordLink                     *string `access:"site_customization,write_restrictable,cloud_restrictable"`
	SupportEmail                           *string `access:"site_notifications"`
	CustomTermsOfServiceEnabled            *bool   `access:"compliance_custom_terms_of_service"`
	CustomTermsOfServiceReAcceptancePeriod *int    `access:"compliance_custom_terms_of_service"`
	EnableAskCommunityLink                 *bool   `access:"site_customization"`
}

func (s *SupportSettings) SetDefaults() {
	if !isSafeLink(s.TermsOfServiceLink) {
		*s.TermsOfServiceLink = SupportSettingsDefaultTermsOfServiceLink
	}

	if s.TermsOfServiceLink == nil {
		s.TermsOfServiceLink = NewPointer(SupportSettingsDefaultTermsOfServiceLink)
	}

	if !isSafeLink(s.PrivacyPolicyLink) {
		*s.PrivacyPolicyLink = ""
	}

	if s.PrivacyPolicyLink == nil {
		s.PrivacyPolicyLink = NewPointer(SupportSettingsDefaultPrivacyPolicyLink)
	}

	if !isSafeLink(s.AboutLink) {
		*s.AboutLink = ""
	}

	if s.AboutLink == nil {
		s.AboutLink = NewPointer(SupportSettingsDefaultAboutLink)
	}

	if !isSafeLink(s.HelpLink) {
		*s.HelpLink = ""
	}

	if s.HelpLink == nil {
		s.HelpLink = NewPointer(SupportSettingsDefaultHelpLink)
	}

	if !isSafeLink(s.ReportAProblemLink) {
		*s.ReportAProblemLink = ""
	}

	if s.ReportAProblemLink == nil {
		s.ReportAProblemLink = NewPointer(SupportSettingsDefaultReportAProblemLink)
	}

	if s.ReportAProblemType == nil {
		s.ReportAProblemType = NewPointer(SupportSettingsDefaultReportAProblemType)
	}

	if s.ReportAProblemMail == nil {
		s.ReportAProblemMail = NewPointer("")
	}

	if s.AllowDownloadLogs == nil {
		s.AllowDownloadLogs = NewPointer(true)
	}

	if !isSafeLink(s.ForgotPasswordLink) {
		*s.ForgotPasswordLink = ""
	}

	if s.ForgotPasswordLink == nil {
		s.ForgotPasswordLink = NewPointer("")
	}

	if s.SupportEmail == nil {
		s.SupportEmail = NewPointer(SupportSettingsDefaultSupportEmail)
	}

	if s.CustomTermsOfServiceEnabled == nil {
		s.CustomTermsOfServiceEnabled = NewPointer(false)
	}

	if s.CustomTermsOfServiceReAcceptancePeriod == nil {
		s.CustomTermsOfServiceReAcceptancePeriod = NewPointer(SupportSettingsDefaultReAcceptancePeriod)
	}

	if s.EnableAskCommunityLink == nil {
		s.EnableAskCommunityLink = NewPointer(true)
	}
}

type AnnouncementSettings struct {
	EnableBanner          *bool   `access:"site_announcement_banner"`
	BannerText            *string `access:"site_announcement_banner"` // telemetry: none
	BannerColor           *string `access:"site_announcement_banner"`
	BannerTextColor       *string `access:"site_announcement_banner"`
	AllowBannerDismissal  *bool   `access:"site_announcement_banner"`
	AdminNoticesEnabled   *bool   `access:"site_notices"`
	UserNoticesEnabled    *bool   `access:"site_notices"`
	NoticesURL            *string `access:"site_notices,write_restrictable"` // telemetry: none
	NoticesFetchFrequency *int    `access:"site_notices,write_restrictable"` // telemetry: none
	NoticesSkipCache      *bool   `access:"site_notices,write_restrictable"` // telemetry: none
}

func (s *AnnouncementSettings) SetDefaults() {
	if s.EnableBanner == nil {
		s.EnableBanner = NewPointer(false)
	}

	if s.BannerText == nil {
		s.BannerText = NewPointer("")
	}

	if s.BannerColor == nil {
		s.BannerColor = NewPointer(AnnouncementSettingsDefaultBannerColor)
	}

	if s.BannerTextColor == nil {
		s.BannerTextColor = NewPointer(AnnouncementSettingsDefaultBannerTextColor)
	}

	if s.AllowBannerDismissal == nil {
		s.AllowBannerDismissal = NewPointer(true)
	}

	if s.AdminNoticesEnabled == nil {
		s.AdminNoticesEnabled = NewPointer(true)
	}

	if s.UserNoticesEnabled == nil {
		s.UserNoticesEnabled = NewPointer(true)
	}
	if s.NoticesURL == nil {
		s.NoticesURL = NewPointer(AnnouncementSettingsDefaultNoticesJsonURL)
	}
	if s.NoticesSkipCache == nil {
		s.NoticesSkipCache = NewPointer(false)
	}
	if s.NoticesFetchFrequency == nil {
		s.NoticesFetchFrequency = NewPointer(AnnouncementSettingsDefaultNoticesFetchFrequencySeconds)
	}
}

type ThemeSettings struct {
	EnableThemeSelection *bool   `access:"experimental_features"`
	DefaultTheme         *string `access:"experimental_features"`
	AllowCustomThemes    *bool   `access:"experimental_features"`
	AllowedThemes        []string
}

func (s *ThemeSettings) SetDefaults() {
	if s.EnableThemeSelection == nil {
		s.EnableThemeSelection = NewPointer(true)
	}

	if s.DefaultTheme == nil {
		s.DefaultTheme = NewPointer(TeamSettingsDefaultTeamText)
	}

	if s.AllowCustomThemes == nil {
		s.AllowCustomThemes = NewPointer(true)
	}

	if s.AllowedThemes == nil {
		s.AllowedThemes = []string{}
	}
}

type TeamSettings struct {
	SiteName                        *string `access:"site_customization"`
	MaxUsersPerTeam                 *int    `access:"site_users_and_teams"`
	EnableJoinLeaveMessageByDefault *bool   `access:"site_users_and_teams"`
	EnableUserCreation              *bool   `access:"authentication_signup"`
	EnableOpenServer                *bool   `access:"authentication_signup"`
	EnableUserDeactivation          *bool   `access:"experimental_features"`
	RestrictCreationToDomains       *string `access:"authentication_signup"` // telemetry: none
	EnableCustomUserStatuses        *bool   `access:"site_users_and_teams"`
	EnableCustomBrand               *bool   `access:"site_customization"`
	CustomBrandText                 *string `access:"site_customization"`
	CustomDescriptionText           *string `access:"site_customization"`
	RestrictDirectMessage           *string `access:"site_users_and_teams"`
	EnableLastActiveTime            *bool   `access:"site_users_and_teams"`
	// In seconds.
	UserStatusAwayTimeout               *int64   `access:"experimental_features"`
	MaxChannelsPerTeam                  *int64   `access:"site_users_and_teams"`
	MaxNotificationsPerChannel          *int64   `access:"environment_push_notification_server"`
	EnableConfirmNotificationsToChannel *bool    `access:"site_notifications"`
	TeammateNameDisplay                 *string  `access:"site_users_and_teams"`
	ExperimentalViewArchivedChannels    *bool    `access:"experimental_features,site_users_and_teams"`
	ExperimentalEnableAutomaticReplies  *bool    `access:"experimental_features"`
	LockTeammateNameDisplay             *bool    `access:"site_users_and_teams"`
	ExperimentalPrimaryTeam             *string  `access:"experimental_features"`
	ExperimentalDefaultChannels         []string `access:"experimental_features"`
}

func (s *TeamSettings) SetDefaults() {
	if s.SiteName == nil || *s.SiteName == "" {
		s.SiteName = NewPointer(TeamSettingsDefaultSiteName)
	}

	if s.MaxUsersPerTeam == nil {
		s.MaxUsersPerTeam = NewPointer(TeamSettingsDefaultMaxUsersPerTeam)
	}

	if s.EnableJoinLeaveMessageByDefault == nil {
		s.EnableJoinLeaveMessageByDefault = NewPointer(true)
	}

	if s.EnableUserCreation == nil {
		s.EnableUserCreation = NewPointer(true)
	}

	if s.EnableOpenServer == nil {
		s.EnableOpenServer = NewPointer(false)
	}

	if s.RestrictCreationToDomains == nil {
		s.RestrictCreationToDomains = NewPointer("")
	}

	if s.EnableCustomUserStatuses == nil {
		s.EnableCustomUserStatuses = NewPointer(true)
	}

	if s.EnableLastActiveTime == nil {
		s.EnableLastActiveTime = NewPointer(true)
	}

	if s.EnableCustomBrand == nil {
		s.EnableCustomBrand = NewPointer(false)
	}

	if s.EnableUserDeactivation == nil {
		s.EnableUserDeactivation = NewPointer(false)
	}

	if s.CustomBrandText == nil {
		s.CustomBrandText = NewPointer(TeamSettingsDefaultCustomBrandText)
	}

	if s.CustomDescriptionText == nil {
		s.CustomDescriptionText = NewPointer(TeamSettingsDefaultCustomDescriptionText)
	}

	if s.RestrictDirectMessage == nil {
		s.RestrictDirectMessage = NewPointer(DirectMessageAny)
	}

	if s.UserStatusAwayTimeout == nil {
		s.UserStatusAwayTimeout = NewPointer(int64(TeamSettingsDefaultUserStatusAwayTimeout))
	}

	if s.MaxChannelsPerTeam == nil {
		s.MaxChannelsPerTeam = NewPointer(int64(2000))
	}

	if s.MaxNotificationsPerChannel == nil {
		s.MaxNotificationsPerChannel = NewPointer(int64(1000))
	}

	if s.EnableConfirmNotificationsToChannel == nil {
		s.EnableConfirmNotificationsToChannel = NewPointer(true)
	}

	if s.ExperimentalEnableAutomaticReplies == nil {
		s.ExperimentalEnableAutomaticReplies = NewPointer(false)
	}

	if s.ExperimentalPrimaryTeam == nil {
		s.ExperimentalPrimaryTeam = NewPointer("")
	}

	if s.ExperimentalDefaultChannels == nil {
		s.ExperimentalDefaultChannels = []string{}
	}

	if s.EnableUserCreation == nil {
		s.EnableUserCreation = NewPointer(true)
	}

	if s.ExperimentalViewArchivedChannels == nil {
		s.ExperimentalViewArchivedChannels = NewPointer(true)
	}

	if s.LockTeammateNameDisplay == nil {
		s.LockTeammateNameDisplay = NewPointer(false)
	}
}

type ClientRequirements struct {
	AndroidLatestVersion string `access:"write_restrictable,cloud_restrictable"`
	AndroidMinVersion    string `access:"write_restrictable,cloud_restrictable"`
	IosLatestVersion     string `access:"write_restrictable,cloud_restrictable"`
	IosMinVersion        string `access:"write_restrictable,cloud_restrictable"`
}

type LdapSettings struct {
	// Basic
	Enable               *bool   `access:"authentication_ldap"`
	EnableSync           *bool   `access:"authentication_ldap"`
	LdapServer           *string `access:"authentication_ldap"` // telemetry: none
	LdapPort             *int    `access:"authentication_ldap"` // telemetry: none
	ConnectionSecurity   *string `access:"authentication_ldap"`
	BaseDN               *string `access:"authentication_ldap"` // telemetry: none
	BindUsername         *string `access:"authentication_ldap"` // telemetry: none
	BindPassword         *string `access:"authentication_ldap"` // telemetry: none
	MaximumLoginAttempts *int    `access:"authentication_ldap"` // telemetry: none

	// Filtering
	UserFilter        *string `access:"authentication_ldap"` // telemetry: none
	GroupFilter       *string `access:"authentication_ldap"`
	GuestFilter       *string `access:"authentication_ldap"`
	EnableAdminFilter *bool
	AdminFilter       *string

	// Group Mapping
	GroupDisplayNameAttribute *string `access:"authentication_ldap"`
	GroupIdAttribute          *string `access:"authentication_ldap"`

	// User Mapping
	FirstNameAttribute *string `access:"authentication_ldap"`
	LastNameAttribute  *string `access:"authentication_ldap"`
	EmailAttribute     *string `access:"authentication_ldap"`
	UsernameAttribute  *string `access:"authentication_ldap"`
	NicknameAttribute  *string `access:"authentication_ldap"`
	IdAttribute        *string `access:"authentication_ldap"`
	PositionAttribute  *string `access:"authentication_ldap"`
	LoginIdAttribute   *string `access:"authentication_ldap"`
	PictureAttribute   *string `access:"authentication_ldap"`

	// Synchronization
	SyncIntervalMinutes *int  `access:"authentication_ldap"`
	ReAddRemovedMembers *bool `access:"authentication_ldap"`

	// Advanced
	SkipCertificateVerification *bool   `access:"authentication_ldap"`
	PublicCertificateFile       *string `access:"authentication_ldap"`
	PrivateKeyFile              *string `access:"authentication_ldap"`
	QueryTimeout                *int    `access:"authentication_ldap"`
	MaxPageSize                 *int    `access:"authentication_ldap"`

	// Customization
	LoginFieldName *string `access:"authentication_ldap"`

	LoginButtonColor       *string `access:"experimental_features"`
	LoginButtonBorderColor *string `access:"experimental_features"`
	LoginButtonTextColor   *string `access:"experimental_features"`
}

func (s *LdapSettings) SetDefaults() {
	if s.Enable == nil {
		s.Enable = NewPointer(false)
	}

	// When unset should default to LDAP Enabled
	if s.EnableSync == nil {
		s.EnableSync = NewPointer(*s.Enable)
	}

	if s.EnableAdminFilter == nil {
		s.EnableAdminFilter = NewPointer(false)
	}

	if s.LdapServer == nil {
		s.LdapServer = NewPointer("")
	}

	if s.LdapPort == nil {
		s.LdapPort = NewPointer(389)
	}

	if s.ConnectionSecurity == nil {
		s.ConnectionSecurity = NewPointer("")
	}

	if s.PublicCertificateFile == nil {
		s.PublicCertificateFile = NewPointer("")
	}

	if s.PrivateKeyFile == nil {
		s.PrivateKeyFile = NewPointer("")
	}

	if s.BaseDN == nil {
		s.BaseDN = NewPointer("")
	}

	if s.BindUsername == nil {
		s.BindUsername = NewPointer("")
	}

	if s.BindPassword == nil {
		s.BindPassword = NewPointer("")
	}

	if s.MaximumLoginAttempts == nil {
		s.MaximumLoginAttempts = NewPointer(LdapSettingsDefaultMaximumLoginAttempts)
	}

	if s.UserFilter == nil {
		s.UserFilter = NewPointer("")
	}

	if s.GuestFilter == nil {
		s.GuestFilter = NewPointer("")
	}

	if s.AdminFilter == nil {
		s.AdminFilter = NewPointer("")
	}

	if s.GroupFilter == nil {
		s.GroupFilter = NewPointer("")
	}

	if s.GroupDisplayNameAttribute == nil {
		s.GroupDisplayNameAttribute = NewPointer(LdapSettingsDefaultGroupDisplayNameAttribute)
	}

	if s.GroupIdAttribute == nil {
		s.GroupIdAttribute = NewPointer(LdapSettingsDefaultGroupIdAttribute)
	}

	if s.FirstNameAttribute == nil {
		s.FirstNameAttribute = NewPointer(LdapSettingsDefaultFirstNameAttribute)
	}

	if s.LastNameAttribute == nil {
		s.LastNameAttribute = NewPointer(LdapSettingsDefaultLastNameAttribute)
	}

	if s.EmailAttribute == nil {
		s.EmailAttribute = NewPointer(LdapSettingsDefaultEmailAttribute)
	}

	if s.UsernameAttribute == nil {
		s.UsernameAttribute = NewPointer(LdapSettingsDefaultUsernameAttribute)
	}

	if s.NicknameAttribute == nil {
		s.NicknameAttribute = NewPointer(LdapSettingsDefaultNicknameAttribute)
	}

	if s.IdAttribute == nil {
		s.IdAttribute = NewPointer(LdapSettingsDefaultIdAttribute)
	}

	if s.PositionAttribute == nil {
		s.PositionAttribute = NewPointer(LdapSettingsDefaultPositionAttribute)
	}

	if s.PictureAttribute == nil {
		s.PictureAttribute = NewPointer(LdapSettingsDefaultPictureAttribute)
	}

	// For those upgrading to the version when LoginIdAttribute was added
	// they need IdAttribute == LoginIdAttribute not to break
	if s.LoginIdAttribute == nil {
		s.LoginIdAttribute = s.IdAttribute
	}

	if s.SyncIntervalMinutes == nil {
		s.SyncIntervalMinutes = NewPointer(60)
	}

	if s.ReAddRemovedMembers == nil {
		s.ReAddRemovedMembers = NewPointer(false)
	}

	if s.SkipCertificateVerification == nil {
		s.SkipCertificateVerification = NewPointer(false)
	}

	if s.QueryTimeout == nil {
		s.QueryTimeout = NewPointer(60)
	}

	if s.MaxPageSize == nil {
		s.MaxPageSize = NewPointer(0)
	}

	if s.LoginFieldName == nil {
		s.LoginFieldName = NewPointer(LdapSettingsDefaultLoginFieldName)
	}

	if s.LoginButtonColor == nil {
		s.LoginButtonColor = NewPointer("#0000")
	}

	if s.LoginButtonBorderColor == nil {
		s.LoginButtonBorderColor = NewPointer("#2389D7")
	}

	if s.LoginButtonTextColor == nil {
		s.LoginButtonTextColor = NewPointer("#2389D7")
	}
}

type ComplianceSettings struct {
	Enable      *bool   `access:"compliance_compliance_monitoring"`
	Directory   *string `access:"compliance_compliance_monitoring"` // telemetry: none
	EnableDaily *bool   `access:"compliance_compliance_monitoring"`
	BatchSize   *int    `access:"compliance_compliance_monitoring"` // telemetry: none
}

func (s *ComplianceSettings) SetDefaults() {
	if s.Enable == nil {
		s.Enable = NewPointer(false)
	}

	if s.Directory == nil {
		s.Directory = NewPointer("./data/")
	}

	if s.EnableDaily == nil {
		s.EnableDaily = NewPointer(false)
	}

	if s.BatchSize == nil {
		s.BatchSize = NewPointer(30000)
	}
}

type LocalizationSettings struct {
	DefaultServerLocale       *string `access:"site_localization"`
	DefaultClientLocale       *string `access:"site_localization"`
	AvailableLocales          *string `access:"site_localization"`
	EnableExperimentalLocales *bool   `access:"site_localization"`
}

func (s *LocalizationSettings) SetDefaults() {
	if s.DefaultServerLocale == nil {
		s.DefaultServerLocale = NewPointer(DefaultLocale)
	}

	if s.DefaultClientLocale == nil {
		s.DefaultClientLocale = NewPointer(DefaultLocale)
	}

	if s.AvailableLocales == nil {
		s.AvailableLocales = NewPointer("")
	}

	if s.EnableExperimentalLocales == nil {
		s.EnableExperimentalLocales = NewPointer(false)
	}
}

type SamlSettings struct {
	// Basic
	Enable                        *bool `access:"authentication_saml"`
	EnableSyncWithLdap            *bool `access:"authentication_saml"`
	EnableSyncWithLdapIncludeAuth *bool `access:"authentication_saml"`
	IgnoreGuestsLdapSync          *bool `access:"authentication_saml"`

	Verify      *bool `access:"authentication_saml"`
	Encrypt     *bool `access:"authentication_saml"`
	SignRequest *bool `access:"authentication_saml"`

	IdpURL                      *string `access:"authentication_saml"` // telemetry: none
	IdpDescriptorURL            *string `access:"authentication_saml"` // telemetry: none
	IdpMetadataURL              *string `access:"authentication_saml"` // telemetry: none
	ServiceProviderIdentifier   *string `access:"authentication_saml"` // telemetry: none
	AssertionConsumerServiceURL *string `access:"authentication_saml"` // telemetry: none

	SignatureAlgorithm *string `access:"authentication_saml"`
	CanonicalAlgorithm *string `access:"authentication_saml"`

	ScopingIDPProviderId *string `access:"authentication_saml"`
	ScopingIDPName       *string `access:"authentication_saml"`

	IdpCertificateFile    *string `access:"authentication_saml"` // telemetry: none
	PublicCertificateFile *string `access:"authentication_saml"` // telemetry: none
	PrivateKeyFile        *string `access:"authentication_saml"` // telemetry: none

	// User Mapping
	IdAttribute          *string `access:"authentication_saml"`
	GuestAttribute       *string `access:"authentication_saml"`
	EnableAdminAttribute *bool
	AdminAttribute       *string
	FirstNameAttribute   *string `access:"authentication_saml"`
	LastNameAttribute    *string `access:"authentication_saml"`
	EmailAttribute       *string `access:"authentication_saml"`
	UsernameAttribute    *string `access:"authentication_saml"`
	NicknameAttribute    *string `access:"authentication_saml"`
	LocaleAttribute      *string `access:"authentication_saml"`
	PositionAttribute    *string `access:"authentication_saml"`

	LoginButtonText *string `access:"authentication_saml"`

	LoginButtonColor       *string `access:"experimental_features"`
	LoginButtonBorderColor *string `access:"experimental_features"`
	LoginButtonTextColor   *string `access:"experimental_features"`
}

func (s *SamlSettings) SetDefaults() {
	if s.Enable == nil {
		s.Enable = NewPointer(false)
	}

	if s.EnableSyncWithLdap == nil {
		s.EnableSyncWithLdap = NewPointer(false)
	}

	if s.EnableSyncWithLdapIncludeAuth == nil {
		s.EnableSyncWithLdapIncludeAuth = NewPointer(false)
	}

	if s.IgnoreGuestsLdapSync == nil {
		s.IgnoreGuestsLdapSync = NewPointer(false)
	}

	if s.EnableAdminAttribute == nil {
		s.EnableAdminAttribute = NewPointer(false)
	}

	if s.Verify == nil {
		s.Verify = NewPointer(true)
	}

	if s.Encrypt == nil {
		s.Encrypt = NewPointer(true)
	}

	if s.SignRequest == nil {
		s.SignRequest = NewPointer(false)
	}

	if s.SignatureAlgorithm == nil {
		s.SignatureAlgorithm = NewPointer(SamlSettingsDefaultSignatureAlgorithm)
	}

	if s.CanonicalAlgorithm == nil {
		s.CanonicalAlgorithm = NewPointer(SamlSettingsDefaultCanonicalAlgorithm)
	}

	if s.IdpURL == nil {
		s.IdpURL = NewPointer("")
	}

	if s.IdpDescriptorURL == nil {
		s.IdpDescriptorURL = NewPointer("")
	}

	if s.ServiceProviderIdentifier == nil {
		if s.IdpDescriptorURL != nil {
			s.ServiceProviderIdentifier = NewPointer(*s.IdpDescriptorURL)
		} else {
			s.ServiceProviderIdentifier = NewPointer("")
		}
	}

	if s.IdpMetadataURL == nil {
		s.IdpMetadataURL = NewPointer("")
	}

	if s.IdpCertificateFile == nil {
		s.IdpCertificateFile = NewPointer("")
	}

	if s.PublicCertificateFile == nil {
		s.PublicCertificateFile = NewPointer("")
	}

	if s.PrivateKeyFile == nil {
		s.PrivateKeyFile = NewPointer("")
	}

	if s.AssertionConsumerServiceURL == nil {
		s.AssertionConsumerServiceURL = NewPointer("")
	}

	if s.ScopingIDPProviderId == nil {
		s.ScopingIDPProviderId = NewPointer("")
	}

	if s.ScopingIDPName == nil {
		s.ScopingIDPName = NewPointer("")
	}

	if s.LoginButtonText == nil || *s.LoginButtonText == "" {
		s.LoginButtonText = NewPointer(UserAuthServiceSamlText)
	}

	if s.IdAttribute == nil {
		s.IdAttribute = NewPointer(SamlSettingsDefaultIdAttribute)
	}

	if s.GuestAttribute == nil {
		s.GuestAttribute = NewPointer(SamlSettingsDefaultGuestAttribute)
	}
	if s.AdminAttribute == nil {
		s.AdminAttribute = NewPointer(SamlSettingsDefaultAdminAttribute)
	}
	if s.FirstNameAttribute == nil {
		s.FirstNameAttribute = NewPointer(SamlSettingsDefaultFirstNameAttribute)
	}

	if s.LastNameAttribute == nil {
		s.LastNameAttribute = NewPointer(SamlSettingsDefaultLastNameAttribute)
	}

	if s.EmailAttribute == nil {
		s.EmailAttribute = NewPointer(SamlSettingsDefaultEmailAttribute)
	}

	if s.UsernameAttribute == nil {
		s.UsernameAttribute = NewPointer(SamlSettingsDefaultUsernameAttribute)
	}

	if s.NicknameAttribute == nil {
		s.NicknameAttribute = NewPointer(SamlSettingsDefaultNicknameAttribute)
	}

	if s.PositionAttribute == nil {
		s.PositionAttribute = NewPointer(SamlSettingsDefaultPositionAttribute)
	}

	if s.LocaleAttribute == nil {
		s.LocaleAttribute = NewPointer(SamlSettingsDefaultLocaleAttribute)
	}

	if s.LoginButtonColor == nil {
		s.LoginButtonColor = NewPointer("#34a28b")
	}

	if s.LoginButtonBorderColor == nil {
		s.LoginButtonBorderColor = NewPointer("#2389D7")
	}

	if s.LoginButtonTextColor == nil {
		s.LoginButtonTextColor = NewPointer("#ffffff")
	}
}

type NativeAppSettings struct {
	AppCustomURLSchemes        []string `access:"site_customization,write_restrictable,cloud_restrictable"` // telemetry: none
	AppDownloadLink            *string  `access:"site_customization,write_restrictable,cloud_restrictable"`
	AndroidAppDownloadLink     *string  `access:"site_customization,write_restrictable,cloud_restrictable"`
	IosAppDownloadLink         *string  `access:"site_customization,write_restrictable,cloud_restrictable"`
	MobileExternalBrowser      *bool    `access:"site_customization,write_restrictable,cloud_restrictable"`
	MobileEnableBiometrics     *bool    `access:"site_customization,write_restrictable"`
	MobilePreventScreenCapture *bool    `access:"site_customization,write_restrictable"`
	MobileJailbreakProtection  *bool    `access:"site_customization,write_restrictable"`
}

func (s *NativeAppSettings) SetDefaults() {
	if s.AppDownloadLink == nil {
		s.AppDownloadLink = NewPointer(NativeappSettingsDefaultAppDownloadLink)
	}

	if s.AndroidAppDownloadLink == nil {
		s.AndroidAppDownloadLink = NewPointer(NativeappSettingsDefaultAndroidAppDownloadLink)
	}

	if s.IosAppDownloadLink == nil {
		s.IosAppDownloadLink = NewPointer(NativeappSettingsDefaultIosAppDownloadLink)
	}

	if s.AppCustomURLSchemes == nil {
		s.AppCustomURLSchemes = GetDefaultAppCustomURLSchemes()
	}

	if s.MobileExternalBrowser == nil {
		s.MobileExternalBrowser = NewPointer(false)
	}

	if s.MobileEnableBiometrics == nil {
		s.MobileEnableBiometrics = NewPointer(false)
	}

	if s.MobilePreventScreenCapture == nil {
		s.MobilePreventScreenCapture = NewPointer(false)
	}

	if s.MobileJailbreakProtection == nil {
		s.MobileJailbreakProtection = NewPointer(false)
	}
}

type ElasticsearchSettings struct {
	ConnectionURL                 *string `access:"environment_elasticsearch,write_restrictable,cloud_restrictable"`
	Backend                       *string `access:"environment_elasticsearch,write_restrictable,cloud_restrictable"`
	Username                      *string `access:"environment_elasticsearch,write_restrictable,cloud_restrictable"`
	Password                      *string `access:"environment_elasticsearch,write_restrictable,cloud_restrictable"`
	EnableIndexing                *bool   `access:"environment_elasticsearch,write_restrictable,cloud_restrictable"`
	EnableSearching               *bool   `access:"environment_elasticsearch,write_restrictable,cloud_restrictable"`
	EnableAutocomplete            *bool   `access:"environment_elasticsearch,write_restrictable,cloud_restrictable"`
	Sniff                         *bool   `access:"environment_elasticsearch,write_restrictable,cloud_restrictable"`
	PostIndexReplicas             *int    `access:"environment_elasticsearch,write_restrictable,cloud_restrictable"`
	PostIndexShards               *int    `access:"environment_elasticsearch,write_restrictable,cloud_restrictable"`
	ChannelIndexReplicas          *int    `access:"environment_elasticsearch,write_restrictable,cloud_restrictable"`
	ChannelIndexShards            *int    `access:"environment_elasticsearch,write_restrictable,cloud_restrictable"`
	UserIndexReplicas             *int    `access:"environment_elasticsearch,write_restrictable,cloud_restrictable"`
	UserIndexShards               *int    `access:"environment_elasticsearch,write_restrictable,cloud_restrictable"`
	AggregatePostsAfterDays       *int    `access:"environment_elasticsearch,write_restrictable,cloud_restrictable"` // telemetry: none
	PostsAggregatorJobStartTime   *string `access:"environment_elasticsearch,write_restrictable,cloud_restrictable"` // telemetry: none
	IndexPrefix                   *string `access:"environment_elasticsearch,write_restrictable,cloud_restrictable"`
	GlobalSearchPrefix            *string `access:"environment_elasticsearch,write_restrictable,cloud_restrictable"`
	LiveIndexingBatchSize         *int    `access:"environment_elasticsearch,write_restrictable,cloud_restrictable"`
	BulkIndexingTimeWindowSeconds *int    `json:",omitempty"` // telemetry: none
	BatchSize                     *int    `access:"environment_elasticsearch,write_restrictable,cloud_restrictable"`
	RequestTimeoutSeconds         *int    `access:"environment_elasticsearch,write_restrictable,cloud_restrictable"`
	SkipTLSVerification           *bool   `access:"environment_elasticsearch,write_restrictable,cloud_restrictable"`
	CA                            *string `access:"environment_elasticsearch,write_restrictable,cloud_restrictable"`
	ClientCert                    *string `access:"environment_elasticsearch,write_restrictable,cloud_restrictable"`
	ClientKey                     *string `access:"environment_elasticsearch,write_restrictable,cloud_restrictable"`
	Trace                         *string `access:"environment_elasticsearch,write_restrictable,cloud_restrictable"`
	IgnoredPurgeIndexes           *string `access:"environment_elasticsearch,write_restrictable,cloud_restrictable"` // telemetry: none
}

func (s *ElasticsearchSettings) SetDefaults() {
	if s.ConnectionURL == nil {
		s.ConnectionURL = NewPointer(ElasticsearchSettingsDefaultConnectionURL)
	}

	if s.Backend == nil {
		s.Backend = NewPointer(ElasticsearchSettingsESBackend)
	}

	if s.Username == nil {
		s.Username = NewPointer(ElasticsearchSettingsDefaultUsername)
	}

	if s.Password == nil {
		s.Password = NewPointer(ElasticsearchSettingsDefaultPassword)
	}

	if s.CA == nil {
		s.CA = NewPointer("")
	}

	if s.ClientCert == nil {
		s.ClientCert = NewPointer("")
	}

	if s.ClientKey == nil {
		s.ClientKey = NewPointer("")
	}

	if s.EnableIndexing == nil {
		s.EnableIndexing = NewPointer(false)
	}

	if s.EnableSearching == nil {
		s.EnableSearching = NewPointer(false)
	}

	if s.EnableAutocomplete == nil {
		s.EnableAutocomplete = NewPointer(false)
	}

	if s.Sniff == nil {
		s.Sniff = NewPointer(true)
	}

	if s.PostIndexReplicas == nil {
		s.PostIndexReplicas = NewPointer(ElasticsearchSettingsDefaultPostIndexReplicas)
	}

	if s.PostIndexShards == nil {
		s.PostIndexShards = NewPointer(ElasticsearchSettingsDefaultPostIndexShards)
	}

	if s.ChannelIndexReplicas == nil {
		s.ChannelIndexReplicas = NewPointer(ElasticsearchSettingsDefaultChannelIndexReplicas)
	}

	if s.ChannelIndexShards == nil {
		s.ChannelIndexShards = NewPointer(ElasticsearchSettingsDefaultChannelIndexShards)
	}

	if s.UserIndexReplicas == nil {
		s.UserIndexReplicas = NewPointer(ElasticsearchSettingsDefaultUserIndexReplicas)
	}

	if s.UserIndexShards == nil {
		s.UserIndexShards = NewPointer(ElasticsearchSettingsDefaultUserIndexShards)
	}

	if s.AggregatePostsAfterDays == nil {
		s.AggregatePostsAfterDays = NewPointer(ElasticsearchSettingsDefaultAggregatePostsAfterDays)
	}

	if s.PostsAggregatorJobStartTime == nil {
		s.PostsAggregatorJobStartTime = NewPointer(ElasticsearchSettingsDefaultPostsAggregatorJobStartTime)
	}

	if s.IndexPrefix == nil {
		s.IndexPrefix = NewPointer(ElasticsearchSettingsDefaultIndexPrefix)
	}

	if s.GlobalSearchPrefix == nil {
		s.GlobalSearchPrefix = NewPointer("")
	}

	if s.LiveIndexingBatchSize == nil {
		s.LiveIndexingBatchSize = NewPointer(ElasticsearchSettingsDefaultLiveIndexingBatchSize)
	}

	if s.BatchSize == nil {
		s.BatchSize = NewPointer(ElasticsearchSettingsDefaultBatchSize)
	}

	if s.RequestTimeoutSeconds == nil {
		s.RequestTimeoutSeconds = NewPointer(ElasticsearchSettingsDefaultRequestTimeoutSeconds)
	}

	if s.SkipTLSVerification == nil {
		s.SkipTLSVerification = NewPointer(false)
	}

	if s.Trace == nil {
		s.Trace = NewPointer("")
	}

	if s.IgnoredPurgeIndexes == nil {
		s.IgnoredPurgeIndexes = NewPointer("")
	}
}

type BleveSettings struct {
	IndexDir                      *string `access:"experimental_bleve"` // telemetry: none
	EnableIndexing                *bool   `access:"experimental_bleve"`
	EnableSearching               *bool   `access:"experimental_bleve"`
	EnableAutocomplete            *bool   `access:"experimental_bleve"`
	BulkIndexingTimeWindowSeconds *int    `json:",omitempty"` // telemetry: none
	BatchSize                     *int    `access:"experimental_bleve"`
}

func (bs *BleveSettings) SetDefaults() {
	if bs.IndexDir == nil {
		bs.IndexDir = NewPointer(BleveSettingsDefaultIndexDir)
	}

	if bs.EnableIndexing == nil {
		bs.EnableIndexing = NewPointer(false)
	}

	if bs.EnableSearching == nil {
		bs.EnableSearching = NewPointer(false)
	}

	if bs.EnableAutocomplete == nil {
		bs.EnableAutocomplete = NewPointer(false)
	}

	if bs.BatchSize == nil {
		bs.BatchSize = NewPointer(BleveSettingsDefaultBatchSize)
	}
}

type DataRetentionSettings struct {
	EnableMessageDeletion          *bool   `access:"compliance_data_retention_policy"`
	EnableFileDeletion             *bool   `access:"compliance_data_retention_policy"`
	EnableBoardsDeletion           *bool   `access:"compliance_data_retention_policy"`
	MessageRetentionDays           *int    `access:"compliance_data_retention_policy"` // Deprecated: use `MessageRetentionHours`
	MessageRetentionHours          *int    `access:"compliance_data_retention_policy"`
	FileRetentionDays              *int    `access:"compliance_data_retention_policy"` // Deprecated: use `FileRetentionHours`
	FileRetentionHours             *int    `access:"compliance_data_retention_policy"`
	BoardsRetentionDays            *int    `access:"compliance_data_retention_policy"`
	DeletionJobStartTime           *string `access:"compliance_data_retention_policy"`
	BatchSize                      *int    `access:"compliance_data_retention_policy"`
	TimeBetweenBatchesMilliseconds *int    `access:"compliance_data_retention_policy"`
	RetentionIdsBatchSize          *int    `access:"compliance_data_retention_policy"`
}

func (s *DataRetentionSettings) SetDefaults() {
	if s.EnableMessageDeletion == nil {
		s.EnableMessageDeletion = NewPointer(false)
	}

	if s.EnableFileDeletion == nil {
		s.EnableFileDeletion = NewPointer(false)
	}

	if s.EnableBoardsDeletion == nil {
		s.EnableBoardsDeletion = NewPointer(false)
	}

	if s.MessageRetentionDays == nil {
		s.MessageRetentionDays = NewPointer(DataRetentionSettingsDefaultMessageRetentionDays)
	}

	if s.MessageRetentionHours == nil {
		s.MessageRetentionHours = NewPointer(DataRetentionSettingsDefaultMessageRetentionHours)
	}

	if s.FileRetentionDays == nil {
		s.FileRetentionDays = NewPointer(DataRetentionSettingsDefaultFileRetentionDays)
	}

	if s.FileRetentionHours == nil {
		s.FileRetentionHours = NewPointer(DataRetentionSettingsDefaultFileRetentionHours)
	}

	if s.BoardsRetentionDays == nil {
		s.BoardsRetentionDays = NewPointer(DataRetentionSettingsDefaultBoardsRetentionDays)
	}

	if s.DeletionJobStartTime == nil {
		s.DeletionJobStartTime = NewPointer(DataRetentionSettingsDefaultDeletionJobStartTime)
	}

	if s.BatchSize == nil {
		s.BatchSize = NewPointer(DataRetentionSettingsDefaultBatchSize)
	}

	if s.TimeBetweenBatchesMilliseconds == nil {
		s.TimeBetweenBatchesMilliseconds = NewPointer(DataRetentionSettingsDefaultTimeBetweenBatchesMilliseconds)
	}
	if s.RetentionIdsBatchSize == nil {
		s.RetentionIdsBatchSize = NewPointer(DataRetentionSettingsDefaultRetentionIdsBatchSize)
	}
}

// GetMessageRetentionHours returns the message retention time as an int.
// MessageRetentionHours takes precedence over the deprecated MessageRetentionDays.
func (s *DataRetentionSettings) GetMessageRetentionHours() int {
	if s.MessageRetentionHours != nil && *s.MessageRetentionHours > 0 {
		return *s.MessageRetentionHours
	}
	if s.MessageRetentionDays != nil && *s.MessageRetentionDays > 0 {
		return *s.MessageRetentionDays * 24
	}
	return DataRetentionSettingsDefaultMessageRetentionDays * 24
}

// GetFileRetentionHours returns the message retention time as an int.
// FileRetentionHours takes precedence over the deprecated FileRetentionDays.
func (s *DataRetentionSettings) GetFileRetentionHours() int {
	if s.FileRetentionHours != nil && *s.FileRetentionHours > 0 {
		return *s.FileRetentionHours
	}
	if s.FileRetentionDays != nil && *s.FileRetentionDays > 0 {
		return *s.FileRetentionDays * 24
	}
	return DataRetentionSettingsDefaultFileRetentionDays * 24
}

type JobSettings struct {
	RunJobs                    *bool `access:"write_restrictable,cloud_restrictable"` // telemetry: none
	RunScheduler               *bool `access:"write_restrictable,cloud_restrictable"` // telemetry: none
	CleanupJobsThresholdDays   *int  `access:"write_restrictable,cloud_restrictable"`
	CleanupConfigThresholdDays *int  `access:"write_restrictable,cloud_restrictable"`
}

func (s *JobSettings) SetDefaults() {
	if s.RunJobs == nil {
		s.RunJobs = NewPointer(true)
	}

	if s.RunScheduler == nil {
		s.RunScheduler = NewPointer(true)
	}

	if s.CleanupJobsThresholdDays == nil {
		s.CleanupJobsThresholdDays = NewPointer(-1)
	}

	if s.CleanupConfigThresholdDays == nil {
		s.CleanupConfigThresholdDays = NewPointer(-1)
	}
}

type CloudSettings struct {
	CWSURL    *string `access:"write_restrictable"`
	CWSAPIURL *string `access:"write_restrictable"`
	CWSMock   *bool   `access:"write_restrictable"`
	Disable   *bool   `access:"write_restrictable,cloud_restrictable"`
}

func (s *CloudSettings) SetDefaults() {
	serviceEnvironment := GetServiceEnvironment()
	if s.CWSURL == nil || serviceEnvironment == ServiceEnvironmentProduction {
		switch serviceEnvironment {
		case ServiceEnvironmentProduction:
			s.CWSURL = NewPointer(CloudSettingsDefaultCwsURL)
		case ServiceEnvironmentTest, ServiceEnvironmentDev:
			s.CWSURL = NewPointer(CloudSettingsDefaultCwsURLTest)
		}
	}

	if s.CWSAPIURL == nil {
		switch serviceEnvironment {
		case ServiceEnvironmentProduction:
			s.CWSAPIURL = NewPointer(CloudSettingsDefaultCwsAPIURL)
		case ServiceEnvironmentTest, ServiceEnvironmentDev:
			s.CWSAPIURL = NewPointer(CloudSettingsDefaultCwsAPIURLTest)
		}
	}
	if s.CWSMock == nil {
		isMockCws := MockCWS == "true"
		s.CWSMock = &isMockCws
	}

	if s.Disable == nil {
		s.Disable = NewPointer(false)
	}
}

type PluginState struct {
	Enable bool
}

type PluginSettings struct {
	Enable                      *bool                     `access:"plugins,write_restrictable"`
	EnableUploads               *bool                     `access:"plugins,write_restrictable,cloud_restrictable"`
	AllowInsecureDownloadURL    *bool                     `access:"plugins,write_restrictable,cloud_restrictable"`
	EnableHealthCheck           *bool                     `access:"plugins,write_restrictable,cloud_restrictable"`
	Directory                   *string                   `access:"plugins,write_restrictable,cloud_restrictable"` // telemetry: none
	ClientDirectory             *string                   `access:"plugins,write_restrictable,cloud_restrictable"` // telemetry: none
	Plugins                     map[string]map[string]any `access:"plugins"`                                       // telemetry: none
	PluginStates                map[string]*PluginState   `access:"plugins"`                                       // telemetry: none
	EnableMarketplace           *bool                     `access:"plugins,write_restrictable,cloud_restrictable"`
	EnableRemoteMarketplace     *bool                     `access:"plugins,write_restrictable,cloud_restrictable"`
	AutomaticPrepackagedPlugins *bool                     `access:"plugins,write_restrictable,cloud_restrictable"`
	RequirePluginSignature      *bool                     `access:"plugins,write_restrictable,cloud_restrictable"`
	MarketplaceURL              *string                   `access:"plugins,write_restrictable,cloud_restrictable"`
	SignaturePublicKeyFiles     []string                  `access:"plugins,write_restrictable,cloud_restrictable"`
	ChimeraOAuthProxyURL        *string                   `access:"plugins,write_restrictable,cloud_restrictable"`
}

func (s *PluginSettings) SetDefaults(ls LogSettings) {
	if s.Enable == nil {
		s.Enable = NewPointer(true)
	}

	if s.EnableUploads == nil {
		s.EnableUploads = NewPointer(false)
	}

	if s.AllowInsecureDownloadURL == nil {
		s.AllowInsecureDownloadURL = NewPointer(false)
	}

	if s.EnableHealthCheck == nil {
		s.EnableHealthCheck = NewPointer(true)
	}

	if s.Directory == nil || *s.Directory == "" {
		s.Directory = NewPointer(PluginSettingsDefaultDirectory)
	}

	if s.ClientDirectory == nil || *s.ClientDirectory == "" {
		s.ClientDirectory = NewPointer(PluginSettingsDefaultClientDirectory)
	}

	if s.Plugins == nil {
		s.Plugins = make(map[string]map[string]any)
	}

	if s.PluginStates == nil {
		s.PluginStates = make(map[string]*PluginState)
	}

	if s.PluginStates[PluginIdNPS] == nil {
		// Enable the NPS plugin by default if diagnostics are enabled
		s.PluginStates[PluginIdNPS] = &PluginState{Enable: ls.EnableDiagnostics == nil || *ls.EnableDiagnostics}
	}

	if s.PluginStates[PluginIdCalls] == nil {
		// Enable the calls plugin by default
		s.PluginStates[PluginIdCalls] = &PluginState{Enable: true}
	}

	if s.PluginStates[PluginIdPlaybooks] == nil {
		// Enable the playbooks plugin by default
		s.PluginStates[PluginIdPlaybooks] = &PluginState{Enable: true}
	}

	if s.PluginStates[PluginIdAI] == nil {
		// Enable the AI plugin by default
		s.PluginStates[PluginIdAI] = &PluginState{Enable: true}
	}

	if s.EnableMarketplace == nil {
		s.EnableMarketplace = NewPointer(PluginSettingsDefaultEnableMarketplace)
	}

	if s.EnableRemoteMarketplace == nil {
		s.EnableRemoteMarketplace = NewPointer(true)
	}

	if s.AutomaticPrepackagedPlugins == nil {
		s.AutomaticPrepackagedPlugins = NewPointer(true)
	}

	if s.MarketplaceURL == nil || *s.MarketplaceURL == "" || *s.MarketplaceURL == PluginSettingsOldMarketplaceURL {
		s.MarketplaceURL = NewPointer(PluginSettingsDefaultMarketplaceURL)
	}

	if s.RequirePluginSignature == nil {
		s.RequirePluginSignature = NewPointer(false)
	}

	if s.SignaturePublicKeyFiles == nil {
		s.SignaturePublicKeyFiles = []string{}
	}

	if s.ChimeraOAuthProxyURL == nil {
		s.ChimeraOAuthProxyURL = NewPointer("")
	}
}

// Sanitize cleans up the plugin settings by removing any sensitive information.
// It does so by checking if the setting is marked as secret in the plugin manifest.
// If it is, the setting is replaced with a fake value.
// If a plugin is no longer installed, all settings of it's are sanitized.
// If the list of manifests in nil, i.e. plugins are disabled, all settings are sanitized.
func (s *PluginSettings) Sanitize(pluginManifests []*Manifest) {
	manifestMap := make(map[string]*Manifest, len(pluginManifests))

	for _, manifest := range pluginManifests {
		manifestMap[manifest.Id] = manifest
	}

	for id, settings := range s.Plugins {
		manifest := manifestMap[id]

		for key := range settings {
			if manifest == nil {
				// Don't return plugin settings for plugins that are not installed
				delete(s.Plugins, id)
				break
			}

			for _, definedSetting := range manifest.SettingsSchema.Settings {
				if definedSetting.Secret && strings.EqualFold(definedSetting.Key, key) {
					settings[key] = FakeSetting
					break
				}
			}
		}
	}
}

type WranglerSettings struct {
	PermittedWranglerRoles                   []string
	AllowedEmailDomain                       []string
	MoveThreadMaxCount                       *int64
	MoveThreadToAnotherTeamEnable            *bool
	MoveThreadFromPrivateChannelEnable       *bool
	MoveThreadFromDirectMessageChannelEnable *bool
	MoveThreadFromGroupMessageChannelEnable  *bool
}

func (w *WranglerSettings) SetDefaults() {
	if w.PermittedWranglerRoles == nil {
		w.PermittedWranglerRoles = make([]string, 0)
	}
	if w.AllowedEmailDomain == nil {
		w.AllowedEmailDomain = make([]string, 0)
	}
	if w.MoveThreadMaxCount == nil {
		w.MoveThreadMaxCount = NewPointer(int64(100))
	}
	if w.MoveThreadToAnotherTeamEnable == nil {
		w.MoveThreadToAnotherTeamEnable = NewPointer(false)
	}
	if w.MoveThreadFromPrivateChannelEnable == nil {
		w.MoveThreadFromPrivateChannelEnable = NewPointer(false)
	}
	if w.MoveThreadFromDirectMessageChannelEnable == nil {
		w.MoveThreadFromDirectMessageChannelEnable = NewPointer(false)
	}
	if w.MoveThreadFromGroupMessageChannelEnable == nil {
		w.MoveThreadFromGroupMessageChannelEnable = NewPointer(false)
	}
}

func (w *WranglerSettings) IsValid() *AppError {
	validDomainRegex := regexp.MustCompile(`^(([a-zA-Z]{1})|([a-zA-Z]{1}[a-zA-Z]{1})|([a-zA-Z]{1}[0-9]{1})|([0-9]{1}[a-zA-Z]{1})|([a-zA-Z0-9][a-zA-Z0-9-_]{1,61}[a-zA-Z0-9]))\.([a-zA-Z]{2,6}|[a-zA-Z0-9-]{2,30}\.[a-zA-Z]{2,3})$`)
	for _, domain := range w.AllowedEmailDomain {
		if !validDomainRegex.MatchString(domain) && domain != "localhost" {
			return NewAppError("Config.IsValid", "model.config.is_valid.move_thread.domain_invalid.app_error", nil, "", http.StatusBadRequest)
		}
	}

	return nil
}

type ConnectedWorkspacesSettings struct {
	EnableSharedChannels            *bool
	EnableRemoteClusterService      *bool
	DisableSharedChannelsStatusSync *bool
	MaxPostsPerSync                 *int
}

func (c *ConnectedWorkspacesSettings) SetDefaults(isUpdate bool, e ExperimentalSettings) {
	if c.EnableSharedChannels == nil {
		if isUpdate && e.EnableSharedChannels != nil {
			c.EnableSharedChannels = e.EnableSharedChannels
		} else {
			c.EnableSharedChannels = NewPointer(false)
		}
	}

	if c.EnableRemoteClusterService == nil {
		if isUpdate && e.EnableRemoteClusterService != nil {
			c.EnableRemoteClusterService = e.EnableRemoteClusterService
		} else {
			c.EnableRemoteClusterService = NewPointer(false)
		}
	}

	if c.DisableSharedChannelsStatusSync == nil {
		c.DisableSharedChannelsStatusSync = NewPointer(false)
	}

	if c.MaxPostsPerSync == nil {
		c.MaxPostsPerSync = NewPointer(ConnectedWorkspacesSettingsDefaultMaxPostsPerSync)
	}
}

type GlobalRelayMessageExportSettings struct {
	CustomerType         *string `access:"compliance_compliance_export"` // must be either A9, A10 or CUSTOM, dictates SMTP server url
	SMTPUsername         *string `access:"compliance_compliance_export"`
	SMTPPassword         *string `access:"compliance_compliance_export"`
	EmailAddress         *string `access:"compliance_compliance_export"` // the address to send messages to
	SMTPServerTimeout    *int    `access:"compliance_compliance_export"`
	CustomSMTPServerName *string `access:"compliance_compliance_export"`
	CustomSMTPPort       *string `access:"compliance_compliance_export"`
}

func (s *GlobalRelayMessageExportSettings) SetDefaults() {
	if s.CustomerType == nil {
		s.CustomerType = NewPointer(GlobalrelayCustomerTypeA9)
	}
	if s.SMTPUsername == nil {
		s.SMTPUsername = NewPointer("")
	}
	if s.SMTPPassword == nil {
		s.SMTPPassword = NewPointer("")
	}
	if s.EmailAddress == nil {
		s.EmailAddress = NewPointer("")
	}
	if s.SMTPServerTimeout == nil || *s.SMTPServerTimeout == 0 {
		s.SMTPServerTimeout = NewPointer(1800)
	}
	if s.CustomSMTPServerName == nil {
		s.CustomSMTPServerName = NewPointer("")
	}
	if s.CustomSMTPPort == nil {
		s.CustomSMTPPort = NewPointer("25")
	}
}

type MessageExportSettings struct {
	EnableExport            *bool   `access:"compliance_compliance_export"`
	ExportFormat            *string `access:"compliance_compliance_export"`
	DailyRunTime            *string `access:"compliance_compliance_export"`
	ExportFromTimestamp     *int64  `access:"compliance_compliance_export"`
	BatchSize               *int    `access:"compliance_compliance_export"`
	DownloadExportResults   *bool   `access:"compliance_compliance_export"`
	ChannelBatchSize        *int    `access:"compliance_compliance_export"`
	ChannelHistoryBatchSize *int    `access:"compliance_compliance_export"`

	// formatter-specific settings - these are only expected to be non-nil if ExportFormat is set to the associated format
	GlobalRelaySettings *GlobalRelayMessageExportSettings `access:"compliance_compliance_export"`
}

func (s *MessageExportSettings) SetDefaults() {
	if s.EnableExport == nil {
		s.EnableExport = NewPointer(false)
	}

	if s.DownloadExportResults == nil {
		s.DownloadExportResults = NewPointer(false)
	}

	if s.ExportFormat == nil {
		s.ExportFormat = NewPointer(ComplianceExportTypeActiance)
	}

	if s.DailyRunTime == nil {
		s.DailyRunTime = NewPointer("01:00")
	}

	if s.ExportFromTimestamp == nil {
		s.ExportFromTimestamp = NewPointer(int64(0))
	}

	if s.BatchSize == nil {
		s.BatchSize = NewPointer(10000)
	}

	if s.ChannelBatchSize == nil || *s.ChannelBatchSize == 0 {
		s.ChannelBatchSize = NewPointer(ComplianceExportChannelBatchSizeDefault)
	}

	if s.ChannelHistoryBatchSize == nil || *s.ChannelHistoryBatchSize == 0 {
		s.ChannelHistoryBatchSize = NewPointer(ComplianceExportChannelHistoryBatchSizeDefault)
	}

	if s.GlobalRelaySettings == nil {
		s.GlobalRelaySettings = &GlobalRelayMessageExportSettings{}
	}
	s.GlobalRelaySettings.SetDefaults()
}

type DisplaySettings struct {
	CustomURLSchemes []string `access:"site_posts"`
	MaxMarkdownNodes *int     `access:"site_posts"`
}

func (s *DisplaySettings) SetDefaults() {
	if s.CustomURLSchemes == nil {
		customURLSchemes := []string{}
		s.CustomURLSchemes = customURLSchemes
	}

	if s.MaxMarkdownNodes == nil {
		s.MaxMarkdownNodes = NewPointer(0)
	}
}

type GuestAccountsSettings struct {
	Enable                           *bool   `access:"authentication_guest_access"`
	HideTags                         *bool   `access:"authentication_guest_access"`
	AllowEmailAccounts               *bool   `access:"authentication_guest_access"`
	EnforceMultifactorAuthentication *bool   `access:"authentication_guest_access"`
	RestrictCreationToDomains        *string `access:"authentication_guest_access"`
}

func (s *GuestAccountsSettings) SetDefaults() {
	if s.Enable == nil {
		s.Enable = NewPointer(false)
	}

	if s.HideTags == nil {
		s.HideTags = NewPointer(false)
	}

	if s.AllowEmailAccounts == nil {
		s.AllowEmailAccounts = NewPointer(true)
	}

	if s.EnforceMultifactorAuthentication == nil {
		s.EnforceMultifactorAuthentication = NewPointer(false)
	}

	if s.RestrictCreationToDomains == nil {
		s.RestrictCreationToDomains = NewPointer("")
	}
}

type ImageProxySettings struct {
	Enable                  *bool   `access:"environment_image_proxy"`
	ImageProxyType          *string `access:"environment_image_proxy"`
	RemoteImageProxyURL     *string `access:"environment_image_proxy"`
	RemoteImageProxyOptions *string `access:"environment_image_proxy"`
}

func (s *ImageProxySettings) SetDefaults() {
	if s.Enable == nil {
		s.Enable = NewPointer(false)
	}

	if s.ImageProxyType == nil {
		s.ImageProxyType = NewPointer(ImageProxyTypeLocal)
	}

	if s.RemoteImageProxyURL == nil {
		s.RemoteImageProxyURL = NewPointer("")
	}

	if s.RemoteImageProxyOptions == nil {
		s.RemoteImageProxyOptions = NewPointer("")
	}
}

// ImportSettings defines configuration settings for file imports.
type ImportSettings struct {
	// The directory where to store the imported files.
	Directory *string
	// The number of days to retain the imported files before deleting them.
	RetentionDays *int
}

func (s *ImportSettings) isValid() *AppError {
	if *s.Directory == "" {
		return NewAppError("Config.IsValid", "model.config.is_valid.import.directory.app_error", nil, "", http.StatusBadRequest)
	}

	if *s.RetentionDays <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.import.retention_days_too_low.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

// SetDefaults applies the default settings to the struct.
func (s *ImportSettings) SetDefaults() {
	if s.Directory == nil || *s.Directory == "" {
		s.Directory = NewPointer(ImportSettingsDefaultDirectory)
	}

	if s.RetentionDays == nil {
		s.RetentionDays = NewPointer(ImportSettingsDefaultRetentionDays)
	}
}

// ExportSettings defines configuration settings for file exports.
type ExportSettings struct {
	// The directory where to store the exported files.
	Directory *string // telemetry: none
	// The number of days to retain the exported files before deleting them.
	RetentionDays *int
}

func (s *ExportSettings) isValid() *AppError {
	if *s.Directory == "" {
		return NewAppError("Config.IsValid", "model.config.is_valid.export.directory.app_error", nil, "", http.StatusBadRequest)
	}

	if *s.RetentionDays <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.export.retention_days_too_low.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

// SetDefaults applies the default settings to the struct.
func (s *ExportSettings) SetDefaults() {
	if s.Directory == nil || *s.Directory == "" {
		s.Directory = NewPointer(ExportSettingsDefaultDirectory)
	}

	if s.RetentionDays == nil {
		s.RetentionDays = NewPointer(ExportSettingsDefaultRetentionDays)
	}
}

type AccessControlSettings struct {
	EnableAttributeBasedAccessControl *bool `access:"write_restrictable,cloud_restrictable"`
	EnableChannelScopeAccessControl   *bool `access:"cloud_restrictable"`
}

func (s *AccessControlSettings) SetDefaults() {
	if s.EnableAttributeBasedAccessControl == nil {
		s.EnableAttributeBasedAccessControl = NewPointer(false)
	}

	if s.EnableChannelScopeAccessControl == nil {
		s.EnableChannelScopeAccessControl = NewPointer(false)
	}
}

type ConfigFunc func() *Config

const (
	ConfigAccessTagType              = "access"
	ConfigAccessTagWriteRestrictable = "write_restrictable"
	ConfigAccessTagCloudRestrictable = "cloud_restrictable"
)

// Allows read access if any PermissionSysconsoleRead* is allowed
const ConfigAccessTagAnySysConsoleRead = "*_read"

// Config fields support the 'access' tag with the following values corresponding to the suffix of the associated
// PermissionSysconsole* permission Id: 'about', 'reporting', 'user_management_users',
// 'user_management_groups', 'user_management_teams', 'user_management_channels',
// 'user_management_permissions', 'environment_web_server', 'environment_database', 'environment_elasticsearch',
// 'environment_file_storage', 'environment_image_proxy', 'environment_smtp', 'environment_push_notification_server',
// 'environment_high_availability', 'environment_rate_limiting', 'environment_logging', 'environment_session_lengths',
// 'environment_performance_monitoring', 'environment_developer', 'site', 'authentication', 'plugins',
// 'integrations', 'compliance', 'plugins', and 'experimental'. They grant read and/or write access to the config field
// to roles without PermissionManageSystem.
//
// The 'access' tag '*_read' checks for any Sysconsole read permission and grants access if any read permission is allowed.
//
// By default config values can be written with PermissionManageSystem, but if ExperimentalSettings.RestrictSystemAdmin is true
// and the access tag contains the value 'write_restrictable', then even PermissionManageSystem, does not grant write access
// unless the request is made using local mode.
//
// PermissionManageSystem always grants read access.
//
// Config values with the access tag 'cloud_restrictable' mean that are marked to be filtered when it's used in a cloud licensed
// environment with ExperimentalSettings.RestrictedSystemAdmin set to true.
//
// Example:
//
//	type HairSettings struct {
//	    // Colour is writeable with either PermissionSysconsoleWriteReporting or PermissionSysconsoleWriteUserManagementGroups.
//	    // It is readable by PermissionSysconsoleReadReporting and PermissionSysconsoleReadUserManagementGroups permissions.
//	    // PermissionManageSystem grants read and write access.
//	    Colour string `access:"reporting,user_management_groups"`
//
//	    // Length is only readable and writable via PermissionManageSystem.
//	    Length string
//
//	    // Product is only writeable by PermissionManageSystem if ExperimentalSettings.RestrictSystemAdmin is false.
//	    // PermissionManageSystem can always read the value.
//	    Product bool `access:write_restrictable`
//	}
type Config struct {
	ServiceSettings             ServiceSettings
	TeamSettings                TeamSettings
	ClientRequirements          ClientRequirements
	SqlSettings                 SqlSettings
	LogSettings                 LogSettings
	ExperimentalAuditSettings   ExperimentalAuditSettings
	NotificationLogSettings     NotificationLogSettings
	PasswordSettings            PasswordSettings
	FileSettings                FileSettings
	EmailSettings               EmailSettings
	RateLimitSettings           RateLimitSettings
	PrivacySettings             PrivacySettings
	SupportSettings             SupportSettings
	AnnouncementSettings        AnnouncementSettings
	ThemeSettings               ThemeSettings
	GitLabSettings              SSOSettings
	GoogleSettings              SSOSettings
	Office365Settings           Office365Settings
	OpenIdSettings              SSOSettings
	LdapSettings                LdapSettings
	ComplianceSettings          ComplianceSettings
	LocalizationSettings        LocalizationSettings
	SamlSettings                SamlSettings
	NativeAppSettings           NativeAppSettings
	CacheSettings               CacheSettings
	ClusterSettings             ClusterSettings
	MetricsSettings             MetricsSettings
	ExperimentalSettings        ExperimentalSettings
	AnalyticsSettings           AnalyticsSettings
	ElasticsearchSettings       ElasticsearchSettings
	BleveSettings               BleveSettings
	DataRetentionSettings       DataRetentionSettings
	MessageExportSettings       MessageExportSettings
	JobSettings                 JobSettings
	PluginSettings              PluginSettings
	DisplaySettings             DisplaySettings
	GuestAccountsSettings       GuestAccountsSettings
	ImageProxySettings          ImageProxySettings
	CloudSettings               CloudSettings  // telemetry: none
	FeatureFlags                *FeatureFlags  `access:"*_read" json:",omitempty"`
	ImportSettings              ImportSettings // telemetry: none
	ExportSettings              ExportSettings
	WranglerSettings            WranglerSettings
	ConnectedWorkspacesSettings ConnectedWorkspacesSettings
	AccessControlSettings       AccessControlSettings
}

func (o *Config) Auditable() map[string]any {
	return map[string]any{
		// TODO
	}
}

func (o *Config) Clone() *Config {
	buf, err := json.Marshal(o)
	if err != nil {
		panic(err)
	}
	var ret Config
	err = json.Unmarshal(buf, &ret)
	if err != nil {
		panic(err)
	}
	return &ret
}

func (o *Config) ToJSONFiltered(tagType, tagValue string) ([]byte, error) {
	filteredConfigMap := configToMapFilteredByTag(*o, tagType, tagValue)
	for key, value := range filteredConfigMap {
		v, ok := value.(map[string]any)
		if ok && len(v) == 0 {
			delete(filteredConfigMap, key)
		}
	}
	return json.Marshal(filteredConfigMap)
}

func (o *Config) GetSSOService(service string) *SSOSettings {
	switch service {
	case ServiceGitlab:
		return &o.GitLabSettings
	case ServiceGoogle:
		return &o.GoogleSettings
	case ServiceOffice365:
		return o.Office365Settings.SSOSettings()
	case ServiceOpenid:
		return &o.OpenIdSettings
	}

	return nil
}

func ConfigFromJSON(data io.Reader) *Config {
	var o *Config
	json.NewDecoder(data).Decode(&o)
	return o
}

// isUpdate detects a pre-existing config based on whether SiteURL has been changed
func (o *Config) isUpdate() bool {
	return o.ServiceSettings.SiteURL != nil
}

func (o *Config) SetDefaults() {
	isUpdate := o.isUpdate()

	o.LdapSettings.SetDefaults()
	o.SamlSettings.SetDefaults()

	if o.TeamSettings.TeammateNameDisplay == nil {
		o.TeamSettings.TeammateNameDisplay = NewPointer(ShowUsername)

		if *o.SamlSettings.Enable || *o.LdapSettings.Enable {
			*o.TeamSettings.TeammateNameDisplay = ShowFullName
		}
	}

	o.SqlSettings.SetDefaults(isUpdate)
	o.FileSettings.SetDefaults(isUpdate)
	o.EmailSettings.SetDefaults(isUpdate)
	o.PrivacySettings.setDefaults()
	o.Office365Settings.setDefaults()
	o.Office365Settings.setDefaults()
	o.GitLabSettings.setDefaults("", "", "", "", "")
	o.GoogleSettings.setDefaults(GoogleSettingsDefaultScope, GoogleSettingsDefaultAuthEndpoint, GoogleSettingsDefaultTokenEndpoint, GoogleSettingsDefaultUserAPIEndpoint, "")
	o.OpenIdSettings.setDefaults(OpenidSettingsDefaultScope, "", "", "", "#145DBF")
	o.ServiceSettings.SetDefaults(isUpdate)
	o.PasswordSettings.SetDefaults()
	o.TeamSettings.SetDefaults()
	o.MetricsSettings.SetDefaults()
	o.ExperimentalSettings.SetDefaults()
	o.SupportSettings.SetDefaults()
	o.AnnouncementSettings.SetDefaults()
	o.ThemeSettings.SetDefaults()
	o.CacheSettings.SetDefaults()
	o.ClusterSettings.SetDefaults()
	o.PluginSettings.SetDefaults(o.LogSettings)
	o.AnalyticsSettings.SetDefaults()
	o.ComplianceSettings.SetDefaults()
	o.LocalizationSettings.SetDefaults()
	o.ElasticsearchSettings.SetDefaults()
	o.BleveSettings.SetDefaults()
	o.NativeAppSettings.SetDefaults()
	o.DataRetentionSettings.SetDefaults()
	o.RateLimitSettings.SetDefaults()
	o.LogSettings.SetDefaults()
	o.ExperimentalAuditSettings.SetDefaults()
	o.NotificationLogSettings.SetDefaults()
	o.JobSettings.SetDefaults()
	o.MessageExportSettings.SetDefaults()
	o.DisplaySettings.SetDefaults()
	o.GuestAccountsSettings.SetDefaults()
	o.ImageProxySettings.SetDefaults()
	o.CloudSettings.SetDefaults()
	if o.FeatureFlags == nil {
		o.FeatureFlags = &FeatureFlags{}
		o.FeatureFlags.SetDefaults()
	}
	o.ImportSettings.SetDefaults()
	o.ExportSettings.SetDefaults()
	o.WranglerSettings.SetDefaults()
	o.ConnectedWorkspacesSettings.SetDefaults(isUpdate, o.ExperimentalSettings)
	o.AccessControlSettings.SetDefaults()
}

func (o *Config) IsValid() *AppError {
	if *o.ServiceSettings.SiteURL == "" && *o.EmailSettings.EnableEmailBatching {
		return NewAppError("Config.IsValid", "model.config.is_valid.site_url_email_batching.app_error", nil, "", http.StatusBadRequest)
	}

	if *o.ClusterSettings.Enable && *o.EmailSettings.EnableEmailBatching {
		return NewAppError("Config.IsValid", "model.config.is_valid.cluster_email_batching.app_error", nil, "", http.StatusBadRequest)
	}

	if appErr := o.MetricsSettings.isValid(); appErr != nil {
		return appErr
	}

	if appErr := o.CacheSettings.isValid(); appErr != nil {
		return appErr
	}

	if *o.ServiceSettings.SiteURL == "" && *o.ServiceSettings.AllowCookiesForSubdomains {
		return NewAppError("Config.IsValid", "model.config.is_valid.allow_cookies_for_subdomains.app_error", nil, "", http.StatusBadRequest)
	}

	if appErr := o.TeamSettings.isValid(); appErr != nil {
		return appErr
	}

	if appErr := o.ExperimentalSettings.isValid(); appErr != nil {
		return appErr
	}

	if appErr := o.SqlSettings.isValid(); appErr != nil {
		return appErr
	}

	if appErr := o.FileSettings.isValid(); appErr != nil {
		return appErr
	}

	if appErr := o.EmailSettings.isValid(); appErr != nil {
		return appErr
	}

	if appErr := o.LdapSettings.isValid(); appErr != nil {
		return appErr
	}

	if appErr := o.SamlSettings.isValid(); appErr != nil {
		return appErr
	}

	if *o.PasswordSettings.MinimumLength < PasswordMinimumLength || *o.PasswordSettings.MinimumLength > PasswordMaximumLength {
		return NewAppError("Config.IsValid", "model.config.is_valid.password_length.app_error", map[string]any{"MinLength": PasswordMinimumLength, "MaxLength": PasswordMaximumLength}, "", http.StatusBadRequest)
	}

	if appErr := o.RateLimitSettings.isValid(); appErr != nil {
		return appErr
	}

	if appErr := o.ServiceSettings.isValid(); appErr != nil {
		return appErr
	}

	if appErr := o.ElasticsearchSettings.isValid(); appErr != nil {
		return appErr
	}

	if appErr := o.BleveSettings.isValid(); appErr != nil {
		return appErr
	}

	if appErr := o.DataRetentionSettings.isValid(); appErr != nil {
		return appErr
	}

	if appErr := o.LogSettings.isValid(); appErr != nil {
		return appErr
	}

	if appErr := o.LocalizationSettings.isValid(); appErr != nil {
		return appErr
	}

	if appErr := o.MessageExportSettings.isValid(); appErr != nil {
		return appErr
	}

	if appErr := o.DisplaySettings.isValid(); appErr != nil {
		return appErr
	}

	if appErr := o.ImageProxySettings.isValid(); appErr != nil {
		return appErr
	}

	if appErr := o.ImportSettings.isValid(); appErr != nil {
		return appErr
	}

	if appErr := o.WranglerSettings.IsValid(); appErr != nil {
		return appErr
	}

	if o.SupportSettings.ReportAProblemType != nil {
		if *o.SupportSettings.ReportAProblemType == SupportSettingsReportAProblemTypeMail {
			if o.SupportSettings.ReportAProblemMail == nil {
				return NewAppError("Config.IsValid", "model.config.is_valid.report_a_problem_mail.missing.app_error", nil, "", http.StatusBadRequest)
			}
			if !IsValidEmail(*o.SupportSettings.ReportAProblemMail) {
				return NewAppError("Config.IsValid", "model.config.is_valid.report_a_problem_mail.invalid.app_error", nil, "", http.StatusBadRequest)
			}
		}
		if *o.SupportSettings.ReportAProblemType == SupportSettingsReportAProblemTypeLink {
			if o.SupportSettings.ReportAProblemLink == nil {
				return NewAppError("Config.IsValid", "model.config.is_valid.report_a_problem_link.missing.app_error", nil, "", http.StatusBadRequest)
			}

			if !IsValidHTTPURL(*o.SupportSettings.ReportAProblemLink) {
				return NewAppError("Config.IsValid", "model.config.is_valid.report_a_problem_link.invalid.app_error", nil, "", http.StatusBadRequest)
			}
		}
	}

	return nil
}

func (s *TeamSettings) isValid() *AppError {
	if *s.MaxUsersPerTeam <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.max_users.app_error", nil, "", http.StatusBadRequest)
	}

	if *s.MaxChannelsPerTeam <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.max_channels.app_error", nil, "", http.StatusBadRequest)
	}

	if *s.UserStatusAwayTimeout <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.user_status_away_timeout.app_error", nil, "", http.StatusBadRequest)
	}

	if *s.MaxNotificationsPerChannel <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.max_notify_per_channel.app_error", nil, "", http.StatusBadRequest)
	}

	if !(*s.RestrictDirectMessage == DirectMessageAny || *s.RestrictDirectMessage == DirectMessageTeam) {
		return NewAppError("Config.IsValid", "model.config.is_valid.restrict_direct_message.app_error", nil, "", http.StatusBadRequest)
	}

	if !(*s.TeammateNameDisplay == ShowFullName || *s.TeammateNameDisplay == ShowNicknameFullName || *s.TeammateNameDisplay == ShowUsername) {
		return NewAppError("Config.IsValid", "model.config.is_valid.teammate_name_display.app_error", nil, "", http.StatusBadRequest)
	}

	if len(*s.SiteName) > SitenameMaxLength {
		return NewAppError("Config.IsValid", "model.config.is_valid.sitename_length.app_error", map[string]any{"MaxLength": SitenameMaxLength}, "", http.StatusBadRequest)
	}

	return nil
}

func (s *ExperimentalSettings) isValid() *AppError {
	if *s.LinkMetadataTimeoutMilliseconds <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.link_metadata_timeout.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

func (s *SqlSettings) isValid() *AppError {
	if *s.AtRestEncryptKey != "" && len(*s.AtRestEncryptKey) < 32 {
		return NewAppError("Config.IsValid", "model.config.is_valid.encrypt_sql.app_error", nil, "", http.StatusBadRequest)
	}

	if !(*s.DriverName == DatabaseDriverMysql || *s.DriverName == DatabaseDriverPostgres) {
		return NewAppError("Config.IsValid", "model.config.is_valid.sql_driver.app_error", nil, "", http.StatusBadRequest)
	}

	if *s.MaxIdleConns <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.sql_idle.app_error", nil, "", http.StatusBadRequest)
	}

	if *s.ConnMaxLifetimeMilliseconds < 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.sql_conn_max_lifetime_milliseconds.app_error", nil, "", http.StatusBadRequest)
	}

	if *s.ConnMaxIdleTimeMilliseconds < 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.sql_conn_max_idle_time_milliseconds.app_error", nil, "", http.StatusBadRequest)
	}

	if *s.QueryTimeout <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.sql_query_timeout.app_error", nil, "", http.StatusBadRequest)
	}

	if *s.DataSource == "" {
		return NewAppError("Config.IsValid", "model.config.is_valid.sql_data_src.app_error", nil, "", http.StatusBadRequest)
	}

	if *s.MaxOpenConns <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.sql_max_conn.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

func (s *FileSettings) isValid() *AppError {
	if *s.MaxFileSize <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.max_file_size.app_error", nil, "", http.StatusBadRequest)
	}

	if !(*s.DriverName == ImageDriverLocal || *s.DriverName == ImageDriverS3) {
		return NewAppError("Config.IsValid", "model.config.is_valid.file_driver.app_error", nil, "", http.StatusBadRequest)
	}

	if *s.PublicLinkSalt != "" && len(*s.PublicLinkSalt) < 32 {
		return NewAppError("Config.IsValid", "model.config.is_valid.file_salt.app_error", nil, "", http.StatusBadRequest)
	}

	if *s.Directory == "" {
		return NewAppError("Config.IsValid", "model.config.is_valid.directory.app_error", nil, "", http.StatusBadRequest)
	}

	if *s.MaxImageDecoderConcurrency < -1 || *s.MaxImageDecoderConcurrency == 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.image_decoder_concurrency.app_error", map[string]any{"Value": *s.MaxImageDecoderConcurrency}, "", http.StatusBadRequest)
	}

	if *s.AmazonS3RequestTimeoutMilliseconds <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.amazons3_timeout.app_error", map[string]any{"Value": *s.MaxImageDecoderConcurrency}, "", http.StatusBadRequest)
	}

	if *s.AmazonS3StorageClass != "" && !slices.Contains([]string{StorageClassStandard, StorageClassReducedRedundancy, StorageClassStandardIA, StorageClassOnezoneIA, StorageClassIntelligentTiering, StorageClassGlacier, StorageClassDeepArchive, StorageClassOutposts, StorageClassGlacierIR, StorageClassSnow, StorageClassExpressOnezone}, *s.AmazonS3StorageClass) {
		return NewAppError("Config.IsValid", "model.config.is_valid.storage_class.app_error", map[string]any{"Value": *s.AmazonS3StorageClass}, "", http.StatusBadRequest)
	}

	if *s.ExportAmazonS3StorageClass != "" && !slices.Contains([]string{StorageClassStandard, StorageClassReducedRedundancy, StorageClassStandardIA, StorageClassOnezoneIA, StorageClassIntelligentTiering, StorageClassGlacier, StorageClassDeepArchive, StorageClassOutposts, StorageClassGlacierIR, StorageClassSnow, StorageClassExpressOnezone}, *s.ExportAmazonS3StorageClass) {
		return NewAppError("Config.IsValid", "model.config.is_valid.storage_class.app_error", map[string]any{"Value": *s.ExportAmazonS3StorageClass}, "", http.StatusBadRequest)
	}

	return nil
}

func (s *EmailSettings) isValid() *AppError {
	if !(*s.ConnectionSecurity == ConnSecurityNone || *s.ConnectionSecurity == ConnSecurityTLS || *s.ConnectionSecurity == ConnSecurityStarttls || *s.ConnectionSecurity == ConnSecurityPlain) {
		return NewAppError("Config.IsValid", "model.config.is_valid.email_security.app_error", nil, "", http.StatusBadRequest)
	}

	if *s.EmailBatchingBufferSize <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.email_batching_buffer_size.app_error", nil, "", http.StatusBadRequest)
	}

	if *s.EmailBatchingInterval < 30 {
		return NewAppError("Config.IsValid", "model.config.is_valid.email_batching_interval.app_error", nil, "", http.StatusBadRequest)
	}

	if !(*s.EmailNotificationContentsType == EmailNotificationContentsFull || *s.EmailNotificationContentsType == EmailNotificationContentsGeneric) {
		return NewAppError("Config.IsValid", "model.config.is_valid.email_notification_contents_type.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

func (s *RateLimitSettings) isValid() *AppError {
	if *s.MemoryStoreSize <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.rate_mem.app_error", nil, "", http.StatusBadRequest)
	}

	if *s.PerSec <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.rate_sec.app_error", nil, "", http.StatusBadRequest)
	}

	if *s.MaxBurst <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.max_burst.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

func (s *LdapSettings) isValid() *AppError {
	if !(*s.ConnectionSecurity == ConnSecurityNone || *s.ConnectionSecurity == ConnSecurityTLS || *s.ConnectionSecurity == ConnSecurityStarttls) {
		return NewAppError("Config.IsValid", "model.config.is_valid.ldap_security.app_error", nil, "", http.StatusBadRequest)
	}

	if *s.SyncIntervalMinutes <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.ldap_sync_interval.app_error", nil, "", http.StatusBadRequest)
	}

	if *s.MaxPageSize < 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.ldap_max_page_size.app_error", nil, "", http.StatusBadRequest)
	}

	if *s.Enable {
		if *s.LdapServer == "" {
			return NewAppError("Config.IsValid", "model.config.is_valid.ldap_server", nil, "", http.StatusBadRequest)
		}

		if *s.MaximumLoginAttempts <= 0 {
			return NewAppError("Config.IsValid", "model.config.is_valid.ldap_max_login_attempts.app_error", nil, "", http.StatusBadRequest)
		}

		if *s.BaseDN == "" {
			return NewAppError("Config.IsValid", "model.config.is_valid.ldap_basedn", nil, "", http.StatusBadRequest)
		}

		if *s.EmailAttribute == "" {
			return NewAppError("Config.IsValid", "model.config.is_valid.ldap_email", nil, "", http.StatusBadRequest)
		}

		if *s.UsernameAttribute == "" {
			return NewAppError("Config.IsValid", "model.config.is_valid.ldap_username", nil, "", http.StatusBadRequest)
		}

		if *s.IdAttribute == "" {
			return NewAppError("Config.IsValid", "model.config.is_valid.ldap_id", nil, "", http.StatusBadRequest)
		}

		if *s.LoginIdAttribute == "" {
			return NewAppError("Config.IsValid", "model.config.is_valid.ldap_login_id", nil, "", http.StatusBadRequest)
		}

		if *s.UserFilter != "" {
			if _, err := ldap.CompileFilter(*s.UserFilter); err != nil {
				return NewAppError("ValidateFilter", "ent.ldap.validate_filter.app_error", nil, "", http.StatusBadRequest).Wrap(err)
			}
		}

		if *s.GuestFilter != "" {
			if _, err := ldap.CompileFilter(*s.GuestFilter); err != nil {
				return NewAppError("LdapSettings.isValid", "ent.ldap.validate_guest_filter.app_error", nil, "", http.StatusBadRequest).Wrap(err)
			}
		}

		if *s.AdminFilter != "" {
			if _, err := ldap.CompileFilter(*s.AdminFilter); err != nil {
				return NewAppError("LdapSettings.isValid", "ent.ldap.validate_admin_filter.app_error", nil, "", http.StatusBadRequest).Wrap(err)
			}
		}
	}

	return nil
}

func (s *SamlSettings) isValid() *AppError {
	if *s.Enable {
		if *s.IdpURL == "" || !IsValidHTTPURL(*s.IdpURL) {
			return NewAppError("Config.IsValid", "model.config.is_valid.saml_idp_url.app_error", nil, "", http.StatusBadRequest)
		}

		if *s.IdpDescriptorURL == "" {
			return NewAppError("Config.IsValid", "model.config.is_valid.saml_idp_descriptor_url.app_error", nil, "", http.StatusBadRequest)
		}

		if *s.IdpCertificateFile == "" {
			return NewAppError("Config.IsValid", "model.config.is_valid.saml_idp_cert.app_error", nil, "", http.StatusBadRequest)
		}

		if *s.EmailAttribute == "" {
			return NewAppError("Config.IsValid", "model.config.is_valid.saml_email_attribute.app_error", nil, "", http.StatusBadRequest)
		}

		if *s.UsernameAttribute == "" {
			return NewAppError("Config.IsValid", "model.config.is_valid.saml_username_attribute.app_error", nil, "", http.StatusBadRequest)
		}

		if *s.ServiceProviderIdentifier == "" {
			return NewAppError("Config.IsValid", "model.config.is_valid.saml_spidentifier_attribute.app_error", nil, "", http.StatusBadRequest)
		}

		if *s.Verify {
			if *s.AssertionConsumerServiceURL == "" || !IsValidHTTPURL(*s.AssertionConsumerServiceURL) {
				return NewAppError("Config.IsValid", "model.config.is_valid.saml_assertion_consumer_service_url.app_error", nil, "", http.StatusBadRequest)
			}
		}

		if *s.Encrypt {
			if *s.PrivateKeyFile == "" {
				return NewAppError("Config.IsValid", "model.config.is_valid.saml_private_key.app_error", nil, "", http.StatusBadRequest)
			}

			if *s.PublicCertificateFile == "" {
				return NewAppError("Config.IsValid", "model.config.is_valid.saml_public_cert.app_error", nil, "", http.StatusBadRequest)
			}
		}

		if *s.EmailAttribute == "" {
			return NewAppError("Config.IsValid", "model.config.is_valid.saml_email_attribute.app_error", nil, "", http.StatusBadRequest)
		}

		if !(*s.SignatureAlgorithm == SamlSettingsSignatureAlgorithmSha1 || *s.SignatureAlgorithm == SamlSettingsSignatureAlgorithmSha256 || *s.SignatureAlgorithm == SamlSettingsSignatureAlgorithmSha512) {
			return NewAppError("Config.IsValid", "model.config.is_valid.saml_signature_algorithm.app_error", nil, "", http.StatusBadRequest)
		}
		if !(*s.CanonicalAlgorithm == SamlSettingsCanonicalAlgorithmC14n || *s.CanonicalAlgorithm == SamlSettingsCanonicalAlgorithmC14n11) {
			return NewAppError("Config.IsValid", "model.config.is_valid.saml_canonical_algorithm.app_error", nil, "", http.StatusBadRequest)
		}

		if *s.GuestAttribute != "" {
			if !(strings.Contains(*s.GuestAttribute, "=")) {
				return NewAppError("Config.IsValid", "model.config.is_valid.saml_guest_attribute.app_error", nil, "", http.StatusBadRequest)
			}
			if len(strings.Split(*s.GuestAttribute, "=")) != 2 {
				return NewAppError("Config.IsValid", "model.config.is_valid.saml_guest_attribute.app_error", nil, "", http.StatusBadRequest)
			}
		}

		if *s.AdminAttribute != "" {
			if !(strings.Contains(*s.AdminAttribute, "=")) {
				return NewAppError("Config.IsValid", "model.config.is_valid.saml_admin_attribute.app_error", nil, "", http.StatusBadRequest)
			}
			if len(strings.Split(*s.AdminAttribute, "=")) != 2 {
				return NewAppError("Config.IsValid", "model.config.is_valid.saml_admin_attribute.app_error", nil, "", http.StatusBadRequest)
			}
		}
	}

	return nil
}

func (s *ServiceSettings) isValid() *AppError {
	if !(*s.ConnectionSecurity == ConnSecurityNone || *s.ConnectionSecurity == ConnSecurityTLS) {
		return NewAppError("Config.IsValid", "model.config.is_valid.webserver_security.app_error", nil, "", http.StatusBadRequest)
	}

	if *s.ConnectionSecurity == ConnSecurityTLS && !*s.UseLetsEncrypt {
		appErr := NewAppError("Config.IsValid", "model.config.is_valid.tls_cert_file_missing.app_error", nil, "", http.StatusBadRequest)

		if *s.TLSCertFile == "" {
			return appErr
		} else if _, err := os.Stat(*s.TLSCertFile); os.IsNotExist(err) {
			return appErr
		}

		appErr = NewAppError("Config.IsValid", "model.config.is_valid.tls_key_file_missing.app_error", nil, "", http.StatusBadRequest)

		if *s.TLSKeyFile == "" {
			return appErr
		} else if _, err := os.Stat(*s.TLSKeyFile); os.IsNotExist(err) {
			return appErr
		}
	}

	if len(s.TLSOverwriteCiphers) > 0 {
		for _, cipher := range s.TLSOverwriteCiphers {
			if _, ok := ServerTLSSupportedCiphers[cipher]; !ok {
				return NewAppError("Config.IsValid", "model.config.is_valid.tls_overwrite_cipher.app_error", map[string]any{"name": cipher}, "", http.StatusBadRequest)
			}
		}
	}

	if *s.MaximumPayloadSizeBytes <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.max_payload_size.app_error", nil, "", http.StatusBadRequest)
	}

	if *s.MaximumURLLength <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.max_url_length.app_error", nil, "", http.StatusBadRequest)
	}

	if *s.ReadTimeout <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.read_timeout.app_error", nil, "", http.StatusBadRequest)
	}

	if *s.WriteTimeout <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.write_timeout.app_error", nil, "", http.StatusBadRequest)
	}

	if *s.TimeBetweenUserTypingUpdatesMilliseconds < 1000 {
		return NewAppError("Config.IsValid", "model.config.is_valid.time_between_user_typing.app_error", nil, "", http.StatusBadRequest)
	}

	if *s.MaximumLoginAttempts <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.login_attempts.app_error", nil, "", http.StatusBadRequest)
	}

	if *s.SiteURL != "" {
		if _, err := url.ParseRequestURI(*s.SiteURL); err != nil {
			return NewAppError("Config.IsValid", "model.config.is_valid.site_url.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		}
	}

	if *s.WebsocketURL != "" {
		if _, err := url.ParseRequestURI(*s.WebsocketURL); err != nil {
			return NewAppError("Config.IsValid", "model.config.is_valid.websocket_url.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		}
	}

	host, port, _ := net.SplitHostPort(*s.ListenAddress)
	var isValidHost bool
	if host == "" {
		isValidHost = true
	} else {
		isValidHost = (net.ParseIP(host) != nil) || isDomainName(host)
	}
	portInt, err := strconv.Atoi(port)
	if err != nil || !isValidHost || portInt < 0 || portInt > math.MaxUint16 {
		return NewAppError("Config.IsValid", "model.config.is_valid.listen_address.app_error", nil, "", http.StatusBadRequest)
	}

	if *s.OutgoingIntegrationRequestsTimeout <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.outgoing_integrations_request_timeout.app_error", nil, "", http.StatusBadRequest)
	}

	if *s.ExperimentalGroupUnreadChannels != GroupUnreadChannelsDisabled &&
		*s.ExperimentalGroupUnreadChannels != GroupUnreadChannelsDefaultOn &&
		*s.ExperimentalGroupUnreadChannels != GroupUnreadChannelsDefaultOff {
		return NewAppError("Config.IsValid", "model.config.is_valid.group_unread_channels.app_error", nil, "", http.StatusBadRequest)
	}

	if *s.CollapsedThreads != CollapsedThreadsDisabled && !*s.ThreadAutoFollow {
		return NewAppError("Config.IsValid", "model.config.is_valid.collapsed_threads.autofollow.app_error", nil, "", http.StatusBadRequest)
	}

	if *s.CollapsedThreads != CollapsedThreadsDisabled &&
		*s.CollapsedThreads != CollapsedThreadsDefaultOn &&
		*s.CollapsedThreads != CollapsedThreadsAlwaysOn &&
		*s.CollapsedThreads != CollapsedThreadsDefaultOff {
		return NewAppError("Config.IsValid", "model.config.is_valid.collapsed_threads.app_error", nil, "", http.StatusBadRequest)
	}

	if *s.PersistentNotificationIntervalMinutes < 2 {
		return NewAppError("Config.IsValid", "model.config.is_valid.persistent_notifications_interval.app_error", nil, "", http.StatusBadRequest)
	}
	if *s.PersistentNotificationMaxCount <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.persistent_notifications_count.app_error", nil, "", http.StatusBadRequest)
	}
	if *s.PersistentNotificationMaxRecipients <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.persistent_notifications_recipients.app_error", nil, "", http.StatusBadRequest)
	}

	// we check if file has a valid parent, the server will try to create the socket
	// file if it doesn't exist, but we need to be sure if the directory exist or not
	if *s.EnableLocalMode {
		parent := filepath.Dir(*s.LocalModeSocketLocation)
		_, err := os.Stat(parent)
		if err != nil {
			return NewAppError("Config.IsValid", "model.config.is_valid.local_mode_socket.app_error", nil, err.Error(), http.StatusBadRequest).Wrap(err)
		}
	}

	return nil
}

func (s *ElasticsearchSettings) isValid() *AppError {
	if *s.EnableIndexing {
		if *s.ConnectionURL == "" {
			return NewAppError("Config.IsValid", "model.config.is_valid.elastic_search.connection_url.app_error", nil, "", http.StatusBadRequest)
		}
	}

	if *s.EnableSearching && !*s.EnableIndexing {
		return NewAppError("Config.IsValid", "model.config.is_valid.elastic_search.enable_searching.app_error", map[string]any{
			"Searching":      "ElasticsearchSettings.EnableSearching",
			"EnableIndexing": "ElasticsearchSettings.EnableIndexing",
		}, "", http.StatusBadRequest)
	}

	if *s.EnableAutocomplete && !*s.EnableIndexing {
		return NewAppError("Config.IsValid", "model.config.is_valid.elastic_search.enable_autocomplete.app_error", map[string]any{
			"Autocomplete":   "ElasticsearchSettings.EnableAutocomplete",
			"EnableIndexing": "ElasticsearchSettings.EnableIndexing",
		}, "", http.StatusBadRequest)
	}

	if *s.AggregatePostsAfterDays < 1 {
		return NewAppError("Config.IsValid", "model.config.is_valid.elastic_search.aggregate_posts_after_days.app_error", nil, "", http.StatusBadRequest)
	}

	if _, err := time.Parse("15:04", *s.PostsAggregatorJobStartTime); err != nil {
		return NewAppError("Config.IsValid", "model.config.is_valid.elastic_search.posts_aggregator_job_start_time.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	if *s.LiveIndexingBatchSize < 1 {
		return NewAppError("Config.IsValid", "model.config.is_valid.elastic_search.live_indexing_batch_size.app_error", nil, "", http.StatusBadRequest)
	}

	minBatchSize := 1
	if *s.BatchSize < minBatchSize {
		return NewAppError("Config.IsValid", "model.config.is_valid.elastic_search.bulk_indexing_batch_size.app_error", map[string]any{"BatchSize": minBatchSize}, "", http.StatusBadRequest)
	}

	if *s.RequestTimeoutSeconds < 1 {
		return NewAppError("Config.IsValid", "model.config.is_valid.elastic_search.request_timeout_seconds.app_error", nil, "", http.StatusBadRequest)
	}

	if ign := *s.IgnoredPurgeIndexes; ign != "" {
		s := strings.Split(ign, ",")
		for _, ix := range s {
			if strings.HasPrefix(ix, "-") {
				return NewAppError("Config.IsValid", "model.config.is_valid.elastic_search.ignored_indexes_dash_prefix.app_error", nil, "", http.StatusBadRequest)
			}
		}
	}

	if *s.Backend != ElasticsearchSettingsOSBackend && *s.Backend != ElasticsearchSettingsESBackend {
		return NewAppError("Config.IsValid", "model.config.is_valid.elastic_search.invalid_backend.app_error", nil, "", http.StatusBadRequest)
	}

	if *s.GlobalSearchPrefix != "" && *s.IndexPrefix == "" {
		return NewAppError("Config.IsValid", "model.config.is_valid.elastic_search.empty_index_prefix.app_error", nil, "", http.StatusBadRequest)
	}

	if *s.GlobalSearchPrefix != "" && *s.IndexPrefix != "" {
		if !strings.HasPrefix(*s.IndexPrefix, *s.GlobalSearchPrefix) {
			return NewAppError("Config.IsValid", "model.config.is_valid.elastic_search.incorrect_search_prefix.app_error", map[string]any{"IndexPrefix": *s.IndexPrefix, "GlobalSearchPrefix": *s.GlobalSearchPrefix}, "", http.StatusBadRequest)
		}
	}

	return nil
}

func (bs *BleveSettings) isValid() *AppError {
	if *bs.EnableIndexing {
		if *bs.IndexDir == "" {
			return NewAppError("Config.IsValid", "model.config.is_valid.bleve_search.filename.app_error", nil, "", http.StatusBadRequest)
		}
	} else {
		if *bs.EnableSearching {
			return NewAppError("Config.IsValid", "model.config.is_valid.bleve_search.enable_searching.app_error", nil, "", http.StatusBadRequest)
		}
		if *bs.EnableAutocomplete {
			return NewAppError("Config.IsValid", "model.config.is_valid.bleve_search.enable_autocomplete.app_error", nil, "", http.StatusBadRequest)
		}
	}
	minBatchSize := 1
	if *bs.BatchSize < minBatchSize {
		return NewAppError("Config.IsValid", "model.config.is_valid.bleve_search.bulk_indexing_batch_size.app_error", map[string]any{"BatchSize": minBatchSize}, "", http.StatusBadRequest)
	}

	return nil
}

func (s *DataRetentionSettings) isValid() *AppError {
	if s.MessageRetentionDays == nil || *s.MessageRetentionDays < 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.data_retention.message_retention_days_too_low.app_error", nil, "", http.StatusBadRequest)
	}

	if s.MessageRetentionHours == nil || *s.MessageRetentionHours < 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.data_retention.message_retention_hours_too_low.app_error", nil, "", http.StatusBadRequest)
	}

	if s.FileRetentionDays == nil || *s.FileRetentionDays < 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.data_retention.file_retention_days_too_low.app_error", nil, "", http.StatusBadRequest)
	}

	if s.FileRetentionHours == nil || *s.FileRetentionHours < 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.data_retention.file_retention_hours_too_low.app_error", nil, "", http.StatusBadRequest)
	}

	if *s.MessageRetentionDays > 0 && *s.MessageRetentionHours > 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.data_retention.message_retention_misconfiguration.app_error", nil, "", http.StatusBadRequest)
	}

	if *s.FileRetentionDays > 0 && *s.FileRetentionHours > 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.data_retention.file_retention_misconfiguration.app_error", nil, "", http.StatusBadRequest)
	}

	if *s.MessageRetentionDays == 0 && *s.MessageRetentionHours == 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.data_retention.message_retention_both_zero.app_error", nil, "", http.StatusBadRequest)
	}

	if *s.FileRetentionDays == 0 && *s.FileRetentionHours == 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.data_retention.file_retention_both_zero.app_error", nil, "", http.StatusBadRequest)
	}

	if _, err := time.Parse("15:04", *s.DeletionJobStartTime); err != nil {
		return NewAppError("Config.IsValid", "model.config.is_valid.data_retention.deletion_job_start_time.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	return nil
}

func (s *LocalizationSettings) isValid() *AppError {
	if *s.AvailableLocales != "" {
		if !strings.Contains(*s.AvailableLocales, *s.DefaultClientLocale) {
			return NewAppError("Config.IsValid", "model.config.is_valid.localization.available_locales.app_error", nil, "", http.StatusBadRequest)
		}
	}

	return nil
}

func (s *MessageExportSettings) isValid() *AppError {
	if s.EnableExport == nil {
		return NewAppError("Config.IsValid", "model.config.is_valid.message_export.enable.app_error", nil, "", http.StatusBadRequest)
	}
	if *s.EnableExport {
		if s.ExportFromTimestamp == nil || *s.ExportFromTimestamp < 0 || *s.ExportFromTimestamp > GetMillis() {
			return NewAppError("Config.IsValid", "model.config.is_valid.message_export.export_from.app_error", nil, "", http.StatusBadRequest)
		} else if s.DailyRunTime == nil {
			return NewAppError("Config.IsValid", "model.config.is_valid.message_export.daily_runtime.app_error", nil, "", http.StatusBadRequest)
		} else if _, err := time.Parse("15:04", *s.DailyRunTime); err != nil {
			return NewAppError("Config.IsValid", "model.config.is_valid.message_export.daily_runtime.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		} else if s.BatchSize == nil || *s.BatchSize < 0 {
			return NewAppError("Config.IsValid", "model.config.is_valid.message_export.batch_size.app_error", nil, "", http.StatusBadRequest)
		} else if s.ExportFormat == nil || (*s.ExportFormat != ComplianceExportTypeActiance && *s.ExportFormat != ComplianceExportTypeGlobalrelay && *s.ExportFormat != ComplianceExportTypeCsv && *s.ExportFormat != ComplianceExportTypeGlobalrelayZip) {
			return NewAppError("Config.IsValid", "model.config.is_valid.message_export.export_type.app_error", nil, "", http.StatusBadRequest)
		}

		if *s.ExportFormat == ComplianceExportTypeGlobalrelay {
			if s.GlobalRelaySettings == nil {
				return NewAppError("Config.IsValid", "model.config.is_valid.message_export.global_relay.config_missing.app_error", nil, "", http.StatusBadRequest)
			} else if s.GlobalRelaySettings.CustomerType == nil || (*s.GlobalRelaySettings.CustomerType != GlobalrelayCustomerTypeA9 && *s.GlobalRelaySettings.CustomerType != GlobalrelayCustomerTypeA10 && *s.GlobalRelaySettings.CustomerType != GlobalrelayCustomerTypeCustom) {
				return NewAppError("Config.IsValid", "model.config.is_valid.message_export.global_relay.customer_type.app_error", nil, "", http.StatusBadRequest)
			} else if *s.GlobalRelaySettings.CustomerType == GlobalrelayCustomerTypeCustom && ((s.GlobalRelaySettings.CustomSMTPServerName == nil || *s.GlobalRelaySettings.CustomSMTPServerName == "") || (s.GlobalRelaySettings.CustomSMTPPort == nil || *s.GlobalRelaySettings.CustomSMTPPort == "")) {
				return NewAppError("Config.IsValid", "model.config.is_valid.message_export.global_relay.customer_type_custom.app_error", nil, "", http.StatusBadRequest)
			} else if s.GlobalRelaySettings.EmailAddress == nil || !strings.Contains(*s.GlobalRelaySettings.EmailAddress, "@") {
				// validating email addresses is hard - just make sure it contains an '@' sign
				// see https://stackoverflow.com/questions/201323/using-a-regular-expression-to-validate-an-email-address
				return NewAppError("Config.IsValid", "model.config.is_valid.message_export.global_relay.email_address.app_error", nil, "", http.StatusBadRequest)
			} else if s.GlobalRelaySettings.SMTPUsername == nil || *s.GlobalRelaySettings.SMTPUsername == "" {
				return NewAppError("Config.IsValid", "model.config.is_valid.message_export.global_relay.smtp_username.app_error", nil, "", http.StatusBadRequest)
			} else if s.GlobalRelaySettings.SMTPPassword == nil || *s.GlobalRelaySettings.SMTPPassword == "" {
				return NewAppError("Config.IsValid", "model.config.is_valid.message_export.global_relay.smtp_password.app_error", nil, "", http.StatusBadRequest)
			}
		}
	}
	return nil
}

func (s *DisplaySettings) isValid() *AppError {
	if len(s.CustomURLSchemes) != 0 {
		validProtocolPattern := regexp.MustCompile(`(?i)^\s*[A-Za-z][A-Za-z0-9.+-]*\s*$`)

		for _, scheme := range s.CustomURLSchemes {
			if !validProtocolPattern.MatchString(scheme) {
				return NewAppError(
					"Config.IsValid",
					"model.config.is_valid.display.custom_url_schemes.app_error",
					map[string]any{"Scheme": scheme},
					"",
					http.StatusBadRequest,
				)
			}
		}
	}

	return nil
}

func (s *ImageProxySettings) isValid() *AppError {
	if *s.Enable {
		switch *s.ImageProxyType {
		case ImageProxyTypeLocal:
			// No other settings to validate
		case ImageProxyTypeAtmosCamo:
			if *s.RemoteImageProxyURL == "" {
				return NewAppError("Config.IsValid", "model.config.is_valid.atmos_camo_image_proxy_url.app_error", nil, "", http.StatusBadRequest)
			}

			if *s.RemoteImageProxyOptions == "" {
				return NewAppError("Config.IsValid", "model.config.is_valid.atmos_camo_image_proxy_options.app_error", nil, "", http.StatusBadRequest)
			}
		default:
			return NewAppError("Config.IsValid", "model.config.is_valid.image_proxy_type.app_error", nil, "", http.StatusBadRequest)
		}
	}

	return nil
}

func (o *Config) GetSanitizeOptions() map[string]bool {
	options := map[string]bool{}
	options["fullname"] = *o.PrivacySettings.ShowFullName
	options["email"] = *o.PrivacySettings.ShowEmailAddress

	return options
}

func (o *Config) Sanitize(pluginManifests []*Manifest) {
	if o.LdapSettings.BindPassword != nil && *o.LdapSettings.BindPassword != "" {
		*o.LdapSettings.BindPassword = FakeSetting
	}

	if o.FileSettings.PublicLinkSalt != nil {
		*o.FileSettings.PublicLinkSalt = FakeSetting
	}

	if o.FileSettings.AmazonS3SecretAccessKey != nil && *o.FileSettings.AmazonS3SecretAccessKey != "" {
		*o.FileSettings.AmazonS3SecretAccessKey = FakeSetting
	}

	if o.EmailSettings.SMTPPassword != nil && *o.EmailSettings.SMTPPassword != "" {
		*o.EmailSettings.SMTPPassword = FakeSetting
	}

	if o.GitLabSettings.Secret != nil && *o.GitLabSettings.Secret != "" {
		*o.GitLabSettings.Secret = FakeSetting
	}

	if o.GoogleSettings.Secret != nil && *o.GoogleSettings.Secret != "" {
		*o.GoogleSettings.Secret = FakeSetting
	}

	if o.Office365Settings.Secret != nil && *o.Office365Settings.Secret != "" {
		*o.Office365Settings.Secret = FakeSetting
	}

	if o.OpenIdSettings.Secret != nil && *o.OpenIdSettings.Secret != "" {
		*o.OpenIdSettings.Secret = FakeSetting
	}

	if o.SqlSettings.DataSource != nil {
		*o.SqlSettings.DataSource = FakeSetting
	}

	if o.SqlSettings.AtRestEncryptKey != nil {
		*o.SqlSettings.AtRestEncryptKey = FakeSetting
	}

	if o.ElasticsearchSettings.Password != nil {
		*o.ElasticsearchSettings.Password = FakeSetting
	}

	for i := range o.SqlSettings.DataSourceReplicas {
		o.SqlSettings.DataSourceReplicas[i] = FakeSetting
	}

	for i := range o.SqlSettings.DataSourceSearchReplicas {
		o.SqlSettings.DataSourceSearchReplicas[i] = FakeSetting
	}

	for i := range o.SqlSettings.ReplicaLagSettings {
		o.SqlSettings.ReplicaLagSettings[i].DataSource = NewPointer(FakeSetting)
	}

	if o.MessageExportSettings.GlobalRelaySettings != nil &&
		o.MessageExportSettings.GlobalRelaySettings.SMTPPassword != nil &&
		*o.MessageExportSettings.GlobalRelaySettings.SMTPPassword != "" {
		*o.MessageExportSettings.GlobalRelaySettings.SMTPPassword = FakeSetting
	}

	if o.ServiceSettings.SplitKey != nil {
		*o.ServiceSettings.SplitKey = FakeSetting
	}

	if o.CacheSettings.RedisPassword != nil {
		*o.CacheSettings.RedisPassword = FakeSetting
	}

	o.PluginSettings.Sanitize(pluginManifests)
}

type FilterTag struct {
	TagType string
	TagName string
}

type ConfigFilterOptions struct {
	GetConfigOptions
	TagFilters []FilterTag
}

type GetConfigOptions struct {
	RemoveMasked   bool
	RemoveDefaults bool
}

// FilterConfig returns a map[string]any representation of the configuration.
// Also, the function can filter the configuration by the options passed
// in the argument. The options are used to remove the default values, the masked
// values and to filter the configuration by the tags passed in the TagFilters.
func FilterConfig(cfg *Config, opts ConfigFilterOptions) (map[string]any, error) {
	if cfg == nil {
		return nil, nil
	}

	defaultCfg := &Config{}
	defaultCfg.SetDefaults()

	filteredCfg, err := cfg.StringMap()
	if err != nil {
		return nil, err
	}

	filteredDefaultCfg, err := defaultCfg.StringMap()
	if err != nil {
		return nil, err
	}

	for i := range opts.TagFilters {
		filteredCfg = configToMapFilteredByTag(filteredCfg, opts.TagFilters[i].TagType, opts.TagFilters[i].TagName)
		filteredDefaultCfg = configToMapFilteredByTag(filteredDefaultCfg, opts.TagFilters[i].TagType, opts.TagFilters[i].TagName)
	}

	if opts.RemoveDefaults {
		filteredCfg = stringMapDiff(filteredCfg, filteredDefaultCfg)
	}

	if opts.RemoveMasked {
		removeFakeSettings(filteredCfg)
	}

	// only apply this if we applied some filters
	// the alternative is to remove empty maps and slices during the filters
	// but having this in a separate step makes it easier to understand
	if opts.RemoveDefaults || opts.RemoveMasked || len(opts.TagFilters) > 0 {
		removeEmptyMapsAndSlices(filteredCfg)
	}

	return filteredCfg, nil
}

// configToMapFilteredByTag converts a struct into a map removing those fields that has the tag passed
// as argument
// t shall be either a Config struct value or a map[string]any
func configToMapFilteredByTag(t any, typeOfTag, filterTag string) map[string]any {
	switch t.(type) {
	case map[string]any:
		var tc *Config
		b, err := json.Marshal(t)
		if err != nil {
			// since this is an internal function, we can panic here
			// because it should never happen
			panic(err)
		}
		json.Unmarshal(b, &tc)
		t = *tc
	}

	return structToMapFilteredByTag(t, typeOfTag, filterTag)
}

func structToMapFilteredByTag(t any, typeOfTag, filterTag string) map[string]any {
	defer func() {
		if r := recover(); r != nil {
			mlog.Warn("Panicked in structToMapFilteredByTag. This should never happen.", mlog.Any("recover", r))
		}
	}()

	val := reflect.ValueOf(t)
	elemField := reflect.TypeOf(t)

	if val.Kind() != reflect.Struct {
		return nil
	}

	out := map[string]any{}

	for i := 0; i < val.NumField(); i++ {
		field := val.Field(i)

		structField := elemField.Field(i)
		tagPermissions := strings.Split(structField.Tag.Get(typeOfTag), ",")
		if isTagPresent(filterTag, tagPermissions) {
			continue
		}

		var value any

		switch field.Kind() {
		case reflect.Struct:
			value = structToMapFilteredByTag(field.Interface(), typeOfTag, filterTag)
		case reflect.Ptr:
			indirectType := field.Elem()
			if indirectType.Kind() == reflect.Struct {
				value = structToMapFilteredByTag(indirectType.Interface(), typeOfTag, filterTag)
			} else if indirectType.Kind() != reflect.Invalid {
				value = indirectType.Interface()
			}
		default:
			value = field.Interface()
		}

		out[val.Type().Field(i).Name] = value
	}

	return out
}

// removeEmptyMapsAndSlices removes all the empty maps and slices from a map
func removeEmptyMapsAndSlices(m map[string]any) {
	for k, v := range m {
		if v == nil {
			delete(m, k)
			continue
		}

		switch vt := v.(type) {
		case map[string]any:
			removeEmptyMapsAndSlices(vt)
			if len(vt) == 0 {
				delete(m, k)
			}
		case []any:
			if len(vt) == 0 {
				delete(m, k)
			}
		}
	}
}

// StringMap returns a map[string]any representation of the Config struct
func (o *Config) StringMap() (map[string]any, error) {
	b, err := json.Marshal(o)
	if err != nil {
		return nil, err
	}

	var result map[string]any
	err = json.Unmarshal(b, &result)
	if err != nil {
		return nil, err
	}

	return result, nil
}

// stringMapDiff returns the difference between two maps with string keys
func stringMapDiff(m1, m2 map[string]any) map[string]any {
	result := make(map[string]any)

	for k, v := range m1 {
		if _, ok := m2[k]; !ok {
			result[k] = v // ideally this should be never reached
		}

		if reflect.DeepEqual(v, m2[k]) {
			continue
		}

		switch v.(type) {
		case map[string]any:
			// this happens during the serialization of the struct to map
			// so we can safely assume that the type is not matching, there
			// is a difference in the values
			casted, ok := m2[k].(map[string]any)
			if !ok {
				result[k] = v
				continue
			}
			res := stringMapDiff(v.(map[string]any), casted)
			if len(res) > 0 {
				result[k] = res
			}
		default:
			result[k] = v
		}
	}

	return result
}

// removeFakeSettings removes all the fields that have the value of FakeSetting
// it's necessary to remove the fields that have been masked to be able to
// export the configuration (and make it importable)
func removeFakeSettings(m map[string]any) {
	for k, v := range m {
		switch vt := v.(type) {
		case map[string]any:
			removeFakeSettings(vt)
		case string:
			if v == FakeSetting {
				delete(m, k)
			}
		}
	}
}

func isTagPresent(tag string, tags []string) bool {
	for _, val := range tags {
		tagValue := strings.TrimSpace(val)
		if tagValue != "" && tagValue == tag {
			return true
		}
	}

	return false
}

// Copied from https://golang.org/src/net/dnsclient.go#L119
func isDomainName(s string) bool {
	// See RFC 1035, RFC 3696.
	// Presentation format has dots before every label except the first, and the
	// terminal empty label is optional here because we assume fully-qualified
	// (absolute) input. We must therefore reserve space for the first and last
	// labels' length octets in wire format, where they are necessary and the
	// maximum total length is 255.
	// So our _effective_ maximum is 253, but 254 is not rejected if the last
	// character is a dot.
	l := len(s)
	if l == 0 || l > 254 || l == 254 && s[l-1] != '.' {
		return false
	}

	last := byte('.')
	ok := false // Ok once we've seen a letter.
	partlen := 0
	for i := 0; i < len(s); i++ {
		c := s[i]
		switch {
		default:
			return false
		case 'a' <= c && c <= 'z' || 'A' <= c && c <= 'Z' || c == '_':
			ok = true
			partlen++
		case '0' <= c && c <= '9':
			// fine
			partlen++
		case c == '-':
			// Byte before dash cannot be dot.
			if last == '.' {
				return false
			}
			partlen++
		case c == '.':
			// Byte before dot cannot be dot, dash.
			if last == '.' || last == '-' {
				return false
			}
			if partlen > 63 || partlen == 0 {
				return false
			}
			partlen = 0
		}
		last = c
	}
	if last == '-' || partlen > 63 {
		return false
	}

	return ok
}

func isSafeLink(link *string) bool {
	if link != nil {
		if IsValidHTTPURL(*link) {
			return true
		} else if strings.HasPrefix(*link, "/") {
			return true
		}
		return false
	}

	return true
}
