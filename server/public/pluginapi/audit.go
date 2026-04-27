package pluginapi

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// AuditService exposes methods to emit audit records through the Mattermost server audit pipeline.
type AuditService struct {
	api plugin.API
}

// Record logs an audit record using the default audit log level.
//
// Minimum server version: 10.10
func (a *AuditService) Record(rec *model.AuditRecord) {
	a.api.LogAuditRec(rec)
}

// RecordWithLevel logs an audit record with the given log level.
//
// Minimum server version: 10.10
func (a *AuditService) RecordWithLevel(rec *model.AuditRecord, level mlog.Level) {
	a.api.LogAuditRecWithLevel(rec, level)
}
