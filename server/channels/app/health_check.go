// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
	_ "github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck/rules"
)

const healthCheckInterval = time.Hour

// HealthCheckService evaluates the built-in health rules and reconciles the results into
// stored findings.
type HealthCheckService struct {
	engine     *healthcheck.Engine
	reconciler *healthcheck.Reconciler
}

// NewHealthCheckService builds a HealthCheckService over the built-in rules and the
// store's health findings.
func NewHealthCheckService(s store.Store, logger mlog.LoggerIFace) *HealthCheckService {
	// Sharing one registry guarantees every evaluated rule code resolves in the reconciler.
	registry := healthcheck.Builtin()

	return &HealthCheckService{
		engine: healthcheck.NewEngine(healthcheck.EngineOpts{
			Registry: registry,
			Logger:   logger,
		}),
		reconciler: healthcheck.NewReconciler(healthcheck.ReconcilerOpts{
			Store:    s.HealthFinding(),
			Policies: healthcheck.DefaultPolicies(),
			Logger:   logger,
			Registry: registry,
		}),
	}
}

// RunHealthCheck performs one evaluation cycle and stores the resulting findings. It is a
// no-op unless the HealthDashboard feature flag is on and the license is at least Enterprise.
// It must only be called on the cluster leader.
func (a *App) RunHealthCheck(rctx request.CTX) error {
	return a.runHealthCheck(rctx, NewHealthCheckService(a.Srv().Store(), a.Log()))
}

func (a *App) runHealthCheck(rctx request.CTX, svc *HealthCheckService) error {
	if !a.Config().FeatureFlags.HealthDashboard || !model.MinimumEnterpriseLicense(a.License()) {
		return nil
	}

	snapshot, err := a.BuildHealthSnapshot(rctx)
	if err != nil {
		return fmt.Errorf("failed to build health snapshot: %w", err)
	}

	transitions, err := svc.reconciler.Reconcile(svc.engine.Evaluate(snapshot))
	if err != nil {
		return fmt.Errorf("failed to reconcile health findings: %w", err)
	}

	for _, transition := range transitions {
		rctx.Logger().Debug("Health finding changed state",
			mlog.String("code", transition.Finding.Code),
			mlog.String("fingerprint", transition.Finding.Fingerprint),
			mlog.String("from", string(transition.From)),
			mlog.String("to", string(transition.To)),
		)
	}

	if _, err = svc.reconciler.GCFindings(healthcheck.DefaultFindingRetention); err != nil {
		return fmt.Errorf("failed to delete expired health findings: %w", err)
	}

	return nil
}

func (a *App) MuteHealthFinding(rctx request.CTX, fingerprint string, userID string) *model.AppError {
	if err := a.Srv().Store().HealthFinding().Mute(fingerprint, userID, model.GetMillis()); err != nil {
		if errors.Is(err, healthcheck.ErrFindingNotFound) {
			return model.NewAppError("MuteHealthFinding", "app.health_finding.mute.not_found.app_error", nil, "fingerprint="+fingerprint, http.StatusNotFound)
		}
		return model.NewAppError("MuteHealthFinding", "app.health_finding.mute.app_error", nil, "fingerprint="+fingerprint, http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

func (a *App) UnmuteHealthFinding(rctx request.CTX, fingerprint string) *model.AppError {
	if err := a.Srv().Store().HealthFinding().Unmute(fingerprint); err != nil {
		if errors.Is(err, healthcheck.ErrFindingNotFound) {
			return model.NewAppError("UnmuteHealthFinding", "app.health_finding.unmute.not_found.app_error", nil, "fingerprint="+fingerprint, http.StatusNotFound)
		}
		return model.NewAppError("UnmuteHealthFinding", "app.health_finding.unmute.app_error", nil, "fingerprint="+fingerprint, http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

func (a *App) GetHealthFindings(rctx request.CTX, filter model.HealthFindingFilter) ([]*model.HealthFinding, *model.AppError) {
	findings, err := a.Srv().Store().HealthFinding().List(filter)
	if err != nil {
		return nil, model.NewAppError("GetHealthFindings", model.NoTranslation, nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return findings, nil
}
