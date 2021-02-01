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
	"reflect"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/mattermost/ldap"

	"github.com/mattermost/mattermost-server/v5/mlog"
)

const (
	CONN_SECURITY_NONE     = ""
	CONN_SECURITY_PLAIN    = "PLAIN"
	CONN_SECURITY_TLS      = "TLS"
	CONN_SECURITY_STARTTLS = "STARTTLS"

	IMAGE_DRIVER_LOCAL = "local"
	IMAGE_DRIVER_S3    = "amazons3"

	DATABASE_DRIVER_SQLITE   = "sqlite3"
	DATABASE_DRIVER_MYSQL    = "mysql"
	DATABASE_DRIVER_POSTGRES = "postgres"

	MINIO_ACCESS_KEY = "minioaccesskey"
	MINIO_SECRET_KEY = "miniosecretkey"
	MINIO_BUCKET     = "mattermost-test"

	PASSWORD_MAXIMUM_LENGTH = 64
	PASSWORD_MINIMUM_LENGTH = 5

	SERVICE_GITLAB    = "gitlab"
	SERVICE_GOOGLE    = "google"
	SERVICE_OFFICE365 = "office365"
	SERVICE_OPENID    = "openid"

	GENERIC_NO_CHANNEL_NOTIFICATION = "generic_no_channel"
	GENERIC_NOTIFICATION            = "generic"
	GENERIC_NOTIFICATION_SERVER     = "https://push-test.mattermost.com"
	MM_SUPPORT_ADVISOR_ADDRESS      = "support-advisor@mattermost.com"
	FULL_NOTIFICATION               = "full"
	ID_LOADED_NOTIFICATION          = "id_loaded"

	DIRECT_MESSAGE_ANY  = "any"
	DIRECT_MESSAGE_TEAM = "team"

	SHOW_USERNAME          = "username"
	SHOW_NICKNAME_FULLNAME = "nickname_full_name"
	SHOW_FULLNAME          = "full_name"

	PERMISSIONS_ALL           = "all"
	PERMISSIONS_CHANNEL_ADMIN = "channel_admin"
	PERMISSIONS_TEAM_ADMIN    = "team_admin"
	PERMISSIONS_SYSTEM_ADMIN  = "system_admin"

	FAKE_SETTING = "********************************"

	RESTRICT_EMOJI_CREATION_ALL          = "all"
	RESTRICT_EMOJI_CREATION_ADMIN        = "admin"
	RESTRICT_EMOJI_CREATION_SYSTEM_ADMIN = "system_admin"

	PERMISSIONS_DELETE_POST_ALL          = "all"
	PERMISSIONS_DELETE_POST_TEAM_ADMIN   = "team_admin"
	PERMISSIONS_DELETE_POST_SYSTEM_ADMIN = "system_admin"

	ALLOW_EDIT_POST_ALWAYS     = "always"
	ALLOW_EDIT_POST_NEVER      = "never"
	ALLOW_EDIT_POST_TIME_LIMIT = "time_limit"

	GROUP_UNREAD_CHANNELS_DISABLED    = "disabled"
	GROUP_UNREAD_CHANNELS_DEFAULT_ON  = "default_on"
	GROUP_UNREAD_CHANNELS_DEFAULT_OFF = "default_off"

	COLLAPSED_THREADS_DISABLED    = "disabled"
	COLLAPSED_THREADS_DEFAULT_ON  = "default_on"
	COLLAPSED_THREADS_DEFAULT_OFF = "default_off"

	EMAIL_BATCHING_BUFFER_SIZE = 256
	EMAIL_BATCHING_INTERVAL    = 30

	EMAIL_NOTIFICATION_CONTENTS_FULL    = "full"
	EMAIL_NOTIFICATION_CONTENTS_GENERIC = "generic"

	SITENAME_MAX_LENGTH = 30

	SERVICE_SETTINGS_DEFAULT_SITE_URL           = "http://localhost:8065"
	SERVICE_SETTINGS_DEFAULT_TLS_CERT_FILE      = ""
	SERVICE_SETTINGS_DEFAULT_TLS_KEY_FILE       = ""
	SERVICE_SETTINGS_DEFAULT_READ_TIMEOUT       = 300
	SERVICE_SETTINGS_DEFAULT_WRITE_TIMEOUT      = 300
	SERVICE_SETTINGS_DEFAULT_IDLE_TIMEOUT       = 60
	SERVICE_SETTINGS_DEFAULT_MAX_LOGIN_ATTEMPTS = 10
	SERVICE_SETTINGS_DEFAULT_ALLOW_CORS_FROM    = ""
	SERVICE_SETTINGS_DEFAULT_LISTEN_AND_ADDRESS = ":8065"
	SERVICE_SETTINGS_DEFAULT_GFYCAT_API_KEY     = "2_KtH_W5"
	SERVICE_SETTINGS_DEFAULT_GFYCAT_API_SECRET  = "3wLVZPiswc3DnaiaFoLkDvB4X0IV6CpMkj4tf2inJRsBY6-FnkT08zGmppWFgeof"

	TEAM_SETTINGS_DEFAULT_SITE_NAME                = "Mattermost"
	TEAM_SETTINGS_DEFAULT_MAX_USERS_PER_TEAM       = 50
	TEAM_SETTINGS_DEFAULT_CUSTOM_BRAND_TEXT        = ""
	TEAM_SETTINGS_DEFAULT_CUSTOM_DESCRIPTION_TEXT  = ""
	TEAM_SETTINGS_DEFAULT_USER_STATUS_AWAY_TIMEOUT = 300

	SQL_SETTINGS_DEFAULT_DATA_SOURCE = "postgres://mmuser:mostest@localhost/mattermost_test?sslmode=disable&connect_timeout=10"

	FILE_SETTINGS_DEFAULT_DIRECTORY = "./data/"

	IMPORT_SETTINGS_DEFAULT_DIRECTORY      = "./import"
	IMPORT_SETTINGS_DEFAULT_RETENTION_DAYS = 30

	EMAIL_SETTINGS_DEFAULT_FEEDBACK_ORGANIZATION = ""

	SUPPORT_SETTINGS_DEFAULT_TERMS_OF_SERVICE_LINK = "https://about.mattermost.com/default-terms/"
	SUPPORT_SETTINGS_DEFAULT_PRIVACY_POLICY_LINK   = "https://about.mattermost.com/default-privacy-policy/"
	SUPPORT_SETTINGS_DEFAULT_ABOUT_LINK            = "https://about.mattermost.com/default-about/"
	SUPPORT_SETTINGS_DEFAULT_HELP_LINK             = "https://about.mattermost.com/default-help/"
	SUPPORT_SETTINGS_DEFAULT_REPORT_A_PROBLEM_LINK = "https://about.mattermost.com/default-report-a-problem/"
	SUPPORT_SETTINGS_DEFAULT_SUPPORT_EMAIL         = "feedback@mattermost.com"
	SUPPORT_SETTINGS_DEFAULT_RE_ACCEPTANCE_PERIOD  = 365

	LDAP_SETTINGS_DEFAULT_FIRST_NAME_ATTRIBUTE         = ""
	LDAP_SETTINGS_DEFAULT_LAST_NAME_ATTRIBUTE          = ""
	LDAP_SETTINGS_DEFAULT_EMAIL_ATTRIBUTE              = ""
	LDAP_SETTINGS_DEFAULT_USERNAME_ATTRIBUTE           = ""
	LDAP_SETTINGS_DEFAULT_NICKNAME_ATTRIBUTE           = ""
	LDAP_SETTINGS_DEFAULT_ID_ATTRIBUTE                 = ""
	LDAP_SETTINGS_DEFAULT_POSITION_ATTRIBUTE           = ""
	LDAP_SETTINGS_DEFAULT_LOGIN_FIELD_NAME             = ""
	LDAP_SETTINGS_DEFAULT_GROUP_DISPLAY_NAME_ATTRIBUTE = ""
	LDAP_SETTINGS_DEFAULT_GROUP_ID_ATTRIBUTE           = ""
	LDAP_SETTINGS_DEFAULT_PICTURE_ATTRIBUTE            = ""

	SAML_SETTINGS_DEFAULT_ID_ATTRIBUTE         = ""
	SAML_SETTINGS_DEFAULT_GUEST_ATTRIBUTE      = ""
	SAML_SETTINGS_DEFAULT_ADMIN_ATTRIBUTE      = ""
	SAML_SETTINGS_DEFAULT_FIRST_NAME_ATTRIBUTE = ""
	SAML_SETTINGS_DEFAULT_LAST_NAME_ATTRIBUTE  = ""
	SAML_SETTINGS_DEFAULT_EMAIL_ATTRIBUTE      = ""
	SAML_SETTINGS_DEFAULT_USERNAME_ATTRIBUTE   = ""
	SAML_SETTINGS_DEFAULT_NICKNAME_ATTRIBUTE   = ""
	SAML_SETTINGS_DEFAULT_LOCALE_ATTRIBUTE     = ""
	SAML_SETTINGS_DEFAULT_POSITION_ATTRIBUTE   = ""

	SAML_SETTINGS_SIGNATURE_ALGORITHM_SHA1    = "RSAwithSHA1"
	SAML_SETTINGS_SIGNATURE_ALGORITHM_SHA256  = "RSAwithSHA256"
	SAML_SETTINGS_SIGNATURE_ALGORITHM_SHA512  = "RSAwithSHA512"
	SAML_SETTINGS_DEFAULT_SIGNATURE_ALGORITHM = SAML_SETTINGS_SIGNATURE_ALGORITHM_SHA1

	SAML_SETTINGS_CANONICAL_ALGORITHM_C14N    = "Canonical1.0"
	SAML_SETTINGS_CANONICAL_ALGORITHM_C14N11  = "Canonical1.1"
	SAML_SETTINGS_DEFAULT_CANONICAL_ALGORITHM = SAML_SETTINGS_CANONICAL_ALGORITHM_C14N

	NATIVEAPP_SETTINGS_DEFAULT_APP_DOWNLOAD_LINK         = "https://mattermost.com/download/#mattermostApps"
	NATIVEAPP_SETTINGS_DEFAULT_ANDROID_APP_DOWNLOAD_LINK = "https://about.mattermost.com/mattermost-android-app/"
	NATIVEAPP_SETTINGS_DEFAULT_IOS_APP_DOWNLOAD_LINK     = "https://about.mattermost.com/mattermost-ios-app/"

	EXPERIMENTAL_SETTINGS_DEFAULT_LINK_METADATA_TIMEOUT_MILLISECONDS = 5000

	ANALYTICS_SETTINGS_DEFAULT_MAX_USERS_FOR_STATISTICS = 2500

	ANNOUNCEMENT_SETTINGS_DEFAULT_BANNER_COLOR                    = "#f2a93b"
	ANNOUNCEMENT_SETTINGS_DEFAULT_BANNER_TEXT_COLOR               = "#333333"
	ANNOUNCEMENT_SETTINGS_DEFAULT_NOTICES_JSON_URL                = "https://notices.mattermost.com/"
	ANNOUNCEMENT_SETTINGS_DEFAULT_NOTICES_FETCH_FREQUENCY_SECONDS = 3600

	TEAM_SETTINGS_DEFAULT_TEAM_TEXT = "default"

	ELASTICSEARCH_SETTINGS_DEFAULT_CONNECTION_URL                    = "http://localhost:9200"
	ELASTICSEARCH_SETTINGS_DEFAULT_USERNAME                          = "elastic"
	ELASTICSEARCH_SETTINGS_DEFAULT_PASSWORD                          = "changeme"
	ELASTICSEARCH_SETTINGS_DEFAULT_POST_INDEX_REPLICAS               = 1
	ELASTICSEARCH_SETTINGS_DEFAULT_POST_INDEX_SHARDS                 = 1
	ELASTICSEARCH_SETTINGS_DEFAULT_CHANNEL_INDEX_REPLICAS            = 1
	ELASTICSEARCH_SETTINGS_DEFAULT_CHANNEL_INDEX_SHARDS              = 1
	ELASTICSEARCH_SETTINGS_DEFAULT_USER_INDEX_REPLICAS               = 1
	ELASTICSEARCH_SETTINGS_DEFAULT_USER_INDEX_SHARDS                 = 1
	ELASTICSEARCH_SETTINGS_DEFAULT_AGGREGATE_POSTS_AFTER_DAYS        = 365
	ELASTICSEARCH_SETTINGS_DEFAULT_POSTS_AGGREGATOR_JOB_START_TIME   = "03:00"
	ELASTICSEARCH_SETTINGS_DEFAULT_INDEX_PREFIX                      = ""
	ELASTICSEARCH_SETTINGS_DEFAULT_LIVE_INDEXING_BATCH_SIZE          = 1
	ELASTICSEARCH_SETTINGS_DEFAULT_BULK_INDEXING_TIME_WINDOW_SECONDS = 3600
	ELASTICSEARCH_SETTINGS_DEFAULT_REQUEST_TIMEOUT_SECONDS           = 30

	BLEVE_SETTINGS_DEFAULT_INDEX_DIR                         = ""
	BLEVE_SETTINGS_DEFAULT_BULK_INDEXING_TIME_WINDOW_SECONDS = 3600

	DATA_RETENTION_SETTINGS_DEFAULT_MESSAGE_RETENTION_DAYS  = 365
	DATA_RETENTION_SETTINGS_DEFAULT_FILE_RETENTION_DAYS     = 365
	DATA_RETENTION_SETTINGS_DEFAULT_DELETION_JOB_START_TIME = "02:00"

	PLUGIN_SETTINGS_DEFAULT_DIRECTORY          = "./plugins"
	PLUGIN_SETTINGS_DEFAULT_CLIENT_DIRECTORY   = "./client/plugins"
	PLUGIN_SETTINGS_DEFAULT_ENABLE_MARKETPLACE = true
	PLUGIN_SETTINGS_DEFAULT_MARKETPLACE_URL    = "https://api.integrations.mattermost.com"
	PLUGIN_SETTINGS_OLD_MARKETPLACE_URL        = "https://marketplace.integrations.mattermost.com"

	COMPLIANCE_EXPORT_TYPE_CSV             = "csv"
	COMPLIANCE_EXPORT_TYPE_ACTIANCE        = "actiance"
	COMPLIANCE_EXPORT_TYPE_GLOBALRELAY     = "globalrelay"
	COMPLIANCE_EXPORT_TYPE_GLOBALRELAY_ZIP = "globalrelay-zip"
	GLOBALRELAY_CUSTOMER_TYPE_A9           = "A9"
	GLOBALRELAY_CUSTOMER_TYPE_A10          = "A10"

	CLIENT_SIDE_CERT_CHECK_PRIMARY_AUTH   = "primary"
	CLIENT_SIDE_CERT_CHECK_SECONDARY_AUTH = "secondary"

	IMAGE_PROXY_TYPE_LOCAL      = "local"
	IMAGE_PROXY_TYPE_ATMOS_CAMO = "atmos/camo"

	GOOGLE_SETTINGS_DEFAULT_SCOPE             = "profile email"
	GOOGLE_SETTINGS_DEFAULT_AUTH_ENDPOINT     = "https://accounts.google.com/o/oauth2/v2/auth"
	GOOGLE_SETTINGS_DEFAULT_TOKEN_ENDPOINT    = "https://www.googleapis.com/oauth2/v4/token"
	GOOGLE_SETTINGS_DEFAULT_USER_API_ENDPOINT = "https://people.googleapis.com/v1/people/me?personFields=names,emailAddresses,nicknames,metadata"

	OFFICE365_SETTINGS_DEFAULT_SCOPE             = "User.Read"
	OFFICE365_SETTINGS_DEFAULT_AUTH_ENDPOINT     = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
	OFFICE365_SETTINGS_DEFAULT_TOKEN_ENDPOINT    = "https://login.microsoftonline.com/common/oauth2/v2.0/token"
	OFFICE365_SETTINGS_DEFAULT_USER_API_ENDPOINT = "https://graph.microsoft.com/v1.0/me"

	CLOUD_SETTINGS_DEFAULT_CWS_URL = "https://customers.mattermost.com"
	OPENID_SETTINGS_DEFAULT_SCOPE  = "profile openid email"

	LOCAL_MODE_SOCKET_PATH = "/var/tmp/mattermost_local.socket"
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
	SiteURL                                           *string  `access:"environment,authentication,write_restrictable"`
	WebsocketURL                                      *string  `access:"write_restrictable,cloud_restrictable"`
	LicenseFileLocation                               *string  `access:"write_restrictable,cloud_restrictable"`
	ListenAddress                                     *string  `access:"environment,write_restrictable,cloud_restrictable"`
	ConnectionSecurity                                *string  `access:"environment,write_restrictable,cloud_restrictable"`
	TLSCertFile                                       *string  `access:"environment,write_restrictable,cloud_restrictable"`
	TLSKeyFile                                        *string  `access:"environment,write_restrictable,cloud_restrictable"`
	TLSMinVer                                         *string  `access:"write_restrictable,cloud_restrictable"`
	TLSStrictTransport                                *bool    `access:"write_restrictable,cloud_restrictable"`
	TLSStrictTransportMaxAge                          *int64   `access:"write_restrictable,cloud_restrictable"`
	TLSOverwriteCiphers                               []string `access:"write_restrictable,cloud_restrictable"`
	UseLetsEncrypt                                    *bool    `access:"environment,write_restrictable,cloud_restrictable"`
	LetsEncryptCertificateCacheFile                   *string  `access:"environment,write_restrictable,cloud_restrictable"`
	Forward80To443                                    *bool    `access:"environment,write_restrictable,cloud_restrictable"`
	TrustedProxyIPHeader                              []string `access:"write_restrictable,cloud_restrictable"`
	ReadTimeout                                       *int     `access:"environment,write_restrictable,cloud_restrictable"`
	WriteTimeout                                      *int     `access:"environment,write_restrictable,cloud_restrictable"`
	IdleTimeout                                       *int     `access:"write_restrictable,cloud_restrictable"`
	MaximumLoginAttempts                              *int     `access:"authentication,write_restrictable,cloud_restrictable"`
	GoroutineHealthThreshold                          *int     `access:"write_restrictable,cloud_restrictable"`
	GoogleDeveloperKey                                *string  `access:"site,write_restrictable,cloud_restrictable"`
	EnableOAuthServiceProvider                        *bool    `access:"integrations"`
	EnableIncomingWebhooks                            *bool    `access:"integrations"`
	EnableOutgoingWebhooks                            *bool    `access:"integrations"`
	EnableCommands                                    *bool    `access:"integrations"`
	DEPRECATED_DO_NOT_USE_EnableOnlyAdminIntegrations *bool    `json:"EnableOnlyAdminIntegrations" mapstructure:"EnableOnlyAdminIntegrations"` // This field is deprecated and must not be used.
	EnablePostUsernameOverride                        *bool    `access:"integrations"`
	EnablePostIconOverride                            *bool    `access:"integrations"`
	EnableLinkPreviews                                *bool    `access:"site"`
	EnableTesting                                     *bool    `access:"environment,write_restrictable,cloud_restrictable"`
	EnableDeveloper                                   *bool    `access:"environment,write_restrictable,cloud_restrictable"`
	EnableOpenTracing                                 *bool    `access:"write_restrictable,cloud_restrictable"`
	EnableSecurityFixAlert                            *bool    `access:"environment,write_restrictable,cloud_restrictable"`
	EnableInsecureOutgoingConnections                 *bool    `access:"environment,write_restrictable,cloud_restrictable"`
	AllowedUntrustedInternalConnections               *string  `access:"environment,write_restrictable,cloud_restrictable"`
	EnableMultifactorAuthentication                   *bool    `access:"authentication"`
	EnforceMultifactorAuthentication                  *bool    `access:"authentication"`
	EnableUserAccessTokens                            *bool    `access:"integrations"`
	AllowCorsFrom                                     *string  `access:"integrations,write_restrictable,cloud_restrictable"`
	CorsExposedHeaders                                *string  `access:"integrations,write_restrictable,cloud_restrictable"`
	CorsAllowCredentials                              *bool    `access:"integrations,write_restrictable,cloud_restrictable"`
	CorsDebug                                         *bool    `access:"integrations,write_restrictable,cloud_restrictable"`
	AllowCookiesForSubdomains                         *bool    `access:"write_restrictable,cloud_restrictable"`
	ExtendSessionLengthWithActivity                   *bool    `access:"environment,write_restrictable,cloud_restrictable"`
	SessionLengthWebInDays                            *int     `access:"environment,write_restrictable,cloud_restrictable"`
	SessionLengthMobileInDays                         *int     `access:"environment,write_restrictable,cloud_restrictable"`
	SessionLengthSSOInDays                            *int     `access:"environment,write_restrictable,cloud_restrictable"`
	SessionCacheInMinutes                             *int     `access:"environment,write_restrictable,cloud_restrictable"`
	SessionIdleTimeoutInMinutes                       *int     `access:"environment,write_restrictable,cloud_restrictable"`
	WebsocketSecurePort                               *int     `access:"write_restrictable,cloud_restrictable"`
	WebsocketPort                                     *int     `access:"write_restrictable,cloud_restrictable"`
	WebserverMode                                     *string  `access:"environment,write_restrictable,cloud_restrictable"`
	EnableCustomEmoji                                 *bool    `access:"site"`
	EnableEmojiPicker                                 *bool    `access:"site"`
	EnableGifPicker                                   *bool    `access:"integrations"`
	GfycatApiKey                                      *string  `access:"integrations"`
	GfycatApiSecret                                   *string  `access:"integrations"`
	DEPRECATED_DO_NOT_USE_RestrictCustomEmojiCreation *string  `json:"RestrictCustomEmojiCreation" mapstructure:"RestrictCustomEmojiCreation"` // This field is deprecated and must not be used.
	DEPRECATED_DO_NOT_USE_RestrictPostDelete          *string  `json:"RestrictPostDelete" mapstructure:"RestrictPostDelete"`                   // This field is deprecated and must not be used.
	DEPRECATED_DO_NOT_USE_AllowEditPost               *string  `json:"AllowEditPost" mapstructure:"AllowEditPost"`                             // This field is deprecated and must not be used.
	PostEditTimeLimit                                 *int     `access:"user_management_permissions"`
	TimeBetweenUserTypingUpdatesMilliseconds          *int64   `access:"experimental,write_restrictable,cloud_restrictable"`
	EnablePostSearch                                  *bool    `access:"write_restrictable,cloud_restrictable"`
	MinimumHashtagLength                              *int     `access:"environment,write_restrictable,cloud_restrictable"`
	EnableUserTypingMessages                          *bool    `access:"experimental,write_restrictable,cloud_restrictable"`
	EnableChannelViewedMessages                       *bool    `access:"experimental,write_restrictable,cloud_restrictable"`
	EnableUserStatuses                                *bool    `access:"write_restrictable,cloud_restrictable"`
	ExperimentalEnableAuthenticationTransfer          *bool    `access:"experimental,write_restrictable,cloud_restrictable"`
	ClusterLogTimeoutMilliseconds                     *int     `access:"write_restrictable,cloud_restrictable"`
	CloseUnusedDirectMessages                         *bool    `access:"experimental"`
	EnablePreviewFeatures                             *bool    `access:"experimental"`
	EnableTutorial                                    *bool    `access:"experimental"`
	ExperimentalEnableDefaultChannelLeaveJoinMessages *bool    `access:"experimental"`
	ExperimentalGroupUnreadChannels                   *string  `access:"experimental"`
	ExperimentalChannelOrganization                   *bool    `access:"experimental"`
	DEPRECATED_DO_NOT_USE_ImageProxyType              *string  `json:"ImageProxyType" mapstructure:"ImageProxyType"`       // This field is deprecated and must not be used.
	DEPRECATED_DO_NOT_USE_ImageProxyURL               *string  `json:"ImageProxyURL" mapstructure:"ImageProxyURL"`         // This field is deprecated and must not be used.
	DEPRECATED_DO_NOT_USE_ImageProxyOptions           *string  `json:"ImageProxyOptions" mapstructure:"ImageProxyOptions"` // This field is deprecated and must not be used.
	EnableAPITeamDeletion                             *bool
	EnableAPIUserDeletion                             *bool
	ExperimentalEnableHardenedMode                    *bool `access:"experimental"`
	DisableLegacyMFA                                  *bool `access:"write_restrictable,cloud_restrictable"`
	ExperimentalStrictCSRFEnforcement                 *bool `access:"experimental,write_restrictable,cloud_restrictable"`
	EnableEmailInvitations                            *bool `access:"authentication"`
	DisableBotsWhenOwnerIsDeactivated                 *bool `access:"integrations,write_restrictable,cloud_restrictable"`
	EnableBotAccountCreation                          *bool `access:"integrations"`
	EnableSVGs                                        *bool `access:"site"`
	EnableLatex                                       *bool `access:"site"`
	EnableAPIChannelDeletion                          *bool
	EnableLocalMode                                   *bool
	LocalModeSocketLocation                           *string
	EnableAWSMetering                                 *bool
	SplitKey                                          *string `access:"environment,write_restrictable"`
	FeatureFlagSyncIntervalSeconds                    *int    `access:"environment,write_restrictable"`
	DebugSplit                                        *bool   `access:"environment,write_restrictable"`
	ThreadAutoFollow                                  *bool   `access:"experimental"`
	CollapsedThreads                                  *string `access:"experimental"`
	ManagedResourcePaths                              *string `access:"environment,write_restrictable,cloud_restrictable"`
	EnableLegacySidebar                               *bool   `access:"experimental"`
}

