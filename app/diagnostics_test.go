// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/model"
)

func TestPluginSetting(t *testing.T) {
	settings := &model.PluginSettings{
		Plugins: map[string]map[string]interface{}{
			"test": {
				"foo": "bar",
			},
		},
	}
	assert.Equal(t, "bar", pluginSetting(settings, "test", "foo", "asd"))
	assert.Equal(t, "asd", pluginSetting(settings, "test", "qwe", "asd"))
}

func TestPluginActivated(t *testing.T) {
	states := map[string]*model.PluginState{
		"foo": {
			Enable: true,
		},
		"bar": {
			Enable: false,
		},
	}
	assert.True(t, pluginActivated(states, "foo"))
	assert.False(t, pluginActivated(states, "bar"))
	assert.False(t, pluginActivated(states, "none"))
}

func TestPluginVersion(t *testing.T) {
	plugins := []*model.BundleInfo{
		{
			Manifest: &model.Manifest{
				Id:      "test.plugin",
				Version: "1.2.3",
			},
		},
		{
			Manifest: &model.Manifest{
				Id:      "test.plugin2",
				Version: "4.5.6",
			},
		},
	}
	assert.Equal(t, "1.2.3", pluginVersion(plugins, "test.plugin"))
	assert.Equal(t, "4.5.6", pluginVersion(plugins, "test.plugin2"))
	assert.Empty(t, pluginVersion(plugins, "unknown.plugin"))
}

