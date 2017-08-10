// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
	"net/http"
	"net/url"
)

const (
	CONN_SECURITY_NONE     = ""
	CONN_SECURITY_PLAIN    = "PLAIN"
	CONN_SECURITY_TLS      = "TLS"
	CONN_SECURITY_STARTTLS = "STARTTLS"

	IMAGE_DRIVER_LOCAL = "local"
	IMAGE_DRIVER_S3    = "amazons3"

	DATABASE_DRIVER_MYSQL    = "mysql"
	DATABASE_DRIVER_POSTGRES = "postgres"

	PASSWORD_MAXIMUM_LENGTH = 64
	PASSWORD_MINIMUM_LENGTH = 5

	SERVICE_GITLAB    = "gitlab"
	SERVICE_GOOGLE    = "google"
	SERVICE_OFFICE365 = "office365"

	WEBSERVER_MODE_REGULAR  = "regular"
	WEBSERVER_MODE_GZIP     = "gzip"
	WEBSERVER_MODE_DISABLED = "disabled"

	GENERIC_NO_CHANNEL_NOTIFICATION = "generic_no_channel"
	GENERIC_NOTIFICATION            = "generic"
	FULL_NOTIFICATION               = "full"

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

	EMAIL_BATCHING_BUFFER_SIZE = 256
	EMAIL_BATCHING_INTERVAL    = 30

	EMAIL_NOTIFICATION_CONTENTS_FULL    = "full"
	EMAIL_NOTIFICATION_CONTENTS_GENERIC = "generic"

	SITENAME_MAX_LENGTH = 30

	SERVICE_SETTINGS_DEFAULT_SITE_URL        = ""
	SERVICE_SETTINGS_DEFAULT_TLS_CERT_FILE   = ""
	SERVICE_SETTINGS_DEFAULT_TLS_KEY_FILE    = ""
	SERVICE_SETTINGS_DEFAULT_READ_TIMEOUT    = 300
	SERVICE_SETTINGS_DEFAULT_WRITE_TIMEOUT   = 300
	SERVICE_SETTINGS_DEFAULT_ALLOW_CORS_FROM = ""

	TEAM_SETTINGS_DEFAULT_CUSTOM_BRAND_TEXT        = ""
	TEAM_SETTINGS_DEFAULT_CUSTOM_DESCRIPTION_TEXT  = ""
	TEAM_SETTINGS_DEFAULT_USER_STATUS_AWAY_TIMEOUT = 300

	EMAIL_SETTINGS_DEFAULT_FEEDBACK_ORGANIZATION = ""

	SUPPORT_SETTINGS_DEFAULT_TERMS_OF_SERVICE_LINK      = "https://about.mattermost.com/default-terms/"
	SUPPORT_SETTINGS_DEFAULT_PRIVACY_POLICY_LINK        = "https://about.mattermost.com/default-privacy-policy/"
	SUPPORT_SETTINGS_DEFAULT_ABOUT_LINK                 = "https://about.mattermost.com/default-about/"
	SUPPORT_SETTINGS_DEFAULT_HELP_LINK                  = "https://about.mattermost.com/default-help/"
	SUPPORT_SETTINGS_DEFAULT_REPORT_A_PROBLEM_LINK      = "https://about.mattermost.com/default-report-a-problem/"
	SUPPORT_SETTINGS_DEFAULT_ADMINISTRATORS_GUIDE_LINK  = "https://about.mattermost.com/administrators-guide/"
	SUPPORT_SETTINGS_DEFAULT_TROUBLESHOOTING_FORUM_LINK = "https://about.mattermost.com/troubleshooting-forum/"
	SUPPORT_SETTINGS_DEFAULT_COMMERCIAL_SUPPORT_LINK    = "https://about.mattermost.com/commercial-support/"
	SUPPORT_SETTINGS_DEFAULT_SUPPORT_EMAIL              = "feedback@mattermost.com"

	LDAP_SETTINGS_DEFAULT_FIRST_NAME_ATTRIBUTE = ""
	LDAP_SETTINGS_DEFAULT_LAST_NAME_ATTRIBUTE  = ""
	LDAP_SETTINGS_DEFAULT_EMAIL_ATTRIBUTE      = ""
	LDAP_SETTINGS_DEFAULT_USERNAME_ATTRIBUTE   = ""
	LDAP_SETTINGS_DEFAULT_NICKNAME_ATTRIBUTE   = ""
	LDAP_SETTINGS_DEFAULT_ID_ATTRIBUTE         = ""
	LDAP_SETTINGS_DEFAULT_POSITION_ATTRIBUTE   = ""
	LDAP_SETTINGS_DEFAULT_LOGIN_FIELD_NAME     = ""

	SAML_SETTINGS_DEFAULT_FIRST_NAME_ATTRIBUTE = ""
	SAML_SETTINGS_DEFAULT_LAST_NAME_ATTRIBUTE  = ""
	SAML_SETTINGS_DEFAULT_EMAIL_ATTRIBUTE      = ""
	SAML_SETTINGS_DEFAULT_USERNAME_ATTRIBUTE   = ""
	SAML_SETTINGS_DEFAULT_NICKNAME_ATTRIBUTE   = ""
	SAML_SETTINGS_DEFAULT_LOCALE_ATTRIBUTE     = ""
	SAML_SETTINGS_DEFAULT_POSITION_ATTRIBUTE   = ""

	NATIVEAPP_SETTINGS_DEFAULT_APP_DOWNLOAD_LINK         = "https://about.mattermost.com/downloads/"
	NATIVEAPP_SETTINGS_DEFAULT_ANDROID_APP_DOWNLOAD_LINK = "https://about.mattermost.com/mattermost-android-app/"
	NATIVEAPP_SETTINGS_DEFAULT_IOS_APP_DOWNLOAD_LINK     = "https://about.mattermost.com/mattermost-ios-app/"

	WEBRTC_SETTINGS_DEFAULT_STUN_URI = ""
	WEBRTC_SETTINGS_DEFAULT_TURN_URI = ""

	ANALYTICS_SETTINGS_DEFAULT_MAX_USERS_FOR_STATISTICS = 2500

	ANNOUNCEMENT_SETTINGS_DEFAULT_BANNER_COLOR      = "#f2a93b"
	ANNOUNCEMENT_SETTINGS_DEFAULT_BANNER_TEXT_COLOR = "#333333"

	ELASTICSEARCH_SETTINGS_DEFAULT_CONNECTION_URL      = ""
	ELASTICSEARCH_SETTINGS_DEFAULT_USERNAME            = ""
	ELASTICSEARCH_SETTINGS_DEFAULT_PASSWORD            = ""
	ELASTICSEARCH_SETTINGS_DEFAULT_POST_INDEX_REPLICAS = 1
	ELASTICSEARCH_SETTINGS_DEFAULT_POST_INDEX_SHARDS   = 1
)

type ServiceSettings struct {
	SiteURL                                  *string
	LicenseFileLocation                      *string
	ListenAddress                            string
	ConnectionSecurity                       *string
	TLSCertFile                              *string
	TLSKeyFile                               *string
	UseLetsEncrypt                           *bool
	LetsEncryptCertificateCacheFile          *string
	Forward80To443                           *bool
	ReadTimeout                              *int
	WriteTimeout                             *int
	MaximumLoginAttempts                     int
	GoroutineHealthThreshold                 *int
	GoogleDeveloperKey                       string
	EnableOAuthServiceProvider               bool
	EnableIncomingWebhooks                   bool
	EnableOutgoingWebhooks                   bool
	EnableCommands                           *bool
	EnableOnlyAdminIntegrations              *bool
	EnablePostUsernameOverride               bool
	EnablePostIconOverride                   bool
	EnableAPIv3                              *bool
	EnableLinkPreviews                       *bool
	EnableTesting                            bool
	EnableDeveloper                          *bool
	EnableSecurityFixAlert                   *bool
	EnableInsecureOutgoingConnections        *bool
	AllowedUntrustedInternalConnections      *string
	EnableMultifactorAuthentication          *bool
	EnforceMultifactorAuthentication         *bool
	EnableUserAccessTokens                   *bool
	AllowCorsFrom                            *string
	SessionLengthWebInDays                   *int
	SessionLengthMobileInDays                *int
	SessionLengthSSOInDays                   *int
	SessionCacheInMinutes                    *int
	WebsocketSecurePort                      *int
	WebsocketPort                            *int
	WebserverMode                            *string
	EnableCustomEmoji                        *bool
	EnableEmojiPicker                        *bool
	RestrictCustomEmojiCreation              *string
	RestrictPostDelete                       *string
	AllowEditPost                            *string
	PostEditTimeLimit                        *int
	TimeBetweenUserTypingUpdatesMilliseconds *int64
	EnablePostSearch                         *bool
	EnableUserTypingMessages                 *bool
	EnableChannelViewedMessages              *bool
	EnableUserStatuses                       *bool
	ClusterLogTimeoutMilliseconds            *int
}

type ClusterSettings struct {
	Enable                *bool
	ClusterName           *string
	OverrideHostname      *string
	UseIpAddress          *bool
	UseExperimentalGossip *bool
	ReadOnlyConfig        *bool
	GossipPort            *int
	StreamingPort         *int
}

type MetricsSettings struct {
	Enable           *bool
	BlockProfileRate *int
	ListenAddress    *string
}

type AnalyticsSettings struct {
	MaxUsersForStatistics *int
}

type SSOSettings struct {
	Enable          bool
	Secret          string
	Id              string
	Scope           string
	AuthEndpoint    string
	TokenEndpoint   string
	UserApiEndpoint string
}