func (s *ServiceSettings) SetDefaults(isUpdate bool) {
	if s.EnableEmailInvitations == nil {
		// If the site URL is also not present then assume this is a clean install
		if s.SiteURL == nil {
			s.EnableEmailInvitations = NewBool(false)
		} else {
			s.EnableEmailInvitations = NewBool(true)
		}
	}

	if s.SiteURL == nil {
		if s.EnableDeveloper != nil && *s.EnableDeveloper {
			s.SiteURL = NewString(SERVICE_SETTINGS_DEFAULT_SITE_URL)
		} else {
			s.SiteURL = NewString("")
		}
	}

	if s.WebsocketURL == nil {
		s.WebsocketURL = NewString("")
	}

	if s.LicenseFileLocation == nil {
		s.LicenseFileLocation = NewString("")
	}

	if s.ListenAddress == nil {
		s.ListenAddress = NewString(SERVICE_SETTINGS_DEFAULT_LISTEN_AND_ADDRESS)
	}

	if s.EnableLinkPreviews == nil {
		s.EnableLinkPreviews = NewBool(true)
	}

	if s.EnableTesting == nil {
		s.EnableTesting = NewBool(false)
	}

	if s.EnableDeveloper == nil {
		s.EnableDeveloper = NewBool(false)
	}

	if s.EnableOpenTracing == nil {
		s.EnableOpenTracing = NewBool(false)
	}

	if s.EnableSecurityFixAlert == nil {
		s.EnableSecurityFixAlert = NewBool(true)
	}

	if s.EnableInsecureOutgoingConnections == nil {
		s.EnableInsecureOutgoingConnections = NewBool(false)
	}

	if s.AllowedUntrustedInternalConnections == nil {
		s.AllowedUntrustedInternalConnections = NewString("")
	}

	if s.EnableMultifactorAuthentication == nil {
		s.EnableMultifactorAuthentication = NewBool(false)
	}

	if s.EnforceMultifactorAuthentication == nil {
		s.EnforceMultifactorAuthentication = NewBool(false)
	}

	if s.EnableUserAccessTokens == nil {
		s.EnableUserAccessTokens = NewBool(false)
	}

	if s.GoroutineHealthThreshold == nil {
		s.GoroutineHealthThreshold = NewInt(-1)
	}

	if s.GoogleDeveloperKey == nil {
		s.GoogleDeveloperKey = NewString("")
	}

	if s.EnableOAuthServiceProvider == nil {
		s.EnableOAuthServiceProvider = NewBool(false)
	}

	if s.EnableIncomingWebhooks == nil {
		s.EnableIncomingWebhooks = NewBool(true)
	}

	if s.EnableOutgoingWebhooks == nil {
		s.EnableOutgoingWebhooks = NewBool(true)
	}

	if s.ConnectionSecurity == nil {
		s.ConnectionSecurity = NewString("")
	}

	if s.TLSKeyFile == nil {
		s.TLSKeyFile = NewString(SERVICE_SETTINGS_DEFAULT_TLS_KEY_FILE)
	}

	if s.TLSCertFile == nil {
		s.TLSCertFile = NewString(SERVICE_SETTINGS_DEFAULT_TLS_CERT_FILE)
	}

	if s.TLSMinVer == nil {
		s.TLSMinVer = NewString("1.2")
	}

	if s.TLSStrictTransport == nil {
		s.TLSStrictTransport = NewBool(false)
	}

	if s.TLSStrictTransportMaxAge == nil {
		s.TLSStrictTransportMaxAge = NewInt64(63072000)
	}

	if s.TLSOverwriteCiphers == nil {
		s.TLSOverwriteCiphers = []string{}
	}

	if s.UseLetsEncrypt == nil {
		s.UseLetsEncrypt = NewBool(false)
	}

	if s.LetsEncryptCertificateCacheFile == nil {
		s.LetsEncryptCertificateCacheFile = NewString("./config/letsencrypt.cache")
	}

	if s.ReadTimeout == nil {
		s.ReadTimeout = NewInt(SERVICE_SETTINGS_DEFAULT_READ_TIMEOUT)
	}

	if s.WriteTimeout == nil {
		s.WriteTimeout = NewInt(SERVICE_SETTINGS_DEFAULT_WRITE_TIMEOUT)
	}

	if s.IdleTimeout == nil {
		s.IdleTimeout = NewInt(SERVICE_SETTINGS_DEFAULT_IDLE_TIMEOUT)
	}

	if s.MaximumLoginAttempts == nil {
		s.MaximumLoginAttempts = NewInt(SERVICE_SETTINGS_DEFAULT_MAX_LOGIN_ATTEMPTS)
	}

	if s.Forward80To443 == nil {
		s.Forward80To443 = NewBool(false)
	}

	if isUpdate {
		// When updating an existing configuration, ensure that defaults are set.
		if s.TrustedProxyIPHeader == nil {
			s.TrustedProxyIPHeader = []string{HEADER_FORWARDED, HEADER_REAL_IP}
		}
	} else {
		// When generating a blank configuration, leave the list empty.
		s.TrustedProxyIPHeader = []string{}
	}

	if s.TimeBetweenUserTypingUpdatesMilliseconds == nil {
		s.TimeBetweenUserTypingUpdatesMilliseconds = NewInt64(5000)
	}

	if s.EnablePostSearch == nil {
		s.EnablePostSearch = NewBool(true)
	}

	if s.MinimumHashtagLength == nil {
		s.MinimumHashtagLength = NewInt(3)
	}

	if s.EnableUserTypingMessages == nil {
		s.EnableUserTypingMessages = NewBool(true)
	}

	if s.EnableChannelViewedMessages == nil {
		s.EnableChannelViewedMessages = NewBool(true)
	}

	if s.EnableUserStatuses == nil {
		s.EnableUserStatuses = NewBool(true)
	}

	if s.ClusterLogTimeoutMilliseconds == nil {
		s.ClusterLogTimeoutMilliseconds = NewInt(2000)
	}

	if s.CloseUnusedDirectMessages == nil {
		s.CloseUnusedDirectMessages = NewBool(false)
	}

	if s.EnableTutorial == nil {
		s.EnableTutorial = NewBool(true)
	}

	// Must be manually enabled for existing installations.
	if s.ExtendSessionLengthWithActivity == nil {
		s.ExtendSessionLengthWithActivity = NewBool(!isUpdate)
	}

	if s.SessionLengthWebInDays == nil {
		if isUpdate {
			s.SessionLengthWebInDays = NewInt(180)
		} else {
			s.SessionLengthWebInDays = NewInt(30)
		}
	}

	if s.SessionLengthMobileInDays == nil {
		if isUpdate {
			s.SessionLengthMobileInDays = NewInt(180)
		} else {
			s.SessionLengthMobileInDays = NewInt(30)
		}
	}

	if s.SessionLengthSSOInDays == nil {
		s.SessionLengthSSOInDays = NewInt(30)
	}

	if s.SessionCacheInMinutes == nil {
		s.SessionCacheInMinutes = NewInt(10)
	}

	if s.SessionIdleTimeoutInMinutes == nil {
		s.SessionIdleTimeoutInMinutes = NewInt(43200)
	}

	if s.EnableCommands == nil {
		s.EnableCommands = NewBool(true)
	}

	if s.DEPRECATED_DO_NOT_USE_EnableOnlyAdminIntegrations == nil {
		s.DEPRECATED_DO_NOT_USE_EnableOnlyAdminIntegrations = NewBool(true)
	}

	if s.EnablePostUsernameOverride == nil {
		s.EnablePostUsernameOverride = NewBool(false)
	}

	if s.EnablePostIconOverride == nil {
		s.EnablePostIconOverride = NewBool(false)
	}

	if s.WebsocketPort == nil {
		s.WebsocketPort = NewInt(80)
	}

	if s.WebsocketSecurePort == nil {
		s.WebsocketSecurePort = NewInt(443)
	}

	if s.AllowCorsFrom == nil {
		s.AllowCorsFrom = NewString(SERVICE_SETTINGS_DEFAULT_ALLOW_CORS_FROM)
	}

	if s.CorsExposedHeaders == nil {
		s.CorsExposedHeaders = NewString("")
	}

	if s.CorsAllowCredentials == nil {
		s.CorsAllowCredentials = NewBool(false)
	}

	if s.CorsDebug == nil {
		s.CorsDebug = NewBool(false)
	}

	if s.AllowCookiesForSubdomains == nil {
		s.AllowCookiesForSubdomains = NewBool(false)
	}

	if s.WebserverMode == nil {
		s.WebserverMode = NewString("gzip")
	} else if *s.WebserverMode == "regular" {
		*s.WebserverMode = "gzip"
	}

	if s.EnableCustomEmoji == nil {
		s.EnableCustomEmoji = NewBool(true)
	}

	if s.EnableEmojiPicker == nil {
		s.EnableEmojiPicker = NewBool(true)
	}

	if s.EnableGifPicker == nil {
		s.EnableGifPicker = NewBool(true)
	}

	if s.GfycatApiKey == nil || *s.GfycatApiKey == "" {
		s.GfycatApiKey = NewString(SERVICE_SETTINGS_DEFAULT_GFYCAT_API_KEY)
	}

	if s.GfycatApiSecret == nil || *s.GfycatApiSecret == "" {
		s.GfycatApiSecret = NewString(SERVICE_SETTINGS_DEFAULT_GFYCAT_API_SECRET)
	}

	if s.DEPRECATED_DO_NOT_USE_RestrictCustomEmojiCreation == nil {
		s.DEPRECATED_DO_NOT_USE_RestrictCustomEmojiCreation = NewString(RESTRICT_EMOJI_CREATION_ALL)
	}

	if s.DEPRECATED_DO_NOT_USE_RestrictPostDelete == nil {
		s.DEPRECATED_DO_NOT_USE_RestrictPostDelete = NewString(PERMISSIONS_DELETE_POST_ALL)
	}

	if s.DEPRECATED_DO_NOT_USE_AllowEditPost == nil {
		s.DEPRECATED_DO_NOT_USE_AllowEditPost = NewString(ALLOW_EDIT_POST_ALWAYS)
	}

	if s.ExperimentalEnableAuthenticationTransfer == nil {
		s.ExperimentalEnableAuthenticationTransfer = NewBool(true)
	}

	if s.PostEditTimeLimit == nil {
		s.PostEditTimeLimit = NewInt(-1)
	}

	if s.EnablePreviewFeatures == nil {
		s.EnablePreviewFeatures = NewBool(true)
	}

	if s.ExperimentalEnableDefaultChannelLeaveJoinMessages == nil {
		s.ExperimentalEnableDefaultChannelLeaveJoinMessages = NewBool(true)
	}

	if s.ExperimentalGroupUnreadChannels == nil {
		s.ExperimentalGroupUnreadChannels = NewString(GROUP_UNREAD_CHANNELS_DISABLED)
	} else if *s.ExperimentalGroupUnreadChannels == "0" {
		s.ExperimentalGroupUnreadChannels = NewString(GROUP_UNREAD_CHANNELS_DISABLED)
	} else if *s.ExperimentalGroupUnreadChannels == "1" {
		s.ExperimentalGroupUnreadChannels = NewString(GROUP_UNREAD_CHANNELS_DEFAULT_ON)
	}

	if s.ExperimentalChannelOrganization == nil {
		experimentalUnreadEnabled := *s.ExperimentalGroupUnreadChannels != GROUP_UNREAD_CHANNELS_DISABLED
		s.ExperimentalChannelOrganization = NewBool(experimentalUnreadEnabled)
	}

	if s.DEPRECATED_DO_NOT_USE_ImageProxyType == nil {
		s.DEPRECATED_DO_NOT_USE_ImageProxyType = NewString("")
	}

	if s.DEPRECATED_DO_NOT_USE_ImageProxyURL == nil {
		s.DEPRECATED_DO_NOT_USE_ImageProxyURL = NewString("")
	}

	if s.DEPRECATED_DO_NOT_USE_ImageProxyOptions == nil {
		s.DEPRECATED_DO_NOT_USE_ImageProxyOptions = NewString("")
	}

	if s.EnableAPITeamDeletion == nil {
		s.EnableAPITeamDeletion = NewBool(false)
	}

	if s.EnableAPIUserDeletion == nil {
		s.EnableAPIUserDeletion = NewBool(false)
	}

	if s.EnableAPIChannelDeletion == nil {
		s.EnableAPIChannelDeletion = NewBool(false)
	}

	if s.ExperimentalEnableHardenedMode == nil {
		s.ExperimentalEnableHardenedMode = NewBool(false)
	}

	if s.DisableLegacyMFA == nil {
		s.DisableLegacyMFA = NewBool(!isUpdate)
	}

	if s.ExperimentalStrictCSRFEnforcement == nil {
		s.ExperimentalStrictCSRFEnforcement = NewBool(false)
	}

	if s.DisableBotsWhenOwnerIsDeactivated == nil {
		s.DisableBotsWhenOwnerIsDeactivated = NewBool(true)
	}

	if s.EnableBotAccountCreation == nil {
		s.EnableBotAccountCreation = NewBool(false)
	}

	if s.EnableSVGs == nil {
		if isUpdate {
			s.EnableSVGs = NewBool(true)
		} else {
			s.EnableSVGs = NewBool(false)
		}
	}

	if s.EnableLatex == nil {
		if isUpdate {
			s.EnableLatex = NewBool(true)
		} else {
			s.EnableLatex = NewBool(false)
		}
	}

	if s.EnableLocalMode == nil {
		s.EnableLocalMode = NewBool(false)
	}

	if s.LocalModeSocketLocation == nil {
		s.LocalModeSocketLocation = NewString(LOCAL_MODE_SOCKET_PATH)
	}

	if s.EnableAWSMetering == nil {
		s.EnableAWSMetering = NewBool(false)
	}

	if s.SplitKey == nil {
		s.SplitKey = NewString("")
	}

	if s.FeatureFlagSyncIntervalSeconds == nil {
		s.FeatureFlagSyncIntervalSeconds = NewInt(30)
	}

	if s.DebugSplit == nil {
		s.DebugSplit = NewBool(false)
	}

	if s.ThreadAutoFollow == nil {
		s.ThreadAutoFollow = NewBool(true)
	}

	if s.CollapsedThreads == nil {
		s.CollapsedThreads = NewString(COLLAPSED_THREADS_DISABLED)
	}

	if s.ManagedResourcePaths == nil {
		s.ManagedResourcePaths = NewString("")
	}

	if s.EnableLegacySidebar == nil {
		s.EnableLegacySidebar = NewBool(false)
	}
}

