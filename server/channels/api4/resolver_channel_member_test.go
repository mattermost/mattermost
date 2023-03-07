// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/server/v8/model"
)

func TestGraphQLChannelMembers(t *testing.T) {
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

	// Creating some msgcount
	th.CreateMessagePostWithClient(th.Client, th.BasicChannel, "basic post")
	th.CreateMessagePostWithClient(th.Client, ch1, "ch1 post")

	var q struct {
		ChannelMembers []struct {
			Channel struct {
				ID          string            `json:"id"`
				CreateAt    float64           `json:"createAt"`
				UpdateAt    float64           `json:"updateAt"`
				Type        model.ChannelType `json:"type"`
				DisplayName string            `json:"displayName"`
				Name        string            `json:"name"`
				Header      string            `json:"header"`
				Purpose     string            `json:"purpose"`
				Team        struct {
					ID string `json:"id"`
				} `json:"team"`
			} `json:"channel"`
			User struct {
				ID        string `json:"id"`
				Username  string `json:"username"`
				Email     string `json:"email"`
				FirstName string `json:"firstName"`
				LastName  string `json:"lastName"`
				NickName  string `json:"nickname"`
			} `json:"user"`
			Roles []struct {
				ID            string   `json:"id"`
				Name          string   `json:"Name"`
				Permissions   []string `json:"permissions"`
				SchemeManaged bool     `json:"schemeManaged"`
				BuiltIn       bool     `json:"builtIn"`
			} `json:"roles"`
			LastViewedAt       float64         `json:"lastViewedAt"`
			LastUpdateAt       float64         `json:"lastUpdateAt"`
			MsgCount           float64         `json:"msgCount"`
			MentionCount       float64         `json:"mentionCount"`
			MentionCountRoot   float64         `json:"mentionCountRoot"`
			UrgentMentionCount float64         `json:"urgentMentionCount"`
			MsgCountRoot       float64         `json:"msgCountRoot"`
			NotifyProps        model.StringMap `json:"notifyProps"`
			SchemeGuest        bool            `json:"schemeGuest"`
			SchemeUser         bool            `json:"schemeUser"`
			SchemeAdmin        bool            `json:"schemeAdmin"`
			Cursor             string          `json:"cursor"`
		} `json:"channelMembers"`
	}

	t.Run("all", func(t *testing.T) {
		input := graphQLInput{
			OperationName: "channelMembers",
			Query: `
	query channelMembers {
	  channelMembers(userId: "me") {
	  	channel {
		  	id
		  	createAt
		  	updateAt
		  	type
		    displayName
		    name
		    header
		    team {
		    	id
		    }
	  	}
	  	user {
	  		id
	  		username
	  		email
	  	}
	  	msgCount
	  	mentionCount
	  	mentionCountRoot
			urgentMentionCount
		msgCountRoot
	  	schemeGuest
	  	schemeUser
	  	schemeAdmin
	  	cursor
	  }
	}
	`,
		}

		resp, err := th.MakeGraphQLRequest(&input)
		require.NoError(t, err)
		require.Len(t, resp.Errors, 0)
		require.NoError(t, json.Unmarshal(resp.Data, &q))
		assert.Len(t, q.ChannelMembers, 9)

		numPrivate := 0
		numPublic := 0
		numOffTopic := 0
		numTownSquare := 0
		for _, ch := range q.ChannelMembers {
			assert.NotEmpty(t, ch.Channel.ID)
			assert.NotEmpty(t, ch.Channel.Name)
			assert.NotEmpty(t, ch.Channel.CreateAt)
			assert.NotEmpty(t, ch.Channel.UpdateAt)
			if ch.Channel.Type == model.ChannelTypeOpen {
				numPublic++
			} else if ch.Channel.Type == model.ChannelTypePrivate {
				numPrivate++
			}

			if ch.Channel.DisplayName == "Off-Topic" {
				numOffTopic++
			} else if ch.Channel.DisplayName == "Town Square" {
				numTownSquare++
			}

			assert.Equal(t, th.BasicUser.Id, ch.User.ID)
			assert.Equal(t, th.BasicUser.Username, ch.User.Username)
			assert.Equal(t, th.BasicUser.Email, ch.User.Email)

			assert.False(t, ch.SchemeGuest)

			if ch.Channel.Team.ID == myTeam.Id {
				assert.True(t, ch.SchemeAdmin)
			} else {
				assert.False(t, ch.SchemeAdmin)
			}
			assert.True(t, ch.SchemeUser)

			assert.NotEmpty(t, ch.Cursor)

			switch ch.Channel.ID {
			case th.BasicChannel.Id:
				assert.Equal(t, float64(2), ch.MsgCount)
			case ch1.Id:
				assert.Equal(t, float64(1), ch.MsgCount)
			}
		}

		assert.Equal(t, 2, numPrivate)
		assert.Equal(t, 7, numPublic)
		assert.Equal(t, 2, numOffTopic)
		assert.Equal(t, 2, numTownSquare)
	})

	t.Run("user_perms", func(t *testing.T) {
		input := graphQLInput{
			OperationName: "channelMembers",
			Query: `
	query channelMembers($user: String!) {
	  channelMembers(userId: $user) {
	  	channel {
		  	id
		  	createAt
		  	updateAt
	  	}
	  	msgCount
	  	mentionCount
	  	mentionCountRoot
			urgentMentionCount
	  }
	}
	`,
			Variables: map[string]any{
				"user": model.NewId(),
			},
		}

		resp, err := th.MakeGraphQLRequest(&input)
		require.NoError(t, err)
		require.Len(t, resp.Errors, 1)
	})

	t.Run("pagination", func(t *testing.T) {
		query := `query channelMembers($first: Int, $after: String = "") {
	  channelMembers(userId: "me", first: $first, after: $after) {
	  	channel {
		  	id
		  	createAt
		  	updateAt
		  	type
		    displayName
		    name
		    header
	  	}
	  	cursor
	  }
	}
	`
		input := graphQLInput{
			OperationName: "channelMembers",
			Query:         query,
			Variables: map[string]any{
				"first": 4,
			},
		}

		resp, err := th.MakeGraphQLRequest(&input)
		require.NoError(t, err)
		require.Len(t, resp.Errors, 0)
		require.NoError(t, json.Unmarshal(resp.Data, &q))
		assert.Len(t, q.ChannelMembers, 4)

		input = graphQLInput{
			OperationName: "channelMembers",
			Query:         query,
			Variables: map[string]any{
				"first": 4,
				"after": q.ChannelMembers[3].Cursor,
			},
		}

		resp, err = th.MakeGraphQLRequest(&input)
		require.NoError(t, err)
		require.Len(t, resp.Errors, 0)
		require.NoError(t, json.Unmarshal(resp.Data, &q))
		assert.Len(t, q.ChannelMembers, 4)

		input = graphQLInput{
			OperationName: "channelMembers",
			Query:         query,
			Variables: map[string]any{
				"first": 4,
				"after": q.ChannelMembers[3].Cursor,
			},
		}

		resp, err = th.MakeGraphQLRequest(&input)
		require.NoError(t, err)
		require.Len(t, resp.Errors, 0)
		require.NoError(t, json.Unmarshal(resp.Data, &q))
		assert.Len(t, q.ChannelMembers, 1)
	})

	t.Run("channel_filter", func(t *testing.T) {
		query := `query channelMembers($channelId: String, $first: Int, $after: String = "") {
	  channelMembers(userId: "me", channelId: $channelId, first: $first, after: $after) {
	  	channel {
		  	id
	  	}
	  }
	}
	`
		input := graphQLInput{
			OperationName: "channelMembers",
			Query:         query,
			Variables: map[string]any{
				"channelId": ch1.Id,
				"first":     4,
			},
		}

		resp, err := th.MakeGraphQLRequest(&input)
		require.NoError(t, err)
		require.Len(t, resp.Errors, 0)
		require.NoError(t, json.Unmarshal(resp.Data, &q))
		assert.Len(t, q.ChannelMembers, 1)
		assert.Equal(t, q.ChannelMembers[0].Channel.ID, ch1.Id)

		input = graphQLInput{
			OperationName: "channelMembers",
			Query:         query,
			Variables: map[string]any{
				"channelId": model.NewId(),
				"first":     3,
			},
		}

		resp, err = th.MakeGraphQLRequest(&input)
		require.NoError(t, err)
		require.Len(t, resp.Errors, 1)
	})

	t.Run("team_filter", func(t *testing.T) {
		query := `query channelMembers($teamId: String, $excludeTeam: Boolean = false) {
	  channelMembers(userId: "me", teamId: $teamId, excludeTeam: $excludeTeam) {
	  	channel {
		  	id
	  	}
	  }
	}
	`
		input := graphQLInput{
			OperationName: "channelMembers",
			Query:         query,
			Variables: map[string]any{
				"teamId": th.BasicTeam.Id,
			},
		}

		resp, err := th.MakeGraphQLRequest(&input)
		require.NoError(t, err)
		require.Len(t, resp.Errors, 0)
		require.NoError(t, json.Unmarshal(resp.Data, &q))
		assert.Len(t, q.ChannelMembers, 5)

		input = graphQLInput{
			OperationName: "channelMembers",
			Query:         query,
			Variables: map[string]any{
				"teamId":      th.BasicTeam.Id,
				"excludeTeam": true,
			},
		}

		resp, err = th.MakeGraphQLRequest(&input)
		require.NoError(t, err)
		require.Len(t, resp.Errors, 0)
		require.NoError(t, json.Unmarshal(resp.Data, &q))
		assert.Len(t, q.ChannelMembers, 4)
	})

	t.Run("UpdateAt", func(t *testing.T) {
		query := `query channelMembers($first: Int, $after: String = "", $lastUpdateAt: Float) {
	  channelMembers(userId: "me", first: $first, after: $after, lastUpdateAt: $lastUpdateAt) {
	  	channel {
		  	id
	  	}
		lastUpdateAt
	  	cursor
	  }
	}
	`

		now := model.GetMillis()
		input := graphQLInput{
			OperationName: "channelMembers",
			Query:         query,
			Variables: map[string]any{
				"first":        4,
				"lastUpdateAt": float64(now),
			},
		}

		resp, err := th.MakeGraphQLRequest(&input)
		require.NoError(t, err)
		require.Len(t, resp.Errors, 0)
		require.NoError(t, json.Unmarshal(resp.Data, &q))
		require.Len(t, q.ChannelMembers, 0)

		// Create post to update the lastUpdateAt for the channel member.
		th.CreateMessagePostWithClient(th.Client, th.BasicChannel, "another post")

		input = graphQLInput{
			OperationName: "channelMembers",
			Query:         query,
			Variables: map[string]any{
				"first":        4,
				"lastUpdateAt": float64(now),
			},
		}

		resp, err = th.MakeGraphQLRequest(&input)
		require.NoError(t, err)
		require.Len(t, resp.Errors, 0)
		require.NoError(t, json.Unmarshal(resp.Data, &q))
		require.Len(t, q.ChannelMembers, 1)
		assert.Equal(t, th.BasicChannel.Id, q.ChannelMembers[0].Channel.ID)
		assert.GreaterOrEqual(t, q.ChannelMembers[0].LastUpdateAt, float64(now))
	})
}

func TestChannelMemberCursor(t *testing.T) {
	ch := channelMember{
		ChannelMember: model.ChannelMember{ChannelId: "testid", UserId: "userid"},
	}
	cur := ch.Cursor()

	chId, userId, ok := parseChannelMemberCursor(*cur)
	require.True(t, ok)
	assert.Equal(t, ch.ChannelId, chId)
	assert.Equal(t, ch.UserId, userId)
}
