// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"os/user"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/public/utils"
	"github.com/mattermost/mattermost/server/v8/channels/audit"
	audittargets "github.com/mattermost/mattermost/server/v8/channels/audit/targets"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/config"

	"github.com/mattermost/logr/v2"
)

// Audit level aliases for convenient access within the app package.
// These map directly to the audit levels defined in mlog.
//
// See [github.com/mattermost/mattermost/server/public/shared/mlog.LvlAuditAPI],
// [github.com/mattermost/mattermost/server/public/shared/mlog.LvlAuditContent],
// [github.com/mattermost/mattermost/server/public/shared/mlog.LvlAuditPerms],
// [github.com/mattermost/mattermost/server/public/shared/mlog.LvlAuditCLI]
// for detailed documentation on when to use each level.
var (
	LevelAPI      = mlog.LvlAuditAPI
	LevelContent  = mlog.LvlAuditContent
	LevelPerms    = mlog.LvlAuditPerms
	LevelCLI      = mlog.LvlAuditCLI
	LevelDelivery = mlog.LvlAuditDelivery
)

const (
	AuditCertificateFilename = "audit_certificate.pem"
)

func (a *App) GetAudits(rctx request.CTX, userID string, limit int) (model.Audits, *model.AppError) {
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

func (a *App) GetAuditsPage(rctx request.CTX, userID string, page int, perPage int) (model.Audits, *model.AppError) {
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
func (a *App) LogAuditRec(rctx request.CTX, rec *model.AuditRecord, err error) {
	a.LogAuditRecWithLevel(rctx, rec, mlog.LvlAuditCLI, err)
}

// LogAuditRecWithLevel logs an audit record using specified Level.
func (a *App) LogAuditRecWithLevel(rctx request.CTX, rec *model.AuditRecord, level mlog.Level, err error) {
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
func (a *App) MakeAuditRecord(rctx request.CTX, event string, initialStatus string) *model.AuditRecord {
	var userID string
	user, err := user.Current()
	if err == nil {
		userID = fmt.Sprintf("%s:%s", user.Uid, user.Username)
	}

	rec := &model.AuditRecord{
		EventName: event,
		Status:    initialStatus,
		Meta: map[string]any{
			model.AuditKeyAPIPath:   "",
			model.AuditKeyClusterID: a.GetClusterId(),
		},
		Actor: model.AuditEventActor{
			UserId:        userID,
			SessionId:     "",
			Client:        fmt.Sprintf("server %s-%s", model.BuildNumber, model.BuildHash),
			IpAddress:     "",
			XForwardedFor: "",
		},
		EventData: model.AuditEventData{
			Parameters:  map[string]any{},
			PriorState:  map[string]any{},
			ResultState: map[string]any{},
			ObjectType:  "",
		},
	}

	return rec
}

func (s *Server) configureAudit(adt *audit.Audit, bAllowAdvancedLogging bool) error {
	adt.OnQueueFull = s.onAuditTargetQueueFull
	adt.OnError = s.onAuditError

	// Register custom target types reachable from advanced-logging JSON.
	// The closure captures s.Store().AuditStorage() once per audit
	// configuration, which is fine because the store is wired before
	// configureAudit runs and is replaced as a whole on reconfiguration.
	adt.Factories = &mlog.Factories{
		TargetFactory: func(targetType string, options json.RawMessage) (logr.Target, error) {
			switch strings.ToLower(targetType) {
			case audittargets.DeliveryDBTargetType:
				return audittargets.NewDeliveryDBTarget(s.Store().AuditStorage()), nil
			}
			return nil, fmt.Errorf("audit target type %q is unrecognized", targetType)
		},
	}

	var logConfigSrc config.LogConfigSrc
	dsn := s.platform.Config().ExperimentalAuditSettings.GetAdvancedLoggingConfig()
	if bAllowAdvancedLogging {
		if !utils.IsEmptyJSON(dsn) {
			var err error
			logConfigSrc, err = config.NewLogConfigSrc(dsn, s.platform.GetConfigStore())
			if err != nil {
				return fmt.Errorf("invalid config source for audit, %w", err)
			}
			s.Log().Debug("Loaded audit configuration", mlog.String("source", dsn))
		} else {
			s.Log().Debug("Advanced logging config not provided for audit")
		}
	}

	// ExperimentalAuditSettings provides basic file audit (E0, E10); logConfigSrc provides advanced config (E20).
	cfg, err := config.MloggerConfigFromAuditConfig(s.platform.Config().ExperimentalAuditSettings, logConfigSrc)
	if err != nil {
		return fmt.Errorf("invalid config for audit, %w", err)
	}

	// Append additional config from env var; any target name collisions will be overwritten.
	additionalJSON := strings.TrimSpace(os.Getenv("MM_EXPERIMENTALAUDITSETTINGS_ADDITIONAL"))
	if additionalJSON != "" {
		cfgAdditional := make(mlog.LoggerConfiguration)
		if err := json.Unmarshal([]byte(additionalJSON), &cfgAdditional); err != nil {
			return fmt.Errorf("invalid additional config for audit, %w", err)
		}
		cfg.Append(cfgAdditional)
	}

	return adt.Configure(cfg)
}

func (s *Server) onAuditTargetQueueFull(qname string, maxQSize int) bool {
	s.Log().Error("Audit queue full, dropping record.", mlog.String("qname", qname), mlog.Int("queueSize", maxQSize))
	return false // drop it
}

func (s *Server) onAuditError(err error) {
	s.Log().Error("Audit Error", mlog.Err(err))
}

func (a *App) AddAuditLogCertificate(rctx request.CTX, fileData *multipart.FileHeader) *model.AppError {
	file, err := fileData.Open()
	if err != nil {
		return model.NewAppError("AddAuditLogCertificate", "api.admin.add_certificate.open.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	defer file.Close()

	data, err := io.ReadAll(file)
	if err != nil {
		return model.NewAppError("AddAuditLogCertificate", "api.admin.add_certificate.saving.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	err = a.Srv().platform.SetConfigFile(AuditCertificateFilename, data)
	if err != nil {
		return model.NewAppError("AddAuditLogCertificate", "api.admin.add_certificate.saving.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	cfg := a.Config().Clone()

	*cfg.ExperimentalAuditSettings.Certificate = AuditCertificateFilename

	if err := cfg.IsValid(); err != nil {
		return err
	}

	a.UpdateConfig(func(dest *model.Config) { *dest = *cfg })

	if a.License().IsCloud() {
		err = a.Cloud().CreateAuditLoggingCert(rctx.Session().UserId, fileData)
		if err != nil {
			return model.NewAppError("AddAuditLogCertificate", "api.admin.add_certificate.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return nil
}

func (a *App) RemoveAuditLogCertificate(rctx request.CTX) *model.AppError {
	err := a.Srv().platform.RemoveConfigFile(AuditCertificateFilename)
	if err != nil {
		return model.NewAppError("RemoveAuditLogCertificate", "api.admin.remove_certificate.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	cfg := a.Config().Clone()

	*cfg.ExperimentalAuditSettings.Certificate = ""

	if err := cfg.IsValid(); err != nil {
		return model.NewAppError("RemoveAuditLogCertificate", "api.admin.remove_certificate.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	a.UpdateConfig(func(dest *model.Config) { *dest = *cfg })

	if a.License().IsCloud() {
		err = a.Cloud().RemoveAuditLoggingCert(rctx.Session().UserId)
		if err != nil {
			return model.NewAppError("RemoveAuditLogCertificate", "api.admin.remove_certificate.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return nil
}
