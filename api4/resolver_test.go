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
			Variables: map[string]interface{}{
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
