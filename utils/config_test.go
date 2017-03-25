// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
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
	os.Setenv("MM_SERVICESETTINGS_LISTENADDRESS", ":8011")
	os.Setenv("MM_SERVICESETTINGS_SITEURL", "http://hello")
	os.Setenv("MM_SERVICESETTINGS_ENABLECOMMANDS", "false")
	os.Setenv("MM_SERVICESETTINGS_READTIMEOUT", "400")

	TranslationsPreInit()
	EnableConfigFromEnviromentVars()
	LoadConfig("config.json")

	if Cfg.ServiceSettings.ListenAddress != ":8011" {
		t.Fatal("Couldn't read config from enviroment var")
	}

	if *Cfg.ServiceSettings.SiteURL != "http://hello" {
		t.Fatal("Couldn't read config from enviroment var")
	}

	if *Cfg.ServiceSettings.EnableCommands != false {
		t.Fatal("Couldn't read config from enviroment var")
	}

	if *Cfg.ServiceSettings.ReadTimeout != 400 {
		t.Fatal("Couldn't read config from enviroment var")
	}

	os.Unsetenv("MM_SERVICESETTINGS_LISTENADDRESS")
	os.Unsetenv("MM_SERVICESETTINGS_SITEURL")
	os.Unsetenv("MM_SERVICESETTINGS_ENABLECOMMANDS")
	os.Unsetenv("MM_SERVICESETTINGS_READTIMEOUT")

	Cfg.ServiceSettings.ListenAddress = ":8065"
	*Cfg.ServiceSettings.SiteURL = ""
	*Cfg.ServiceSettings.EnableCommands = true
	*Cfg.ServiceSettings.ReadTimeout = 300
	SaveConfig(CfgFileName, Cfg)

	LoadConfig("config.json")

	if Cfg.ServiceSettings.ListenAddress != ":8065" {
		t.Fatal("should have been reset")
	}

}
