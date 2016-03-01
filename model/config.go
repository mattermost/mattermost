// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

const (
	CONN_SECURITY_NONE     = ""
	CONN_SECURITY_TLS      = "TLS"
	CONN_SECURITY_STARTTLS = "STARTTLS"

	IMAGE_DRIVER_LOCAL = "local"
	IMAGE_DRIVER_S3    = "amazons3"

	DATABASE_DRIVER_MYSQL    = "mysql"
	DATABASE_DRIVER_POSTGRES = "postgres"

	SERVICE_GITLAB = "gitlab"
	SERVICE_GOOGLE = "google"
)

type ServiceSettings struct {
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
	AllowCorsFrom                     *string
	SessionLengthWebInDays            *int
	SessionLengthMobileInDays         *int
	SessionLengthSSOInDays            *int
	SessionCacheInMinutes             *int
	WebsocketSecurePort               *int
	WebsocketPort                     *int
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
	EnableConsole bool
	ConsoleLevel  string
	EnableFile    bool
	FileLevel     string
	FileFormat    string
	FileLocation  string
}

type FileSettings struct {
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
	SMTPUsername             string
	SMTPPassword             string
	SMTPServer               string
	SMTPPort                 string
	ConnectionSecurity       string
	InviteSalt               string
	PasswordResetSalt        string
	SendPushNotifications    *bool
	PushNotificationServer   *string
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
	SiteName                  string
	MaxUsersPerTeam           int
	EnableTeamCreation        bool
	EnableUserCreation        bool
	RestrictCreationToDomains string
	RestrictTeamNames         *bool
	EnableTeamListing         *bool
}

type LdapSettings struct {
	// Basic
	Enable       *bool
	LdapServer   *string
	LdapPort     *int
	BaseDN       *string
	BindUsername *string
	BindPassword *string

	// User Mapping
	FirstNameAttribute *string
	LastNameAttribute  *string
	EmailAttribute     *string
	UsernameAttribute  *string
	IdAttribute        *string

	// Advanced
	QueryTimeout *int
}

type Config struct {
	ServiceSettings   ServiceSettings
	TeamSettings      TeamSettings
	SqlSettings       SqlSettings
	LogSettings       LogSettings
	FileSettings      FileSettings
	EmailSettings     EmailSettings
	RateLimitSettings RateLimitSettings
	PrivacySettings   PrivacySettings
	SupportSettings   SupportSettings
	GitLabSettings    SSOSettings
	GoogleSettings    SSOSettings
	LdapSettings      LdapSettings
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

	if o.TeamSettings.RestrictTeamNames == nil {
		o.TeamSettings.RestrictTeamNames = new(bool)
		*o.TeamSettings.RestrictTeamNames = true
	}

	if o.TeamSettings.EnableTeamListing == nil {
		o.TeamSettings.EnableTeamListing = new(bool)
		*o.TeamSettings.EnableTeamListing = false
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

	if o.SupportSettings.TermsOfServiceLink == nil {
		o.SupportSettings.TermsOfServiceLink = new(string)
		*o.SupportSettings.TermsOfServiceLink = "/static/help/terms.html"
	}

	if o.SupportSettings.PrivacyPolicyLink == nil {
		o.SupportSettings.PrivacyPolicyLink = new(string)
		*o.SupportSettings.PrivacyPolicyLink = "/static/help/privacy.html"
	}

	if o.SupportSettings.AboutLink == nil {
		o.SupportSettings.AboutLink = new(string)
		*o.SupportSettings.AboutLink = "/static/help/about.html"
	}

	if o.SupportSettings.HelpLink == nil {
		o.SupportSettings.HelpLink = new(string)
		*o.SupportSettings.HelpLink = "/static/help/help.html"
	}

	if o.SupportSettings.ReportAProblemLink == nil {
		o.SupportSettings.ReportAProblemLink = new(string)
		*o.SupportSettings.ReportAProblemLink = "/static/help/report_problem.html"
	}

	if o.SupportSettings.SupportEmail == nil {
		o.SupportSettings.SupportEmail = new(string)
		*o.SupportSettings.SupportEmail = "feedback@mattermost.com"
	}

	if o.LdapSettings.LdapPort == nil {
		o.LdapSettings.LdapPort = new(int)
		*o.LdapSettings.LdapPort = 389
	}

	if o.LdapSettings.QueryTimeout == nil {
		o.LdapSettings.QueryTimeout = new(int)
		*o.LdapSettings.QueryTimeout = 60
	}

	if o.LdapSettings.Enable == nil {
		o.LdapSettings.Enable = new(bool)
		*o.LdapSettings.Enable = false
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
}

func (o *Config) IsValid() *AppError {

	if o.ServiceSettings.MaximumLoginAttempts <= 0 {
		return NewLocAppError("Config.IsValid", "model.config.is_valid.login_attempts.app_error", nil, "")
	}

	if len(o.ServiceSettings.ListenAddress) == 0 {
		return NewLocAppError("Config.IsValid", "model.config.is_valid.listen_address.app_error", nil, "")
	}

	if o.TeamSettings.MaxUsersPerTeam <= 0 {
		return NewLocAppError("Config.IsValid", "model.config.is_valid.max_users.app_error", nil, "")
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

	return nil
}

func (me *Config) GetSanitizeOptions() map[string]bool {
	options := map[string]bool{}
	options["fullname"] = me.PrivacySettings.ShowFullName
	options["email"] = me.PrivacySettings.ShowEmailAddress

	return options
}
