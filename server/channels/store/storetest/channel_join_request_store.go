// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func TestChannelJoinRequestStore(t *testing.T, _ request.CTX, ss store.Store) {
	t.Run("Save inserts a pending row", testChannelJoinRequestSave(ss))
	t.Run("Save rejects duplicate pending row", testChannelJoinRequestSaveDuplicatePending(ss))
	t.Run("Save allows another pending row after withdrawal", testChannelJoinRequestSaveAfterWithdraw(ss))
	t.Run("Get returns NotFound for unknown id", testChannelJoinRequestGetNotFound(ss))
	t.Run("GetPendingForChannelAndUser only returns pending rows", testChannelJoinRequestGetPending(ss))
	t.Run("GetForChannel paginates and filters by status", testChannelJoinRequestGetForChannel(ss))
	t.Run("GetForUser paginates and filters by status", testChannelJoinRequestGetForUser(ss))
	t.Run("Update transitions status and stores reviewer", testChannelJoinRequestUpdate(ss))
	t.Run("CountPending only counts pending rows", testChannelJoinRequestCountPending(ss))
}

func newPendingRequest(channelId, userId string) *model.ChannelJoinRequest {
	return &model.ChannelJoinRequest{
		ChannelId: channelId,
		UserId:    userId,
		Message:   "please let me in",
		Status:    model.ChannelJoinRequestStatusPending,
	}
}

func testChannelJoinRequestSave(ss store.Store) func(*testing.T) {
	return func(t *testing.T) {
		channelId := model.NewId()
		userId := model.NewId()

		req, err := ss.ChannelJoinRequest().Save(newPendingRequest(channelId, userId))
		require.NoError(t, err)
		require.NotEmpty(t, req.Id)
		assert.Equal(t, channelId, req.ChannelId)
		assert.Equal(t, userId, req.UserId)
		assert.Equal(t, model.ChannelJoinRequestStatusPending, req.Status)
		assert.NotZero(t, req.CreateAt)
		assert.Equal(t, req.CreateAt, req.UpdateAt)

		fetched, err := ss.ChannelJoinRequest().Get(req.Id)
		require.NoError(t, err)
		assert.Equal(t, req.Id, fetched.Id)
		assert.Equal(t, req.Message, fetched.Message)
		assert.Equal(t, req.Status, fetched.Status)
	}
}

func testChannelJoinRequestSaveDuplicatePending(ss store.Store) func(*testing.T) {
	return func(t *testing.T) {
		channelId := model.NewId()
		userId := model.NewId()

		_, err := ss.ChannelJoinRequest().Save(newPendingRequest(channelId, userId))
		require.NoError(t, err)

		_, err = ss.ChannelJoinRequest().Save(newPendingRequest(channelId, userId))
		require.Error(t, err)
		var conflict *store.ErrConflict
		assert.ErrorAs(t, err, &conflict, "duplicate pending row must surface store.ErrConflict")
	}
}

func testChannelJoinRequestSaveAfterWithdraw(ss store.Store) func(*testing.T) {
	return func(t *testing.T) {
		channelId := model.NewId()
		userId := model.NewId()

		first, err := ss.ChannelJoinRequest().Save(newPendingRequest(channelId, userId))
		require.NoError(t, err)

		first.Status = model.ChannelJoinRequestStatusWithdrawn
		_, err = ss.ChannelJoinRequest().Update(first)
		require.NoError(t, err)

		// Allow the millisecond-resolution UpdateAt to advance.
		time.Sleep(2 * time.Millisecond)

		second, err := ss.ChannelJoinRequest().Save(newPendingRequest(channelId, userId))
		require.NoError(t, err, "a new pending row must be insertable once the previous one is no longer pending")
		assert.NotEqual(t, first.Id, second.Id)
	}
}

func testChannelJoinRequestGetNotFound(ss store.Store) func(*testing.T) {
	return func(t *testing.T) {
		_, err := ss.ChannelJoinRequest().Get(model.NewId())
		require.Error(t, err)
		var nf *store.ErrNotFound
		assert.ErrorAs(t, err, &nf)
	}
}

func testChannelJoinRequestGetPending(ss store.Store) func(*testing.T) {
	return func(t *testing.T) {
		channelId := model.NewId()
		userId := model.NewId()

		_, err := ss.ChannelJoinRequest().GetPendingForChannelAndUser(channelId, userId)
		require.Error(t, err, "must return NotFound when no row exists")

		_, err = ss.ChannelJoinRequest().Save(newPendingRequest(channelId, userId))
		require.NoError(t, err)

		got, err := ss.ChannelJoinRequest().GetPendingForChannelAndUser(channelId, userId)
		require.NoError(t, err)
		assert.Equal(t, channelId, got.ChannelId)
		assert.Equal(t, userId, got.UserId)
		assert.Equal(t, model.ChannelJoinRequestStatusPending, got.Status)

		got.Status = model.ChannelJoinRequestStatusWithdrawn
		_, err = ss.ChannelJoinRequest().Update(got)
		require.NoError(t, err)

		_, err = ss.ChannelJoinRequest().GetPendingForChannelAndUser(channelId, userId)
		require.Error(t, err, "withdrawn row must not be considered pending")
	}
}