type SqlSettings struct {
	DriverName               string
	DataSource               string
	DataSourceReplicas       []string
	DataSourceSearchReplicas []string
	MaxIdleConns             int
	MaxOpenConns             int
	Trace                    bool
	AtRestEncryptKey         string
	QueryTimeout             *int
}

type LogSettings struct {
	EnableConsole          bool
	ConsoleLevel           string
	EnableFile             bool
	FileLevel              string
	FileFormat             string
	FileLocation           string
	EnableWebhookDebugging bool
	EnableDiagnostics      *bool
}

type PasswordSettings struct {
	MinimumLength *int
	Lowercase     *bool
	Number        *bool
	Uppercase     *bool
	Symbol        *bool
}

type FileSettings struct {
	EnableFileAttachments   *bool
	EnableMobileUpload      *bool
	EnableMobileDownload    *bool
	MaxFileSize             *int64
	DriverName              string
	Directory               string
	EnablePublicLink        bool
	PublicLinkSalt          *string
	InitialFont             string
	AmazonS3AccessKeyId     string
	AmazonS3SecretAccessKey string
	AmazonS3Bucket          string
	AmazonS3Region          string
	AmazonS3Endpoint        string
	AmazonS3SSL             *bool
	AmazonS3SignV2          *bool
	AmazonS3SSE             *bool
}

type EmailSettings struct {
	EnableSignUpWithEmail             bool
	EnableSignInWithEmail             *bool
	EnableSignInWithUsername          *bool
	SendEmailNotifications            bool
	RequireEmailVerification          bool
	FeedbackName                      string
	FeedbackEmail                     string
	FeedbackOrganization              *string
	EnableSMTPAuth                    *bool
	SMTPUsername                      string
	SMTPPassword                      string
	SMTPServer                        string
	SMTPPort                          string
	ConnectionSecurity                string
	InviteSalt                        string
	SendPushNotifications             *bool
	PushNotificationServer            *string
	PushNotificationContents          *string
	EnableEmailBatching               *bool
	EmailBatchingBufferSize           *int
	EmailBatchingInterval             *int
	SkipServerCertificateVerification *bool
	EmailNotificationContentsType     *string
}

type RateLimitSettings struct {
	Enable           *bool
	PerSec           int
	MaxBurst         *int
	MemoryStoreSize  int
	VaryByRemoteAddr bool
	VaryByHeader     string
}

type PrivacySettings struct {
	ShowEmailAddress bool
	ShowFullName     bool
}

type SupportSettings struct {
	TermsOfServiceLink       *string
	PrivacyPolicyLink        *string
	AboutLink                *string
	HelpLink                 *string
	ReportAProblemLink       *string
	AdministratorsGuideLink  *string
	TroubleshootingForumLink *string
	CommercialSupportLink    *string
	SupportEmail             *string
}

type AnnouncementSettings struct {
	EnableBanner         *bool
	BannerText           *string
	BannerColor          *string
	BannerTextColor      *string
	AllowBannerDismissal *bool
}

type TeamSettings struct {
	SiteName                            string
	MaxUsersPerTeam                     int
	EnableTeamCreation                  bool
	EnableUserCreation                  bool
	EnableOpenServer                    *bool
	RestrictCreationToDomains           string
	EnableCustomBrand                   *bool
	CustomBrandText                     *string
	CustomDescriptionText               *string
	RestrictDirectMessage               *string
	RestrictTeamInvite                  *string
	RestrictPublicChannelManagement     *string
	RestrictPrivateChannelManagement    *string
	RestrictPublicChannelCreation       *string
	RestrictPrivateChannelCreation      *string
	RestrictPublicChannelDeletion       *string
	RestrictPrivateChannelDeletion      *string
	RestrictPrivateChannelManageMembers *string
	UserStatusAwayTimeout               *int64
	MaxChannelsPerTeam                  *int64
	MaxNotificationsPerChannel          *int64
	TeammateNameDisplay                 *string
}

type LdapSettings struct {
	// Basic
	Enable             *bool
	LdapServer         *string
	LdapPort           *int
	ConnectionSecurity *string
	BaseDN             *string
	BindUsername       *string
	BindPassword       *string

	// Filtering
	UserFilter *string

	// User Mapping
	FirstNameAttribute *string
	LastNameAttribute  *string
	EmailAttribute     *string
	UsernameAttribute  *string
	NicknameAttribute  *string
	IdAttribute        *string
	PositionAttribute  *string

	// Syncronization
	SyncIntervalMinutes *int

	// Advanced
	SkipCertificateVerification *bool
	QueryTimeout                *int
	MaxPageSize                 *int

	// Customization
	LoginFieldName *string
}

type ComplianceSettings struct {
	Enable      *bool
	Directory   *string
	EnableDaily *bool
}

type LocalizationSettings struct {
	DefaultServerLocale *string
	DefaultClientLocale *string
	AvailableLocales    *string
}

type SamlSettings struct {
	// Basic
	Enable  *bool
	Verify  *bool
	Encrypt *bool

	IdpUrl                      *string
	IdpDescriptorUrl            *string
	AssertionConsumerServiceURL *string

	IdpCertificateFile    *string
	PublicCertificateFile *string
	PrivateKeyFile        *string

	// User Mapping
	FirstNameAttribute *string
	LastNameAttribute  *string
	EmailAttribute     *string
	UsernameAttribute  *string
	NicknameAttribute  *string
	LocaleAttribute    *string
	PositionAttribute  *string

	LoginButtonText *string
}

type NativeAppSettings struct {
	AppDownloadLink        *string
	AndroidAppDownloadLink *string
	IosAppDownloadLink     *string
}

type WebrtcSettings struct {
	Enable              *bool
	GatewayWebsocketUrl *string
	GatewayAdminUrl     *string
	GatewayAdminSecret  *string
	StunURI             *string
	TurnURI             *string
	TurnUsername        *string
	TurnSharedKey       *string
}

type ElasticsearchSettings struct {
	ConnectionUrl     *string
	Username          *string
	Password          *string
	EnableIndexing    *bool
	EnableSearching   *bool
	Sniff             *bool
	PostIndexReplicas *int
	PostIndexShards   *int
}

type DataRetentionSettings struct {
	Enable *bool
}

type JobSettings struct {
	RunJobs      *bool
	RunScheduler *bool
}

type PluginSettings struct {
	Plugins map[string]interface{}
}

type Config struct {
	ServiceSettings       ServiceSettings
	TeamSettings          TeamSettings
	SqlSettings           SqlSettings
	LogSettings           LogSettings
	PasswordSettings      PasswordSettings
	FileSettings          FileSettings
	EmailSettings         EmailSettings
	RateLimitSettings     RateLimitSettings
	PrivacySettings       PrivacySettings
	SupportSettings       SupportSettings
	AnnouncementSettings  AnnouncementSettings
	GitLabSettings        SSOSettings
	GoogleSettings        SSOSettings
	Office365Settings     SSOSettings
	LdapSettings          LdapSettings
	ComplianceSettings    ComplianceSettings
	LocalizationSettings  LocalizationSettings
	SamlSettings          SamlSettings
	NativeAppSettings     NativeAppSettings
	ClusterSettings       ClusterSettings
	MetricsSettings       MetricsSettings
	AnalyticsSettings     AnalyticsSettings
	WebrtcSettings        WebrtcSettings
	ElasticsearchSettings ElasticsearchSettings
	DataRetentionSettings DataRetentionSettings
	JobSettings           JobSettings
	PluginSettings        PluginSettings
}

func (o *Config) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func (o *Config) GetSSOService(service string) *SSOSettings {
	switch service {
	case SERVICE_GITLAB:
		return &o.GitLabSettings
	case SERVICE_GOOGLE:
		return &o.GoogleSettings
	case SERVICE_OFFICE365:
		return &o.Office365Settings
	}

	return nil
}

func ConfigFromJson(data io.Reader) *Config {
	decoder := json.NewDecoder(data)
	var o Config
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}

