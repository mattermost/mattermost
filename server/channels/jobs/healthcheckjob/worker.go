// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Package healthcheckjob implements the periodic evaluation job for the
// built-in health dashboard (WS5). It ties together the CEL rule engine
// (WS1), the live snapshot collector (WS2), and the findings store (WS4).
package healthcheckjob

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/healthcheck"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
)

// AppIface is the narrow interface the worker needs from the app layer.
// Keeping it narrow avoids importing the full app.App type, follows the
// product_notices precedent, and makes the worker unit-testable with a fake.
type AppIface interface {
	// Config returns the current server config.
	Config() *model.Config
	// DBHealthCheckWrite performs a write+delete probe against the primary
	// database and returns nil on success.
	DBHealthCheckWrite() error
}

// MakeWorker creates a SimpleWorker for the health-check evaluation job.
//
// The CEL engine is compiled once here (compile-once / evaluate-per-snapshot)
// rather than inside the execute closure, because CEL compilation is not free
// (~10ms) and must not happen on every tick.
//
// The FindingStore is constructed from the concrete *sqlstore.SqlStore via the
// HealthCheckFindingStore() accessor on app.App. It is passed in here so the
// worker remains testable with a fake store — see runEvaluation.
func MakeWorker(
	jobServer *jobs.JobServer,
	app AppIface,
	findingStore healthcheck.FindingStore,
) *jobs.SimpleWorker {
	const workerName = "HealthCheck"

	engine, err := healthcheck.NewEngine(healthcheck.BuiltinRules)
	if err != nil {
		// If the rule catalog fails to compile it is a programming error, not
		// a runtime error — panic so it is caught immediately in tests / CI.
		panic("healthcheckjob: failed to compile built-in rules: " + err.Error())
	}

	rulesIndex := makeRulesIndex(healthcheck.BuiltinRules)

	isEnabled := func(cfg *model.Config) bool {
		// TODO (WS8): replace with a dedicated EnableHealthCheck config field
		// (Enterprise-only, off by default). Using EnableDeveloper as a
		// temporary gate: the job runs on dev servers and is dormant everywhere
		// else until WS8 wires the proper feature flag.
		return cfg.ServiceSettings.EnableDeveloper != nil && *cfg.ServiceSettings.EnableDeveloper
	}

	execute := func(logger mlog.LoggerIFace, job *model.Job) error {
		defer jobServer.HandleJobPanic(logger, job)

		cfg := app.Config()
		cfg.SetDefaults()

		snap := buildLiveSnapshot(app, cfg)

		outcomes := engine.EvaluateAll(snap)

		prior, err := loadPriorState(findingStore)
		if err != nil {
			logger.Error("HealthCheck job: failed to load prior finding state", mlog.Err(err))
			return err
		}

		result := healthcheck.Reconcile(outcomes, prior, rulesIndex, model.GetMillis())

		if err := persistResult(findingStore, result); err != nil {
			logger.Error("HealthCheck job: failed to persist reconcile result", mlog.Err(err))
			return err
		}

		logger.Info("HealthCheck job: evaluation complete",
			mlog.Int("updated", len(result.Updated)),
			mlog.Int("unchanged", len(result.Unchanged)),
			mlog.Int("firing", countByState(result.Updated, healthcheck.FindingStateFiring)),
		)
		return nil
	}

	return jobs.NewSimpleWorker(workerName, jobServer, execute, isEnabled)
}

// buildLiveSnapshot collects the cheap sections the P1 rules need.
//
// TODO (WS2 full refactor): replace this inline collector with the typed
// section-based snapshot model once the support_packet.go refactor is done.
// This function is the seam where the live provider will be plugged in.
//
// TODO (sub-cadence): for P1 we run the DB probe every tick. When more
// expensive probes are added (filestore write, ES ping), introduce a
// sub-cadence counter so they run every N ticks rather than every cycle.
func buildLiveSnapshot(app AppIface, cfg *model.Config) *healthcheck.Snapshot {
	snap := &healthcheck.Snapshot{
		Config: cfg,
	}

	// Run the DB write probe. A non-nil error means the write failed.
	probeErr := app.DBHealthCheckWrite()
	snap.Probes = &healthcheck.ProbeSection{
		DBWriteOK: probeErr == nil,
	}

	return snap
}

// loadPriorState reads all persisted finding records and returns them as a
// fingerprint-keyed map for the reconciler.
func loadPriorState(store healthcheck.FindingStore) (map[string]healthcheck.FindingRecord, error) {
	records, err := store.GetAll()
	if err != nil {
		return nil, err
	}
	m := make(map[string]healthcheck.FindingRecord, len(records))
	for _, r := range records {
		m[r.Fingerprint] = r
	}
	return m, nil
}

// persistResult writes all changed records to the store.
func persistResult(store healthcheck.FindingStore, result healthcheck.ReconcileResult) error {
	if len(result.Updated) == 0 {
		return nil
	}
	return store.UpsertMany(result.Updated)
}

// makeRulesIndex returns a fingerprint-keyed map of rules for the reconciler.
// For P1 fingerprint == rule code.
func makeRulesIndex(rules []healthcheck.Rule) map[string]healthcheck.Rule {
	m := make(map[string]healthcheck.Rule, len(rules))
	for _, r := range rules {
		m[r.Code] = r
	}
	return m
}

// countByState counts records with the given state in a slice.
func countByState(records []healthcheck.FindingRecord, state healthcheck.FindingState) int {
	n := 0
	for _, r := range records {
		if r.State == state {
			n++
		}
	}
	return n
}
