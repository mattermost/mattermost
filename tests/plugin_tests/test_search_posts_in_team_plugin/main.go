// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"fmt"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/plugin"
)

type MyPlugin struct {
	plugin.MattermostPlugin
}

func (p *MyPlugin) MessageWillBePosted(c *plugin.Context, post *model.Post) (*model.Post, string) {

	testCases := []struct {
		description      string
		teamId           string
		params           []*model.SearchParams
		expectedPostsLen int
	}{
		{
			"nil params",
			"{{.BasicTeam.Id}}",
			nil,
			0,
		},
		{
			"empty params",
			"{{.BasicTeam.Id}}",
			[]*model.SearchParams{},
			0,
		},
		{
			"doesn't match any posts",
			"{{.BasicTeam.Id}}",
			model.ParseSearchParams("bad message", 0),
			0,
		},
		{
			"matched posts",
			"{{.BasicTeam.Id}}",
			model.ParseSearchParams("{{.BasicPost.Message}}", 0),
			1,
		},
	}

	for _, testCase := range testCases {
		posts, err := p.API.SearchPostsInTeam(testCase.teamId, testCase.params)
		if err != nil {
			return nil, fmt.Sprintf("%v: %v", testCase.description, err.Error())
		}
		if testCase.expectedPostsLen != len(posts) {
			return nil, fmt.Sprintf("%v: invalid number of posts: %v != %v", testCase.description, testCase.expectedPostsLen, len(posts))
		}
	}
	return nil, ""
}

func main() {
	plugin.ClientMain(&MyPlugin{})
}