type ClusterSettings struct {
	Enable                             *bool   `access:"environment,write_restrictable"`
	ClusterName                        *string `access:"environment,write_restrictable,cloud_restrictable"`
	OverrideHostname                   *string `access:"environment,write_restrictable,cloud_restrictable"`
	NetworkInterface                   *string `access:"environment,write_restrictable,cloud_restrictable"`
	BindAddress                        *string `access:"environment,write_restrictable,cloud_restrictable"`
	AdvertiseAddress                   *string `access:"environment,write_restrictable,cloud_restrictable"`
	UseIpAddress                       *bool   `access:"environment,write_restrictable,cloud_restrictable"`
	UseExperimentalGossip              *bool   `access:"environment,write_restrictable,cloud_restrictable"`
	EnableGossipCompression            *bool   `access:"environment,write_restrictable,cloud_restrictable"`
	EnableExperimentalGossipEncryption *bool   `access:"environment,write_restrictable,cloud_restrictable"`
	ReadOnlyConfig                     *bool   `access:"environment,write_restrictable,cloud_restrictable"`
	GossipPort                         *int    `access:"environment,write_restrictable,cloud_restrictable"`
	StreamingPort                      *int    `access:"environment,write_restrictable,cloud_restrictable"`
	MaxIdleConns                       *int    `access:"environment,write_restrictable,cloud_restrictable"`
	MaxIdleConnsPerHost                *int    `access:"environment,write_restrictable,cloud_restrictable"`
	IdleConnTimeoutMilliseconds        *int    `access:"environment,write_restrictable,cloud_restrictable"`
}

func (s *ClusterSettings) SetDefaults() {
	if s.Enable == nil {
		s.Enable = NewBool(false)
	}

	if s.ClusterName == nil {
		s.ClusterName = NewString("")
	}

	if s.OverrideHostname == nil {
		s.OverrideHostname = NewString("")
	}

	if s.NetworkInterface == nil {
		s.NetworkInterface = NewString("")
	}

	if s.BindAddress == nil {
		s.BindAddress = NewString("")
	}

	if s.AdvertiseAddress == nil {
		s.AdvertiseAddress = NewString("")
	}

	if s.UseIpAddress == nil {
		s.UseIpAddress = NewBool(true)
	}

	if s.UseExperimentalGossip == nil {
		s.UseExperimentalGossip = NewBool(true)
	}

	if s.EnableExperimentalGossipEncryption == nil {
		s.EnableExperimentalGossipEncryption = NewBool(false)
	}

	if s.EnableGossipCompression == nil {
		s.EnableGossipCompression = NewBool(true)
	}

	if s.ReadOnlyConfig == nil {
		s.ReadOnlyConfig = NewBool(true)
	}

	if s.GossipPort == nil {
		s.GossipPort = NewInt(8074)
	}

	if s.StreamingPort == nil {
		s.StreamingPort = NewInt(8075)
	}

	if s.MaxIdleConns == nil {
		s.MaxIdleConns = NewInt(100)
	}

	if s.MaxIdleConnsPerHost == nil {
		s.MaxIdleConnsPerHost = NewInt(128)
	}

	if s.IdleConnTimeoutMilliseconds == nil {
		s.IdleConnTimeoutMilliseconds = NewInt(90000)
	}
}

type MetricsSettings struct {
	Enable           *bool   `access:"environment,write_restrictable,cloud_restrictable"`
	BlockProfileRate *int    `access:"environment,write_restrictable,cloud_restrictable"`
	ListenAddress    *string `access:"environment,write_restrictable,cloud_restrictable"`
}

func (s *MetricsSettings) SetDefaults() {
	if s.ListenAddress == nil {
		s.ListenAddress = NewString(":8067")
	}

	if s.Enable == nil {
		s.Enable = NewBool(false)
	}

	if s.BlockProfileRate == nil {
		s.BlockProfileRate = NewInt(0)
	}
}

type ExperimentalSettings struct {
	ClientSideCertEnable            *bool   `access:"experimental,cloud_restrictable"`
	ClientSideCertCheck             *string `access:"experimental,cloud_restrictable"`
	EnableClickToReply              *bool   `access:"experimental,write_restrictable,cloud_restrictable"`
	LinkMetadataTimeoutMilliseconds *int64  `access:"experimental,write_restrictable,cloud_restrictable"`
	RestrictSystemAdmin             *bool   `access:"experimental,write_restrictable"`
	UseNewSAMLLibrary               *bool   `access:"experimental,cloud_restrictable"`
	CloudUserLimit                  *int64  `access:"experimental,write_restrictable"`
	CloudBilling                    *bool   `access:"experimental,write_restrictable"`
	EnableSharedChannels            *bool   `access:"experimental"`
}

func (s *ExperimentalSettings) SetDefaults() {
	if s.ClientSideCertEnable == nil {
		s.ClientSideCertEnable = NewBool(false)
	}

	if s.ClientSideCertCheck == nil {
		s.ClientSideCertCheck = NewString(CLIENT_SIDE_CERT_CHECK_SECONDARY_AUTH)
	}

	if s.EnableClickToReply == nil {
		s.EnableClickToReply = NewBool(false)
	}

	if s.LinkMetadataTimeoutMilliseconds == nil {
		s.LinkMetadataTimeoutMilliseconds = NewInt64(EXPERIMENTAL_SETTINGS_DEFAULT_LINK_METADATA_TIMEOUT_MILLISECONDS)
	}

	if s.RestrictSystemAdmin == nil {
		s.RestrictSystemAdmin = NewBool(false)
	}

	if s.CloudUserLimit == nil {
		// User limit 0 is treated as no limit
		s.CloudUserLimit = NewInt64(0)
	}

	if s.CloudBilling == nil {
		s.CloudBilling = NewBool(false)
	}

	if s.UseNewSAMLLibrary == nil {
		s.UseNewSAMLLibrary = NewBool(false)
	}

	if s.EnableSharedChannels == nil {
		s.EnableSharedChannels = NewBool(false)
	}
}

type AnalyticsSettings struct {
	MaxUsersForStatistics *int `access:"write_restrictable,cloud_restrictable"`
}

func (s *AnalyticsSettings) SetDefaults() {
	if s.MaxUsersForStatistics == nil {
		s.MaxUsersForStatistics = NewInt(ANALYTICS_SETTINGS_DEFAULT_MAX_USERS_FOR_STATISTICS)
	}
}

type SSOSettings struct {
	Enable            *bool   `access:"authentication"`
	Secret            *string `access:"authentication"`
	Id                *string `access:"authentication"`
	Scope             *string `access:"authentication"`
	AuthEndpoint      *string `access:"authentication"`
	TokenEndpoint     *string `access:"authentication"`
	UserApiEndpoint   *string `access:"authentication"`
	DiscoveryEndpoint *string `access:"authentication"`
	ButtonText        *string `access:"authentication"`
	ButtonColor       *string `access:"authentication"`
}

func (s *SSOSettings) setDefaults(scope, authEndpoint, tokenEndpoint, userApiEndpoint, buttonColor string) {
	if s.Enable == nil {
		s.Enable = NewBool(false)
	}

	if s.Secret == nil {
		s.Secret = NewString("")
	}

	if s.Id == nil {
		s.Id = NewString("")
	}

	if s.Scope == nil {
		s.Scope = NewString(scope)
	}

	if s.DiscoveryEndpoint == nil {
		s.DiscoveryEndpoint = NewString("")
	}

	if s.AuthEndpoint == nil {
		s.AuthEndpoint = NewString(authEndpoint)
	}

	if s.TokenEndpoint == nil {
		s.TokenEndpoint = NewString(tokenEndpoint)
	}

	if s.UserApiEndpoint == nil {
		s.UserApiEndpoint = NewString(userApiEndpoint)
	}

	if s.ButtonText == nil {
		s.ButtonText = NewString("")
	}

	if s.ButtonColor == nil {
		s.ButtonColor = NewString(buttonColor)
	}
}

type Office365Settings struct {
	Enable            *bool   `access:"authentication"`
	Secret            *string `access:"authentication"`
	Id                *string `access:"authentication"`
	Scope             *string `access:"authentication"`
	AuthEndpoint      *string `access:"authentication"`
	TokenEndpoint     *string `access:"authentication"`
	UserApiEndpoint   *string `access:"authentication"`
	DiscoveryEndpoint *string `access:"authentication"`
	DirectoryId       *string `access:"authentication"`
}

func (s *Office365Settings) setDefaults() {
	if s.Enable == nil {
		s.Enable = NewBool(false)
	}

	if s.Id == nil {
		s.Id = NewString("")
	}

	if s.Secret == nil {
		s.Secret = NewString("")
	}

	if s.Scope == nil {
		s.Scope = NewString(OFFICE365_SETTINGS_DEFAULT_SCOPE)
	}

	if s.DiscoveryEndpoint == nil {
		s.DiscoveryEndpoint = NewString("")
	}

	if s.AuthEndpoint == nil {
		s.AuthEndpoint = NewString(OFFICE365_SETTINGS_DEFAULT_AUTH_ENDPOINT)
	}

	if s.TokenEndpoint == nil {
		s.TokenEndpoint = NewString(OFFICE365_SETTINGS_DEFAULT_TOKEN_ENDPOINT)
	}

	if s.UserApiEndpoint == nil {
		s.UserApiEndpoint = NewString(OFFICE365_SETTINGS_DEFAULT_USER_API_ENDPOINT)
	}

	if s.DirectoryId == nil {
		s.DirectoryId = NewString("")
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
	ssoSettings.UserApiEndpoint = s.UserApiEndpoint
	return &ssoSettings
}

type SqlSettings struct {
	DriverName                  *string  `access:"environment,write_restrictable,cloud_restrictable"`
	DataSource                  *string  `access:"environment,write_restrictable,cloud_restrictable"`
	DataSourceReplicas          []string `access:"environment,write_restrictable,cloud_restrictable"`
	DataSourceSearchReplicas    []string `access:"environment,write_restrictable,cloud_restrictable"`
	MaxIdleConns                *int     `access:"environment,write_restrictable,cloud_restrictable"`
	ConnMaxLifetimeMilliseconds *int     `access:"environment,write_restrictable,cloud_restrictable"`
	ConnMaxIdleTimeMilliseconds *int     `access:"environment,write_restrictable,cloud_restrictable"`
	MaxOpenConns                *int     `access:"environment,write_restrictable,cloud_restrictable"`
	Trace                       *bool    `access:"environment,write_restrictable,cloud_restrictable"`
	AtRestEncryptKey            *string  `access:"environment,write_restrictable,cloud_restrictable"`
	QueryTimeout                *int     `access:"environment,write_restrictable,cloud_restrictable"`
	DisableDatabaseSearch       *bool    `access:"environment,write_restrictable,cloud_restrictable"`
}

func (s *SqlSettings) SetDefaults(isUpdate bool) {
	if s.DriverName == nil {
		s.DriverName = NewString(DATABASE_DRIVER_POSTGRES)
	}

	if s.DataSource == nil {
		s.DataSource = NewString(SQL_SETTINGS_DEFAULT_DATA_SOURCE)
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
			s.AtRestEncryptKey = NewString(NewRandomString(32))
		}
	} else {
		// When generating a blank configuration, leave this key empty to be generated on server start.
		s.AtRestEncryptKey = NewString("")
	}

	if s.MaxIdleConns == nil {
		s.MaxIdleConns = NewInt(20)
	}

	if s.MaxOpenConns == nil {
		s.MaxOpenConns = NewInt(300)
	}

	if s.ConnMaxLifetimeMilliseconds == nil {
		s.ConnMaxLifetimeMilliseconds = NewInt(3600000)
	}

	if s.ConnMaxIdleTimeMilliseconds == nil {
		s.ConnMaxIdleTimeMilliseconds = NewInt(300000)
	}

	if s.Trace == nil {
		s.Trace = NewBool(false)
	}

	if s.QueryTimeout == nil {
		s.QueryTimeout = NewInt(30)
	}

	if s.DisableDatabaseSearch == nil {
		s.DisableDatabaseSearch = NewBool(false)
	}
}

type LogSettings struct {
	EnableConsole          *bool   `access:"environment,write_restrictable,cloud_restrictable"`
	ConsoleLevel           *string `access:"environment,write_restrictable,cloud_restrictable"`
	ConsoleJson            *bool   `access:"environment,write_restrictable,cloud_restrictable"`
	EnableFile             *bool   `access:"environment,write_restrictable,cloud_restrictable"`
	FileLevel              *string `access:"environment,write_restrictable,cloud_restrictable"`
	FileJson               *bool   `access:"environment,write_restrictable,cloud_restrictable"`
	FileLocation           *string `access:"environment,write_restrictable,cloud_restrictable"`
	EnableWebhookDebugging *bool   `access:"environment,write_restrictable,cloud_restrictable"`
	EnableDiagnostics      *bool   `access:"environment,write_restrictable,cloud_restrictable"`
	EnableSentry           *bool   `access:"environment,write_restrictable,cloud_restrictable"`
	AdvancedLoggingConfig  *string `access:"environment,write_restrictable,cloud_restrictable"`
}

func (s *LogSettings) SetDefaults() {
	if s.EnableConsole == nil {
		s.EnableConsole = NewBool(true)
	}

	if s.ConsoleLevel == nil {
		s.ConsoleLevel = NewString("DEBUG")
	}

	if s.EnableFile == nil {
		s.EnableFile = NewBool(true)
	}

	if s.FileLevel == nil {
		s.FileLevel = NewString("INFO")
	}

	if s.FileLocation == nil {
		s.FileLocation = NewString("")
	}

	if s.EnableWebhookDebugging == nil {
		s.EnableWebhookDebugging = NewBool(true)
	}

	if s.EnableDiagnostics == nil {
		s.EnableDiagnostics = NewBool(true)
	}

	if s.EnableSentry == nil {
		s.EnableSentry = NewBool(*s.EnableDiagnostics)
	}

	if s.ConsoleJson == nil {
		s.ConsoleJson = NewBool(true)
	}

	if s.FileJson == nil {
		s.FileJson = NewBool(true)
	}

	if s.AdvancedLoggingConfig == nil {
		s.AdvancedLoggingConfig = NewString("")
	}
}

type ExperimentalAuditSettings struct {
	FileEnabled           *bool   `access:"experimental,write_restrictable,cloud_restrictable"`
	FileName              *string `access:"experimental,write_restrictable,cloud_restrictable"`
	FileMaxSizeMB         *int    `access:"experimental,write_restrictable,cloud_restrictable"`
	FileMaxAgeDays        *int    `access:"experimental,write_restrictable,cloud_restrictable"`
	FileMaxBackups        *int    `access:"experimental,write_restrictable,cloud_restrictable"`
	FileCompress          *bool   `access:"experimental,write_restrictable,cloud_restrictable"`
	FileMaxQueueSize      *int    `access:"experimental,write_restrictable,cloud_restrictable"`
	AdvancedLoggingConfig *string `access:"experimental,write_restrictable,cloud_restrictable"`
}

func (s *ExperimentalAuditSettings) SetDefaults() {
	if s.FileEnabled == nil {
		s.FileEnabled = NewBool(false)
	}

	if s.FileName == nil {
		s.FileName = NewString("")
	}

	if s.FileMaxSizeMB == nil {
		s.FileMaxSizeMB = NewInt(100)
	}

	if s.FileMaxAgeDays == nil {
		s.FileMaxAgeDays = NewInt(0) // no limit on age
	}

	if s.FileMaxBackups == nil { // no limit on number of backups
		s.FileMaxBackups = NewInt(0)
	}

	if s.FileCompress == nil {
		s.FileCompress = NewBool(false)
	}

	if s.FileMaxQueueSize == nil {
		s.FileMaxQueueSize = NewInt(1000)
	}

	if s.AdvancedLoggingConfig == nil {
		s.AdvancedLoggingConfig = NewString("")
	}
}

