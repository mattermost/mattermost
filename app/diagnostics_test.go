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

	"github.com/mattermost/platform/utils"
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
	before := utils.Cfg.PluginSettings.Plugins
	utils.Cfg.PluginSettings.Plugins = map[string]interface{}{
		"test": map[string]string{
			"foo": "bar",
		},
	}
	defer func() {
		utils.Cfg.PluginSettings.Plugins = before
	}()
	if pluginSetting("test", "foo", "asd") != "bar" {
		t.Fatal()
	}
	if pluginSetting("test", "qwe", "asd") != "asd" {
		t.Fatal()
	}
}

func TestDiagnostics(t *testing.T) {
	Setup().InitBasic()

	if testing.Short() {
		t.SkipNow()
	}

	data, server := newTestServer()
	defer server.Close()

	oldId := utils.CfgDiagnosticId
	utils.CfgDiagnosticId = "i am not real"
	defer func() {
		utils.CfgDiagnosticId = oldId
	}()
	initDiagnostics(server.URL)

	// Should send a client identify message
	select {
	case identifyMessage := <-data:
		t.Log("Got idmessage:\n" + identifyMessage)
		if !strings.Contains(identifyMessage, utils.CfgDiagnosticId) {
			t.Fail()
		}
	case <-time.After(time.Second * 1):
		t.Fatal("Did not recieve ID message")
	}

	t.Run("Send", func(t *testing.T) {
		const TEST_VALUE = "stuff548959847"
		SendDiagnostic("Testing Diagnostic", map[string]interface{}{
			"hey": TEST_VALUE,
		})
		select {
		case result := <-data:
			t.Log("Got diagnostic:\n" + result)
			if !strings.Contains(result, TEST_VALUE) {
				t.Fail()
			}
		case <-time.After(time.Second * 1):
			t.Fatal("Did not recieve diagnostic")
		}
	})

	t.Run("SendDailyDiagnostics", func(t *testing.T) {
		SendDailyDiagnostics()

		info := ""
		// Collect the info sent.
		for {
			done := false
			select {
			case result := <-data:
				info += result
			case <-time.After(time.Second * 1):
				// Done recieving
				done = true
				break
			}

			if done {
				break
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
		} {
			if !strings.Contains(info, item) {
				t.Fatal("Sent diagnostics missing item: " + item)
			}
		}
	})

	t.Run("SendDailyDiagnosticsDisabled", func(t *testing.T) {
		oldSetting := *utils.Cfg.LogSettings.EnableDiagnostics
		*utils.Cfg.LogSettings.EnableDiagnostics = false
		defer func() {
			*utils.Cfg.LogSettings.EnableDiagnostics = oldSetting
		}()

		SendDailyDiagnostics()

		select {
		case <-data:
			t.Fatal("Should not send diagnostics when they are disabled")
		case <-time.After(time.Second * 1):
			// Did not recieve diagnostics
		}
	})
}
