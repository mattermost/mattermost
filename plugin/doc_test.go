package plugin_test

import (
	"strings"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/plugin"
)

type MyPlugin struct {
	plugin.MattermostPlugin

	TeamName    string
	ChannelName string

	channelId string
}

func (p *MyPlugin) OnConfigurationChange() error {
	// Reuse the default implementation of OnConfigurationChange to automatically load the
	// required TeamName and ChannelName.
	if err := p.MattermostPlugin.OnConfigurationChange(); err != nil {
		p.API.LogError(err.Error())
		return nil
	}

	team, err := p.API.GetTeamByName(p.TeamName)
	if err != nil {
		p.API.LogError("failed to find team", "team_name", p.TeamName)
		return nil
	}

	channel, err := p.API.GetChannelByName(p.ChannelName, team.Id)
	if err != nil {
		p.API.LogError("failed to find channel", "channel_name", p.ChannelName)
		return nil
	}

	p.channelId = channel.Id

	return nil
}

func (p *MyPlugin) MessageHasBeenPosted(c *plugin.Context, post *model.Post) {
	// Ignore posts not in the configured channel
	if post.ChannelId != p.channelId {
		return
	}

	// Ignore posts this plugin made.
	if sentByPlugin, _ := post.Props["sent_by_plugin"].(bool); sentByPlugin {
		return
	}

	// Ignore posts without a plea for help.
	if !strings.Contains(post.Message, "help") {
		return
	}

	p.API.SendEphemeralPost(post.UserId, &model.Post{
		ChannelId: p.channelId,
		Message:   "You asked for help? Checkout https://about.mattermost.com/help/",
		Props: map[string]interface{}{
			"sent_by_plugin": true,
		},
	})
}

func Example() {
	plugin.ClientMain(&MyPlugin{})
}
