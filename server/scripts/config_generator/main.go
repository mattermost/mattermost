// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/mattermost/mattermost/server/public/model"
)

// customizeConfig applies custom modifications to the default config
func customizeConfig(cfg *model.Config) {
	// Nimbupani's custom modifications will come here
	cfg.ServiceSettings.SiteURL = model.NewString("https://nimbupani.ai/")
	cfg.LogSettings.EnableConsole = model.NewBool(true)
	cfg.LogSettings.ConsoleLevel = model.NewString("DEBUG")
	cfg.TeamSettings.SiteName = model.NewString("Nimbupani")
	cfg.TeamSettings.MaxChannelsPerTeam = model.NewInt64(20000)
	cfg.TeamSettings.MaxUsersPerTeam = model.NewInt(50000)
	cfg.SupportSettings.TermsOfServiceLink = model.NewString("https://nimbupani.ai/terms/")
	cfg.SupportSettings.PrivacyPolicyLink = model.NewString("https://nimbupani.ai/privacy-policy/")
	cfg.SupportSettings.AboutLink = model.NewString("https://nimbupani.ai/")

}

// generateDefaultConfig writes default config with custom modifications to outputFile.
func generateDefaultConfig(outputFile *os.File) error {
	defaultCfg := &model.Config{}
	defaultCfg.SetDefaults()
	
	// Apply custom modifications
	customizeConfig(defaultCfg)
	
	if data, err := json.MarshalIndent(defaultCfg, "", "  "); err != nil {
		return err
	} else if _, err := outputFile.Write(data); err != nil {
		return err
	}
	return nil
}

func main() {
	outputFile := os.Getenv("OUTPUT_CONFIG")
	if outputFile == "" {
		fmt.Println("Output file name is missing. Please set OUTPUT_CONFIG env variable to absolute path")
		os.Exit(2)
	}
	if _, err := os.Stat(outputFile); !os.IsNotExist(err) {
		_, _ = fmt.Fprintf(os.Stderr, "File %s already exists. Not overwriting!\n", outputFile)
		os.Exit(2)
	}

	if file, err := os.Create(outputFile); err == nil {
		err = generateDefaultConfig(file)
		_ = file.Close()
		if err != nil {
			panic(err)
		}
	} else {
		panic(err)
	}
}
