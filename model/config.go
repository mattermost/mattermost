// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
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

	SERVICE_SETTINGS_DEFAULT_SITE_URL           = ""
	SERVICE_SETTINGS_DEFAULT_TLS_CERT_FILE      = ""
	SERVICE_SETTINGS_DEFAULT_TLS_KEY_FILE       = ""
	SERVICE_SETTINGS_DEFAULT_READ_TIMEOUT       = 300
	SERVICE_SETTINGS_DEFAULT_WRITE_TIMEOUT      = 300
	SERVICE_SETTINGS_DEFAULT_MAX_LOGIN_ATTEMPTS = 10
	SERVICE_SETTINGS_DEFAULT_ALLOW_CORS_FROM    = ""
	SERVICE_SETTINGS_DEFAULT_LISTEN_AND_ADDRESS = ":8065"

	TEAM_SETTINGS_DEFAULT_MAX_USERS_PER_TEAM       = 50
	TEAM_SETTINGS_DEFAULT_CUSTOM_BRAND_TEXT        = ""
	TEAM_SETTINGS_DEFAULT_CUSTOM_DESCRIPTION_TEXT  = ""
	TEAM_SETTINGS_DEFAULT_USER_STATUS_AWAY_TIMEOUT = 300

	SQL_SETTINGS_DEFAULT_DATA_SOURCE = "mmuser:mostest@tcp(dockerhost:3306)/mattermost_test?charset=utf8mb4,utf8&readTimeout=30s&writeTimeout=30s"

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

	TEAM_SETTINGS_DEFAULT_TEAM_TEXT = "default"

	ELASTICSEARCH_SETTINGS_DEFAULT_CONNECTION_URL                    = ""
	ELASTICSEARCH_SETTINGS_DEFAULT_USERNAME                          = ""
	ELASTICSEARCH_SETTINGS_DEFAULT_PASSWORD                          = ""
	ELASTICSEARCH_SETTINGS_DEFAULT_POST_INDEX_REPLICAS               = 1
	ELASTICSEARCH_SETTINGS_DEFAULT_POST_INDEX_SHARDS                 = 1
	ELASTICSEARCH_SETTINGS_DEFAULT_AGGREGATE_POSTS_AFTER_DAYS        = 365
	ELASTICSEARCH_SETTINGS_DEFAULT_POSTS_AGGREGATOR_JOB_START_TIME   = "03:00"
	ELASTICSEARCH_SETTINGS_DEFAULT_INDEX_PREFIX                      = ""
	ELASTICSEARCH_SETTINGS_DEFAULT_LIVE_INDEXING_BATCH_SIZE          = 1
	ELASTICSEARCH_SETTINGS_DEFAULT_BULK_INDEXING_TIME_WINDOW_SECONDS = 3600

	DATA_RETENTION_SETTINGS_DEFAULT_MESSAGE_RETENTION_DAYS  = 365
	DATA_RETENTION_SETTINGS_DEFAULT_FILE_RETENTION_DAYS     = 365
	DATA_RETENTION_SETTINGS_DEFAULT_DELETION_JOB_START_TIME = "02:00"
)

type ServiceSettings struct {
	SiteURL                                  *string
	LicenseFileLocation                      *string
	ListenAddress                            *string
	ConnectionSecurity                       *string
	TLSCertFile                              *string
	TLSKeyFile                               *string
	UseLetsEncrypt                           *bool
	LetsEncryptCertificateCacheFile          *string
	Forward80To443                           *bool
	ReadTimeout                              *int
	WriteTimeout                             *int
	MaximumLoginAttempts                     *int
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
	SessionIdleTimeoutInMinutes              *int
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
	DriverName               *string
	DataSource               *string
	DataSourceReplicas       []string
	DataSourceSearchReplicas []string
	MaxIdleConns             *int
	MaxOpenConns             *int
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
	DriverName              *string
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
	AmazonS3Trace           *bool
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
	PerSec           *int
	MaxBurst         *int
	MemoryStoreSize  *int
	VaryByRemoteAddr bool
	VaryByHeader     string
}

type PrivacySettings struct {
	ShowEmailAddress bool
	ShowFullName     bool
}

type SupportSettings struct {
	TermsOfServiceLink *string
	PrivacyPolicyLink  *string
	AboutLink          *string
	HelpLink           *string
	ReportAProblemLink *string
	SupportEmail       *string
}

type AnnouncementSettings struct {
	EnableBanner         *bool
	BannerText           *string
	BannerColor          *string
	BannerTextColor      *string
	AllowBannerDismissal *bool
}

type ThemeSettings struct {
	EnableThemeSelection *bool
	DefaultTheme         *string
	AllowCustomThemes    *bool
	AllowedThemes        []string
}

type TeamSettings struct {
	SiteName                            string
	MaxUsersPerTeam                     *int
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
	EnableXToLeaveChannelsFromLHS       *bool
	UserStatusAwayTimeout               *int64
	MaxChannelsPerTeam                  *int64
	MaxNotificationsPerChannel          *int64
	EnableConfirmNotificationsToChannel *bool
	TeammateNameDisplay                 *string
	ExperimentalTownSquareIsReadOnly    *bool
}

type ClientRequirements struct {
	AndroidLatestVersion string
	AndroidMinVersion    string
	DesktopLatestVersion string
	DesktopMinVersion    string
	IosLatestVersion     string
	IosMinVersion        string
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
	GatewayType         *string
	GatewayWebsocketUrl *string
	GatewayAdminUrl     *string
	GatewayAdminSecret  *string
	StunURI             *string
	TurnURI             *string
	TurnUsername        *string
	TurnSharedKey       *string
}

type ElasticsearchSettings struct {
	ConnectionUrl                 *string
	Username                      *string
	Password                      *string
	EnableIndexing                *bool
	EnableSearching               *bool
	Sniff                         *bool
	PostIndexReplicas             *int
	PostIndexShards               *int
	AggregatePostsAfterDays       *int
	PostsAggregatorJobStartTime   *string
	IndexPrefix                   *string
	LiveIndexingBatchSize         *int
	BulkIndexingTimeWindowSeconds *int
}

type DataRetentionSettings struct {
	EnableMessageDeletion *bool
	EnableFileDeletion    *bool
	MessageRetentionDays  *int
	FileRetentionDays     *int
	DeletionJobStartTime  *string
}

type JobSettings struct {
	RunJobs      *bool
	RunScheduler *bool
}

type PluginState struct {
	Enable bool
}

type PluginSettings struct {
	Enable        *bool
	EnableUploads *bool
	Plugins       map[string]interface{}
	PluginStates  map[string]*PluginState
}

