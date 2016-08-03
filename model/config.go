// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
	"net/url"
)

const (
	CONN_SECURITY_NONE     = ""
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

	GENERIC_NOTIFICATION = "generic"
	FULL_NOTIFICATION    = "full"

	DIRECT_MESSAGE_ANY  = "any"
	DIRECT_MESSAGE_TEAM = "team"

	PERMISSIONS_ALL          = "all"
	PERMISSIONS_TEAM_ADMIN   = "team_admin"
	PERMISSIONS_SYSTEM_ADMIN = "system_admin"

	FAKE_SETTING = "********************************"

	RESTRICT_EMOJI_CREATION_ALL          = "all"
	RESTRICT_EMOJI_CREATION_ADMIN        = "admin"
	RESTRICT_EMOJI_CREATION_SYSTEM_ADMIN = "system_admin"

	SITENAME_MAX_LENGTH = 30
)

type ServiceSettings struct {
	SiteURL                           *string
	ListenAddress                     string
	MaximumLoginAttempts              int
	SegmentDeveloperKey               string
	GoogleDeveloperKey                string
	EnableOAuthServiceProvider        bool
	EnableIncomingWebhooks            bool
	EnableOutgoingWebhooks            bool
	EnableCommands                    *bool
	EnableOnlyAdminIntegrations       *bool
	EnablePostUsernameOverride        bool
	EnablePostIconOverride            bool
	EnableTesting                     bool
	EnableDeveloper                   *bool
	EnableSecurityFixAlert            *bool
	EnableInsecureOutgoingConnections *bool
	EnableMultifactorAuthentication   *bool
	AllowCorsFrom                     *string
	SessionLengthWebInDays            *int
	SessionLengthMobileInDays         *int
	SessionLengthSSOInDays            *int
	SessionCacheInMinutes             *int
	WebsocketSecurePort               *int
	WebsocketPort                     *int
	WebserverMode                     *string
	EnableCustomEmoji                 *bool
	RestrictCustomEmojiCreation       *string
}

type ClusterSettings struct {
	Enable                 *bool
	InterNodeListenAddress *string
	InterNodeUrls          []string
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
	DriverName         string
	DataSource         string
	DataSourceReplicas []string
	MaxIdleConns       int
	MaxOpenConns       int
	Trace              bool
	AtRestEncryptKey   string
}

type LogSettings struct {
	EnableConsole          bool
	ConsoleLevel           string
	EnableFile             bool
	FileLevel              string
	FileFormat             string
	FileLocation           string
	EnableWebhookDebugging bool
}

type PasswordSettings struct {
	MinimumLength *int
	Lowercase     *bool
	Number        *bool
	Uppercase     *bool
	Symbol        *bool
}

type FileSettings struct {
	MaxFileSize                *int64
	DriverName                 string
	Directory                  string
	EnablePublicLink           bool
	PublicLinkSalt             string
	ThumbnailWidth             int
	ThumbnailHeight            int
	PreviewWidth               int
	PreviewHeight              int
	ProfileWidth               int
	ProfileHeight              int
	InitialFont                string
	AmazonS3AccessKeyId        string
	AmazonS3SecretAccessKey    string
	AmazonS3Bucket             string
	AmazonS3Region             string
	AmazonS3Endpoint           string
	AmazonS3BucketEndpoint     string
	AmazonS3LocationConstraint *bool
	AmazonS3LowercaseBucket    *bool
}

type EmailSettings struct {
	EnableSignUpWithEmail    bool
	EnableSignInWithEmail    *bool
	EnableSignInWithUsername *bool
	SendEmailNotifications   bool
	RequireEmailVerification bool
	FeedbackName             string
	FeedbackEmail            string
	FeedbackOrganization     *string
	SMTPUsername             string
	SMTPPassword             string
	SMTPServer               string
	SMTPPort                 string
	ConnectionSecurity       string
	InviteSalt               string
	PasswordResetSalt        string
	SendPushNotifications    *bool
	PushNotificationServer   *string
	PushNotificationContents *string
}

