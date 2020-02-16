// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"sort"
	"strings"

	"github.com/mattermost/mattermost-server/v5/audit"
	"github.com/mattermost/mattermost-server/v5/model"

	"github.com/wiggin77/logr"
)

func (a *App) GetAudits(userId string, limit int) (model.Audits, *model.AppError) {
	return a.Srv().Store.Audit().Get(userId, 0, limit)
}

func (a *App) GetAuditsPage(userId string, page int, perPage int) (model.Audits, *model.AppError) {
	return a.Srv().Store.Audit().Get(userId, page*perPage, perPage)
}

func configureAudit(s *Server) {
	// Audit to the database
	ast := NewAuditStoreTarget(audit.AuditFilter, audit.DefaultFormatter, s, audit.MaxQueueSize)
	audit.AddTarget(ast)

	// Audit to a file via config
	// TODO
}

const MaxExtraInfoLen = 1024

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
	infos := getExtraInfos(flds, MaxExtraInfoLen, audit.KeyUserID, audit.KeyUserID, audit.KeyAPIPath, audit.KeySessionID)
	for _, info := range infos {
		audit := &model.Audit{
			UserId:    getField(flds, audit.KeyUserID),
			IpAddress: getField(flds, audit.KeyUserID),
			Action:    getField(flds, audit.KeyAPIPath),
			SessionId: getField(flds, audit.KeySessionID),
			ExtraInfo: info,
		}
		if err := t.server.Store.Audit().Save(audit); err != nil {
			return err
		}
	}
	return nil
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

// getExtraInfos returns an array of strings containing extra info fields
// such that no string exceeds maxlen and at least one string is returned,
// even if empty. Fields are sorted.
func getExtraInfos(fields logr.Fields, maxlen int, skips ...string) []string {
	const sep = " | "
	infos := []string{}
	sb := strings.Builder{}

	keys := make([]string, 0, len(fields))
	for k, _ := range fields {
		keys = append(keys, k)
	}
	sort.Strings(keys)

top:
	for _, k := range keys {
		for _, sk := range skips {
			if sk == k {
				continue top
			}
		}
		// a single entry cannot be greater than maxlen; truncate if needed.
		field := fmt.Sprintf("%s=%v", k, fields[k])
		if len(field) > maxlen {
			field = field[:maxlen-3]
			field = field + "..."
		}
		// if adding the new field will exceed maxlen then flush buffer and
		// start a new one.
		if sb.Len() > 0 && sb.Len()+len(field)+len(sep) > maxlen {
			infos = append(infos, sb.String())
			sb = strings.Builder{}
		}
		if sb.Len() > 0 {
			sb.WriteString(sep)
		}
		sb.WriteString(field)
	}
	infos = append(infos, sb.String())
	return infos
}
