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
	teamMembers, err := p.API.GetTeamMembersForUser("{{.UserId}}", 0, 10)
	result := map[string]interface{}{}
	if err != nil {
		result["Error"] = err.Error() + "failed to get team members"
	} else if len(teamMembers) != 1 {
		result["Error"] = "Invalid number of team members"
	} else {
		result["UserId"] = teamMembers[0].UserId
		result["TeamId"] = teamMembers[0].TeamId
	}

	b, _ := json.Marshal(result)
	return nil, string(b)
}

func main() {
	plugin.ClientMain(&MyPlugin{})
}