type Config struct {
	ServiceSettings       ServiceSettings
	TeamSettings          TeamSettings
	ClientRequirements    ClientRequirements
	SqlSettings           SqlSettings
	LogSettings           LogSettings
	PasswordSettings      PasswordSettings
	FileSettings          FileSettings
	EmailSettings         EmailSettings
	RateLimitSettings     RateLimitSettings
	PrivacySettings       PrivacySettings
	SupportSettings       SupportSettings
	AnnouncementSettings  AnnouncementSettings
	ThemeSettings         ThemeSettings
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

func (o *Config) Clone() *Config {
	var ret Config
	if err := json.Unmarshal([]byte(o.ToJson()), &ret); err != nil {
		panic(err)
	}
	return &ret
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

func (o *Config) getClientRequirementsFromConfig() ClientRequirements {
	return o.ClientRequirements
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

	if o.SqlSettings.DriverName == nil {
		o.SqlSettings.DriverName = NewString(DATABASE_DRIVER_MYSQL)
	}

	if o.SqlSettings.DataSource == nil {
		o.SqlSettings.DataSource = NewString(SQL_SETTINGS_DEFAULT_DATA_SOURCE)
	}

	if len(o.SqlSettings.AtRestEncryptKey) == 0 {
		o.SqlSettings.AtRestEncryptKey = NewRandomString(32)
	}

	if o.SqlSettings.MaxIdleConns == nil {
		o.SqlSettings.MaxIdleConns = NewInt(20)
	}

	if o.SqlSettings.MaxOpenConns == nil {
		o.SqlSettings.MaxOpenConns = NewInt(300)
	}

	if o.SqlSettings.QueryTimeout == nil {
		o.SqlSettings.QueryTimeout = NewInt(30)
	}

	if o.FileSettings.DriverName == nil {
		o.FileSettings.DriverName = NewString(IMAGE_DRIVER_LOCAL)
	}

	if o.FileSettings.AmazonS3Endpoint == "" {
		// Defaults to "s3.amazonaws.com"
		o.FileSettings.AmazonS3Endpoint = "s3.amazonaws.com"
	}

	if o.FileSettings.AmazonS3SSL == nil {
		o.FileSettings.AmazonS3SSL = NewBool(true) // Secure by default.
	}

	if o.FileSettings.AmazonS3SignV2 == nil {
		o.FileSettings.AmazonS3SignV2 = new(bool)
		// Signature v2 is not enabled by default.
	}

	if o.FileSettings.AmazonS3SSE == nil {
		o.FileSettings.AmazonS3SSE = NewBool(false) // Not Encrypted by default.
	}

	if o.FileSettings.AmazonS3Trace == nil {
		o.FileSettings.AmazonS3Trace = NewBool(false)
	}

	if o.FileSettings.EnableFileAttachments == nil {
		o.FileSettings.EnableFileAttachments = NewBool(true)
	}

	if o.FileSettings.EnableMobileUpload == nil {
		o.FileSettings.EnableMobileUpload = NewBool(true)
	}

	if o.FileSettings.EnableMobileDownload == nil {
		o.FileSettings.EnableMobileDownload = NewBool(true)
	}

	if o.FileSettings.MaxFileSize == nil {
		o.FileSettings.MaxFileSize = NewInt64(52428800) // 50 MB
	}

	if o.FileSettings.PublicLinkSalt == nil || len(*o.FileSettings.PublicLinkSalt) == 0 {
		o.FileSettings.PublicLinkSalt = NewString(NewRandomString(32))
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
		o.ServiceSettings.SiteURL = NewString(SERVICE_SETTINGS_DEFAULT_SITE_URL)
	}

	if o.ServiceSettings.LicenseFileLocation == nil {
		o.ServiceSettings.LicenseFileLocation = NewString("")
	}

	if o.ServiceSettings.ListenAddress == nil {
		o.ServiceSettings.ListenAddress = NewString(SERVICE_SETTINGS_DEFAULT_LISTEN_AND_ADDRESS)
	}

	if o.ServiceSettings.EnableAPIv3 == nil {
		o.ServiceSettings.EnableAPIv3 = NewBool(true)
	}

	if o.ServiceSettings.EnableLinkPreviews == nil {
		o.ServiceSettings.EnableLinkPreviews = NewBool(false)
	}

	if o.ServiceSettings.EnableDeveloper == nil {
		o.ServiceSettings.EnableDeveloper = NewBool(false)
	}

	if o.ServiceSettings.EnableSecurityFixAlert == nil {
		o.ServiceSettings.EnableSecurityFixAlert = NewBool(true)
	}

	if o.ServiceSettings.EnableInsecureOutgoingConnections == nil {
		o.ServiceSettings.EnableInsecureOutgoingConnections = NewBool(false)
	}

	if o.ServiceSettings.AllowedUntrustedInternalConnections == nil {
		o.ServiceSettings.AllowedUntrustedInternalConnections = new(string)
	}

	if o.ServiceSettings.EnableMultifactorAuthentication == nil {
		o.ServiceSettings.EnableMultifactorAuthentication = NewBool(false)
	}

	if o.ServiceSettings.EnforceMultifactorAuthentication == nil {
		o.ServiceSettings.EnforceMultifactorAuthentication = NewBool(false)
	}

	if o.ServiceSettings.EnableUserAccessTokens == nil {
		o.ServiceSettings.EnableUserAccessTokens = NewBool(false)
	}

	if o.PasswordSettings.MinimumLength == nil {
		o.PasswordSettings.MinimumLength = NewInt(PASSWORD_MINIMUM_LENGTH)
	}

	if o.PasswordSettings.Lowercase == nil {
		o.PasswordSettings.Lowercase = NewBool(false)
	}

	if o.PasswordSettings.Number == nil {
		o.PasswordSettings.Number = NewBool(false)
	}

	if o.PasswordSettings.Uppercase == nil {
		o.PasswordSettings.Uppercase = NewBool(false)
	}

	if o.PasswordSettings.Symbol == nil {
		o.PasswordSettings.Symbol = NewBool(false)
	}

	if o.TeamSettings.MaxUsersPerTeam == nil {
		o.TeamSettings.MaxUsersPerTeam = NewInt(TEAM_SETTINGS_DEFAULT_MAX_USERS_PER_TEAM)
	}

	if o.TeamSettings.EnableCustomBrand == nil {
		o.TeamSettings.EnableCustomBrand = NewBool(false)
	}

	if o.TeamSettings.CustomBrandText == nil {
		o.TeamSettings.CustomBrandText = NewString(TEAM_SETTINGS_DEFAULT_CUSTOM_BRAND_TEXT)
	}

	if o.TeamSettings.CustomDescriptionText == nil {
		o.TeamSettings.CustomDescriptionText = NewString(TEAM_SETTINGS_DEFAULT_CUSTOM_DESCRIPTION_TEXT)
	}

	if o.TeamSettings.EnableOpenServer == nil {
		o.TeamSettings.EnableOpenServer = NewBool(false)
	}

	if o.TeamSettings.RestrictDirectMessage == nil {
		o.TeamSettings.RestrictDirectMessage = NewString(DIRECT_MESSAGE_ANY)
	}

	if o.TeamSettings.RestrictTeamInvite == nil {
		o.TeamSettings.RestrictTeamInvite = NewString(PERMISSIONS_ALL)
	}

	if o.TeamSettings.RestrictPublicChannelManagement == nil {
		o.TeamSettings.RestrictPublicChannelManagement = NewString(PERMISSIONS_ALL)
	}

	if o.TeamSettings.RestrictPrivateChannelManagement == nil {
		o.TeamSettings.RestrictPrivateChannelManagement = NewString(PERMISSIONS_ALL)
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
		// If this setting does not exist, assume migration from <3.6, so use management setting as default.
		o.TeamSettings.RestrictPublicChannelDeletion = NewString(*o.TeamSettings.RestrictPublicChannelManagement)
	}

	if o.TeamSettings.RestrictPrivateChannelDeletion == nil {
		// If this setting does not exist, assume migration from <3.6, so use management setting as default.
		o.TeamSettings.RestrictPrivateChannelDeletion = NewString(*o.TeamSettings.RestrictPrivateChannelManagement)
	}

	if o.TeamSettings.RestrictPrivateChannelManageMembers == nil {
		o.TeamSettings.RestrictPrivateChannelManageMembers = NewString(PERMISSIONS_ALL)
	}

	if o.TeamSettings.EnableXToLeaveChannelsFromLHS == nil {
		o.TeamSettings.EnableXToLeaveChannelsFromLHS = NewBool(false)
	}

	if o.TeamSettings.UserStatusAwayTimeout == nil {
		o.TeamSettings.UserStatusAwayTimeout = NewInt64(TEAM_SETTINGS_DEFAULT_USER_STATUS_AWAY_TIMEOUT)
	}

	if o.TeamSettings.MaxChannelsPerTeam == nil {
		o.TeamSettings.MaxChannelsPerTeam = NewInt64(2000)
	}

	if o.TeamSettings.MaxNotificationsPerChannel == nil {
		o.TeamSettings.MaxNotificationsPerChannel = NewInt64(1000)
	}

	if o.TeamSettings.EnableConfirmNotificationsToChannel == nil {
		o.TeamSettings.EnableConfirmNotificationsToChannel = NewBool(true)
	}

	if o.TeamSettings.ExperimentalTownSquareIsReadOnly == nil {
		o.TeamSettings.ExperimentalTownSquareIsReadOnly = NewBool(false)
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
		o.EmailSettings.EnableSignInWithUsername = NewBool(false)
	}

	if o.EmailSettings.SendPushNotifications == nil {
		o.EmailSettings.SendPushNotifications = NewBool(false)
	}

	if o.EmailSettings.PushNotificationServer == nil {
		o.EmailSettings.PushNotificationServer = NewString("")
	}

	if o.EmailSettings.PushNotificationContents == nil {
		o.EmailSettings.PushNotificationContents = NewString(GENERIC_NOTIFICATION)
	}

	if o.EmailSettings.FeedbackOrganization == nil {
		o.EmailSettings.FeedbackOrganization = NewString(EMAIL_SETTINGS_DEFAULT_FEEDBACK_ORGANIZATION)
	}

	if o.EmailSettings.EnableEmailBatching == nil {
		o.EmailSettings.EnableEmailBatching = NewBool(false)
	}

	if o.EmailSettings.EmailBatchingBufferSize == nil {
		o.EmailSettings.EmailBatchingBufferSize = NewInt(EMAIL_BATCHING_BUFFER_SIZE)
	}

	if o.EmailSettings.EmailBatchingInterval == nil {
		o.EmailSettings.EmailBatchingInterval = NewInt(EMAIL_BATCHING_INTERVAL)
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
		o.EmailSettings.SkipServerCertificateVerification = NewBool(false)
	}

	if o.EmailSettings.EmailNotificationContentsType == nil {
		o.EmailSettings.EmailNotificationContentsType = NewString(EMAIL_NOTIFICATION_CONTENTS_FULL)
	}

	if !IsSafeLink(o.SupportSettings.TermsOfServiceLink) {
		*o.SupportSettings.TermsOfServiceLink = SUPPORT_SETTINGS_DEFAULT_TERMS_OF_SERVICE_LINK
	}

	if o.SupportSettings.TermsOfServiceLink == nil {
		o.SupportSettings.TermsOfServiceLink = NewString(SUPPORT_SETTINGS_DEFAULT_TERMS_OF_SERVICE_LINK)
	}

	if !IsSafeLink(o.SupportSettings.PrivacyPolicyLink) {
		*o.SupportSettings.PrivacyPolicyLink = ""
	}

	if o.SupportSettings.PrivacyPolicyLink == nil {
		o.SupportSettings.PrivacyPolicyLink = NewString(SUPPORT_SETTINGS_DEFAULT_PRIVACY_POLICY_LINK)
	}

	if !IsSafeLink(o.SupportSettings.AboutLink) {
		*o.SupportSettings.AboutLink = ""
	}

	if o.SupportSettings.AboutLink == nil {
		o.SupportSettings.AboutLink = NewString(SUPPORT_SETTINGS_DEFAULT_ABOUT_LINK)
	}

	if !IsSafeLink(o.SupportSettings.HelpLink) {
		*o.SupportSettings.HelpLink = ""
	}

	if o.SupportSettings.HelpLink == nil {
		o.SupportSettings.HelpLink = NewString(SUPPORT_SETTINGS_DEFAULT_HELP_LINK)
	}

	if !IsSafeLink(o.SupportSettings.ReportAProblemLink) {
		*o.SupportSettings.ReportAProblemLink = ""
	}

	if o.SupportSettings.ReportAProblemLink == nil {
		o.SupportSettings.ReportAProblemLink = NewString(SUPPORT_SETTINGS_DEFAULT_REPORT_A_PROBLEM_LINK)
	}

	if o.SupportSettings.SupportEmail == nil {
		o.SupportSettings.SupportEmail = NewString(SUPPORT_SETTINGS_DEFAULT_SUPPORT_EMAIL)
	}

	if o.AnnouncementSettings.EnableBanner == nil {
		o.AnnouncementSettings.EnableBanner = NewBool(false)
	}

	if o.AnnouncementSettings.BannerText == nil {
		o.AnnouncementSettings.BannerText = NewString("")
	}

	if o.AnnouncementSettings.BannerColor == nil {
		o.AnnouncementSettings.BannerColor = NewString(ANNOUNCEMENT_SETTINGS_DEFAULT_BANNER_COLOR)
	}

	if o.AnnouncementSettings.BannerTextColor == nil {
		o.AnnouncementSettings.BannerTextColor = NewString(ANNOUNCEMENT_SETTINGS_DEFAULT_BANNER_TEXT_COLOR)
	}

	if o.AnnouncementSettings.AllowBannerDismissal == nil {
		o.AnnouncementSettings.AllowBannerDismissal = NewBool(true)
	}

	if o.ThemeSettings.EnableThemeSelection == nil {
		o.ThemeSettings.EnableThemeSelection = NewBool(true)
	}

	if o.ThemeSettings.DefaultTheme == nil {
		o.ThemeSettings.DefaultTheme = NewString(TEAM_SETTINGS_DEFAULT_TEAM_TEXT)
	}

	if o.ThemeSettings.AllowCustomThemes == nil {
		o.ThemeSettings.AllowCustomThemes = NewBool(true)
	}

	if o.ThemeSettings.AllowedThemes == nil {
		o.ThemeSettings.AllowedThemes = []string{}
	}

	if o.LdapSettings.Enable == nil {
		o.LdapSettings.Enable = NewBool(false)
	}

	if o.LdapSettings.LdapServer == nil {
		o.LdapSettings.LdapServer = NewString("")
	}

	if o.LdapSettings.LdapPort == nil {
		o.LdapSettings.LdapPort = NewInt(389)
	}

	if o.LdapSettings.ConnectionSecurity == nil {
		o.LdapSettings.ConnectionSecurity = NewString("")
	}

	if o.LdapSettings.BaseDN == nil {
		o.LdapSettings.BaseDN = NewString("")
	}

	if o.LdapSettings.BindUsername == nil {
		o.LdapSettings.BindUsername = NewString("")
	}

	if o.LdapSettings.BindPassword == nil {
		o.LdapSettings.BindPassword = NewString("")
	}

	if o.LdapSettings.UserFilter == nil {
		o.LdapSettings.UserFilter = NewString("")
	}

	if o.LdapSettings.FirstNameAttribute == nil {
		o.LdapSettings.FirstNameAttribute = NewString(LDAP_SETTINGS_DEFAULT_FIRST_NAME_ATTRIBUTE)
	}

	if o.LdapSettings.LastNameAttribute == nil {
		o.LdapSettings.LastNameAttribute = NewString(LDAP_SETTINGS_DEFAULT_LAST_NAME_ATTRIBUTE)
	}

	if o.LdapSettings.EmailAttribute == nil {
		o.LdapSettings.EmailAttribute = NewString(LDAP_SETTINGS_DEFAULT_EMAIL_ATTRIBUTE)
	}

	if o.LdapSettings.UsernameAttribute == nil {
		o.LdapSettings.UsernameAttribute = NewString(LDAP_SETTINGS_DEFAULT_USERNAME_ATTRIBUTE)
	}

	if o.LdapSettings.NicknameAttribute == nil {
		o.LdapSettings.NicknameAttribute = NewString(LDAP_SETTINGS_DEFAULT_NICKNAME_ATTRIBUTE)
	}

	if o.LdapSettings.IdAttribute == nil {
		o.LdapSettings.IdAttribute = NewString(LDAP_SETTINGS_DEFAULT_ID_ATTRIBUTE)
	}

	if o.LdapSettings.PositionAttribute == nil {
		o.LdapSettings.PositionAttribute = NewString(LDAP_SETTINGS_DEFAULT_POSITION_ATTRIBUTE)
	}

	if o.LdapSettings.SyncIntervalMinutes == nil {
		o.LdapSettings.SyncIntervalMinutes = NewInt(60)
	}

	if o.LdapSettings.SkipCertificateVerification == nil {
		o.LdapSettings.SkipCertificateVerification = NewBool(false)
	}

	if o.LdapSettings.QueryTimeout == nil {
		o.LdapSettings.QueryTimeout = NewInt(60)
	}

	if o.LdapSettings.MaxPageSize == nil {
		o.LdapSettings.MaxPageSize = NewInt(0)
	}

	if o.LdapSettings.LoginFieldName == nil {
		o.LdapSettings.LoginFieldName = NewString(LDAP_SETTINGS_DEFAULT_LOGIN_FIELD_NAME)
	}

	if o.ServiceSettings.SessionLengthWebInDays == nil {
		o.ServiceSettings.SessionLengthWebInDays = NewInt(30)
	}

	if o.ServiceSettings.SessionLengthMobileInDays == nil {
		o.ServiceSettings.SessionLengthMobileInDays = NewInt(30)
	}

	if o.ServiceSettings.SessionLengthSSOInDays == nil {
		o.ServiceSettings.SessionLengthSSOInDays = NewInt(30)
	}

	if o.ServiceSettings.SessionCacheInMinutes == nil {
		o.ServiceSettings.SessionCacheInMinutes = NewInt(10)
	}

	if o.ServiceSettings.SessionIdleTimeoutInMinutes == nil {
		o.ServiceSettings.SessionIdleTimeoutInMinutes = NewInt(0)
	}

	if o.ServiceSettings.EnableCommands == nil {
		o.ServiceSettings.EnableCommands = NewBool(false)
	}

	if o.ServiceSettings.EnableOnlyAdminIntegrations == nil {
		o.ServiceSettings.EnableOnlyAdminIntegrations = NewBool(true)
	}

	if o.ServiceSettings.WebsocketPort == nil {
		o.ServiceSettings.WebsocketPort = NewInt(80)
	}

	if o.ServiceSettings.WebsocketSecurePort == nil {
		o.ServiceSettings.WebsocketSecurePort = NewInt(443)
	}

	if o.ServiceSettings.AllowCorsFrom == nil {
		o.ServiceSettings.AllowCorsFrom = NewString(SERVICE_SETTINGS_DEFAULT_ALLOW_CORS_FROM)
	}

	if o.ServiceSettings.WebserverMode == nil {
		o.ServiceSettings.WebserverMode = NewString("gzip")
	} else if *o.ServiceSettings.WebserverMode == "regular" {
		*o.ServiceSettings.WebserverMode = "gzip"
	}

	if o.ServiceSettings.EnableCustomEmoji == nil {
		o.ServiceSettings.EnableCustomEmoji = NewBool(false)
	}

	if o.ServiceSettings.EnableEmojiPicker == nil {
		o.ServiceSettings.EnableEmojiPicker = NewBool(true)
	}

	if o.ServiceSettings.RestrictCustomEmojiCreation == nil {
		o.ServiceSettings.RestrictCustomEmojiCreation = NewString(RESTRICT_EMOJI_CREATION_ALL)
	}

	if o.ServiceSettings.RestrictPostDelete == nil {
		o.ServiceSettings.RestrictPostDelete = NewString(PERMISSIONS_DELETE_POST_ALL)
	}

	if o.ServiceSettings.AllowEditPost == nil {
		o.ServiceSettings.AllowEditPost = NewString(ALLOW_EDIT_POST_ALWAYS)
	}

	if o.ServiceSettings.PostEditTimeLimit == nil {
		o.ServiceSettings.PostEditTimeLimit = NewInt(300)
	}

	if o.ClusterSettings.Enable == nil {
		o.ClusterSettings.Enable = NewBool(false)
	}

	if o.ClusterSettings.ClusterName == nil {
		o.ClusterSettings.ClusterName = NewString("")
	}

	if o.ClusterSettings.OverrideHostname == nil {
		o.ClusterSettings.OverrideHostname = NewString("")
	}

	if o.ClusterSettings.UseIpAddress == nil {
		o.ClusterSettings.UseIpAddress = NewBool(true)
	}

	if o.ClusterSettings.UseExperimentalGossip == nil {
		o.ClusterSettings.UseExperimentalGossip = NewBool(false)
	}

	if o.ClusterSettings.ReadOnlyConfig == nil {
		o.ClusterSettings.ReadOnlyConfig = NewBool(true)
	}

	if o.ClusterSettings.GossipPort == nil {
		o.ClusterSettings.GossipPort = NewInt(8074)
	}

	if o.ClusterSettings.StreamingPort == nil {
		o.ClusterSettings.StreamingPort = NewInt(8075)
	}

	if o.MetricsSettings.ListenAddress == nil {
		o.MetricsSettings.ListenAddress = NewString(":8067")
	}

	if o.MetricsSettings.Enable == nil {
		o.MetricsSettings.Enable = NewBool(false)
	}

	if o.AnalyticsSettings.MaxUsersForStatistics == nil {
		o.AnalyticsSettings.MaxUsersForStatistics = NewInt(ANALYTICS_SETTINGS_DEFAULT_MAX_USERS_FOR_STATISTICS)
	}

	if o.ComplianceSettings.Enable == nil {
		o.ComplianceSettings.Enable = NewBool(false)
	}

	if o.ComplianceSettings.Directory == nil {
		o.ComplianceSettings.Directory = NewString("./data/")
	}

	if o.ComplianceSettings.EnableDaily == nil {
		o.ComplianceSettings.EnableDaily = NewBool(false)
	}

	if o.LocalizationSettings.DefaultServerLocale == nil {
		o.LocalizationSettings.DefaultServerLocale = NewString(DEFAULT_LOCALE)
	}

	if o.LocalizationSettings.DefaultClientLocale == nil {
		o.LocalizationSettings.DefaultClientLocale = NewString(DEFAULT_LOCALE)
	}

	if o.LocalizationSettings.AvailableLocales == nil {
		o.LocalizationSettings.AvailableLocales = NewString("")
	}

	if o.LogSettings.EnableDiagnostics == nil {
		o.LogSettings.EnableDiagnostics = NewBool(true)
	}

	if o.SamlSettings.Enable == nil {
		o.SamlSettings.Enable = NewBool(false)
	}

	if o.SamlSettings.Verify == nil {
		o.SamlSettings.Verify = NewBool(true)
	}

	if o.SamlSettings.Encrypt == nil {
		o.SamlSettings.Encrypt = NewBool(true)
	}

	if o.SamlSettings.IdpUrl == nil {
		o.SamlSettings.IdpUrl = NewString("")
	}

	if o.SamlSettings.IdpDescriptorUrl == nil {
		o.SamlSettings.IdpDescriptorUrl = NewString("")
	}

	if o.SamlSettings.IdpCertificateFile == nil {
		o.SamlSettings.IdpCertificateFile = NewString("")
	}

	if o.SamlSettings.PublicCertificateFile == nil {
		o.SamlSettings.PublicCertificateFile = NewString("")
	}

	if o.SamlSettings.PrivateKeyFile == nil {
		o.SamlSettings.PrivateKeyFile = NewString("")
	}

	if o.SamlSettings.AssertionConsumerServiceURL == nil {
		o.SamlSettings.AssertionConsumerServiceURL = NewString("")
	}

	if o.SamlSettings.LoginButtonText == nil || *o.SamlSettings.LoginButtonText == "" {
		o.SamlSettings.LoginButtonText = NewString(USER_AUTH_SERVICE_SAML_TEXT)
	}

	if o.SamlSettings.FirstNameAttribute == nil {
		o.SamlSettings.FirstNameAttribute = NewString(SAML_SETTINGS_DEFAULT_FIRST_NAME_ATTRIBUTE)
	}

	if o.SamlSettings.LastNameAttribute == nil {
		o.SamlSettings.LastNameAttribute = NewString(SAML_SETTINGS_DEFAULT_LAST_NAME_ATTRIBUTE)
	}

	if o.SamlSettings.EmailAttribute == nil {
		o.SamlSettings.EmailAttribute = NewString(SAML_SETTINGS_DEFAULT_EMAIL_ATTRIBUTE)
	}

	if o.SamlSettings.UsernameAttribute == nil {
		o.SamlSettings.UsernameAttribute = NewString(SAML_SETTINGS_DEFAULT_USERNAME_ATTRIBUTE)
	}

	if o.SamlSettings.NicknameAttribute == nil {
		o.SamlSettings.NicknameAttribute = NewString(SAML_SETTINGS_DEFAULT_NICKNAME_ATTRIBUTE)
	}

	if o.SamlSettings.PositionAttribute == nil {
		o.SamlSettings.PositionAttribute = NewString(SAML_SETTINGS_DEFAULT_POSITION_ATTRIBUTE)
	}

	if o.SamlSettings.LocaleAttribute == nil {
		o.SamlSettings.LocaleAttribute = NewString(SAML_SETTINGS_DEFAULT_LOCALE_ATTRIBUTE)
	}

	if o.TeamSettings.TeammateNameDisplay == nil {
		o.TeamSettings.TeammateNameDisplay = NewString(SHOW_USERNAME)

		if *o.SamlSettings.Enable || *o.LdapSettings.Enable {
			*o.TeamSettings.TeammateNameDisplay = SHOW_FULLNAME
		}
	}

	if o.NativeAppSettings.AppDownloadLink == nil {
		o.NativeAppSettings.AppDownloadLink = NewString(NATIVEAPP_SETTINGS_DEFAULT_APP_DOWNLOAD_LINK)
	}

	if o.NativeAppSettings.AndroidAppDownloadLink == nil {
		o.NativeAppSettings.AndroidAppDownloadLink = NewString(NATIVEAPP_SETTINGS_DEFAULT_ANDROID_APP_DOWNLOAD_LINK)
	}

	if o.NativeAppSettings.IosAppDownloadLink == nil {
		o.NativeAppSettings.IosAppDownloadLink = NewString(NATIVEAPP_SETTINGS_DEFAULT_IOS_APP_DOWNLOAD_LINK)
	}

	if o.RateLimitSettings.Enable == nil {
		o.RateLimitSettings.Enable = NewBool(false)
	}

	if o.RateLimitSettings.PerSec == nil {
		o.RateLimitSettings.PerSec = NewInt(10)
	}

	if o.RateLimitSettings.MaxBurst == nil {
		o.RateLimitSettings.MaxBurst = NewInt(100)
	}

	if o.RateLimitSettings.MemoryStoreSize == nil {
		o.RateLimitSettings.MemoryStoreSize = NewInt(10000)
	}

	if o.ServiceSettings.GoroutineHealthThreshold == nil {
		o.ServiceSettings.GoroutineHealthThreshold = NewInt(-1)
	}

	if o.ServiceSettings.ConnectionSecurity == nil {
		o.ServiceSettings.ConnectionSecurity = NewString("")
	}

	if o.ServiceSettings.TLSKeyFile == nil {
		o.ServiceSettings.TLSKeyFile = NewString(SERVICE_SETTINGS_DEFAULT_TLS_KEY_FILE)
	}

	if o.ServiceSettings.TLSCertFile == nil {
		o.ServiceSettings.TLSCertFile = NewString(SERVICE_SETTINGS_DEFAULT_TLS_CERT_FILE)
	}

	if o.ServiceSettings.UseLetsEncrypt == nil {
		o.ServiceSettings.UseLetsEncrypt = NewBool(false)
	}

	if o.ServiceSettings.LetsEncryptCertificateCacheFile == nil {
		o.ServiceSettings.LetsEncryptCertificateCacheFile = NewString("./config/letsencrypt.cache")
	}

	if o.ServiceSettings.ReadTimeout == nil {
		o.ServiceSettings.ReadTimeout = NewInt(SERVICE_SETTINGS_DEFAULT_READ_TIMEOUT)
	}

	if o.ServiceSettings.WriteTimeout == nil {
		o.ServiceSettings.WriteTimeout = NewInt(SERVICE_SETTINGS_DEFAULT_WRITE_TIMEOUT)
	}

	if o.ServiceSettings.MaximumLoginAttempts == nil {
		o.ServiceSettings.MaximumLoginAttempts = NewInt(SERVICE_SETTINGS_DEFAULT_MAX_LOGIN_ATTEMPTS)
	}

	if o.ServiceSettings.Forward80To443 == nil {
		o.ServiceSettings.Forward80To443 = NewBool(false)
	}

	if o.MetricsSettings.BlockProfileRate == nil {
		o.MetricsSettings.BlockProfileRate = NewInt(0)
	}

	if o.ServiceSettings.TimeBetweenUserTypingUpdatesMilliseconds == nil {
		o.ServiceSettings.TimeBetweenUserTypingUpdatesMilliseconds = NewInt64(5000)
	}

	if o.ServiceSettings.EnablePostSearch == nil {
		o.ServiceSettings.EnablePostSearch = NewBool(true)
	}

	if o.ServiceSettings.EnableUserTypingMessages == nil {
		o.ServiceSettings.EnableUserTypingMessages = NewBool(true)
	}

	if o.ServiceSettings.EnableChannelViewedMessages == nil {
		o.ServiceSettings.EnableChannelViewedMessages = NewBool(true)
	}

	if o.ServiceSettings.EnableUserStatuses == nil {
		o.ServiceSettings.EnableUserStatuses = NewBool(true)
	}

	if o.ServiceSettings.ClusterLogTimeoutMilliseconds == nil {
		o.ServiceSettings.ClusterLogTimeoutMilliseconds = NewInt(2000)
	}

	if o.ElasticsearchSettings.ConnectionUrl == nil {
		o.ElasticsearchSettings.ConnectionUrl = NewString(ELASTICSEARCH_SETTINGS_DEFAULT_CONNECTION_URL)
	}

	if o.ElasticsearchSettings.Username == nil {
		o.ElasticsearchSettings.Username = NewString(ELASTICSEARCH_SETTINGS_DEFAULT_USERNAME)
	}

	if o.ElasticsearchSettings.Password == nil {
		o.ElasticsearchSettings.Password = NewString(ELASTICSEARCH_SETTINGS_DEFAULT_PASSWORD)
	}

	if o.ElasticsearchSettings.EnableIndexing == nil {
		o.ElasticsearchSettings.EnableIndexing = NewBool(false)
	}

	if o.ElasticsearchSettings.EnableSearching == nil {
		o.ElasticsearchSettings.EnableSearching = NewBool(false)
	}

	if o.ElasticsearchSettings.Sniff == nil {
		o.ElasticsearchSettings.Sniff = NewBool(true)
	}

	if o.ElasticsearchSettings.PostIndexReplicas == nil {
		o.ElasticsearchSettings.PostIndexReplicas = NewInt(ELASTICSEARCH_SETTINGS_DEFAULT_POST_INDEX_REPLICAS)
	}

	if o.ElasticsearchSettings.PostIndexShards == nil {
		o.ElasticsearchSettings.PostIndexShards = NewInt(ELASTICSEARCH_SETTINGS_DEFAULT_POST_INDEX_SHARDS)
	}

	if o.ElasticsearchSettings.AggregatePostsAfterDays == nil {
		o.ElasticsearchSettings.AggregatePostsAfterDays = NewInt(ELASTICSEARCH_SETTINGS_DEFAULT_AGGREGATE_POSTS_AFTER_DAYS)
	}

	if o.ElasticsearchSettings.PostsAggregatorJobStartTime == nil {
		o.ElasticsearchSettings.PostsAggregatorJobStartTime = NewString(ELASTICSEARCH_SETTINGS_DEFAULT_POSTS_AGGREGATOR_JOB_START_TIME)
	}

	if o.ElasticsearchSettings.IndexPrefix == nil {
		o.ElasticsearchSettings.IndexPrefix = NewString(ELASTICSEARCH_SETTINGS_DEFAULT_INDEX_PREFIX)
	}

	if o.ElasticsearchSettings.LiveIndexingBatchSize == nil {
		o.ElasticsearchSettings.LiveIndexingBatchSize = NewInt(ELASTICSEARCH_SETTINGS_DEFAULT_LIVE_INDEXING_BATCH_SIZE)
	}

	if o.ElasticsearchSettings.BulkIndexingTimeWindowSeconds == nil {
		o.ElasticsearchSettings.BulkIndexingTimeWindowSeconds = new(int)
		*o.ElasticsearchSettings.BulkIndexingTimeWindowSeconds = ELASTICSEARCH_SETTINGS_DEFAULT_BULK_INDEXING_TIME_WINDOW_SECONDS
	}

	if o.DataRetentionSettings.EnableMessageDeletion == nil {
		o.DataRetentionSettings.EnableMessageDeletion = NewBool(false)
	}

	if o.DataRetentionSettings.EnableFileDeletion == nil {
		o.DataRetentionSettings.EnableFileDeletion = NewBool(false)
	}

	if o.DataRetentionSettings.MessageRetentionDays == nil {
		o.DataRetentionSettings.MessageRetentionDays = NewInt(DATA_RETENTION_SETTINGS_DEFAULT_MESSAGE_RETENTION_DAYS)
	}

	if o.DataRetentionSettings.FileRetentionDays == nil {
		o.DataRetentionSettings.FileRetentionDays = NewInt(DATA_RETENTION_SETTINGS_DEFAULT_FILE_RETENTION_DAYS)
	}

	if o.DataRetentionSettings.DeletionJobStartTime == nil {
		o.DataRetentionSettings.DeletionJobStartTime = NewString(DATA_RETENTION_SETTINGS_DEFAULT_DELETION_JOB_START_TIME)
	}

	if o.JobSettings.RunJobs == nil {
		o.JobSettings.RunJobs = NewBool(true)
	}

	if o.JobSettings.RunScheduler == nil {
		o.JobSettings.RunScheduler = NewBool(true)
	}

	if o.PluginSettings.Enable == nil {
		o.PluginSettings.Enable = NewBool(true)
	}

	if o.PluginSettings.EnableUploads == nil {
		o.PluginSettings.Enable = NewBool(false)
	}

	if o.PluginSettings.Plugins == nil {
		o.PluginSettings.Plugins = make(map[string]interface{})
	}

	if o.PluginSettings.PluginStates == nil {
		o.PluginSettings.PluginStates = make(map[string]*PluginState)
	}

	o.defaultWebrtcSettings()
}

func (o *Config) IsValid() *AppError {
	if len(*o.ServiceSettings.SiteURL) == 0 && *o.EmailSettings.EnableEmailBatching {
		return NewAppError("Config.IsValid", "model.config.is_valid.site_url_email_batching.app_error", nil, "", http.StatusBadRequest)
	}

	if *o.ClusterSettings.Enable && *o.EmailSettings.EnableEmailBatching {
		return NewAppError("Config.IsValid", "model.config.is_valid.cluster_email_batching.app_error", nil, "", http.StatusBadRequest)
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

	if err := o.WebrtcSettings.isValid(); err != nil {
		return err
	}

	if err := o.ServiceSettings.isValid(); err != nil {
		return err
	}

	if err := o.ElasticsearchSettings.isValid(); err != nil {
		return err
	}

	if err := o.DataRetentionSettings.isValid(); err != nil {
		return err
	}

	if err := o.LocalizationSettings.isValid(); err != nil {
		return err
	}

	return nil
}

func (ts *TeamSettings) isValid() *AppError {
	if *ts.MaxUsersPerTeam <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.max_users.app_error", nil, "", http.StatusBadRequest)
	}

	if *ts.MaxChannelsPerTeam <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.max_channels.app_error", nil, "", http.StatusBadRequest)
	}

	if *ts.MaxNotificationsPerChannel <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.max_notify_per_channel.app_error", nil, "", http.StatusBadRequest)
	}

	if !(*ts.RestrictDirectMessage == DIRECT_MESSAGE_ANY || *ts.RestrictDirectMessage == DIRECT_MESSAGE_TEAM) {
		return NewAppError("Config.IsValid", "model.config.is_valid.restrict_direct_message.app_error", nil, "", http.StatusBadRequest)
	}

	if !(*ts.TeammateNameDisplay == SHOW_FULLNAME || *ts.TeammateNameDisplay == SHOW_NICKNAME_FULLNAME || *ts.TeammateNameDisplay == SHOW_USERNAME) {
		return NewAppError("Config.IsValid", "model.config.is_valid.teammate_name_display.app_error", nil, "", http.StatusBadRequest)
	}

	if len(ts.SiteName) > SITENAME_MAX_LENGTH {
		return NewAppError("Config.IsValid", "model.config.is_valid.sitename_length.app_error", map[string]interface{}{"MaxLength": SITENAME_MAX_LENGTH}, "", http.StatusBadRequest)
	}

	return nil
}

