// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/stretchr/testify/require"
)

func TestHealthCheckJob(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	tearDown, _, _ := SetAppEnvironmentWithPlugins(t, []string{
		`
			package main

			import (
				"github.com/mattermost/mattermost-server/v5/plugin"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *MyPlugin) OnActivate() error {
				panic("simulate panic")
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
	}, th.App, th.App.NewPluginAPI)
	defer tearDown()

	env := th.App.GetPluginsEnvironment()
	job := env.GetPluginHealthCheckJob()
	require.NotNil(t, job)
	bundles := env.Active()
	require.Equal(t, 1, len(bundles))

	id := bundles[0].Manifest.Id
	job.CheckPlugin(id)
	bundles = env.Active()
	require.Equal(t, 1, len(bundles))
	require.Equal(t, model.PluginStateRunning, env.GetPluginState(id))

	job.CheckPlugin(id)
	bundles = env.Active()
	require.Equal(t, 1, len(bundles))
	require.Equal(t, model.PluginStateRunning, env.GetPluginState(id))

	job.CheckPlugin(id)
	bundles = env.Active()
	require.Equal(t, 0, len(bundles))
	require.Equal(t, model.PluginStateFailedToStayRunning, env.GetPluginState(id))
}
