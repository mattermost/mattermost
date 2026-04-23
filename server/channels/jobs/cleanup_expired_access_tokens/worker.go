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
	workerName      = "CleanupExpiredAccessTokens"
	auditBatchLimit = 1000
)

// MakeWorker creates a worker that periodically deletes personal access tokens
// whose ExpiresAt has passed, along with any sessions created from them. An
// audit record is emitted for every token that is cleaned up so that the
// lifecycle of the token is fully traceable.
func MakeWorker(jobServer *jobs.JobServer, auditLogger *audit.Audit) *jobs.SimpleWorker {
	isEnabled := func(cfg *model.Config) bool {
		return true
	}

	execute := func(logger mlog.LoggerIFace, job *model.Job) error {
		defer jobServer.HandleJobPanic(logger, job)

		cutoff := model.GetMillis()

		// Fetch the set of tokens we're about to delete so that we can emit
		// audit records with the relevant metadata. The PAT secret token is
		// stripped from the returned rows.
		expired, err := jobServer.Store.UserAccessToken().GetExpiredBefore(cutoff, auditBatchLimit)
		if err != nil {
			logger.Error("Failed to read expired personal access tokens", mlog.Err(err))
			return err
		}

		deleted, err := jobServer.Store.UserAccessToken().DeleteExpired(cutoff)
		if err != nil {
			logger.Error("Failed to delete expired personal access tokens", mlog.Err(err))
			return err
		}

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

		logger.Info(
			"Cleaned up expired personal access tokens",
			mlog.Int("deleted", int(deleted)),
			mlog.Int("cutoff", int(cutoff)),
		)

		if job.Data == nil {
			job.Data = make(model.StringMap)
		}
		return nil
	}

	return jobs.NewSimpleWorker(workerName, jobServer, execute, isEnabled)
}
