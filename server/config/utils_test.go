// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

import (
	"fmt"
	"reflect"
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
	actual.LdapSettings.Enable = new(false)
	actual.FileSettings.DriverName = new("s3")

	// These settings should be desanitized into target.
	actual.LdapSettings.BindPassword = new("bind_password")
	actual.FileSettings.PublicLinkSalt = new("public_link_salt")
	actual.FileSettings.AmazonS3SecretAccessKey = new("amazon_s3_secret_access_key")
	actual.FileSettings.ExportAmazonS3SecretAccessKey = new("export_amazon_s3_secret_access_key")
	actual.FileSettings.AzureAccessKey = new("azure_access_key")
	actual.FileSettings.ExportAzureAccessKey = new("export_azure_access_key")
	actual.EmailSettings.SMTPPassword = new("smtp_password")
	actual.GitLabSettings.Secret = new("secret")
	actual.OpenIdSettings.Secret = new("secret")
	actual.SqlSettings.DataSource = new("data_source")
	actual.SqlSettings.AtRestEncryptKey = new("at_rest_encrypt_key")
	actual.ElasticsearchSettings.Password = new("password")
	actual.ServiceSettings.GoogleDeveloperKey = new("google_developer_key")
	actual.ServiceSettings.GiphySdkKey = new("giphy_sdk_key")
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
	target.LdapSettings.Enable = new(true)
	target.FileSettings.DriverName = new("file")

	// These settings should be updated from actual
	target.LdapSettings.BindPassword = model.NewPointer(model.FakeSetting)
	target.FileSettings.PublicLinkSalt = model.NewPointer(model.FakeSetting)
	target.FileSettings.AmazonS3SecretAccessKey = model.NewPointer(model.FakeSetting)
	target.FileSettings.ExportAmazonS3SecretAccessKey = model.NewPointer(model.FakeSetting)
	target.FileSettings.AzureAccessKey = model.NewPointer(model.FakeSetting)
	target.FileSettings.ExportAzureAccessKey = model.NewPointer(model.FakeSetting)
	target.EmailSettings.SMTPPassword = model.NewPointer(model.FakeSetting)
	target.GitLabSettings.Secret = model.NewPointer(model.FakeSetting)
	target.OpenIdSettings.Secret = model.NewPointer(model.FakeSetting)
	target.SqlSettings.DataSource = model.NewPointer(model.FakeSetting)
	target.SqlSettings.AtRestEncryptKey = model.NewPointer(model.FakeSetting)
	target.ElasticsearchSettings.Password = model.NewPointer(model.FakeSetting)
	target.ServiceSettings.GoogleDeveloperKey = model.NewPointer(model.FakeSetting)
	target.ServiceSettings.GiphySdkKey = model.NewPointer(model.FakeSetting)
	target.SqlSettings.DataSourceReplicas = []string{model.FakeSetting, model.FakeSetting}
	target.SqlSettings.DataSourceSearchReplicas = []string{model.FakeSetting, model.FakeSetting}
	target.PluginSettings.Plugins = map[string]map[string]any{
		"plugin1": {
			"secret":    model.FakeSetting,
			"no_secret": "value2",
		},
	}

	actualClone := actual.Clone()
	Desanitize(actual, target)
	assert.Equal(t, actualClone, actual, "actual should not have been changed")

	// Verify the settings that should have been left untouched in target
	assert.True(t, *target.LdapSettings.Enable, "LdapSettings.Enable should not have changed")
	assert.Equal(t, "file", *target.FileSettings.DriverName, "FileSettings.DriverName should not have been changed")

	// Verify the settings that should have been desanitized into target
	assert.Equal(t, *actual.LdapSettings.BindPassword, *target.LdapSettings.BindPassword)
	assert.Equal(t, *actual.FileSettings.PublicLinkSalt, *target.FileSettings.PublicLinkSalt)
	assert.Equal(t, *actual.FileSettings.AmazonS3SecretAccessKey, *target.FileSettings.AmazonS3SecretAccessKey)
	assert.Equal(t, *actual.FileSettings.ExportAmazonS3SecretAccessKey, *target.FileSettings.ExportAmazonS3SecretAccessKey)
	assert.Equal(t, *actual.FileSettings.AzureAccessKey, *target.FileSettings.AzureAccessKey)
	assert.Equal(t, *actual.FileSettings.ExportAzureAccessKey, *target.FileSettings.ExportAzureAccessKey)
	assert.Equal(t, *actual.EmailSettings.SMTPPassword, *target.EmailSettings.SMTPPassword)
	assert.Equal(t, *actual.GitLabSettings.Secret, *target.GitLabSettings.Secret)
	assert.Equal(t, *actual.OpenIdSettings.Secret, *target.OpenIdSettings.Secret)
	assert.Equal(t, *actual.SqlSettings.DataSource, *target.SqlSettings.DataSource)
	assert.Equal(t, *actual.SqlSettings.AtRestEncryptKey, *target.SqlSettings.AtRestEncryptKey)
	assert.Equal(t, *actual.ElasticsearchSettings.Password, *target.ElasticsearchSettings.Password)
	assert.Equal(t, *actual.ServiceSettings.GoogleDeveloperKey, *target.ServiceSettings.GoogleDeveloperKey)
	assert.Equal(t, *actual.ServiceSettings.GiphySdkKey, *target.ServiceSettings.GiphySdkKey)
	assert.Equal(t, actual.SqlSettings.DataSourceReplicas, target.SqlSettings.DataSourceReplicas)
	assert.Equal(t, actual.SqlSettings.DataSourceSearchReplicas, target.SqlSettings.DataSourceSearchReplicas)
	assert.Equal(t, actual.ServiceSettings.SplitKey, target.ServiceSettings.SplitKey)
	assert.Equal(t, actual.PluginSettings.Plugins, target.PluginSettings.Plugins)
}

