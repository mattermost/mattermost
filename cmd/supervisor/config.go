// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"encoding/json"
	"fmt"
	"os"
)

// Config is the configuration for supervisor.
type Config struct {
	ServiceSettings ServiceSettings
	AppSettings     []AppSetting
}

// ServiceSettings is the configuration related to the web server.
type ServiceSettings struct {
	Host               string
	TLSCertFile        string
	TLSKeyFile         string
	DefaultRoutePrefix string
}

type AppSetting struct {
	Command     string
	Args        []string
	RoutePrefix string
	SocketPath  string
	Host        string
}

// parseConfig reads the config file and returns a new *Config,
func parseConfig(path string) (Config, error) {
	var cfg Config
	file, err := os.Open(path)
	if err != nil {
		return cfg, fmt.Errorf("could not open file: %w", err)
	}
	defer file.Close()

	err = json.NewDecoder(file).Decode(&cfg)
	if err != nil {
		return cfg, fmt.Errorf("could not decode file: %w", err)
	}

	return cfg, nil
}
