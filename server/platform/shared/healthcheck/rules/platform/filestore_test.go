// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"errors"
	"maps"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func filestoreConfig(clustered bool, driver, directory string) func(*model.Config) {
	return func(cfg *model.Config) {
		cfg.ClusterSettings.Enable = new(clustered)
		cfg.FileSettings.DriverName = new(driver)
		cfg.FileSettings.Directory = new(directory)
	}
}

func TestFilestoreConfigRules(t *testing.T) {
	t.Parallel()

	rules := []healthcheck.Rule{filestoreLocalInCluster, filestoreS3NoBucket, filestoreS3SSLOff}
	allResolved := map[string]want{
		"FILESTORE_LOCAL_IN_CLUSTER": resolved,
		"FILESTORE_S3_NO_BUCKET":     resolved,
		"FILESTORE_S3_SSL_OFF":       resolved,
	}
	allUnknown := map[string]want{
		"FILESTORE_LOCAL_IN_CLUSTER": configUnknown,
		"FILESTORE_S3_NO_BUCKET":     configUnknown,
		"FILESTORE_S3_SSL_OFF":       configUnknown,
	}
	with := func(overrides map[string]want) map[string]want {
		wants := maps.Clone(allResolved)
		maps.Copy(wants, overrides)
		return wants
	}

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     map[string]want
	}{
		{
			name:     "config section absent",
			snapshot: healthcheck.NewSnapshot([]*healthcheck.NodeSnapshot{clusterLeader()}),
			want:     allUnknown,
		},
		{
			name: "config section failed",
			snapshot: func() *healthcheck.Snapshot {
				s := clusterSnapshot(nil)
				s.Sections[model.SectionConfig] = errors.New("boom")
				return s
			}(),
			want: allUnknown,
		},
		{
			name:     "defaults",
			snapshot: clusterSnapshot(nil),
			want:     allResolved,
		},
		{
			name:     "standalone local relative directory",
			snapshot: clusterSnapshot(filestoreConfig(false, model.ImageDriverLocal, "./data/")),
			want:     allResolved,
		},
		{
			name:     "clustered local relative directory fires even when the connection test succeeds",
			snapshot: clusterSnapshot(filestoreConfig(true, model.ImageDriverLocal, "./data/")),
			want: with(map[string]want{
				"FILESTORE_LOCAL_IN_CLUSTER": firing("health.rule.filestore_local_in_cluster.message", map[string]string{"directory": "./data/"}),
			}),
		},
		{
			name:     "clustered local absolute directory",
			snapshot: clusterSnapshot(filestoreConfig(true, model.ImageDriverLocal, "/mnt/mattermost")),
			want: with(map[string]want{
				"FILESTORE_LOCAL_IN_CLUSTER": firing("health.rule.filestore_local_in_cluster.message", map[string]string{"directory": "/mnt/mattermost"}),
			}),
		},
		{
			name:     "clustered s3",
			snapshot: clusterSnapshot(all(filestoreConfig(true, model.ImageDriverS3, "./data/"), withBucket("mattermost-files"))),
			want:     allResolved,
		},
		{
			name:     "clustered azure",
			snapshot: clusterSnapshot(filestoreConfig(true, model.ImageDriverAzure, "./data/")),
			want:     allResolved,
		},
		{
			name: "cluster flag unreadable",
			snapshot: clusterSnapshot(func(cfg *model.Config) {
				cfg.ClusterSettings.Enable = nil
			}),
			want: with(map[string]want{
				"FILESTORE_LOCAL_IN_CLUSTER": configUnknown,
			}),
		},
		{
			name: "driver unreadable",
			snapshot: clusterSnapshot(func(cfg *model.Config) {
				cfg.ClusterSettings.Enable = new(true)
				cfg.FileSettings.DriverName = nil
			}),
			want: allUnknown,
		},
		{
			name: "driver unreadable outside a cluster",
			snapshot: clusterSnapshot(func(cfg *model.Config) {
				cfg.FileSettings.DriverName = nil
			}),
			want: map[string]want{
				"FILESTORE_LOCAL_IN_CLUSTER": resolved,
				"FILESTORE_S3_NO_BUCKET":     configUnknown,
				"FILESTORE_S3_SSL_OFF":       configUnknown,
			},
		},
		{
			name: "directory unreadable in a cluster",
			snapshot: clusterSnapshot(func(cfg *model.Config) {
				cfg.ClusterSettings.Enable = new(true)
				cfg.FileSettings.Directory = nil
			}),
			want: with(map[string]want{
				"FILESTORE_LOCAL_IN_CLUSTER": configUnknown,
			}),
		},
		{
			name:     "s3 with empty bucket",
			snapshot: clusterSnapshot(filestoreConfig(false, model.ImageDriverS3, "./data/")),
			want: with(map[string]want{
				"FILESTORE_S3_NO_BUCKET": firing("health.rule.filestore_s3_no_bucket.message", nil),
			}),
		},
		{
			name: "s3 with ssl off",
			snapshot: clusterSnapshot(all(filestoreConfig(false, model.ImageDriverS3, "./data/"), withBucket("mattermost-files"), func(cfg *model.Config) {
				cfg.FileSettings.AmazonS3SSL = new(false)
			})),
			want: with(map[string]want{
				"FILESTORE_S3_SSL_OFF": firing("health.rule.filestore_s3_ssl_off.message", nil),
			}),
		},
		{
			name: "local with empty bucket and ssl off",
			snapshot: clusterSnapshot(all(filestoreConfig(false, model.ImageDriverLocal, "./data/"), func(cfg *model.Config) {
				cfg.FileSettings.AmazonS3SSL = new(false)
			})),
			want: allResolved,
		},
		{
			name: "s3 settings unreadable",
			snapshot: clusterSnapshot(all(filestoreConfig(false, model.ImageDriverS3, "./data/"), func(cfg *model.Config) {
				cfg.FileSettings.AmazonS3Bucket = nil
				cfg.FileSettings.AmazonS3SSL = nil
			})),
			want: with(map[string]want{
				"FILESTORE_S3_NO_BUCKET": configUnknown,
				"FILESTORE_S3_SSL_OFF":   configUnknown,
			}),
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertRules(t, rules, tc.snapshot, tc.want)
		})
	}
}