// TestDesanitizeRemovesAllFakeSettings verifies that every field masked by
// Sanitize has a corresponding entry in desanitize, so FakeSetting is never
// written back to stored config. No manual field listing is required: all
// string fields are pre-populated via reflection so Sanitize will mask any
// secret regardless of its default value.
func TestDesanitizeRemovesAllFakeSettings(t *testing.T) {
	actual := &model.Config{}
	actual.SetDefaults()
	populateStrings(reflect.ValueOf(actual), "test-value")

	sanitized := actual.Clone()
	sanitized.Sanitize(nil, nil)

	Desanitize(actual, sanitized)

	assertNoFakeSettings(t, reflect.ValueOf(*sanitized), "Config")
}

// populateStrings sets every empty string reachable from v to value so that
// Sanitize will replace it if it is a secret field.
func populateStrings(v reflect.Value, value string) {
	switch v.Kind() {
	case reflect.Pointer:
		if v.IsNil() && v.CanSet() {
			v.Set(reflect.New(v.Type().Elem()))
		}
		if !v.IsNil() {
			if v.Elem().Kind() == reflect.String {
				if v.Elem().String() == "" {
					v.Elem().SetString(value)
				}
			} else {
				populateStrings(v.Elem(), value)
			}
		}
	case reflect.Struct:
		for _, sf := range reflect.VisibleFields(v.Type()) {
			field := v.FieldByIndex(sf.Index)
			if field.CanSet() {
				populateStrings(field, value)
			}
		}
	case reflect.Slice:
		for i := range v.Len() {
			populateStrings(v.Index(i), value)
		}
	}
}

// assertNoFakeSettings walks v recursively and fails if any string field equals
// model.FakeSetting, reporting the dotted path of the offending field.
func assertNoFakeSettings(t *testing.T, v reflect.Value, path string) {
	t.Helper()
	switch v.Kind() {
	case reflect.Pointer:
		if !v.IsNil() {
			assertNoFakeSettings(t, v.Elem(), path)
		}
	case reflect.Struct:
		for i := range v.NumField() {
			assertNoFakeSettings(t, v.Field(i), path+"."+v.Type().Field(i).Name)
		}
	case reflect.String:
		assert.NotEqual(t, model.FakeSetting, v.String(), "FakeSetting persisted at %s after desanitize", path)
	case reflect.Slice:
		for i := range v.Len() {
			assertNoFakeSettings(t, v.Index(i), fmt.Sprintf("%s[%d]", path, i))
		}
	case reflect.Map:
		for _, key := range v.MapKeys() {
			elem := v.MapIndex(key)
			if elem.Kind() == reflect.Interface {
				elem = elem.Elem()
			}
			assertNoFakeSettings(t, elem, fmt.Sprintf("%s[%v]", path, key))
		}
	case reflect.Interface:
		if !v.IsNil() {
			assertNoFakeSettings(t, v.Elem(), path)
		}
	}
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
