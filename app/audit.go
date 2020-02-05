// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"strings"

	"github.com/mattermost/mattermost-server/v5/audit"
	"github.com/mattermost/mattermost-server/v5/model"

	"github.com/wiggin77/logr"
)

func (a *App) GetAudits(userId string, limit int) (model.Audits, *model.AppError) {
	return a.Srv.Store.Audit().Get(userId, 0, limit)
}

func (a *App) GetAuditsPage(userId string, page int, perPage int) (model.Audits, *model.AppError) {
	return a.Srv.Store.Audit().Get(userId, page*perPage, perPage)
}

func configureAudit(s *Server) {
	// Audit to the database
	ast := NewAuditStoreTarget(audit.AuditFilter, audit.DefaultFormatter, s, audit.MaxQueueSize)
	audit.AddTarget(ast)

	// Audit to a file via config
	// TODO
}

// AuditStoreTarget outputs log records to a database.
type AuditStoreTarget struct {
	logr.Basic
	server *Server
}

// NewAuditStoreTarget creates a target that outputs audit records to a database.
func NewAuditStoreTarget(filter logr.Filter, formatter logr.Formatter, server *Server, maxQueue int) *AuditStoreTarget {
	w := &AuditStoreTarget{server: server}
	w.Basic.Start(w, w, filter, formatter, maxQueue)
	return w
}

// Write converts a log record to model.Audit and stores to database.
func (t *AuditStoreTarget) Write(rec *logr.LogRec) error {
	flds := rec.Fields()
	audit := &model.Audit{
		UserId:    getField(flds, audit.KeyUserID),
		IpAddress: getField(flds, audit.KeyUserID),
		Action:    getField(flds, audit.KeyAPIPath),
		SessionId: getField(flds, audit.KeySessionID),
		ExtraInfo: getExtraInfo(flds, audit.KeyUserID, audit.KeyUserID, audit.KeyAPIPath, audit.KeySessionID),
	}
	return t.server.Store.Audit().Save(audit)
}

// String returns a string representation of this target.
func (t *AuditStoreTarget) String() string {
	return "AuditStoreTarget"
}

func getField(fields logr.Fields, name string) string {
	data, ok := fields[name]
	var out string
	if ok {
		out = fmt.Sprintf("%v", data)
	}
	return out
}

func getExtraInfo(fields logr.Fields, skips ...string) string {
	sb := strings.Builder{}
top:
	for k, v := range fields {
		for _, sk := range skips {
			if sk == k {
				continue top
			}
		}
		sb.WriteString(fmt.Sprintf("%s=%v", k, v))
	}
	return sb.String()
}
