// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-plugin-apps/apps"

	"github.com/mattermost/mattermost-server/v6/model"
)

func TestGetEnabledIntegrationsForFreemiumLimits(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	samplePluginCode := `
	package main

	import (
		"github.com/mattermost/mattermost-server/v6/plugin"
	)

	type MyPlugin struct {
		plugin.MattermostPlugin
	}

	func main() {
		plugin.ClientMain(&MyPlugin{})
	}
	`

	listedApps := []apps.ListedApp{
		{
			Manifest: apps.Manifest{
				AppID:       "zendesk",
				DisplayName: "Zendesk",
				Version:     "1.1.0",
			},
			Enabled: true,
		},
		{
			Manifest: apps.Manifest{
				AppID:       "mattermost-autolink",
				DisplayName: "Autolink",
				Version:     "1.2.0",
			},
			Enabled: true,
		},
		{
			Manifest: apps.Manifest{
				AppID:       "disabled-app",
				DisplayName: "Disabled App",
				Version:     "1.1.0",
			},
			Enabled: false,
		},
	}

	listedAppsBytes, err := json.Marshal(listedApps)
	require.NoError(t, err)

	appsResponse := fmt.Sprintf("`%s`", string(listedAppsBytes))

	appsPluginCode := `
		package main

		import (
			"net/http"

			"github.com/mattermost/mattermost-server/v6/plugin"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) 	ServeHTTP(c *plugin.Context, w http.ResponseWriter, r *http.Request) {
			response := ` + appsResponse + `
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(response))
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
	`

	setupMultiPluginAPITest(t,
		[]string{samplePluginCode, samplePluginCode, samplePluginCode, samplePluginCode, samplePluginCode, appsPluginCode}, []string{
			`{"id": "otherplugin", "name": "Other Plugin", "version": "1.2.0", "server": {"executable": "backend.exe"}}`,
			`{"id": "mattermost-autolink", "name": "Autolink", "version": "1.2.0", "server": {"executable": "backend.exe"}}`,
			`{"id": "playbooks", "name": "Playbooks", "version": "1.2.0", "server": {"executable": "backend.exe"}}`,
			`{"id": "focalboard", "name": "Mattermost Boards", "version": "1.2.0", "server": {"executable": "backend.exe"}}`,
			`{"id": "com.mattermost.nps", "name": "User Satisfaction Surveys", "version": "1.2.0", "server": {"executable": "backend.exe"}}`,
			`{"id": "com.mattermost.apps", "server": {"executable": "backend.exe"}}`,
		}, []string{"otherplugin", "mattermost-autolink", "com.mattermost.nps", "playbooks", "focalboard", "com.mattermost.apps"},
		true, th.App, th.Context)

	hooks, err2 := th.App.GetPluginsEnvironment().HooksForPlugin("com.mattermost.apps")
	require.NoError(t, err2)
	require.NotNil(t, hooks)

	t.Run("valid relative URL", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.AllowedUntrustedInternalConnections = ""
			*cfg.ServiceSettings.SiteURL = ""
		})

		integrations, appErr := th.App.GetEnabledIntegrationsForFreemiumLimits(th.Context)
		require.Nil(t, appErr)

		expected := []*InstalledIntegration{
			{
				Type:    "plugin",
				ID:      "otherplugin",
				Name:    "Other Plugin",
				Version: "1.2.0",
			},
			{
				Type:    "plugin-app",
				ID:      "mattermost-autolink",
				Name:    "Autolink",
				Version: "1.2.0",
			},
			{
				Type:    "app",
				ID:      "zendesk",
				Name:    "Zendesk",
				Version: "1.1.0",
			},
		}
		require.Equal(t, expected, integrations)
	})
}
