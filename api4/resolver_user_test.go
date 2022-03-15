// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"os"
	"sort"
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGraphQLUser(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_GRAPHQL", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_GRAPHQL")

	th := Setup(t).InitBasic()
	defer th.TearDown()

	var q struct {
		User struct {
			ID            string  `json:"id"`
			Username      string  `json:"username"`
			Email         string  `json:"email"`
			FirstName     string  `json:"firstName"`
			LastName      string  `json:"lastName"`
			NickName      string  `json:"nickname"`
			IsBot         bool    `json:"isBot"`
			IsSystemAdmin bool    `json:"isSystemAdmin"`
			CreateAt      float64 `json:"createAt"`
			CustomStatus  struct {
				Emoji     string    `json:"emoji"`
				Text      string    `json:"text"`
				Duration  string    `json:"duration"`
				ExpiresAt time.Time `json:"expiresAt"`
			} `json:"customStatus"`
			Timezone    model.StringMap `json:"timezone"`
			Props       model.StringMap `json:"props"`
			NotifyProps model.StringMap `json:"notifyProps"`
			Position    string          `json:"position"`
			Roles       []struct {
				ID            string   `json:"id"`
				Name          string   `json:"Name"`
				Permissions   []string `json:"permissions"`
				SchemeManaged bool     `json:"schemeManaged"`
				BuiltIn       bool     `json:"builtIn"`
			} `json:"roles"`
			Preferences []struct {
				UserID   string `json:"userId"`
				Category string `json:"category"`
				Name     string `json:"name"`
				Value    string `json:"value"`
			} `json:"preferences"`
			Sessions []struct {
				ID       string  `json:"id"`
				CreateAt float64 `json:"createAt"`
			} `json:"sessions"`
		} `json:"user"`
	}

	t.Run("Basic", func(t *testing.T) {
		input := graphQLInput{
			OperationName: "user",
			Query: `
	query user($id: String = "me") {
		user(id: $id) {
			id
			username
			email
			firstName
			lastName
			isBot
			isGuest
			isSystemAdmin
			timezone
			props
			notifyProps
			roles {
				id
				name
			}
			preferences {
				name
				value
			}
			sessions {
				id
				createAt
			}
		}
	}
	`,
		}

		resp, err := th.MakeGraphQLRequest(&input)
		require.NoError(t, err)
		require.Len(t, resp.Errors, 0)
		require.NoError(t, json.Unmarshal(resp.Data, &q))
		assert.Equal(t, th.BasicUser.Id, q.User.ID)
		assert.Equal(t, th.BasicUser.Username, q.User.Username)
		assert.Equal(t, th.BasicUser.Email, q.User.Email)
		assert.Equal(t, th.BasicUser.FirstName, q.User.FirstName)
		assert.Equal(t, th.BasicUser.IsBot, q.User.IsBot)
		assert.Equal(t, th.BasicUser.IsSystemAdmin(), q.User.IsSystemAdmin)
		assert.Equal(t, th.BasicUser.Timezone, q.User.Timezone)
		assert.Equal(t, th.BasicUser.Props, q.User.Props)
		assert.Equal(t, th.BasicUser.NotifyProps, q.User.NotifyProps)

		roles, _, err := th.Client.GetRolesByNames(th.BasicUser.GetRoles())
		require.NoError(t, err)

		assert.Len(t, q.User.Roles, 1)
		assert.Len(t, roles, 1)
		assert.Equal(t, roles[0].Id, q.User.Roles[0].ID)
		assert.Equal(t, roles[0].Name, q.User.Roles[0].Name)

		prefs, _, err := th.Client.GetPreferences(th.BasicUser.Id)
		require.NoError(t, err)

		sort.Slice(prefs, func(i, j int) bool {
			return prefs[i].Name < prefs[j].Name
		})

		sort.Slice(q.User.Preferences, func(i, j int) bool {
			return q.User.Preferences[i].Name < q.User.Preferences[j].Name
		})

		for i := range prefs {
			assert.Equal(t, q.User.Preferences[i].Name, prefs[i].Name)
			assert.Equal(t, q.User.Preferences[i].Value, prefs[i].Value)
		}

		assert.Len(t, q.User.Sessions, 2)
		now := float64(model.GetMillis())
		for _, session := range q.User.Sessions {
			assert.NotEmpty(t, session.ID)
			assert.Less(t, session.CreateAt, now)
		}
	})

	t.Run("Update", func(t *testing.T) {
		th.BasicUser.Props = map[string]string{"testpropkey": "testpropvalue"}
		th.App.UpdateUser(th.BasicUser, false)

		input := graphQLInput{
			OperationName: "user",
			Query: `
		query user($id: String = "me") {
		  user(id: $id) {
		  	id
		  	props
		  }
		}
		`,
		}

		resp, err := th.MakeGraphQLRequest(&input)
		require.NoError(t, err)
		require.Len(t, resp.Errors, 0)
		require.NoError(t, json.Unmarshal(resp.Data, &q))

		assert.Equal(t, th.BasicUser.Props, q.User.Props)
	})

	t.Run("DifferentUser", func(t *testing.T) {
		input := graphQLInput{
			OperationName: "user",
			Query: `
	query user($id: String = "me") {
	  user(id: $id) {
	  	id
	  	props
	  }
	}
	`,
			Variables: map[string]interface{}{
				"id": th.BasicUser2.Id,
			},
		}

		resp, err := th.MakeGraphQLRequest(&input)
		require.NoError(t, err)
		require.Len(t, resp.Errors, 0)
		require.NoError(t, json.Unmarshal(resp.Data, &q))

		assert.Equal(t, q.User.ID, th.BasicUser2.Id)
	})

	t.Run("BadUser", func(t *testing.T) {
		id := model.NewId()
		input := graphQLInput{
			OperationName: "user",
			Query: `
	query user($id: String = "me") {
	  user(id: $id) {
	  	id
	  	props
	  }
	}
	`,
			Variables: map[string]interface{}{
				"id": id,
			},
		}

		resp, err := th.MakeGraphQLRequest(&input)
		require.NoError(t, err)
		require.Len(t, resp.Errors, 1)
	})
}