func (o *Config) SetDefaults() {

	if len(o.SqlSettings.AtRestEncryptKey) == 0 {
		o.SqlSettings.AtRestEncryptKey = NewRandomString(32)
	}

	if o.SqlSettings.QueryTimeout == nil {
		o.SqlSettings.QueryTimeout = new(int)
		*o.SqlSettings.QueryTimeout = 30
	}

	if o.FileSettings.AmazonS3Endpoint == "" {
		// Defaults to "s3.amazonaws.com"
		o.FileSettings.AmazonS3Endpoint = "s3.amazonaws.com"
	}

	if o.FileSettings.AmazonS3SSL == nil {
		o.FileSettings.AmazonS3SSL = new(bool)
		*o.FileSettings.AmazonS3SSL = true // Secure by default.
	}

	if o.FileSettings.AmazonS3SignV2 == nil {
		o.FileSettings.AmazonS3SignV2 = new(bool)
		// Signature v2 is not enabled by default.
	}

	if o.FileSettings.AmazonS3SSE == nil {
		o.FileSettings.AmazonS3SSE = new(bool)
		*o.FileSettings.AmazonS3SSE = false // Not Encrypted by default.
	}

	if o.FileSettings.EnableFileAttachments == nil {
		o.FileSettings.EnableFileAttachments = new(bool)
		*o.FileSettings.EnableFileAttachments = true
	}

	if o.FileSettings.EnableMobileUpload == nil {
		o.FileSettings.EnableMobileUpload = new(bool)
		*o.FileSettings.EnableMobileUpload = true
	}

	if o.FileSettings.EnableMobileDownload == nil {
		o.FileSettings.EnableMobileDownload = new(bool)
		*o.FileSettings.EnableMobileDownload = true
	}

	if o.FileSettings.MaxFileSize == nil {
		o.FileSettings.MaxFileSize = new(int64)
		*o.FileSettings.MaxFileSize = 52428800 // 50 MB
	}

	if o.FileSettings.PublicLinkSalt == nil || len(*o.FileSettings.PublicLinkSalt) == 0 {
		o.FileSettings.PublicLinkSalt = new(string)
		*o.FileSettings.PublicLinkSalt = NewRandomString(32)
	}

	if o.FileSettings.InitialFont == "" {
		// Defaults to "luximbi.ttf"
		o.FileSettings.InitialFont = "luximbi.ttf"
	}

	if o.FileSettings.Directory == "" {
		o.FileSettings.Directory = "./data/"
	}

	if len(o.EmailSettings.InviteSalt) == 0 {
		o.EmailSettings.InviteSalt = NewRandomString(32)
	}

	if o.ServiceSettings.SiteURL == nil {
		o.ServiceSettings.SiteURL = new(string)
		*o.ServiceSettings.SiteURL = SERVICE_SETTINGS_DEFAULT_SITE_URL
	}

	if o.ServiceSettings.LicenseFileLocation == nil {
		o.ServiceSettings.LicenseFileLocation = new(string)
	}

	if o.ServiceSettings.EnableAPIv3 == nil {
		o.ServiceSettings.EnableAPIv3 = new(bool)
		*o.ServiceSettings.EnableAPIv3 = true
	}

	if o.ServiceSettings.EnableLinkPreviews == nil {
		o.ServiceSettings.EnableLinkPreviews = new(bool)
		*o.ServiceSettings.EnableLinkPreviews = false
	}

	if o.ServiceSettings.EnableDeveloper == nil {
		o.ServiceSettings.EnableDeveloper = new(bool)
		*o.ServiceSettings.EnableDeveloper = false
	}

	if o.ServiceSettings.EnableSecurityFixAlert == nil {
		o.ServiceSettings.EnableSecurityFixAlert = new(bool)
		*o.ServiceSettings.EnableSecurityFixAlert = true
	}

	if o.ServiceSettings.EnableInsecureOutgoingConnections == nil {
		o.ServiceSettings.EnableInsecureOutgoingConnections = new(bool)
		*o.ServiceSettings.EnableInsecureOutgoingConnections = false
	}

	if o.ServiceSettings.AllowedUntrustedInternalConnections == nil {
		o.ServiceSettings.AllowedUntrustedInternalConnections = new(string)
	}

	if o.ServiceSettings.EnableMultifactorAuthentication == nil {
		o.ServiceSettings.EnableMultifactorAuthentication = new(bool)
		*o.ServiceSettings.EnableMultifactorAuthentication = false
	}

	if o.ServiceSettings.EnforceMultifactorAuthentication == nil {
		o.ServiceSettings.EnforceMultifactorAuthentication = new(bool)
		*o.ServiceSettings.EnforceMultifactorAuthentication = false
	}

	if o.ServiceSettings.EnableUserAccessTokens == nil {
		o.ServiceSettings.EnableUserAccessTokens = new(bool)
		*o.ServiceSettings.EnableUserAccessTokens = false
	}

	if o.PasswordSettings.MinimumLength == nil {
		o.PasswordSettings.MinimumLength = new(int)
		*o.PasswordSettings.MinimumLength = PASSWORD_MINIMUM_LENGTH
	}

	if o.PasswordSettings.Lowercase == nil {
		o.PasswordSettings.Lowercase = new(bool)
		*o.PasswordSettings.Lowercase = false
	}

	if o.PasswordSettings.Number == nil {
		o.PasswordSettings.Number = new(bool)
		*o.PasswordSettings.Number = false
	}

	if o.PasswordSettings.Uppercase == nil {
		o.PasswordSettings.Uppercase = new(bool)
		*o.PasswordSettings.Uppercase = false
	}

	if o.PasswordSettings.Symbol == nil {
		o.PasswordSettings.Symbol = new(bool)
		*o.PasswordSettings.Symbol = false
	}

	if o.TeamSettings.EnableCustomBrand == nil {
		o.TeamSettings.EnableCustomBrand = new(bool)
		*o.TeamSettings.EnableCustomBrand = false
	}

	if o.TeamSettings.CustomBrandText == nil {
		o.TeamSettings.CustomBrandText = new(string)
		*o.TeamSettings.CustomBrandText = TEAM_SETTINGS_DEFAULT_CUSTOM_BRAND_TEXT
	}

	if o.TeamSettings.CustomDescriptionText == nil {
		o.TeamSettings.CustomDescriptionText = new(string)
		*o.TeamSettings.CustomDescriptionText = TEAM_SETTINGS_DEFAULT_CUSTOM_DESCRIPTION_TEXT
	}

	if o.TeamSettings.EnableOpenServer == nil {
		o.TeamSettings.EnableOpenServer = new(bool)
		*o.TeamSettings.EnableOpenServer = false
	}

	if o.TeamSettings.RestrictDirectMessage == nil {
		o.TeamSettings.RestrictDirectMessage = new(string)
		*o.TeamSettings.RestrictDirectMessage = DIRECT_MESSAGE_ANY
	}

	if o.TeamSettings.RestrictTeamInvite == nil {
		o.TeamSettings.RestrictTeamInvite = new(string)
		*o.TeamSettings.RestrictTeamInvite = PERMISSIONS_ALL
	}

	if o.TeamSettings.RestrictPublicChannelManagement == nil {
		o.TeamSettings.RestrictPublicChannelManagement = new(string)
		*o.TeamSettings.RestrictPublicChannelManagement = PERMISSIONS_ALL
	}

	if o.TeamSettings.RestrictPrivateChannelManagement == nil {
		o.TeamSettings.RestrictPrivateChannelManagement = new(string)
		*o.TeamSettings.RestrictPrivateChannelManagement = PERMISSIONS_ALL
	}

	if o.TeamSettings.RestrictPublicChannelCreation == nil {
		o.TeamSettings.RestrictPublicChannelCreation = new(string)
		// If this setting does not exist, assume migration from <3.6, so use management setting as default.
		if *o.TeamSettings.RestrictPublicChannelManagement == PERMISSIONS_CHANNEL_ADMIN {
			*o.TeamSettings.RestrictPublicChannelCreation = PERMISSIONS_TEAM_ADMIN
		} else {
			*o.TeamSettings.RestrictPublicChannelCreation = *o.TeamSettings.RestrictPublicChannelManagement
		}
	}

	if o.TeamSettings.RestrictPrivateChannelCreation == nil {
		o.TeamSettings.RestrictPrivateChannelCreation = new(string)
		// If this setting does not exist, assume migration from <3.6, so use management setting as default.
		if *o.TeamSettings.RestrictPrivateChannelManagement == PERMISSIONS_CHANNEL_ADMIN {
			*o.TeamSettings.RestrictPrivateChannelCreation = PERMISSIONS_TEAM_ADMIN
		} else {
			*o.TeamSettings.RestrictPrivateChannelCreation = *o.TeamSettings.RestrictPrivateChannelManagement
		}
	}

	if o.TeamSettings.RestrictPublicChannelDeletion == nil {
		o.TeamSettings.RestrictPublicChannelDeletion = new(string)
		// If this setting does not exist, assume migration from <3.6, so use management setting as default.
		*o.TeamSettings.RestrictPublicChannelDeletion = *o.TeamSettings.RestrictPublicChannelManagement
	}

	if o.TeamSettings.RestrictPrivateChannelDeletion == nil {
		o.TeamSettings.RestrictPrivateChannelDeletion = new(string)
		// If this setting does not exist, assume migration from <3.6, so use management setting as default.
		*o.TeamSettings.RestrictPrivateChannelDeletion = *o.TeamSettings.RestrictPrivateChannelManagement
	}

	if o.TeamSettings.RestrictPrivateChannelManageMembers == nil {
		o.TeamSettings.RestrictPrivateChannelManageMembers = new(string)
		*o.TeamSettings.RestrictPrivateChannelManageMembers = PERMISSIONS_ALL
	}

	if o.TeamSettings.UserStatusAwayTimeout == nil {
		o.TeamSettings.UserStatusAwayTimeout = new(int64)
		*o.TeamSettings.UserStatusAwayTimeout = TEAM_SETTINGS_DEFAULT_USER_STATUS_AWAY_TIMEOUT
	}

	if o.TeamSettings.MaxChannelsPerTeam == nil {
		o.TeamSettings.MaxChannelsPerTeam = new(int64)
		*o.TeamSettings.MaxChannelsPerTeam = 2000
	}

	if o.TeamSettings.MaxNotificationsPerChannel == nil {
		o.TeamSettings.MaxNotificationsPerChannel = new(int64)
		*o.TeamSettings.MaxNotificationsPerChannel = 1000
	}

	if o.EmailSettings.EnableSignInWithEmail == nil {
		o.EmailSettings.EnableSignInWithEmail = new(bool)

		if o.EmailSettings.EnableSignUpWithEmail == true {
			*o.EmailSettings.EnableSignInWithEmail = true
		} else {
			*o.EmailSettings.EnableSignInWithEmail = false
		}
	}

	if o.EmailSettings.EnableSignInWithUsername == nil {
		o.EmailSettings.EnableSignInWithUsername = new(bool)
		*o.EmailSettings.EnableSignInWithUsername = false
	}

	if o.EmailSettings.SendPushNotifications == nil {
		o.EmailSettings.SendPushNotifications = new(bool)
		*o.EmailSettings.SendPushNotifications = false
	}

	if o.EmailSettings.PushNotificationServer == nil {
		o.EmailSettings.PushNotificationServer = new(string)
		*o.EmailSettings.PushNotificationServer = ""
	}

	if o.EmailSettings.PushNotificationContents == nil {
		o.EmailSettings.PushNotificationContents = new(string)
		*o.EmailSettings.PushNotificationContents = GENERIC_NOTIFICATION
	}

	if o.EmailSettings.FeedbackOrganization == nil {
		o.EmailSettings.FeedbackOrganization = new(string)
		*o.EmailSettings.FeedbackOrganization = EMAIL_SETTINGS_DEFAULT_FEEDBACK_ORGANIZATION
	}

	if o.EmailSettings.EnableEmailBatching == nil {
		o.EmailSettings.EnableEmailBatching = new(bool)
		*o.EmailSettings.EnableEmailBatching = false
	}

	if o.EmailSettings.EmailBatchingBufferSize == nil {
		o.EmailSettings.EmailBatchingBufferSize = new(int)
		*o.EmailSettings.EmailBatchingBufferSize = EMAIL_BATCHING_BUFFER_SIZE
	}

	if o.EmailSettings.EmailBatchingInterval == nil {
		o.EmailSettings.EmailBatchingInterval = new(int)
		*o.EmailSettings.EmailBatchingInterval = EMAIL_BATCHING_INTERVAL
	}

	if o.EmailSettings.EnableSMTPAuth == nil {
		o.EmailSettings.EnableSMTPAuth = new(bool)
		if o.EmailSettings.ConnectionSecurity == CONN_SECURITY_NONE {
			*o.EmailSettings.EnableSMTPAuth = false
		} else {
			*o.EmailSettings.EnableSMTPAuth = true
		}
	}

	if o.EmailSettings.ConnectionSecurity == CONN_SECURITY_PLAIN {
		o.EmailSettings.ConnectionSecurity = CONN_SECURITY_NONE
	}

	if o.EmailSettings.SkipServerCertificateVerification == nil {
		o.EmailSettings.SkipServerCertificateVerification = new(bool)
		*o.EmailSettings.SkipServerCertificateVerification = false
	}

	if o.EmailSettings.EmailNotificationContentsType == nil {
		o.EmailSettings.EmailNotificationContentsType = new(string)
		*o.EmailSettings.EmailNotificationContentsType = EMAIL_NOTIFICATION_CONTENTS_FULL
	}

	if !IsSafeLink(o.SupportSettings.TermsOfServiceLink) {
		*o.SupportSettings.TermsOfServiceLink = SUPPORT_SETTINGS_DEFAULT_TERMS_OF_SERVICE_LINK
	}

	if o.SupportSettings.TermsOfServiceLink == nil {
		o.SupportSettings.TermsOfServiceLink = new(string)
		*o.SupportSettings.TermsOfServiceLink = SUPPORT_SETTINGS_DEFAULT_TERMS_OF_SERVICE_LINK
	}

	if !IsSafeLink(o.SupportSettings.PrivacyPolicyLink) {
		*o.SupportSettings.PrivacyPolicyLink = ""
	}

	if o.SupportSettings.PrivacyPolicyLink == nil {
		o.SupportSettings.PrivacyPolicyLink = new(string)
		*o.SupportSettings.PrivacyPolicyLink = SUPPORT_SETTINGS_DEFAULT_PRIVACY_POLICY_LINK
	}

	if !IsSafeLink(o.SupportSettings.AboutLink) {
		*o.SupportSettings.AboutLink = ""
	}

	if o.SupportSettings.AboutLink == nil {
		o.SupportSettings.AboutLink = new(string)
		*o.SupportSettings.AboutLink = SUPPORT_SETTINGS_DEFAULT_ABOUT_LINK
	}

	if !IsSafeLink(o.SupportSettings.HelpLink) {
		*o.SupportSettings.HelpLink = ""
	}

	if o.SupportSettings.HelpLink == nil {
		o.SupportSettings.HelpLink = new(string)
		*o.SupportSettings.HelpLink = SUPPORT_SETTINGS_DEFAULT_HELP_LINK
	}

	if !IsSafeLink(o.SupportSettings.ReportAProblemLink) {
		*o.SupportSettings.ReportAProblemLink = ""
	}

	if o.SupportSettings.ReportAProblemLink == nil {
		o.SupportSettings.ReportAProblemLink = new(string)
		*o.SupportSettings.ReportAProblemLink = SUPPORT_SETTINGS_DEFAULT_REPORT_A_PROBLEM_LINK
	}

	if !IsSafeLink(o.SupportSettings.AdministratorsGuideLink) {
		*o.SupportSettings.AdministratorsGuideLink = ""
	}

	if o.SupportSettings.AdministratorsGuideLink == nil {
		o.SupportSettings.AdministratorsGuideLink = new(string)
		*o.SupportSettings.AdministratorsGuideLink = SUPPORT_SETTINGS_DEFAULT_ADMINISTRATORS_GUIDE_LINK
	}

	if !IsSafeLink(o.SupportSettings.TroubleshootingForumLink) {
		*o.SupportSettings.TroubleshootingForumLink = ""
	}

	if o.SupportSettings.TroubleshootingForumLink == nil {
		o.SupportSettings.TroubleshootingForumLink = new(string)
		*o.SupportSettings.TroubleshootingForumLink = SUPPORT_SETTINGS_DEFAULT_TROUBLESHOOTING_FORUM_LINK
	}

	if !IsSafeLink(o.SupportSettings.CommercialSupportLink) {
		*o.SupportSettings.CommercialSupportLink = ""
	}

	if o.SupportSettings.CommercialSupportLink == nil {
		o.SupportSettings.CommercialSupportLink = new(string)
		*o.SupportSettings.CommercialSupportLink = SUPPORT_SETTINGS_DEFAULT_COMMERCIAL_SUPPORT_LINK
	}

	if o.SupportSettings.SupportEmail == nil {
		o.SupportSettings.SupportEmail = new(string)
		*o.SupportSettings.SupportEmail = SUPPORT_SETTINGS_DEFAULT_SUPPORT_EMAIL
	}

	if o.AnnouncementSettings.EnableBanner == nil {
		o.AnnouncementSettings.EnableBanner = new(bool)
		*o.AnnouncementSettings.EnableBanner = false
	}

	if o.AnnouncementSettings.BannerText == nil {
		o.AnnouncementSettings.BannerText = new(string)
		*o.AnnouncementSettings.BannerText = ""
	}

	if o.AnnouncementSettings.BannerColor == nil {
		o.AnnouncementSettings.BannerColor = new(string)
		*o.AnnouncementSettings.BannerColor = ANNOUNCEMENT_SETTINGS_DEFAULT_BANNER_COLOR
	}

	if o.AnnouncementSettings.BannerTextColor == nil {
		o.AnnouncementSettings.BannerTextColor = new(string)
		*o.AnnouncementSettings.BannerTextColor = ANNOUNCEMENT_SETTINGS_DEFAULT_BANNER_TEXT_COLOR
	}

	if o.AnnouncementSettings.AllowBannerDismissal == nil {
		o.AnnouncementSettings.AllowBannerDismissal = new(bool)
		*o.AnnouncementSettings.AllowBannerDismissal = true
	}

	if o.LdapSettings.Enable == nil {
		o.LdapSettings.Enable = new(bool)
		*o.LdapSettings.Enable = false
	}

	if o.LdapSettings.LdapServer == nil {
		o.LdapSettings.LdapServer = new(string)
		*o.LdapSettings.LdapServer = ""
	}

	if o.LdapSettings.LdapPort == nil {
		o.LdapSettings.LdapPort = new(int)
		*o.LdapSettings.LdapPort = 389
	}

	if o.LdapSettings.ConnectionSecurity == nil {
		o.LdapSettings.ConnectionSecurity = new(string)
		*o.LdapSettings.ConnectionSecurity = ""
	}

	if o.LdapSettings.BaseDN == nil {
		o.LdapSettings.BaseDN = new(string)
		*o.LdapSettings.BaseDN = ""
	}

	if o.LdapSettings.BindUsername == nil {
		o.LdapSettings.BindUsername = new(string)
		*o.LdapSettings.BindUsername = ""
	}

	if o.LdapSettings.BindPassword == nil {
		o.LdapSettings.BindPassword = new(string)
		*o.LdapSettings.BindPassword = ""
	}

	if o.LdapSettings.UserFilter == nil {
		o.LdapSettings.UserFilter = new(string)
		*o.LdapSettings.UserFilter = ""
	}

	if o.LdapSettings.FirstNameAttribute == nil {
		o.LdapSettings.FirstNameAttribute = new(string)
		*o.LdapSettings.FirstNameAttribute = LDAP_SETTINGS_DEFAULT_FIRST_NAME_ATTRIBUTE
	}

	if o.LdapSettings.LastNameAttribute == nil {
		o.LdapSettings.LastNameAttribute = new(string)
		*o.LdapSettings.LastNameAttribute = LDAP_SETTINGS_DEFAULT_LAST_NAME_ATTRIBUTE
	}

	if o.LdapSettings.EmailAttribute == nil {
		o.LdapSettings.EmailAttribute = new(string)
		*o.LdapSettings.EmailAttribute = LDAP_SETTINGS_DEFAULT_EMAIL_ATTRIBUTE
	}

	if o.LdapSettings.UsernameAttribute == nil {
		o.LdapSettings.UsernameAttribute = new(string)
		*o.LdapSettings.UsernameAttribute = LDAP_SETTINGS_DEFAULT_USERNAME_ATTRIBUTE
	}

	if o.LdapSettings.NicknameAttribute == nil {
		o.LdapSettings.NicknameAttribute = new(string)
		*o.LdapSettings.NicknameAttribute = LDAP_SETTINGS_DEFAULT_NICKNAME_ATTRIBUTE
	}

	if o.LdapSettings.IdAttribute == nil {
		o.LdapSettings.IdAttribute = new(string)
		*o.LdapSettings.IdAttribute = LDAP_SETTINGS_DEFAULT_ID_ATTRIBUTE
	}

	if o.LdapSettings.PositionAttribute == nil {
		o.LdapSettings.PositionAttribute = new(string)
		*o.LdapSettings.PositionAttribute = LDAP_SETTINGS_DEFAULT_POSITION_ATTRIBUTE
	}

	if o.LdapSettings.SyncIntervalMinutes == nil {
		o.LdapSettings.SyncIntervalMinutes = new(int)
		*o.LdapSettings.SyncIntervalMinutes = 60
	}

	if o.LdapSettings.SkipCertificateVerification == nil {
		o.LdapSettings.SkipCertificateVerification = new(bool)
		*o.LdapSettings.SkipCertificateVerification = false
	}

	if o.LdapSettings.QueryTimeout == nil {
		o.LdapSettings.QueryTimeout = new(int)
		*o.LdapSettings.QueryTimeout = 60
	}

	if o.LdapSettings.MaxPageSize == nil {
		o.LdapSettings.MaxPageSize = new(int)
		*o.LdapSettings.MaxPageSize = 0
	}

	if o.LdapSettings.LoginFieldName == nil {
		o.LdapSettings.LoginFieldName = new(string)
		*o.LdapSettings.LoginFieldName = LDAP_SETTINGS_DEFAULT_LOGIN_FIELD_NAME
	}

	if o.ServiceSettings.SessionLengthWebInDays == nil {
		o.ServiceSettings.SessionLengthWebInDays = new(int)
		*o.ServiceSettings.SessionLengthWebInDays = 30
	}

	if o.ServiceSettings.SessionLengthMobileInDays == nil {
		o.ServiceSettings.SessionLengthMobileInDays = new(int)
		*o.ServiceSettings.SessionLengthMobileInDays = 30
	}

	if o.ServiceSettings.SessionLengthSSOInDays == nil {
		o.ServiceSettings.SessionLengthSSOInDays = new(int)
		*o.ServiceSettings.SessionLengthSSOInDays = 30
	}

	if o.ServiceSettings.SessionCacheInMinutes == nil {
		o.ServiceSettings.SessionCacheInMinutes = new(int)
		*o.ServiceSettings.SessionCacheInMinutes = 10
	}

	if o.ServiceSettings.EnableCommands == nil {
		o.ServiceSettings.EnableCommands = new(bool)
		*o.ServiceSettings.EnableCommands = false
	}

	if o.ServiceSettings.EnableOnlyAdminIntegrations == nil {
		o.ServiceSettings.EnableOnlyAdminIntegrations = new(bool)
		*o.ServiceSettings.EnableOnlyAdminIntegrations = true
	}

	if o.ServiceSettings.WebsocketPort == nil {
		o.ServiceSettings.WebsocketPort = new(int)
		*o.ServiceSettings.WebsocketPort = 80
	}

	if o.ServiceSettings.WebsocketSecurePort == nil {
		o.ServiceSettings.WebsocketSecurePort = new(int)
		*o.ServiceSettings.WebsocketSecurePort = 443
	}

	if o.ServiceSettings.AllowCorsFrom == nil {
		o.ServiceSettings.AllowCorsFrom = new(string)
		*o.ServiceSettings.AllowCorsFrom = SERVICE_SETTINGS_DEFAULT_ALLOW_CORS_FROM
	}

	if o.ServiceSettings.WebserverMode == nil {
		o.ServiceSettings.WebserverMode = new(string)
		*o.ServiceSettings.WebserverMode = "gzip"
	} else if *o.ServiceSettings.WebserverMode == "regular" {
		*o.ServiceSettings.WebserverMode = "gzip"
	}

	if o.ServiceSettings.EnableCustomEmoji == nil {
		o.ServiceSettings.EnableCustomEmoji = new(bool)
		*o.ServiceSettings.EnableCustomEmoji = false
	}

	if o.ServiceSettings.EnableEmojiPicker == nil {
		o.ServiceSettings.EnableEmojiPicker = new(bool)
		*o.ServiceSettings.EnableEmojiPicker = true
	}

	if o.ServiceSettings.RestrictCustomEmojiCreation == nil {
		o.ServiceSettings.RestrictCustomEmojiCreation = new(string)
		*o.ServiceSettings.RestrictCustomEmojiCreation = RESTRICT_EMOJI_CREATION_ALL
	}

	if o.ServiceSettings.RestrictPostDelete == nil {
		o.ServiceSettings.RestrictPostDelete = new(string)
		*o.ServiceSettings.RestrictPostDelete = PERMISSIONS_DELETE_POST_ALL
	}

	if o.ServiceSettings.AllowEditPost == nil {
		o.ServiceSettings.AllowEditPost = new(string)
		*o.ServiceSettings.AllowEditPost = ALLOW_EDIT_POST_ALWAYS
	}

	if o.ServiceSettings.PostEditTimeLimit == nil {
		o.ServiceSettings.PostEditTimeLimit = new(int)
		*o.ServiceSettings.PostEditTimeLimit = 300
	}

	if o.ClusterSettings.Enable == nil {
		o.ClusterSettings.Enable = new(bool)
		*o.ClusterSettings.Enable = false
	}

	if o.ClusterSettings.ClusterName == nil {
		o.ClusterSettings.ClusterName = new(string)
		*o.ClusterSettings.ClusterName = ""
	}

	if o.ClusterSettings.OverrideHostname == nil {
		o.ClusterSettings.OverrideHostname = new(string)
		*o.ClusterSettings.OverrideHostname = ""
	}

	if o.ClusterSettings.UseIpAddress == nil {
		o.ClusterSettings.UseIpAddress = new(bool)
		*o.ClusterSettings.UseIpAddress = true
	}

	if o.ClusterSettings.UseExperimentalGossip == nil {
		o.ClusterSettings.UseExperimentalGossip = new(bool)
		*o.ClusterSettings.UseExperimentalGossip = false
	}

	if o.ClusterSettings.ReadOnlyConfig == nil {
		o.ClusterSettings.ReadOnlyConfig = new(bool)
		*o.ClusterSettings.ReadOnlyConfig = true
	}

	if o.ClusterSettings.GossipPort == nil {
		o.ClusterSettings.GossipPort = new(int)
		*o.ClusterSettings.GossipPort = 8074
	}

	if o.ClusterSettings.StreamingPort == nil {
		o.ClusterSettings.StreamingPort = new(int)
		*o.ClusterSettings.StreamingPort = 8075
	}

	if o.MetricsSettings.ListenAddress == nil {
		o.MetricsSettings.ListenAddress = new(string)
		*o.MetricsSettings.ListenAddress = ":8067"
	}

	if o.MetricsSettings.Enable == nil {
		o.MetricsSettings.Enable = new(bool)
		*o.MetricsSettings.Enable = false
	}

	if o.AnalyticsSettings.MaxUsersForStatistics == nil {
		o.AnalyticsSettings.MaxUsersForStatistics = new(int)
		*o.AnalyticsSettings.MaxUsersForStatistics = ANALYTICS_SETTINGS_DEFAULT_MAX_USERS_FOR_STATISTICS
	}

	if o.ComplianceSettings.Enable == nil {
		o.ComplianceSettings.Enable = new(bool)
		*o.ComplianceSettings.Enable = false
	}

	if o.ComplianceSettings.Directory == nil {
		o.ComplianceSettings.Directory = new(string)
		*o.ComplianceSettings.Directory = "./data/"
	}

	if o.ComplianceSettings.EnableDaily == nil {
		o.ComplianceSettings.EnableDaily = new(bool)
		*o.ComplianceSettings.EnableDaily = false
	}

	if o.LocalizationSettings.DefaultServerLocale == nil {
		o.LocalizationSettings.DefaultServerLocale = new(string)
		*o.LocalizationSettings.DefaultServerLocale = DEFAULT_LOCALE
	}

	if o.LocalizationSettings.DefaultClientLocale == nil {
		o.LocalizationSettings.DefaultClientLocale = new(string)
		*o.LocalizationSettings.DefaultClientLocale = DEFAULT_LOCALE
	}

	if o.LocalizationSettings.AvailableLocales == nil {
		o.LocalizationSettings.AvailableLocales = new(string)
		*o.LocalizationSettings.AvailableLocales = ""
	}

	if o.LogSettings.EnableDiagnostics == nil {
		o.LogSettings.EnableDiagnostics = new(bool)
		*o.LogSettings.EnableDiagnostics = true
	}

	if o.SamlSettings.Enable == nil {
		o.SamlSettings.Enable = new(bool)
		*o.SamlSettings.Enable = false
	}

	if o.SamlSettings.Verify == nil {
		o.SamlSettings.Verify = new(bool)
		*o.SamlSettings.Verify = true
	}

	if o.SamlSettings.Encrypt == nil {
		o.SamlSettings.Encrypt = new(bool)
		*o.SamlSettings.Encrypt = true
	}

	if o.SamlSettings.IdpUrl == nil {
		o.SamlSettings.IdpUrl = new(string)
		*o.SamlSettings.IdpUrl = ""
	}

	if o.SamlSettings.IdpDescriptorUrl == nil {
		o.SamlSettings.IdpDescriptorUrl = new(string)
		*o.SamlSettings.IdpDescriptorUrl = ""
	}

	if o.SamlSettings.IdpCertificateFile == nil {
		o.SamlSettings.IdpCertificateFile = new(string)
		*o.SamlSettings.IdpCertificateFile = ""
	}

	if o.SamlSettings.PublicCertificateFile == nil {
		o.SamlSettings.PublicCertificateFile = new(string)
		*o.SamlSettings.PublicCertificateFile = ""
	}

	if o.SamlSettings.PrivateKeyFile == nil {
		o.SamlSettings.PrivateKeyFile = new(string)
		*o.SamlSettings.PrivateKeyFile = ""
	}

	if o.SamlSettings.AssertionConsumerServiceURL == nil {
		o.SamlSettings.AssertionConsumerServiceURL = new(string)
		*o.SamlSettings.AssertionConsumerServiceURL = ""
	}

	if o.SamlSettings.LoginButtonText == nil || *o.SamlSettings.LoginButtonText == "" {
		o.SamlSettings.LoginButtonText = new(string)
		*o.SamlSettings.LoginButtonText = USER_AUTH_SERVICE_SAML_TEXT
	}

	if o.SamlSettings.FirstNameAttribute == nil {
		o.SamlSettings.FirstNameAttribute = new(string)
		*o.SamlSettings.FirstNameAttribute = SAML_SETTINGS_DEFAULT_FIRST_NAME_ATTRIBUTE
	}

	if o.SamlSettings.LastNameAttribute == nil {
		o.SamlSettings.LastNameAttribute = new(string)
		*o.SamlSettings.LastNameAttribute = SAML_SETTINGS_DEFAULT_LAST_NAME_ATTRIBUTE
	}

	if o.SamlSettings.EmailAttribute == nil {
		o.SamlSettings.EmailAttribute = new(string)
		*o.SamlSettings.EmailAttribute = SAML_SETTINGS_DEFAULT_EMAIL_ATTRIBUTE
	}

	if o.SamlSettings.UsernameAttribute == nil {
		o.SamlSettings.UsernameAttribute = new(string)
		*o.SamlSettings.UsernameAttribute = SAML_SETTINGS_DEFAULT_USERNAME_ATTRIBUTE
	}

	if o.SamlSettings.NicknameAttribute == nil {
		o.SamlSettings.NicknameAttribute = new(string)
		*o.SamlSettings.NicknameAttribute = SAML_SETTINGS_DEFAULT_NICKNAME_ATTRIBUTE
	}

	if o.SamlSettings.PositionAttribute == nil {
		o.SamlSettings.PositionAttribute = new(string)
		*o.SamlSettings.PositionAttribute = SAML_SETTINGS_DEFAULT_POSITION_ATTRIBUTE
	}

	if o.SamlSettings.LocaleAttribute == nil {
		o.SamlSettings.LocaleAttribute = new(string)
		*o.SamlSettings.LocaleAttribute = SAML_SETTINGS_DEFAULT_LOCALE_ATTRIBUTE
	}

	if o.TeamSettings.TeammateNameDisplay == nil {
		o.TeamSettings.TeammateNameDisplay = new(string)
		*o.TeamSettings.TeammateNameDisplay = SHOW_USERNAME

		if *o.SamlSettings.Enable || *o.LdapSettings.Enable {
			*o.TeamSettings.TeammateNameDisplay = SHOW_FULLNAME
		}
	}

	if o.NativeAppSettings.AppDownloadLink == nil {
		o.NativeAppSettings.AppDownloadLink = new(string)
		*o.NativeAppSettings.AppDownloadLink = NATIVEAPP_SETTINGS_DEFAULT_APP_DOWNLOAD_LINK
	}

	if o.NativeAppSettings.AndroidAppDownloadLink == nil {
		o.NativeAppSettings.AndroidAppDownloadLink = new(string)
		*o.NativeAppSettings.AndroidAppDownloadLink = NATIVEAPP_SETTINGS_DEFAULT_ANDROID_APP_DOWNLOAD_LINK
	}

	if o.NativeAppSettings.IosAppDownloadLink == nil {
		o.NativeAppSettings.IosAppDownloadLink = new(string)
		*o.NativeAppSettings.IosAppDownloadLink = NATIVEAPP_SETTINGS_DEFAULT_IOS_APP_DOWNLOAD_LINK
	}

	if o.RateLimitSettings.Enable == nil {
		o.RateLimitSettings.Enable = new(bool)
		*o.RateLimitSettings.Enable = false
	}

	if o.ServiceSettings.GoroutineHealthThreshold == nil {
		o.ServiceSettings.GoroutineHealthThreshold = new(int)
		*o.ServiceSettings.GoroutineHealthThreshold = -1
	}

	if o.RateLimitSettings.MaxBurst == nil {
		o.RateLimitSettings.MaxBurst = new(int)
		*o.RateLimitSettings.MaxBurst = 100
	}

	if o.ServiceSettings.ConnectionSecurity == nil {
		o.ServiceSettings.ConnectionSecurity = new(string)
		*o.ServiceSettings.ConnectionSecurity = ""
	}

	if o.ServiceSettings.TLSKeyFile == nil {
		o.ServiceSettings.TLSKeyFile = new(string)
		*o.ServiceSettings.TLSKeyFile = SERVICE_SETTINGS_DEFAULT_TLS_KEY_FILE
	}

	if o.ServiceSettings.TLSCertFile == nil {
		o.ServiceSettings.TLSCertFile = new(string)
		*o.ServiceSettings.TLSCertFile = SERVICE_SETTINGS_DEFAULT_TLS_CERT_FILE
	}

	if o.ServiceSettings.UseLetsEncrypt == nil {
		o.ServiceSettings.UseLetsEncrypt = new(bool)
		*o.ServiceSettings.UseLetsEncrypt = false
	}

	if o.ServiceSettings.LetsEncryptCertificateCacheFile == nil {
		o.ServiceSettings.LetsEncryptCertificateCacheFile = new(string)
		*o.ServiceSettings.LetsEncryptCertificateCacheFile = "./config/letsencrypt.cache"
	}

	if o.ServiceSettings.ReadTimeout == nil {
		o.ServiceSettings.ReadTimeout = new(int)
		*o.ServiceSettings.ReadTimeout = SERVICE_SETTINGS_DEFAULT_READ_TIMEOUT
	}

	if o.ServiceSettings.WriteTimeout == nil {
		o.ServiceSettings.WriteTimeout = new(int)
		*o.ServiceSettings.WriteTimeout = SERVICE_SETTINGS_DEFAULT_WRITE_TIMEOUT
	}

	if o.ServiceSettings.Forward80To443 == nil {
		o.ServiceSettings.Forward80To443 = new(bool)
		*o.ServiceSettings.Forward80To443 = false
	}

	if o.MetricsSettings.BlockProfileRate == nil {
		o.MetricsSettings.BlockProfileRate = new(int)
		*o.MetricsSettings.BlockProfileRate = 0
	}

	if o.ServiceSettings.TimeBetweenUserTypingUpdatesMilliseconds == nil {
		o.ServiceSettings.TimeBetweenUserTypingUpdatesMilliseconds = new(int64)
		*o.ServiceSettings.TimeBetweenUserTypingUpdatesMilliseconds = 5000
	}

	if o.ServiceSettings.EnablePostSearch == nil {
		o.ServiceSettings.EnablePostSearch = new(bool)
		*o.ServiceSettings.EnablePostSearch = true
	}

	if o.ServiceSettings.EnableUserTypingMessages == nil {
		o.ServiceSettings.EnableUserTypingMessages = new(bool)
		*o.ServiceSettings.EnableUserTypingMessages = true
	}

	if o.ServiceSettings.EnableChannelViewedMessages == nil {
		o.ServiceSettings.EnableChannelViewedMessages = new(bool)
		*o.ServiceSettings.EnableChannelViewedMessages = true
	}

	if o.ServiceSettings.EnableUserStatuses == nil {
		o.ServiceSettings.EnableUserStatuses = new(bool)
		*o.ServiceSettings.EnableUserStatuses = true
	}

	if o.ServiceSettings.ClusterLogTimeoutMilliseconds == nil {
		o.ServiceSettings.ClusterLogTimeoutMilliseconds = new(int)
		*o.ServiceSettings.ClusterLogTimeoutMilliseconds = 2000
	}

	if o.ElasticsearchSettings.ConnectionUrl == nil {
		o.ElasticsearchSettings.ConnectionUrl = new(string)
		*o.ElasticsearchSettings.ConnectionUrl = ELASTICSEARCH_SETTINGS_DEFAULT_CONNECTION_URL
	}

	if o.ElasticsearchSettings.Username == nil {
		o.ElasticsearchSettings.Username = new(string)
		*o.ElasticsearchSettings.Username = ELASTICSEARCH_SETTINGS_DEFAULT_USERNAME
	}

	if o.ElasticsearchSettings.Password == nil {
		o.ElasticsearchSettings.Password = new(string)
		*o.ElasticsearchSettings.Password = ELASTICSEARCH_SETTINGS_DEFAULT_PASSWORD
	}

	if o.ElasticsearchSettings.EnableIndexing == nil {
		o.ElasticsearchSettings.EnableIndexing = new(bool)
		*o.ElasticsearchSettings.EnableIndexing = false
	}

	if o.ElasticsearchSettings.EnableSearching == nil {
		o.ElasticsearchSettings.EnableSearching = new(bool)
		*o.ElasticsearchSettings.EnableSearching = false
	}

	if o.ElasticsearchSettings.Sniff == nil {
		o.ElasticsearchSettings.Sniff = new(bool)
		*o.ElasticsearchSettings.Sniff = true
	}

	if o.ElasticsearchSettings.PostIndexReplicas == nil {
		o.ElasticsearchSettings.PostIndexReplicas = new(int)
		*o.ElasticsearchSettings.PostIndexReplicas = ELASTICSEARCH_SETTINGS_DEFAULT_POST_INDEX_REPLICAS
	}

	if o.ElasticsearchSettings.PostIndexShards == nil {
		o.ElasticsearchSettings.PostIndexShards = new(int)
		*o.ElasticsearchSettings.PostIndexShards = ELASTICSEARCH_SETTINGS_DEFAULT_POST_INDEX_SHARDS
	}

	if o.DataRetentionSettings.Enable == nil {
		o.DataRetentionSettings.Enable = new(bool)
		*o.DataRetentionSettings.Enable = false
	}

	if o.JobSettings.RunJobs == nil {
		o.JobSettings.RunJobs = new(bool)
		*o.JobSettings.RunJobs = true
	}

	if o.JobSettings.RunScheduler == nil {
		o.JobSettings.RunScheduler = new(bool)
		*o.JobSettings.RunScheduler = true
	}

	if o.PluginSettings.Plugins == nil {
		o.PluginSettings.Plugins = make(map[string]interface{})
	}

	o.defaultWebrtcSettings()
}

