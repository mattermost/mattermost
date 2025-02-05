// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
)

func TestDesanitize(t *testing.T) {
	actual := &model.Config{}
	actual.SetDefaults()

	// These setting should be ignored
	actual.LdapSettings.Enable = model.NewPointer(false)
	actual.FileSettings.DriverName = model.NewPointer("s3")

	// These settings should be desanitized into target.
	actual.LdapSettings.BindPassword = model.NewPointer("bind_password")
	actual.FileSettings.PublicLinkSalt = model.NewPointer("public_link_salt")
	actual.FileSettings.AmazonS3SecretAccessKey = model.NewPointer("amazon_s3_secret_access_key")
	actual.EmailSettings.SMTPPassword = model.NewPointer("smtp_password")
	actual.GitLabSettings.Secret = model.NewPointer("secret")
	actual.OpenIdSettings.Secret = model.NewPointer("secret")
	actual.SqlSettings.DataSource = model.NewPointer("data_source")
	actual.SqlSettings.AtRestEncryptKey = model.NewPointer("at_rest_encrypt_key")
	actual.ElasticsearchSettings.Password = model.NewPointer("password")
	actual.SqlSettings.DataSourceReplicas = append(actual.SqlSettings.DataSourceReplicas, "replica0")
	actual.SqlSettings.DataSourceReplicas = append(actual.SqlSettings.DataSourceReplicas, "replica1")
	actual.SqlSettings.DataSourceSearchReplicas = append(actual.SqlSettings.DataSourceSearchReplicas, "search_replica0")
	actual.SqlSettings.DataSourceSearchReplicas = append(actual.SqlSettings.DataSourceSearchReplicas, "search_replica1")
	actual.PluginSettings.Plugins = map[string]map[string]any{
		"plugin1": {
			"secret":    "value1",
			"no_secret": "value2",
		},
	}

	target := &model.Config{}
	target.SetDefaults()

	// These setting should be ignored
	target.LdapSettings.Enable = model.NewPointer(true)
	target.FileSettings.DriverName = model.NewPointer("file")

	// These settings should be updated from actual
	target.LdapSettings.BindPassword = model.NewPointer(model.FakeSetting)
	target.FileSettings.PublicLinkSalt = model.NewPointer(model.FakeSetting)
	target.FileSettings.AmazonS3SecretAccessKey = model.NewPointer(model.FakeSetting)
	target.EmailSettings.SMTPPassword = model.NewPointer(model.FakeSetting)
	target.GitLabSettings.Secret = model.NewPointer(model.FakeSetting)
	target.OpenIdSettings.Secret = model.NewPointer(model.FakeSetting)
	target.SqlSettings.DataSource = model.NewPointer(model.FakeSetting)
	target.SqlSettings.AtRestEncryptKey = model.NewPointer(model.FakeSetting)
	target.ElasticsearchSettings.Password = model.NewPointer(model.FakeSetting)
	target.SqlSettings.DataSourceReplicas = []string{model.FakeSetting, model.FakeSetting}
	target.SqlSettings.DataSourceSearchReplicas = []string{model.FakeSetting, model.FakeSetting}
	target.PluginSettings.Plugins = map[string]map[string]any{
		"plugin1": {
			"secret":    model.FakeSetting,
			"no_secret": "value2",
		},
	}

	actualClone := actual.Clone()
	desanitize(actual, target)
	assert.Equal(t, actualClone, actual, "actual should not have been changed")

	// Verify the settings that should have been left untouched in target
	assert.True(t, *target.LdapSettings.Enable, "LdapSettings.Enable should not have changed")
	assert.Equal(t, "file", *target.FileSettings.DriverName, "FileSettings.DriverName should not have been changed")

	// Verify the settings that should have been desanitized into target
	assert.Equal(t, *actual.LdapSettings.BindPassword, *target.LdapSettings.BindPassword)
	assert.Equal(t, *actual.FileSettings.PublicLinkSalt, *target.FileSettings.PublicLinkSalt)
	assert.Equal(t, *actual.FileSettings.AmazonS3SecretAccessKey, *target.FileSettings.AmazonS3SecretAccessKey)
	assert.Equal(t, *actual.EmailSettings.SMTPPassword, *target.EmailSettings.SMTPPassword)
	assert.Equal(t, *actual.GitLabSettings.Secret, *target.GitLabSettings.Secret)
	assert.Equal(t, *actual.OpenIdSettings.Secret, *target.OpenIdSettings.Secret)
	assert.Equal(t, *actual.SqlSettings.DataSource, *target.SqlSettings.DataSource)
	assert.Equal(t, *actual.SqlSettings.AtRestEncryptKey, *target.SqlSettings.AtRestEncryptKey)
	assert.Equal(t, *actual.ElasticsearchSettings.Password, *target.ElasticsearchSettings.Password)
	assert.Equal(t, actual.SqlSettings.DataSourceReplicas, target.SqlSettings.DataSourceReplicas)
	assert.Equal(t, actual.SqlSettings.DataSourceSearchReplicas, target.SqlSettings.DataSourceSearchReplicas)
	assert.Equal(t, actual.ServiceSettings.SplitKey, target.ServiceSettings.SplitKey)
	assert.Equal(t, actual.PluginSettings.Plugins, target.PluginSettings.Plugins)
}

