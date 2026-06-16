// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package cleanup_expired_access_tokens

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
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
func MakeWorker(jobServer *jobs.JobServer, clearSessionCache func(userID string)) *jobs.SimpleWorker {
	isEnabled := func(cfg *model.Config) bool {
		return *cfg.ServiceSettings.EnableUserAccessTokens
	}

	execute := func(logger mlog.LoggerIFace, job *model.Job) error {
		defer jobServer.HandleJobPanic(logger, job)
		return cleanupExpired(
			logger,
			jobServer.Store.UserAccessToken(),
			clearSessionCache,
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
func cleanupExpired(
	logger mlog.LoggerIFace,
	store expiredTokenStore,
	clearSessionCache func(userID string),
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

	logger.Info(
		"Cleaned up expired personal access tokens",
		mlog.Int("deleted", int(totalDeleted)),
		mlog.Int("cutoff", int(cutoff)),
	)

	return nil
}
