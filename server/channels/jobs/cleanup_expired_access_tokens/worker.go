// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package cleanup_expired_access_tokens

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/audit"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
)

const (
	workerName = "CleanupExpiredAccessTokens"
	// batchLimit bounds both the number of rows fetched by GetExpiredBefore
	// and the corresponding DeleteByIds call, so every deletion has a 1:1
	// audit record and very large expiry backlogs are drained across
	// multiple iterations rather than in a single huge statement.
	batchLimit = 1000
	// maxBatches caps the number of iterations per job execution to avoid a
	// runaway loop if the cutoff somehow advances (or rows keep appearing).
	// With batchLimit = 1000 this lets a single job delete up to 1,000,000
	// tokens before deferring the remainder to the next scheduled run.
	maxBatches = 1000
)

// MakeWorker creates a worker that periodically deletes personal access tokens
// whose ExpiresAt has passed, along with any sessions created from them. An
// audit record is emitted for every token that is cleaned up so that the
// lifecycle of the token is fully traceable. The work is done in batches so
// that each deleted token has a matching audit record and the transaction
// footprint stays bounded even when a large number of tokens expire at once.
func MakeWorker(jobServer *jobs.JobServer, auditLogger *audit.Audit) *jobs.SimpleWorker {
	isEnabled := func(cfg *model.Config) bool {
		return true
	}

	execute := func(logger mlog.LoggerIFace, job *model.Job) error {
		defer jobServer.HandleJobPanic(logger, job)

		cutoff := model.GetMillis()
		var totalDeleted int64

		for range maxBatches {
			expired, err := jobServer.Store.UserAccessToken().GetExpiredBefore(cutoff, batchLimit)
			if err != nil {
				logger.Error("Failed to read expired personal access tokens", mlog.Err(err))
				return err
			}
			if len(expired) == 0 {
				break
			}

			ids := make([]string, len(expired))
			for i, token := range expired {
				ids[i] = token.Id
			}

			deleted, err := jobServer.Store.UserAccessToken().DeleteByIds(ids)
			if err != nil {
				logger.Error("Failed to delete expired personal access tokens", mlog.Err(err))
				return err
			}
			totalDeleted += deleted

			if auditLogger != nil {
				for _, token := range expired {
					rec := model.AuditRecord{
						EventName: model.AuditEventExpireUserAccessToken,
						Status:    model.AuditStatusSuccess,
						Actor: model.AuditEventActor{
							Client: "server " + model.BuildNumber + "-" + model.BuildHash,
						},
						EventData: model.AuditEventData{
							Parameters:  map[string]any{},
							PriorState:  map[string]any{},
							ResultState: map[string]any{},
							ObjectType:  "user_access_token",
						},
						Meta: map[string]any{
							"token_id":   token.Id,
							"user_id":    token.UserId,
							"expires_at": token.ExpiresAt,
						},
					}
					auditLogger.LogRecord(mlog.LvlAuditCLI, rec)
				}
			}

			if len(expired) < batchLimit {
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

	return jobs.NewSimpleWorker(workerName, jobServer, execute, isEnabled)
}
