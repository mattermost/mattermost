// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestRecentSearchesAPI(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client

	t.Run("GET me returns empty items", func(t *testing.T) {
		list, resp, err := client.GetRecentSearches(context.Background(), "me")
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotNil(t, list)
		require.NotNil(t, list.Items)
		require.Empty(t, list.Items)
	})

	t.Run("GET other user is 403", func(t *testing.T) {
		_, resp, err := client.GetRecentSearches(context.Background(), th.BasicUser2.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("POST me and GET shows item first", func(t *testing.T) {
		saved, resp, err := client.SaveRecentSearch(context.Background(), "me", &model.RecentSearch{
			Terms:      "hello from:me",
			SearchType: model.RecentSearchTypeMessages,
			TeamId:     th.BasicTeam.Id,
		})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Equal(t, "hello from:me", saved.Terms)
		require.Equal(t, th.BasicUser.Id, saved.UserId)

		list, resp, err := client.GetRecentSearches(context.Background(), th.BasicUser.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotEmpty(t, list.Items)
		require.Equal(t, saved.Id, list.Items[0].Id)
	})

	t.Run("POST other user is 403", func(t *testing.T) {
		_, resp, err := client.SaveRecentSearch(context.Background(), th.BasicUser2.Id, &model.RecentSearch{
			Terms:      "nope",
			SearchType: model.RecentSearchTypeMessages,
		})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("POST invalid type is 400", func(t *testing.T) {
		_, resp, err := client.SaveRecentSearch(context.Background(), "me", &model.RecentSearch{
			Terms:      "hello",
			SearchType: "channels",
		})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("DELETE owner then 404 on missing", func(t *testing.T) {
		saved, _, err := client.SaveRecentSearch(context.Background(), "me", &model.RecentSearch{
			Terms:      "delete me",
			SearchType: model.RecentSearchTypeFiles,
		})
		require.NoError(t, err)

		resp, err := client.DeleteRecentSearch(context.Background(), "me", saved.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		resp, err = client.DeleteRecentSearch(context.Background(), "me", saved.Id)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("unauthenticated is 401", func(t *testing.T) {
		_, err := client.Logout(context.Background())
		require.NoError(t, err)
		_, resp, err := client.GetRecentSearches(context.Background(), "me")
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}
