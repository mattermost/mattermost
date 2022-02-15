// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"os"
	"sort"
	"testing"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGraphQLTeamMembers(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_GRAPHQL", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_GRAPHQL")
	th := Setup(t).InitBasic()
	defer th.TearDown()

	var q struct {
		TeamMembers []struct {
			User struct {
				ID        string `json:"id"`
				Username  string `json:"username"`
				Email     string `json:"email"`
				FirstName string `json:"firstName"`
				LastName  string `json:"lastName"`
				NickName  string `json:"nickname"`
			} `json:"user"`
			Team struct {
				ID          string `json:"id"`
				DisplayName string `json:"displayName"`
			} `json:"team"`
			Roles []struct {
				ID            string   `json:"id"`
				Name          string   `json:"Name"`
				Permissions   []string `json:"permissions"`
				SchemeManaged bool     `json:"schemeManaged"`
				BuiltIn       bool     `json:"builtIn"`
			} `json:"roles"`
			DeleteAt          float64 `json:"deleteAt"`
			SchemeGuest       bool    `json:"schemeGuest"`
			SchemeUser        bool    `json:"schemeUser"`
			SchemeAdmin       bool    `json:"schemeAdmin"`
			SidebarCategories []struct {
				ID          string                       `json:"id"`
				DisplayName string                       `json:"displayName"`
				Sorting     model.SidebarCategorySorting `json:"sorting"`
				ChannelIDs  []string                     `json:"channelIds"`
			} `json:"sidebarCategories"`
		} `json:"teamMembers"`
	}

	t.Run("User", func(t *testing.T) {
		input := graphQLInput{
			OperationName: "teamMembers",
			Query: `
	query teamMembers($userId: String = "", $teamId: String = "") {
	  teamMembers(userId: $userId, teamId: $teamId) {
	  	team {
	  		id
	  		displayName
	  	}
	  	user {
	  		id
	  		username
	  		email
	  		firstName
	  		lastName
	  	}
	  	roles {
	  		id
	  		name
	  	}
	  	schemeGuest
	  	schemeUser
	  	schemeAdmin
	  	sidebarCategories {
	  		id
	  		displayName
	  		sorting
	  		channelIds
	  	}
	  }
	}
	`,
			Variables: map[string]interface{}{
				"userId": "me",
			},
		}

		resp, err := th.MakeGraphQLRequest(&input)
		require.NoError(t, err)
		require.Len(t, resp.Errors, 0)
		require.NoError(t, json.Unmarshal(resp.Data, &q))
		assert.Len(t, q.TeamMembers, 1)

		tm := q.TeamMembers[0]
		assert.Equal(t, th.BasicTeam.Id, tm.Team.ID)
		assert.Equal(t, th.BasicTeam.DisplayName, tm.Team.DisplayName)

		assert.Equal(t, th.BasicUser.Id, tm.User.ID)
		assert.Equal(t, th.BasicUser.Username, tm.User.Username)
		assert.Equal(t, th.BasicUser.Email, tm.User.Email)
		assert.Equal(t, th.BasicUser.FirstName, tm.User.FirstName)
		assert.Equal(t, th.BasicUser.LastName, tm.User.LastName)

		require.Len(t, tm.Roles, 1)
		assert.NotEmpty(t, tm.Roles[0].ID)
		assert.Equal(t, "team_user", tm.Roles[0].Name)
		assert.False(t, tm.SchemeGuest)
		assert.True(t, tm.SchemeUser)
		assert.False(t, tm.SchemeAdmin)

		categories, _, err := th.Client.GetSidebarCategoriesForTeamForUser(th.BasicUser.Id, th.BasicTeam.Id, "")
		require.NoError(t, err)

		sort.Slice(tm.SidebarCategories, func(i, j int) bool {
			return tm.SidebarCategories[i].ID < tm.SidebarCategories[j].ID
		})
		sort.Slice(categories.Categories, func(i, j int) bool {
			return categories.Categories[i].Id < categories.Categories[j].Id
		})

		for i := range categories.Categories {
			assert.Equal(t, categories.Categories[i].Id, tm.SidebarCategories[i].ID)
			assert.Equal(t, categories.Categories[i].DisplayName, tm.SidebarCategories[i].DisplayName)
			assert.Equal(t, categories.Categories[i].Sorting, tm.SidebarCategories[i].Sorting)
			assert.Equal(t, categories.Categories[i].ChannelIds(), tm.SidebarCategories[i].ChannelIDs)
		}
	})

	t.Run("User+Team", func(t *testing.T) {
		input := graphQLInput{
			OperationName: "teamMembers",
			Query: `
	query teamMembers($userId: String = "", $teamId: String = "") {
	  teamMembers(userId: $userId, teamId: $teamId) {
	  	team {
	  		id
	  		displayName
	  	}
	  	user {
	  		id
	  		username
	  		email
	  		firstName
	  		lastName
	  	}
	  	roles {
	  		id
	  		name
	  	}
	  }
	}
	`,
			Variables: map[string]interface{}{
				"userId": "me",
				"teamId": th.BasicTeam.Id,
			},
		}

		resp, err := th.MakeGraphQLRequest(&input)
		require.NoError(t, err)
		require.Len(t, resp.Errors, 0)
		require.NoError(t, json.Unmarshal(resp.Data, &q))
		assert.Len(t, q.TeamMembers, 1)

		tm := q.TeamMembers[0]
		assert.Equal(t, th.BasicTeam.Id, tm.Team.ID)
		assert.Equal(t, th.BasicTeam.DisplayName, tm.Team.DisplayName)

		assert.Equal(t, th.BasicUser.Id, tm.User.ID)
		assert.Equal(t, th.BasicUser.Username, tm.User.Username)
		assert.Equal(t, th.BasicUser.Email, tm.User.Email)
		assert.Equal(t, th.BasicUser.FirstName, tm.User.FirstName)
		assert.Equal(t, th.BasicUser.LastName, tm.User.LastName)

		require.Len(t, tm.Roles, 1)
		assert.NotEmpty(t, tm.Roles[0].ID)
		assert.Equal(t, "team_user", tm.Roles[0].Name)
	})

	t.Run("NewTeam", func(t *testing.T) {
		// Adding another team with more channels (public and private)
		myTeam := th.CreateTeam()
		ch1 := th.CreateChannelWithClientAndTeam(th.Client, model.ChannelTypeOpen, myTeam.Id)
		ch2 := th.CreateChannelWithClientAndTeam(th.Client, model.ChannelTypePrivate, myTeam.Id)
		th.LinkUserToTeam(th.BasicUser, myTeam)
		th.App.AddUserToChannel(th.BasicUser, ch1, false)
		th.App.AddUserToChannel(th.BasicUser, ch2, false)

		input := graphQLInput{
			OperationName: "teamMembers",
			Query: `
	query teamMembers($userId: String = "", $teamId: String = "") {
	  teamMembers(userId: $userId, teamId: $teamId) {
	  	team {
	  		id
	  		displayName
	  	}
	  	roles {
	  		id
	  		name
	  	}
	  }
	}
	`,
			Variables: map[string]interface{}{
				"userId": "me",
			},
		}

		resp, err := th.MakeGraphQLRequest(&input)
		require.NoError(t, err)
		require.Len(t, resp.Errors, 0)
		require.NoError(t, json.Unmarshal(resp.Data, &q))
		assert.Len(t, q.TeamMembers, 2)

		sort.Slice(q.TeamMembers, func(i, j int) bool {
			return q.TeamMembers[i].Team.ID < q.TeamMembers[j].Team.ID
		})

		expectedTeams := []*model.Team{th.BasicTeam, myTeam}
		sort.Slice(expectedTeams, func(i, j int) bool {
			return expectedTeams[i].Id < expectedTeams[j].Id
		})

		for i := range q.TeamMembers {
			tm := q.TeamMembers[i]

			if tm.Team.ID == myTeam.Id {
				require.Len(t, tm.Roles, 2)
				sort.Slice(tm.Roles, func(i, j int) bool {
					return tm.Roles[i].Name < tm.Roles[j].Name
				})
				assert.Equal(t, "team_admin", tm.Roles[0].Name)
				assert.Equal(t, "team_user", tm.Roles[1].Name)
			} else {
				require.Len(t, tm.Roles, 1)
				assert.NotEmpty(t, tm.Roles[0].ID)
				assert.Equal(t, "team_user", tm.Roles[0].Name)
			}

			expectedTeams[i].Id = tm.Team.ID
			expectedTeams[i].DisplayName = tm.Team.DisplayName
		}
	})
}