func clusterLeader() *healthcheck.NodeSnapshot {
	return leaderNode(func(diag *model.SupportPacketDiagnostics) {
		diag.License = model.SupportPacketLicense{SkuShortName: model.LicenseShortSkuEnterprise, Features: &model.Features{Cluster: new(true)}}
	})
}

func clusterSnapshot(mutate func(*model.Config)) *healthcheck.Snapshot {
	return configSnapshot(mutate, clusterLeader())
}

func TestFilestoreLocalInClusterLicense(t *testing.T) {
	t.Parallel()

	clusteredLocal := filestoreConfig(true, model.ImageDriverLocal, "/mnt/mattermost")
	licensed := func(license model.SupportPacketLicense) *healthcheck.Snapshot {
		return configSnapshot(clusteredLocal, leaderNode(func(diag *model.SupportPacketDiagnostics) { diag.License = license }))
	}

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     want
	}{
		{"unlicensed", licensed(model.SupportPacketLicense{}), resolved},
		{"cluster feature off", licensed(model.SupportPacketLicense{SkuShortName: model.LicenseShortSkuProfessional, Features: &model.Features{Cluster: new(false)}}), resolved},
		{"license unavailable", configSnapshot(clusteredLocal), want{state: healthcheck.StateUnknown, messageID: healthcheck.ReasonLicenseUnavailable}},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResult(t, tc.want, filestoreLocalInCluster.Eval(tc.snapshot))
		})
	}
}

func withBucket(bucket string) func(*model.Config) {
	return func(cfg *model.Config) {
		cfg.FileSettings.AmazonS3Bucket = new(bucket)
	}
}

func filestoreDiskNode(driver string, totalMB, availableMB *uint64) *healthcheck.NodeSnapshot {
	return diagNode("app-2", false, func(diag *model.SupportPacketDiagnostics) {
		diag.FileStore.Driver = driver
		diag.FileStore.TotalMB = totalMB
		diag.FileStore.AvailableMB = availableMB
	})
}