type NotificationLogSettings struct {
	EnableConsole         *bool   `access:"write_restrictable,cloud_restrictable"`
	ConsoleLevel          *string `access:"write_restrictable,cloud_restrictable"`
	ConsoleJson           *bool   `access:"write_restrictable,cloud_restrictable"`
	EnableFile            *bool   `access:"write_restrictable,cloud_restrictable"`
	FileLevel             *string `access:"write_restrictable,cloud_restrictable"`
	FileJson              *bool   `access:"write_restrictable,cloud_restrictable"`
	FileLocation          *string `access:"write_restrictable,cloud_restrictable"`
	AdvancedLoggingConfig *string `access:"write_restrictable,cloud_restrictable"`
}

func (s *NotificationLogSettings) SetDefaults() {
	if s.EnableConsole == nil {
		s.EnableConsole = NewBool(true)
	}

	if s.ConsoleLevel == nil {
		s.ConsoleLevel = NewString("DEBUG")
	}

	if s.EnableFile == nil {
		s.EnableFile = NewBool(true)
	}

	if s.FileLevel == nil {
		s.FileLevel = NewString("INFO")
	}

	if s.FileLocation == nil {
		s.FileLocation = NewString("")
	}

	if s.ConsoleJson == nil {
		s.ConsoleJson = NewBool(true)
	}

	if s.FileJson == nil {
		s.FileJson = NewBool(true)
	}

	if s.AdvancedLoggingConfig == nil {
		s.AdvancedLoggingConfig = NewString("")
	}
}

type PasswordSettings struct {
	MinimumLength *int  `access:"authentication"`
	Lowercase     *bool `access:"authentication"`
	Number        *bool `access:"authentication"`
	Uppercase     *bool `access:"authentication"`
	Symbol        *bool `access:"authentication"`
}

func (s *PasswordSettings) SetDefaults() {
	if s.MinimumLength == nil {
		s.MinimumLength = NewInt(10)
	}

	if s.Lowercase == nil {
		s.Lowercase = NewBool(true)
	}

	if s.Number == nil {
		s.Number = NewBool(true)
	}

	if s.Uppercase == nil {
		s.Uppercase = NewBool(true)
	}

	if s.Symbol == nil {
		s.Symbol = NewBool(true)
	}
}

type FileSettings struct {
	EnableFileAttachments   *bool   `access:"site,cloud_restrictable"`
	EnableMobileUpload      *bool   `access:"site,cloud_restrictable"`
	EnableMobileDownload    *bool   `access:"site,cloud_restrictable"`
	MaxFileSize             *int64  `access:"environment,cloud_restrictable"`
	DriverName              *string `access:"environment,write_restrictable,cloud_restrictable"`
	Directory               *string `access:"environment,write_restrictable,cloud_restrictable"`
	EnablePublicLink        *bool   `access:"site,cloud_restrictable"`
	PublicLinkSalt          *string `access:"site,cloud_restrictable"`
	InitialFont             *string `access:"environment,cloud_restrictable"`
	AmazonS3AccessKeyId     *string `access:"environment,write_restrictable,cloud_restrictable"`
	AmazonS3SecretAccessKey *string `access:"environment,write_restrictable,cloud_restrictable"`
	AmazonS3Bucket          *string `access:"environment,write_restrictable,cloud_restrictable"`
	AmazonS3PathPrefix      *string `access:"environment,write_restrictable,cloud_restrictable"`
	AmazonS3Region          *string `access:"environment,write_restrictable,cloud_restrictable"`
	AmazonS3Endpoint        *string `access:"environment,write_restrictable,cloud_restrictable"`
	AmazonS3SSL             *bool   `access:"environment,write_restrictable,cloud_restrictable"`
	AmazonS3SignV2          *bool   `access:"environment,write_restrictable,cloud_restrictable"`
	AmazonS3SSE             *bool   `access:"environment,write_restrictable,cloud_restrictable"`
	AmazonS3Trace           *bool   `access:"environment,write_restrictable,cloud_restrictable"`
}

func (s *FileSettings) SetDefaults(isUpdate bool) {
	if s.EnableFileAttachments == nil {
		s.EnableFileAttachments = NewBool(true)
	}

	if s.EnableMobileUpload == nil {
		s.EnableMobileUpload = NewBool(true)
	}

	if s.EnableMobileDownload == nil {
		s.EnableMobileDownload = NewBool(true)
	}

	if s.MaxFileSize == nil {
		s.MaxFileSize = NewInt64(MB * 100)
	}

	if s.DriverName == nil {
		s.DriverName = NewString(IMAGE_DRIVER_LOCAL)
	}

	if s.Directory == nil || *s.Directory == "" {
		s.Directory = NewString(FILE_SETTINGS_DEFAULT_DIRECTORY)
	}

	if s.EnablePublicLink == nil {
		s.EnablePublicLink = NewBool(false)
	}

	if isUpdate {
		// When updating an existing configuration, ensure link salt has been specified.
		if s.PublicLinkSalt == nil || *s.PublicLinkSalt == "" {
			s.PublicLinkSalt = NewString(NewRandomString(32))
		}
	} else {
		// When generating a blank configuration, leave link salt empty to be generated on server start.
		s.PublicLinkSalt = NewString("")
	}

	if s.InitialFont == nil {
		// Defaults to "nunito-bold.ttf"
		s.InitialFont = NewString("nunito-bold.ttf")
	}

	if s.AmazonS3AccessKeyId == nil {
		s.AmazonS3AccessKeyId = NewString("")
	}

	if s.AmazonS3SecretAccessKey == nil {
		s.AmazonS3SecretAccessKey = NewString("")
	}

	if s.AmazonS3Bucket == nil {
		s.AmazonS3Bucket = NewString("")
	}

	if s.AmazonS3PathPrefix == nil {
		s.AmazonS3PathPrefix = NewString("")
	}

	if s.AmazonS3Region == nil {
		s.AmazonS3Region = NewString("")
	}

	if s.AmazonS3Endpoint == nil || *s.AmazonS3Endpoint == "" {
		// Defaults to "s3.amazonaws.com"
		s.AmazonS3Endpoint = NewString("s3.amazonaws.com")
	}

	if s.AmazonS3SSL == nil {
		s.AmazonS3SSL = NewBool(true) // Secure by default.
	}

	if s.AmazonS3SignV2 == nil {
		s.AmazonS3SignV2 = new(bool)
		// Signature v2 is not enabled by default.
	}

	if s.AmazonS3SSE == nil {
		s.AmazonS3SSE = NewBool(false) // Not Encrypted by default.
	}

	if s.AmazonS3Trace == nil {
		s.AmazonS3Trace = NewBool(false)
	}
}

type EmailSettings struct {
	EnableSignUpWithEmail             *bool   `access:"authentication"`
	EnableSignInWithEmail             *bool   `access:"authentication"`
	EnableSignInWithUsername          *bool   `access:"authentication"`
	SendEmailNotifications            *bool   `access:"site"`
	UseChannelInEmailNotifications    *bool   `access:"experimental"`
	RequireEmailVerification          *bool   `access:"authentication"`
	FeedbackName                      *string `access:"site"`
	FeedbackEmail                     *string `access:"site,cloud_restrictable"`
	ReplyToAddress                    *string `access:"site,cloud_restrictable"`
	FeedbackOrganization              *string `access:"site"`
	EnableSMTPAuth                    *bool   `access:"environment,write_restrictable,cloud_restrictable"`
	SMTPUsername                      *string `access:"environment,write_restrictable,cloud_restrictable"`
	SMTPPassword                      *string `access:"environment,write_restrictable,cloud_restrictable"`
	SMTPServer                        *string `access:"environment,write_restrictable,cloud_restrictable"`
	SMTPPort                          *string `access:"environment,write_restrictable,cloud_restrictable"`
	SMTPServerTimeout                 *int    `access:"cloud_restrictable"`
	ConnectionSecurity                *string `access:"environment,write_restrictable,cloud_restrictable"`
	SendPushNotifications             *bool   `access:"environment"`
	PushNotificationServer            *string `access:"environment"`
	PushNotificationContents          *string `access:"site"`
	PushNotificationBuffer            *int
	EnableEmailBatching               *bool   `access:"site"`
	EmailBatchingBufferSize           *int    `access:"experimental"`
	EmailBatchingInterval             *int    `access:"experimental"`
	EnablePreviewModeBanner           *bool   `access:"site"`
	SkipServerCertificateVerification *bool   `access:"environment,write_restrictable,cloud_restrictable"`
	EmailNotificationContentsType     *string `access:"site"`
	LoginButtonColor                  *string `access:"experimental"`
	LoginButtonBorderColor            *string `access:"experimental"`
	LoginButtonTextColor              *string `access:"experimental"`
}

func (s *EmailSettings) SetDefaults(isUpdate bool) {
	if s.EnableSignUpWithEmail == nil {
		s.EnableSignUpWithEmail = NewBool(true)
	}

	if s.EnableSignInWithEmail == nil {
		s.EnableSignInWithEmail = NewBool(*s.EnableSignUpWithEmail)
	}

	if s.EnableSignInWithUsername == nil {
		s.EnableSignInWithUsername = NewBool(true)
	}

	if s.SendEmailNotifications == nil {
		s.SendEmailNotifications = NewBool(true)
	}

	if s.UseChannelInEmailNotifications == nil {
		s.UseChannelInEmailNotifications = NewBool(false)
	}

	if s.RequireEmailVerification == nil {
		s.RequireEmailVerification = NewBool(false)
	}

	if s.FeedbackName == nil {
		s.FeedbackName = NewString("")
	}

	if s.FeedbackEmail == nil {
		s.FeedbackEmail = NewString("test@example.com")
	}

	if s.ReplyToAddress == nil {
		s.ReplyToAddress = NewString("test@example.com")
	}

	if s.FeedbackOrganization == nil {
		s.FeedbackOrganization = NewString(EMAIL_SETTINGS_DEFAULT_FEEDBACK_ORGANIZATION)
	}

	if s.EnableSMTPAuth == nil {
		if s.ConnectionSecurity == nil || *s.ConnectionSecurity == CONN_SECURITY_NONE {
			s.EnableSMTPAuth = NewBool(false)
		} else {
			s.EnableSMTPAuth = NewBool(true)
		}
	}

	if s.SMTPUsername == nil {
		s.SMTPUsername = NewString("")
	}

	if s.SMTPPassword == nil {
		s.SMTPPassword = NewString("")
	}

	if s.SMTPServer == nil || *s.SMTPServer == "" {
		s.SMTPServer = NewString("localhost")
	}

	if s.SMTPPort == nil || *s.SMTPPort == "" {
		s.SMTPPort = NewString("10025")
	}

	if s.SMTPServerTimeout == nil || *s.SMTPServerTimeout == 0 {
		s.SMTPServerTimeout = NewInt(10)
	}

	if s.ConnectionSecurity == nil || *s.ConnectionSecurity == CONN_SECURITY_PLAIN {
		s.ConnectionSecurity = NewString(CONN_SECURITY_NONE)
	}

	if s.SendPushNotifications == nil {
		s.SendPushNotifications = NewBool(!isUpdate)
	}

	if s.PushNotificationServer == nil {
		if isUpdate {
			s.PushNotificationServer = NewString("")
		} else {
			s.PushNotificationServer = NewString(GENERIC_NOTIFICATION_SERVER)
		}
	}

	if s.PushNotificationContents == nil {
		s.PushNotificationContents = NewString(FULL_NOTIFICATION)
	}

	if s.PushNotificationBuffer == nil {
		s.PushNotificationBuffer = NewInt(1000)
	}

	if s.EnableEmailBatching == nil {
		s.EnableEmailBatching = NewBool(false)
	}

	if s.EmailBatchingBufferSize == nil {
		s.EmailBatchingBufferSize = NewInt(EMAIL_BATCHING_BUFFER_SIZE)
	}

	if s.EmailBatchingInterval == nil {
		s.EmailBatchingInterval = NewInt(EMAIL_BATCHING_INTERVAL)
	}

	if s.EnablePreviewModeBanner == nil {
		s.EnablePreviewModeBanner = NewBool(true)
	}

	if s.EnableSMTPAuth == nil {
		if *s.ConnectionSecurity == CONN_SECURITY_NONE {
			s.EnableSMTPAuth = NewBool(false)
		} else {
			s.EnableSMTPAuth = NewBool(true)
		}
	}

	if *s.ConnectionSecurity == CONN_SECURITY_PLAIN {
		*s.ConnectionSecurity = CONN_SECURITY_NONE
	}

	if s.SkipServerCertificateVerification == nil {
		s.SkipServerCertificateVerification = NewBool(false)
	}

	if s.EmailNotificationContentsType == nil {
		s.EmailNotificationContentsType = NewString(EMAIL_NOTIFICATION_CONTENTS_FULL)
	}

	if s.LoginButtonColor == nil {
		s.LoginButtonColor = NewString("#0000")
	}

	if s.LoginButtonBorderColor == nil {
		s.LoginButtonBorderColor = NewString("#2389D7")
	}

	if s.LoginButtonTextColor == nil {
		s.LoginButtonTextColor = NewString("#2389D7")
	}
}

type RateLimitSettings struct {
	Enable           *bool  `access:"environment,write_restrictable,cloud_restrictable"`
	PerSec           *int   `access:"environment,write_restrictable,cloud_restrictable"`
	MaxBurst         *int   `access:"environment,write_restrictable,cloud_restrictable"`
	MemoryStoreSize  *int   `access:"environment,write_restrictable,cloud_restrictable"`
	VaryByRemoteAddr *bool  `access:"environment,write_restrictable,cloud_restrictable"`
	VaryByUser       *bool  `access:"environment,write_restrictable,cloud_restrictable"`
	VaryByHeader     string `access:"environment,write_restrictable,cloud_restrictable"`
}

func (s *RateLimitSettings) SetDefaults() {
	if s.Enable == nil {
		s.Enable = NewBool(false)
	}

	if s.PerSec == nil {
		s.PerSec = NewInt(10)
	}

	if s.MaxBurst == nil {
		s.MaxBurst = NewInt(100)
	}

	if s.MemoryStoreSize == nil {
		s.MemoryStoreSize = NewInt(10000)
	}

	if s.VaryByRemoteAddr == nil {
		s.VaryByRemoteAddr = NewBool(true)
	}

	if s.VaryByUser == nil {
		s.VaryByUser = NewBool(false)
	}
}

type PrivacySettings struct {
	ShowEmailAddress *bool `access:"site"`
	ShowFullName     *bool `access:"site"`
}

func (s *PrivacySettings) setDefaults() {
	if s.ShowEmailAddress == nil {
		s.ShowEmailAddress = NewBool(true)
	}

	if s.ShowFullName == nil {
		s.ShowFullName = NewBool(true)
	}
}

type SupportSettings struct {
	TermsOfServiceLink                     *string `access:"site,write_restrictable,cloud_restrictable"`
	PrivacyPolicyLink                      *string `access:"site,write_restrictable,cloud_restrictable"`
	AboutLink                              *string `access:"site,write_restrictable,cloud_restrictable"`
	HelpLink                               *string `access:"site,write_restrictable,cloud_restrictable"`
	ReportAProblemLink                     *string `access:"site,write_restrictable,cloud_restrictable"`
	SupportEmail                           *string `access:"site"`
	CustomTermsOfServiceEnabled            *bool   `access:"compliance"`
	CustomTermsOfServiceReAcceptancePeriod *int    `access:"compliance"`
	EnableAskCommunityLink                 *bool   `access:"site"`
}

func (s *SupportSettings) SetDefaults() {
	if !IsSafeLink(s.TermsOfServiceLink) {
		*s.TermsOfServiceLink = SUPPORT_SETTINGS_DEFAULT_TERMS_OF_SERVICE_LINK
	}

	if s.TermsOfServiceLink == nil {
		s.TermsOfServiceLink = NewString(SUPPORT_SETTINGS_DEFAULT_TERMS_OF_SERVICE_LINK)
	}

	if !IsSafeLink(s.PrivacyPolicyLink) {
		*s.PrivacyPolicyLink = ""
	}

	if s.PrivacyPolicyLink == nil {
		s.PrivacyPolicyLink = NewString(SUPPORT_SETTINGS_DEFAULT_PRIVACY_POLICY_LINK)
	}

	if !IsSafeLink(s.AboutLink) {
		*s.AboutLink = ""
	}

	if s.AboutLink == nil {
		s.AboutLink = NewString(SUPPORT_SETTINGS_DEFAULT_ABOUT_LINK)
	}

	if !IsSafeLink(s.HelpLink) {
		*s.HelpLink = ""
	}

	if s.HelpLink == nil {
		s.HelpLink = NewString(SUPPORT_SETTINGS_DEFAULT_HELP_LINK)
	}

	if !IsSafeLink(s.ReportAProblemLink) {
		*s.ReportAProblemLink = ""
	}

	if s.ReportAProblemLink == nil {
		s.ReportAProblemLink = NewString(SUPPORT_SETTINGS_DEFAULT_REPORT_A_PROBLEM_LINK)
	}

	if s.SupportEmail == nil {
		s.SupportEmail = NewString(SUPPORT_SETTINGS_DEFAULT_SUPPORT_EMAIL)
	}

	if s.CustomTermsOfServiceEnabled == nil {
		s.CustomTermsOfServiceEnabled = NewBool(false)
	}

	if s.CustomTermsOfServiceReAcceptancePeriod == nil {
		s.CustomTermsOfServiceReAcceptancePeriod = NewInt(SUPPORT_SETTINGS_DEFAULT_RE_ACCEPTANCE_PERIOD)
	}

	if s.EnableAskCommunityLink == nil {
		s.EnableAskCommunityLink = NewBool(true)
	}
}

type AnnouncementSettings struct {
	EnableBanner          *bool   `access:"site"`
	BannerText            *string `access:"site"`
	BannerColor           *string `access:"site"`
	BannerTextColor       *string `access:"site"`
	AllowBannerDismissal  *bool   `access:"site"`
	AdminNoticesEnabled   *bool   `access:"site"`
	UserNoticesEnabled    *bool   `access:"site"`
	NoticesURL            *string `access:"site,write_restrictable"`
	NoticesFetchFrequency *int    `access:"site,write_restrictable"`
	NoticesSkipCache      *bool   `access:"site,write_restrictable"`
}

