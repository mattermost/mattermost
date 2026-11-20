// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"encoding/json"
	"os"
	"regexp"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"

	"github.com/stretchr/testify/require"
)

func TestDefaultsGenerator(t *testing.T) {
	tmpFile, err := os.CreateTemp("", "tempconfig")
	defer os.Remove(tmpFile.Name())
	require.NoError(t, err)
	require.NoError(t, generateDefaultConfig(tmpFile))
	_ = tmpFile.Close()
	var config model.Config

	b, err := os.ReadFile(tmpFile.Name())
	require.NoError(t, err)
	require.NoError(t, json.Unmarshal(b, &config))
	require.Equal(t, *config.FileSettings.PublicLinkSalt, "")

	require.Equal(t, *config.Office365Settings.Scope, model.Office365SettingsDefaultScope)
	require.Equal(t, *config.Office365Settings.AuthEndpoint, model.Office365SettingsDefaultAuthEndpoint)
	require.Equal(t, *config.Office365Settings.UserAPIEndpoint, model.Office365SettingsDefaultUserAPIEndpoint)
	require.Equal(t, *config.Office365Settings.TokenEndpoint, model.Office365SettingsDefaultTokenEndpoint)

	require.Equal(t, *config.GoogleSettings.Scope, model.GoogleSettingsDefaultScope)
	require.Equal(t, *config.GoogleSettings.AuthEndpoint, model.GoogleSettingsDefaultAuthEndpoint)
	require.Equal(t, *config.GoogleSettings.UserAPIEndpoint, model.GoogleSettingsDefaultUserAPIEndpoint)
	require.Equal(t, *config.GoogleSettings.TokenEndpoint, model.GoogleSettingsDefaultTokenEndpoint)
}

// The package target in build/release.mk rewrites developer defaults with sed, so its
// patterns must keep matching the generated config when defaults change.
func TestReleasePackageResetsDeveloperSettings(t *testing.T) {
	releaseMk, err := os.ReadFile("../../build/release.mk")
	require.NoError(t, err)

	sedLine := regexp.MustCompile(`sed -i'' -e 's\|(.+)\|(.*)\|g' \$\(DIST_PATH\)/config/config\.json`)
	seds := sedLine.FindAllStringSubmatch(string(releaseMk), -1)
	require.NotEmpty(t, seds)

	tmpFile, err := os.CreateTemp("", "tempconfig")
	require.NoError(t, err)
	defer os.Remove(tmpFile.Name())
	require.NoError(t, generateDefaultConfig(tmpFile))
	require.NoError(t, tmpFile.Close())

	b, err := os.ReadFile(tmpFile.Name())
	require.NoError(t, err)

	for _, sed := range seds {
		b = regexp.MustCompile(sed[1]).ReplaceAllLiteral(b, []byte(sed[2]))
	}

	var config model.Config
	require.NoError(t, json.Unmarshal(b, &config))
	require.Equal(t, "INFO", *config.LogSettings.ConsoleLevel)
	require.Equal(t, "", *config.ServiceSettings.SiteURL)
	require.False(t, *config.EmailSettings.SendEmailNotifications)
	require.Equal(t, "", *config.EmailSettings.FeedbackEmail)
	require.Equal(t, "", *config.EmailSettings.ReplyToAddress)
	require.Equal(t, "", *config.EmailSettings.SMTPServer)
	require.Equal(t, "", *config.EmailSettings.SMTPPort)
}
