// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"fmt"
	"net/http"
	"os/user"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/utils"
	"github.com/mattermost/mattermost/server/v8/channels/audit"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/config"
)

var (
	LevelAPI     = mlog.LvlAuditAPI
	LevelContent = mlog.LvlAuditContent
	LevelPerms   = mlog.LvlAuditPerms
	LevelCLI     = mlog.LvlAuditCLI
)

func (a *App) GetAudits(userID string, limit int) (model.Audits, *model.AppError) {
	audits, err := a.Srv().Store().Audit().Get(userID, 0, limit)
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

func (a *App) GetAuditsPage(userID string, page int, perPage int) (model.Audits, *model.AppError) {
	audits, err := a.Srv().Store().Audit().Get(userID, page*perPage, perPage)
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
func (a *App) LogAuditRec(rec *audit.Record, err error) {
	a.LogAuditRecWithLevel(rec, mlog.LvlAuditCLI, err)
}

// LogAuditRecWithLevel logs an audit record using specified Level.
func (a *App) LogAuditRecWithLevel(rec *audit.Record, level mlog.Level, err error) {
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
	a.Srv().Audit.LogRecord(level, *rec)
}

// MakeAuditRecord creates a audit record pre-populated with defaults.
func (a *App) MakeAuditRecord(event string, initialStatus string) *audit.Record {
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
			audit.KeyClusterID: a.GetClusterId(),
		},
		Actor: audit.EventActor{
			UserId:        userID,
			SessionId:     "",
			Client:        fmt.Sprintf("server %s-%s", model.BuildNumber, model.BuildHash),
			IpAddress:     "",
			XForwardedFor: "",
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

func (s *Server) configureAudit(adt *audit.Audit, bAllowAdvancedLogging bool) error {
	adt.OnQueueFull = s.onAuditTargetQueueFull
	adt.OnError = s.onAuditError

	var logConfigSrc config.LogConfigSrc
	dsn := s.platform.Config().ExperimentalAuditSettings.GetAdvancedLoggingConfig()
	if bAllowAdvancedLogging {
		if !utils.IsEmptyJSON(dsn) {
			var err error
			logConfigSrc, err = config.NewLogConfigSrc(dsn, s.platform.GetConfigStore())
			if err != nil {
				return fmt.Errorf("invalid config source for audit, %w", err)
			}
			mlog.Debug("Loaded audit configuration", mlog.String("source", string(dsn)))
		} else {
			s.Log().Debug("Advanced logging config not provided for audit")
		}
	}

	// ExperimentalAuditSettings provides basic file audit (E0, E10); logConfigSrc provides advanced config (E20).
	cfg, err := config.MloggerConfigFromAuditConfig(s.platform.Config().ExperimentalAuditSettings, logConfigSrc)
	if err != nil {
		return fmt.Errorf("invalid config for audit, %w", err)
	}

	return adt.Configure(cfg)
}

func (s *Server) onAuditTargetQueueFull(qname string, maxQSize int) bool {
	mlog.Error("Audit queue full, dropping record.", mlog.String("qname", qname), mlog.Int("queueSize", maxQSize))
	return true // drop it
}

func (s *Server) onAuditError(err error) {
	mlog.Error("Audit Error", mlog.Err(err))
}
