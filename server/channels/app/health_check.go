// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/jobs/health_check"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
	_ "github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck/rules"
)

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

// startHealthCheckWorkers starts the worker set that runs health_check jobs. Every app server
// starts it, standalone included, whatever JobSettings.RunJobs says. The framework's workers
// can't run them: a node runs all of its framework workers or none, and dedicated job servers,
// which usually run them, are not cluster members and could not collect from the other nodes.
func (ch *Channels) startHealthCheckWorkers() {
	ctx, cancel := context.WithCancel(context.Background())
	a := New(ServerConnector(ch))
	worker := health_check.MakeWorker(ch.srv.Jobs, func(rctx request.CTX) error {
		return a.RunHealthCheck(rctx.WithContext(ctx))
	})

	ch.cancelHealthCheck = cancel
	ch.healthCheckWorkers = health_check.MakeWorkers(ch.srv.Jobs, worker)
	ch.healthCheckWorkers.Start()
}

func (ch *Channels) stopHealthCheckWorkers() {
	if ch.healthCheckWorkers == nil {
		return
	}

	// Stop waits for a run in progress; cancel it so shutdown doesn't wait out the collect deadline.
	ch.cancelHealthCheck()
	ch.healthCheckWorkers.Stop()
	ch.healthCheckWorkers = nil
}

// RunHealthCheck performs one evaluation cycle over every connected node and stores the
// resulting findings. It is a no-op unless the HealthDashboard feature flag is on, and fails
// without at least an Enterprise license, so a job run then isn't recorded as an evaluation.
func (a *App) RunHealthCheck(rctx request.CTX) error {
	return a.runHealthCheck(rctx, NewHealthCheckService(a.Srv().Store(), a.Log()))
}

func (a *App) runHealthCheck(rctx request.CTX, svc *HealthCheckService) error {
	if !a.Config().FeatureFlags.HealthDashboard {
		return nil
	}
	if !model.MinimumEnterpriseLicense(a.License()) {
		return errors.New("health check requires an Enterprise license")
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

// StartHealthCheckRun creates a health_check job for an app server's health-check workers to
// pick up, unless a run is already pending or in progress: then it returns that run instead, so
// runs never overlap. A run left in progress by a node that died is closed as failed and does not
// count (see health_check.RunningJob). App.CreateJob routes health_check jobs here.
//
// It refuses with 501 unless the health dashboard is enabled and licensed: the health-check
// workers don't run otherwise, so the job would never be picked up.
func (a *App) StartHealthCheckRun(rctx request.CTX) (*model.Job, *model.AppError) {
	if !a.Config().FeatureFlags.HealthDashboard {
		return nil, model.NewAppError("StartHealthCheckRun", "api.health_finding.feature_disabled.app_error", nil, "", http.StatusNotImplemented)
	}
	if !model.MinimumEnterpriseLicense(a.Channels().License()) {
		return nil, model.NewAppError("StartHealthCheckRun", "api.health_finding.license.app_error", nil, "", http.StatusNotImplemented)
	}

	running, appErr := health_check.RunningJob(rctx, a.Srv().Jobs)
	if appErr != nil || running != nil {
		return running, appErr
	}

	// CreateJobOnce saves atomically and creates nothing if a run is already pending, or another
	// request or the scheduler has just created one; that run is returned instead. If that run
	// finishes before it can be read, a second CreateJobOnce starts a run or finds the next one.
	for range 2 {
		job, appErr := a.Srv().Jobs.CreateJobOnce(rctx, model.JobTypeHealthCheck, nil)
		if appErr != nil || job != nil {
			return job, appErr
		}

		existing, err := a.Srv().Jobs.Store.Job().GetNewestJobByStatusesAndType([]string{model.JobStatusPending, model.JobStatusInProgress}, model.JobTypeHealthCheck)
		if err == nil {
			return existing, nil
		}
		if _, ok := errors.AsType[*store.ErrNotFound](err); !ok {
			return nil, model.NewAppError("StartHealthCheckRun", "app.health_check.start_run.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	return nil, model.NewAppError("StartHealthCheckRun", "app.health_check.start_run.conflict.app_error", nil, "", http.StatusConflict)
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

// GetHealthFindings returns product-surface findings only, whatever surfaces the filter asks for:
// internal rules are for support engineers, not the customer admin who calls the API.
// EvaluatedAt is when the last successful health_check job finished, or 0 if none has.
func (a *App) GetHealthFindings(rctx request.CTX, filter model.HealthFindingFilter) (*model.HealthFindingList, *model.AppError) {
	findings, err := a.Srv().Store().HealthFinding().List(model.HealthFindingFilter{
		Surfaces: []string{string(healthcheck.SurfaceProduct)},
		Muted:    filter.Muted,
	})
	if err != nil {
		return nil, model.NewAppError("GetHealthFindings", "app.health_finding.get_all.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	list := &model.HealthFindingList{Findings: findings}
	job, appErr := a.Srv().Jobs.GetLastSuccessfulJobByType(model.JobTypeHealthCheck)
	if appErr != nil {
		return nil, appErr
	}
	if job != nil {
		list.EvaluatedAt = job.LastActivityAt
	}

	return list, nil
}

func (a *App) GetHealthFinding(rctx request.CTX, fingerprint string) (*model.HealthFinding, *model.AppError) {
	findings, err := a.Srv().Store().HealthFinding().GetByFingerprints([]string{fingerprint})
	if err != nil {
		return nil, model.NewAppError("GetHealthFinding", "app.health_finding.get.app_error", nil, "fingerprint="+fingerprint, http.StatusInternalServerError).Wrap(err)
	}
	if len(findings) == 0 || findings[0].Surface != string(healthcheck.SurfaceProduct) {
		return nil, model.NewAppError("GetHealthFinding", "app.health_finding.get.not_found.app_error", nil, "fingerprint="+fingerprint, http.StatusNotFound)
	}

	return findings[0], nil
}
