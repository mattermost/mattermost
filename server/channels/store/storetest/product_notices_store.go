// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/server/v7/channels/store"
	"github.com/mattermost/mattermost-server/server/v7/model"
)

func TestProductNoticesStore(t *testing.T, ss store.Store) {
	t.Run("TestAddViewed", func(t *testing.T) { testAddViewed(t, ss) })
	t.Run("TestUpdateViewed", func(t *testing.T) { testUpdateViewed(t, ss) })
	t.Run("TestClearOld", func(t *testing.T) { testClearOld(t, ss) })
}

func testAddViewed(t *testing.T, ss store.Store) {
	notices := []string{"noticeA", "noticeB"}
	defer ss.ProductNotices().Clear(notices)

	err := ss.ProductNotices().View("testuser", notices)
	require.NoError(t, err)
	err = ss.ProductNotices().View("testuser2", notices)
	require.NoError(t, err)

	res, err := ss.ProductNotices().GetViews("testuser")
	require.NoError(t, err)
	require.Len(t, res, 2)
}

func testUpdateViewed(t *testing.T, ss store.Store) {
	noticesA := []string{"noticeA", "noticeB"}
	noticesB := []string{"noticeB", "noticeC"}
	defer ss.ProductNotices().Clear(noticesA)
	defer ss.ProductNotices().Clear(noticesB)
	// mark two notices
	err := ss.ProductNotices().View("testuser", noticesA)
	require.NoError(t, err)
	// mark one old and one new
	err = ss.ProductNotices().View("testuser", noticesB)
	require.NoError(t, err)

	res, err := ss.ProductNotices().GetViews("testuser")
	require.NoError(t, err)
	require.Len(t, res, 3)

	// make sure that one B has two views
	require.Equal(t, res[0].Viewed, int32(1))
	require.Equal(t, res[1].Viewed, int32(2))
	require.Equal(t, res[2].Viewed, int32(1))

	// make sure that B's timestamp was updated
	require.GreaterOrEqual(t, res[1].Timestamp, res[0].Timestamp)
}

func testClearOld(t *testing.T, ss store.Store) {
	noticesA := []string{"noticeA", "noticeB"}
	defer ss.ProductNotices().Clear(noticesA)
	// mark two notices
	err := ss.ProductNotices().View("testuser", noticesA)
	require.NoError(t, err)

	err = ss.ProductNotices().ClearOldNotices(model.ProductNotices{
		{
			ID: "noticeA",
		},
		{
			ID: "noticeC",
		},
	})
	require.NoError(t, err)
	res, err := ss.ProductNotices().GetViews("testuser")
	require.NoError(t, err)
	require.Len(t, res, 1)

}
