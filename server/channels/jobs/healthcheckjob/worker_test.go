// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package healthcheckjob

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/healthcheck"
)

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

type fakeApp struct {
	cfg          *model.Config
	dbWriteErr   error
	writesCalled int
}

func (f *fakeApp) Config() *model.Config { return f.cfg }
func (f *fakeApp) DBHealthCheckWrite() error {
	f.writesCalled++
	return f.dbWriteErr
}

type fakeFindingStore struct {
	records []healthcheck.FindingRecord
	upserts []healthcheck.FindingRecord
	getErr  error
}

func (f *fakeFindingStore) UpsertMany(records []healthcheck.FindingRecord) error {
	f.upserts = append(f.upserts, records...)
	return nil
}

func (f *fakeFindingStore) GetAll() ([]healthcheck.FindingRecord, error) {
	return f.records, f.getErr
}

func (f *fakeFindingStore) GetByFingerprint(fp string) (healthcheck.FindingRecord, error) {
	for _, r := range f.records {
		if r.Fingerprint == fp {
			return r, nil
		}
	}
	return healthcheck.FindingRecord{}, healthcheck.ErrNotFound{Fingerprint: fp}
}

func (f *fakeFindingStore) SetMute(fp string, mutedAt int64, mutedByUserID string) error {
	for i := range f.records {
		if f.records[i].Fingerprint == fp {
			f.records[i].MutedAt = mutedAt
			f.records[i].MutedByUserID = mutedByUserID
			return nil
		}
	}
	return nil
}

func (f *fakeFindingStore) ClearMute(fp string) error {
	for i := range f.records {
		if f.records[i].Fingerprint == fp {
			f.records[i].MutedAt = 0
			f.records[i].MutedByUserID = ""
			return nil
		}
	}
	return nil
}

func (f *fakeFindingStore) GetMuted() ([]healthcheck.FindingRecord, error) {
	var out []healthcheck.FindingRecord
	for _, r := range f.records {
		if r.MutedAt > 0 {
			out = append(out, r)
		}
	}
	return out, nil
}

// ---------------------------------------------------------------------------
// buildLiveSnapshot
// ---------------------------------------------------------------------------

func TestBuildLiveSnapshot_DBWriteOK(t *testing.T) {
	cfg := &model.Config{}
	cfg.SetDefaults()

	app := &fakeApp{cfg: cfg, dbWriteErr: nil}
	snap := buildLiveSnapshot(app, cfg)

	require.NotNil(t, snap.Config)
	require.NotNil(t, snap.Probes)
	assert.True(t, snap.Probes.DBWriteOK)
	assert.Equal(t, 1, app.writesCalled)
}

func TestBuildLiveSnapshot_DBWriteFails(t *testing.T) {
	cfg := &model.Config{}
	cfg.SetDefaults()

	app := &fakeApp{cfg: cfg, dbWriteErr: assert.AnError}
	snap := buildLiveSnapshot(app, cfg)

	require.NotNil(t, snap.Probes)
	assert.False(t, snap.Probes.DBWriteOK)
}

// ---------------------------------------------------------------------------
// persistResult
// ---------------------------------------------------------------------------

func TestPersistResult_EmptyUpdated_NoUpsert(t *testing.T) {
	store := &fakeFindingStore{}
	result := healthcheck.ReconcileResult{
		Updated:   nil,
		Unchanged: []healthcheck.FindingRecord{{Fingerprint: "X"}},
	}
	err := persistResult(store, result)
	require.NoError(t, err)
	assert.Empty(t, store.upserts)
}

func TestPersistResult_WithUpdated_Upserted(t *testing.T) {
	store := &fakeFindingStore{}
	result := healthcheck.ReconcileResult{
		Updated: []healthcheck.FindingRecord{
			{Fingerprint: "PUSH_EMPTY_URL", RuleCode: "PUSH_EMPTY_URL", State: healthcheck.FindingStateFiring},
		},
	}
	err := persistResult(store, result)
	require.NoError(t, err)
	require.Len(t, store.upserts, 1)
	assert.Equal(t, "PUSH_EMPTY_URL", store.upserts[0].Fingerprint)
}

// ---------------------------------------------------------------------------
// Full evaluation round-trip (no DB, no JobServer)
// ---------------------------------------------------------------------------

func TestEvaluationRoundTrip_FiringRulePersistedToStore(t *testing.T) {
	cfg := &model.Config{}
	cfg.SetDefaults()
	// Trigger PUSH_EMPTY_URL.
	*cfg.EmailSettings.SendPushNotifications = true
	*cfg.EmailSettings.PushNotificationServer = ""

	app := &fakeApp{cfg: cfg, dbWriteErr: nil}
	store := &fakeFindingStore{}

	engine, err := healthcheck.NewEngine(healthcheck.BuiltinRules)
	require.NoError(t, err)

	rulesIdx := makeRulesIndex(healthcheck.BuiltinRules)
	snap := buildLiveSnapshot(app, cfg)
	outcomes := engine.EvaluateAll(snap)
	prior, err := loadPriorState(store)
	require.NoError(t, err)

	result := healthcheck.Reconcile(outcomes, prior, rulesIdx, 1_700_000_000_000)
	require.NoError(t, persistResult(store, result))

	// PUSH_EMPTY_URL must have been upserted as firing.
	var found bool
	for _, r := range store.upserts {
		if r.Fingerprint == "PUSH_EMPTY_URL" {
			found = true
			assert.Equal(t, healthcheck.FindingStateFiring, r.State)
		}
	}
	assert.True(t, found, "PUSH_EMPTY_URL must appear in upserted records")
}

func TestEvaluationRoundTrip_ProbeFailFiresAfterDebounce(t *testing.T) {
	cfg := &model.Config{}
	cfg.SetDefaults()

	// DB write fails.
	app := &fakeApp{cfg: cfg, dbWriteErr: assert.AnError}
	store := &fakeFindingStore{}
	engine, err := healthcheck.NewEngine(healthcheck.BuiltinRules)
	require.NoError(t, err)
	rulesIdx := makeRulesIndex(healthcheck.BuiltinRules)

	runTick := func() {
		snap := buildLiveSnapshot(app, cfg)
		outcomes := engine.EvaluateAll(snap)
		prior, _ := loadPriorState(store)
		result := healthcheck.Reconcile(outcomes, prior, rulesIdx, model.GetMillis())
		_ = persistResult(store, result)
		// Simulate store state: replace records with upserted ones.
		for _, up := range result.Updated {
			replaced := false
			for i, r := range store.records {
				if r.Fingerprint == up.Fingerprint {
					store.records[i] = up
					replaced = true
					break
				}
			}
			if !replaced {
				store.records = append(store.records, up)
			}
		}
		store.upserts = nil
	}

	// First tick: below debounce threshold → unknown.
	runTick()
	dbRec := findRecord(store.records, "DB_HEALTHCHECK_FAIL")
	assert.Equal(t, healthcheck.FindingStateUnknown, dbRec.State)
	assert.Equal(t, 1, dbRec.ConsecutiveFailures)

	// Second tick: at debounce threshold → firing.
	runTick()
	dbRec = findRecord(store.records, "DB_HEALTHCHECK_FAIL")
	assert.Equal(t, healthcheck.FindingStateFiring, dbRec.State)
	assert.Equal(t, 2, dbRec.ConsecutiveFailures)
}

func findRecord(records []healthcheck.FindingRecord, fp string) healthcheck.FindingRecord {
	for _, r := range records {
		if r.Fingerprint == fp {
			return r
		}
	}
	return healthcheck.FindingRecord{}
}
