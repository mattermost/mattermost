// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func TestRecentSearchStore(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	t.Run("SaveUpsert", func(t *testing.T) { testRecentSearchSaveUpsert(t, rctx, ss) })
	t.Run("RetainFive", func(t *testing.T) { testRecentSearchRetainFive(t, rctx, ss) })
	t.Run("TrimTerms", func(t *testing.T) { testRecentSearchTrimTerms(t, rctx, ss) })
	t.Run("OwnerScopedDelete", func(t *testing.T) { testRecentSearchOwnerScopedDelete(t, rctx, ss) })
}

func newRecentSearch(userID, terms, searchType, teamID string) *model.RecentSearch {
	rs := &model.RecentSearch{
		UserId:     userID,
		Terms:      terms,
		SearchType: searchType,
		TeamId:     teamID,
	}
	rs.PreSave()
	return rs
}

func testRecentSearchSaveUpsert(t *testing.T, rctx request.CTX, ss store.Store) {
	userID := model.NewId()
	teamID := model.NewId()

	first, err := ss.RecentSearch().Save(newRecentSearch(userID, "hello from:me", model.RecentSearchTypeMessages, teamID))
	require.NoError(t, err)
	require.NotEmpty(t, first.Id)

	time.Sleep(2 * time.Millisecond)

	second, err := ss.RecentSearch().Save(newRecentSearch(userID, "hello from:me", model.RecentSearchTypeMessages, teamID))
	require.NoError(t, err)
	require.Equal(t, first.Id, second.Id)
	require.GreaterOrEqual(t, second.UpdateAt, first.UpdateAt)

	list, err := ss.RecentSearch().GetByUser(userID, model.RecentSearchLimit)
	require.NoError(t, err)
	require.Len(t, list, 1)
	require.Equal(t, first.Id, list[0].Id)
	require.Equal(t, "hello from:me", list[0].Terms)
}

func testRecentSearchRetainFive(t *testing.T, rctx request.CTX, ss store.Store) {
	userID := model.NewId()

	var saved []*model.RecentSearch
	for i := range 6 {
		item, err := ss.RecentSearch().Save(newRecentSearch(userID, "query-"+model.NewId(), model.RecentSearchTypeMessages, ""))
		require.NoError(t, err)
		saved = append(saved, item)
		if i < 5 {
			time.Sleep(2 * time.Millisecond)
		}
	}

	list, err := ss.RecentSearch().GetByUser(userID, model.RecentSearchLimit)
	require.NoError(t, err)
	require.Len(t, list, 5)

	ids := map[string]bool{}
	for _, item := range list {
		ids[item.Id] = true
	}
	require.False(t, ids[saved[0].Id], "oldest search should be pruned")
	require.True(t, ids[saved[5].Id], "newest search should be kept")
}

func testRecentSearchTrimTerms(t *testing.T, rctx request.CTX, ss store.Store) {
	userID := model.NewId()
	rs := newRecentSearch(userID, "  spaced terms  ", model.RecentSearchTypeFiles, "")
	require.Equal(t, "spaced terms", rs.Terms)

	saved, err := ss.RecentSearch().Save(rs)
	require.NoError(t, err)
	require.Equal(t, "spaced terms", saved.Terms)

	list, err := ss.RecentSearch().GetByUser(userID, model.RecentSearchLimit)
	require.NoError(t, err)
	require.Len(t, list, 1)
	require.Equal(t, "spaced terms", list[0].Terms)
}

func testRecentSearchOwnerScopedDelete(t *testing.T, rctx request.CTX, ss store.Store) {
	ownerID := model.NewId()
	otherID := model.NewId()

	saved, err := ss.RecentSearch().Save(newRecentSearch(ownerID, "only mine", model.RecentSearchTypeMessages, ""))
	require.NoError(t, err)

	err = ss.RecentSearch().Delete(otherID, saved.Id)
	require.Error(t, err)
	var nf *store.ErrNotFound
	require.ErrorAs(t, err, &nf)

	list, err := ss.RecentSearch().GetByUser(ownerID, model.RecentSearchLimit)
	require.NoError(t, err)
	require.Len(t, list, 1)

	err = ss.RecentSearch().Delete(ownerID, saved.Id)
	require.NoError(t, err)

	list, err = ss.RecentSearch().GetByUser(ownerID, model.RecentSearchLimit)
	require.NoError(t, err)
	require.Empty(t, list)

	err = ss.RecentSearch().Delete(ownerID, saved.Id)
	require.Error(t, err)
	require.ErrorAs(t, err, &nf)
}
