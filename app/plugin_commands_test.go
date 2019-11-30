// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/utils"
	"github.com/stretchr/testify/require"
)

func TestPluginCommand(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	args := &model.CommandArgs{}
	args.TeamId = th.BasicTeam.Id
	args.ChannelId = th.BasicChannel.Id
	args.UserId = th.BasicUser.Id
	args.Command = "/plugin"

	t.Run("error before plugin command registered", func(t *testing.T) {
		_, err := th.App.ExecuteCommand(args)
		require.NotNil(t, err)
	})

	t.Run("command handled by plugin", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.PluginSettings.Plugins["testloadpluginconfig"] = map[string]interface{}{
				"TeamId": args.TeamId,
			}
		})

		tearDown, pluginIds, activationErrors := SetAppEnvironmentWithPlugins(t, []string{`
			package main

			import (
				"github.com/mattermost/mattermost-server/v5/plugin"
				"github.com/mattermost/mattermost-server/v5/model"
			)

			type configuration struct {
				TeamId string
			}

			type MyPlugin struct {
				plugin.MattermostPlugin

				configuration configuration
			}

			func (p *MyPlugin) OnConfigurationChange() error {
				p.API.LogError("hello")
				if err := p.API.LoadPluginConfiguration(&p.configuration); err != nil {
					return err
				}

				return nil
			}

			func (p *MyPlugin) OnActivate() error {
				p.API.LogError("team", "team", p.configuration.TeamId)
				err := p.API.RegisterCommand(&model.Command{
					TeamId: p.configuration.TeamId,
					Trigger: "plugin",
					DisplayName: "Plugin Command",
					AutoComplete: true,
					AutoCompleteDesc: "autocomplete",
				})
				if err != nil {
					p.API.LogError("error", "err", err)
				}
				p.API.LogDebug("team", "team", p.configuration.TeamId)

				return err
			}

			func (p *MyPlugin) ExecuteCommand(c *plugin.Context, args *model.CommandArgs) (*model.CommandResponse, *model.AppError) {
				return &model.CommandResponse{
					ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
					Text: "text",
				}, nil
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
		`}, th.App, th.App.NewPluginAPI)
		defer tearDown()
		require.Len(t, activationErrors, 1)
		require.Nil(t, nil, activationErrors[0])

		resp, err := th.App.ExecuteCommand(args)
		require.Nil(t, err)
		require.Equal(t, model.COMMAND_RESPONSE_TYPE_EPHEMERAL, resp.ResponseType)
		require.Equal(t, "text", resp.Text)

		err2 := th.App.DisablePlugin(pluginIds[0])
		require.Nil(t, err2)

		commands, err3 := th.App.ListAutocompleteCommands(args.TeamId, utils.T)
		require.Nil(t, err3)

		for _, commands := range commands {
			require.NotEqual(t, "plugin", commands.Trigger)
		}

		th.App.RemovePlugin(pluginIds[0])
	})

	t.Run("re-entrant command registration on config change", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.PluginSettings.Plugins["testloadpluginconfig"] = map[string]interface{}{
				"TeamId": args.TeamId,
			}
		})

		tearDown, pluginIds, activationErrors := SetAppEnvironmentWithPlugins(t, []string{`
			package main

			import (
				"github.com/mattermost/mattermost-server/v5/plugin"
				"github.com/mattermost/mattermost-server/v5/model"
			)

			type configuration struct {
				TeamId string
			}

			type MyPlugin struct {
				plugin.MattermostPlugin

				configuration configuration
			}

			func (p *MyPlugin) OnConfigurationChange() error {
				p.API.LogInfo("OnConfigurationChange")
				err := p.API.LoadPluginConfiguration(&p.configuration);
				if err != nil {
					return err
				}

				p.API.LogInfo("About to register")
				err = p.API.RegisterCommand(&model.Command{
					TeamId: p.configuration.TeamId,
					Trigger: "plugin",
					DisplayName: "Plugin Command",
					AutoComplete: true,
					AutoCompleteDesc: "autocomplete",
				})
				if err != nil {
					p.API.LogInfo("Registered, with error", err, err.Error())
					return err
				}
				p.API.LogInfo("Registered, without error")
				return nil
			}

			func (p *MyPlugin) ExecuteCommand(c *plugin.Context, commandArgs *model.CommandArgs) (*model.CommandResponse, *model.AppError) {
				p.API.LogInfo("ExecuteCommand")
				// Saving the plugin config eventually results in a call to
				// OnConfigurationChange. This used to deadlock on account of
				// effectively acquiring a RWLock reentrantly.
				err := p.API.SavePluginConfig(map[string]interface{}{
					"TeamId": p.configuration.TeamId,
				})
				if err != nil {
					p.API.LogError("Failed to save plugin config", err, err.Error())
					return nil, err
				}
				p.API.LogInfo("ExecuteCommand, saved plugin config")

				return &model.CommandResponse{
					ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
					Text: "text",
				}, nil
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
		`}, th.App, th.App.NewPluginAPI)
		defer tearDown()

		require.Len(t, activationErrors, 1)
		require.Nil(t, nil, activationErrors[0])

		wait := make(chan bool)
		killed := false
		go func() {
			defer close(wait)

			resp, err := th.App.ExecuteCommand(args)

			// Ignore if we kill below.
			if !killed {
				require.Nil(t, err)
				require.Equal(t, model.COMMAND_RESPONSE_TYPE_EPHEMERAL, resp.ResponseType)
				require.Equal(t, "text", resp.Text)
			}
		}()

		select {
		case <-wait:
		case <-time.After(10 * time.Second):
			killed = true
		}

		th.App.RemovePlugin(pluginIds[0])
		if killed {
			t.Fatal("execute command appears to have deadlocked")
		}
	})

	t.Run("error after plugin command unregistered", func(t *testing.T) {
		_, err := th.App.ExecuteCommand(args)
		require.NotNil(t, err)
	})
}