func (s *AnnouncementSettings) SetDefaults() {
	if s.EnableBanner == nil {
		s.EnableBanner = NewBool(false)
	}

	if s.BannerText == nil {
		s.BannerText = NewString("")
	}

	if s.BannerColor == nil {
		s.BannerColor = NewString(ANNOUNCEMENT_SETTINGS_DEFAULT_BANNER_COLOR)
	}

	if s.BannerTextColor == nil {
		s.BannerTextColor = NewString(ANNOUNCEMENT_SETTINGS_DEFAULT_BANNER_TEXT_COLOR)
	}

	if s.AllowBannerDismissal == nil {
		s.AllowBannerDismissal = NewBool(true)
	}

	if s.AdminNoticesEnabled == nil {
		s.AdminNoticesEnabled = NewBool(true)
	}

	if s.UserNoticesEnabled == nil {
		s.UserNoticesEnabled = NewBool(true)
	}
	if s.NoticesURL == nil {
		s.NoticesURL = NewString(ANNOUNCEMENT_SETTINGS_DEFAULT_NOTICES_JSON_URL)
	}
	if s.NoticesSkipCache == nil {
		s.NoticesSkipCache = NewBool(false)
	}
	if s.NoticesFetchFrequency == nil {
		s.NoticesFetchFrequency = NewInt(ANNOUNCEMENT_SETTINGS_DEFAULT_NOTICES_FETCH_FREQUENCY_SECONDS)
	}

}

type ThemeSettings struct {
	EnableThemeSelection *bool   `access:"experimental"`
	DefaultTheme         *string `access:"experimental"`
	AllowCustomThemes    *bool   `access:"experimental"`
	AllowedThemes        []string
}

func (s *ThemeSettings) SetDefaults() {
	if s.EnableThemeSelection == nil {
		s.EnableThemeSelection = NewBool(true)
	}

	if s.DefaultTheme == nil {
		s.DefaultTheme = NewString(TEAM_SETTINGS_DEFAULT_TEAM_TEXT)
	}

	if s.AllowCustomThemes == nil {
		s.AllowCustomThemes = NewBool(true)
	}

	if s.AllowedThemes == nil {
		s.AllowedThemes = []string{}
	}
}

type TeamSettings struct {
	SiteName                                                  *string  `access:"site"`
	MaxUsersPerTeam                                           *int     `access:"site"`
	DEPRECATED_DO_NOT_USE_EnableTeamCreation                  *bool    `json:"EnableTeamCreation" mapstructure:"EnableTeamCreation"` // This field is deprecated and must not be used.
	EnableUserCreation                                        *bool    `access:"authentication"`
	EnableOpenServer                                          *bool    `access:"authentication"`
	EnableUserDeactivation                                    *bool    `access:"experimental"`
	RestrictCreationToDomains                                 *string  `access:"authentication"`
	EnableCustomBrand                                         *bool    `access:"site"`
	CustomBrandText                                           *string  `access:"site"`
	CustomDescriptionText                                     *string  `access:"site"`
	RestrictDirectMessage                                     *string  `access:"site"`
	DEPRECATED_DO_NOT_USE_RestrictTeamInvite                  *string  `json:"RestrictTeamInvite" mapstructure:"RestrictTeamInvite"`                                   // This field is deprecated and must not be used.
	DEPRECATED_DO_NOT_USE_RestrictPublicChannelManagement     *string  `json:"RestrictPublicChannelManagement" mapstructure:"RestrictPublicChannelManagement"`         // This field is deprecated and must not be used.
	DEPRECATED_DO_NOT_USE_RestrictPrivateChannelManagement    *string  `json:"RestrictPrivateChannelManagement" mapstructure:"RestrictPrivateChannelManagement"`       // This field is deprecated and must not be used.
	DEPRECATED_DO_NOT_USE_RestrictPublicChannelCreation       *string  `json:"RestrictPublicChannelCreation" mapstructure:"RestrictPublicChannelCreation"`             // This field is deprecated and must not be used.
	DEPRECATED_DO_NOT_USE_RestrictPrivateChannelCreation      *string  `json:"RestrictPrivateChannelCreation" mapstructure:"RestrictPrivateChannelCreation"`           // This field is deprecated and must not be used.
	DEPRECATED_DO_NOT_USE_RestrictPublicChannelDeletion       *string  `json:"RestrictPublicChannelDeletion" mapstructure:"RestrictPublicChannelDeletion"`             // This field is deprecated and must not be used.
	DEPRECATED_DO_NOT_USE_RestrictPrivateChannelDeletion      *string  `json:"RestrictPrivateChannelDeletion" mapstructure:"RestrictPrivateChannelDeletion"`           // This field is deprecated and must not be used.
	DEPRECATED_DO_NOT_USE_RestrictPrivateChannelManageMembers *string  `json:"RestrictPrivateChannelManageMembers" mapstructure:"RestrictPrivateChannelManageMembers"` // This field is deprecated and must not be used.
	EnableXToLeaveChannelsFromLHS                             *bool    `access:"experimental"`
	UserStatusAwayTimeout                                     *int64   `access:"experimental"`
	MaxChannelsPerTeam                                        *int64   `access:"site"`
	MaxNotificationsPerChannel                                *int64   `access:"environment"`
	EnableConfirmNotificationsToChannel                       *bool    `access:"site"`
	TeammateNameDisplay                                       *string  `access:"site"`
	ExperimentalViewArchivedChannels                          *bool    `access:"experimental,site"`
	ExperimentalEnableAutomaticReplies                        *bool    `access:"experimental"`
	ExperimentalHideTownSquareinLHS                           *bool    `access:"experimental"`
	ExperimentalTownSquareIsReadOnly                          *bool    `access:"experimental"`
	LockTeammateNameDisplay                                   *bool    `access:"site"`
	ExperimentalPrimaryTeam                                   *string  `access:"experimental"`
	ExperimentalDefaultChannels                               []string `access:"experimental"`
}

func (s *TeamSettings) SetDefaults() {

	if s.SiteName == nil || *s.SiteName == "" {
		s.SiteName = NewString(TEAM_SETTINGS_DEFAULT_SITE_NAME)
	}

	if s.MaxUsersPerTeam == nil {
		s.MaxUsersPerTeam = NewInt(TEAM_SETTINGS_DEFAULT_MAX_USERS_PER_TEAM)
	}

	if s.DEPRECATED_DO_NOT_USE_EnableTeamCreation == nil {
		s.DEPRECATED_DO_NOT_USE_EnableTeamCreation = NewBool(true)
	}

	if s.EnableUserCreation == nil {
		s.EnableUserCreation = NewBool(true)
	}

	if s.EnableOpenServer == nil {
		s.EnableOpenServer = NewBool(false)
	}

	if s.RestrictCreationToDomains == nil {
		s.RestrictCreationToDomains = NewString("")
	}

	if s.EnableCustomBrand == nil {
		s.EnableCustomBrand = NewBool(false)
	}

	if s.EnableUserDeactivation == nil {
		s.EnableUserDeactivation = NewBool(false)
	}

	if s.CustomBrandText == nil {
		s.CustomBrandText = NewString(TEAM_SETTINGS_DEFAULT_CUSTOM_BRAND_TEXT)
	}

	if s.CustomDescriptionText == nil {
		s.CustomDescriptionText = NewString(TEAM_SETTINGS_DEFAULT_CUSTOM_DESCRIPTION_TEXT)
	}

	if s.RestrictDirectMessage == nil {
		s.RestrictDirectMessage = NewString(DIRECT_MESSAGE_ANY)
	}

	if s.DEPRECATED_DO_NOT_USE_RestrictTeamInvite == nil {
		s.DEPRECATED_DO_NOT_USE_RestrictTeamInvite = NewString(PERMISSIONS_ALL)
	}

	if s.DEPRECATED_DO_NOT_USE_RestrictPublicChannelManagement == nil {
		s.DEPRECATED_DO_NOT_USE_RestrictPublicChannelManagement = NewString(PERMISSIONS_ALL)
	}

	if s.DEPRECATED_DO_NOT_USE_RestrictPrivateChannelManagement == nil {
		s.DEPRECATED_DO_NOT_USE_RestrictPrivateChannelManagement = NewString(PERMISSIONS_ALL)
	}

	if s.DEPRECATED_DO_NOT_USE_RestrictPublicChannelCreation == nil {
		s.DEPRECATED_DO_NOT_USE_RestrictPublicChannelCreation = new(string)
		// If this setting does not exist, assume migration from <3.6, so use management setting as default.
		if *s.DEPRECATED_DO_NOT_USE_RestrictPublicChannelManagement == PERMISSIONS_CHANNEL_ADMIN {
			*s.DEPRECATED_DO_NOT_USE_RestrictPublicChannelCreation = PERMISSIONS_TEAM_ADMIN
		} else {
			*s.DEPRECATED_DO_NOT_USE_RestrictPublicChannelCreation = *s.DEPRECATED_DO_NOT_USE_RestrictPublicChannelManagement
		}
	}

	if s.DEPRECATED_DO_NOT_USE_RestrictPrivateChannelCreation == nil {
		// If this setting does not exist, assume migration from <3.6, so use management setting as default.
		if *s.DEPRECATED_DO_NOT_USE_RestrictPrivateChannelManagement == PERMISSIONS_CHANNEL_ADMIN {
			s.DEPRECATED_DO_NOT_USE_RestrictPrivateChannelCreation = NewString(PERMISSIONS_TEAM_ADMIN)
		} else {
			s.DEPRECATED_DO_NOT_USE_RestrictPrivateChannelCreation = NewString(*s.DEPRECATED_DO_NOT_USE_RestrictPrivateChannelManagement)
		}
	}

	if s.DEPRECATED_DO_NOT_USE_RestrictPublicChannelDeletion == nil {
		// If this setting does not exist, assume migration from <3.6, so use management setting as default.
		s.DEPRECATED_DO_NOT_USE_RestrictPublicChannelDeletion = NewString(*s.DEPRECATED_DO_NOT_USE_RestrictPublicChannelManagement)
	}

	if s.DEPRECATED_DO_NOT_USE_RestrictPrivateChannelDeletion == nil {
		// If this setting does not exist, assume migration from <3.6, so use management setting as default.
		s.DEPRECATED_DO_NOT_USE_RestrictPrivateChannelDeletion = NewString(*s.DEPRECATED_DO_NOT_USE_RestrictPrivateChannelManagement)
	}

	if s.DEPRECATED_DO_NOT_USE_RestrictPrivateChannelManageMembers == nil {
		s.DEPRECATED_DO_NOT_USE_RestrictPrivateChannelManageMembers = NewString(PERMISSIONS_ALL)
	}

	if s.EnableXToLeaveChannelsFromLHS == nil {
		s.EnableXToLeaveChannelsFromLHS = NewBool(false)
	}

	if s.UserStatusAwayTimeout == nil {
		s.UserStatusAwayTimeout = NewInt64(TEAM_SETTINGS_DEFAULT_USER_STATUS_AWAY_TIMEOUT)
	}

	if s.MaxChannelsPerTeam == nil {
		s.MaxChannelsPerTeam = NewInt64(2000)
	}

	if s.MaxNotificationsPerChannel == nil {
		s.MaxNotificationsPerChannel = NewInt64(1000)
	}

	if s.EnableConfirmNotificationsToChannel == nil {
		s.EnableConfirmNotificationsToChannel = NewBool(true)
	}

	if s.ExperimentalEnableAutomaticReplies == nil {
		s.ExperimentalEnableAutomaticReplies = NewBool(false)
	}

	if s.ExperimentalHideTownSquareinLHS == nil {
		s.ExperimentalHideTownSquareinLHS = NewBool(false)
	}

	if s.ExperimentalTownSquareIsReadOnly == nil {
		s.ExperimentalTownSquareIsReadOnly = NewBool(false)
	}

	if s.ExperimentalPrimaryTeam == nil {
		s.ExperimentalPrimaryTeam = NewString("")
	}

	if s.ExperimentalDefaultChannels == nil {
		s.ExperimentalDefaultChannels = []string{}
	}

	if s.DEPRECATED_DO_NOT_USE_EnableTeamCreation == nil {
		s.DEPRECATED_DO_NOT_USE_EnableTeamCreation = NewBool(true)
	}

	if s.EnableUserCreation == nil {
		s.EnableUserCreation = NewBool(true)
	}

	if s.ExperimentalViewArchivedChannels == nil {
		s.ExperimentalViewArchivedChannels = NewBool(true)
	}

	if s.LockTeammateNameDisplay == nil {
		s.LockTeammateNameDisplay = NewBool(false)
	}
}

type ClientRequirements struct {
	AndroidLatestVersion string `access:"write_restrictable,cloud_restrictable"`
	AndroidMinVersion    string `access:"write_restrictable,cloud_restrictable"`
	DesktopLatestVersion string `access:"write_restrictable,cloud_restrictable"`
	DesktopMinVersion    string `access:"write_restrictable,cloud_restrictable"`
	IosLatestVersion     string `access:"write_restrictable,cloud_restrictable"`
	IosMinVersion        string `access:"write_restrictable,cloud_restrictable"`
}

type LdapSettings struct {
	// Basic
	Enable             *bool   `access:"authentication"`
	EnableSync         *bool   `access:"authentication"`
	LdapServer         *string `access:"authentication"`
	LdapPort           *int    `access:"authentication"`
	ConnectionSecurity *string `access:"authentication"`
	BaseDN             *string `access:"authentication"`
	BindUsername       *string `access:"authentication"`
	BindPassword       *string `access:"authentication"`

	// Filtering
	UserFilter        *string `access:"authentication"`
	GroupFilter       *string `access:"authentication"`
	GuestFilter       *string `access:"authentication"`
	EnableAdminFilter *bool
	AdminFilter       *string

	// Group Mapping
	GroupDisplayNameAttribute *string `access:"authentication"`
	GroupIdAttribute          *string `access:"authentication"`

	// User Mapping
	FirstNameAttribute *string `access:"authentication"`
	LastNameAttribute  *string `access:"authentication"`
	EmailAttribute     *string `access:"authentication"`
	UsernameAttribute  *string `access:"authentication"`
	NicknameAttribute  *string `access:"authentication"`
	IdAttribute        *string `access:"authentication"`
	PositionAttribute  *string `access:"authentication"`
	LoginIdAttribute   *string `access:"authentication"`
	PictureAttribute   *string `access:"authentication"`

	// Synchronization
	SyncIntervalMinutes *int `access:"authentication"`

	// Advanced
	SkipCertificateVerification *bool   `access:"authentication"`
	PublicCertificateFile       *string `access:"authentication"`
	PrivateKeyFile              *string `access:"authentication"`
	QueryTimeout                *int    `access:"authentication"`
	MaxPageSize                 *int    `access:"authentication"`

	// Customization
	LoginFieldName *string `access:"authentication"`

	LoginButtonColor       *string `access:"authentication"`
	LoginButtonBorderColor *string `access:"authentication"`
	LoginButtonTextColor   *string `access:"authentication"`

	Trace *bool `access:"authentication"`
}

func (s *LdapSettings) SetDefaults() {
	if s.Enable == nil {
		s.Enable = NewBool(false)
	}

	// When unset should default to LDAP Enabled
	if s.EnableSync == nil {
		s.EnableSync = NewBool(*s.Enable)
	}

	if s.EnableAdminFilter == nil {
		s.EnableAdminFilter = NewBool(false)
	}

	if s.LdapServer == nil {
		s.LdapServer = NewString("")
	}

	if s.LdapPort == nil {
		s.LdapPort = NewInt(389)
	}

	if s.ConnectionSecurity == nil {
		s.ConnectionSecurity = NewString("")
	}

	if s.PublicCertificateFile == nil {
		s.PublicCertificateFile = NewString("")
	}

	if s.PrivateKeyFile == nil {
		s.PrivateKeyFile = NewString("")
	}

	if s.BaseDN == nil {
		s.BaseDN = NewString("")
	}

	if s.BindUsername == nil {
		s.BindUsername = NewString("")
	}

	if s.BindPassword == nil {
		s.BindPassword = NewString("")
	}

	if s.UserFilter == nil {
		s.UserFilter = NewString("")
	}

	if s.GuestFilter == nil {
		s.GuestFilter = NewString("")
	}

	if s.AdminFilter == nil {
		s.AdminFilter = NewString("")
	}

	if s.GroupFilter == nil {
		s.GroupFilter = NewString("")
	}

	if s.GroupDisplayNameAttribute == nil {
		s.GroupDisplayNameAttribute = NewString(LDAP_SETTINGS_DEFAULT_GROUP_DISPLAY_NAME_ATTRIBUTE)
	}

	if s.GroupIdAttribute == nil {
		s.GroupIdAttribute = NewString(LDAP_SETTINGS_DEFAULT_GROUP_ID_ATTRIBUTE)
	}

	if s.FirstNameAttribute == nil {
		s.FirstNameAttribute = NewString(LDAP_SETTINGS_DEFAULT_FIRST_NAME_ATTRIBUTE)
	}

	if s.LastNameAttribute == nil {
		s.LastNameAttribute = NewString(LDAP_SETTINGS_DEFAULT_LAST_NAME_ATTRIBUTE)
	}

	if s.EmailAttribute == nil {
		s.EmailAttribute = NewString(LDAP_SETTINGS_DEFAULT_EMAIL_ATTRIBUTE)
	}

	if s.UsernameAttribute == nil {
		s.UsernameAttribute = NewString(LDAP_SETTINGS_DEFAULT_USERNAME_ATTRIBUTE)
	}

	if s.NicknameAttribute == nil {
		s.NicknameAttribute = NewString(LDAP_SETTINGS_DEFAULT_NICKNAME_ATTRIBUTE)
	}

	if s.IdAttribute == nil {
		s.IdAttribute = NewString(LDAP_SETTINGS_DEFAULT_ID_ATTRIBUTE)
	}

	if s.PositionAttribute == nil {
		s.PositionAttribute = NewString(LDAP_SETTINGS_DEFAULT_POSITION_ATTRIBUTE)
	}

	if s.PictureAttribute == nil {
		s.PictureAttribute = NewString(LDAP_SETTINGS_DEFAULT_PICTURE_ATTRIBUTE)
	}

	// For those upgrading to the version when LoginIdAttribute was added
	// they need IdAttribute == LoginIdAttribute not to break
	if s.LoginIdAttribute == nil {
		s.LoginIdAttribute = s.IdAttribute
	}

	if s.SyncIntervalMinutes == nil {
		s.SyncIntervalMinutes = NewInt(60)
	}

	if s.SkipCertificateVerification == nil {
		s.SkipCertificateVerification = NewBool(false)
	}

	if s.QueryTimeout == nil {
		s.QueryTimeout = NewInt(60)
	}

	if s.MaxPageSize == nil {
		s.MaxPageSize = NewInt(0)
	}

	if s.LoginFieldName == nil {
		s.LoginFieldName = NewString(LDAP_SETTINGS_DEFAULT_LOGIN_FIELD_NAME)
	}

	if s.LoginButtonColor == nil {
		s.LoginButtonColor = NewString("#0000")
	}

	if s.LoginButtonBorderColor == nil {
		s.LoginButtonBorderColor = NewString("#2389D7")
	}

	if s.LoginButtonTextColor == nil {
		s.LoginButtonTextColor = NewString("#2389D7")
	}

	if s.Trace == nil {
		s.Trace = NewBool(false)
	}
}

