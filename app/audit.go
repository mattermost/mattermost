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

	// For now we only support sending audit records to Syslog via TLS.
	// See https://www.rsyslog.com/doc/v8-stable/tutorials/tls_cert_summary.html
	if *s.Config().ExperimentalAuditSettings.Enabled {
		IP := *s.Config().ExperimentalAuditSettings.IP
		if IP == "" {
			IP = "localhost"
		}
		port := *s.Config().ExperimentalAuditSettings.Port
		if port <= 0 {
			port = 6514
		}
		raddr := fmt.Sprintf("%s:%d", IP, port)
		maxQSize := *s.Config().ExperimentalAuditSettings.MaxQSize
		if maxQSize <= 0 {
			maxQSize = audit.DefMaxQueueSize
		}

		params := &audit.SyslogParams{
			Raddr:    raddr,
			Cert:     *s.Config().ExperimentalAuditSettings.Cert,
			Tag:      *s.Config().ExperimentalAuditSettings.Tag,
			Insecure: *s.Config().ExperimentalAuditSettings.Insecure,
		}

		filter := adt.MakeFilter(RestLevel, RestContentLevel, RestPermsLevel, CLILevel)
		formatter := adt.MakeJSONFormatter()
		target, err := audit.NewSyslogTLSTarget(filter, formatter, params, maxQSize)
		if err != nil {
			mlog.Error("cannot configure SysLogTLS audit target", mlog.Err(err))
			return
		}
		mlog.Debug("SysLogTLS audit target connected successfully", mlog.String("raddy", raddr))
		adt.AddTarget(target)
	}
}

func (s *Server) onAuditTargetQueueFull(qname string, maxQSize int) {
	mlog.Warn("Audit Queue Full", mlog.String("qname", qname), mlog.Int("maxQSize", maxQSize))
}

func (s *Server) onAuditError(err error) {
	mlog.Error("Audit Error", mlog.Err(err))
}
