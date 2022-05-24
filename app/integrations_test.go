// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
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

	setupMultiPluginAPITest(t,
		[]string{samplePluginCode, samplePluginCode, samplePluginCode, samplePluginCode, samplePluginCode, samplePluginCode, samplePluginCode}, []string{
			`{"id": "otherplugin", "name": "Other Plugin", "version": "1.2.0", "server": {"executable": "backend.exe"}}`,
			`{"id": "mattermost-autolink", "name": "Autolink", "version": "1.2.0", "server": {"executable": "backend.exe"}}`,
			`{"id": "playbooks", "name": "Playbooks", "version": "1.2.0", "server": {"executable": "backend.exe"}}`,
			`{"id": "focalboard", "name": "Mattermost Boards", "version": "1.2.0", "server": {"executable": "backend.exe"}}`,
			`{"id": "com.mattermost.calls", "name": "Calls", "version": "1.2.0", "server": {"executable": "backend.exe"}}`,
			`{"id": "com.mattermost.nps", "name": "User Satisfaction Surveys", "version": "1.2.0", "server": {"executable": "backend.exe"}}`,
			`{"id": "com.mattermost.apps", "server": {"executable": "backend.exe"}}`,
		}, []string{"otherplugin", "mattermost-autolink", "playbooks", "focalboard", "com.mattermost.calls", "com.mattermost.nps", "com.mattermost.apps"},
		true, th.App, th.Context)

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
			Type:    "plugin",
			ID:      "otherplugin",
			Name:    "Other Plugin",
			Version: "1.2.0",
			Enabled: true,
		},
	}
	require.Equal(t, expected, integrations)

	usage, appErr := th.App.GetIntegrationsUsage()
	require.Nil(t, appErr)

	// 2 enabled integrations
	expectedUsage := &model.IntegrationsUsage{
		Enabled: 2,
	}
	require.Equal(t, expectedUsage, usage)
}