func testChannelJoinRequestGetForChannel(ss store.Store) func(*testing.T) {
	return func(t *testing.T) {
		channelId := model.NewId()

		// Three pending requests across distinct users + one denied row for the
		// same channel so we can prove the status filter actually filters.
		for range 3 {
			_, err := ss.ChannelJoinRequest().Save(newPendingRequest(channelId, model.NewId()))
			require.NoError(t, err)
			time.Sleep(2 * time.Millisecond)
		}

		denied := newPendingRequest(channelId, model.NewId())
		saved, err := ss.ChannelJoinRequest().Save(denied)
		require.NoError(t, err)
		saved.Status = model.ChannelJoinRequestStatusDenied
		saved.ReviewedBy = model.NewId()
		saved.ReviewedAt = model.GetMillis()
		saved.DenialReason = "policy mismatch"
		_, err = ss.ChannelJoinRequest().Update(saved)
		require.NoError(t, err)

		rows, total, err := ss.ChannelJoinRequest().GetForChannel(channelId, model.GetChannelJoinRequestsOpts{PerPage: 10})
		require.NoError(t, err)
		assert.Len(t, rows, 3)
		assert.Equal(t, int64(3), total)
		for i := 1; i < len(rows); i++ {
			assert.GreaterOrEqual(t, rows[i-1].CreateAt, rows[i].CreateAt, "list should be newest first")
		}

		rows, total, err = ss.ChannelJoinRequest().GetForChannel(channelId, model.GetChannelJoinRequestsOpts{Status: model.ChannelJoinRequestStatusDenied, PerPage: 10})
		require.NoError(t, err)
		assert.Equal(t, int64(1), total)
		require.Len(t, rows, 1)
		assert.Equal(t, "policy mismatch", rows[0].DenialReason)

		rows, total, err = ss.ChannelJoinRequest().GetForChannel(channelId, model.GetChannelJoinRequestsOpts{PerPage: 2, Page: 0})
		require.NoError(t, err)
		assert.Len(t, rows, 2)
		assert.Equal(t, int64(3), total, "TotalCount must not be truncated by paging")
	}
}

func testChannelJoinRequestGetForUser(ss store.Store) func(*testing.T) {
	return func(t *testing.T) {
		userId := model.NewId()

		for range 2 {
			_, err := ss.ChannelJoinRequest().Save(newPendingRequest(model.NewId(), userId))
			require.NoError(t, err)
			time.Sleep(2 * time.Millisecond)
		}

		denied := newPendingRequest(model.NewId(), userId)
		saved, err := ss.ChannelJoinRequest().Save(denied)
		require.NoError(t, err)
		saved.Status = model.ChannelJoinRequestStatusDenied
		saved.ReviewedBy = model.NewId()
		saved.ReviewedAt = model.GetMillis()
		_, err = ss.ChannelJoinRequest().Update(saved)
		require.NoError(t, err)

		rows, total, err := ss.ChannelJoinRequest().GetForUser(userId, model.GetChannelJoinRequestsOpts{PerPage: 10})
		require.NoError(t, err)
		assert.Len(t, rows, 2)
		assert.Equal(t, int64(2), total)

		rows, total, err = ss.ChannelJoinRequest().GetForUser(userId, model.GetChannelJoinRequestsOpts{Status: model.ChannelJoinRequestStatusDenied, PerPage: 10})
		require.NoError(t, err)
		assert.Equal(t, int64(1), total)
		assert.Len(t, rows, 1)
	}
}

func testChannelJoinRequestUpdate(ss store.Store) func(*testing.T) {
	return func(t *testing.T) {
		req, err := ss.ChannelJoinRequest().Save(newPendingRequest(model.NewId(), model.NewId()))
		require.NoError(t, err)
		originalUpdateAt := req.UpdateAt

		reviewerId := model.NewId()
		reviewedAt := model.GetMillis() + 1
		req.Status = model.ChannelJoinRequestStatusApproved
		req.ReviewedBy = reviewerId
		req.ReviewedAt = reviewedAt

		// Allow UpdateAt to advance.
		time.Sleep(2 * time.Millisecond)
		updated, err := ss.ChannelJoinRequest().Update(req)
		require.NoError(t, err)
		assert.Equal(t, model.ChannelJoinRequestStatusApproved, updated.Status)
		assert.Equal(t, reviewerId, updated.ReviewedBy)
		assert.Equal(t, reviewedAt, updated.ReviewedAt)
		assert.Greater(t, updated.UpdateAt, originalUpdateAt)

		fetched, err := ss.ChannelJoinRequest().Get(req.Id)
		require.NoError(t, err)
		assert.Equal(t, model.ChannelJoinRequestStatusApproved, fetched.Status)
		assert.Equal(t, reviewerId, fetched.ReviewedBy)
	}
}

func testChannelJoinRequestCountPending(ss store.Store) func(*testing.T) {
	return func(t *testing.T) {
		channelId := model.NewId()

		count, err := ss.ChannelJoinRequest().CountPending(channelId)
		require.NoError(t, err)
		assert.Equal(t, int64(0), count)

		for range 4 {
			_, err = ss.ChannelJoinRequest().Save(newPendingRequest(channelId, model.NewId()))
			require.NoError(t, err)
		}

		count, err = ss.ChannelJoinRequest().CountPending(channelId)
		require.NoError(t, err)
		assert.Equal(t, int64(4), count)

		// Withdraw one — count should drop by 1.
		reqs, _, err := ss.ChannelJoinRequest().GetForChannel(channelId, model.GetChannelJoinRequestsOpts{PerPage: 10})
		require.NoError(t, err)
		require.NotEmpty(t, reqs)
		first := reqs[0]
		first.Status = model.ChannelJoinRequestStatusWithdrawn
		_, err = ss.ChannelJoinRequest().Update(first)
		require.NoError(t, err)

		count, err = ss.ChannelJoinRequest().CountPending(channelId)
		require.NoError(t, err)
		assert.Equal(t, int64(3), count)
	}
}
