// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"encoding/json"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/plugin"
)

type MyPlugin struct {
	plugin.MattermostPlugin
}

func (p *MyPlugin) MessageWillBePosted(c *plugin.Context, post *model.Post) (*model.Post, string) {
	channelMembers, err := p.API.GetChannelMembersForUser("{{.TeamId}}", "{{.UserId}}", 0, 10)

	result := map[string]interface{}{}
	if err != nil {
		result["Error"] = err.Error() + "failed to get channel members"
	} else if len(channelMembers) != 3 {
		result["Error"] = "Invalid number of channel members"
	} else {
		result["UserId"] = channelMembers[0].UserId
	}

	b, _ := json.Marshal(result)
	return nil, string(b)
}

func main() {
	plugin.ClientMain(&MyPlugin{})
}