func TestRudderDiagnostics(t *testing.T) {
	if testing.Short() {
		t.SkipNow()
	}

	th := SetupWithCustomConfig(t, func(config *model.Config) {
		*config.PluginSettings.Enable = false
	})
	defer th.TearDown()

	type batch struct {
		MessageId  string
		UserId     string
		Event      string
		Timestamp  time.Time
		Properties map[string]interface{}
	}

	type payload struct {
		MessageId string
		SentAt    time.Time
		Batch     []batch
		Context   struct {
			Library struct {
				Name    string
				Version string
			}
		}
	}

	data := make(chan payload, 100)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := ioutil.ReadAll(r.Body)
		require.NoError(t, err)

		var p payload
		err = json.Unmarshal(body, &p)
		require.NoError(t, err)

		data <- p
	}))
	defer server.Close()

	marketplaceServer := httptest.NewServer(http.HandlerFunc(func(res http.ResponseWriter, req *http.Request) {
		res.WriteHeader(http.StatusOK)
		json, err := json.Marshal([]*model.MarketplacePlugin{{
			BaseMarketplacePlugin: &model.BaseMarketplacePlugin{
				Manifest: &model.Manifest{
					Id: "testplugin",
				},
			},
		}})
		require.NoError(t, err)
		res.Write(json)
	}))

	defer func() { marketplaceServer.Close() }()

	diagnosticID := "test-diagnostic-id-12345"
	th.App.SetDiagnosticId(diagnosticID)
	th.Server.initDiagnostics(server.URL, RUDDER_KEY)

	assertPayload := func(t *testing.T, actual payload, event string, properties map[string]interface{}) {
		t.Helper()
		assert.NotEmpty(t, actual.MessageId)
		assert.False(t, actual.SentAt.IsZero())
		if assert.Len(t, actual.Batch, 1) {
			assert.NotEmpty(t, actual.Batch[0].MessageId, "message id should not be empty")
			assert.Equal(t, diagnosticID, actual.Batch[0].UserId)
			if event != "" {
				assert.Equal(t, event, actual.Batch[0].Event)
			}
			assert.False(t, actual.Batch[0].Timestamp.IsZero(), "batch timestamp should not be the zero value")
			if properties != nil {
				assert.Equal(t, properties, actual.Batch[0].Properties)
			}
		}
		assert.Equal(t, "analytics-go", actual.Context.Library.Name)
		assert.Equal(t, "3.0.0", actual.Context.Library.Version)
	}

	collectInfo := func(info *[]string) {
		t.Helper()
		for {
			select {
			case result := <-data:
				assertPayload(t, result, "", nil)
				*info = append(*info, result.Batch[0].Event)
			case <-time.After(time.Second * 1):
				return
			}
		}
	}

	collectBatches := func(info *[]batch) {
		t.Helper()
		for {
			select {
			case result := <-data:
				assertPayload(t, result, "", nil)
				*info = append(*info, result.Batch[0])
			case <-time.After(time.Second * 1):
				return
			}
		}
	}

	// Should send a client identify message
	select {
	case identifyMessage := <-data:
		assertPayload(t, identifyMessage, "", nil)
	case <-time.After(time.Second * 1):
		require.Fail(t, "Did not receive ID message")
	}

	t.Run("Send", func(t *testing.T) {
		testValue := "test-send-value-6789"
		th.App.Srv().SendDiagnostic("Testing Diagnostic", map[string]interface{}{
			"hey": testValue,
		})
		select {
		case result := <-data:
			assertPayload(t, result, "Testing Diagnostic", map[string]interface{}{
				"hey": testValue,
			})
		case <-time.After(time.Second * 1):
			require.Fail(t, "Did not receive diagnostic")
		}
	})

	// Plugins remain disabled at this point
	t.Run("SendDailyDiagnosticsPluginsDisabled", func(t *testing.T) {
		th.App.Srv().sendDailyDiagnostics(true)

		var info []string
		// Collect the info sent.
		collectInfo(&info)

		for _, item := range []string{
			TRACK_CONFIG_SERVICE,
			TRACK_CONFIG_TEAM,
			TRACK_CONFIG_SQL,
			TRACK_CONFIG_LOG,
			TRACK_CONFIG_NOTIFICATION_LOG,
			TRACK_CONFIG_FILE,
			TRACK_CONFIG_RATE,
			TRACK_CONFIG_EMAIL,
			TRACK_CONFIG_PRIVACY,
			TRACK_CONFIG_OAUTH,
			TRACK_CONFIG_LDAP,
			TRACK_CONFIG_COMPLIANCE,
			TRACK_CONFIG_LOCALIZATION,
			TRACK_CONFIG_SAML,
			TRACK_CONFIG_PASSWORD,
			TRACK_CONFIG_CLUSTER,
			TRACK_CONFIG_METRICS,
			TRACK_CONFIG_SUPPORT,
			TRACK_CONFIG_NATIVEAPP,
			TRACK_CONFIG_EXPERIMENTAL,
			TRACK_CONFIG_ANALYTICS,
			TRACK_CONFIG_PLUGIN,
			TRACK_ACTIVITY,
			TRACK_SERVER,
			TRACK_CONFIG_MESSAGE_EXPORT,
			// TRACK_PLUGINS,
		} {
			require.Contains(t, info, item)
		}
	})

	// Enable plugins for the remainder of the tests.
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.PluginSettings.Enable = true })

	t.Run("SendDailyDiagnostics", func(t *testing.T) {
		th.App.Srv().sendDailyDiagnostics(true)

		var info []string
		// Collect the info sent.
		collectInfo(&info)

		for _, item := range []string{
			TRACK_CONFIG_SERVICE,
			TRACK_CONFIG_TEAM,
			TRACK_CONFIG_SQL,
			TRACK_CONFIG_LOG,
			TRACK_CONFIG_NOTIFICATION_LOG,
			TRACK_CONFIG_FILE,
			TRACK_CONFIG_RATE,
			TRACK_CONFIG_EMAIL,
			TRACK_CONFIG_PRIVACY,
			TRACK_CONFIG_OAUTH,
			TRACK_CONFIG_LDAP,
			TRACK_CONFIG_COMPLIANCE,
			TRACK_CONFIG_LOCALIZATION,
			TRACK_CONFIG_SAML,
			TRACK_CONFIG_PASSWORD,
			TRACK_CONFIG_CLUSTER,
			TRACK_CONFIG_METRICS,
			TRACK_CONFIG_SUPPORT,
			TRACK_CONFIG_NATIVEAPP,
			TRACK_CONFIG_EXPERIMENTAL,
			TRACK_CONFIG_ANALYTICS,
			TRACK_CONFIG_PLUGIN,
			TRACK_ACTIVITY,
			TRACK_SERVER,
			TRACK_CONFIG_MESSAGE_EXPORT,
			TRACK_PLUGINS,
		} {
			require.Contains(t, info, item)
		}
	})

	t.Run("Diagnostics for Marketplace plugins is returned", func(t *testing.T) {
		th.App.Srv().trackPluginConfig(th.App.Srv().Config(), marketplaceServer.URL)

		var batches []batch
		collectBatches(&batches)

		for _, b := range batches {
			if b.Event == TRACK_CONFIG_PLUGIN {
				assert.Contains(t, b.Properties, "enable_testplugin")
				assert.Contains(t, b.Properties, "version_testplugin")

				// Confirm known plugins are not present
				assert.NotContains(t, b.Properties, "enable_jira")
				assert.NotContains(t, b.Properties, "version_jira")
			}
		}
	})

	t.Run("Diagnostics for known plugins is returned, if request to Marketplace fails", func(t *testing.T) {
		th.App.Srv().trackPluginConfig(th.App.Srv().Config(), "http://some.random.invalid.url")

		var batches []batch
		collectBatches(&batches)

		for _, b := range batches {
			if b.Event == TRACK_CONFIG_PLUGIN {
				assert.NotContains(t, b.Properties, "enable_testplugin")
				assert.NotContains(t, b.Properties, "version_testplugin")

				// Confirm known plugins are present
				assert.Contains(t, b.Properties, "enable_jira")
				assert.Contains(t, b.Properties, "version_jira")
			}
		}
	})

	t.Run("SendDailyDiagnosticsNoRudderKey", func(t *testing.T) {
		th.App.Srv().SendDailyDiagnostics()

		select {
		case <-data:
			require.Fail(t, "Should not send diagnostics when the rudder key is not set")
		case <-time.After(time.Second * 1):
			// Did not receive diagnostics
		}
	})

	t.Run("SendDailyDiagnosticsDisabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.LogSettings.EnableDiagnostics = false })

		th.App.Srv().sendDailyDiagnostics(true)

		select {
		case <-data:
			require.Fail(t, "Should not send diagnostics when they are disabled")
		case <-time.After(time.Second * 1):
			// Did not receive diagnostics
		}
	})

	t.Run("RudderConfigUsesConfigForValues", func(t *testing.T) {
		os.Setenv("RUDDER_KEY", "abc123")
		os.Setenv("RUDDER_DATAPLANE_URL", "arudderstackplace")
		defer os.Unsetenv("RUDDER_KEY")
		defer os.Unsetenv("RUDDER_DATAPLANE_URL")

		config := th.App.Srv().getRudderConfig()

		assert.Equal(t, "arudderstackplace", config.DataplaneUrl)
		assert.Equal(t, "abc123", config.RudderKey)
	})
}