func (o *Config) IsValid() *AppError {

	if o.ServiceSettings.MaximumLoginAttempts <= 0 {
		return NewLocAppError("Config.IsValid", "model.config.is_valid.login_attempts.app_error", nil, "")
	}

	if len(*o.ServiceSettings.SiteURL) != 0 {
		if _, err := url.ParseRequestURI(*o.ServiceSettings.SiteURL); err != nil {
			return NewLocAppError("Config.IsValid", "model.config.is_valid.site_url.app_error", nil, "")
		}
	}

	if len(o.ServiceSettings.ListenAddress) == 0 {
		return NewLocAppError("Config.IsValid", "model.config.is_valid.listen_address.app_error", nil, "")
	}

	if *o.ClusterSettings.Enable && *o.EmailSettings.EnableEmailBatching {
		return NewLocAppError("Config.IsValid", "model.config.is_valid.cluster_email_batching.app_error", nil, "")
	}

	if len(*o.ServiceSettings.SiteURL) == 0 && *o.EmailSettings.EnableEmailBatching {
		return NewLocAppError("Config.IsValid", "model.config.is_valid.site_url_email_batching.app_error", nil, "")
	}

	if o.TeamSettings.MaxUsersPerTeam <= 0 {
		return NewLocAppError("Config.IsValid", "model.config.is_valid.max_users.app_error", nil, "")
	}

	if *o.TeamSettings.MaxChannelsPerTeam <= 0 {
		return NewLocAppError("Config.IsValid", "model.config.is_valid.max_channels.app_error", nil, "")
	}

	if *o.TeamSettings.MaxNotificationsPerChannel <= 0 {
		return NewLocAppError("Config.IsValid", "model.config.is_valid.max_notify_per_channel.app_error", nil, "")
	}

	if !(*o.TeamSettings.RestrictDirectMessage == DIRECT_MESSAGE_ANY || *o.TeamSettings.RestrictDirectMessage == DIRECT_MESSAGE_TEAM) {
		return NewLocAppError("Config.IsValid", "model.config.is_valid.restrict_direct_message.app_error", nil, "")
	}

	if !(*o.TeamSettings.TeammateNameDisplay == SHOW_FULLNAME || *o.TeamSettings.TeammateNameDisplay == SHOW_NICKNAME_FULLNAME || *o.TeamSettings.TeammateNameDisplay == SHOW_USERNAME) {
		return NewLocAppError("Config.IsValid", "model.config.is_valid.teammate_name_display.app_error", nil, "")
	}

	if len(o.SqlSettings.AtRestEncryptKey) < 32 {
		return NewLocAppError("Config.IsValid", "model.config.is_valid.encrypt_sql.app_error", nil, "")
	}

	if !(o.SqlSettings.DriverName == DATABASE_DRIVER_MYSQL || o.SqlSettings.DriverName == DATABASE_DRIVER_POSTGRES) {
		return NewLocAppError("Config.IsValid", "model.config.is_valid.sql_driver.app_error", nil, "")
	}

	if o.SqlSettings.MaxIdleConns <= 0 {
		return NewLocAppError("Config.IsValid", "model.config.is_valid.sql_idle.app_error", nil, "")
	}

	if *o.SqlSettings.QueryTimeout <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.sql_query_timeout.app_error", nil, "", http.StatusBadRequest)
	}

	if len(o.SqlSettings.DataSource) == 0 {
		return NewLocAppError("Config.IsValid", "model.config.is_valid.sql_data_src.app_error", nil, "")
	}

	if o.SqlSettings.MaxOpenConns <= 0 {
		return NewLocAppError("Config.IsValid", "model.config.is_valid.sql_max_conn.app_error", nil, "")
	}

	if *o.FileSettings.MaxFileSize <= 0 {
		return NewLocAppError("Config.IsValid", "model.config.is_valid.max_file_size.app_error", nil, "")
	}

	if !(o.FileSettings.DriverName == IMAGE_DRIVER_LOCAL || o.FileSettings.DriverName == IMAGE_DRIVER_S3) {
		return NewLocAppError("Config.IsValid", "model.config.is_valid.file_driver.app_error", nil, "")
	}

	if len(*o.FileSettings.PublicLinkSalt) < 32 {
		return NewLocAppError("Config.IsValid", "model.config.is_valid.file_salt.app_error", nil, "")
	}

	if !(o.EmailSettings.ConnectionSecurity == CONN_SECURITY_NONE || o.EmailSettings.ConnectionSecurity == CONN_SECURITY_TLS || o.EmailSettings.ConnectionSecurity == CONN_SECURITY_STARTTLS || o.EmailSettings.ConnectionSecurity == CONN_SECURITY_PLAIN) {
		return NewLocAppError("Config.IsValid", "model.config.is_valid.email_security.app_error", nil, "")
	}

	if len(o.EmailSettings.InviteSalt) < 32 {
		return NewLocAppError("Config.IsValid", "model.config.is_valid.email_salt.app_error", nil, "")
	}

	if *o.EmailSettings.EmailBatchingBufferSize <= 0 {
		return NewLocAppError("Config.IsValid", "model.config.is_valid.email_batching_buffer_size.app_error", nil, "")
	}

	if *o.EmailSettings.EmailBatchingInterval < 30 {
		return NewLocAppError("Config.IsValid", "model.config.is_valid.email_batching_interval.app_error", nil, "")
	}

	if !(*o.EmailSettings.EmailNotificationContentsType == EMAIL_NOTIFICATION_CONTENTS_FULL || *o.EmailSettings.EmailNotificationContentsType == EMAIL_NOTIFICATION_CONTENTS_GENERIC) {
		return NewLocAppError("Config.IsValid", "model.config.is_valid.email_notification_contents_type.app_error", nil, "")
	}

	if o.RateLimitSettings.MemoryStoreSize <= 0 {
		return NewLocAppError("Config.IsValid", "model.config.is_valid.rate_mem.app_error", nil, "")
	}

	if o.RateLimitSettings.PerSec <= 0 {
		return NewLocAppError("Config.IsValid", "model.config.is_valid.rate_sec.app_error", nil, "")
	}

	if !(*o.LdapSettings.ConnectionSecurity == CONN_SECURITY_NONE || *o.LdapSettings.ConnectionSecurity == CONN_SECURITY_TLS || *o.LdapSettings.ConnectionSecurity == CONN_SECURITY_STARTTLS) {
		return NewLocAppError("Config.IsValid", "model.config.is_valid.ldap_security.app_error", nil, "")
	}

	if *o.LdapSettings.SyncIntervalMinutes <= 0 {
		return NewLocAppError("Config.IsValid", "model.config.is_valid.ldap_sync_interval.app_error", nil, "")
	}

	if *o.LdapSettings.MaxPageSize < 0 {
		return NewLocAppError("Config.IsValid", "model.config.is_valid.ldap_max_page_size.app_error", nil, "")
	}

	if *o.LdapSettings.Enable {
		if *o.LdapSettings.LdapServer == "" {
			return NewLocAppError("Config.IsValid", "model.config.is_valid.ldap_server", nil, "")
		}

		if *o.LdapSettings.BaseDN == "" {
			return NewLocAppError("Config.IsValid", "model.config.is_valid.ldap_basedn", nil, "")
		}

		if *o.LdapSettings.EmailAttribute == "" {
			return NewLocAppError("Config.IsValid", "model.config.is_valid.ldap_email", nil, "")
		}

		if *o.LdapSettings.UsernameAttribute == "" {
			return NewLocAppError("Config.IsValid", "model.config.is_valid.ldap_username", nil, "")
		}

		if *o.LdapSettings.IdAttribute == "" {
			return NewLocAppError("Config.IsValid", "model.config.is_valid.ldap_id", nil, "")
		}
	}

	if *o.SamlSettings.Enable {
		if len(*o.SamlSettings.IdpUrl) == 0 || !IsValidHttpUrl(*o.SamlSettings.IdpUrl) {
			return NewLocAppError("Config.IsValid", "model.config.is_valid.saml_idp_url.app_error", nil, "")
		}

		if len(*o.SamlSettings.IdpDescriptorUrl) == 0 || !IsValidHttpUrl(*o.SamlSettings.IdpDescriptorUrl) {
			return NewLocAppError("Config.IsValid", "model.config.is_valid.saml_idp_descriptor_url.app_error", nil, "")
		}

		if len(*o.SamlSettings.IdpCertificateFile) == 0 {
			return NewLocAppError("Config.IsValid", "model.config.is_valid.saml_idp_cert.app_error", nil, "")
		}

		if len(*o.SamlSettings.EmailAttribute) == 0 {
			return NewLocAppError("Config.IsValid", "model.config.is_valid.saml_email_attribute.app_error", nil, "")
		}

		if len(*o.SamlSettings.UsernameAttribute) == 0 {
			return NewLocAppError("Config.IsValid", "model.config.is_valid.saml_username_attribute.app_error", nil, "")
		}

		if *o.SamlSettings.Verify {
			if len(*o.SamlSettings.AssertionConsumerServiceURL) == 0 || !IsValidHttpUrl(*o.SamlSettings.AssertionConsumerServiceURL) {
				return NewLocAppError("Config.IsValid", "model.config.is_valid.saml_assertion_consumer_service_url.app_error", nil, "")
			}
		}

		if *o.SamlSettings.Encrypt {
			if len(*o.SamlSettings.PrivateKeyFile) == 0 {
				return NewLocAppError("Config.IsValid", "model.config.is_valid.saml_private_key.app_error", nil, "")
			}

			if len(*o.SamlSettings.PublicCertificateFile) == 0 {
				return NewLocAppError("Config.IsValid", "model.config.is_valid.saml_public_cert.app_error", nil, "")
			}
		}

		if len(*o.SamlSettings.EmailAttribute) == 0 {
			return NewLocAppError("Config.IsValid", "model.config.is_valid.saml_email_attribute.app_error", nil, "")
		}
	}

	if *o.PasswordSettings.MinimumLength < PASSWORD_MINIMUM_LENGTH || *o.PasswordSettings.MinimumLength > PASSWORD_MAXIMUM_LENGTH {
		return NewLocAppError("Config.IsValid", "model.config.is_valid.password_length.app_error", map[string]interface{}{"MinLength": PASSWORD_MINIMUM_LENGTH, "MaxLength": PASSWORD_MAXIMUM_LENGTH}, "")
	}

	if len(o.TeamSettings.SiteName) > SITENAME_MAX_LENGTH {
		return NewLocAppError("Config.IsValid", "model.config.is_valid.sitename_length.app_error", map[string]interface{}{"MaxLength": SITENAME_MAX_LENGTH}, "")
	}

	if *o.RateLimitSettings.MaxBurst <= 0 {
		return NewLocAppError("Config.IsValid", "model.config.is_valid.max_burst.app_error", nil, "")
	}

	if err := o.isValidWebrtcSettings(); err != nil {
		return err
	}

	if !(*o.ServiceSettings.ConnectionSecurity == CONN_SECURITY_NONE || *o.ServiceSettings.ConnectionSecurity == CONN_SECURITY_TLS) {
		return NewLocAppError("Config.IsValid", "model.config.is_valid.webserver_security.app_error", nil, "")
	}

	if *o.ServiceSettings.ReadTimeout <= 0 {
		return NewLocAppError("Config.IsValid", "model.config.is_valid.read_timeout.app_error", nil, "")
	}

	if *o.ServiceSettings.WriteTimeout <= 0 {
		return NewLocAppError("Config.IsValid", "model.config.is_valid.write_timeout.app_error", nil, "")
	}

	if *o.ServiceSettings.TimeBetweenUserTypingUpdatesMilliseconds < 1000 {
		return NewLocAppError("Config.IsValid", "model.config.is_valid.time_between_user_typing.app_error", nil, "")
	}

	if *o.ElasticsearchSettings.EnableIndexing {
		if len(*o.ElasticsearchSettings.ConnectionUrl) == 0 {
			return NewLocAppError("Config.IsValid", "model.config.is_valid.elastic_search.connection_url.app_error", nil, "")
		}
	}

	if *o.ElasticsearchSettings.EnableSearching && !*o.ElasticsearchSettings.EnableIndexing {
		return NewLocAppError("Config.IsValid", "model.config.is_valid.elastic_search.enable_searching.app_error", nil, "")
	}

	return nil
}

