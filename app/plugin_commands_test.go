// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/stretchr/testify/require"
)

func TestPluginCommand(t *testing.T) {
	th := Setup().InitBasic()
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
				"github.com/mattermost/mattermost-server/plugin"
				"github.com/mattermost/mattermost-server/model"
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

		th.App.RemovePlugin(pluginIds[0])
	})

	t.Run("error after plugin command unregistered", func(t *testing.T) {
		_, err := th.App.ExecuteCommand(args)
		require.NotNil(t, err)
	})
}
