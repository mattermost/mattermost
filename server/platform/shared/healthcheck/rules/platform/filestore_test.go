// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"errors"
	"maps"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
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

func TestFilestoreUnreachable(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name string
		node *healthcheck.NodeSnapshot
		want want
	}{
		{
			name: "connection test failed",
			node: diagNode("app-2", false, func(diag *model.SupportPacketDiagnostics) {
				diag.FileStore.Status = model.StatusFail
				diag.FileStore.Error = "unable to write to ./data/: permission denied"
			}),
			want: firing("health.rule.filestore_unreachable.message", map[string]string{"error": "unable to write to ./data/: permission denied"}),
		},
		{
			name: "connection test succeeded",
			node: diagNode("app-2", false, nil),
			want: resolved,
		},
		{
			name: "status not recorded",
			node: diagNode("app-2", false, func(diag *model.SupportPacketDiagnostics) {
				diag.FileStore.Status = ""
			}),
			want: diagUnknown,
		},
		{
			name: "nil diagnostics",
			node: &healthcheck.NodeSnapshot{Hostname: "app-2"},
			want: diagUnknown,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResult(t, tc.want, filestoreUnreachable.EvalNode(healthcheck.NewSnapshot([]*healthcheck.NodeSnapshot{tc.node}), tc.node))
		})
	}
}