func (o *Config) GetSanitizeOptions() map[string]bool {
	options := map[string]bool{}
	options["fullname"] = o.PrivacySettings.ShowFullName
	options["email"] = o.PrivacySettings.ShowEmailAddress

	return options
}

func (o *Config) Sanitize() {
	if o.LdapSettings.BindPassword != nil && len(*o.LdapSettings.BindPassword) > 0 {
		*o.LdapSettings.BindPassword = FAKE_SETTING
	}

	*o.FileSettings.PublicLinkSalt = FAKE_SETTING
	if len(o.FileSettings.AmazonS3SecretAccessKey) > 0 {
		o.FileSettings.AmazonS3SecretAccessKey = FAKE_SETTING
	}

	o.EmailSettings.InviteSalt = FAKE_SETTING
	if len(o.EmailSettings.SMTPPassword) > 0 {
		o.EmailSettings.SMTPPassword = FAKE_SETTING
	}

	if len(o.GitLabSettings.Secret) > 0 {
		o.GitLabSettings.Secret = FAKE_SETTING
	}

	o.SqlSettings.DataSource = FAKE_SETTING
	o.SqlSettings.AtRestEncryptKey = FAKE_SETTING

	for i := range o.SqlSettings.DataSourceReplicas {
		o.SqlSettings.DataSourceReplicas[i] = FAKE_SETTING
	}

	for i := range o.SqlSettings.DataSourceSearchReplicas {
		o.SqlSettings.DataSourceSearchReplicas[i] = FAKE_SETTING
	}

	*o.ElasticsearchSettings.Password = FAKE_SETTING
}

