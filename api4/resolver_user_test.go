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
			DeleteAt      float64 `json:"deleteAt"`
			UpdateAt      float64 `json:"updateAt"`
			AuthData      *string `json:"authData"`
			EmailVerified bool    `json:"emailVerified"`
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
				CreateAt      float64  `json:"createAt"`
				DeleteAt      float64  `json:"deleteAt"`
				UpdateAt      float64  `json:"updateAt"`
			} `json:"roles"`
			Preferences []struct {
				UserID   string `json:"userId"`
				Category string `json:"category"`
				Name     string `json:"name"`
				Value    string `json:"value"`
			} `json:"preferences"`
			Sessions []struct {
				ID             string  `json:"id"`
				CreateAt       float64 `json:"createAt"`
				LastActivityAt float64 `json:"lastActivityAt"`
				DeviceId       string  `json:"deviceId"`
				Roles          string  `json:"roles"`
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
			createAt
			updateAt
			deleteAt
			firstName
			lastName
			emailVerified
			isBot
			isGuest
			isSystemAdmin
			timezone
			props
			notifyProps
			roles {
				id
				name
				createAt
				updateAt
				deleteAt
			}
			preferences {
				name
				value
			}
			sessions {
				id
				createAt
				lastActivityAt
				roles
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
		assert.Equal(t, float64(th.BasicUser.CreateAt), q.User.CreateAt)
		assert.Equal(t, float64(th.BasicUser.DeleteAt), q.User.DeleteAt)
		assert.NotZero(t, q.User.UpdateAt)
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
		assert.Equal(t, float64(roles[0].CreateAt), q.User.Roles[0].CreateAt)
		assert.Equal(t, float64(roles[0].UpdateAt), q.User.Roles[0].UpdateAt)
		assert.Equal(t, float64(roles[0].DeleteAt), q.User.Roles[0].DeleteAt)

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
			assert.Less(t, session.LastActivityAt, now)
			assert.Equal(t, model.SystemUserRoleId, session.Roles)
		}
	})

	t.Run("Update", func(t *testing.T) {
		th.BasicUser.Props = map[string]string{"testpropkey": "testpropvalue"}
		th.App.UpdateUser(th.Context, th.BasicUser, false)

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
			Variables: map[string]any{
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
			Variables: map[string]any{
				"id": id,
			},
		}

		resp, err := th.MakeGraphQLRequest(&input)
		require.NoError(t, err)
		require.Len(t, resp.Errors, 1)
	})
}