type ComplianceSettings struct {
	Enable      *bool   `access:"compliance"`
	Directory   *string `access:"compliance"`
	EnableDaily *bool   `access:"compliance"`
}

func (s *ComplianceSettings) SetDefaults() {
	if s.Enable == nil {
		s.Enable = NewBool(false)
	}

	if s.Directory == nil {
		s.Directory = NewString("./data/")
	}

	if s.EnableDaily == nil {
		s.EnableDaily = NewBool(false)
	}
}

type LocalizationSettings struct {
	DefaultServerLocale *string `access:"site"`
	DefaultClientLocale *string `access:"site"`
	AvailableLocales    *string `access:"site"`
}

func (s *LocalizationSettings) SetDefaults() {
	if s.DefaultServerLocale == nil {
		s.DefaultServerLocale = NewString(DEFAULT_LOCALE)
	}

	if s.DefaultClientLocale == nil {
		s.DefaultClientLocale = NewString(DEFAULT_LOCALE)
	}

	if s.AvailableLocales == nil {
		s.AvailableLocales = NewString("")
	}
}

type SamlSettings struct {
	// Basic
	Enable                        *bool `access:"authentication"`
	EnableSyncWithLdap            *bool `access:"authentication"`
	EnableSyncWithLdapIncludeAuth *bool `access:"authentication"`
	IgnoreGuestsLdapSync          *bool `access:"authentication"`

	Verify      *bool `access:"authentication"`
	Encrypt     *bool `access:"authentication"`
	SignRequest *bool `access:"authentication"`

	IdpUrl                      *string `access:"authentication"`
	IdpDescriptorUrl            *string `access:"authentication"`
	IdpMetadataUrl              *string `access:"authentication"`
	ServiceProviderIdentifier   *string `access:"authentication"`
	AssertionConsumerServiceURL *string `access:"authentication"`

	SignatureAlgorithm *string `access:"authentication"`
	CanonicalAlgorithm *string `access:"authentication"`

	ScopingIDPProviderId *string `access:"authentication"`
	ScopingIDPName       *string `access:"authentication"`

	IdpCertificateFile    *string `access:"authentication"`
	PublicCertificateFile *string `access:"authentication"`
	PrivateKeyFile        *string `access:"authentication"`

	// User Mapping
	IdAttribute          *string `access:"authentication"`
	GuestAttribute       *string `access:"authentication"`
	EnableAdminAttribute *bool
	AdminAttribute       *string
	FirstNameAttribute   *string `access:"authentication"`
	LastNameAttribute    *string `access:"authentication"`
	EmailAttribute       *string `access:"authentication"`
	UsernameAttribute    *string `access:"authentication"`
	NicknameAttribute    *string `access:"authentication"`
	LocaleAttribute      *string `access:"authentication"`
	PositionAttribute    *string `access:"authentication"`

	LoginButtonText *string `access:"authentication"`

	LoginButtonColor       *string `access:"authentication"`
	LoginButtonBorderColor *string `access:"authentication"`
	LoginButtonTextColor   *string `access:"authentication"`
}

func (s *SamlSettings) SetDefaults() {
	if s.Enable == nil {
		s.Enable = NewBool(false)
	}

	if s.EnableSyncWithLdap == nil {
		s.EnableSyncWithLdap = NewBool(false)
	}

	if s.EnableSyncWithLdapIncludeAuth == nil {
		s.EnableSyncWithLdapIncludeAuth = NewBool(false)
	}

	if s.IgnoreGuestsLdapSync == nil {
		s.IgnoreGuestsLdapSync = NewBool(false)
	}

	if s.EnableAdminAttribute == nil {
		s.EnableAdminAttribute = NewBool(false)
	}

	if s.Verify == nil {
		s.Verify = NewBool(true)
	}

	if s.Encrypt == nil {
		s.Encrypt = NewBool(true)
	}

	if s.SignRequest == nil {
		s.SignRequest = NewBool(false)
	}

	if s.SignatureAlgorithm == nil {
		s.SignatureAlgorithm = NewString(SAML_SETTINGS_DEFAULT_SIGNATURE_ALGORITHM)
	}

	if s.CanonicalAlgorithm == nil {
		s.CanonicalAlgorithm = NewString(SAML_SETTINGS_DEFAULT_CANONICAL_ALGORITHM)
	}

	if s.IdpUrl == nil {
		s.IdpUrl = NewString("")
	}

	if s.IdpDescriptorUrl == nil {
		s.IdpDescriptorUrl = NewString("")
	}

	if s.ServiceProviderIdentifier == nil {
		if s.IdpDescriptorUrl != nil {
			s.ServiceProviderIdentifier = NewString(*s.IdpDescriptorUrl)
		} else {
			s.ServiceProviderIdentifier = NewString("")
		}
	}

	if s.IdpMetadataUrl == nil {
		s.IdpMetadataUrl = NewString("")
	}

	if s.IdpCertificateFile == nil {
		s.IdpCertificateFile = NewString("")
	}

	if s.PublicCertificateFile == nil {
		s.PublicCertificateFile = NewString("")
	}

	if s.PrivateKeyFile == nil {
		s.PrivateKeyFile = NewString("")
	}

	if s.AssertionConsumerServiceURL == nil {
		s.AssertionConsumerServiceURL = NewString("")
	}

	if s.ScopingIDPProviderId == nil {
		s.ScopingIDPProviderId = NewString("")
	}

	if s.ScopingIDPName == nil {
		s.ScopingIDPName = NewString("")
	}

	if s.LoginButtonText == nil || *s.LoginButtonText == "" {
		s.LoginButtonText = NewString(USER_AUTH_SERVICE_SAML_TEXT)
	}

	if s.IdAttribute == nil {
		s.IdAttribute = NewString(SAML_SETTINGS_DEFAULT_ID_ATTRIBUTE)
	}

	if s.GuestAttribute == nil {
		s.GuestAttribute = NewString(SAML_SETTINGS_DEFAULT_GUEST_ATTRIBUTE)
	}
	if s.AdminAttribute == nil {
		s.AdminAttribute = NewString(SAML_SETTINGS_DEFAULT_ADMIN_ATTRIBUTE)
	}
	if s.FirstNameAttribute == nil {
		s.FirstNameAttribute = NewString(SAML_SETTINGS_DEFAULT_FIRST_NAME_ATTRIBUTE)
	}

	if s.LastNameAttribute == nil {
		s.LastNameAttribute = NewString(SAML_SETTINGS_DEFAULT_LAST_NAME_ATTRIBUTE)
	}

	if s.EmailAttribute == nil {
		s.EmailAttribute = NewString(SAML_SETTINGS_DEFAULT_EMAIL_ATTRIBUTE)
	}

	if s.UsernameAttribute == nil {
		s.UsernameAttribute = NewString(SAML_SETTINGS_DEFAULT_USERNAME_ATTRIBUTE)
	}

	if s.NicknameAttribute == nil {
		s.NicknameAttribute = NewString(SAML_SETTINGS_DEFAULT_NICKNAME_ATTRIBUTE)
	}

	if s.PositionAttribute == nil {
		s.PositionAttribute = NewString(SAML_SETTINGS_DEFAULT_POSITION_ATTRIBUTE)
	}

	if s.LocaleAttribute == nil {
		s.LocaleAttribute = NewString(SAML_SETTINGS_DEFAULT_LOCALE_ATTRIBUTE)
	}

	if s.LoginButtonColor == nil {
		s.LoginButtonColor = NewString("#34a28b")
	}

	if s.LoginButtonBorderColor == nil {
		s.LoginButtonBorderColor = NewString("#2389D7")
	}

	if s.LoginButtonTextColor == nil {
		s.LoginButtonTextColor = NewString("#ffffff")
	}
}

type NativeAppSettings struct {
	AppCustomURLSchemes    []string `access:"site,write_restrictable,cloud_restrictable"`
	AppDownloadLink        *string  `access:"site,write_restrictable,cloud_restrictable"`
	AndroidAppDownloadLink *string  `access:"site,write_restrictable,cloud_restrictable"`
	IosAppDownloadLink     *string  `access:"site,write_restrictable,cloud_restrictable"`
}

func (s *NativeAppSettings) SetDefaults() {
	if s.AppDownloadLink == nil {
		s.AppDownloadLink = NewString(NATIVEAPP_SETTINGS_DEFAULT_APP_DOWNLOAD_LINK)
	}

	if s.AndroidAppDownloadLink == nil {
		s.AndroidAppDownloadLink = NewString(NATIVEAPP_SETTINGS_DEFAULT_ANDROID_APP_DOWNLOAD_LINK)
	}

	if s.IosAppDownloadLink == nil {
		s.IosAppDownloadLink = NewString(NATIVEAPP_SETTINGS_DEFAULT_IOS_APP_DOWNLOAD_LINK)
	}

	if s.AppCustomURLSchemes == nil {
		s.AppCustomURLSchemes = GetDefaultAppCustomURLSchemes()
	}
}

type ElasticsearchSettings struct {
	ConnectionUrl                 *string `access:"environment,write_restrictable,cloud_restrictable"`
	Username                      *string `access:"environment,write_restrictable,cloud_restrictable"`
	Password                      *string `access:"environment,write_restrictable,cloud_restrictable"`
	EnableIndexing                *bool   `access:"environment,write_restrictable,cloud_restrictable"`
	EnableSearching               *bool   `access:"environment,write_restrictable,cloud_restrictable"`
	EnableAutocomplete            *bool   `access:"environment,write_restrictable,cloud_restrictable"`
	Sniff                         *bool   `access:"environment,write_restrictable,cloud_restrictable"`
	PostIndexReplicas             *int    `access:"environment,write_restrictable,cloud_restrictable"`
	PostIndexShards               *int    `access:"environment,write_restrictable,cloud_restrictable"`
	ChannelIndexReplicas          *int    `access:"environment,write_restrictable,cloud_restrictable"`
	ChannelIndexShards            *int    `access:"environment,write_restrictable,cloud_restrictable"`
	UserIndexReplicas             *int    `access:"environment,write_restrictable,cloud_restrictable"`
	UserIndexShards               *int    `access:"environment,write_restrictable,cloud_restrictable"`
	AggregatePostsAfterDays       *int    `access:"environment,write_restrictable,cloud_restrictable"`
	PostsAggregatorJobStartTime   *string `access:"environment,write_restrictable,cloud_restrictable"`
	IndexPrefix                   *string `access:"environment,write_restrictable,cloud_restrictable"`
	LiveIndexingBatchSize         *int    `access:"environment,write_restrictable,cloud_restrictable"`
	BulkIndexingTimeWindowSeconds *int    `access:"environment,write_restrictable,cloud_restrictable"`
	RequestTimeoutSeconds         *int    `access:"environment,write_restrictable,cloud_restrictable"`
	SkipTLSVerification           *bool   `access:"environment,write_restrictable,cloud_restrictable"`
	Trace                         *string `access:"environment,write_restrictable,cloud_restrictable"`
}

func (s *ElasticsearchSettings) SetDefaults() {
	if s.ConnectionUrl == nil {
		s.ConnectionUrl = NewString(ELASTICSEARCH_SETTINGS_DEFAULT_CONNECTION_URL)
	}

	if s.Username == nil {
		s.Username = NewString(ELASTICSEARCH_SETTINGS_DEFAULT_USERNAME)
	}

	if s.Password == nil {
		s.Password = NewString(ELASTICSEARCH_SETTINGS_DEFAULT_PASSWORD)
	}

	if s.EnableIndexing == nil {
		s.EnableIndexing = NewBool(false)
	}

	if s.EnableSearching == nil {
		s.EnableSearching = NewBool(false)
	}

	if s.EnableAutocomplete == nil {
		s.EnableAutocomplete = NewBool(false)
	}

	if s.Sniff == nil {
		s.Sniff = NewBool(true)
	}

	if s.PostIndexReplicas == nil {
		s.PostIndexReplicas = NewInt(ELASTICSEARCH_SETTINGS_DEFAULT_POST_INDEX_REPLICAS)
	}

	if s.PostIndexShards == nil {
		s.PostIndexShards = NewInt(ELASTICSEARCH_SETTINGS_DEFAULT_POST_INDEX_SHARDS)
	}

	if s.ChannelIndexReplicas == nil {
		s.ChannelIndexReplicas = NewInt(ELASTICSEARCH_SETTINGS_DEFAULT_CHANNEL_INDEX_REPLICAS)
	}

	if s.ChannelIndexShards == nil {
		s.ChannelIndexShards = NewInt(ELASTICSEARCH_SETTINGS_DEFAULT_CHANNEL_INDEX_SHARDS)
	}

	if s.UserIndexReplicas == nil {
		s.UserIndexReplicas = NewInt(ELASTICSEARCH_SETTINGS_DEFAULT_USER_INDEX_REPLICAS)
	}

	if s.UserIndexShards == nil {
		s.UserIndexShards = NewInt(ELASTICSEARCH_SETTINGS_DEFAULT_USER_INDEX_SHARDS)
	}

	if s.AggregatePostsAfterDays == nil {
		s.AggregatePostsAfterDays = NewInt(ELASTICSEARCH_SETTINGS_DEFAULT_AGGREGATE_POSTS_AFTER_DAYS)
	}

	if s.PostsAggregatorJobStartTime == nil {
		s.PostsAggregatorJobStartTime = NewString(ELASTICSEARCH_SETTINGS_DEFAULT_POSTS_AGGREGATOR_JOB_START_TIME)
	}

	if s.IndexPrefix == nil {
		s.IndexPrefix = NewString(ELASTICSEARCH_SETTINGS_DEFAULT_INDEX_PREFIX)
	}

	if s.LiveIndexingBatchSize == nil {
		s.LiveIndexingBatchSize = NewInt(ELASTICSEARCH_SETTINGS_DEFAULT_LIVE_INDEXING_BATCH_SIZE)
	}

	if s.BulkIndexingTimeWindowSeconds == nil {
		s.BulkIndexingTimeWindowSeconds = NewInt(ELASTICSEARCH_SETTINGS_DEFAULT_BULK_INDEXING_TIME_WINDOW_SECONDS)
	}

	if s.RequestTimeoutSeconds == nil {
		s.RequestTimeoutSeconds = NewInt(ELASTICSEARCH_SETTINGS_DEFAULT_REQUEST_TIMEOUT_SECONDS)
	}

	if s.SkipTLSVerification == nil {
		s.SkipTLSVerification = NewBool(false)
	}

	if s.Trace == nil {
		s.Trace = NewString("")
	}
}

type BleveSettings struct {
	IndexDir                      *string `access:"experimental"`
	EnableIndexing                *bool   `access:"experimental"`
	EnableSearching               *bool   `access:"experimental"`
	EnableAutocomplete            *bool   `access:"experimental"`
	BulkIndexingTimeWindowSeconds *int    `access:"experimental"`
}

func (bs *BleveSettings) SetDefaults() {
	if bs.IndexDir == nil {
		bs.IndexDir = NewString(BLEVE_SETTINGS_DEFAULT_INDEX_DIR)
	}

	if bs.EnableIndexing == nil {
		bs.EnableIndexing = NewBool(false)
	}

	if bs.EnableSearching == nil {
		bs.EnableSearching = NewBool(false)
	}

	if bs.EnableAutocomplete == nil {
		bs.EnableAutocomplete = NewBool(false)
	}

	if bs.BulkIndexingTimeWindowSeconds == nil {
		bs.BulkIndexingTimeWindowSeconds = NewInt(BLEVE_SETTINGS_DEFAULT_BULK_INDEXING_TIME_WINDOW_SECONDS)
	}
}

type DataRetentionSettings struct {
	EnableMessageDeletion *bool   `access:"compliance"`
	EnableFileDeletion    *bool   `access:"compliance"`
	MessageRetentionDays  *int    `access:"compliance"`
	FileRetentionDays     *int    `access:"compliance"`
	DeletionJobStartTime  *string `access:"compliance"`
}

func (s *DataRetentionSettings) SetDefaults() {
	if s.EnableMessageDeletion == nil {
		s.EnableMessageDeletion = NewBool(false)
	}

	if s.EnableFileDeletion == nil {
		s.EnableFileDeletion = NewBool(false)
	}

	if s.MessageRetentionDays == nil {
		s.MessageRetentionDays = NewInt(DATA_RETENTION_SETTINGS_DEFAULT_MESSAGE_RETENTION_DAYS)
	}

	if s.FileRetentionDays == nil {
		s.FileRetentionDays = NewInt(DATA_RETENTION_SETTINGS_DEFAULT_FILE_RETENTION_DAYS)
	}

	if s.DeletionJobStartTime == nil {
		s.DeletionJobStartTime = NewString(DATA_RETENTION_SETTINGS_DEFAULT_DELETION_JOB_START_TIME)
	}
}

type JobSettings struct {
	RunJobs      *bool `access:"write_restrictable,cloud_restrictable"`
	RunScheduler *bool `access:"write_restrictable,cloud_restrictable"`
}

func (s *JobSettings) SetDefaults() {
	if s.RunJobs == nil {
		s.RunJobs = NewBool(true)
	}

	if s.RunScheduler == nil {
		s.RunScheduler = NewBool(true)
	}
}

type CloudSettings struct {
	CWSUrl *string `access:"environment,write_restrictable"`
}

func (s *CloudSettings) SetDefaults() {
	if s.CWSUrl == nil {
		s.CWSUrl = NewString(CLOUD_SETTINGS_DEFAULT_CWS_URL)
	}
}

type PluginState struct {
	Enable bool
}

