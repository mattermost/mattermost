// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/model"
)

func TestPluginSetting(t *testing.T) {
	settings := &model.PluginSettings{
		Plugins: map[string]map[string]interface{}{
			"test": map[string]interface{}{
				"foo": "bar",
			},
		},
	}
	assert.Equal(t, "bar", pluginSetting(settings, "test", "foo", "asd"))
	assert.Equal(t, "asd", pluginSetting(settings, "test", "qwe", "asd"))
}

func TestPluginActivated(t *testing.T) {
	states := map[string]*model.PluginState{
		"foo": &model.PluginState{
			Enable: true,
		},
		"bar": &model.PluginState{
			Enable: false,
		},
	}
	assert.True(t, pluginActivated(states, "foo"))
	assert.False(t, pluginActivated(states, "bar"))
	assert.False(t, pluginActivated(states, "none"))
}

func TestDiagnostics(t *testing.T) {
	if testing.Short() {
		t.SkipNow()
	}

	th := Setup(t).InitBasic()
	defer th.TearDown()

	data := make(chan string, 100)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := ioutil.ReadAll(r.Body)
		require.NoError(t, err)

		data <- string(body)
	}))
	defer server.Close()

	diagnosticID := "test-diagnostic-id-12345"
	th.App.SetDiagnosticId(diagnosticID)
	th.Server.initDiagnostics(server.URL)

	// Should send a client identify message
	select {
	case identifyMessage := <-data:
		require.Contains(t, identifyMessage, diagnosticID)
	case <-time.After(time.Second * 1):
		t.Fatal("Did not receive ID message")
	}

	t.Run("Send", func(t *testing.T) {
		testValue := "test-send-value-6789"
		th.App.SendDiagnostic("Testing Diagnostic", map[string]interface{}{
			"hey": testValue,
		})
		select {
		case result := <-data:
			require.Contains(t, result, testValue)
		case <-time.After(time.Second * 1):
			t.Fatal("Did not receive diagnostic")
		}
	})

	t.Run("SendDailyDiagnostics", func(t *testing.T) {
		th.App.sendDailyDiagnostics(true)

		var info string
		// Collect the info sent.
	Loop:
		for {
			select {
			case result := <-data:
				info += result
			case <-time.After(time.Second * 1):
				break Loop
			}
		}

		for _, item := range []string{
			TRACK_CONFIG_SERVICE,
			TRACK_CONFIG_TEAM,
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
			t.Fatal("Should not send diagnostics when the segment key is not set")
		case <-time.After(time.Second * 1):
			// Did not receive diagnostics
		}
	})

	t.Run("SendDailyDiagnosticsDisabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.LogSettings.EnableDiagnostics = false })

		th.App.sendDailyDiagnostics(true)

		select {
		case <-data:
			t.Fatal("Should not send diagnostics when they are disabled")
		case <-time.After(time.Second * 1):
			// Did not receive diagnostics
		}
	})
}