func (o *Config) defaultWebrtcSettings() {
	if o.WebrtcSettings.Enable == nil {
		o.WebrtcSettings.Enable = new(bool)
		*o.WebrtcSettings.Enable = false
	}

	if o.WebrtcSettings.GatewayWebsocketUrl == nil {
		o.WebrtcSettings.GatewayWebsocketUrl = new(string)
		*o.WebrtcSettings.GatewayWebsocketUrl = ""
	}

	if o.WebrtcSettings.GatewayAdminUrl == nil {
		o.WebrtcSettings.GatewayAdminUrl = new(string)
		*o.WebrtcSettings.GatewayAdminUrl = ""
	}

	if o.WebrtcSettings.GatewayAdminSecret == nil {
		o.WebrtcSettings.GatewayAdminSecret = new(string)
		*o.WebrtcSettings.GatewayAdminSecret = ""
	}

	if o.WebrtcSettings.StunURI == nil {
		o.WebrtcSettings.StunURI = new(string)
		*o.WebrtcSettings.StunURI = WEBRTC_SETTINGS_DEFAULT_STUN_URI
	}

	if o.WebrtcSettings.TurnURI == nil {
		o.WebrtcSettings.TurnURI = new(string)
		*o.WebrtcSettings.TurnURI = WEBRTC_SETTINGS_DEFAULT_TURN_URI
	}

	if o.WebrtcSettings.TurnUsername == nil {
		o.WebrtcSettings.TurnUsername = new(string)
		*o.WebrtcSettings.TurnUsername = ""
	}

	if o.WebrtcSettings.TurnSharedKey == nil {
		o.WebrtcSettings.TurnSharedKey = new(string)
		*o.WebrtcSettings.TurnSharedKey = ""
	}
}