func TestFixInvalidLocales(t *testing.T) {
	// utils.TranslationsPreInit errors when TestFixInvalidLocales is run as part of testing the package,
	// but doesn't error when the test is run individually.
	_ = utils.TranslationsPreInit()

	cfg := &model.Config{}
	cfg.SetDefaults()

	*cfg.LocalizationSettings.DefaultServerLocale = "en"
	*cfg.LocalizationSettings.DefaultClientLocale = "en"
	*cfg.LocalizationSettings.AvailableLocales = ""

	changed := fixInvalidLocales(cfg)
	assert.False(t, changed)

	*cfg.LocalizationSettings.DefaultServerLocale = "junk"
	changed = fixInvalidLocales(cfg)
	assert.True(t, changed)
	assert.Equal(t, "en", *cfg.LocalizationSettings.DefaultServerLocale)

	*cfg.LocalizationSettings.DefaultServerLocale = ""
	changed = fixInvalidLocales(cfg)
	assert.True(t, changed)
	assert.Equal(t, "en", *cfg.LocalizationSettings.DefaultServerLocale)

	*cfg.LocalizationSettings.AvailableLocales = "en"
	*cfg.LocalizationSettings.DefaultServerLocale = "de"
	changed = fixInvalidLocales(cfg)
	assert.False(t, changed)
	assert.NotContains(t, *cfg.LocalizationSettings.AvailableLocales, *cfg.LocalizationSettings.DefaultServerLocale, "DefaultServerLocale should not be added to AvailableLocales")

	*cfg.LocalizationSettings.AvailableLocales = ""
	*cfg.LocalizationSettings.DefaultClientLocale = "junk"
	changed = fixInvalidLocales(cfg)
	assert.True(t, changed)
	assert.Equal(t, "en", *cfg.LocalizationSettings.DefaultClientLocale)

	*cfg.LocalizationSettings.DefaultClientLocale = ""
	changed = fixInvalidLocales(cfg)
	assert.True(t, changed)
	assert.Equal(t, "en", *cfg.LocalizationSettings.DefaultClientLocale)

	*cfg.LocalizationSettings.AvailableLocales = "en"
	*cfg.LocalizationSettings.DefaultClientLocale = "de"
	changed = fixInvalidLocales(cfg)
	assert.True(t, changed)
	assert.Contains(t, *cfg.LocalizationSettings.AvailableLocales, *cfg.LocalizationSettings.DefaultServerLocale, "DefaultClientLocale should have been added to AvailableLocales")

	// validate AvailableLocales
	*cfg.LocalizationSettings.DefaultServerLocale = "en"
	*cfg.LocalizationSettings.DefaultClientLocale = "en"
	*cfg.LocalizationSettings.AvailableLocales = "junk"
	changed = fixInvalidLocales(cfg)
	assert.True(t, changed)
	assert.Equal(t, "", *cfg.LocalizationSettings.AvailableLocales)

	*cfg.LocalizationSettings.AvailableLocales = "en,de,junk"
	changed = fixInvalidLocales(cfg)
	assert.True(t, changed)
	assert.Equal(t, "", *cfg.LocalizationSettings.AvailableLocales)

	*cfg.LocalizationSettings.DefaultServerLocale = "fr"
	*cfg.LocalizationSettings.DefaultClientLocale = "de"
	*cfg.LocalizationSettings.AvailableLocales = "en"
	changed = fixInvalidLocales(cfg)
	assert.True(t, changed)
	assert.NotContains(t, *cfg.LocalizationSettings.AvailableLocales, *cfg.LocalizationSettings.DefaultServerLocale, "DefaultServerLocale should not be added to AvailableLocales")
	assert.Contains(t, *cfg.LocalizationSettings.AvailableLocales, *cfg.LocalizationSettings.DefaultClientLocale, "DefaultClientLocale should have been added to AvailableLocales")
}

