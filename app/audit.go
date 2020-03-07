// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"sort"
	"strings"

	"github.com/mattermost/mattermost-server/v5/audit"
	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"

	"github.com/wiggin77/logr"
	"github.com/wiggin77/logr/format"
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
	// For now just send audit records to database. When implemented, use config store
	// to configure where audit records are written, and which filter is used.
	/*
		filter := adt.MakeFilter(RestLevel, RestContentLevel, RestPermsLevel, CLILevel)
		target := NewAuditStoreTarget(filter, s.Store.Audit(), audit.DefMaxQueueSize)
		adt.AddTarget(target)

		adt.OnQueueFull = s.onAuditTargetQueueFull
		adt.OnError = s.onAuditError
	*/
}

func (s *Server) onAuditTargetQueueFull(qname string, maxQSize int) {
	mlog.Warn("Audit Queue Full", mlog.String("qname", qname), mlog.Int("maxQSize", maxQSize))
}

func (s *Server) onAuditError(err error) {
	mlog.Error("Audit Error", mlog.Err(err))
}

const MaxExtraInfoLen = 1024

// AuditStoreTarget outputs log records to a database via store.AuditStore.
type AuditStoreTarget struct {
	logr.Basic
	store store.AuditStore
}

// NewAuditStoreTarget creates a target that outputs audit records to a database.
func NewAuditStoreTarget(filter logr.Filter, store store.AuditStore, maxQueue int) *AuditStoreTarget {
	w := &AuditStoreTarget{store: store}
	w.Basic.Start(w, w, filter, &format.Plain{}, maxQueue)
	return w
}

// Write converts a log record to model.Audit and stores to database.
func (t *AuditStoreTarget) Write(rec *logr.LogRec) error {
	flds := rec.Fields()
	infos := getExtraInfos(flds, MaxExtraInfoLen, audit.KeyUserID, audit.KeyIPAddress, audit.KeyAPIPath, audit.KeySessionID)
	for _, info := range infos {
		audit := &model.Audit{
			UserId:    getField(flds, audit.KeyUserID),
			IpAddress: getField(flds, audit.KeyIPAddress),
			Action:    getField(flds, audit.KeyAPIPath),
			SessionId: getField(flds, audit.KeySessionID),
			ExtraInfo: info,
		}
		if err := t.store.Save(audit); err != nil {
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

	tmp := make([]string, 0, len(fields))
	for k := range fields {
		if k != audit.KeyEvent && k != audit.KeyStatus && k != audit.KeyClient {
			tmp = append(tmp, k)
		}
	}
	sort.Strings(tmp)

	// event and status are pre-pended, client is appended, everything else gets sorted.
	keys := make([]string, 0, len(fields))
	keys = append(keys, audit.KeyEvent, audit.KeyStatus)
	keys = append(keys, tmp...)
	keys = append(keys, audit.KeyClient)

top:
	for _, k := range keys {
		for _, sk := range skips {
			if sk == k {
				continue top
			}
		}
		// a single entry cannot be greater than maxlen; truncate if needed.
		val, ok := fields[k]
		if !ok {
			continue top
		}
		field := fmt.Sprintf("%s=%v", k, val)
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