func (o *Config) isValidWebrtcSettings() *AppError {
	if *o.WebrtcSettings.Enable {
		if len(*o.WebrtcSettings.GatewayWebsocketUrl) == 0 || !IsValidWebsocketUrl(*o.WebrtcSettings.GatewayWebsocketUrl) {
			return NewLocAppError("Config.IsValid", "model.config.is_valid.webrtc_gateway_ws_url.app_error", nil, "")
		} else if len(*o.WebrtcSettings.GatewayAdminUrl) == 0 || !IsValidHttpUrl(*o.WebrtcSettings.GatewayAdminUrl) {
			return NewLocAppError("Config.IsValid", "model.config.is_valid.webrtc_gateway_admin_url.app_error", nil, "")
		} else if len(*o.WebrtcSettings.GatewayAdminSecret) == 0 {
			return NewLocAppError("Config.IsValid", "model.config.is_valid.webrtc_gateway_admin_secret.app_error", nil, "")
		} else if len(*o.WebrtcSettings.StunURI) != 0 && !IsValidTurnOrStunServer(*o.WebrtcSettings.StunURI) {
			return NewLocAppError("Config.IsValid", "model.config.is_valid.webrtc_stun_uri.app_error", nil, "")
		} else if len(*o.WebrtcSettings.TurnURI) != 0 {
			if !IsValidTurnOrStunServer(*o.WebrtcSettings.TurnURI) {
				return NewLocAppError("Config.IsValid", "model.config.is_valid.webrtc_turn_uri.app_error", nil, "")
			}
			if len(*o.WebrtcSettings.TurnUsername) == 0 {
				return NewLocAppError("Config.IsValid", "model.config.is_valid.webrtc_turn_username.app_error", nil, "")
			} else if len(*o.WebrtcSettings.TurnSharedKey) == 0 {
				return NewLocAppError("Config.IsValid", "model.config.is_valid.webrtc_turn_shared_key.app_error", nil, "")
			}

		}
	}

	return nil
}
