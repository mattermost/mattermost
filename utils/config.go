// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	l4g "code.google.com/p/log4go"
	"encoding/json"
	"net/mail"
	"os"
	"path/filepath"
)

const (
	MODE_DEV  = "dev"
	MODE_BETA = "beta"
	MODE_PROD = "prod"
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
	TokenSalt                  string
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

type TeamSettings struct {
	MaxUsersPerTeam           int
	AllowPublicLink           bool
	AllowValetDefault         bool
	TermsLink                 string
	PrivacyLink               string
	AboutLink                 string
	HelpLink                  string
	ReportProblemLink         string
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

var Cfg *Config = &Config{}
var SanitizeOptions map[string]bool = map[string]bool{}

func findConfigFile(fileName string) string {
	if _, err := os.Stat("/tmp/" + fileName); err == nil {
		fileName, _ = filepath.Abs("/tmp/" + fileName)
	} else if _, err := os.Stat("./config/" + fileName); err == nil {
		fileName, _ = filepath.Abs("./config/" + fileName)
	} else if _, err := os.Stat("../config/" + fileName); err == nil {
		fileName, _ = filepath.Abs("../config/" + fileName)
	} else if _, err := os.Stat(fileName); err == nil {
		fileName, _ = filepath.Abs(fileName)
	}

	return fileName
}

func FindDir(dir string) string {
	fileName := "."
	if _, err := os.Stat("./" + dir + "/"); err == nil {
		fileName, _ = filepath.Abs("./" + dir + "/")
	} else if _, err := os.Stat("../" + dir + "/"); err == nil {
		fileName, _ = filepath.Abs("../" + dir + "/")
	} else if _, err := os.Stat("/tmp/" + dir); err == nil {
		fileName, _ = filepath.Abs("/tmp/" + dir)
	}

	return fileName + "/"
}

func configureLog(s LogSettings) {

	l4g.Close()

	if s.ConsoleEnable {
		level := l4g.DEBUG
		if s.ConsoleLevel == "INFO" {
			level = l4g.INFO
		} else if s.ConsoleLevel == "ERROR" {
			level = l4g.ERROR
		}

		l4g.AddFilter("stdout", level, l4g.NewConsoleLogWriter())
	}

	if s.FileEnable {
		if s.FileFormat == "" {
			s.FileFormat = "[%D %T] [%L] %M"
		}

		if s.FileLocation == "" {
			s.FileLocation = FindDir("logs") + "mattermost.log"
		}

		level := l4g.DEBUG
		if s.FileLevel == "INFO" {
			level = l4g.INFO
		} else if s.FileLevel == "ERROR" {
			level = l4g.ERROR
		}

		flw := l4g.NewFileLogWriter(s.FileLocation, false)
		flw.SetFormat(s.FileFormat)
		flw.SetRotate(true)
		flw.SetRotateLines(100000)
		l4g.AddFilter("file", level, flw)
	}
}

// LoadConfig will try to search around for the corresponding config file.
// It will search /tmp/fileName then attempt ./config/fileName,
// then ../config/fileName and last it will look at fileName
func LoadConfig(fileName string) {

	fileName = findConfigFile(fileName)
	l4g.Info("Loading config file at " + fileName)

	file, err := os.Open(fileName)
	if err != nil {
		panic("Error opening config file=" + fileName + ", err=" + err.Error())
	}

	decoder := json.NewDecoder(file)
	config := Config{}
	err = decoder.Decode(&config)
	if err != nil {
		panic("Error decoding configuration " + err.Error())
	}

	// Check for a valid email for feedback, if not then do feedback@domain
	if _, err := mail.ParseAddress(config.EmailSettings.FeedbackEmail); err != nil {
		l4g.Error("Misconfigured feedback email setting: %s", config.EmailSettings.FeedbackEmail)
		config.EmailSettings.FeedbackEmail = "feedback@localhost"
	}

	configureLog(config.LogSettings)

	Cfg = &config
	SanitizeOptions = getSanitizeOptions()

	// Validates our mail settings
	if err := CheckMailSettings(); err != nil {
		l4g.Error("Email settings are not valid err=%v", err)
	}
}

func getSanitizeOptions() map[string]bool {
	options := map[string]bool{}
	options["fullname"] = Cfg.PrivacySettings.ShowFullName
	options["email"] = Cfg.PrivacySettings.ShowEmailAddress
	options["skypeid"] = Cfg.PrivacySettings.ShowSkypeId
	options["phonenumber"] = Cfg.PrivacySettings.ShowPhoneNumber

	return options
}

func IsS3Configured() bool {
	if Cfg.AWSSettings.S3AccessKeyId == "" || Cfg.AWSSettings.S3SecretAccessKey == "" || Cfg.AWSSettings.S3Region == "" || Cfg.AWSSettings.S3Bucket == "" {
		return false
	}

	return true
}

func GetAllowedAuthServices() []string {
	authServices := []string{}
	for name, service := range Cfg.SSOSettings {
		if service.Allow {
			authServices = append(authServices, name)
		}
	}

	if !Cfg.ServiceSettings.DisableEmailSignUp {
		authServices = append(authServices, "email")
	}

	return authServices
}

func IsServiceAllowed(s string) bool {
	if len(s) == 0 {
		return false
	}

	if service, ok := Cfg.SSOSettings[s]; ok {
		if service.Allow {
			return true
		}
	}

	return false
}
