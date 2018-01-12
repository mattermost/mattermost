// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestConfig(t *testing.T) {
	TranslationsPreInit()
	cfg, _, err := LoadConfig("config.json")
	require.Nil(t, err)
	InitTranslations(cfg.LocalizationSettings)
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
	cfg, cfgPath, err := LoadConfig("config.json")
	require.Nil(t, err)

	if cfg.TeamSettings.SiteName != "From Enviroment" {
		t.Fatal("Couldn't read config from enviroment var")
	}

	if *cfg.TeamSettings.CustomBrandText != "Custom Brand" {
		t.Fatal("Couldn't read config from enviroment var")
	}

	if *cfg.ServiceSettings.EnableCommands {
		t.Fatal("Couldn't read config from enviroment var")
	}

	if *cfg.ServiceSettings.ReadTimeout != 400 {
		t.Fatal("Couldn't read config from enviroment var")
	}

	os.Unsetenv("MM_TEAMSETTINGS_SITENAME")
	os.Unsetenv("MM_TEAMSETTINGS_CUSTOMBRANDTEXT")
	os.Unsetenv("MM_SERVICESETTINGS_ENABLECOMMANDS")
	os.Unsetenv("MM_SERVICESETTINGS_READTIMEOUT")

	cfg.TeamSettings.SiteName = "Mattermost"
	*cfg.ServiceSettings.SiteURL = ""
	*cfg.ServiceSettings.EnableCommands = true
	*cfg.ServiceSettings.ReadTimeout = 300
	SaveConfig(cfgPath, cfg)

	cfg, _, err = LoadConfig("config.json")
	require.Nil(t, err)

	if cfg.TeamSettings.SiteName != "Mattermost" {
		t.Fatal("should have been reset")
	}
}

func TestValidateLocales(t *testing.T) {
	TranslationsPreInit()
	cfg, _, err := LoadConfig("config.json")
	require.Nil(t, err)

	*cfg.LocalizationSettings.DefaultServerLocale = "en"
	*cfg.LocalizationSettings.DefaultClientLocale = "en"
	*cfg.LocalizationSettings.AvailableLocales = ""

	// t.Logf("*cfg.LocalizationSettings.DefaultClientLocale: %+v", *cfg.LocalizationSettings.DefaultClientLocale)
	if err := ValidateLocales(cfg); err != nil {
		t.Fatal("Should have not returned an error")
	}

	// validate DefaultServerLocale
	*cfg.LocalizationSettings.DefaultServerLocale = "junk"
	if err := ValidateLocales(cfg); err != nil {
		if *cfg.LocalizationSettings.DefaultServerLocale != "en" {
			t.Fatal("DefaultServerLocale should have assigned to en as a default value")
		}
	} else {
		t.Fatal("Should have returned an error validating DefaultServerLocale")
	}

	*cfg.LocalizationSettings.DefaultServerLocale = ""
	if err := ValidateLocales(cfg); err != nil {
		if *cfg.LocalizationSettings.DefaultServerLocale != "en" {
			t.Fatal("DefaultServerLocale should have assigned to en as a default value")
		}
	} else {
		t.Fatal("Should have returned an error validating DefaultServerLocale")
	}

	*cfg.LocalizationSettings.AvailableLocales = "en"
	*cfg.LocalizationSettings.DefaultServerLocale = "de"
	if err := ValidateLocales(cfg); err != nil {
		if strings.Contains(*cfg.LocalizationSettings.AvailableLocales, *cfg.LocalizationSettings.DefaultServerLocale) {
			t.Fatal("DefaultServerLocale should not be added to AvailableLocales")
		}
		t.Fatal("Should have not returned an error validating DefaultServerLocale")
	}

	// validate DefaultClientLocale
	*cfg.LocalizationSettings.AvailableLocales = ""
	*cfg.LocalizationSettings.DefaultClientLocale = "junk"
	if err := ValidateLocales(cfg); err != nil {
		if *cfg.LocalizationSettings.DefaultClientLocale != "en" {
			t.Fatal("DefaultClientLocale should have assigned to en as a default value")
		}
	} else {

		t.Fatal("Should have returned an error validating DefaultClientLocale")
	}

	*cfg.LocalizationSettings.DefaultClientLocale = ""
	if err := ValidateLocales(cfg); err != nil {
		if *cfg.LocalizationSettings.DefaultClientLocale != "en" {
			t.Fatal("DefaultClientLocale should have assigned to en as a default value")
		}
	} else {
		t.Fatal("Should have returned an error validating DefaultClientLocale")
	}

	*cfg.LocalizationSettings.AvailableLocales = "en"
	*cfg.LocalizationSettings.DefaultClientLocale = "de"
	if err := ValidateLocales(cfg); err != nil {
		if !strings.Contains(*cfg.LocalizationSettings.AvailableLocales, *cfg.LocalizationSettings.DefaultClientLocale) {
			t.Fatal("DefaultClientLocale should have added to AvailableLocales")
		}
	} else {
		t.Fatal("Should have returned an error validating DefaultClientLocale")
	}

	// validate AvailableLocales
	*cfg.LocalizationSettings.DefaultServerLocale = "en"
	*cfg.LocalizationSettings.DefaultClientLocale = "en"
	*cfg.LocalizationSettings.AvailableLocales = "junk"
	if err := ValidateLocales(cfg); err != nil {
		if *cfg.LocalizationSettings.AvailableLocales != "" {
			t.Fatal("AvailableLocales should have assigned to empty string as a default value")
		}
	} else {
		t.Fatal("Should have returned an error validating AvailableLocales")
	}

	*cfg.LocalizationSettings.AvailableLocales = "en,de,junk"
	if err := ValidateLocales(cfg); err != nil {
		if *cfg.LocalizationSettings.AvailableLocales != "" {
			t.Fatal("AvailableLocales should have assigned to empty string as a default value")
		}
	} else {
		t.Fatal("Should have returned an error validating AvailableLocales")
	}

	*cfg.LocalizationSettings.DefaultServerLocale = "fr"
	*cfg.LocalizationSettings.DefaultClientLocale = "de"
	*cfg.LocalizationSettings.AvailableLocales = "en"
	if err := ValidateLocales(cfg); err != nil {
		if strings.Contains(*cfg.LocalizationSettings.AvailableLocales, *cfg.LocalizationSettings.DefaultServerLocale) {
			t.Fatal("DefaultServerLocale should not be added to AvailableLocales")
		}
		if !strings.Contains(*cfg.LocalizationSettings.AvailableLocales, *cfg.LocalizationSettings.DefaultClientLocale) {
			t.Fatal("DefaultClientLocale should have added to AvailableLocales")
		}
	} else {
		t.Fatal("Should have returned an error validating AvailableLocales")
	}
}

func TestGetClientConfig(t *testing.T) {
	TranslationsPreInit()
	cfg, _, err := LoadConfig("config.json")
	require.Nil(t, err)

	configMap := GenerateClientConfig(cfg, "")
	if configMap["EmailNotificationContentsType"] != *cfg.EmailSettings.EmailNotificationContentsType {
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