type PluginSettings struct {
	Enable                      *bool                             `access:"plugins,write_restrictable"`
	EnableUploads               *bool                             `access:"plugins,write_restrictable,cloud_restrictable"`
	AllowInsecureDownloadUrl    *bool                             `access:"plugins,write_restrictable,cloud_restrictable"`
	EnableHealthCheck           *bool                             `access:"plugins,write_restrictable,cloud_restrictable"`
	Directory                   *string                           `access:"plugins,write_restrictable,cloud_restrictable"`
	ClientDirectory             *string                           `access:"plugins,write_restrictable,cloud_restrictable"`
	Plugins                     map[string]map[string]interface{} `access:"plugins"`
	PluginStates                map[string]*PluginState           `access:"plugins"`
	EnableMarketplace           *bool                             `access:"plugins,write_restrictable,cloud_restrictable"`
	EnableRemoteMarketplace     *bool                             `access:"plugins,write_restrictable,cloud_restrictable"`
	AutomaticPrepackagedPlugins *bool                             `access:"plugins,write_restrictable,cloud_restrictable"`
	RequirePluginSignature      *bool                             `access:"plugins,write_restrictable,cloud_restrictable"`
	MarketplaceUrl              *string                           `access:"plugins,write_restrictable,cloud_restrictable"`
	SignaturePublicKeyFiles     []string                          `access:"plugins,write_restrictable,cloud_restrictable"`
}

func (s *PluginSettings) SetDefaults(ls LogSettings) {
	if s.Enable == nil {
		s.Enable = NewBool(true)
	}

	if s.EnableUploads == nil {
		s.EnableUploads = NewBool(false)
	}

	if s.AllowInsecureDownloadUrl == nil {
		s.AllowInsecureDownloadUrl = NewBool(false)
	}

	if s.EnableHealthCheck == nil {
		s.EnableHealthCheck = NewBool(true)
	}

	if s.Directory == nil || *s.Directory == "" {
		s.Directory = NewString(PLUGIN_SETTINGS_DEFAULT_DIRECTORY)
	}

	if s.ClientDirectory == nil || *s.ClientDirectory == "" {
		s.ClientDirectory = NewString(PLUGIN_SETTINGS_DEFAULT_CLIENT_DIRECTORY)
	}

	if s.Plugins == nil {
		s.Plugins = make(map[string]map[string]interface{})
	}

	if s.PluginStates == nil {
		s.PluginStates = make(map[string]*PluginState)
	}

	if s.PluginStates["com.mattermost.nps"] == nil {
		// Enable the NPS plugin by default if diagnostics are enabled
		s.PluginStates["com.mattermost.nps"] = &PluginState{Enable: ls.EnableDiagnostics == nil || *ls.EnableDiagnostics}
	}

	if s.PluginStates["com.mattermost.plugin-incident-management"] == nil && BuildEnterpriseReady == "true" {
		// Enable the incident management plugin by default
		s.PluginStates["com.mattermost.plugin-incident-management"] = &PluginState{Enable: true}
	}

	if s.PluginStates["com.mattermost.plugin-channel-export"] == nil && BuildEnterpriseReady == "true" {
		// Enable the channel export plugin by default
		s.PluginStates["com.mattermost.plugin-channel-export"] = &PluginState{Enable: true}
	}

	if s.EnableMarketplace == nil {
		s.EnableMarketplace = NewBool(PLUGIN_SETTINGS_DEFAULT_ENABLE_MARKETPLACE)
	}

	if s.EnableRemoteMarketplace == nil {
		s.EnableRemoteMarketplace = NewBool(true)
	}

	if s.AutomaticPrepackagedPlugins == nil {
		s.AutomaticPrepackagedPlugins = NewBool(true)
	}

	if s.MarketplaceUrl == nil || *s.MarketplaceUrl == "" || *s.MarketplaceUrl == PLUGIN_SETTINGS_OLD_MARKETPLACE_URL {
		s.MarketplaceUrl = NewString(PLUGIN_SETTINGS_DEFAULT_MARKETPLACE_URL)
	}

	if s.RequirePluginSignature == nil {
		s.RequirePluginSignature = NewBool(false)
	}

	if s.SignaturePublicKeyFiles == nil {
		s.SignaturePublicKeyFiles = []string{}
	}
}

type GlobalRelayMessageExportSettings struct {
	CustomerType      *string `access:"compliance"` // must be either A9 or A10, dictates SMTP server url
	SmtpUsername      *string `access:"compliance"`
	SmtpPassword      *string `access:"compliance"`
	EmailAddress      *string `access:"compliance"` // the address to send messages to
	SMTPServerTimeout *int    `access:"compliance"`
}

func (s *GlobalRelayMessageExportSettings) SetDefaults() {
	if s.CustomerType == nil {
		s.CustomerType = NewString(GLOBALRELAY_CUSTOMER_TYPE_A9)
	}
	if s.SmtpUsername == nil {
		s.SmtpUsername = NewString("")
	}
	if s.SmtpPassword == nil {
		s.SmtpPassword = NewString("")
	}
	if s.EmailAddress == nil {
		s.EmailAddress = NewString("")
	}
	if s.SMTPServerTimeout == nil || *s.SMTPServerTimeout == 0 {
		s.SMTPServerTimeout = NewInt(1800)
	}
}

type MessageExportSettings struct {
	EnableExport          *bool   `access:"compliance"`
	ExportFormat          *string `access:"compliance"`
	DailyRunTime          *string `access:"compliance"`
	ExportFromTimestamp   *int64  `access:"compliance"`
	BatchSize             *int    `access:"compliance"`
	DownloadExportResults *bool   `access:"compliance"`

	// formatter-specific settings - these are only expected to be non-nil if ExportFormat is set to the associated format
	GlobalRelaySettings *GlobalRelayMessageExportSettings `access:"compliance"`
}

func (s *MessageExportSettings) SetDefaults() {
	if s.EnableExport == nil {
		s.EnableExport = NewBool(false)
	}

	if s.DownloadExportResults == nil {
		s.DownloadExportResults = NewBool(false)
	}

	if s.ExportFormat == nil {
		s.ExportFormat = NewString(COMPLIANCE_EXPORT_TYPE_ACTIANCE)
	}

	if s.DailyRunTime == nil {
		s.DailyRunTime = NewString("01:00")
	}

	if s.ExportFromTimestamp == nil {
		s.ExportFromTimestamp = NewInt64(0)
	}

	if s.BatchSize == nil {
		s.BatchSize = NewInt(10000)
	}

	if s.GlobalRelaySettings == nil {
		s.GlobalRelaySettings = &GlobalRelayMessageExportSettings{}
	}
	s.GlobalRelaySettings.SetDefaults()
}

type DisplaySettings struct {
	CustomUrlSchemes     []string `access:"site"`
	ExperimentalTimezone *bool    `access:"experimental"`
}

func (s *DisplaySettings) SetDefaults() {
	if s.CustomUrlSchemes == nil {
		customUrlSchemes := []string{}
		s.CustomUrlSchemes = customUrlSchemes
	}

	if s.ExperimentalTimezone == nil {
		s.ExperimentalTimezone = NewBool(true)
	}
}

type GuestAccountsSettings struct {
	Enable                           *bool   `access:"authentication"`
	AllowEmailAccounts               *bool   `access:"authentication"`
	EnforceMultifactorAuthentication *bool   `access:"authentication"`
	RestrictCreationToDomains        *string `access:"authentication"`
}

func (s *GuestAccountsSettings) SetDefaults() {
	if s.Enable == nil {
		s.Enable = NewBool(false)
	}

	if s.AllowEmailAccounts == nil {
		s.AllowEmailAccounts = NewBool(true)
	}

	if s.EnforceMultifactorAuthentication == nil {
		s.EnforceMultifactorAuthentication = NewBool(false)
	}

	if s.RestrictCreationToDomains == nil {
		s.RestrictCreationToDomains = NewString("")
	}
}

type ImageProxySettings struct {
	Enable                  *bool   `access:"environment"`
	ImageProxyType          *string `access:"environment"`
	RemoteImageProxyURL     *string `access:"environment"`
	RemoteImageProxyOptions *string `access:"environment"`
}

func (s *ImageProxySettings) SetDefaults(ss ServiceSettings) {
	if s.Enable == nil {
		if ss.DEPRECATED_DO_NOT_USE_ImageProxyType == nil || *ss.DEPRECATED_DO_NOT_USE_ImageProxyType == "" {
			s.Enable = NewBool(false)
		} else {
			s.Enable = NewBool(true)
		}
	}

	if s.ImageProxyType == nil {
		if ss.DEPRECATED_DO_NOT_USE_ImageProxyType == nil || *ss.DEPRECATED_DO_NOT_USE_ImageProxyType == "" {
			s.ImageProxyType = NewString(IMAGE_PROXY_TYPE_LOCAL)
		} else {
			s.ImageProxyType = ss.DEPRECATED_DO_NOT_USE_ImageProxyType
		}
	}

	if s.RemoteImageProxyURL == nil {
		if ss.DEPRECATED_DO_NOT_USE_ImageProxyURL == nil {
			s.RemoteImageProxyURL = NewString("")
		} else {
			s.RemoteImageProxyURL = ss.DEPRECATED_DO_NOT_USE_ImageProxyURL
		}
	}

	if s.RemoteImageProxyOptions == nil {
		if ss.DEPRECATED_DO_NOT_USE_ImageProxyOptions == nil {
			s.RemoteImageProxyOptions = NewString("")
		} else {
			s.RemoteImageProxyOptions = ss.DEPRECATED_DO_NOT_USE_ImageProxyOptions
		}
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
		s.Directory = NewString(IMPORT_SETTINGS_DEFAULT_DIRECTORY)
	}

	if s.RetentionDays == nil {
		s.RetentionDays = NewInt(IMPORT_SETTINGS_DEFAULT_RETENTION_DAYS)
	}
}

type ConfigFunc func() *Config

const ConfigAccessTagType = "access"
const ConfigAccessTagWriteRestrictable = "write_restrictable"
const ConfigAccessTagCloudRestrictable = "cloud_restrictable"

// Config fields support the 'access' tag with the following values corresponding to the suffix of the associated
// PERMISSION_SYSCONSOLE_*_* permission Id: 'about', 'reporting', 'user_management_users',
// 'user_management_groups', 'user_management_teams', 'user_management_channels',
// 'user_management_permissions', 'environment', 'site', 'authentication', 'plugins',
// 'integrations', 'compliance', 'plugins', and 'experimental'. They grant read and/or write access to the config field
// to roles without PERMISSION_MANAGE_SYSTEM.
//
// By default config values can be written with PERMISSION_MANAGE_SYSTEM, but if ExperimentalSettings.RestrictSystemAdmin is true
// and the access tag contains the value 'write_restrictable', then even PERMISSION_MANAGE_SYSTEM does not grant write access.
//
// PERMISSION_MANAGE_SYSTEM always grants read access.
//
// Config values with the access tag 'cloud_restrictable' mean that are marked to be filtered when it's used in a cloud licensed
// environment with ExperimentalSettings.RestrictedSystemAdmin set to true.
//
// Example:
//  type HairSettings struct {
//      // Colour is writeable with either PERMISSION_SYSCONSOLE_WRITE_REPORTING or PERMISSION_SYSCONSOLE_WRITE_USER_MANAGEMENT_GROUPS.
//      // It is readable by PERMISSION_SYSCONSOLE_READ_REPORTING and PERMISSION_SYSCONSOLE_READ_USER_MANAGEMENT_GROUPS permissions.
//      // PERMISSION_MANAGE_SYSTEM grants read and write access.
//      Colour string `access:"reporting,user_management_groups"`
//
//
//      // Length is only readable and writable via PERMISSION_MANAGE_SYSTEM.
//      Length string
//
//      // Product is only writeable by PERMISSION_MANAGE_SYSTEM if ExperimentalSettings.RestrictSystemAdmin is false.
//      // PERMISSION_MANAGE_SYSTEM can always read the value.
//      Product bool `access:write_restrictable`
//  }
type Config struct {
	ServiceSettings           ServiceSettings
	TeamSettings              TeamSettings
	ClientRequirements        ClientRequirements
	SqlSettings               SqlSettings
	LogSettings               LogSettings
	ExperimentalAuditSettings ExperimentalAuditSettings
	NotificationLogSettings   NotificationLogSettings
	PasswordSettings          PasswordSettings
	FileSettings              FileSettings
	EmailSettings             EmailSettings
	RateLimitSettings         RateLimitSettings
	PrivacySettings           PrivacySettings
	SupportSettings           SupportSettings
	AnnouncementSettings      AnnouncementSettings
	ThemeSettings             ThemeSettings
	GitLabSettings            SSOSettings
	GoogleSettings            SSOSettings
	Office365Settings         Office365Settings
	OpenIdSettings            SSOSettings
	LdapSettings              LdapSettings
	ComplianceSettings        ComplianceSettings
	LocalizationSettings      LocalizationSettings
	SamlSettings              SamlSettings
	NativeAppSettings         NativeAppSettings
	ClusterSettings           ClusterSettings
	MetricsSettings           MetricsSettings
	ExperimentalSettings      ExperimentalSettings
	AnalyticsSettings         AnalyticsSettings
	ElasticsearchSettings     ElasticsearchSettings
	BleveSettings             BleveSettings
	DataRetentionSettings     DataRetentionSettings
	MessageExportSettings     MessageExportSettings
	JobSettings               JobSettings
	PluginSettings            PluginSettings
	DisplaySettings           DisplaySettings
	GuestAccountsSettings     GuestAccountsSettings
	ImageProxySettings        ImageProxySettings
	CloudSettings             CloudSettings
	FeatureFlags              *FeatureFlags `json:",omitempty"`
	ImportSettings            ImportSettings
}

func (o *Config) Clone() *Config {
	var ret Config
	if err := json.Unmarshal([]byte(o.ToJson()), &ret); err != nil {
		panic(err)
	}
	return &ret
}

func (o *Config) ToJson() string {
	b, _ := json.Marshal(o)
	return string(b)
}

func (o *Config) ToJsonFiltered(tagType, tagValue string) string {
	filteredConfigMap := structToMapFilteredByTag(*o, tagType, tagValue)
	for key, value := range filteredConfigMap {
		v, ok := value.(map[string]interface{})
		if ok && len(v) == 0 {
			delete(filteredConfigMap, key)
		}
	}
	b, _ := json.Marshal(filteredConfigMap)
	return string(b)
}

func (o *Config) GetSSOService(service string) *SSOSettings {
	switch service {
	case SERVICE_GITLAB:
		return &o.GitLabSettings
	case SERVICE_GOOGLE:
		return &o.GoogleSettings
	case SERVICE_OFFICE365:
		return o.Office365Settings.SSOSettings()
	case SERVICE_OPENID:
		return &o.OpenIdSettings
	}

	return nil
}

func ConfigFromJson(data io.Reader) *Config {
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
		o.TeamSettings.TeammateNameDisplay = NewString(SHOW_USERNAME)

		if *o.SamlSettings.Enable || *o.LdapSettings.Enable {
			*o.TeamSettings.TeammateNameDisplay = SHOW_FULLNAME
		}
	}

	o.SqlSettings.SetDefaults(isUpdate)
	o.FileSettings.SetDefaults(isUpdate)
	o.EmailSettings.SetDefaults(isUpdate)
	o.PrivacySettings.setDefaults()
	o.Office365Settings.setDefaults()
	o.Office365Settings.setDefaults()
	o.GitLabSettings.setDefaults("", "", "", "", "")
	o.GoogleSettings.setDefaults(GOOGLE_SETTINGS_DEFAULT_SCOPE, GOOGLE_SETTINGS_DEFAULT_AUTH_ENDPOINT, GOOGLE_SETTINGS_DEFAULT_TOKEN_ENDPOINT, GOOGLE_SETTINGS_DEFAULT_USER_API_ENDPOINT, "")
	o.OpenIdSettings.setDefaults(OPENID_SETTINGS_DEFAULT_SCOPE, "", "", "", "#145DBF")
	o.ServiceSettings.SetDefaults(isUpdate)
	o.PasswordSettings.SetDefaults()
	o.TeamSettings.SetDefaults()
	o.MetricsSettings.SetDefaults()
	o.ExperimentalSettings.SetDefaults()
	o.SupportSettings.SetDefaults()
	o.AnnouncementSettings.SetDefaults()
	o.ThemeSettings.SetDefaults()
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
	o.ImageProxySettings.SetDefaults(o.ServiceSettings)
	o.CloudSettings.SetDefaults()
	if o.FeatureFlags == nil {
		o.FeatureFlags = &FeatureFlags{}
		o.FeatureFlags.SetDefaults()
	}
	o.ImportSettings.SetDefaults()
}

func (o *Config) IsValid() *AppError {
	if *o.ServiceSettings.SiteURL == "" && *o.EmailSettings.EnableEmailBatching {
		return NewAppError("Config.IsValid", "model.config.is_valid.site_url_email_batching.app_error", nil, "", http.StatusBadRequest)
	}

	if *o.ClusterSettings.Enable && *o.EmailSettings.EnableEmailBatching {
		return NewAppError("Config.IsValid", "model.config.is_valid.cluster_email_batching.app_error", nil, "", http.StatusBadRequest)
	}

	if *o.ServiceSettings.SiteURL == "" && *o.ServiceSettings.AllowCookiesForSubdomains {
		return NewAppError("Config.IsValid", "model.config.is_valid.allow_cookies_for_subdomains.app_error", nil, "", http.StatusBadRequest)
	}

	if err := o.TeamSettings.isValid(); err != nil {
		return err
	}

	if err := o.SqlSettings.isValid(); err != nil {
		return err
	}

	if err := o.FileSettings.isValid(); err != nil {
		return err
	}

	if err := o.EmailSettings.isValid(); err != nil {
		return err
	}

	if err := o.LdapSettings.isValid(); err != nil {
		return err
	}

	if err := o.SamlSettings.isValid(); err != nil {
		return err
	}

	if *o.PasswordSettings.MinimumLength < PASSWORD_MINIMUM_LENGTH || *o.PasswordSettings.MinimumLength > PASSWORD_MAXIMUM_LENGTH {
		return NewAppError("Config.IsValid", "model.config.is_valid.password_length.app_error", map[string]interface{}{"MinLength": PASSWORD_MINIMUM_LENGTH, "MaxLength": PASSWORD_MAXIMUM_LENGTH}, "", http.StatusBadRequest)
	}

	if err := o.RateLimitSettings.isValid(); err != nil {
		return err
	}

	if err := o.ServiceSettings.isValid(); err != nil {
		return err
	}

	if err := o.ElasticsearchSettings.isValid(); err != nil {
		return err
	}

	if err := o.BleveSettings.isValid(); err != nil {
		return err
	}

	if err := o.DataRetentionSettings.isValid(); err != nil {
		return err
	}

	if err := o.LocalizationSettings.isValid(); err != nil {
		return err
	}

	if err := o.MessageExportSettings.isValid(o.FileSettings); err != nil {
		return err
	}

	if err := o.DisplaySettings.isValid(); err != nil {
		return err
	}

	if err := o.ImageProxySettings.isValid(); err != nil {
		return err
	}

	if err := o.ImportSettings.isValid(); err != nil {
		return err
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

	if *s.MaxNotificationsPerChannel <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.max_notify_per_channel.app_error", nil, "", http.StatusBadRequest)
	}

	if !(*s.RestrictDirectMessage == DIRECT_MESSAGE_ANY || *s.RestrictDirectMessage == DIRECT_MESSAGE_TEAM) {
		return NewAppError("Config.IsValid", "model.config.is_valid.restrict_direct_message.app_error", nil, "", http.StatusBadRequest)
	}

	if !(*s.TeammateNameDisplay == SHOW_FULLNAME || *s.TeammateNameDisplay == SHOW_NICKNAME_FULLNAME || *s.TeammateNameDisplay == SHOW_USERNAME) {
		return NewAppError("Config.IsValid", "model.config.is_valid.teammate_name_display.app_error", nil, "", http.StatusBadRequest)
	}

	if len(*s.SiteName) > SITENAME_MAX_LENGTH {
		return NewAppError("Config.IsValid", "model.config.is_valid.sitename_length.app_error", map[string]interface{}{"MaxLength": SITENAME_MAX_LENGTH}, "", http.StatusBadRequest)
	}

	return nil
}

