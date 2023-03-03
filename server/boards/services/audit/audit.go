// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package audit

import (
	"github.com/mattermost/mattermost-server/v6/platform/shared/mlog"
)

const (
	DefMaxQueueSize = 1000

	KeyAPIPath   = "api_path"
	KeyEvent     = "event"
	KeyStatus    = "status"
	KeyUserID    = "user_id"
	KeySessionID = "session_id"
	KeyClient    = "client"
	KeyIPAddress = "ip_address"
	KeyClusterID = "cluster_id"
	KeyTeamID    = "team_id"

	Success = "success"
	Attempt = "attempt"
	Fail    = "fail"
)

var (
	LevelAuth   = mlog.Level{ID: 1000, Name: "auth"}
	LevelModify = mlog.Level{ID: 1001, Name: "mod"}
	LevelRead   = mlog.Level{ID: 1002, Name: "read"}
)

// Audit provides auditing service.
type Audit struct {
	auditLogger *mlog.Logger
}

// NewAudit creates a new Audit instance which can be configured via `(*Audit).Configure`.
func NewAudit(options ...mlog.Option) (*Audit, error) {
	logger, err := mlog.NewLogger(options...)
	if err != nil {
		return nil, err
	}
	return &Audit{
		auditLogger: logger,
	}, nil
}

// Configure provides a new configuration for this audit service.
// Zero or more sources of config can be provided:
//
//	cfgFile    - path to file containing JSON
//	cfgEscaped - JSON string probably from ENV var
//
// For each case JSON containing log targets is provided. Target name collisions are resolved
// using the following precedence:
//
//	cfgFile > cfgEscaped
func (a *Audit) Configure(cfgFile string, cfgEscaped string) error {
	return a.auditLogger.Configure(cfgFile, cfgEscaped, nil)
}

// Shutdown shuts down the audit service after making best efforts to flush any
// remaining records.
func (a *Audit) Shutdown() error {
	return a.auditLogger.Shutdown()
}

// LogRecord emits an audit record with complete info.
func (a *Audit) LogRecord(level mlog.Level, rec *Record) {
	fields := make([]mlog.Field, 0, 7+len(rec.Meta))

	fields = append(fields, mlog.String(KeyAPIPath, rec.APIPath))
	fields = append(fields, mlog.String(KeyEvent, rec.Event))
	fields = append(fields, mlog.String(KeyStatus, rec.Status))
	fields = append(fields, mlog.String(KeyUserID, rec.UserID))
	fields = append(fields, mlog.String(KeySessionID, rec.SessionID))
	fields = append(fields, mlog.String(KeyClient, rec.Client))
	fields = append(fields, mlog.String(KeyIPAddress, rec.IPAddress))

	for _, meta := range rec.Meta {
		fields = append(fields, mlog.Any(meta.K, meta.V))
	}

	a.auditLogger.Log(level, "audit "+rec.Event, fields...)
}
