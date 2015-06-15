package aws

import (
	"io"
	"net/http"
	"os"
)

const DEFAULT_RETRIES = -1

var DefaultConfig = &Config{
	Credentials:            DefaultCreds(),
	Endpoint:               "",
	Region:                 os.Getenv("AWS_REGION"),
	DisableSSL:             false,
	ManualSend:             false,
	HTTPClient:             http.DefaultClient,
	LogLevel:               0,
	Logger:                 os.Stdout,
	MaxRetries:             DEFAULT_RETRIES,
	DisableParamValidation: false,
}

type Config struct {
	Credentials            CredentialsProvider
	Endpoint               string
	Region                 string
	DisableSSL             bool
	ManualSend             bool
	HTTPClient             *http.Client
	LogLevel               uint
	Logger                 io.Writer
	MaxRetries             int
	DisableParamValidation bool
}

func (c Config) Merge(newcfg *Config) *Config {
	cfg := Config{}

	if newcfg != nil && newcfg.Credentials != nil {
		cfg.Credentials = newcfg.Credentials
	} else {
		cfg.Credentials = c.Credentials
	}

	if newcfg != nil && newcfg.Endpoint != "" {
		cfg.Endpoint = newcfg.Endpoint
	} else {
		cfg.Endpoint = c.Endpoint
	}

	if newcfg != nil && newcfg.Region != "" {
		cfg.Region = newcfg.Region
	} else {
		cfg.Region = c.Region
	}

	if newcfg != nil && newcfg.DisableSSL {
		cfg.DisableSSL = newcfg.DisableSSL
	} else {
		cfg.DisableSSL = c.DisableSSL
	}

	if newcfg != nil && newcfg.ManualSend {
		cfg.ManualSend = newcfg.ManualSend
	} else {
		cfg.ManualSend = c.ManualSend
	}

	if newcfg != nil && newcfg.HTTPClient != nil {
		cfg.HTTPClient = newcfg.HTTPClient
	} else {
		cfg.HTTPClient = c.HTTPClient
	}

	if newcfg != nil && newcfg.LogLevel != 0 {
		cfg.LogLevel = newcfg.LogLevel
	} else {
		cfg.LogLevel = c.LogLevel
	}

	if newcfg != nil && newcfg.Logger != nil {
		cfg.Logger = newcfg.Logger
	} else {
		cfg.Logger = c.Logger
	}

	if newcfg != nil && newcfg.MaxRetries != DEFAULT_RETRIES {
		cfg.MaxRetries = newcfg.MaxRetries
	} else {
		cfg.MaxRetries = c.MaxRetries
	}

	if newcfg != nil && newcfg.DisableParamValidation {
		cfg.DisableParamValidation = newcfg.DisableParamValidation
	} else {
		cfg.DisableParamValidation = c.DisableParamValidation
	}

	return &cfg
}
