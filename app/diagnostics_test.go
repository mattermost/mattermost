// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
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

func TestDiagnostics(t *testing.T) {
	if testing.Short() {
		t.SkipNow()
	}

	th := Setup(t)
	defer th.TearDown()

	type payload struct {
		MessageId string
		SentAt    time.Time
		Batch     []struct {
			MessageId  string
			UserId     string
			Event      string
			Timestamp  time.Time
			Properties map[string]interface{}
		}
		Context struct {
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

	diagnosticID := "test-diagnostic-id-12345"
	th.App.SetDiagnosticId(diagnosticID)
	th.Server.initDiagnostics(server.URL)

	assertPayload := func(t *testing.T, actual payload, event string, properties map[string]interface{}) {
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

	// Should send a client identify message
	select {
	case identifyMessage := <-data:
		assertPayload(t, identifyMessage, "", nil)
	case <-time.After(time.Second * 1):
		require.Fail(t, "Did not receive ID message")
	}

	t.Run("Send", func(t *testing.T) {
		testValue := "test-send-value-6789"
		th.App.SendDiagnostic("Testing Diagnostic", map[string]interface{}{
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

	t.Run("SendDailyDiagnostics", func(t *testing.T) {
		th.App.sendDailyDiagnostics(true)

		var info []string
		// Collect the info sent.
	Loop:
		for {
			select {
			case result := <-data:
				assertPayload(t, result, "", nil)
				info = append(info, result.Batch[0].Event)
			case <-time.After(time.Second * 1):
				break Loop
			}
		}

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

	t.Run("SendDailyDiagnosticsNoSegmentKey", func(t *testing.T) {
		th.App.SendDailyDiagnostics()

		select {
		case <-data:
			require.Fail(t, "Should not send diagnostics when the segment key is not set")
		case <-time.After(time.Second * 1):
			// Did not receive diagnostics
		}
	})

	t.Run("SendDailyDiagnosticsDisabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.LogSettings.EnableDiagnostics = false })

		th.App.sendDailyDiagnostics(true)

		select {
		case <-data:
			require.Fail(t, "Should not send diagnostics when they are disabled")
		case <-time.After(time.Second * 1):
			// Did not receive diagnostics
		}
	})
}
