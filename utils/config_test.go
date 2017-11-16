// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/model"
)

func TestConfig(t *testing.T) {
	TranslationsPreInit()
	LoadGlobalConfig("config.json")
	InitTranslations(Cfg.LocalizationSettings)
}

func TestFindConfigFile(t *testing.T) {
	dir, err := ioutil.TempDir("", "")
	require.NoError(t, err)
	defer os.RemoveAll(dir)

	path := filepath.Join(dir, "config.json")
	require.NoError(t, ioutil.WriteFile(path, []byte("{}"), 0600))

	assert.Equal(t, path, FindConfigFile(path))

	prevDir, err := os.Getwd()
	require.NoError(t, err)
	defer os.Chdir(prevDir)
	os.Chdir(dir)
	assert.Equal(t, path, FindConfigFile(path))
}

func TestConfigFromEnviroVars(t *testing.T) {
	os.Setenv("MM_TEAMSETTINGS_SITENAME", "From Enviroment")
	os.Setenv("MM_TEAMSETTINGS_CUSTOMBRANDTEXT", "Custom Brand")
	os.Setenv("MM_SERVICESETTINGS_ENABLECOMMANDS", "false")
	os.Setenv("MM_SERVICESETTINGS_READTIMEOUT", "400")

	TranslationsPreInit()
	LoadGlobalConfig("config.json")

	if Cfg.TeamSettings.SiteName != "From Enviroment" {
		t.Fatal("Couldn't read config from enviroment var")
	}

	if *Cfg.TeamSettings.CustomBrandText != "Custom Brand" {
		t.Fatal("Couldn't read config from enviroment var")
	}

	if *Cfg.ServiceSettings.EnableCommands {
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

	LoadGlobalConfig("config.json")

	if Cfg.TeamSettings.SiteName != "Mattermost" {
		t.Fatal("should have been reset")
	}
}

func TestRedirectStdLog(t *testing.T) {
	TranslationsPreInit()
	LoadGlobalConfig("config.json")
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
	numIntitialCfgListeners := len(cfgListeners)

	id1 := AddConfigListener(func(*model.Config, *model.Config) {
	})
	if len(cfgListeners) != numIntitialCfgListeners+1 {
		t.Fatal("should now have 1 listener")
	}

	id2 := AddConfigListener(func(*model.Config, *model.Config) {
	})
	if len(cfgListeners) != numIntitialCfgListeners+2 {
		t.Fatal("should now have 2 listeners")
	}

	RemoveConfigListener(id1)
	if len(cfgListeners) != numIntitialCfgListeners+1 {
		t.Fatal("should've removed first listener")
	}

	RemoveConfigListener(id2)
	if len(cfgListeners) != numIntitialCfgListeners {
		t.Fatal("should've removed both listeners")
	}
}

func TestConfigListener(t *testing.T) {
	TranslationsPreInit()
	LoadGlobalConfig("config.json")

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

	LoadGlobalConfig("config.json")

	if !listenerCalled {
		t.Fatal("listener should've been called")
	} else if !listener2Called {
		t.Fatal("listener 2 should've been called")
	}
}

func TestValidateLocales(t *testing.T) {
	TranslationsPreInit()
	LoadGlobalConfig("config.json")

	defaultServerLocale := *Cfg.LocalizationSettings.DefaultServerLocale
	defaultClientLocale := *Cfg.LocalizationSettings.DefaultClientLocale
	availableLocales := *Cfg.LocalizationSettings.AvailableLocales

	defer func() {
		*Cfg.LocalizationSettings.DefaultClientLocale = defaultClientLocale
		*Cfg.LocalizationSettings.DefaultServerLocale = defaultServerLocale
		*Cfg.LocalizationSettings.AvailableLocales = availableLocales
	}()

	*Cfg.LocalizationSettings.DefaultServerLocale = "en"
	*Cfg.LocalizationSettings.DefaultClientLocale = "en"
	*Cfg.LocalizationSettings.AvailableLocales = ""

	// t.Logf("*Cfg.LocalizationSettings.DefaultClientLocale: %+v", *Cfg.LocalizationSettings.DefaultClientLocale)
	if err := ValidateLocales(Cfg); err != nil {
		t.Fatal("Should have not returned an error")
	}

	// validate DefaultServerLocale
	*Cfg.LocalizationSettings.DefaultServerLocale = "junk"
	if err := ValidateLocales(Cfg); err != nil {
		if *Cfg.LocalizationSettings.DefaultServerLocale != "en" {
			t.Fatal("DefaultServerLocale should have assigned to en as a default value")
		}
	} else {

		t.Fatal("Should have returned an error validating DefaultServerLocale")
	}

	*Cfg.LocalizationSettings.DefaultServerLocale = ""
	if err := ValidateLocales(Cfg); err != nil {
		if *Cfg.LocalizationSettings.DefaultServerLocale != "en" {
			t.Fatal("DefaultServerLocale should have assigned to en as a default value")
		}
	} else {
		t.Fatal("Should have returned an error validating DefaultServerLocale")
	}

	*Cfg.LocalizationSettings.AvailableLocales = "en"
	*Cfg.LocalizationSettings.DefaultServerLocale = "de"
	if err := ValidateLocales(Cfg); err != nil {
		if strings.Contains(*Cfg.LocalizationSettings.AvailableLocales, *Cfg.LocalizationSettings.DefaultServerLocale) {
			t.Fatal("DefaultServerLocale should not be added to AvailableLocales")
		}
		t.Fatal("Should have not returned an error validating DefaultServerLocale")
	}

	// validate DefaultClientLocale
	*Cfg.LocalizationSettings.AvailableLocales = ""
	*Cfg.LocalizationSettings.DefaultClientLocale = "junk"
	if err := ValidateLocales(Cfg); err != nil {
		if *Cfg.LocalizationSettings.DefaultClientLocale != "en" {
			t.Fatal("DefaultClientLocale should have assigned to en as a default value")
		}
	} else {

		t.Fatal("Should have returned an error validating DefaultClientLocale")
	}

	*Cfg.LocalizationSettings.DefaultClientLocale = ""
	if err := ValidateLocales(Cfg); err != nil {
		if *Cfg.LocalizationSettings.DefaultClientLocale != "en" {
			t.Fatal("DefaultClientLocale should have assigned to en as a default value")
		}
	} else {
		t.Fatal("Should have returned an error validating DefaultClientLocale")
	}

	*Cfg.LocalizationSettings.AvailableLocales = "en"
	*Cfg.LocalizationSettings.DefaultClientLocale = "de"
	if err := ValidateLocales(Cfg); err != nil {
		if !strings.Contains(*Cfg.LocalizationSettings.AvailableLocales, *Cfg.LocalizationSettings.DefaultClientLocale) {
			t.Fatal("DefaultClientLocale should have added to AvailableLocales")
		}
	} else {
		t.Fatal("Should have returned an error validating DefaultClientLocale")
	}

	// validate AvailableLocales
	*Cfg.LocalizationSettings.DefaultServerLocale = "en"
	*Cfg.LocalizationSettings.DefaultClientLocale = "en"
	*Cfg.LocalizationSettings.AvailableLocales = "junk"
	if err := ValidateLocales(Cfg); err != nil {
		if *Cfg.LocalizationSettings.AvailableLocales != "" {
			t.Fatal("AvailableLocales should have assigned to empty string as a default value")
		}
	} else {
		t.Fatal("Should have returned an error validating AvailableLocales")
	}

	*Cfg.LocalizationSettings.AvailableLocales = "en,de,junk"
	if err := ValidateLocales(Cfg); err != nil {
		if *Cfg.LocalizationSettings.AvailableLocales != "" {
			t.Fatal("AvailableLocales should have assigned to empty string as a default value")
		}
	} else {
		t.Fatal("Should have returned an error validating AvailableLocales")
	}

	*Cfg.LocalizationSettings.DefaultServerLocale = "fr"
	*Cfg.LocalizationSettings.DefaultClientLocale = "de"
	*Cfg.LocalizationSettings.AvailableLocales = "en"
	if err := ValidateLocales(Cfg); err != nil {
		if strings.Contains(*Cfg.LocalizationSettings.AvailableLocales, *Cfg.LocalizationSettings.DefaultServerLocale) {
			t.Fatal("DefaultServerLocale should not be added to AvailableLocales")
		}
		if !strings.Contains(*Cfg.LocalizationSettings.AvailableLocales, *Cfg.LocalizationSettings.DefaultClientLocale) {
			t.Fatal("DefaultClientLocale should have added to AvailableLocales")
		}
	} else {
		t.Fatal("Should have returned an error validating AvailableLocales")
	}
}

func TestGetClientConfig(t *testing.T) {
	TranslationsPreInit()
	LoadGlobalConfig("config.json")

	configMap := getClientConfig(Cfg)
	if configMap["EmailNotificationContentsType"] != *Cfg.EmailSettings.EmailNotificationContentsType {
		t.Fatal("EmailSettings.EmailNotificationContentsType not exposed to client config")
	}
}

func TestReadConfig(t *testing.T) {
	config, err := ReadConfig(strings.NewReader(`{
		"ServiceSettings": {
			"SiteURL": "http://foo.bar"
		}
	}`), false)
	require.NoError(t, err)

	assert.Equal(t, "http://foo.bar", *config.ServiceSettings.SiteURL)
}
