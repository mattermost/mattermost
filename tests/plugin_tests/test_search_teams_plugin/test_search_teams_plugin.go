// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"encoding/json"
	"fmt"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/plugin"
)

type MyPlugin struct {
	plugin.MattermostPlugin
}

func (p *MyPlugin) MessageWillBePosted(c *plugin.Context, post *model.Post) (*model.Post, string) {

	test := func() string {
		teams, err := p.API.SearchTeams("{{.Name}}")
		if err != nil {
			return "search failed: " + err.Message
		}
		if len(teams) != 1 {
			return fmt.Sprintf("search failed, wrong number of teams: %v", len(teams))
		}

		teams, err = p.API.SearchTeams("{{.DisplayName}}")
		if err != nil {
			return "search failed: " + err.Message
		}
		if len(teams) != 1 {
			return fmt.Sprintf("search failed, wrong number of teams: %v", len(teams))
		}

		teams, err = p.API.SearchTeams("{{.Name}}"[:3])

		if err != nil {
			return "search failed: " + err.Message
		}
		if len(teams) != 1 {
			return fmt.Sprintf("search failed, wrong number of teams: %v", len(teams))
		}

		teams, err = p.API.SearchTeams("not found")
		if err != nil {
			return "search failed: " + err.Message
		}
		if len(teams) != 0 {
			return fmt.Sprintf("search failed, wrong number of teams: %v", len(teams))
		}
		return ""
	}

	result := map[string]interface{}{}
	err := test()
	if err != "" {
		result["Error"] = err
	}
	b, _ := json.Marshal(result)
	return nil, string(b)
}

func main() {
	plugin.ClientMain(&MyPlugin{})
}
