// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"testing"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/stretchr/testify/require"
)

func TestGetIntegrationsUsage(t *testing.T) {
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

	listedApps := `[
		{
			"manifest": {
				"app_id":       "zendesk",
				"display_name": "Zendesk",
				"version":     "1.1.0"
			},
			"installed": true,
			"enabled": true
		},
		{
			"manifest": {
				"app_id":       "disabled-app",
				"display_name": "Disabled App",
				"version":     "1.1.0"
			},
			"installed": true,
			"enabled": false
		},
		{
			"manifest": {
				"app_id":       "not-installed-app",
				"display_name": "Not Installed App",
				"version":     "1.1.0"
			},
			"installed": false,
			"enabled": false
		}
	]`

	appsResponse := fmt.Sprintf("`%s`", listedApps)

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
		[]string{samplePluginCode, samplePluginCode, samplePluginCode, samplePluginCode, samplePluginCode, samplePluginCode, appsPluginCode}, []string{
			`{"id": "otherplugin", "name": "Other Plugin", "version": "1.2.0", "server": {"executable": "backend.exe"}}`,
			`{"id": "mattermost-autolink", "name": "Autolink", "version": "1.2.0", "server": {"executable": "backend.exe"}}`,
			`{"id": "playbooks", "name": "Playbooks", "version": "1.2.0", "server": {"executable": "backend.exe"}}`,
			`{"id": "focalboard", "name": "Mattermost Boards", "version": "1.2.0", "server": {"executable": "backend.exe"}}`,
			`{"id": "com.mattermost.calls", "name": "Calls", "version": "1.2.0", "server": {"executable": "backend.exe"}}`,
			`{"id": "com.mattermost.nps", "name": "User Satisfaction Surveys", "version": "1.2.0", "server": {"executable": "backend.exe"}}`,
			`{"id": "com.mattermost.apps", "server": {"executable": "backend.exe"}}`,
		}, []string{"otherplugin", "mattermost-autolink", "playbooks", "focalboard", "com.mattermost.calls", "com.mattermost.nps", "com.mattermost.apps"},
		true, th.App, th.Context)

	hooks, err2 := th.App.GetPluginsEnvironment().HooksForPlugin("com.mattermost.apps")
	require.NoError(t, err2)
	require.NotNil(t, hooks)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = ""
		*cfg.ServiceSettings.SiteURL = ""
	})

	integrations, appErr := th.App.ch.getInstalledIntegrations()
	require.Nil(t, appErr)

	expected := []*model.InstalledIntegration{
		{
			Type:    "plugin",
			ID:      "mattermost-autolink",
			Name:    "Autolink",
			Version: "1.2.0",
			Enabled: true,
		},
		{
			Type:    "app",
			ID:      "disabled-app",
			Name:    "Disabled App",
			Version: "1.1.0",
			Enabled: false,
		},
		{
			Type:    "plugin",
			ID:      "otherplugin",
			Name:    "Other Plugin",
			Version: "1.2.0",
			Enabled: true,
		},
		{
			Type:    "app",
			ID:      "zendesk",
			Name:    "Zendesk",
			Version: "1.1.0",
			Enabled: true,
		},
	}
	require.Equal(t, expected, integrations)

	usage, appErr := th.App.GetIntegrationsUsage()
	require.Nil(t, appErr)

	// 3 enabled integrations
	expectedUsage := &model.IntegrationsUsage{
		Count: 3,
	}
	require.Equal(t, expectedUsage, usage)
}
