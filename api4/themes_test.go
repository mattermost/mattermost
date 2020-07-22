// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"net/http"
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetAndSaveTheme(t *testing.T) {
	t.Run("should return a default theme", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		theme, resp := th.Client.GetTheme("default")

		require.Nil(t, resp.Error)
		assert.Equal(t, model.DefaultThemes["default"], theme)
	})

	t.Run("should return a custom system theme", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		theme, resp := th.Client.SaveTheme(&model.Theme{
			DisplayName: "My Theme",
		})

		require.Nil(t, resp.Error)
		require.NotNil(t, theme)
		require.NotEqual(t, "", theme.Id)

		received, resp := th.Client.GetTheme(theme.Id)

		require.Nil(t, resp.Error)
		assert.Equal(t, theme.Id, received.Id)
	})

	t.Run("should return not found for a non-existant theme", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		theme, resp := th.Client.GetTheme("not found")

		require.NotNil(t, resp.Error)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
		assert.Nil(t, theme)
	})
}

func TestDeleteTheme(t *testing.T) {
	t.Run("should delete a default theme", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		deleted, resp := th.Client.DeleteTheme("default")

		require.Nil(t, resp.Error)
		assert.True(t, deleted)

		theme, resp := th.Client.GetTheme("default")

		require.NotNil(t, resp.Error)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
		assert.Nil(t, theme)
	})

	t.Run("should delete a custom system theme", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		theme, resp := th.Client.SaveTheme(&model.Theme{
			DisplayName: "My Theme",
		})

		require.Nil(t, resp.Error)
		require.NotNil(t, theme)
		require.NotEqual(t, "", theme.Id)

		deleted, resp := th.Client.DeleteTheme(theme.Id)

		require.Nil(t, resp.Error)
		assert.True(t, deleted)

		received, resp := th.Client.GetTheme(theme.Id)

		require.NotNil(t, resp.Error)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
		assert.Nil(t, received)
	})

	t.Run("should return not found for a non-existant theme", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		deleted, resp := th.Client.DeleteTheme("not found")

		require.NotNil(t, resp.Error)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
		assert.False(t, deleted)
	})
}