type RateLimitSettings struct {
	EnableRateLimiter bool
	PerSec            int
	MemoryStoreSize   int
	VaryByRemoteAddr  bool
	VaryByHeader      string
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

type TeamSettings struct {
	SiteName                         string
	MaxUsersPerTeam                  int
	EnableTeamCreation               bool
	EnableUserCreation               bool
	EnableOpenServer                 *bool
	RestrictCreationToDomains        string
	RestrictTeamNames                *bool
	EnableCustomBrand                *bool
	CustomBrandText                  *string
	CustomDescriptionText            *string
	RestrictDirectMessage            *string
	RestrictTeamInvite               *string
	RestrictPublicChannelManagement  *string
	RestrictPrivateChannelManagement *string
	UserStatusAwayTimeout            *int64
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

	LoginButtonText *string
}

type NativeAppSettings struct {
	AppDownloadLink        *string
	AndroidAppDownloadLink *string
	IosAppDownloadLink     *string
}

type Config struct {
	ServiceSettings      ServiceSettings
	TeamSettings         TeamSettings
	SqlSettings          SqlSettings
	LogSettings          LogSettings
	PasswordSettings     PasswordSettings
	FileSettings         FileSettings
	EmailSettings        EmailSettings
	RateLimitSettings    RateLimitSettings
	PrivacySettings      PrivacySettings
	SupportSettings      SupportSettings
	GitLabSettings       SSOSettings
	GoogleSettings       SSOSettings
	Office365Settings    SSOSettings
	LdapSettings         LdapSettings
	ComplianceSettings   ComplianceSettings
	LocalizationSettings LocalizationSettings
	SamlSettings         SamlSettings
	NativeAppSettings    NativeAppSettings
	ClusterSettings      ClusterSettings
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

	if o.FileSettings.MaxFileSize == nil {
		o.FileSettings.MaxFileSize = new(int64)
		*o.FileSettings.MaxFileSize = 52428800 // 50 MB
	}

	if len(o.FileSettings.PublicLinkSalt) == 0 {
		o.FileSettings.PublicLinkSalt = NewRandomString(32)
	}

	if o.FileSettings.AmazonS3LocationConstraint == nil {
		o.FileSettings.AmazonS3LocationConstraint = new(bool)
		*o.FileSettings.AmazonS3LocationConstraint = false
	}

	if o.FileSettings.AmazonS3LowercaseBucket == nil {
		o.FileSettings.AmazonS3LowercaseBucket = new(bool)
		*o.FileSettings.AmazonS3LowercaseBucket = false
	}

	if len(o.EmailSettings.InviteSalt) == 0 {
		o.EmailSettings.InviteSalt = NewRandomString(32)
	}

	if len(o.EmailSettings.PasswordResetSalt) == 0 {
		o.EmailSettings.PasswordResetSalt = NewRandomString(32)
	}

	if o.ServiceSettings.SiteURL == nil {
		o.ServiceSettings.SiteURL = new(string)
		*o.ServiceSettings.SiteURL = ""
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

	if o.ServiceSettings.EnableMultifactorAuthentication == nil {
		o.ServiceSettings.EnableMultifactorAuthentication = new(bool)
		*o.ServiceSettings.EnableMultifactorAuthentication = false
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

	if o.TeamSettings.RestrictTeamNames == nil {
		o.TeamSettings.RestrictTeamNames = new(bool)
		*o.TeamSettings.RestrictTeamNames = true
	}

	if o.TeamSettings.EnableCustomBrand == nil {
		o.TeamSettings.EnableCustomBrand = new(bool)
		*o.TeamSettings.EnableCustomBrand = false
	}

	if o.TeamSettings.CustomBrandText == nil {
		o.TeamSettings.CustomBrandText = new(string)
		*o.TeamSettings.CustomBrandText = ""
	}

	if o.TeamSettings.CustomDescriptionText == nil {
		o.TeamSettings.CustomDescriptionText = new(string)
		*o.TeamSettings.CustomDescriptionText = ""
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

	if o.TeamSettings.UserStatusAwayTimeout == nil {
		o.TeamSettings.UserStatusAwayTimeout = new(int64)
		*o.TeamSettings.UserStatusAwayTimeout = 300
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
		*o.EmailSettings.FeedbackOrganization = ""
	}

	if !IsSafeLink(o.SupportSettings.TermsOfServiceLink) {
		o.SupportSettings.TermsOfServiceLink = nil
	}

	if o.SupportSettings.TermsOfServiceLink == nil {
		o.SupportSettings.TermsOfServiceLink = new(string)
		*o.SupportSettings.TermsOfServiceLink = "https://about.mattermost.com/default-terms/"
	}

	if !IsSafeLink(o.SupportSettings.PrivacyPolicyLink) {
		o.SupportSettings.PrivacyPolicyLink = nil
	}

	if o.SupportSettings.PrivacyPolicyLink == nil {
		o.SupportSettings.PrivacyPolicyLink = new(string)
		*o.SupportSettings.PrivacyPolicyLink = ""
	}

	if !IsSafeLink(o.SupportSettings.AboutLink) {
		o.SupportSettings.AboutLink = nil
	}

	if o.SupportSettings.AboutLink == nil {
		o.SupportSettings.AboutLink = new(string)
		*o.SupportSettings.AboutLink = ""
	}

	if !IsSafeLink(o.SupportSettings.HelpLink) {
		o.SupportSettings.HelpLink = nil
	}

	if o.SupportSettings.HelpLink == nil {
		o.SupportSettings.HelpLink = new(string)
		*o.SupportSettings.HelpLink = ""
	}

	if !IsSafeLink(o.SupportSettings.ReportAProblemLink) {
		o.SupportSettings.ReportAProblemLink = nil
	}

	if o.SupportSettings.ReportAProblemLink == nil {
		o.SupportSettings.ReportAProblemLink = new(string)
		*o.SupportSettings.ReportAProblemLink = ""
	}

	if o.SupportSettings.SupportEmail == nil {
		o.SupportSettings.SupportEmail = new(string)
		*o.SupportSettings.SupportEmail = "feedback@mattermost.com"
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
		*o.LdapSettings.FirstNameAttribute = ""
	}

	if o.LdapSettings.LastNameAttribute == nil {
		o.LdapSettings.LastNameAttribute = new(string)
		*o.LdapSettings.LastNameAttribute = ""
	}

	if o.LdapSettings.EmailAttribute == nil {
		o.LdapSettings.EmailAttribute = new(string)
		*o.LdapSettings.EmailAttribute = ""
	}

	if o.LdapSettings.UsernameAttribute == nil {
		o.LdapSettings.UsernameAttribute = new(string)
		*o.LdapSettings.UsernameAttribute = ""
	}

	if o.LdapSettings.NicknameAttribute == nil {
		o.LdapSettings.NicknameAttribute = new(string)
		*o.LdapSettings.NicknameAttribute = ""
	}

	if o.LdapSettings.IdAttribute == nil {
		o.LdapSettings.IdAttribute = new(string)
		*o.LdapSettings.IdAttribute = ""
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
		*o.LdapSettings.LoginFieldName = ""
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
		*o.ServiceSettings.AllowCorsFrom = ""
	}

	if o.ServiceSettings.WebserverMode == nil {
		o.ServiceSettings.WebserverMode = new(string)
		*o.ServiceSettings.WebserverMode = "gzip"
	} else if *o.ServiceSettings.WebserverMode == "regular" {
		*o.ServiceSettings.WebserverMode = "gzip"
	}

	if o.ServiceSettings.EnableCustomEmoji == nil {
		o.ServiceSettings.EnableCustomEmoji = new(bool)
		*o.ServiceSettings.EnableCustomEmoji = true
	}

	if o.ServiceSettings.RestrictCustomEmojiCreation == nil {
		o.ServiceSettings.RestrictCustomEmojiCreation = new(string)
		*o.ServiceSettings.RestrictCustomEmojiCreation = RESTRICT_EMOJI_CREATION_ALL
	}

	if o.ClusterSettings.InterNodeListenAddress == nil {
		o.ClusterSettings.InterNodeListenAddress = new(string)
		*o.ClusterSettings.InterNodeListenAddress = ":8075"
	}

	if o.ClusterSettings.Enable == nil {
		o.ClusterSettings.Enable = new(bool)
		*o.ClusterSettings.Enable = false
	}

	if o.ClusterSettings.InterNodeUrls == nil {
		o.ClusterSettings.InterNodeUrls = []string{}
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

	if o.SamlSettings.Enable == nil {
		o.SamlSettings.Enable = new(bool)
		*o.SamlSettings.Enable = false
	}

	if o.SamlSettings.Verify == nil {
		o.SamlSettings.Verify = new(bool)
		*o.SamlSettings.Verify = false
	}

	if o.SamlSettings.Encrypt == nil {
		o.SamlSettings.Encrypt = new(bool)
		*o.SamlSettings.Encrypt = false
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
		*o.SamlSettings.FirstNameAttribute = ""
	}

	if o.SamlSettings.LastNameAttribute == nil {
		o.SamlSettings.LastNameAttribute = new(string)
		*o.SamlSettings.LastNameAttribute = ""
	}

	if o.SamlSettings.EmailAttribute == nil {
		o.SamlSettings.EmailAttribute = new(string)
		*o.SamlSettings.EmailAttribute = ""
	}

	if o.SamlSettings.UsernameAttribute == nil {
		o.SamlSettings.UsernameAttribute = new(string)
		*o.SamlSettings.UsernameAttribute = ""
	}

	if o.SamlSettings.NicknameAttribute == nil {
		o.SamlSettings.NicknameAttribute = new(string)
		*o.SamlSettings.NicknameAttribute = ""
	}

	if o.SamlSettings.LocaleAttribute == nil {
		o.SamlSettings.LocaleAttribute = new(string)
		*o.SamlSettings.LocaleAttribute = ""
	}

	if o.NativeAppSettings.AppDownloadLink == nil {
		o.NativeAppSettings.AppDownloadLink = new(string)
		*o.NativeAppSettings.AppDownloadLink = "https://about.mattermost.com/downloads/"
	}

	if o.NativeAppSettings.AndroidAppDownloadLink == nil {
		o.NativeAppSettings.AndroidAppDownloadLink = new(string)
		*o.NativeAppSettings.AndroidAppDownloadLink = "https://about.mattermost.com/mattermost-android-app/"
	}

	if o.NativeAppSettings.IosAppDownloadLink == nil {
		o.NativeAppSettings.IosAppDownloadLink = new(string)
		*o.NativeAppSettings.IosAppDownloadLink = "https://about.mattermost.com/mattermost-ios-app/"
	}
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

	if len(o.ServiceSettings.ListenAddress) == 0 {
		return NewLocAppError("Config.IsValid", "model.config.is_valid.listen_address.app_error", nil, "")
	}

	if o.TeamSettings.MaxUsersPerTeam <= 0 {
		return NewLocAppError("Config.IsValid", "model.config.is_valid.max_users.app_error", nil, "")
	}

	if !(*o.TeamSettings.RestrictDirectMessage == DIRECT_MESSAGE_ANY || *o.TeamSettings.RestrictDirectMessage == DIRECT_MESSAGE_TEAM) {
		return NewLocAppError("Config.IsValid", "model.config.is_valid.restrict_direct_message.app_error", nil, "")
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

	if o.FileSettings.PreviewHeight < 0 {
		return NewLocAppError("Config.IsValid", "model.config.is_valid.file_preview_height.app_error", nil, "")
	}

	if o.FileSettings.PreviewWidth <= 0 {
		return NewLocAppError("Config.IsValid", "model.config.is_valid.file_preview_width.app_error", nil, "")
	}

	if o.FileSettings.ProfileHeight <= 0 {
		return NewLocAppError("Config.IsValid", "model.config.is_valid.file_profile_height.app_error", nil, "")
	}

	if o.FileSettings.ProfileWidth <= 0 {
		return NewLocAppError("Config.IsValid", "model.config.is_valid.file_profile_width.app_error", nil, "")
	}

	if o.FileSettings.ThumbnailHeight <= 0 {
		return NewLocAppError("Config.IsValid", "model.config.is_valid.file_thumb_height.app_error", nil, "")
	}

	if o.FileSettings.ThumbnailWidth <= 0 {
		return NewLocAppError("Config.IsValid", "model.config.is_valid.file_thumb_width.app_error", nil, "")
	}

	if len(o.FileSettings.PublicLinkSalt) < 32 {
		return NewLocAppError("Config.IsValid", "model.config.is_valid.file_salt.app_error", nil, "")
	}

	if !(o.EmailSettings.ConnectionSecurity == CONN_SECURITY_NONE || o.EmailSettings.ConnectionSecurity == CONN_SECURITY_TLS || o.EmailSettings.ConnectionSecurity == CONN_SECURITY_STARTTLS) {
		return NewLocAppError("Config.IsValid", "model.config.is_valid.email_security.app_error", nil, "")
	}

	if len(o.EmailSettings.InviteSalt) < 32 {
		return NewLocAppError("Config.IsValid", "model.config.is_valid.email_salt.app_error", nil, "")
	}

	if len(o.EmailSettings.PasswordResetSalt) < 32 {
		return NewLocAppError("Config.IsValid", "model.config.is_valid.email_reset_salt.app_error", nil, "")
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

		if *o.LdapSettings.FirstNameAttribute == "" {
			return NewLocAppError("Config.IsValid", "model.config.is_valid.ldap_firstname", nil, "")
		}

		if *o.LdapSettings.LastNameAttribute == "" {
			return NewLocAppError("Config.IsValid", "model.config.is_valid.ldap_lastname", nil, "")
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
		if len(*o.SamlSettings.IdpUrl) == 0 || !IsValidHttpUrl(*o.SamlSettings.IdpDescriptorUrl) {
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

		if len(*o.SamlSettings.FirstNameAttribute) == 0 {
			return NewLocAppError("Config.IsValid", "model.config.is_valid.saml_first_name_attribute.app_error", nil, "")
		}

		if len(*o.SamlSettings.LastNameAttribute) == 0 {
			return NewLocAppError("Config.IsValid", "model.config.is_valid.saml_last_name_attribute.app_error", nil, "")
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

	o.FileSettings.PublicLinkSalt = FAKE_SETTING
	if len(o.FileSettings.AmazonS3SecretAccessKey) > 0 {
		o.FileSettings.AmazonS3SecretAccessKey = FAKE_SETTING
	}

	o.EmailSettings.InviteSalt = FAKE_SETTING
	o.EmailSettings.PasswordResetSalt = FAKE_SETTING
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
}
