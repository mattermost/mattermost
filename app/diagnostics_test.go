// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/model"
)

func newTestServer() (chan string, *httptest.Server) {
	result := make(chan string, 100)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		buf := bytes.NewBuffer(nil)
		io.Copy(buf, r.Body)

		result <- buf.String()
	}))

	return result, server
}

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
	th := Setup().InitBasic()
	defer th.TearDown()

	if testing.Short() {
		t.SkipNow()
	}

	data, server := newTestServer()
	defer server.Close()

	diagnosticId := "i am not real"
	th.App.SetDiagnosticId(diagnosticId)
	th.App.initDiagnostics(server.URL)

	// Should send a client identify message
	select {
	case identifyMessage := <-data:
		t.Log("Got idmessage:\n" + identifyMessage)
		if !strings.Contains(identifyMessage, diagnosticId) {
			t.Fail()
		}
	case <-time.After(time.Second * 1):
		t.Fatal("Did not receive ID message")
	}

	t.Run("Send", func(t *testing.T) {
		const TEST_VALUE = "stuff548959847"
		th.App.SendDiagnostic("Testing Diagnostic", map[string]interface{}{
			"hey": TEST_VALUE,
		})
		select {
		case result := <-data:
			t.Log("Got diagnostic:\n" + result)
			if !strings.Contains(result, TEST_VALUE) {
				t.Fail()
			}
		case <-time.After(time.Second * 1):
			t.Fatal("Did not receive diagnostic")
		}
	})

	t.Run("SendDailyDiagnostics", func(t *testing.T) {
		th.App.SendDailyDiagnostics()

		info := ""
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
			TRACK_CONFIG_WEBRTC,
			TRACK_CONFIG_SUPPORT,
			TRACK_CONFIG_NATIVEAPP,
			TRACK_CONFIG_ANALYTICS,
			TRACK_CONFIG_PLUGIN,
			TRACK_ACTIVITY,
			TRACK_SERVER,
			TRACK_CONFIG_MESSAGE_EXPORT,
			TRACK_PLUGINS,
		} {
			if !strings.Contains(info, item) {
				t.Fatal("Sent diagnostics missing item: " + item)
			}
		}
	})

	t.Run("SendDailyDiagnosticsDisabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.LogSettings.EnableDiagnostics = false })

		th.App.SendDailyDiagnostics()

		select {
		case <-data:
			t.Fatal("Should not send diagnostics when they are disabled")
		case <-time.After(time.Second * 1):
			// Did not receive diagnostics
		}
	})
}