func TestFilestoreDiskRules(t *testing.T) {
	t.Parallel()

	rules := []healthcheck.Rule{filestoreDiskLow, filestoreDiskFull}
	diskFiring := func(messageID string, availableGiB, totalGiB, percent string, value float64) want {
		return firing(messageID, map[string]string{
			"available_gib": availableGiB,
			"total_gib":     totalGiB,
			"percent":       percent,
		}).withValue(value)
	}
	both := func(w want) map[string]want {
		return map[string]want{"FILESTORE_DISK_LOW": w, "FILESTORE_DISK_FULL": w}
	}

	localSectionMissing := withoutSection(filestoreDiskNode(model.ImageDriverLocal, new(uint64(100*1024)), new(uint64(9*1024))), model.SectionFilestoreDisk)
	localSectionFailed := filestoreDiskNode(model.ImageDriverLocal, new(uint64(100*1024)), new(uint64(9*1024)))
	localSectionFailed.Diagnostics.Errors[model.SectionFilestoreDisk] = errors.New("statfs failed")
	s3SectionMissing := withoutSection(filestoreDiskNode(model.ImageDriverS3, nil, nil), model.SectionFilestoreDisk)

	testCases := []struct {
		name string
		node *healthcheck.NodeSnapshot
		want map[string]want
	}{
		{
			name: "healthy local disk",
			node: filestoreDiskNode(model.ImageDriverLocal, new(uint64(100*1024)), new(uint64(20*1024))),
			want: both(resolved.withValue(0.20)),
		},
		{
			name: "low local disk",
			node: filestoreDiskNode(model.ImageDriverLocal, new(uint64(100*1024)), new(uint64(9*1024))),
			want: map[string]want{
				"FILESTORE_DISK_LOW":  diskFiring("health.rule.filestore_disk_low.message", "9.0", "100.0", "9.00", 0.09),
				"FILESTORE_DISK_FULL": resolved.withValue(0.09),
			},
		},
		{
			name: "low percentage on a large disk stays quiet above the cap",
			node: filestoreDiskNode(model.ImageDriverLocal, new(uint64(1024*1024)), new(uint64(90*1024))),
			want: both(resolved.withValue(0.087890625)),
		},
		{
			name: "full below five percent and five GiB",
			node: filestoreDiskNode(model.ImageDriverLocal, new(uint64(100*1024)), new(uint64(4*1024))),
			want: map[string]want{
				"FILESTORE_DISK_LOW":  resolved.withValue(0.04),
				"FILESTORE_DISK_FULL": diskFiring("health.rule.filestore_disk_full.message", "4.0", "100.0", "4.00", 0.04),
			},
		},
		{
			name: "below five percent with more than five GiB is low",
			node: filestoreDiskNode(model.ImageDriverLocal, new(uint64(150*1024)), new(uint64(6*1024))),
			want: map[string]want{
				"FILESTORE_DISK_LOW":  diskFiring("health.rule.filestore_disk_low.message", "6.0", "150.0", "4.00", 0.04),
				"FILESTORE_DISK_FULL": resolved.withValue(0.04),
			},
		},
		{
			name: "below five percent at exactly five GiB is low",
			node: filestoreDiskNode(model.ImageDriverLocal, new(uint64(125*1024)), new(uint64(5*1024))),
			want: map[string]want{
				"FILESTORE_DISK_LOW":  diskFiring("health.rule.filestore_disk_low.message", "5.0", "125.0", "4.00", 0.04),
				"FILESTORE_DISK_FULL": resolved.withValue(0.04),
			},
		},
		{
			name: "exactly five percent below five GiB is low",
			node: filestoreDiskNode(model.ImageDriverLocal, new(uint64(80*1024)), new(uint64(4*1024))),
			want: map[string]want{
				"FILESTORE_DISK_LOW":  diskFiring("health.rule.filestore_disk_low.message", "4.0", "80.0", "5.00", 0.05),
				"FILESTORE_DISK_FULL": resolved.withValue(0.05),
			},
		},
		{
			name: "just below five percent does not round to the threshold",
			node: filestoreDiskNode(model.ImageDriverLocal, new(uint64(100_000)), new(uint64(4_999))),
			want: map[string]want{
				"FILESTORE_DISK_LOW":  resolved.withValue(0.04999),
				"FILESTORE_DISK_FULL": diskFiring("health.rule.filestore_disk_full.message", "4.9", "97.7", "4.99", 0.04999),
			},
		},
		{
			name: "percentage is truncated without floating-point rounding",
			node: filestoreDiskNode(model.ImageDriverLocal, new(uint64(10_000_000)), new(uint64(3_000))),
			want: map[string]want{
				"FILESTORE_DISK_LOW":  resolved.withValue(0.0003),
				"FILESTORE_DISK_FULL": diskFiring("health.rule.filestore_disk_full.message", "2.9", "9765.6", "0.03", 0.0003),
			},
		},
		{
			name: "below one GiB above ten percent is low",
			node: filestoreDiskNode(model.ImageDriverLocal, new(uint64(10*1024)), new(uint64(1023))),
			want: map[string]want{
				"FILESTORE_DISK_LOW":  diskFiring("health.rule.filestore_disk_low.message", "0.999", "10.0", "9.99", float64(1023)/(10*1024)),
				"FILESTORE_DISK_FULL": resolved.withValue(float64(1023) / (10 * 1024)),
			},
		},
		{
			name: "small volume below one GiB is low regardless of percentage",
			node: filestoreDiskNode(model.ImageDriverLocal, new(uint64(2*1024)), new(uint64(512))),
			want: map[string]want{
				"FILESTORE_DISK_LOW":  diskFiring("health.rule.filestore_disk_low.message", "0.500", "2.0", "25.00", 0.25),
				"FILESTORE_DISK_FULL": resolved.withValue(0.25),
			},
		},
		{
			name: "small volume just above five percent is low",
			node: filestoreDiskNode(model.ImageDriverLocal, new(uint64(2*1024)), new(uint64(103))),
			want: map[string]want{
				"FILESTORE_DISK_LOW":  diskFiring("health.rule.filestore_disk_low.message", "0.101", "2.0", "5.02", float64(103)/(2*1024)),
				"FILESTORE_DISK_FULL": resolved.withValue(float64(103) / (2 * 1024)),
			},
		},
		{
			name: "small volume below five percent is full",
			node: filestoreDiskNode(model.ImageDriverLocal, new(uint64(2*1024)), new(uint64(102))),
			want: map[string]want{
				"FILESTORE_DISK_LOW":  resolved.withValue(float64(102) / (2 * 1024)),
				"FILESTORE_DISK_FULL": diskFiring("health.rule.filestore_disk_full.message", "0.100", "2.0", "4.98", float64(102)/(2*1024)),
			},
		},
		{
			name: "zero available space",
			node: filestoreDiskNode(model.ImageDriverLocal, new(uint64(100*1024)), new(uint64(0))),
			want: map[string]want{
				"FILESTORE_DISK_LOW":  resolved.withValue(0),
				"FILESTORE_DISK_FULL": diskFiring("health.rule.filestore_disk_full.message", "0.0", "100.0", "0.00", 0),
			},
		},
		{
			name: "exactly ten percent is not low",
			node: filestoreDiskNode(model.ImageDriverLocal, new(uint64(90*1024)), new(uint64(9*1024))),
			want: both(resolved.withValue(0.10)),
		},
		{
			name: "exactly five percent is low but not full",
			node: filestoreDiskNode(model.ImageDriverLocal, new(uint64(100*1024)), new(uint64(5*1024))),
			want: map[string]want{
				"FILESTORE_DISK_LOW":  diskFiring("health.rule.filestore_disk_low.message", "5.0", "100.0", "5.00", 0.05),
				"FILESTORE_DISK_FULL": resolved.withValue(0.05),
			},
		},
		{
			name: "exactly ten GiB does not pass the low-space cap",
			node: filestoreDiskNode(model.ImageDriverLocal, new(uint64(160*1024)), new(uint64(10*1024))),
			want: both(resolved.withValue(0.0625)),
		},
		{
			name: "below five percent at the low-space cap is resolved",
			node: filestoreDiskNode(model.ImageDriverLocal, new(uint64(250*1024)), new(uint64(10*1024))),
			want: both(resolved.withValue(0.04)),
		},
		{
			name: "exactly one GiB is not full",
			node: filestoreDiskNode(model.ImageDriverLocal, new(uint64(15*1024)), new(uint64(1024))),
			want: map[string]want{
				"FILESTORE_DISK_LOW":  diskFiring("health.rule.filestore_disk_low.message", "1.0", "15.0", "6.66", float64(1)/15),
				"FILESTORE_DISK_FULL": resolved.withValue(float64(1) / 15),
			},
		},
		{
			name: "exactly one GiB at a high percentage is resolved",
			node: filestoreDiskNode(model.ImageDriverLocal, new(uint64(2*1024)), new(uint64(1024))),
			want: both(resolved.withValue(0.50)),
		},
		{name: "S3 without disk data is not applicable", node: s3SectionMissing, want: both(resolved)},
		{name: "driver missing", node: filestoreDiskNode("", new(uint64(100*1024)), new(uint64(9*1024))), want: both(diagUnknown)},
		{name: "nil diagnostics", node: &healthcheck.NodeSnapshot{Hostname: "app-2"}, want: both(diagUnknown)},
		{name: "local disk section absent", node: localSectionMissing, want: both(diagUnknown)},
		{name: "local disk section failed", node: localSectionFailed, want: both(diagUnknown)},
		{name: "total missing", node: filestoreDiskNode(model.ImageDriverLocal, nil, new(uint64(1024))), want: both(diagUnknown)},
		{name: "available missing", node: filestoreDiskNode(model.ImageDriverLocal, new(uint64(100*1024)), nil), want: both(diagUnknown)},
		{name: "total zero", node: filestoreDiskNode(model.ImageDriverLocal, new(uint64(0)), new(uint64(0))), want: both(diagUnknown)},
		{name: "available exceeds total", node: filestoreDiskNode(model.ImageDriverLocal, new(uint64(100)), new(uint64(101))), want: both(diagUnknown)},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			snapshot := healthcheck.NewSnapshot([]*healthcheck.NodeSnapshot{tc.node})
			for _, rule := range rules {
				assertResult(t, tc.want[rule.Code], rule.EvalNode(snapshot, tc.node), rule.Code)
			}
		})
	}
}

