// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"os"
	"testing"
)

func TestConfig(t *testing.T) {
	TranslationsPreInit()
	LoadConfig("config.json")
	InitTranslations(Cfg.LocalizationSettings)
}

func TestConfigFromEnviroVars(t *testing.T) {

	os.Setenv("MM_TEAMSETTINGS_SITENAME", "From Enviroment")
	os.Setenv("MM_TEAMSETTINGS_CUSTOMBRANDTEXT", "Custom Brand")
	os.Setenv("MM_SERVICESETTINGS_ENABLECOMMANDS", "false")
	os.Setenv("MM_SERVICESETTINGS_READTIMEOUT", "400")

	TranslationsPreInit()
	EnableConfigFromEnviromentVars()
	LoadConfig("config.json")

	if Cfg.TeamSettings.SiteName != "From Enviroment" {
		t.Fatal("Couldn't read config from enviroment var")
	}

	if *Cfg.TeamSettings.CustomBrandText != "Custom Brand" {
		t.Fatal("Couldn't read config from enviroment var")
	}

	if *Cfg.ServiceSettings.EnableCommands != false {
		t.Fatal("Couldn't read config from enviroment var")
	}

	if *Cfg.ServiceSettings.ReadTimeout != 400 {
		t.Fatal("Couldn't read config from enviroment var")
	}

	os.Unsetenv("MM_TEAMSETTINGS_SITENAME")
	os.Unsetenv("MM_TEAMSETTINGS_CUSTOMBRANDTEXT")
	os.Unsetenv("MM_SERVICESETTINGS_ENABLECOMMANDS")
	os.Unsetenv("MM_SERVICESETTINGS_READTIMEOUT")

	Cfg.TeamSettings.SiteName = "Mattermost"
	*Cfg.ServiceSettings.SiteURL = ""
	*Cfg.ServiceSettings.EnableCommands = true
	*Cfg.ServiceSettings.ReadTimeout = 300
	SaveConfig(CfgFileName, Cfg)

	LoadConfig("config.json")

	if Cfg.TeamSettings.SiteName != "Mattermost" {
		t.Fatal("should have been reset")
	}

}
