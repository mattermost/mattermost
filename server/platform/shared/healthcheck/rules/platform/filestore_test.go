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

	rules := []healthcheck.Rule{filestoreLocalInCluster, filestoreLocalInClusterVerify, filestoreS3NoBucket, filestoreS3SSLOff}
	allResolved := map[string]want{
		"FILESTORE_LOCAL_IN_CLUSTER":        resolved,
		"FILESTORE_LOCAL_IN_CLUSTER_VERIFY": resolved,
		"FILESTORE_S3_NO_BUCKET":            resolved,
		"FILESTORE_S3_SSL_OFF":              resolved,
	}
	allUnknown := map[string]want{
		"FILESTORE_LOCAL_IN_CLUSTER":        configUnknown,
		"FILESTORE_LOCAL_IN_CLUSTER_VERIFY": configUnknown,
		"FILESTORE_S3_NO_BUCKET":            configUnknown,
		"FILESTORE_S3_SSL_OFF":              configUnknown,
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
			snapshot: healthcheck.NewSnapshot([]*healthcheck.NodeSnapshot{leaderNode(nil)}),
			want:     allUnknown,
		},
		{
			name: "config section failed",
			snapshot: &healthcheck.Snapshot{
				Config:   defaultConfig(nil),
				Sections: map[model.WorkspaceSection]error{model.SectionConfig: errors.New("boom")},
			},
			want: allUnknown,
		},
		{
			name:     "defaults",
			snapshot: configSnapshot(nil),
			want:     allResolved,
		},
		{
			name:     "standalone local relative directory",
			snapshot: configSnapshot(filestoreConfig(false, model.ImageDriverLocal, "./data/")),
			want:     allResolved,
		},
		{
			name:     "clustered local relative directory fires even when the connection test succeeds",
			snapshot: configSnapshot(filestoreConfig(true, model.ImageDriverLocal, "./data/"), leaderNode(nil)),
			want: with(map[string]want{
				"FILESTORE_LOCAL_IN_CLUSTER": firing("health.rule.filestore_local_in_cluster.message", map[string]string{"directory": "./data/"}),
			}),
		},
		{
			name:     "clustered local absolute directory",
			snapshot: configSnapshot(filestoreConfig(true, model.ImageDriverLocal, "/mnt/mattermost")),
			want: with(map[string]want{
				"FILESTORE_LOCAL_IN_CLUSTER_VERIFY": firing("health.rule.filestore_local_in_cluster_verify.message", map[string]string{"directory": "/mnt/mattermost"}),
			}),
		},
		{
			name:     "clustered s3",
			snapshot: configSnapshot(all(filestoreConfig(true, model.ImageDriverS3, "./data/"), withBucket("mattermost-files"))),
			want:     allResolved,
		},
		{
			name:     "clustered azure",
			snapshot: configSnapshot(filestoreConfig(true, model.ImageDriverAzure, "./data/")),
			want:     allResolved,
		},
		{
			name: "cluster flag unreadable",
			snapshot: configSnapshot(func(cfg *model.Config) {
				cfg.ClusterSettings.Enable = nil
			}),
			want: with(map[string]want{
				"FILESTORE_LOCAL_IN_CLUSTER":        configUnknown,
				"FILESTORE_LOCAL_IN_CLUSTER_VERIFY": configUnknown,
			}),
		},
		{
			name: "driver unreadable",
			snapshot: configSnapshot(func(cfg *model.Config) {
				cfg.ClusterSettings.Enable = new(true)
				cfg.FileSettings.DriverName = nil
			}),
			want: allUnknown,
		},
		{
			name: "directory unreadable in a cluster",
			snapshot: configSnapshot(func(cfg *model.Config) {
				cfg.ClusterSettings.Enable = new(true)
				cfg.FileSettings.Directory = nil
			}),
			want: with(map[string]want{
				"FILESTORE_LOCAL_IN_CLUSTER":        configUnknown,
				"FILESTORE_LOCAL_IN_CLUSTER_VERIFY": configUnknown,
			}),
		},
		{
			name:     "s3 with empty bucket",
			snapshot: configSnapshot(filestoreConfig(false, model.ImageDriverS3, "./data/")),
			want: with(map[string]want{
				"FILESTORE_S3_NO_BUCKET": firing("health.rule.filestore_s3_no_bucket.message", nil),
			}),
		},
		{
			name: "s3 with ssl off",
			snapshot: configSnapshot(all(filestoreConfig(false, model.ImageDriverS3, "./data/"), withBucket("mattermost-files"), func(cfg *model.Config) {
				cfg.FileSettings.AmazonS3SSL = new(false)
			})),
			want: with(map[string]want{
				"FILESTORE_S3_SSL_OFF": firing("health.rule.filestore_s3_ssl_off.message", nil),
			}),
		},
		{
			name: "local with empty bucket and ssl off",
			snapshot: configSnapshot(all(filestoreConfig(false, model.ImageDriverLocal, "./data/"), func(cfg *model.Config) {
				cfg.FileSettings.AmazonS3SSL = new(false)
			})),
			want: allResolved,
		},
		{
			name: "s3 settings unreadable",
			snapshot: configSnapshot(all(filestoreConfig(false, model.ImageDriverS3, "./data/"), func(cfg *model.Config) {
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

func withBucket(bucket string) func(*model.Config) {
	return func(cfg *model.Config) {
		cfg.FileSettings.AmazonS3Bucket = new(bucket)
	}
}

func TestFilestoreUnreachable(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     want
	}{
		{
			name: "connection test failed",
			snapshot: configSnapshot(nil, leaderNode(func(diag *model.SupportPacketDiagnostics) {
				diag.FileStore.Status = model.StatusFail
				diag.FileStore.Error = "unable to write to ./data/: permission denied"
			})),
			want: firing("health.rule.filestore_unreachable.message", map[string]string{"error": "unable to write to ./data/: permission denied"}),
		},
		{
			name:     "connection test succeeded",
			snapshot: configSnapshot(nil, leaderNode(nil)),
			want:     resolved,
		},
		{
			name: "status not recorded",
			snapshot: configSnapshot(nil, leaderNode(func(diag *model.SupportPacketDiagnostics) {
				diag.FileStore.Status = ""
			})),
			want: diagUnknown,
		},
		{
			name:     "leader without diagnostics",
			snapshot: configSnapshot(nil, &healthcheck.NodeSnapshot{Hostname: "mm.example.com", IsLeader: true}),
			want:     diagUnknown,
		},
		{
			name:     "only a follower has diagnostics",
			snapshot: configSnapshot(nil, &healthcheck.NodeSnapshot{Hostname: "app-1", IsLeader: true}, diagNode("app-2", false, nil)),
			want:     diagUnknown,
		},
		{
			name:     "no nodes",
			snapshot: configSnapshot(nil),
			want:     diagUnknown,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertRules(t, []healthcheck.Rule{filestoreUnreachable}, tc.snapshot, map[string]want{"FILESTORE_UNREACHABLE": tc.want})
		})
	}
}