func TestIsDatabaseDSN(t *testing.T) {
	testCases := []struct {
		Name     string
		DSN      string
		Expected bool
	}{
		{
			Name:     "Mysql DSN",
			DSN:      "mysql://localhost",
			Expected: true,
		},
		{
			Name:     "Postgresql 'postgres' DSN",
			DSN:      "postgres://localhost",
			Expected: true,
		},
		{
			Name:     "Postgresql 'postgresql' DSN",
			DSN:      "postgresql://localhost",
			Expected: true,
		},
		{
			Name:     "Empty DSN",
			DSN:      "",
			Expected: false,
		},
		{
			Name:     "Default file DSN",
			DSN:      "config.json",
			Expected: false,
		},
		{
			Name:     "Relative path DSN",
			DSN:      "configuration/config.json",
			Expected: false,
		},
		{
			Name:     "Absolute path DSN",
			DSN:      "/opt/mattermost/configuration/config.json",
			Expected: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.Name, func(t *testing.T) {
			assert.Equal(t, tc.Expected, IsDatabaseDSN(tc.DSN))
		})
	}
}

func TestIsJSONMap(t *testing.T) {
	tests := []struct {
		name string
		data string
		want bool
	}{
		{name: "good json", data: `{"local_tcp": {
			"Type": "tcp","Format": "json","Levels": [
				{"ID": 5,"Name": "debug","Stacktrace": false}
			],
			"Options": {"ip": "localhost","port": 18065},
			"MaxQueueSize": 1000}}
			`, want: true,
		},
		{name: "empty json", data: "{}", want: true},
		{name: "string json", data: `"test"`, want: false},
		{name: "array json", data: `["test1", "test2"]`, want: false},
		{name: "bad json", data: `{huh?}`, want: false},
		{name: "filename", data: "/tmp/logger.conf", want: false},
		{name: "mysql dsn", data: "mysql://mmuser:@tcp(localhost:3306)/mattermost?charset=utf8mb4,utf8&readTimeout=30s", want: false},
		{name: "postgres dsn", data: "postgres://mmuser:passwordlocalhost:5432/mattermost?sslmode=disable&connect_timeout=10", want: false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := isJSONMap([]byte(tt.data)); got != tt.want {
				t.Errorf("isJSONMap() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestEqual(t *testing.T) {
	t.Run("nil", func(t *testing.T) {
		diff, err := equal(nil, nil)
		require.NoError(t, err)
		require.False(t, diff)
	})

	t.Run("no diff", func(t *testing.T) {
		old := minimalConfig.Clone()
		n := minimalConfig.Clone()
		diff, err := equal(old, n)
		require.NoError(t, err)
		require.False(t, diff)
	})

	t.Run("diff", func(t *testing.T) {
		old := minimalConfig.Clone()
		n := minimalConfig.Clone()
		n.SqlSettings = model.SqlSettings{}
		diff, err := equal(old, n)
		require.NoError(t, err)
		require.True(t, diff)
	})
}
