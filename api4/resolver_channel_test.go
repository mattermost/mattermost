// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"os"
	"testing"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGraphQLChannels(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_GRAPHQL", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_GRAPHQL")
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// Adding another team with more channels (public and private)
	myTeam := th.CreateTeam()
	ch1 := th.CreateChannelWithClientAndTeam(th.Client, model.ChannelTypeOpen, myTeam.Id)
	ch2 := th.CreateChannelWithClientAndTeam(th.Client, model.ChannelTypePrivate, myTeam.Id)
	th.LinkUserToTeam(th.BasicUser, myTeam)
	th.App.AddUserToChannel(th.Context, th.BasicUser, ch1, false)
	th.App.AddUserToChannel(th.Context, th.BasicUser, ch2, false)
	th.CreateDmChannel(th.BasicUser2)

	var q struct {
		Channels []struct {
			ID                string            `json:"id"`
			CreateAt          float64           `json:"createAt"`
			UpdateAt          float64           `json:"updateAt"`
			Type              model.ChannelType `json:"type"`
			DisplayName       string            `json:"displayName"`
			PrettyDisplayName string            `json:"prettyDisplayName"`
			Name              string            `json:"name"`
			Header            string            `json:"header"`
			Purpose           string            `json:"purpose"`
			SchemeId          string            `json:"schemeId"`
			TotalMsgCountRoot float64           `json:"totalMsgCountRoot"`
			LastRootPostAt    float64           `json:"lastRootPostAt"`
			Cursor            string            `json:"cursor"`
			Props             map[string]any    `json:"props"`
			Team              struct {
				ID          string `json:"id"`
				DisplayName string `json:"displayName"`
			} `json:"team"`
			Stats struct {
				ChannelId       string  `json:"channelId"`
				MemberCount     float64 `json:"memberCount"`
				GuestCount      float64 `json:"guestCount"`
				PinnedPostCount float64 `json:"pinnedpostCount"`
			} `json:"stats"`
		} `json:"channels"`
	}

	t.Run("all", func(t *testing.T) {
		input := graphQLInput{
			OperationName: "channels",
			Query: `
	query channels {
	  channels(userId: "me") {
	  	id
	  	createAt
	  	updateAt
	  	type
	    displayName
	    prettyDisplayName
	    name
	    header
	    purpose
	    schemeId
		totalMsgCountRoot
		lastRootPostAt
	    cursor
	    props
	  }
	}
	`,
		}

		resp, err := th.MakeGraphQLRequest(&input)
		require.NoError(t, err)
		require.Len(t, resp.Errors, 0)
		require.NoError(t, json.Unmarshal(resp.Data, &q))
		assert.Len(t, q.Channels, 10)

		numPrivate := 0
		numPublic := 0
		numOffTopic := 0
		numTownSquare := 0
		for _, ch := range q.Channels {
			assert.NotEmpty(t, ch.ID)
			assert.NotEmpty(t, ch.Name)
			assert.NotEmpty(t, ch.Cursor)
			assert.NotEmpty(t, ch.PrettyDisplayName)
			assert.NotEmpty(t, ch.CreateAt)
			assert.NotEmpty(t, ch.UpdateAt)
			assert.NotNil(t, ch.Props)
			if ch.Type == model.ChannelTypeOpen {
				numPublic++
			} else if ch.Type == model.ChannelTypePrivate {
				numPrivate++
			}

			if ch.DisplayName == "Off-Topic" {
				numOffTopic++
			} else if ch.DisplayName == "Town Square" {
				numTownSquare++
			}
		}

		assert.Equal(t, 2, numPrivate)
		assert.Equal(t, 7, numPublic)
		assert.Equal(t, 2, numOffTopic)
		assert.Equal(t, 2, numTownSquare)
	})

	t.Run("user_perms", func(t *testing.T) {
		query := `query channels($userId: String = "") {
	  channels(userId: $userId) {
	  	id
	  	createAt
	  	updateAt
	  	type
	    cursor
	  }
	}
	`
		u1 := th.CreateUser()

		input := graphQLInput{
			OperationName: "channels",
			Query:         query,
			Variables: map[string]any{
				"userId": u1.Id,
			},
		}

		resp, err := th.MakeGraphQLRequest(&input)
		require.NoError(t, err)
		require.Len(t, resp.Errors, 1)
	})

	t.Run("pagination", func(t *testing.T) {
		query := `query channels($first: Int, $after: String = "") {
	  channels(userId: "me", first: $first, after: $after) {
	  	id
	  	createAt
	  	updateAt
	  	type
	    displayName
	    name
	    header
	    purpose
	    schemeId
	    cursor
	  }
	}
	`
		input := graphQLInput{
			OperationName: "channels",
			Query:         query,
			Variables: map[string]any{
				"first": 4,
			},
		}

		resp, err := th.MakeGraphQLRequest(&input)
		require.NoError(t, err)
		require.Len(t, resp.Errors, 0)
		require.NoError(t, json.Unmarshal(resp.Data, &q))
		assert.Len(t, q.Channels, 4)

		input = graphQLInput{
			OperationName: "channels",
			Query:         query,
			Variables: map[string]any{
				"first": 4,
				"after": q.Channels[3].Cursor,
			},
		}

		resp, err = th.MakeGraphQLRequest(&input)
		require.NoError(t, err)
		require.Len(t, resp.Errors, 0)
		require.NoError(t, json.Unmarshal(resp.Data, &q))
		assert.Len(t, q.Channels, 4)

		input = graphQLInput{
			OperationName: "channels",
			Query:         query,
			Variables: map[string]any{
				"first": 4,
				"after": q.Channels[3].Cursor,
			},
		}

		resp, err = th.MakeGraphQLRequest(&input)
		require.NoError(t, err)
		require.Len(t, resp.Errors, 0)
		require.NoError(t, json.Unmarshal(resp.Data, &q))
		assert.Len(t, q.Channels, 2)
	})

	t.Run("team_filter", func(t *testing.T) {
		query := `query channels($teamId: String, $first: Int) {
	  channels(userId: "me", teamId: $teamId, first: $first) {
	  	id
	  }
	}
	`
		input := graphQLInput{
			OperationName: "channels",
			Query:         query,
			Variables: map[string]any{
				"first":  10,
				"teamId": myTeam.Id,
			},
		}

		resp, err := th.MakeGraphQLRequest(&input)
		require.NoError(t, err)
		require.Len(t, resp.Errors, 0)
		require.NoError(t, json.Unmarshal(resp.Data, &q))
		assert.Len(t, q.Channels, 5)

		input = graphQLInput{
			OperationName: "channels",
			Query:         query,
			Variables: map[string]any{
				"first":  2,
				"teamId": myTeam.Id,
			},
		}

		resp, err = th.MakeGraphQLRequest(&input)
		require.NoError(t, err)
		require.Len(t, resp.Errors, 0)
		require.NoError(t, json.Unmarshal(resp.Data, &q))
		assert.Len(t, q.Channels, 2)
	})

	t.Run("team_data", func(t *testing.T) {
		query := `query channels($teamId: String, $first: Int) {
	  channels(userId: "me", teamId: $teamId, first: $first) {
	  	id
	  	team {
	  		id
	  		displayName
	  	}
	  }
	}
	`
		input := graphQLInput{
			OperationName: "channels",
			Query:         query,
			Variables: map[string]any{
				"first":  2,
				"teamId": myTeam.Id,
			},
		}

		resp, err := th.MakeGraphQLRequest(&input)
		require.NoError(t, err)
		require.Len(t, resp.Errors, 0)
		require.NoError(t, json.Unmarshal(resp.Data, &q))
		assert.Len(t, q.Channels, 2)

		// Iterating because one of them can be a DM channel.
		for _, ch := range q.Channels {
			if ch.Team.ID != "" {
				assert.Equal(t, myTeam.Id, ch.Team.ID)
				assert.Equal(t, myTeam.DisplayName, ch.Team.DisplayName)
			}
		}

	})

	t.Run("Delete+Update", func(t *testing.T) {
		query := `query channels($lastDeleteAt: Float = 0,
			$lastUpdateAt: Float = 0,
			$first: Int = 60,
			$includeDeleted: Boolean) {
	  channels(userId: "me", lastDeleteAt: $lastDeleteAt, lastUpdateAt: $lastUpdateAt, first: $first, includeDeleted: $includeDeleted) {
	  	id
	  }
	}
	`
		input := graphQLInput{
			OperationName: "channels",
			Query:         query,
			Variables: map[string]any{
				"includeDeleted": false,
			},
		}

		resp, err := th.MakeGraphQLRequest(&input)
		require.NoError(t, err)
		require.Len(t, resp.Errors, 0)
		require.NoError(t, json.Unmarshal(resp.Data, &q))
		assert.Len(t, q.Channels, 10)

		now := model.GetMillis()
		input = graphQLInput{
			OperationName: "channels",
			Query:         query,
			Variables: map[string]any{
				"includeDeleted": true,
				"lastUpdateAt":   float64(now),
			},
		}

		resp, err = th.MakeGraphQLRequest(&input)
		require.NoError(t, err)
		require.Len(t, resp.Errors, 1) // no channels found

		th.BasicChannel.Purpose = "newpurpose"
		_, _, err = th.Client.UpdateChannel(th.BasicChannel)
		require.NoError(t, err)

		input = graphQLInput{
			OperationName: "channels",
			Query:         query,
			Variables: map[string]any{
				"includeDeleted": true,
				"lastUpdateAt":   float64(now),
			},
		}

		resp, err = th.MakeGraphQLRequest(&input)
		require.NoError(t, err)
		require.Len(t, resp.Errors, 0)
		require.NoError(t, json.Unmarshal(resp.Data, &q))
		assert.Len(t, q.Channels, 1)

		_, err = th.Client.DeleteChannel(ch1.Id)
		require.NoError(t, err)

		_, err = th.Client.DeleteChannel(ch2.Id)
		require.NoError(t, err)

		input = graphQLInput{
			OperationName: "channels",
			Query:         query,
			Variables: map[string]any{
				"includeDeleted": false,
			},
		}

		resp, err = th.MakeGraphQLRequest(&input)
		require.NoError(t, err)
		require.Len(t, resp.Errors, 0)
		require.NoError(t, json.Unmarshal(resp.Data, &q))
		assert.Len(t, q.Channels, 8)

		input = graphQLInput{
			OperationName: "channels",
			Query:         query,
			Variables: map[string]any{
				"includeDeleted": true,
				"lastDeleteAt":   float64(model.GetMillis()),
			},
		}

		resp, err = th.MakeGraphQLRequest(&input)
		require.NoError(t, err)
		require.Len(t, resp.Errors, 0)
		require.NoError(t, json.Unmarshal(resp.Data, &q))
		assert.Len(t, q.Channels, 8)

		input = graphQLInput{
			OperationName: "channels",
			Query:         query,
			Variables: map[string]any{
				"includeDeleted": true,
				"lastDeleteAt":   float64(model.GetMillis()),
				"first":          5,
			},
		}

		resp, err = th.MakeGraphQLRequest(&input)
		require.NoError(t, err)
		require.Len(t, resp.Errors, 0)
		require.NoError(t, json.Unmarshal(resp.Data, &q))
		assert.Len(t, q.Channels, 5)
	})

	t.Run("stats", func(t *testing.T) {
		query := `query channels($teamId: String, $first: Int) {
	  channels(userId: "me", teamId: $teamId, first: $first) {
		id
		stats {
		  channelId
		  memberCount
		}
	  }
	}
	`
		input := graphQLInput{
			OperationName: "channels",
			Query:         query,
			Variables: map[string]any{
				"first":  10,
				"teamId": myTeam.Id,
			},
		}

		resp, err := th.MakeGraphQLRequest(&input)
		require.NoError(t, err)
		require.Len(t, resp.Errors, 0)
		require.NoError(t, json.Unmarshal(resp.Data, &q))
		require.Len(t, q.Channels, 3)
		for _, ch := range q.Channels {
			require.Equal(t, ch.ID, ch.Stats.ChannelId)
			count, appErr := th.App.GetChannelMemberCount(th.Context, ch.Stats.ChannelId)
			require.Nil(t, appErr)
			require.Equal(t, float64(count), ch.Stats.MemberCount)
		}
	})
}

