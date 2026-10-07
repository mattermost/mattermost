// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"io"
	"testing"

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

func TestRunHealthCheckStableAcrossCycles(t *testing.T) {
	th, svc := setupHealthCheck(t, true)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	require.NoError(t, th.App.runHealthCheck(th.Context, svc))
	first := listHealthFindings(t, th)
	require.Len(t, first, 1)
	assert.Equal(t, "TEST_LATEST_VERSION", first[0].Code)
	assert.Equal(t, string(healthcheck.StateFiring), first[0].State)

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
