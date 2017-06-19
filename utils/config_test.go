// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"os"
	"testing"
	"time"

	"github.com/mattermost/platform/model"
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

func TestRedirectStdLog(t *testing.T) {
	TranslationsPreInit()
	LoadConfig("config.json")
	InitTranslations(Cfg.LocalizationSettings)

	log := NewRedirectStdLog("test", false)

	log.Println("[DEBUG] this is a message")
	log.Println("[DEBG] this is a message")
	log.Println("[WARN] this is a message")
	log.Println("[ERROR] this is a message")
	log.Println("[EROR] this is a message")
	log.Println("[ERR] this is a message")
	log.Println("[INFO] this is a message")
	log.Println("this is a message")

	time.Sleep(time.Second * 1)
}

func TestAddRemoveConfigListener(t *testing.T) {
	if len(cfgListeners) != 0 {
		t.Fatal("should've started with 0 listeners")
	}

	id1 := AddConfigListener(func(*model.Config, *model.Config) {
	})
	if len(cfgListeners) != 1 {
		t.Fatal("should now have 1 listener")
	}

	id2 := AddConfigListener(func(*model.Config, *model.Config) {
	})
	if len(cfgListeners) != 2 {
		t.Fatal("should now have 2 listeners")
	}

	RemoveConfigListener(id1)
	if len(cfgListeners) != 1 {
		t.Fatal("should've removed first listener")
	}

	RemoveConfigListener(id2)
	if len(cfgListeners) != 0 {
		t.Fatal("should've removed both listeners")
	}
}

func TestConfigListener(t *testing.T) {
	TranslationsPreInit()
	EnableConfigFromEnviromentVars()
	LoadConfig("config.json")

	SiteName := Cfg.TeamSettings.SiteName
	defer func() {
		Cfg.TeamSettings.SiteName = SiteName
		SaveConfig(CfgFileName, Cfg)
	}()
	Cfg.TeamSettings.SiteName = "test123"

	listenerCalled := false
	listener := func(oldConfig *model.Config, newConfig *model.Config) {
		if listenerCalled {
			t.Fatal("listener called twice")
		}

		if oldConfig.TeamSettings.SiteName != "test123" {
			t.Fatal("old config contains incorrect site name")
		} else if newConfig.TeamSettings.SiteName != "Mattermost" {
			t.Fatal("new config contains incorrect site name")
		}

		listenerCalled = true
	}
	listenerId := AddConfigListener(listener)
	defer RemoveConfigListener(listenerId)

	listener2Called := false
	listener2 := func(oldConfig *model.Config, newConfig *model.Config) {
		if listener2Called {
			t.Fatal("listener2 called twice")
		}

		listener2Called = true
	}
	listener2Id := AddConfigListener(listener2)
	defer RemoveConfigListener(listener2Id)

	LoadConfig("config.json")

	if !listenerCalled {
		t.Fatal("listener should've been called")
	} else if !listener2Called {
		t.Fatal("listener 2 should've been called")
	}
}
