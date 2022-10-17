// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package suite

import (
	"errors"
	"fmt"
	"net/http"
	"os/user"

	"github.com/mattermost/mattermost-server/v6/audit"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/mattermost/mattermost-server/v6/store"
)

var (
	LevelAPI     = mlog.LvlAuditAPI
	LevelContent = mlog.LvlAuditContent
	LevelPerms   = mlog.LvlAuditPerms
	LevelCLI     = mlog.LvlAuditCLI
)

func (a *SuiteService) GetAudits(userID string, limit int) (model.Audits, *model.AppError) {
	audits, err := a.platform.Store.Audit().Get(userID, 0, limit)
	if err != nil {
		var outErr *store.ErrOutOfBounds
		switch {
		case errors.As(err, &outErr):
			return nil, model.NewAppError("GetAudits", "app.audit.get.limit.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		default:
			return nil, model.NewAppError("GetAudits", "app.audit.get.finding.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	return audits, nil
}

func (a *SuiteService) GetAuditsPage(userID string, page int, perPage int) (model.Audits, *model.AppError) {
	audits, err := a.platform.Store.Audit().Get(userID, page*perPage, perPage)
	if err != nil {
		var outErr *store.ErrOutOfBounds
		switch {
		case errors.As(err, &outErr):
			return nil, model.NewAppError("GetAuditsPage", "app.audit.get.limit.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		default:
			return nil, model.NewAppError("GetAuditsPage", "app.audit.get.finding.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	return audits, nil
}

// LogAuditRec logs an audit record using default LvlAuditCLI.
func (a *SuiteService) LogAuditRec(rec *audit.Record, err error) {
	a.LogAuditRecWithLevel(rec, mlog.LvlAuditCLI, err)
}

// LogAuditRecWithLevel logs an audit record using specified Level.
func (a *SuiteService) LogAuditRecWithLevel(rec *audit.Record, level mlog.Level, err error) {
	if rec == nil {
		return
	}
	if err != nil {
		appErr, ok := err.(*model.AppError)
		if ok {
			rec.AddErrorCode(appErr.StatusCode)
		}
		rec.AddErrorDesc(appErr.Error())
		rec.Fail()
	}

	a.audit.LogRecord(level, *rec)
}

// MakeAuditRecord creates a audit record pre-populated with defaults.
func (a *SuiteService) MakeAuditRecord(event string, initialStatus string) *audit.Record {
	var userID string
	user, err := user.Current()
	if err == nil {
		userID = fmt.Sprintf("%s:%s", user.Uid, user.Username)
	}

	rec := &audit.Record{
		EventName: event,
		Status:    initialStatus,
		Meta: map[string]interface{}{
			audit.KeyAPIPath:   "",
			audit.KeyClusterID: a.platform.GetClusterId(),
		},
		Actor: audit.EventActor{
			UserId:    userID,
			SessionId: "",
			Client:    fmt.Sprintf("server %s-%s", model.BuildNumber, model.BuildHash),
			IpAddress: "",
		},
		EventData: audit.EventData{
			Parameters:  map[string]interface{}{},
			PriorState:  map[string]interface{}{},
			ResultState: map[string]interface{}{},
			ObjectType:  "",
		},
	}

	return rec
}
