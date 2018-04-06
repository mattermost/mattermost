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

	"github.com/mattermost/mattermost-server/model"
)

func TestConfig(t *testing.T) {
	TranslationsPreInit()
	cfg, _, err := LoadConfig("config.json")
	require.Nil(t, err)
	InitTranslations(cfg.LocalizationSettings)
}

func TestTimezoneConfig(t *testing.T) {
	TranslationsPreInit()
	supportedTimezones := LoadTimezones("timezones.json")
	assert.Equal(t, len(supportedTimezones) > 0, true)

	supportedTimezones2 := LoadTimezones("timezones_file_does_not_exists.json")
	assert.Equal(t, len(supportedTimezones2) > 0, true)
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
	TranslationsPreInit()

	config := `{
		"ServiceSettings": {
			"EnableCommands": true,
			"ReadTimeout": 100
		},
		"TeamSettings": {
			"SiteName": "Mattermost",
			"CustomBrandText": ""
		}
	}`

	t.Run("string settings", func(t *testing.T) {
		os.Setenv("MM_TEAMSETTINGS_SITENAME", "From Environment")
		os.Setenv("MM_TEAMSETTINGS_CUSTOMBRANDTEXT", "Custom Brand")

		cfg, err := ReadConfig(strings.NewReader(config), true)
		require.Nil(t, err)

		if cfg.TeamSettings.SiteName != "From Environment" {
			t.Fatal("Couldn't read config from environment var")
		}

		if *cfg.TeamSettings.CustomBrandText != "Custom Brand" {
			t.Fatal("Couldn't read config from environment var")
		}

		os.Unsetenv("MM_TEAMSETTINGS_SITENAME")
		os.Unsetenv("MM_TEAMSETTINGS_CUSTOMBRANDTEXT")

		cfg, err = ReadConfig(strings.NewReader(config), true)
		require.Nil(t, err)

		if cfg.TeamSettings.SiteName != "Mattermost" {
			t.Fatal("should have been reset")
		}
	})

	t.Run("boolean setting", func(t *testing.T) {
		os.Setenv("MM_SERVICESETTINGS_ENABLECOMMANDS", "false")
		defer os.Unsetenv("MM_SERVICESETTINGS_ENABLECOMMANDS")

		cfg, err := ReadConfig(strings.NewReader(config), true)
		require.Nil(t, err)

		if *cfg.ServiceSettings.EnableCommands {
			t.Fatal("Couldn't read config from environment var")
		}
	})

	t.Run("integer setting", func(t *testing.T) {
		os.Setenv("MM_SERVICESETTINGS_READTIMEOUT", "400")
		defer os.Unsetenv("MM_SERVICESETTINGS_READTIMEOUT")

		cfg, err := ReadConfig(strings.NewReader(config), true)
		require.Nil(t, err)

		if *cfg.ServiceSettings.ReadTimeout != 400 {
			t.Fatal("Couldn't read config from environment var")
		}
	})

	t.Run("setting missing from config.json", func(t *testing.T) {
		os.Setenv("MM_SERVICESETTINGS_SITEURL", "https://example.com")
		defer os.Unsetenv("MM_SERVICESETTINGS_SITEURL")

		cfg, err := ReadConfig(strings.NewReader(config), true)
		require.Nil(t, err)

		if *cfg.ServiceSettings.SiteURL != "https://example.com" {
			t.Fatal("Couldn't read config from environment var")
		}
	})
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
	t.Parallel()
	testCases := []struct {
		description    string
		config         *model.Config
		diagnosticId   string
		license        *model.License
		expectedFields map[string]string
	}{
		{
			"unlicensed",
			&model.Config{
				EmailSettings: model.EmailSettings{
					EmailNotificationContentsType: sToP(model.EMAIL_NOTIFICATION_CONTENTS_FULL),
				},
				ThemeSettings: model.ThemeSettings{
					// Ignored, since not licensed.
					AllowCustomThemes: bToP(false),
				},
			},
			"",
			nil,
			map[string]string{
				"DiagnosticId":                  "",
				"EmailNotificationContentsType": "full",
				"AllowCustomThemes":             "true",
			},
		},
		{
			"licensed, but not for theme management",
			&model.Config{
				EmailSettings: model.EmailSettings{
					EmailNotificationContentsType: sToP(model.EMAIL_NOTIFICATION_CONTENTS_FULL),
				},
				ThemeSettings: model.ThemeSettings{
					// Ignored, since not licensed.
					AllowCustomThemes: bToP(false),
				},
			},
			"tag1",
			&model.License{
				Features: &model.Features{
					ThemeManagement: bToP(false),
				},
			},
			map[string]string{
				"DiagnosticId":                  "tag1",
				"EmailNotificationContentsType": "full",
				"AllowCustomThemes":             "true",
			},
		},
		{
			"licensed for theme management",
			&model.Config{
				EmailSettings: model.EmailSettings{
					EmailNotificationContentsType: sToP(model.EMAIL_NOTIFICATION_CONTENTS_FULL),
				},
				ThemeSettings: model.ThemeSettings{
					AllowCustomThemes: bToP(false),
				},
			},
			"tag2",
			&model.License{
				Features: &model.Features{
					ThemeManagement: bToP(true),
				},
			},
			map[string]string{
				"DiagnosticId":                  "tag2",
				"EmailNotificationContentsType": "full",
				"AllowCustomThemes":             "false",
			},
		},
	}

	for _, testCase := range testCases {
		testCase := testCase
		t.Run(testCase.description, func(t *testing.T) {
			t.Parallel()

			testCase.config.SetDefaults()
			if testCase.license != nil {
				testCase.license.Features.SetDefaults()
			}

			configMap := GenerateClientConfig(testCase.config, testCase.diagnosticId, testCase.license)
			for expectedField, expectedValue := range testCase.expectedFields {
				assert.Equal(t, expectedValue, configMap[expectedField])
			}
		})
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

func sToP(s string) *string {
	return &s
}

func bToP(b bool) *bool {
	return &b
}
