// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

type ServiceSettings struct {
	SiteName                   string
	Mode                       string
	AllowTesting               bool
	UseSSL                     bool
	Port                       string
	Version                    string
	InviteSalt                 string
	PublicLinkSalt             string
	ResetSalt                  string
	AnalyticsUrl               string
	UseLocalStorage            bool
	StorageDirectory           string
	AllowedLoginAttempts       int
	DisableEmailSignUp         bool
	EnableOAuthServiceProvider bool
}

type SSOSetting struct {
	Allow           bool
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
	ConsoleEnable bool
	ConsoleLevel  string
	FileEnable    bool
	FileLevel     string
	FileFormat    string
	FileLocation  string
}

type AWSSettings struct {
	S3AccessKeyId     string
	S3SecretAccessKey string
	S3Bucket          string
	S3Region          string
}

type ImageSettings struct {
	ThumbnailWidth  uint
	ThumbnailHeight uint
	PreviewWidth    uint
	PreviewHeight   uint
	ProfileWidth    uint
	ProfileHeight   uint
	InitialFont     string
}

type EmailSettings struct {
	ByPassEmail          bool
	SMTPUsername         string
	SMTPPassword         string
	SMTPServer           string
	UseTLS               bool
	UseStartTLS          bool
	FeedbackEmail        string
	FeedbackName         string
	ApplePushServer      string
	ApplePushCertPublic  string
	ApplePushCertPrivate string
}

type RateLimitSettings struct {
	UseRateLimiter   bool
	PerSec           int
	MemoryStoreSize  int
	VaryByRemoteAddr bool
	VaryByHeader     string
}

type PrivacySettings struct {
	ShowEmailAddress bool
	ShowPhoneNumber  bool
	ShowSkypeId      bool
	ShowFullName     bool
}

type ClientSettings struct {
	SegmentDeveloperKey string
	GoogleDeveloperKey  string
}

type TeamSettings struct {
	MaxUsersPerTeam           int
	AllowPublicLink           bool
	AllowValetDefault         bool
	TourLink                  string
	DefaultThemeColor         string
	DisableTeamCreation       bool
	RestrictCreationToDomains string
}

type Config struct {
	LogSettings       LogSettings
	ServiceSettings   ServiceSettings
	SqlSettings       SqlSettings
	AWSSettings       AWSSettings
	ImageSettings     ImageSettings
	EmailSettings     EmailSettings
	RateLimitSettings RateLimitSettings
	PrivacySettings   PrivacySettings
	ClientSettings    ClientSettings
	TeamSettings      TeamSettings
	SSOSettings       map[string]SSOSetting
}

func (o *Config) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
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
