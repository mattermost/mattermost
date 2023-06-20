// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/json"
	"os"
	"sort"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestGraphQLSidebarCategories(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_GRAPHQL", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_GRAPHQL")
	th := Setup(t).InitBasic()
	defer th.TearDown()

	var q struct {
		SidebarCategories []struct {
			ID          string                       `json:"id"`
			DisplayName string                       `json:"displayName"`
			Sorting     model.SidebarCategorySorting `json:"sorting"`
			ChannelIDs  []string                     `json:"channelIds"`
			TeamID      string                       `json:"teamId"`
			SortOrder   int64                        `json:"sortOrder"`
		} `json:"sidebarCategories"`
	}

	input := graphQLInput{
		OperationName: "sidebarCategories",
		Query: `
	query sidebarCategories($userId: String = "", $teamId: String = "", $excludeTeam: Boolean = false) {
		sidebarCategories(userId: $userId, teamId: $teamId, excludeTeam: $excludeTeam) {
			id
			displayName
			sorting
			channelIds
			sortOrder
		}
	}
	`,
		Variables: map[string]any{
			"userId": "me",
			"teamId": th.BasicTeam.Id,
		},
	}

	resp, err := th.MakeGraphQLRequest(&input)
	require.NoError(t, err)
	require.Len(t, resp.Errors, 0)
	require.NoError(t, json.Unmarshal(resp.Data, &q))
	assert.Len(t, q.SidebarCategories, 3)

	categories, _, err := th.Client.GetSidebarCategoriesForTeamForUser(context.Background(), th.BasicUser.Id, th.BasicTeam.Id, "")
	require.NoError(t, err)

	sort.Slice(q.SidebarCategories, func(i, j int) bool {
		return q.SidebarCategories[i].ID < q.SidebarCategories[j].ID
	})
	sort.Slice(categories.Categories, func(i, j int) bool {
		return categories.Categories[i].Id < categories.Categories[j].Id
	})

	for i := range categories.Categories {
		assert.Equal(t, categories.Categories[i].Id, q.SidebarCategories[i].ID)
		assert.Equal(t, categories.Categories[i].DisplayName, q.SidebarCategories[i].DisplayName)
		assert.Equal(t, categories.Categories[i].Sorting, q.SidebarCategories[i].Sorting)
		assert.Equal(t, categories.Categories[i].ChannelIds(), q.SidebarCategories[i].ChannelIDs)
		assert.Equal(t, categories.Categories[i].SortOrder, q.SidebarCategories[i].SortOrder)
	}

	input = graphQLInput{
		OperationName: "sidebarCategories",
		Query: `
	query sidebarCategories($userId: String = "", $teamId: String = "", $excludeTeam: Boolean = false) {
		sidebarCategories(userId: $userId, teamId: $teamId, excludeTeam: $excludeTeam) {
			id
			displayName
			sorting
			channelIds
			sortOrder
		}
	}
	`,
		Variables: map[string]any{
			"userId":      "me",
			"teamId":      th.BasicTeam.Id,
			"excludeTeam": true,
		},
	}

	resp, err = th.MakeGraphQLRequest(&input)
	require.NoError(t, err)
	require.Len(t, resp.Errors, 0)
	require.NoError(t, json.Unmarshal(resp.Data, &q))
	assert.Len(t, q.SidebarCategories, 0)

	// Adding a new team
	myTeam := th.CreateTeam()
	ch1 := th.CreateChannelWithClientAndTeam(th.Client, model.ChannelTypeOpen, myTeam.Id)
	ch2 := th.CreateChannelWithClientAndTeam(th.Client, model.ChannelTypePrivate, myTeam.Id)
	th.LinkUserToTeam(th.BasicUser, myTeam)
	th.App.AddUserToChannel(th.Context, th.BasicUser, ch1, false)
	th.App.AddUserToChannel(th.Context, th.BasicUser, ch2, false)

	input = graphQLInput{
		OperationName: "sidebarCategories",
		Query: `
	query sidebarCategories($userId: String = "", $teamId: String = "", $excludeTeam: Boolean = false) {
		sidebarCategories(userId: $userId, teamId: $teamId, excludeTeam: $excludeTeam) {
			id
			displayName
			sorting
			channelIds
			teamId
			sortOrder
		}
	}
	`,
		Variables: map[string]any{
			"userId":      "me",
			"teamId":      th.BasicTeam.Id,
			"excludeTeam": true,
		},
	}

	resp, err = th.MakeGraphQLRequest(&input)
	require.NoError(t, err)
	require.Len(t, resp.Errors, 0)
	require.NoError(t, json.Unmarshal(resp.Data, &q))
	assert.Len(t, q.SidebarCategories, 3)
	for _, cat := range q.SidebarCategories {
		assert.Equal(t, myTeam.Id, cat.TeamID)
	}
}
