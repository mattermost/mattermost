// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package cleanup_expired_access_tokens

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
)

const (
	workerName = "CleanupExpiredAccessTokens"
	// batchLimit bounds both the number of rows fetched by GetExpiredBefore
	// and the corresponding DeleteByIds call, keeping the transaction
	// footprint bounded even when a large number of tokens expire at once.
	batchLimit = 1000
	// maxBatches caps the number of iterations per job execution so that very
	// large expiry backlogs are drained across multiple scheduled runs rather
	// than a single unbounded loop.
	maxBatches = 1000
)

// expiredTokenStore is the subset of UserAccessTokenStore used by the worker.
// Defined here rather than depending on the full store interface so the
// orchestration logic can be unit-tested with a small fake.
type expiredTokenStore interface {
	GetExpiredBefore(cutoff int64, limit int) ([]*model.UserAccessToken, error)
	DeleteByIds(tokenIDs []string) (int64, error)
}

// MakeWorker creates a worker that periodically deletes personal access tokens
// whose ExpiresAt has passed, along with any sessions created from them.
// The work is done in batches to keep the transaction footprint bounded.
//
// clearSessionCache is called for each affected user after their tokens are
// deleted so that in-memory session caches don't serve stale sessions.
//
// notifyExpired is called with each batch of expired tokens immediately before
// they are deleted, so the owner can be DMed that their token has been removed.
// It is best-effort: any failure is handled internally and must not block the
// cleanup. Note that after this change PAT expiry notifications come from two
// jobs — the pre-expiry warning cascade (pat_expiry_notify) and this
// at-deletion notice — so a future reader shouldn't be surprised to find an
// expiry DM originating from the cleanup job.
func MakeWorker(jobServer *jobs.JobServer, clearSessionCache func(userID string), notifyExpired func(rctx request.CTX, tokens []*model.UserAccessToken)) *jobs.SimpleWorker {
	isEnabled := func(cfg *model.Config) bool {
		return *cfg.ServiceSettings.EnableUserAccessTokens
	}

	execute := func(logger mlog.LoggerIFace, job *model.Job) error {
		defer jobServer.HandleJobPanic(logger, job)
		return cleanupExpired(
			request.EmptyContext(logger),
			jobServer.Store.UserAccessToken(),
			clearSessionCache,
			notifyExpired,
			model.GetMillis(),
			batchLimit,
			maxBatches,
		)
	}

	return jobs.NewSimpleWorker(workerName, jobServer, execute, isEnabled)
}

// cleanupExpired drains expired personal access tokens in batches up to
// maxBatches iterations. It is extracted from MakeWorker so that the batching
// and error-propagation logic can be exercised by unit tests with a fake store.
//
// clearSessionCache is called for each unique user whose tokens were deleted so
// that in-memory session caches don't continue serving the removed sessions.
//
// notifyExpired is called with each batch immediately before deletion so token
// owners can be notified. It runs best-effort: it is invoked before the delete
// so the token→owner mapping is still available, and the delete proceeds
// regardless of what it does. The worst case (a crash between notify and
// delete) is a single duplicate DM on the next run, which is acceptable. The
// request context is passed through so the notifier logs under the job's logger.
func cleanupExpired(
	rctx request.CTX,
	store expiredTokenStore,
	clearSessionCache func(userID string),
	notifyExpired func(rctx request.CTX, tokens []*model.UserAccessToken),
	cutoff int64,
	limit int,
	maxIter int,
) error {
	var totalDeleted int64

	for range maxIter {
		expired, err := store.GetExpiredBefore(cutoff, limit)
		if err != nil {
			return err
		}
		if len(expired) == 0 {
			break
		}

		ids := make([]string, len(expired))
		userIDs := make(map[string]struct{}, len(expired))
		for i, token := range expired {
			ids[i] = token.Id
			userIDs[token.UserId] = struct{}{}
		}

		if notifyExpired != nil {
			notifyExpired(rctx, expired)
		}

		deleted, err := store.DeleteByIds(ids)
		if err != nil {
			return err
		}
		totalDeleted += deleted

		for userID := range userIDs {
			clearSessionCache(userID)
		}

		if len(expired) < limit {
			break
		}
	}

	rctx.Logger().Info(
		"Cleaned up expired personal access tokens",
		mlog.Int("deleted", int(totalDeleted)),
		mlog.Int("cutoff", int(cutoff)),
	)

	return nil
}
