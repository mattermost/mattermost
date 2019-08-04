// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
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
				"fmt"
				"strings"
				"github.com/mattermost/mattermost-server/plugin"
				"github.com/mattermost/mattermost-server/model"
			)

			type configuration struct {
				TeamId string
				Unregister bool
			}

			type MyPlugin struct {
				plugin.MattermostPlugin	

				configuration configuration
			}

			func (p *MyPlugin) OnActivate() error {
				fmt.Println("<><> OnActivate: registering command")
				err := p.API.RegisterCommand(&model.Command{
					TeamId: p.configuration.TeamId,
					Trigger: "plugin",
					DisplayName: "Plugin Command",
					AutoComplete: true,
					AutoCompleteDesc: "autocomplete",
				})
				if err != nil {
					return err
				}
				return nil
			}

			func (p *MyPlugin) OnConfigurationChange() error {
				fmt.Println("<><> OnConfigurationChange: start")
				err := p.API.LoadPluginConfiguration(&p.configuration)
				if err != nil {
					panic(err.Error())
				}
				fmt.Println("<><> OnConfigurationChange: loaded new configuration")
				if p.configuration.Unregister {
					fmt.Println("<><> OnConfigurationChange: unregistering the command")
					err = p.API.UnregisterCommand(p.configuration.TeamId, "plugin")
					fmt.Println("<><> OnConfigurationChange: unregistered the command:", err)
					if err != nil {
						panic(err.Error())
					}
				} else {
					fmt.Println("<><> OnConfigurationChange: registering the command")
					err = p.API.RegisterCommand(&model.Command{
						TeamId: p.configuration.TeamId,
						Trigger: "plugin",
						DisplayName: "Plugin Command",
						AutoComplete: true,
						AutoCompleteDesc: "autocomplete",
					})
					fmt.Println("<><> OnConfigurationChange: registered the command:", err)
					if err != nil {
						panic(err.Error())
					}
				}
				return nil
			}

			func (p *MyPlugin) ExecuteCommand(c *plugin.Context, commandArgs *model.CommandArgs) (*model.CommandResponse, *model.AppError) {
				args := strings.Split(commandArgs.Command, " ")

				updateConf := func(unregister bool) {
					newConf := map[string]interface{}{
						"TeamId": p.configuration.TeamId,
						"Unregister": unregister,
					}
					
					// Saving the configuration will cause OnConfigurationChange, and
					// will in turn call RegisterCommand which should still work
					fmt.Println("<><> ExecuteCommand: before SavePluginConfig:")
					err := p.API.SavePluginConfig(newConf)
					fmt.Println("<><> ExecuteCommand: after SavePluginConfig:", err)
					if err != nil {
						panic(err.Error())
					}
				}

				switch {
				case len(args) > 1 && args[1] == "register":
					updateConf(false)
				case len(args) > 1 && args[1] == "unregister":
					updateConf(true)
				}

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

		t.Run("regular", func(t *testing.T) {
			resp, err := th.App.ExecuteCommand(args)
			require.Nil(t, err)
			require.Equal(t, model.COMMAND_RESPONSE_TYPE_EPHEMERAL, resp.ResponseType)
			require.Equal(t, "text", resp.Text)
		})

		t.Run("re-entrant unregister", func(t *testing.T) {
			args.Command = "/plugin unregister"
			th.App.Log.Error("<><> TEST Executing command")
			resp, err := th.App.ExecuteCommand(args)
			require.Nil(t, err)
			require.Equal(t, model.COMMAND_RESPONSE_TYPE_EPHEMERAL, resp.ResponseType)
			require.Equal(t, "text", resp.Text)
		})

		t.Run("unregistered command fails", func(t *testing.T) {
			_, err := th.App.ExecuteCommand(args)
			require.NotNil(t, err)
		})

		// t.Run("re-entrant register", func(t *testing.T) {
		// 	args.Command = "/plugin unregister"
		// 	resp, err := th.App.ExecuteCommand(args)
		// 	require.Nil(t, err)
		// 	require.Equal(t, model.COMMAND_RESPONSE_TYPE_EPHEMERAL, resp.ResponseType)
		// 	require.Equal(t, "text", resp.Text)
		// })

		// t.Run("re-registered succeeds", func(t *testing.T) {
		// 	resp, err := th.App.ExecuteCommand(args)
		// 	require.Nil(t, err)
		// 	require.Equal(t, model.COMMAND_RESPONSE_TYPE_EPHEMERAL, resp.ResponseType)
		// 	require.Equal(t, "text", resp.Text)
		// })

		// t.Run("plugin disabled", func(t *testing.T) {
		// 	err2 := th.App.DisablePlugin(pluginIds[0])
		// 	require.Nil(t, err2)

		// 	commands, err3 := th.App.ListAutocompleteCommands(args.TeamId, utils.T)
		// 	require.Nil(t, err3)

		// 	for _, commands := range commands {
		// 		require.NotEqual(t, "plugin", commands.Trigger)
		// 	}
		// })

		th.App.RemovePlugin(pluginIds[0])
	})

	t.Run("error after plugin command unregistered", func(t *testing.T) {
		_, err := th.App.ExecuteCommand(args)
		require.NotNil(t, err)
	})
}