func TestGetPrettyDNForUsers(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_GRAPHQL", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_GRAPHQL")
	t.Run("nickname_full_name", func(t *testing.T) {
		users := []*model.User{
			{
				Id:        "user1",
				Nickname:  "nick1",
				Username:  "user1",
				FirstName: "first1",
				LastName:  "last1",
			},
			{
				Id:        "user2",
				Nickname:  "nick2",
				Username:  "user2",
				FirstName: "first2",
				LastName:  "last2",
			},
		}
		assert.Equal(t, "nick2", getPrettyDNForUsers("nickname_full_name", users, "user1", map[string]string{}))

		users = []*model.User{
			{
				Id:        "user1",
				Username:  "user1",
				FirstName: "first1",
				LastName:  "last1",
			},
			{
				Id:        "user2",
				Username:  "user2",
				FirstName: "first2",
				LastName:  "last2",
			},
		}
		assert.Equal(t, "first2 last2", getPrettyDNForUsers("nickname_full_name", users, "user1", map[string]string{}))
	})

	t.Run("full_name", func(t *testing.T) {
		users := []*model.User{
			{
				Id:        "user1",
				Nickname:  "nick1",
				Username:  "user1",
				FirstName: "first1",
				LastName:  "last1",
			},
			{
				Id:        "user2",
				Nickname:  "nick2",
				Username:  "user2",
				FirstName: "first2",
				LastName:  "last2",
			},
		}
		assert.Equal(t, "first2 last2", getPrettyDNForUsers("full_name", users, "user1", map[string]string{}))

		users = []*model.User{
			{
				Id:       "user1",
				Username: "user1",
			},
			{
				Id:       "user2",
				Username: "user2",
			},
		}
		assert.Equal(t, "user2", getPrettyDNForUsers("full_name", users, "user1", map[string]string{}))
	})

	t.Run("username", func(t *testing.T) {
		users := []*model.User{
			{
				Id:        "user1",
				Nickname:  "nick1",
				Username:  "user1",
				FirstName: "first1",
				LastName:  "last1",
			},
			{
				Id:        "user2",
				Nickname:  "nick2",
				Username:  "user2",
				FirstName: "first2",
				LastName:  "last2",
			},
		}
		assert.Equal(t, "user2", getPrettyDNForUsers("username", users, "user1", map[string]string{}))
	})

	t.Run("cache", func(t *testing.T) {
		users := []*model.User{
			{
				Id:        "user1",
				Nickname:  "nick1",
				Username:  "user1",
				FirstName: "first1",
				LastName:  "last1",
			},
			{
				Id:        "user2",
				Nickname:  "nick2",
				Username:  "user2",
				FirstName: "first2",
				LastName:  "last2",
			},
		}

		cache := map[string]string{}
		assert.Equal(t, "first2 last2", getPrettyDNForUsers("full_name", users, "user1", cache))
		cache["user2"] = "teststring!!"
		assert.Equal(t, "teststring!!", getPrettyDNForUsers("full_name", users, "user1", cache))
	})

}

func TestChannelCursor(t *testing.T) {
	ch := channel{
		Channel: model.Channel{Id: "testid"},
	}
	cur := ch.Cursor()

	id, ok := parseChannelCursor(*cur)
	require.True(t, ok)
	assert.Equal(t, ch.Id, id)
}