func TestFilestoreUnreachable(t *testing.T) {
	t.Parallel()

	failed := func(hostname, err string) *healthcheck.NodeSnapshot {
		return diagNode(hostname, false, func(diag *model.SupportPacketDiagnostics) {
			diag.FileStore.Status = model.StatusFail
			diag.FileStore.Error = err
		})
	}
	const permissionDenied = "unable to write to ./data/: permission denied"

	testCases := []struct {
		name  string
		nodes []*healthcheck.NodeSnapshot
		want  want
	}{
		{
			name:  "connection test failed",
			nodes: []*healthcheck.NodeSnapshot{failed("app-2", permissionDenied)},
			want:  firing("health.rule.filestore_unreachable.message", map[string]string{"nodes": "app-2", "error": permissionDenied}),
		},
		{
			name:  "every node fails",
			nodes: []*healthcheck.NodeSnapshot{failed("app-1", permissionDenied), failed("app-2", permissionDenied), failed("app-3", "timeout")},
			want: firing("health.rule.filestore_unreachable.message", map[string]string{
				"nodes": "app-1, app-2, app-3",
				"error": "app-1: " + permissionDenied + "; app-2: " + permissionDenied + "; app-3: timeout",
			}),
		},
		{
			name:  "one node of three fails",
			nodes: []*healthcheck.NodeSnapshot{diagNode("app-1", true, nil), failed("app-2", permissionDenied), diagNode("app-3", false, nil)},
			want:  firing("health.rule.filestore_unreachable.message.partial", map[string]string{"nodes": "app-2", "error": permissionDenied}),
		},
		{
			name:  "a node that did not reply is left out",
			nodes: []*healthcheck.NodeSnapshot{failed("app-1", permissionDenied), {Hostname: "app-2", CollectErr: healthcheck.ErrNodeNoReply}},
			want:  firing("health.rule.filestore_unreachable.message", map[string]string{"nodes": "app-1", "error": permissionDenied}),
		},
		{
			name:  "connection test succeeded",
			nodes: []*healthcheck.NodeSnapshot{diagNode("app-2", false, nil)},
			want:  resolved,
		},
		{
			name: "status not recorded",
			nodes: []*healthcheck.NodeSnapshot{diagNode("app-2", false, func(diag *model.SupportPacketDiagnostics) {
				diag.FileStore.Status = ""
			})},
			want: diagUnknown,
		},
		{
			name:  "nil diagnostics",
			nodes: []*healthcheck.NodeSnapshot{{Hostname: "app-2"}},
			want:  diagUnknown,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResult(t, tc.want, filestoreUnreachable.Eval(healthcheck.NewSnapshot(tc.nodes)))
		})
	}

	t.Run("one cluster-wide finding", func(t *testing.T) {
		t.Parallel()

		registry := healthcheck.NewRegistry()
		registry.Register(filestoreUnreachable)
		engine := healthcheck.NewEngine(healthcheck.EngineOpts{Registry: registry})
		snapshot := healthcheck.NewSnapshot([]*healthcheck.NodeSnapshot{failed("app-1", permissionDenied), failed("app-2", permissionDenied), diagNode("app-3", true, nil)})

		evaluations := engine.Evaluate(snapshot)
		require.Len(t, evaluations, 1)
		assert.Equal(t, healthcheck.StateFiring, evaluations[0].Result.State)
		assert.Empty(t, evaluations[0].Result.Scope)
	})
}
