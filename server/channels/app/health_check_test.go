// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"io"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/testlib"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

// Tests in this file are not parallel: they toggle the license and use the process-wide
// latest-version cache that BuildHealthSnapshot reads.

// setupHealthCheck returns a service over test rules, since no built-in rules exist yet.
// Feature flags cannot be changed after setup, so the flag is set here.
func setupHealthCheck(t *testing.T, flagEnabled bool) (*TestHelper, *HealthCheckService) {
	t.Helper()

	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.HealthDashboard = flagEnabled
	})

	registry := healthcheck.NewRegistry()
	registry.Register(
		healthcheck.Rule{
			Code:       "TEST_LATEST_VERSION",
			Area:       model.AreaCluster,
			Severity:   healthcheck.SeverityWarning,
			Surface:    healthcheck.SurfaceProduct,
			Volatility: healthcheck.VolatilityStable,
			Subject:    "version",
			Eval: func(s *healthcheck.Snapshot) []healthcheck.Result {
				if s.Version.Latest == "" {
					return []healthcheck.Result{healthcheck.Unknown("test.reason.no_latest_version")}
				}
				return []healthcheck.Result{healthcheck.Firing("test.message.latest_version")}
			},
		},
		healthcheck.Rule{
			Code:       "TEST_NODE",
			Area:       model.AreaCluster,
			Severity:   healthcheck.SeverityInfo,
			Surface:    healthcheck.SurfaceProduct,
			Volatility: healthcheck.VolatilityStable,
			EvalNode: func(_ *healthcheck.Snapshot, _ *healthcheck.NodeSnapshot) []healthcheck.Result {
				return []healthcheck.Result{healthcheck.Resolved()}
			},
		},
	)
	svc := &HealthCheckService{
		engine: healthcheck.NewEngine(healthcheck.EngineOpts{Registry: registry, Logger: th.TestLogger}),
		reconciler: healthcheck.NewReconciler(healthcheck.ReconcilerOpts{
			Store:    th.App.Srv().Store().HealthFinding(),
			Logger:   th.TestLogger,
			Registry: registry,
		}),
	}

	require.NoError(t, th.App.clearLatestVersionCache())
	t.Cleanup(func() {
		assert.NoError(t, th.App.clearLatestVersionCache())
	})
	_, appErr := th.App.GetLatestVersion(th.Context, latestVersionServer(t).URL)
	require.Nil(t, appErr)

	return th, svc
}

func listHealthFindings(t *testing.T, th *TestHelper) []*model.HealthFinding {
	t.Helper()

	findings, err := th.App.Srv().Store().HealthFinding().List(model.HealthFindingFilter{Muted: model.MutedIncluded})
	require.NoError(t, err)
	return findings
}

func TestHealthCheckTaskLeaderOnly(t *testing.T) {
	t.Run("a follower never starts the task", func(t *testing.T) {
		th := SetupWithClusterMock(t, &testlib.FakeClusterInterface{})
		th.App.Srv().SetLicense(model.NewTestLicense("cluster"))
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ClusterSettings.Enable = true
		})
		require.False(t, th.App.IsLeader())

		runHealthCheckTask(th.App)

		assert.Nil(t, th.App.ch.healthCheckTask)
	})

	t.Run("the leader starts the task", func(t *testing.T) {
		th := Setup(t)
		require.True(t, th.App.IsLeader())

		runHealthCheckTask(th.App)

		assert.NotNil(t, th.App.ch.healthCheckTask)
	})

	t.Run("a repeated became-leader callback keeps the running task", func(t *testing.T) {
		th := Setup(t)

		updateHealthCheckTask(th.App, true)
		task := th.App.ch.healthCheckTask
		require.NotNil(t, task)

		updateHealthCheckTask(th.App, true)
		assert.Same(t, task, th.App.ch.healthCheckTask)
	})

	t.Run("losing leadership cancels the task", func(t *testing.T) {
		th := Setup(t)

		updateHealthCheckTask(th.App, true)
		require.NotNil(t, th.App.ch.healthCheckTask)

		updateHealthCheckTask(th.App, false)
		assert.Nil(t, th.App.ch.healthCheckTask)
	})
}