func (ss *SqlSettings) isValid() *AppError {
	if len(ss.AtRestEncryptKey) < 32 {
		return NewAppError("Config.IsValid", "model.config.is_valid.encrypt_sql.app_error", nil, "", http.StatusBadRequest)
	}

	if !(*ss.DriverName == DATABASE_DRIVER_MYSQL || *ss.DriverName == DATABASE_DRIVER_POSTGRES) {
		return NewAppError("Config.IsValid", "model.config.is_valid.sql_driver.app_error", nil, "", http.StatusBadRequest)
	}

	if *ss.MaxIdleConns <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.sql_idle.app_error", nil, "", http.StatusBadRequest)
	}

	if *ss.QueryTimeout <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.sql_query_timeout.app_error", nil, "", http.StatusBadRequest)
	}

	if len(*ss.DataSource) == 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.sql_data_src.app_error", nil, "", http.StatusBadRequest)
	}

	if *ss.MaxOpenConns <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.sql_max_conn.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

func (fs *FileSettings) isValid() *AppError {
	if *fs.MaxFileSize <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.max_file_size.app_error", nil, "", http.StatusBadRequest)
	}

	if !(*fs.DriverName == IMAGE_DRIVER_LOCAL || *fs.DriverName == IMAGE_DRIVER_S3) {
		return NewAppError("Config.IsValid", "model.config.is_valid.file_driver.app_error", nil, "", http.StatusBadRequest)
	}

	if len(*fs.PublicLinkSalt) < 32 {
		return NewAppError("Config.IsValid", "model.config.is_valid.file_salt.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

func (es *EmailSettings) isValid() *AppError {
	if !(es.ConnectionSecurity == CONN_SECURITY_NONE || es.ConnectionSecurity == CONN_SECURITY_TLS || es.ConnectionSecurity == CONN_SECURITY_STARTTLS || es.ConnectionSecurity == CONN_SECURITY_PLAIN) {
		return NewAppError("Config.IsValid", "model.config.is_valid.email_security.app_error", nil, "", http.StatusBadRequest)
	}

	if len(es.InviteSalt) < 32 {
		return NewAppError("Config.IsValid", "model.config.is_valid.email_salt.app_error", nil, "", http.StatusBadRequest)
	}

	if *es.EmailBatchingBufferSize <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.email_batching_buffer_size.app_error", nil, "", http.StatusBadRequest)
	}

	if *es.EmailBatchingInterval < 30 {
		return NewAppError("Config.IsValid", "model.config.is_valid.email_batching_interval.app_error", nil, "", http.StatusBadRequest)
	}

	if !(*es.EmailNotificationContentsType == EMAIL_NOTIFICATION_CONTENTS_FULL || *es.EmailNotificationContentsType == EMAIL_NOTIFICATION_CONTENTS_GENERIC) {
		return NewAppError("Config.IsValid", "model.config.is_valid.email_notification_contents_type.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

func (rls *RateLimitSettings) isValid() *AppError {
	if *rls.MemoryStoreSize <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.rate_mem.app_error", nil, "", http.StatusBadRequest)
	}

	if *rls.PerSec <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.rate_sec.app_error", nil, "", http.StatusBadRequest)
	}

	if *rls.MaxBurst <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.max_burst.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

func (ls *LdapSettings) isValid() *AppError {
	if !(*ls.ConnectionSecurity == CONN_SECURITY_NONE || *ls.ConnectionSecurity == CONN_SECURITY_TLS || *ls.ConnectionSecurity == CONN_SECURITY_STARTTLS) {
		return NewAppError("Config.IsValid", "model.config.is_valid.ldap_security.app_error", nil, "", http.StatusBadRequest)
	}

	if *ls.SyncIntervalMinutes <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.ldap_sync_interval.app_error", nil, "", http.StatusBadRequest)
	}

	if *ls.MaxPageSize < 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.ldap_max_page_size.app_error", nil, "", http.StatusBadRequest)
	}

	if *ls.Enable {
		if *ls.LdapServer == "" {
			return NewAppError("Config.IsValid", "model.config.is_valid.ldap_server", nil, "", http.StatusBadRequest)
		}

		if *ls.BaseDN == "" {
			return NewAppError("Config.IsValid", "model.config.is_valid.ldap_basedn", nil, "", http.StatusBadRequest)
		}

		if *ls.EmailAttribute == "" {
			return NewAppError("Config.IsValid", "model.config.is_valid.ldap_email", nil, "", http.StatusBadRequest)
		}

		if *ls.UsernameAttribute == "" {
			return NewAppError("Config.IsValid", "model.config.is_valid.ldap_username", nil, "", http.StatusBadRequest)
		}

		if *ls.IdAttribute == "" {
			return NewAppError("Config.IsValid", "model.config.is_valid.ldap_id", nil, "", http.StatusBadRequest)
		}
	}

	return nil
}

func (ss *SamlSettings) isValid() *AppError {
	if *ss.Enable {
		if len(*ss.IdpUrl) == 0 || !IsValidHttpUrl(*ss.IdpUrl) {
			return NewAppError("Config.IsValid", "model.config.is_valid.saml_idp_url.app_error", nil, "", http.StatusBadRequest)
		}

		if len(*ss.IdpDescriptorUrl) == 0 || !IsValidHttpUrl(*ss.IdpDescriptorUrl) {
			return NewAppError("Config.IsValid", "model.config.is_valid.saml_idp_descriptor_url.app_error", nil, "", http.StatusBadRequest)
		}

		if len(*ss.IdpCertificateFile) == 0 {
			return NewAppError("Config.IsValid", "model.config.is_valid.saml_idp_cert.app_error", nil, "", http.StatusBadRequest)
		}

		if len(*ss.EmailAttribute) == 0 {
			return NewAppError("Config.IsValid", "model.config.is_valid.saml_email_attribute.app_error", nil, "", http.StatusBadRequest)
		}

		if len(*ss.UsernameAttribute) == 0 {
			return NewAppError("Config.IsValid", "model.config.is_valid.saml_username_attribute.app_error", nil, "", http.StatusBadRequest)
		}

		if *ss.Verify {
			if len(*ss.AssertionConsumerServiceURL) == 0 || !IsValidHttpUrl(*ss.AssertionConsumerServiceURL) {
				return NewAppError("Config.IsValid", "model.config.is_valid.saml_assertion_consumer_service_url.app_error", nil, "", http.StatusBadRequest)
			}
		}

		if *ss.Encrypt {
			if len(*ss.PrivateKeyFile) == 0 {
				return NewAppError("Config.IsValid", "model.config.is_valid.saml_private_key.app_error", nil, "", http.StatusBadRequest)
			}

			if len(*ss.PublicCertificateFile) == 0 {
				return NewAppError("Config.IsValid", "model.config.is_valid.saml_public_cert.app_error", nil, "", http.StatusBadRequest)
			}
		}

		if len(*ss.EmailAttribute) == 0 {
			return NewAppError("Config.IsValid", "model.config.is_valid.saml_email_attribute.app_error", nil, "", http.StatusBadRequest)
		}
	}

	return nil
}

func (ws *WebrtcSettings) isValid() *AppError {
	if *ws.Enable {
		if len(*ws.GatewayWebsocketUrl) == 0 || !IsValidWebsocketUrl(*ws.GatewayWebsocketUrl) {
			return NewAppError("Config.IsValid", "model.config.is_valid.webrtc_gateway_ws_url.app_error", nil, "", http.StatusBadRequest)
		} else if len(*ws.GatewayAdminUrl) == 0 || !IsValidHttpUrl(*ws.GatewayAdminUrl) {
			return NewAppError("Config.IsValid", "model.config.is_valid.webrtc_gateway_admin_url.app_error", nil, "", http.StatusBadRequest)
		} else if len(*ws.GatewayAdminSecret) == 0 {
			return NewAppError("Config.IsValid", "model.config.is_valid.webrtc_gateway_admin_secret.app_error", nil, "", http.StatusBadRequest)
		} else if len(*ws.StunURI) != 0 && !IsValidTurnOrStunServer(*ws.StunURI) {
			return NewAppError("Config.IsValid", "model.config.is_valid.webrtc_stun_uri.app_error", nil, "", http.StatusBadRequest)
		} else if len(*ws.TurnURI) != 0 {
			if !IsValidTurnOrStunServer(*ws.TurnURI) {
				return NewAppError("Config.IsValid", "model.config.is_valid.webrtc_turn_uri.app_error", nil, "", http.StatusBadRequest)
			}
			if len(*ws.TurnUsername) == 0 {
				return NewAppError("Config.IsValid", "model.config.is_valid.webrtc_turn_username.app_error", nil, "", http.StatusBadRequest)
			} else if len(*ws.TurnSharedKey) == 0 {
				return NewAppError("Config.IsValid", "model.config.is_valid.webrtc_turn_shared_key.app_error", nil, "", http.StatusBadRequest)
			}
		}
	}

	return nil
}

func (ss *ServiceSettings) isValid() *AppError {
	if !(*ss.ConnectionSecurity == CONN_SECURITY_NONE || *ss.ConnectionSecurity == CONN_SECURITY_TLS) {
		return NewAppError("Config.IsValid", "model.config.is_valid.webserver_security.app_error", nil, "", http.StatusBadRequest)
	}

	if *ss.ReadTimeout <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.read_timeout.app_error", nil, "", http.StatusBadRequest)
	}

	if *ss.WriteTimeout <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.write_timeout.app_error", nil, "", http.StatusBadRequest)
	}

	if *ss.TimeBetweenUserTypingUpdatesMilliseconds < 1000 {
		return NewAppError("Config.IsValid", "model.config.is_valid.time_between_user_typing.app_error", nil, "", http.StatusBadRequest)
	}

	if *ss.MaximumLoginAttempts <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.login_attempts.app_error", nil, "", http.StatusBadRequest)
	}

	if len(*ss.SiteURL) != 0 {
		if _, err := url.ParseRequestURI(*ss.SiteURL); err != nil {
			return NewAppError("Config.IsValid", "model.config.is_valid.site_url.app_error", nil, "", http.StatusBadRequest)
		}
	}

	if len(*ss.ListenAddress) == 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.listen_address.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

