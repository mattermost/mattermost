package config

import (
	"log"

	"github.com/spf13/viper"
)

const (
	DefaultServerRoot = "http://localhost:8000"
	DefaultPort       = 8000
)

type AmazonS3Config struct {
	AccessKeyID     string
	SecretAccessKey string
	Bucket          string
	PathPrefix      string
	Region          string
	Endpoint        string
	SSL             bool
	SignV2          bool
	SSE             bool
	Trace           bool
	Timeout         int64
}

// Configuration is the app configuration stored in a json file.
type Configuration struct {
	ServerRoot               string            `json:"serverRoot" mapstructure:"serverRoot"`
	Port                     int               `json:"port" mapstructure:"port"`
	DBType                   string            `json:"dbtype" mapstructure:"dbtype"`
	DBConfigString           string            `json:"dbconfig" mapstructure:"dbconfig"`
	DBTablePrefix            string            `json:"dbtableprefix" mapstructure:"dbtableprefix"`
	UseSSL                   bool              `json:"useSSL" mapstructure:"useSSL"`
	SecureCookie             bool              `json:"secureCookie" mapstructure:"secureCookie"`
	WebPath                  string            `json:"webpath" mapstructure:"webpath"`
	FilesDriver              string            `json:"filesdriver" mapstructure:"filesdriver"`
	FilesS3Config            AmazonS3Config    `json:"filess3config" mapstructure:"filess3config"`
	FilesPath                string            `json:"filespath" mapstructure:"filespath"`
	MaxFileSize              int64             `json:"maxfilesize" mapstructure:"maxfilesize"`
	Telemetry                bool              `json:"telemetry" mapstructure:"telemetry"`
	TelemetryID              string            `json:"telemetryid" mapstructure:"telemetryid"`
	PrometheusAddress        string            `json:"prometheusaddress" mapstructure:"prometheusaddress"`
	WebhookUpdate            []string          `json:"webhook_update" mapstructure:"webhook_update"`
	Secret                   string            `json:"secret" mapstructure:"secret"`
	SessionExpireTime        int64             `json:"session_expire_time" mapstructure:"session_expire_time"`
	SessionRefreshTime       int64             `json:"session_refresh_time" mapstructure:"session_refresh_time"`
	LocalOnly                bool              `json:"localonly" mapstructure:"localonly"`
	EnableLocalMode          bool              `json:"enableLocalMode" mapstructure:"enableLocalMode"`
	LocalModeSocketLocation  string            `json:"localModeSocketLocation" mapstructure:"localModeSocketLocation"`
	EnablePublicSharedBoards bool              `json:"enablePublicSharedBoards" mapstructure:"enablePublicSharedBoards"`
	FeatureFlags             map[string]string `json:"featureFlags" mapstructure:"featureFlags"`
	EnableDataRetention      bool              `json:"enable_data_retention" mapstructure:"enable_data_retention"`
	DataRetentionDays        int               `json:"data_retention_days" mapstructure:"data_retention_days"`
	TeammateNameDisplay      string            `json:"teammate_name_display" mapstructure:"teammateNameDisplay"`
	ShowEmailAddress         bool              `json:"show_email_address" mapstructure:"showEmailAddress"`
	ShowFullName             bool              `json:"show_full_name" mapstructure:"showFullName"`

	AuthMode string `json:"authMode" mapstructure:"authMode"`

	LoggingCfgFile string `json:"logging_cfg_file" mapstructure:"logging_cfg_file"`
	LoggingCfgJSON string `json:"logging_cfg_json" mapstructure:"logging_cfg_json"`

	AuditCfgFile string `json:"audit_cfg_file" mapstructure:"audit_cfg_file"`
	AuditCfgJSON string `json:"audit_cfg_json" mapstructure:"audit_cfg_json"`

	NotifyFreqCardSeconds  int `json:"notify_freq_card_seconds" mapstructure:"notify_freq_card_seconds"`
	NotifyFreqBoardSeconds int `json:"notify_freq_board_seconds" mapstructure:"notify_freq_board_seconds"`
}

// ReadConfigFile read the configuration from the filesystem.
func ReadConfigFile(configFilePath string) (*Configuration, error) {
	if configFilePath == "" {
		viper.SetConfigFile("./config.json")
	} else {
		viper.SetConfigFile(configFilePath)
	}

	viper.SetEnvPrefix("focalboard")
	viper.AutomaticEnv() // read config values from env like FOCALBOARD_SERVERROOT=...
	viper.SetDefault("ServerRoot", DefaultServerRoot)
	viper.SetDefault("Port", DefaultPort)
	viper.SetDefault("DBType", "postgres")
	viper.SetDefault("DBConfigString", "postgres://mmuser:mostest@localhost/mattermost_test?sslmode=disable\u0026connect_timeout=10\u0026binary_parameters=yes")
	viper.SetDefault("DBTablePrefix", "")
	viper.SetDefault("SecureCookie", false)
	viper.SetDefault("WebPath", "./pack")
	viper.SetDefault("FilesPath", "./files")
	viper.SetDefault("FilesDriver", "local")
	viper.SetDefault("Telemetry", true)
	viper.SetDefault("TelemetryID", "")
	viper.SetDefault("WebhookUpdate", nil)
	viper.SetDefault("SessionExpireTime", 60*60*24*30) // 30 days session lifetime
	viper.SetDefault("SessionRefreshTime", 60*60*5)    // 5 minutes session refresh
	viper.SetDefault("LocalOnly", false)
	viper.SetDefault("EnableLocalMode", false)
	viper.SetDefault("LocalModeSocketLocation", "/var/tmp/focalboard_local.socket")
	viper.SetDefault("EnablePublicSharedBoards", false)
	viper.SetDefault("FeatureFlags", map[string]string{})
	viper.SetDefault("AuthMode", "native")
	viper.SetDefault("NotifyFreqCardSeconds", 120)    // 2 minutes after last card edit
	viper.SetDefault("NotifyFreqBoardSeconds", 86400) // 1 day after last card edit
	viper.SetDefault("EnableDataRetention", false)
	viper.SetDefault("DataRetentionDays", 365) // 1 year is default
	viper.SetDefault("PrometheusAddress", "")
	viper.SetDefault("TeammateNameDisplay", "username")
	viper.SetDefault("ShowEmailAddress", false)
	viper.SetDefault("ShowFullName", false)

	err := viper.ReadInConfig() // Find and read the config file
	if err != nil {             // Handle errors reading the config file
		return nil, err
	}

	configuration := Configuration{}

	err = viper.Unmarshal(&configuration)
	if err != nil {
		return nil, err
	}

	log.Println("readConfigFile")
	log.Printf("%+v", removeSecurityData(configuration))

	return &configuration, nil
}

func removeSecurityData(config Configuration) Configuration {
	clean := config
	return clean
}
