// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"

	"github.com/mattermost/mattermost-server/v5/audit"
	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
)

const (
	RestLevelID        = 240
	RestContentLevelID = 241
	RestPermsLevelID   = 242
	CLILevelID         = 243
)

var (
	RestLevel        = audit.Level{ID: RestLevelID, Name: "audit-rest", Stacktrace: false}
	RestContentLevel = audit.Level{ID: RestContentLevelID, Name: "audit-rest-content", Stacktrace: false}
	RestPermsLevel   = audit.Level{ID: RestPermsLevelID, Name: "audit-rest-perms", Stacktrace: false}
	CLILevel         = audit.Level{ID: CLILevelID, Name: "audit-cli", Stacktrace: false}
)

func (a *App) GetAudits(userId string, limit int) (model.Audits, *model.AppError) {
	return a.Srv().Store.Audit().Get(userId, 0, limit)
}

func (a *App) GetAuditsPage(userId string, page int, perPage int) (model.Audits, *model.AppError) {
	return a.Srv().Store.Audit().Get(userId, page*perPage, perPage)
}

func (s *Server) configureAudit(adt *audit.Audit) {
	adt.OnQueueFull = s.onAuditTargetQueueFull
	adt.OnError = s.onAuditError

	// Configure target for SysLog via TLS.
	// See https://www.rsyslog.com/doc/v8-stable/tutorials/tls_cert_summary.html
	if *s.Config().ExperimentalAuditSettings.SysLogEnabled {
		IP := *s.Config().ExperimentalAuditSettings.SysLogIP
		if IP == "" {
			IP = "localhost"
		}
		port := *s.Config().ExperimentalAuditSettings.SysLogPort
		if port <= 0 {
			port = 6514
		}
		raddr := fmt.Sprintf("%s:%d", IP, port)
		maxQSize := *s.Config().ExperimentalAuditSettings.SysLogMaxQueueSize
		if maxQSize <= 0 {
			maxQSize = audit.DefMaxQueueSize
		}

		params := &audit.SyslogParams{
			Raddr:    raddr,
			Cert:     *s.Config().ExperimentalAuditSettings.SysLogCert,
			Tag:      *s.Config().ExperimentalAuditSettings.SysLogTag,
			Insecure: *s.Config().ExperimentalAuditSettings.SysLogInsecure,
		}

		filter := adt.MakeFilter(RestLevel, RestContentLevel, RestPermsLevel, CLILevel)
		formatter := adt.MakeJSONFormatter()
		target, err := audit.NewSyslogTLSTarget(filter, formatter, params, maxQSize)
		if err != nil {
			mlog.Error("cannot configure SysLogTLS audit target", mlog.Err(err))
		} else {
			mlog.Debug("SysLogTLS audit target connected successfully", mlog.String("raddr", raddr))
			adt.AddTarget(target)
		}
	}

	// Configure target for rotating file output
	if *s.Config().ExperimentalAuditSettings.FileEnabled {
		opts := audit.FileOptions{
			Filename:   *s.Config().ExperimentalAuditSettings.FileName,
			MaxSize:    *s.Config().ExperimentalAuditSettings.FileMaxSizeMB,
			MaxAge:     *s.Config().ExperimentalAuditSettings.FileMaxAgeDays,
			MaxBackups: *s.Config().ExperimentalAuditSettings.FileMaxBackups,
			Compress:   *s.Config().ExperimentalAuditSettings.FileCompress,
		}

		maxQueueSize := *s.Config().ExperimentalAuditSettings.FileMaxQueueSize
		if maxQueueSize <= 0 {
			maxQueueSize = audit.DefMaxQueueSize
		}

		filter := adt.MakeFilter(RestLevel, RestContentLevel, RestPermsLevel, CLILevel)
		formatter := adt.MakeJSONFormatter()
		formatter.DisableTimestamp = false
		formatter.Indent = "\n"
		target, err := audit.NewFileTarget(filter, formatter, opts, maxQueueSize)
		if err != nil {
			mlog.Error("cannot configure File audit target", mlog.Err(err))
		} else {
			mlog.Debug("File audit target created successfully", mlog.String("filename", opts.Filename))
			adt.AddTarget(target)
		}
	}
}

func (s *Server) onAuditTargetQueueFull(qname string, maxQSize int) {
	mlog.Warn("Audit Queue Full", mlog.String("qname", qname), mlog.Int("maxQSize", maxQSize))
}

func (s *Server) onAuditError(err error) {
	mlog.Error("Audit Error", mlog.Err(err))
}