func (ess *ElasticsearchSettings) isValid() *AppError {
	if *ess.EnableIndexing {
		if len(*ess.ConnectionUrl) == 0 {
			return NewAppError("Config.IsValid", "model.config.is_valid.elastic_search.connection_url.app_error", nil, "", http.StatusBadRequest)
		}
	}

	if *ess.EnableSearching && !*ess.EnableIndexing {
		return NewAppError("Config.IsValid", "model.config.is_valid.elastic_search.enable_searching.app_error", nil, "", http.StatusBadRequest)
	}

	if *ess.AggregatePostsAfterDays < 1 {
		return NewAppError("Config.IsValid", "model.config.is_valid.elastic_search.aggregate_posts_after_days.app_error", nil, "", http.StatusBadRequest)
	}

	if _, err := time.Parse("15:04", *ess.PostsAggregatorJobStartTime); err != nil {
		return NewAppError("Config.IsValid", "model.config.is_valid.elastic_search.posts_aggregator_job_start_time.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	if *ess.LiveIndexingBatchSize < 1 {
		return NewAppError("Config.IsValid", "model.config.is_valid.elastic_search.live_indexing_batch_size.app_error", nil, "", http.StatusBadRequest)
	}

	if *ess.BulkIndexingTimeWindowSeconds < 1 {
		return NewAppError("Config.IsValid", "model.config.is_valid.elastic_search.bulk_indexing_time_window_seconds.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

func (drs *DataRetentionSettings) isValid() *AppError {
	if *drs.MessageRetentionDays <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.data_retention.message_retention_days_too_low.app_error", nil, "", http.StatusBadRequest)
	}

	if *drs.FileRetentionDays <= 0 {
		return NewAppError("Config.IsValid", "model.config.is_valid.data_retention.file_retention_days_too_low.app_error", nil, "", http.StatusBadRequest)
	}

	if _, err := time.Parse("15:04", *drs.DeletionJobStartTime); err != nil {
		return NewAppError("Config.IsValid", "model.config.is_valid.data_retention.deletion_job_start_time.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	return nil
}

func (ls *LocalizationSettings) isValid() *AppError {
	if len(*ls.AvailableLocales) > 0 {
		if !strings.Contains(*ls.AvailableLocales, *ls.DefaultClientLocale) {
			return NewAppError("Config.IsValid", "model.config.is_valid.localization.available_locales.app_error", nil, "", http.StatusBadRequest)
		}
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

	*o.SqlSettings.DataSource = FAKE_SETTING
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
		o.WebrtcSettings.Enable = NewBool(false)
	}

	if o.WebrtcSettings.GatewayWebsocketUrl == nil {
		o.WebrtcSettings.GatewayWebsocketUrl = NewString("")
	}

	if o.WebrtcSettings.GatewayAdminUrl == nil {
		o.WebrtcSettings.GatewayAdminUrl = NewString("")
	}

	if o.WebrtcSettings.GatewayAdminSecret == nil {
		o.WebrtcSettings.GatewayAdminSecret = NewString("")
	}

	if o.WebrtcSettings.StunURI == nil {
		o.WebrtcSettings.StunURI = NewString(WEBRTC_SETTINGS_DEFAULT_STUN_URI)
	}

	if o.WebrtcSettings.TurnURI == nil {
		o.WebrtcSettings.TurnURI = NewString(WEBRTC_SETTINGS_DEFAULT_TURN_URI)
	}

	if o.WebrtcSettings.TurnUsername == nil {
		o.WebrtcSettings.TurnUsername = NewString("")
	}

	if o.WebrtcSettings.TurnSharedKey == nil {
		o.WebrtcSettings.TurnSharedKey = NewString("")
	}
}