func (s *SqlSettings) isValid() *AppError {
	if *s.AtRestEncryptKey != "" && len(*s.AtRestEncryptKey) < 32 {
		return NewAppError("Config.IsValid", "model.config.is_valid.encrypt_sql.app_error", nil, "", http.StatusBadRequest)
	}

	if !(*s.DriverName == DATABASE_DRIVER_MYSQL || *s.DriverName == DATABASE_DRIVER_POSTGRES) {
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

	if !(*s.DriverName == IMAGE_DRIVER_LOCAL || *s.DriverName == IMAGE_DRIVER_S3) {
		return NewAppError("Config.IsValid", "model.config.is_valid.file_driver.app_error", nil, "", http.StatusBadRequest)
	}

	if *s.PublicLinkSalt != "" && len(*s.PublicLinkSalt) < 32 {
		return NewAppError("Config.IsValid", "model.config.is_valid.file_salt.app_error", nil, "", http.StatusBadRequest)
	}

	if *s.Directory == "" {
		return NewAppError("Config.IsValid", "model.config.is_valid.directory.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

func (s *EmailSettings) isValid() *AppError {
	if !(*s.ConnectionSecurity == CONN_SECURITY_NONE || *s.ConnectionSecurity == CONN_SECURITY_TLS || *s.ConnectionSecurity == CONN_SECURITY_STARTTLS || *s.ConnectionSecurity == CONN_SECURITY_PLAIN) {
		return NewAppError("Config.IsValid", "model.config.is_valid.email_security.app_error", nil, "", http.StatusBadRequest)
	}

	if *s.EmailBatchingBufferSize <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.email_batching_buffer_size.app_error", nil, "", http.StatusBadRequest)
	}

	if *s.EmailBatchingInterval < 30 {
		return NewAppError("Config.IsValid", "model.config.is_valid.email_batching_interval.app_error", nil, "", http.StatusBadRequest)
	}

	if !(*s.EmailNotificationContentsType == EMAIL_NOTIFICATION_CONTENTS_FULL || *s.EmailNotificationContentsType == EMAIL_NOTIFICATION_CONTENTS_GENERIC) {
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
	if !(*s.ConnectionSecurity == CONN_SECURITY_NONE || *s.ConnectionSecurity == CONN_SECURITY_TLS || *s.ConnectionSecurity == CONN_SECURITY_STARTTLS) {
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
				return NewAppError("ValidateFilter", "ent.ldap.validate_filter.app_error", nil, err.Error(), http.StatusBadRequest)
			}
		}

		if *s.GuestFilter != "" {
			if _, err := ldap.CompileFilter(*s.GuestFilter); err != nil {
				return NewAppError("LdapSettings.isValid", "ent.ldap.validate_guest_filter.app_error", nil, err.Error(), http.StatusBadRequest)
			}
		}

		if *s.AdminFilter != "" {
			if _, err := ldap.CompileFilter(*s.AdminFilter); err != nil {
				return NewAppError("LdapSettings.isValid", "ent.ldap.validate_admin_filter.app_error", nil, err.Error(), http.StatusBadRequest)
			}
		}
	}

	return nil
}

func (s *SamlSettings) isValid() *AppError {
	if *s.Enable {
		if *s.IdpUrl == "" || !IsValidHttpUrl(*s.IdpUrl) {
			return NewAppError("Config.IsValid", "model.config.is_valid.saml_idp_url.app_error", nil, "", http.StatusBadRequest)
		}

		if *s.IdpDescriptorUrl == "" || !IsValidHttpUrl(*s.IdpDescriptorUrl) {
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
			if *s.AssertionConsumerServiceURL == "" || !IsValidHttpUrl(*s.AssertionConsumerServiceURL) {
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

		if !(*s.SignatureAlgorithm == SAML_SETTINGS_SIGNATURE_ALGORITHM_SHA1 || *s.SignatureAlgorithm == SAML_SETTINGS_SIGNATURE_ALGORITHM_SHA256 || *s.SignatureAlgorithm == SAML_SETTINGS_SIGNATURE_ALGORITHM_SHA512) {
			return NewAppError("Config.IsValid", "model.config.is_valid.saml_signature_algorithm.app_error", nil, "", http.StatusBadRequest)
		}
		if !(*s.CanonicalAlgorithm == SAML_SETTINGS_CANONICAL_ALGORITHM_C14N || *s.CanonicalAlgorithm == SAML_SETTINGS_CANONICAL_ALGORITHM_C14N11) {
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
	if !(*s.ConnectionSecurity == CONN_SECURITY_NONE || *s.ConnectionSecurity == CONN_SECURITY_TLS) {
		return NewAppError("Config.IsValid", "model.config.is_valid.webserver_security.app_error", nil, "", http.StatusBadRequest)
	}

	if *s.ConnectionSecurity == CONN_SECURITY_TLS && !*s.UseLetsEncrypt {
		appErr := NewAppError("Config.IsValid", "model.config.is_valid.tls_cert_file.app_error", nil, "", http.StatusBadRequest)

		if *s.TLSCertFile == "" {
			return appErr
		} else if _, err := os.Stat(*s.TLSCertFile); os.IsNotExist(err) {
			return appErr
		}

		appErr = NewAppError("Config.IsValid", "model.config.is_valid.tls_key_file.app_error", nil, "", http.StatusBadRequest)

		if *s.TLSKeyFile == "" {
			return appErr
		} else if _, err := os.Stat(*s.TLSKeyFile); os.IsNotExist(err) {
			return appErr
		}
	}

	if len(s.TLSOverwriteCiphers) > 0 {
		for _, cipher := range s.TLSOverwriteCiphers {
			if _, ok := ServerTLSSupportedCiphers[cipher]; !ok {
				return NewAppError("Config.IsValid", "model.config.is_valid.tls_overwrite_cipher.app_error", map[string]interface{}{"name": cipher}, "", http.StatusBadRequest)
			}
		}
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
			return NewAppError("Config.IsValid", "model.config.is_valid.site_url.app_error", nil, "", http.StatusBadRequest)
		}
	}

	if *s.WebsocketURL != "" {
		if _, err := url.ParseRequestURI(*s.WebsocketURL); err != nil {
			return NewAppError("Config.IsValid", "model.config.is_valid.websocket_url.app_error", nil, "", http.StatusBadRequest)
		}
	}

	host, port, _ := net.SplitHostPort(*s.ListenAddress)
	var isValidHost bool
	if host == "" {
		isValidHost = true
	} else {
		isValidHost = (net.ParseIP(host) != nil) || IsDomainName(host)
	}
	portInt, err := strconv.Atoi(port)
	if err != nil || !isValidHost || portInt < 0 || portInt > math.MaxUint16 {
		return NewAppError("Config.IsValid", "model.config.is_valid.listen_address.app_error", nil, "", http.StatusBadRequest)
	}

	if *s.ExperimentalGroupUnreadChannels != GROUP_UNREAD_CHANNELS_DISABLED &&
		*s.ExperimentalGroupUnreadChannels != GROUP_UNREAD_CHANNELS_DEFAULT_ON &&
		*s.ExperimentalGroupUnreadChannels != GROUP_UNREAD_CHANNELS_DEFAULT_OFF {
		return NewAppError("Config.IsValid", "model.config.is_valid.group_unread_channels.app_error", nil, "", http.StatusBadRequest)
	}

	if *s.CollapsedThreads != COLLAPSED_THREADS_DISABLED &&
		*s.CollapsedThreads != COLLAPSED_THREADS_DEFAULT_ON &&
		*s.CollapsedThreads != COLLAPSED_THREADS_DEFAULT_OFF {
		return NewAppError("Config.IsValid", "model.config.is_valid.collapsed_threads.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

func (s *ElasticsearchSettings) isValid() *AppError {
	if *s.EnableIndexing {
		if *s.ConnectionUrl == "" {
			return NewAppError("Config.IsValid", "model.config.is_valid.elastic_search.connection_url.app_error", nil, "", http.StatusBadRequest)
		}
	}

	if *s.EnableSearching && !*s.EnableIndexing {
		return NewAppError("Config.IsValid", "model.config.is_valid.elastic_search.enable_searching.app_error", nil, "", http.StatusBadRequest)
	}

	if *s.EnableAutocomplete && !*s.EnableIndexing {
		return NewAppError("Config.IsValid", "model.config.is_valid.elastic_search.enable_autocomplete.app_error", nil, "", http.StatusBadRequest)
	}

	if *s.AggregatePostsAfterDays < 1 {
		return NewAppError("Config.IsValid", "model.config.is_valid.elastic_search.aggregate_posts_after_days.app_error", nil, "", http.StatusBadRequest)
	}

	if _, err := time.Parse("15:04", *s.PostsAggregatorJobStartTime); err != nil {
		return NewAppError("Config.IsValid", "model.config.is_valid.elastic_search.posts_aggregator_job_start_time.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	if *s.LiveIndexingBatchSize < 1 {
		return NewAppError("Config.IsValid", "model.config.is_valid.elastic_search.live_indexing_batch_size.app_error", nil, "", http.StatusBadRequest)
	}

	if *s.BulkIndexingTimeWindowSeconds < 1 {
		return NewAppError("Config.IsValid", "model.config.is_valid.elastic_search.bulk_indexing_time_window_seconds.app_error", nil, "", http.StatusBadRequest)
	}

	if *s.RequestTimeoutSeconds < 1 {
		return NewAppError("Config.IsValid", "model.config.is_valid.elastic_search.request_timeout_seconds.app_error", nil, "", http.StatusBadRequest)
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
	if *bs.BulkIndexingTimeWindowSeconds < 1 {
		return NewAppError("Config.IsValid", "model.config.is_valid.bleve_search.bulk_indexing_time_window_seconds.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

func (s *DataRetentionSettings) isValid() *AppError {
	if *s.MessageRetentionDays <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.data_retention.message_retention_days_too_low.app_error", nil, "", http.StatusBadRequest)
	}

	if *s.FileRetentionDays <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.data_retention.file_retention_days_too_low.app_error", nil, "", http.StatusBadRequest)
	}

	if _, err := time.Parse("15:04", *s.DeletionJobStartTime); err != nil {
		return NewAppError("Config.IsValid", "model.config.is_valid.data_retention.deletion_job_start_time.app_error", nil, err.Error(), http.StatusBadRequest)
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

func (s *MessageExportSettings) isValid(fs FileSettings) *AppError {
	if s.EnableExport == nil {
		return NewAppError("Config.IsValid", "model.config.is_valid.message_export.enable.app_error", nil, "", http.StatusBadRequest)
	}
	if *s.EnableExport {
		if s.ExportFromTimestamp == nil || *s.ExportFromTimestamp < 0 || *s.ExportFromTimestamp > GetMillis() {
			return NewAppError("Config.IsValid", "model.config.is_valid.message_export.export_from.app_error", nil, "", http.StatusBadRequest)
		} else if s.DailyRunTime == nil {
			return NewAppError("Config.IsValid", "model.config.is_valid.message_export.daily_runtime.app_error", nil, "", http.StatusBadRequest)
		} else if _, err := time.Parse("15:04", *s.DailyRunTime); err != nil {
			return NewAppError("Config.IsValid", "model.config.is_valid.message_export.daily_runtime.app_error", nil, err.Error(), http.StatusBadRequest)
		} else if s.BatchSize == nil || *s.BatchSize < 0 {
			return NewAppError("Config.IsValid", "model.config.is_valid.message_export.batch_size.app_error", nil, "", http.StatusBadRequest)
		} else if s.ExportFormat == nil || (*s.ExportFormat != COMPLIANCE_EXPORT_TYPE_ACTIANCE && *s.ExportFormat != COMPLIANCE_EXPORT_TYPE_GLOBALRELAY && *s.ExportFormat != COMPLIANCE_EXPORT_TYPE_CSV) {
			return NewAppError("Config.IsValid", "model.config.is_valid.message_export.export_type.app_error", nil, "", http.StatusBadRequest)
		}

		if *s.ExportFormat == COMPLIANCE_EXPORT_TYPE_GLOBALRELAY {
			if s.GlobalRelaySettings == nil {
				return NewAppError("Config.IsValid", "model.config.is_valid.message_export.global_relay.config_missing.app_error", nil, "", http.StatusBadRequest)
			} else if s.GlobalRelaySettings.CustomerType == nil || (*s.GlobalRelaySettings.CustomerType != GLOBALRELAY_CUSTOMER_TYPE_A9 && *s.GlobalRelaySettings.CustomerType != GLOBALRELAY_CUSTOMER_TYPE_A10) {
				return NewAppError("Config.IsValid", "model.config.is_valid.message_export.global_relay.customer_type.app_error", nil, "", http.StatusBadRequest)
			} else if s.GlobalRelaySettings.EmailAddress == nil || !strings.Contains(*s.GlobalRelaySettings.EmailAddress, "@") {
				// validating email addresses is hard - just make sure it contains an '@' sign
				// see https://stackoverflow.com/questions/201323/using-a-regular-expression-to-validate-an-email-address
				return NewAppError("Config.IsValid", "model.config.is_valid.message_export.global_relay.email_address.app_error", nil, "", http.StatusBadRequest)
			} else if s.GlobalRelaySettings.SmtpUsername == nil || *s.GlobalRelaySettings.SmtpUsername == "" {
				return NewAppError("Config.IsValid", "model.config.is_valid.message_export.global_relay.smtp_username.app_error", nil, "", http.StatusBadRequest)
			} else if s.GlobalRelaySettings.SmtpPassword == nil || *s.GlobalRelaySettings.SmtpPassword == "" {
				return NewAppError("Config.IsValid", "model.config.is_valid.message_export.global_relay.smtp_password.app_error", nil, "", http.StatusBadRequest)
			}
		}
	}
	return nil
}

func (s *DisplaySettings) isValid() *AppError {
	if len(s.CustomUrlSchemes) != 0 {
		validProtocolPattern := regexp.MustCompile(`(?i)^\s*[A-Za-z][A-Za-z0-9.+-]*\s*$`)

		for _, scheme := range s.CustomUrlSchemes {
			if !validProtocolPattern.MatchString(scheme) {
				return NewAppError(
					"Config.IsValid",
					"model.config.is_valid.display.custom_url_schemes.app_error",
					map[string]interface{}{"Scheme": scheme},
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
		case IMAGE_PROXY_TYPE_LOCAL:
			// No other settings to validate
		case IMAGE_PROXY_TYPE_ATMOS_CAMO:
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

func (o *Config) Sanitize() {
	if o.LdapSettings.BindPassword != nil && *o.LdapSettings.BindPassword != "" {
		*o.LdapSettings.BindPassword = FAKE_SETTING
	}

	*o.FileSettings.PublicLinkSalt = FAKE_SETTING

	if *o.FileSettings.AmazonS3SecretAccessKey != "" {
		*o.FileSettings.AmazonS3SecretAccessKey = FAKE_SETTING
	}

	if o.EmailSettings.SMTPPassword != nil && *o.EmailSettings.SMTPPassword != "" {
		*o.EmailSettings.SMTPPassword = FAKE_SETTING
	}

	if *o.GitLabSettings.Secret != "" {
		*o.GitLabSettings.Secret = FAKE_SETTING
	}

	if o.GoogleSettings.Secret != nil && *o.GoogleSettings.Secret != "" {
		*o.GoogleSettings.Secret = FAKE_SETTING
	}

	if o.Office365Settings.Secret != nil && *o.Office365Settings.Secret != "" {
		*o.Office365Settings.Secret = FAKE_SETTING
	}

	if o.OpenIdSettings.Secret != nil && *o.OpenIdSettings.Secret != "" {
		*o.OpenIdSettings.Secret = FAKE_SETTING
	}

	*o.SqlSettings.DataSource = FAKE_SETTING
	*o.SqlSettings.AtRestEncryptKey = FAKE_SETTING

	*o.ElasticsearchSettings.Password = FAKE_SETTING

	for i := range o.SqlSettings.DataSourceReplicas {
		o.SqlSettings.DataSourceReplicas[i] = FAKE_SETTING
	}

	for i := range o.SqlSettings.DataSourceSearchReplicas {
		o.SqlSettings.DataSourceSearchReplicas[i] = FAKE_SETTING
	}

	if o.MessageExportSettings.GlobalRelaySettings.SmtpPassword != nil && *o.MessageExportSettings.GlobalRelaySettings.SmtpPassword != "" {
		*o.MessageExportSettings.GlobalRelaySettings.SmtpPassword = FAKE_SETTING
	}

	if o.ServiceSettings.GfycatApiSecret != nil && *o.ServiceSettings.GfycatApiSecret != "" {
		*o.ServiceSettings.GfycatApiSecret = FAKE_SETTING
	}

	*o.ServiceSettings.SplitKey = FAKE_SETTING
}

// structToMapFilteredByTag converts a struct into a map removing those fields that has the tag passed
// as argument
func structToMapFilteredByTag(t interface{}, typeOfTag, filterTag string) map[string]interface{} {
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

	out := map[string]interface{}{}

	for i := 0; i < val.NumField(); i++ {
		field := val.Field(i)

		structField := elemField.Field(i)
		tagPermissions := strings.Split(structField.Tag.Get(typeOfTag), ",")
		if isTagPresent(filterTag, tagPermissions) {
			continue
		}

		var value interface{}

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

func isTagPresent(tag string, tags []string) bool {
	for _, val := range tags {
		tagValue := strings.TrimSpace(val)
		if tagValue != "" && tagValue == tag {
			return true
		}
	}

	return false
}
