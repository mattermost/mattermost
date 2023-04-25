// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/server/v8/channels/store"
	"github.com/mattermost/mattermost-server/server/v8/channels/utils"
	"github.com/mattermost/mattermost-server/server/v8/model"
)

func TestTrueUpReviewStatusStore(t *testing.T, ss store.Store, s SqlStore) {
	t.Run("CreateTrueUpReviewStatusRecord", func(t *testing.T) { testCreateTrueUpReviewStatus(t, ss) })
	t.Run("GetTrueUpReviewStatus", func(t *testing.T) { testGetTrueUpReviewStatus(t, ss) })
	t.Run("Update", func(t *testing.T) { testUpdateTrueUpReviewStatus(t, ss) })
}

func testCreateTrueUpReviewStatus(t *testing.T, ss store.Store) {

	now := time.Date(time.Now().Year(), time.January, 1, 0, 0, 0, 0, time.Local)

	reviewStatus := model.TrueUpReviewStatus{
		Completed: true,
		DueDate:   utils.GetNextTrueUpReviewDueDate(now).UnixMilli(),
	}

	t.Run("create true up review status", func(t *testing.T) {
		resp, err := ss.TrueUpReview().CreateTrueUpReviewStatusRecord(&reviewStatus)
		assert.NoError(t, err)

		assert.Equal(t, reviewStatus.Completed, resp.Completed)
		assert.Equal(t, reviewStatus.DueDate, resp.DueDate)
	})
}

func testGetTrueUpReviewStatus(t *testing.T, ss store.Store) {

	now := time.Date(time.Now().Year(), time.August, 1, 0, 0, 0, 0, time.Local)
	dueDate := utils.GetNextTrueUpReviewDueDate(now).UnixMilli()

	reviewStatus := model.TrueUpReviewStatus{
		Completed: true,
		DueDate:   dueDate,
	}

	_, err := ss.TrueUpReview().CreateTrueUpReviewStatusRecord(&reviewStatus)
	assert.NoError(t, err)

	t.Run("get true up review status", func(t *testing.T) {
		resp, err := ss.TrueUpReview().GetTrueUpReviewStatus(dueDate)
		assert.NoError(t, err)

		assert.Equal(t, resp.Completed, resp.Completed)
		assert.Equal(t, resp.DueDate, resp.DueDate)
	})
}

func testUpdateTrueUpReviewStatus(t *testing.T, ss store.Store) {

	now := time.Date(time.Now().Year(), time.April, 1, 0, 0, 0, 0, time.Local)

	reviewStatus := model.TrueUpReviewStatus{
		Completed: false,
		DueDate:   utils.GetNextTrueUpReviewDueDate(now).UnixMilli(),
	}

	_, err := ss.TrueUpReview().CreateTrueUpReviewStatusRecord(&reviewStatus)
	assert.NoError(t, err)

	t.Run("save ", func(t *testing.T) {
		reviewStatus.Completed = true
		resp, err := ss.TrueUpReview().Update(&reviewStatus)
		assert.NoError(t, err)

		assert.Equal(t, resp.Completed, resp.Completed)
		assert.Equal(t, resp.DueDate, resp.DueDate)
	})
}
