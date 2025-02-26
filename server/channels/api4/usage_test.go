// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestGetPostsUsage(t *testing.T) {
	t.Run("unauthenticated users can not access", func(t *testing.T) {
		th := Setup(t)
		defer th.TearDown()

		_, err := th.Client.Logout(context.Background())
		require.NoError(t, err)

		usage, r, err := th.Client.GetPostsUsage(context.Background())
		assert.Error(t, err)
		assert.Nil(t, usage)
		assert.Equal(t, http.StatusUnauthorized, r.StatusCode)
	})

	t.Run("good request returns response", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		for i := 0; i < 14; i++ {
			th.CreatePost()
		}

		total, err := th.Server.Store().Post().AnalyticsPostCount(&model.PostCountOptions{ExcludeDeleted: true})
		require.NoError(t, err)
		usersOnly, err := th.Server.Store().Post().AnalyticsPostCount(&model.PostCountOptions{ExcludeDeleted: true, UsersPostsOnly: true})
		require.NoError(t, err)

		require.GreaterOrEqual(t, usersOnly, int64(14))
		require.LessOrEqual(t, usersOnly, int64(20))
		require.GreaterOrEqual(t, total, usersOnly)

		usage, r, err := th.Client.GetPostsUsage(context.Background())
		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, r.StatusCode)
		assert.NotNil(t, usage)
		assert.Equal(t, int64(10), usage.Count)
	})
}

func TestGetStorageUsage(t *testing.T) {
	t.Run("unauthenticated users cannot access", func(t *testing.T) {
		th := Setup(t)
		defer th.TearDown()

		_, err := th.Client.Logout(context.Background())
		require.NoError(t, err)

		usage, r, err := th.Client.GetStorageUsage(context.Background())
		assert.Error(t, err)
		assert.Nil(t, usage)
		assert.Equal(t, http.StatusUnauthorized, r.StatusCode)
	})
}

func TestGetTeamsUsage(t *testing.T) {
	t.Run("unauthenticated users can not access", func(t *testing.T) {
		th := Setup(t)
		defer th.TearDown()

		_, err := th.Client.Logout(context.Background())
		require.NoError(t, err)

		usage, r, err := th.Client.GetTeamsUsage(context.Background())
		assert.Error(t, err)
		assert.Nil(t, usage)
		assert.Equal(t, http.StatusUnauthorized, r.StatusCode)
	})

	t.Run("good request returns response", func(t *testing.T) {
		// Following calls create a total of 3 teams
		th := Setup(t).InitBasic()
		defer th.TearDown()
		th.CreateTeam()
		th.CreateTeam()

		usage, r, err := th.Client.GetTeamsUsage(context.Background())
		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, r.StatusCode)
		assert.NotNil(t, usage)
		assert.Equal(t, int64(3), usage.Active)
	})
}
