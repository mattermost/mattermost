// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/app/entities"
)

const registeringPluginSource = `
	package main

	import (
		"errors"

		"github.com/mattermost/mattermost/server/public/model"
		"github.com/mattermost/mattermost/server/public/plugin"
	)

	type MyPlugin struct {
		plugin.MattermostPlugin
	}

	func (p *MyPlugin) OnActivate() error {
		if err := p.API.RegisterCommand(&model.Command{Trigger: "closetest"}); err != nil {
			return err
		}
		if appErr := p.API.RegisterEntityType(&model.EntityType{Name: "ticket", DisplayName: "Ticket"}); appErr != nil {
			return appErr
		}
		if appErr := p.API.RegisterEntityMatcher(&model.EntityMatcher{Name: "scan", Type: "ticket", Pattern: "CLOSE-[0-9]+"}); appErr != nil {
			return appErr
		}
		if %t {
			return errors.New("activation failed after registering")
		}
		return nil
	}

	func main() {
		plugin.ClientMain(&MyPlugin{})
	}
`

func pluginRegistrations(th *TestHelper, pluginID string) (commands int, hasEntity bool) {
	th.App.ch.pluginCommandsLock.RLock()
	for _, pc := range th.App.ch.pluginCommands {
		if pc.PluginId == pluginID {
			commands++
		}
	}
	th.App.ch.pluginCommandsLock.RUnlock()

	_, _, err := entities.Prepare(th.Context.Context(), pluginID+":ticket", "CLOSE-1")
	return commands, err == nil
}

func TestPluginRegistrationsAreReleasedWithThePlugin(t *testing.T) {
	mainHelper.Parallel(t)

	setup := func(t *testing.T, failActivation bool) (*TestHelper, string, error) {
		th := SetupConfig(t, func(cfg *model.Config) {
			cfg.FeatureFlags.Entities = true
		}).InitBasic(t)

		tearDown, pluginIDs, activationErrors := SetAppEnvironmentWithPlugins(t,
			[]string{fmt.Sprintf(registeringPluginSource, failActivation)}, th.App, th.NewPluginAPI)
		t.Cleanup(tearDown)
		t.Cleanup(func() { entities.RemoveOwner(pluginIDs[0]) })
		return th, pluginIDs[0], activationErrors[0]
	}

	t.Run("on deactivation", func(t *testing.T) {
		th, pluginID, activationErr := setup(t, false)
		require.NoError(t, activationErr)

		commands, hasEntity := pluginRegistrations(th, pluginID)
		require.Equal(t, 1, commands)
		require.True(t, hasEntity)

		require.True(t, th.App.GetPluginsEnvironment().Deactivate(pluginID))

		commands, hasEntity = pluginRegistrations(th, pluginID)
		assert.Zero(t, commands)
		assert.False(t, hasEntity)
	})

	t.Run("on restart", func(t *testing.T) {
		th, pluginID, activationErr := setup(t, false)
		require.NoError(t, activationErr)

		require.NoError(t, th.App.GetPluginsEnvironment().RestartPlugin(pluginID))

		commands, hasEntity := pluginRegistrations(th, pluginID)
		assert.Equal(t, 1, commands)
		assert.True(t, hasEntity)
	})

	t.Run("on environment shutdown", func(t *testing.T) {
		th, pluginID, activationErr := setup(t, false)
		require.NoError(t, activationErr)

		th.App.ch.ShutDownPlugins()

		commands, hasEntity := pluginRegistrations(th, pluginID)
		assert.Zero(t, commands)
		assert.False(t, hasEntity)
	})

	t.Run("when OnActivate fails after registering", func(t *testing.T) {
		th, pluginID, activationErr := setup(t, true)
		require.Error(t, activationErr)

		commands, hasEntity := pluginRegistrations(th, pluginID)
		assert.Zero(t, commands)
		assert.False(t, hasEntity)
	})
}
