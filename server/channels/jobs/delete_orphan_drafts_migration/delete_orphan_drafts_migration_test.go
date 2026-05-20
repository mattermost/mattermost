// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package delete_orphan_drafts_migration

import (
	"errors"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestJobMetadata(t *testing.T) {
	t.Run("parse nil data", func(t *testing.T) {
		var data model.StringMap
		createAt, userID, err := parseJobMetadata(data)
		require.NoError(t, err)
		assert.Empty(t, createAt)
		assert.Empty(t, userID)
	})

	t.Run("parse invalid create_at", func(t *testing.T) {
		data := make(model.StringMap)
		data["user_id"] = "user_id"
		data["create_at"] = "invalid"
		_, _, err := parseJobMetadata(data)
		require.Error(t, err)
	})

	t.Run("parse valid", func(t *testing.T) {
		data := make(model.StringMap)
		data["user_id"] = "user_id"
		data["create_at"] = "1695918431"

		createAt, userID, err := parseJobMetadata(data)
		require.NoError(t, err)
		assert.EqualValues(t, 1695918431, createAt)
		assert.Equal(t, "user_id", userID)
	})

	t.Run("parse/make", func(t *testing.T) {
		data := makeJobMetadata(1695918431, "user_id")
		assert.Equal(t, "1695918431", data["create_at"])
		assert.Equal(t, "user_id", data["user_id"])

		createAt, userID, err := parseJobMetadata(data)
		require.NoError(t, err)
		assert.EqualValues(t, 1695918431, createAt)
		assert.Equal(t, "user_id", userID)
	})
}

func TestDoDeleteOrphanDraftsMigrationBatch(t *testing.T) {
	t.Run("invalid job metadata", func(t *testing.T) {
		mockStore := &storetest.Store{}
		t.Cleanup(func() {
			mockStore.AssertExpectations(t)
		})

		data := make(model.StringMap)
		data["user_id"] = "user_id"
		data["create_at"] = "invalid"
		data, done, err := doDeleteOrphanDraftsMigrationBatch(data, mockStore)
		require.Error(t, err)
		assert.False(t, done)
		assert.Nil(t, data)
	})

	t.Run("failure getting next offset", func(t *testing.T) {
		mockStore := &storetest.Store{}
		t.Cleanup(func() {
			mockStore.AssertExpectations(t)
		})

		createAt, userID := int64(1695920000), "user_id_1"
		nextCreateAt, nextUserID := int64(0), ""

		mockStore.DraftStore.On("GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration", createAt, userID).Return(nextCreateAt, nextUserID, errors.New("failure"))

		data, done, err := doDeleteOrphanDraftsMigrationBatch(makeJobMetadata(createAt, userID), mockStore)
		require.EqualError(t, err, "failed to get the next batch (create_at=1695920000, user_id=user_id_1): failure")
		assert.False(t, done)
		assert.Nil(t, data)
	})

	t.Run("failure deleting batch", func(t *testing.T) {
		mockStore := &storetest.Store{}
		t.Cleanup(func() {
			mockStore.AssertExpectations(t)
		})

		createAt, userID := int64(1695920000), "user_id_1"
		nextCreateAt, nextUserID := int64(1695922034), "user_id_2"

		mockStore.DraftStore.On("GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration", createAt, userID).Return(nextCreateAt, nextUserID, nil)
		mockStore.DraftStore.On("DeleteOrphanDraftsByCreateAtAndUserId", createAt, userID).Return(errors.New("failure"))

		data, done, err := doDeleteOrphanDraftsMigrationBatch(makeJobMetadata(createAt, userID), mockStore)
		require.EqualError(t, err, "failed to delete orphan drafts (create_at=1695920000, user_id=user_id_1): failure")
		assert.False(t, done)
		assert.Nil(t, data)
	})

	t.Run("do first batch (nil job metadata)", func(t *testing.T) {
		mockStore := &storetest.Store{}
		t.Cleanup(func() {
			mockStore.AssertExpectations(t)
		})

		createAt, userID := int64(0), ""
		nextCreateAt, nextUserID := int64(1695922034), "user_id_2"

		mockStore.DraftStore.On("GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration", createAt, userID).Return(nextCreateAt, nextUserID, nil)
		mockStore.DraftStore.On("DeleteOrphanDraftsByCreateAtAndUserId", createAt, userID).Return(nil)

		data, done, err := doDeleteOrphanDraftsMigrationBatch(nil, mockStore)
		require.NoError(t, err)
		assert.False(t, done)
		assert.Equal(t, model.StringMap{
			"create_at": "1695922034",
			"user_id":   "user_id_2",
		}, data)
	})

	t.Run("do first batch (empty job metadata)", func(t *testing.T) {
		mockStore := &storetest.Store{}
		t.Cleanup(func() {
			mockStore.AssertExpectations(t)
		})

		createAt, userID := int64(0), ""
		nextCreateAt, nextUserID := int64(1695922034), "user_id_2"

		mockStore.DraftStore.On("GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration", createAt, userID).Return(nextCreateAt, nextUserID, nil)
		mockStore.DraftStore.On("DeleteOrphanDraftsByCreateAtAndUserId", createAt, userID).Return(nil)

		data, done, err := doDeleteOrphanDraftsMigrationBatch(model.StringMap{}, mockStore)
		require.NoError(t, err)
		assert.False(t, done)
		assert.Equal(t, makeJobMetadata(nextCreateAt, nextUserID), data)
	})

	t.Run("do batch", func(t *testing.T) {
		mockStore := &storetest.Store{}
		t.Cleanup(func() {
			mockStore.AssertExpectations(t)
		})

		createAt, userID := int64(1695922000), "user_id_1"
		nextCreateAt, nextUserID := int64(1695922034), "user_id_2"

		mockStore.DraftStore.On("GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration", createAt, userID).Return(nextCreateAt, nextUserID, nil)
		mockStore.DraftStore.On("DeleteOrphanDraftsByCreateAtAndUserId", createAt, userID).Return(nil)

		data, done, err := doDeleteOrphanDraftsMigrationBatch(makeJobMetadata(createAt, userID), mockStore)
		require.NoError(t, err)
		assert.False(t, done)
		assert.Equal(t, makeJobMetadata(nextCreateAt, nextUserID), data)
	})

	t.Run("done batches", func(t *testing.T) {
		mockStore := &storetest.Store{}
		t.Cleanup(func() {
			mockStore.AssertExpectations(t)
		})

		createAt, userID := int64(1695922000), "user_id_1"
		nextCreateAt, nextUserID := int64(0), ""

		mockStore.DraftStore.On("GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration", createAt, userID).Return(nextCreateAt, nextUserID, nil)

		data, done, err := doDeleteOrphanDraftsMigrationBatch(makeJobMetadata(createAt, userID), mockStore)
		require.NoError(t, err)
		assert.True(t, done)
		assert.Nil(t, data)
	})
}
