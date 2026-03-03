// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func TestPostReadStatusStore(t *testing.T, _ request.CTX, ss store.Store, _ SqlStore) {
	t.Run("SaveMultipleEmpty", func(t *testing.T) { testPostReadStatusSaveMultipleEmpty(t, ss) })
	t.Run("SaveMultipleSingle", func(t *testing.T) { testPostReadStatusSaveMultipleSingle(t, ss) })
	t.Run("SaveMultipleBulk", func(t *testing.T) { testPostReadStatusSaveMultipleBulk(t, ss) })
	t.Run("SaveMultipleConflictDoNothing", func(t *testing.T) { testPostReadStatusSaveMultipleConflict(t, ss) })
	t.Run("SaveMultipleLargeBatch", func(t *testing.T) { testPostReadStatusSaveMultipleLargeBatch(t, ss) })
}

func testPostReadStatusSaveMultipleEmpty(t *testing.T, ss store.Store) {
	err := ss.PostReadStatus().SaveMultiple([]*model.PostReadStatus{})
	require.NoError(t, err)
}

func testPostReadStatusSaveMultipleSingle(t *testing.T, ss store.Store) {
	postID := model.NewId()
	userID := model.NewId()

	statuses := []*model.PostReadStatus{
		{PostId: postID, UserId: userID, CreateAt: model.GetMillis()},
	}

	err := ss.PostReadStatus().SaveMultiple(statuses)
	require.NoError(t, err)
}

func testPostReadStatusSaveMultipleBulk(t *testing.T, ss store.Store) {
	userID := model.NewId()
	now := model.GetMillis()

	statuses := make([]*model.PostReadStatus, 5)
	for i := range statuses {
		statuses[i] = &model.PostReadStatus{
			PostId:   model.NewId(),
			UserId:   userID,
			CreateAt: now,
		}
	}

	err := ss.PostReadStatus().SaveMultiple(statuses)
	require.NoError(t, err)
}

func testPostReadStatusSaveMultipleConflict(t *testing.T, ss store.Store) {
	postID := model.NewId()
	userID := model.NewId()
	now := model.GetMillis()

	statuses := []*model.PostReadStatus{
		{PostId: postID, UserId: userID, CreateAt: now},
	}

	err := ss.PostReadStatus().SaveMultiple(statuses)
	require.NoError(t, err)

	// Insert the same pair again — should not error due to ON CONFLICT DO NOTHING.
	err = ss.PostReadStatus().SaveMultiple(statuses)
	assert.NoError(t, err)
}

func testPostReadStatusSaveMultipleLargeBatch(t *testing.T, ss store.Store) {
	userID := model.NewId()
	now := model.GetMillis()

	statuses := make([]*model.PostReadStatus, 100)
	for i := range statuses {
		statuses[i] = &model.PostReadStatus{
			PostId:   model.NewId(),
			UserId:   userID,
			CreateAt: now,
		}
	}

	err := ss.PostReadStatus().SaveMultiple(statuses)
	require.NoError(t, err)
}