func TestHealthCheckTaskFunc(t *testing.T) {
	newBufferedLogger := func(t *testing.T) (*mlog.Logger, *mlog.Buffer) {
		logger, err := mlog.NewLogger()
		require.NoError(t, err)
		t.Cleanup(func() {
			assert.NoError(t, logger.Shutdown())
		})

		buffer := &mlog.Buffer{}
		require.NoError(t, mlog.AddWriterTarget(logger, buffer, true, mlog.StdAll...))
		return logger, buffer
	}

	t.Run("a panicking cycle is logged and the next tick still runs", func(t *testing.T) {
		logger, buffer := newBufferedLogger(t)

		var calls atomic.Int32
		fn := healthCheckTaskFunc(logger, func() error {
			calls.Add(1)
			panic("boom")
		})
		task := model.CreateRecurringTask("Health Check", fn, 10*time.Millisecond)

		require.Eventually(t, func() bool { return calls.Load() >= 2 }, 5*time.Second, 10*time.Millisecond)
		task.Cancel()

		require.NoError(t, logger.Flush())
		testlib.AssertLog(t, buffer, mlog.LvlError.Name, "Health check panicked")
	})

	t.Run("a failing cycle is logged", func(t *testing.T) {
		logger, buffer := newBufferedLogger(t)

		healthCheckTaskFunc(logger, func() error { return errors.New("cycle failed") })()

		require.NoError(t, logger.Flush())
		testlib.AssertLog(t, buffer, mlog.LvlError.Name, "Health check failed")
	})
}

func TestRunHealthCheckGating(t *testing.T) {
	t.Run("flag off writes nothing", func(t *testing.T) {
		th, svc := setupHealthCheck(t, false)
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

		require.NoError(t, th.App.runHealthCheck(th.Context, svc))
		assert.Empty(t, listHealthFindings(t, th))
	})

	th, svc := setupHealthCheck(t, true)

	t.Run("no license writes nothing", func(t *testing.T) {
		th.App.Srv().SetLicense(nil)

		require.NoError(t, th.App.runHealthCheck(th.Context, svc))
		assert.Empty(t, listHealthFindings(t, th))
	})

	t.Run("license below Enterprise writes nothing", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuProfessional))

		require.NoError(t, th.App.runHealthCheck(th.Context, svc))
		assert.Empty(t, listHealthFindings(t, th))
	})

	t.Run("an Enterprise license applied at runtime takes effect on the next call", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

		require.NoError(t, th.App.runHealthCheck(th.Context, svc))
		assert.NotEmpty(t, listHealthFindings(t, th))
	})
}

func TestRunHealthCheckConcurrent(t *testing.T) {
	th, svc := setupHealthCheck(t, true)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	var wg sync.WaitGroup
	for range 2 {
		wg.Go(func() {
			assert.NoError(t, th.App.runHealthCheck(th.Context, svc))
		})
	}
	wg.Wait()

	findings := listHealthFindings(t, th)
	require.NotEmpty(t, findings)

	seen := map[string]bool{}
	for _, finding := range findings {
		assert.False(t, seen[finding.Fingerprint], "duplicate finding %q", finding.Fingerprint)
		seen[finding.Fingerprint] = true
	}
}

func TestRunHealthCheckStableAcrossCycles(t *testing.T) {
	th, svc := setupHealthCheck(t, true)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	require.NoError(t, th.App.runHealthCheck(th.Context, svc))
	first := listHealthFindings(t, th)
	require.Len(t, first, 2)
	for _, finding := range first {
		if finding.Code == "TEST_LATEST_VERSION" {
			assert.Equal(t, string(healthcheck.StateFiring), finding.State)
		}
	}

	require.NoError(t, th.TestLogger.Flush())
	testlib.AssertLog(t, th.LogBuffer, mlog.LvlDebug.Name, "Health finding changed state")
	_, err := io.Copy(io.Discard, th.LogBuffer)
	require.NoError(t, err)

	require.NoError(t, th.App.runHealthCheck(th.Context, svc))
	second := listHealthFindings(t, th)

	require.NoError(t, th.TestLogger.Flush())
	testlib.AssertNoLog(t, th.LogBuffer, mlog.LvlDebug.Name, "Health finding changed state")

	firstByFingerprint := map[string]*model.HealthFinding{}
	for _, finding := range first {
		firstByFingerprint[finding.Fingerprint] = finding
	}
	require.Len(t, second, len(first))
	for _, finding := range second {
		previous, ok := firstByFingerprint[finding.Fingerprint]
		require.True(t, ok, "new finding %q", finding.Fingerprint)
		assert.Equal(t, previous.State, finding.State, "finding %q", finding.Fingerprint)
		assert.Equal(t, previous.StateSince, finding.StateSince, "finding %q", finding.Fingerprint)
	}
}

func TestChannelsStopCancelsHealthCheckTask(t *testing.T) {
	ch := &Channels{interruptQuitChan: make(chan struct{})}

	var calls atomic.Int32
	ch.healthCheckTask = model.CreateRecurringTask("Health Check", func() { calls.Add(1) }, 10*time.Millisecond)
	require.Eventually(t, func() bool { return calls.Load() >= 1 }, 5*time.Second, 10*time.Millisecond)

	require.NoError(t, ch.Stop())
	assert.Nil(t, ch.healthCheckTask)

	stoppedAt := calls.Load()
	time.Sleep(50 * time.Millisecond)
	assert.Equal(t, stoppedAt, calls.Load())
}
