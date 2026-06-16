// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package cleanup_expired_access_tokens

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// fakeStore implements expiredTokenStore. Each call to GetExpiredBefore pops
// the next pre-programmed batch off batches, then returns the configured error
// (which can be nil). DeleteByIds returns deleteCount/deleteErr and records
// the ids it was called with.
type fakeStore struct {
	batches    [][]*model.UserAccessToken
	getCalls   int
	getErrAt   int // 1-based call index that returns getErr; 0 == no error
	getErr     error
	deleteCnt  int64
	deleteErr  error
	deletedIDs [][]string
}

func (f *fakeStore) GetExpiredBefore(_ int64, _ int) ([]*model.UserAccessToken, error) {
	f.getCalls++
	if f.getErrAt != 0 && f.getCalls == f.getErrAt {
		return nil, f.getErr
	}
	if len(f.batches) == 0 {
		return nil, nil
	}
	next := f.batches[0]
	f.batches = f.batches[1:]
	return next, nil
}

func (f *fakeStore) DeleteByIds(ids []string) (int64, error) {
	f.deletedIDs = append(f.deletedIDs, ids)
	if f.deleteErr != nil {
		return 0, f.deleteErr
	}
	if f.deleteCnt != 0 {
		return f.deleteCnt, nil
	}
	return int64(len(ids)), nil
}

func makeTokens(n int, base int64) []*model.UserAccessToken {
	out := make([]*model.UserAccessToken, n)
	for i := range n {
		out[i] = &model.UserAccessToken{
			Id:        model.NewId(),
			UserId:    model.NewId(),
			ExpiresAt: base + int64(i),
			IsActive:  true,
		}
	}
	return out
}

func nopClearSession(_ string) {}

func TestCleanupExpired(t *testing.T) {
	logger := mlog.CreateConsoleTestLogger(t)

	t.Run("happy path single batch", func(t *testing.T) {
		tokens := makeTokens(3, 1000)
		store := &fakeStore{batches: [][]*model.UserAccessToken{tokens}}

		err := cleanupExpired(logger, store, nopClearSession, 9999, 1000, 10)
		require.NoError(t, err)

		// Exactly one DeleteByIds call with the three token ids. A partial first
		// batch (len < limit) must short-circuit the loop, so GetExpiredBefore is
		// called exactly once.
		require.Len(t, store.deletedIDs, 1)
		require.Len(t, store.deletedIDs[0], 3)
		require.Equal(t, 1, store.getCalls)
	})

	t.Run("empty result is no-op", func(t *testing.T) {
		store := &fakeStore{} // no batches, no errors

		err := cleanupExpired(logger, store, nopClearSession, 9999, 1000, 10)
		require.NoError(t, err)

		require.Equal(t, 1, store.getCalls)
		require.Empty(t, store.deletedIDs)
	})

	t.Run("full batch triggers next iteration", func(t *testing.T) {
		const limit = 5
		first := makeTokens(limit, 1000) // full batch -> loop continues
		second := makeTokens(2, 2000)    // partial batch -> loop stops
		store := &fakeStore{batches: [][]*model.UserAccessToken{first, second}}

		err := cleanupExpired(logger, store, nopClearSession, 9999, limit, 10)
		require.NoError(t, err)

		require.Equal(t, 2, store.getCalls)
		require.Len(t, store.deletedIDs, 2)
		require.Len(t, store.deletedIDs[0], limit)
		require.Len(t, store.deletedIDs[1], 2)
	})

	t.Run("max iter cap", func(t *testing.T) {
		const limit = 3
		const maxIter = 2
		store := &fakeStore{batches: [][]*model.UserAccessToken{
			makeTokens(limit, 1000),
			makeTokens(limit, 2000),
			makeTokens(limit, 3000), // never reached
		}}

		err := cleanupExpired(logger, store, nopClearSession, 9999, limit, maxIter)
		require.NoError(t, err)

		require.Equal(t, maxIter, store.getCalls, "loop must cap at maxIter")
		require.Len(t, store.deletedIDs, maxIter)
	})

	t.Run("get error propagates", func(t *testing.T) {
		wantErr := errors.New("get failed")
		store := &fakeStore{
			batches:  [][]*model.UserAccessToken{makeTokens(2, 1000)},
			getErrAt: 1,
			getErr:   wantErr,
		}

		err := cleanupExpired(logger, store, nopClearSession, 9999, 1000, 10)
		require.ErrorIs(t, err, wantErr)
		require.Empty(t, store.deletedIDs, "delete must not run when get fails")
	})

	t.Run("delete error propagates", func(t *testing.T) {
		wantErr := errors.New("delete failed")
		store := &fakeStore{
			batches:   [][]*model.UserAccessToken{makeTokens(2, 1000)},
			deleteErr: wantErr,
		}

		err := cleanupExpired(logger, store, nopClearSession, 9999, 1000, 10)
		require.ErrorIs(t, err, wantErr)
		require.Len(t, store.deletedIDs, 1, "DeleteByIds was called once before failing")
	})

	t.Run("session cache cleared for each unique user after delete", func(t *testing.T) {
		sharedUserID := model.NewId()
		tokens := []*model.UserAccessToken{
			{Id: model.NewId(), UserId: sharedUserID, ExpiresAt: 1000, IsActive: true},
			{Id: model.NewId(), UserId: sharedUserID, ExpiresAt: 1001, IsActive: true},
			{Id: model.NewId(), UserId: model.NewId(), ExpiresAt: 1002, IsActive: true},
		}
		store := &fakeStore{batches: [][]*model.UserAccessToken{tokens}}

		cleared := map[string]int{}
		err := cleanupExpired(logger, store, func(userID string) { cleared[userID]++ }, 9999, 1000, 10)
		require.NoError(t, err)

		require.Len(t, cleared, 2, "cache must be cleared for each unique user")
		require.Equal(t, 1, cleared[sharedUserID], "each user cleared exactly once per batch")
	})
}
