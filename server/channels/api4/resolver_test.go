// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/model"
)

func TestGraphQLConfig(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_GRAPHQL", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_GRAPHQL")

	th := Setup(t)
	th.LoginBasicWithGraphQL()
	defer th.TearDown()

	var q struct {
		Config map[string]string `json:"config"`
	}

	input := graphQLInput{
		OperationName: "config",
		Query: `
	query config {
	  config
	}
	`,
	}

	cfg, _, err := th.Client.GetOldClientConfig("")
	require.NoError(t, err)

	resp, err := th.MakeGraphQLRequest(&input)
	require.NoError(t, err)
	require.Len(t, resp.Errors, 0)
	require.NoError(t, json.Unmarshal(resp.Data, &q))
	assert.Equal(t, cfg, q.Config)
}

func TestGraphQLLicense(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_GRAPHQL", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_GRAPHQL")

	th := Setup(t)
	th.LoginBasicWithGraphQL()
	defer th.TearDown()

	var q struct {
		License map[string]string `json:"license"`
	}

	input := graphQLInput{
		OperationName: "license",
		Query: `
	query license {
	  license
	}
	`,
	}

	cfg, _, err := th.Client.GetOldClientLicense("")
	require.NoError(t, err)

	resp, err := th.MakeGraphQLRequest(&input)
	require.NoError(t, err)
	require.Len(t, resp.Errors, 0)
	require.NoError(t, json.Unmarshal(resp.Data, &q))
	assert.Equal(t, cfg, q.License)
}

func TestGraphQLChannelsLeft(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_GRAPHQL", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_GRAPHQL")

	th := Setup(t).InitBasic()
	defer th.TearDown()

	var q struct {
		ChannelsLeft []string `json:"channelsLeft"`
	}

	t.Run("NotLeft", func(t *testing.T) {
		input := graphQLInput{
			OperationName: "channelsLeft",
			Query: `
		query channelsLeft($userId: String = "me", $since: Float = 0.0) {
		  channelsLeft(userId: $userId, since: $since)
		}
		`,
		}

		resp, err := th.MakeGraphQLRequest(&input)
		require.NoError(t, err)
		require.Len(t, resp.Errors, 0)
		require.NoError(t, json.Unmarshal(resp.Data, &q))
		assert.Len(t, q.ChannelsLeft, 0)
	})

	t.Run("Left", func(t *testing.T) {
		_, err := th.Client.RemoveUserFromChannel(th.BasicChannel.Id, th.BasicUser.Id)
		require.NoError(t, err)

		input := graphQLInput{
			OperationName: "channelsLeft",
			Query: `
		query channelsLeft($userId: String = "me", $since: Float = 0.0) {
		  channelsLeft(userId: $userId, since: $since)
		}
		`,
		}

		resp, err := th.MakeGraphQLRequest(&input)
		require.NoError(t, err)
		require.Len(t, resp.Errors, 0)
		require.NoError(t, json.Unmarshal(resp.Data, &q))
		assert.Len(t, q.ChannelsLeft, 1)
	})

	t.Run("LeftAfterTime", func(t *testing.T) {
		input := graphQLInput{
			OperationName: "channelsLeft",
			Query: `
		query channelsLeft($userId: String = "me", $since: Float = 0.0) {
		  channelsLeft(userId: $userId, since: $since)
		}
		`,
			Variables: map[string]any{
				"since": model.GetMillis(),
			},
		}

		resp, err := th.MakeGraphQLRequest(&input)
		require.NoError(t, err)
		require.Len(t, resp.Errors, 0)
		require.NoError(t, json.Unmarshal(resp.Data, &q))
		assert.Len(t, q.ChannelsLeft, 0)
	})
}

func TestGraphQLRolesLoader(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_GRAPHQL", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_GRAPHQL")

	th := Setup(t).InitBasic()
	defer th.TearDown()

	var q struct {
		User struct {
			ID    string `json:"id"`
			Roles []struct {
				ID   string `json:"id"`
				Name string `json:"Name"`
			} `json:"roles"`
		} `json:"user"`
		ChannelMembers []struct {
			MsgCount float64 `json:"msgCount"`
			Roles    []struct {
				ID   string `json:"id"`
				Name string `json:"Name"`
			} `json:"roles"`
		} `json:"channelMembers"`
		TeamMembers []struct {
			SchemeUser bool `json:"schemeUser"`
			Roles      []struct {
				ID   string `json:"id"`
				Name string `json:"Name"`
			} `json:"roles"`
		}
	}

	input := graphQLInput{
		OperationName: "channelMembers",
		Query: `
	query channelMembers {
	user(id: "me") {
		id
		username
		roles {
			id
			name
		}
	}
	channelMembers(userId: "me") {
		msgCount
		roles {
			id
			name
		}
	}
	teamMembers(userId: "me") {
		schemeUser
		roles {
			id
			name
		}
	}
	}
	`,
	}

	resp, err := th.MakeGraphQLRequest(&input)
	require.NoError(t, err)
	require.Len(t, resp.Errors, 0)
	require.NoError(t, json.Unmarshal(resp.Data, &q))

	require.Len(t, q.User.Roles, 1)
	assert.Equal(t, "system_user", q.User.Roles[0].Name)

	require.Len(t, q.ChannelMembers, 5)
	for _, cm := range q.ChannelMembers {
		require.Len(t, cm.Roles, 1)
		assert.Equal(t, "channel_user", cm.Roles[0].Name)
	}

	require.Len(t, q.TeamMembers, 1)
	for _, tm := range q.TeamMembers {
		require.Len(t, tm.Roles, 1)
		assert.Equal(t, "team_user", tm.Roles[0].Name)
	}
}
