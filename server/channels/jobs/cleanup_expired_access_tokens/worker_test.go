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

// fakeAudit implements auditRecorder.
type fakeAudit struct {
	records []model.AuditRecord
}

func (f *fakeAudit) LogRecord(_ mlog.Level, rec model.AuditRecord) {
	f.records = append(f.records, rec)
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

func newTestLogger(t *testing.T) mlog.LoggerIFace {
	t.Helper()
	logger, err := mlog.NewLogger()
	require.NoError(t, err)
	return logger
}

func TestCleanupExpiredHappyPathSingleBatch(t *testing.T) {
	logger := newTestLogger(t)
	tokens := makeTokens(3, 1000)
	store := &fakeStore{batches: [][]*model.UserAccessToken{tokens}}
	audit := &fakeAudit{}

	err := cleanupExpired(logger, store, audit, 9999, 1000, 10)
	require.NoError(t, err)

	// Exactly one DeleteByIds call with the three token ids, and three audit
	// records — one per deleted token.
	require.Len(t, store.deletedIDs, 1)
	require.Len(t, store.deletedIDs[0], 3)
	require.Len(t, audit.records, 3)
	for i, rec := range audit.records {
		require.Equal(t, model.AuditEventExpireUserAccessToken, rec.EventName)
		require.Equal(t, model.AuditStatusSuccess, rec.Status)
		require.Equal(t, tokens[i].Id, rec.Meta["token_id"])
		require.Equal(t, tokens[i].UserId, rec.Meta["user_id"])
		require.Equal(t, tokens[i].ExpiresAt, rec.Meta["expires_at"])
	}

	// A partial first batch (len < limit) must short-circuit the loop, so
	// GetExpiredBefore is called exactly once.
	require.Equal(t, 1, store.getCalls)
}

func TestCleanupExpiredEmptyResultIsNoOp(t *testing.T) {
	logger := newTestLogger(t)
	store := &fakeStore{} // no batches, no errors
	audit := &fakeAudit{}

	err := cleanupExpired(logger, store, audit, 9999, 1000, 10)
	require.NoError(t, err)

	require.Equal(t, 1, store.getCalls)
	require.Empty(t, store.deletedIDs)
	require.Empty(t, audit.records)
}

func TestCleanupExpiredFullBatchTriggersNextIteration(t *testing.T) {
	logger := newTestLogger(t)
	const limit = 5
	first := makeTokens(limit, 1000) // full batch -> loop continues
	second := makeTokens(2, 2000)    // partial batch -> loop stops
	store := &fakeStore{batches: [][]*model.UserAccessToken{first, second}}
	audit := &fakeAudit{}

	err := cleanupExpired(logger, store, audit, 9999, limit, 10)
	require.NoError(t, err)

	// Two iterations total: the full batch keeps the loop going, the partial
	// batch stops it before maxIter.
	require.Equal(t, 2, store.getCalls)
	require.Len(t, store.deletedIDs, 2)
	require.Len(t, store.deletedIDs[0], limit)
	require.Len(t, store.deletedIDs[1], 2)
	require.Len(t, audit.records, limit+2)
}

func TestCleanupExpiredMaxIterCap(t *testing.T) {
	logger := newTestLogger(t)
	const limit = 3
	const maxIter = 2
	store := &fakeStore{batches: [][]*model.UserAccessToken{
		makeTokens(limit, 1000),
		makeTokens(limit, 2000),
		makeTokens(limit, 3000), // never reached
	}}
	audit := &fakeAudit{}

	err := cleanupExpired(logger, store, audit, 9999, limit, maxIter)
	require.NoError(t, err)

	require.Equal(t, maxIter, store.getCalls, "loop must cap at maxIter")
	require.Len(t, store.deletedIDs, maxIter)
	require.Len(t, audit.records, maxIter*limit)
}

func TestCleanupExpiredGetErrorPropagates(t *testing.T) {
	logger := newTestLogger(t)
	wantErr := errors.New("get failed")
	store := &fakeStore{
		batches:  [][]*model.UserAccessToken{makeTokens(2, 1000)},
		getErrAt: 1,
		getErr:   wantErr,
	}
	audit := &fakeAudit{}

	err := cleanupExpired(logger, store, audit, 9999, 1000, 10)
	require.ErrorIs(t, err, wantErr)
	require.Empty(t, store.deletedIDs, "delete must not run when get fails")
	require.Empty(t, audit.records, "no audit records on get failure")
}

func TestCleanupExpiredDeleteErrorPropagates(t *testing.T) {
	logger := newTestLogger(t)
	wantErr := errors.New("delete failed")
	store := &fakeStore{
		batches:   [][]*model.UserAccessToken{makeTokens(2, 1000)},
		deleteErr: wantErr,
	}
	audit := &fakeAudit{}

	err := cleanupExpired(logger, store, audit, 9999, 1000, 10)
	require.ErrorIs(t, err, wantErr)
	require.Len(t, store.deletedIDs, 1, "DeleteByIds was called once before failing")
	require.Empty(t, audit.records, "audit records must only be emitted after a successful delete")
}

func TestCleanupExpiredNilAuditLoggerIsSafe(t *testing.T) {
	logger := newTestLogger(t)
	store := &fakeStore{batches: [][]*model.UserAccessToken{makeTokens(3, 1000)}}

	// Passing a typed-nil through the auditRecorder interface would still be
	// non-nil at the interface level, so we pass an actual nil interface to
	// match how MakeWorker treats a nil *audit.Audit.
	err := cleanupExpired(logger, store, nil, 9999, 1000, 10)
	require.NoError(t, err)

	require.Len(t, store.deletedIDs, 1, "delete must still happen without an audit logger")
}
