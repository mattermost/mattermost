// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model_test

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/goccy/go-yaml"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/app/platform"
)

const supportPacketGoldenDir = "testdata/support_packet_typed_collectors"

var diagnosticsComments = yaml.CommentMap{
	"$.server.os":                                        {yaml.HeadComment(" Machine")},
	"$.server.cpu_cores":                                 {yaml.HeadComment(" Capacity (hardware → effective quota)"), yaml.LineComment(" logical CPUs visible to the OS")},
	"$.server.total_memory_mb":                           {yaml.LineComment(" host/VM total RAM; may exceed container limit")},
	"$.server.container_cpu_limit":                       {yaml.LineComment(" cgroup v2 CPU quota in CPUs; Linux only, omitted if no limit set")},
	"$.server.container_memory_limit_mb":                 {yaml.LineComment(" cgroup v2 memory quota in MB; Linux only, omitted if no limit set")},
	"$.server.process_id":                                {yaml.HeadComment(" Process lifecycle")},
	"$.server.started_at":                                {yaml.LineComment(" when Mattermost process started")},
	"$.server.host_started_at":                           {yaml.LineComment(" when the host OS booted; omitted if unavailable")},
	"$.server.open_file_descriptors":                     {yaml.LineComment(" current open FDs for this process")},
	"$.server.max_file_descriptors":                      {yaml.LineComment(" system limit (ulimit -n)")},
	"$.server.version":                                   {yaml.HeadComment(" Software")},
	"$.database.master_pool_wait_count":                  {yaml.LineComment(" cumulative; total times a goroutine waited for a connection since process start")},
	"$.database.master_pool_wait_duration_ms":            {yaml.LineComment(" cumulative wait time across all goroutines since process start")},
	"$.database.master_connections_closed_max_idle":      {yaml.LineComment(" cumulative; connections closed because the idle pool was full")},
	"$.database.master_connections_closed_max_lifetime":  {yaml.LineComment(" cumulative; connections closed for exceeding ConnMaxLifetime")},
	"$.database.replica_pool_wait_count":                 {yaml.LineComment(" cumulative across all replicas; see master_pool_wait_count")},
	"$.database.replica_pool_wait_duration_ms":           {yaml.LineComment(" cumulative across all replicas")},
	"$.database.replica_connections_closed_max_idle":     {yaml.LineComment(" cumulative across all replicas")},
	"$.database.replica_connections_closed_max_lifetime": {yaml.LineComment(" cumulative across all replicas")},
	"$.database.cache_hit_ratio":                         {yaml.HeadComment(" PostgreSQL-only (these fields are omitted on MySQL)"), yaml.LineComment(" blks_hit / (blks_hit + blks_read) from pg_stat_database; cumulative since stats reset")},
	"$.database.deadlocks":                               {yaml.LineComment(" cumulative since pg_stat_database reset")},
	"$.database.temp_files":                              {yaml.LineComment(" cumulative count of temp files created since stats reset")},
	"$.database.temp_bytes_mb":                           {yaml.LineComment(" cumulative bytes written to temp files, in MB")},
	"$.database.rollbacks":                               {yaml.LineComment(" cumulative transaction rollbacks since stats reset")},
	"$.database.idle_in_transaction_count":               {yaml.LineComment(" point-in-time count from pg_stat_activity")},
	"$.database.longest_query_duration_seconds":          {yaml.LineComment(" point-in-time; max age of any active query right now")},
	"$.database.waiting_for_lock_count":                  {yaml.LineComment(" point-in-time count of backends waiting on a Lock wait_event_type")},
	"$.database.posts_dead_tuples":                       {yaml.LineComment(" n_dead_tup for the posts table from pg_stat_user_tables")},
	"$.database.posts_last_autovacuum":                   {yaml.LineComment(" last autovacuum on posts; null if never autovacuumed (then omitted)")},
	"$.file_store.filesystem_type":                       {yaml.LineComment(" local driver only (e.g. ext4, xfs); omitted for s3 and other remote drivers")},
	"$.file_store.total_mb":                              {yaml.LineComment(" local driver only; capacity of the volume hosting FileSettings.Directory")},
	"$.file_store.available_mb":                          {yaml.LineComment(" local driver only; free space remaining on that volume")},
}

func TestSupportPacketMarshalGolden(t *testing.T) {
	t.Parallel()

	statsCount := int64(42)
	dailyActive := int64(15)

	jobFactory := func(id, jobType string) *model.Job {
		return &model.Job{
			Id:             id,
			Type:           jobType,
			CreateAt:       1111,
			StartAt:        2222,
			LastActivityAt: 3333,
			Status:         model.JobStatusSuccess,
			Data:           model.StringMap{"result": "ok"},
		}
	}

	role := &model.Role{
		Id:          "role-id",
		Name:        "team_admin",
		Permissions: []string{"manage_system", "manage_team"},
	}

	scheme := &model.Scheme{
		Id:          "scheme-id",
		Name:        "scheme-name",
		DisplayName: "Scheme Name",
		Scope:       model.SchemeScopeTeam,
	}

	cacheHitRatio := 0.99
	deadlocks := int64(3)
	tempFiles := int64(4)
	tempBytesMB := 12.5
	rollbacks := int64(2)
	idleInTxCount := int64(1)
	longestQuerySeconds := 7.25
	waitingForLock := int64(5)
	postsDeadTuples := int64(9)
	postsLastAutovacuum := time.Date(2026, 7, 10, 12, 13, 14, 0, time.UTC)

	diagnostics := &model.SupportPacketDiagnostics{
		Version: 2,
	}
	diagnostics.License.Company = "Example Co"
	diagnostics.License.Users = 150
	diagnostics.License.SkuShortName = "enterprise"
	diagnostics.License.IsTrial = true
	diagnostics.License.IsNonProduction = true
	diagnostics.Server.OS = "linux"
	diagnostics.Server.Architecture = "amd64"
	diagnostics.Server.Hostname = "mm-host"
	diagnostics.Server.InstallationType = "docker"
	diagnostics.Server.CPUCores = 8
	diagnostics.Server.TotalMemoryMB = 32768
	diagnostics.Server.ContainerCPULimit = 6.5
	diagnostics.Server.ContainerMemoryLimitMB = 16384
	diagnostics.Server.ProcessID = 90210
	diagnostics.Server.StartedAt = time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	diagnostics.Server.HostStartedAt = time.Date(2025, 12, 30, 0, 0, 0, 0, time.UTC)
	diagnostics.Server.OpenFileDescriptors = 512
	diagnostics.Server.MaxFileDescriptors = 8192
	diagnostics.Server.Version = "11.0.0"
	diagnostics.Server.BuildHash = "abc123"
	diagnostics.Server.GoVersion = "go1.26"
	diagnostics.Config.Source = "memory://"
	diagnostics.Database.Type = "postgres"
	diagnostics.Database.Version = "16.4"
	diagnostics.Database.SchemaVersion = "123"
	diagnostics.Database.MasterConnections = 40
	diagnostics.Database.ReplicaConnections = 20
	diagnostics.Database.SearchConnections = 10
	diagnostics.Database.MasterConnectionsInUse = 5
	diagnostics.Database.MasterConnectionsIdle = 35
	diagnostics.Database.MasterPoolWaitCount = 100
	diagnostics.Database.MasterPoolWaitDurationMs = 220
	diagnostics.Database.MasterConnectionsClosedMaxIdle = 2
	diagnostics.Database.MasterConnectionsClosedMaxLifetime = 1
	diagnostics.Database.ReplicaConnectionsInUse = 3
	diagnostics.Database.ReplicaConnectionsIdle = 17
	diagnostics.Database.ReplicaPoolWaitCount = 12
	diagnostics.Database.ReplicaPoolWaitDurationMs = 66
	diagnostics.Database.ReplicaConnectionsClosedMaxIdle = 4
	diagnostics.Database.ReplicaConnectionsClosedMaxLifetime = 3
	diagnostics.Database.CacheHitRatio = &cacheHitRatio
	diagnostics.Database.Deadlocks = &deadlocks
	diagnostics.Database.TempFiles = &tempFiles
	diagnostics.Database.TempBytesMB = &tempBytesMB
	diagnostics.Database.Rollbacks = &rollbacks
	diagnostics.Database.IdleInTransactionCount = &idleInTxCount
	diagnostics.Database.LongestQueryDurationSeconds = &longestQuerySeconds
	diagnostics.Database.WaitingForLockCount = &waitingForLock
	diagnostics.Database.PostsDeadTuples = &postsDeadTuples
	diagnostics.Database.PostsLastAutovacuum = &postsLastAutovacuum
	diagnostics.FileStore.Status = model.StatusOk
	diagnostics.FileStore.Driver = model.ImageDriverLocal
	diagnostics.FileStore.FilesystemType = "ext4"
	diagnostics.FileStore.TotalMB = 204800
	diagnostics.FileStore.AvailableMB = 102400
	diagnostics.Websocket.Connections = 77
	diagnostics.Cluster.ID = "cluster-id"
	diagnostics.Cluster.NumberOfNodes = 3
	diagnostics.Notifications.Email.Status = model.StatusOk
	diagnostics.Notifications.Push.Status = model.StatusFail
	diagnostics.Notifications.Push.Error = "proxy timeout"
	diagnostics.LDAP.Status = model.StatusOk
	diagnostics.LDAP.ServerName = "OpenLDAP"
	diagnostics.LDAP.ServerVersion = "2.6"
	diagnostics.SAML.ProviderType = "Keycloak"
	diagnostics.SAML.Status = model.StatusDisabled
	diagnostics.ElasticSearch.Status = model.StatusOk
	diagnostics.ElasticSearch.Backend = model.ElasticsearchSettingsESBackend
	diagnostics.ElasticSearch.ServerVersion = "8.0.0"
	diagnostics.ElasticSearch.ServerPlugins = []string{"analysis-icu", "ingest-attachment"}
	diagnostics.OAuthProviders.GitLab = model.OAuthProviderStatus{Status: model.StatusOk}
	diagnostics.OAuthProviders.Google = model.OAuthProviderStatus{Status: model.StatusFail, Error: "dial tcp timeout"}
	diagnostics.OAuthProviders.Office365 = model.OAuthProviderStatus{Status: model.StatusDisabled}
	diagnostics.OAuthProviders.OpenID = model.OAuthProviderStatus{Status: model.StatusOk}

	cases := []struct {
		name     string
		filename string
		marshal  func() (*model.FileData, error)
	}{
		{
			name:     "metadata",
			filename: "metadata.yaml",
			marshal: func() (*model.FileData, error) {
				return platform.YAMLFile(model.PacketMetadataFileName, &model.PacketMetadata{
					Version:       1,
					Type:          model.SupportPacketType,
					GeneratedAt:   1735689600000,
					ServerVersion: "11.0.0",
					ServerID:      "server-id-fixed",
					LicenseID:     "license-id-fixed",
					CustomerID:    "customer-id-fixed",
					Extras: map[string]any{
						"region": "us-east",
						"tier":   "enterprise",
					},
				}, nil)
			},
		},
		{
			name:     "stats",
			filename: "stats.yaml",
			marshal: func() (*model.FileData, error) {
				return platform.YAMLFile("stats.yaml", &model.SupportPacketStats{
					RegisteredUsers:  &statsCount,
					DailyActiveUsers: &dailyActive,
				}, nil)
			},
		},
		{
			name:     "jobs",
			filename: "jobs.yaml",
			marshal: func() (*model.FileData, error) {
				return platform.YAMLFile("jobs.yaml", &model.SupportPacketJobList{
					LDAPSyncJobs:               []*model.Job{jobFactory("job-ldap", model.JobTypeLdapSync)},
					DataRetentionJobs:          []*model.Job{jobFactory("job-retention", model.JobTypeDataRetention)},
					MessageExportJobs:          []*model.Job{jobFactory("job-export", model.JobTypeMessageExport)},
					ElasticPostIndexingJobs:    []*model.Job{jobFactory("job-index", model.JobTypeElasticsearchPostIndexing)},
					ElasticPostAggregationJobs: []*model.Job{jobFactory("job-agg", model.JobTypeElasticsearchPostAggregation)},
					MigrationJobs:              []*model.Job{jobFactory("job-migrate", model.JobTypeMigrations)},
				}, nil)
			},
		},
		{
			name:     "permissions",
			filename: "permissions.yaml",
			marshal: func() (*model.FileData, error) {
				return platform.YAMLFile("permissions.yaml", &model.SupportPacketPermissionInfo{
					Roles:   []*model.Role{role},
					Schemes: []*model.Scheme{scheme},
				}, nil)
			},
		},
		{
			name:     "plugins",
			filename: "plugins.json",
			marshal: func() (*model.FileData, error) {
				return platform.JSONFile("plugins.json", &model.SupportPacketPluginList{
					Enabled: []model.Manifest{
						{Id: "com.mattermost.enabled", Name: "Enabled Plugin", Version: "1.2.3"},
					},
					Disabled: []model.Manifest{
						{Id: "com.mattermost.disabled", Name: "Disabled Plugin", Version: "2.3.4"},
					},
				}, nil)
			},
		},
		{
			name:     "diagnostics",
			filename: "diagnostics.yaml",
			marshal: func() (*model.FileData, error) {
				return platform.YAMLFile("diagnostics.yaml", diagnostics, nil, yaml.WithComment(diagnosticsComments))
			},
		},
		{
			name:     "config",
			filename: "sanitized_config.json",
			marshal: func() (*model.FileData, error) {
				return platform.JSONFile("sanitized_config.json", &model.SupportPacketConfig{
					Config: &model.Config{
						ServiceSettings: model.ServiceSettings{
							SiteURL: model.NewPointer("https://example.test"),
						},
						FeatureFlags: &model.FeatureFlags{TestFeature: "true"},
					},
					FeatureFlags: model.FeatureFlags{TestFeature: "true"},
				}, nil)
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			fileData, err := tc.marshal()
			require.NoError(t, err)
			require.NotNil(t, fileData)
			actual := fileData.Body

			goldenPath := filepath.Join(supportPacketGoldenDir, tc.filename)
			if os.Getenv("MM_WRITE_SUPPORT_PACKET_GOLDEN") == "1" {
				require.NoError(t, os.MkdirAll(filepath.Dir(goldenPath), 0o755))
				require.NoError(t, os.WriteFile(goldenPath, actual, 0o644))
			}

			expected, err := os.ReadFile(goldenPath)
			require.NoError(t, err)
			require.Equal(t, string(expected), string(actual))
		})
	}
}

func TestSupportPacketYAMLFileAndJSONFile(t *testing.T) {
	t.Parallel()

	t.Run("YAMLFile returns file and accumulated error", func(t *testing.T) {
		type payload struct {
			Value string `yaml:"value"`
		}

		collectorErr := errors.New("collector failed")
		fileData, err := platform.YAMLFile("stats.yaml", &payload{Value: "ok"}, collectorErr)
		require.NotNil(t, fileData)
		require.Error(t, err)
		require.ErrorContains(t, err, "collector failed")
		require.Equal(t, "stats.yaml", fileData.Filename)
		require.NotEmpty(t, fileData.Body)
	})

	t.Run("JSONFile returns file and accumulated error", func(t *testing.T) {
		type payload struct {
			Value string `json:"value"`
		}

		collectorErr := errors.New("collector failed")
		fileData, err := platform.JSONFile("plugins.json", &payload{Value: "ok"}, collectorErr)
		require.NotNil(t, fileData)
		require.Error(t, err)
		require.ErrorContains(t, err, "collector failed")
		require.Equal(t, "plugins.json", fileData.Filename)
		require.NotEmpty(t, fileData.Body)
	})

	t.Run("nil value returns nil file and original error", func(t *testing.T) {
		collectorErr := errors.New("collector failed")
		type payload struct {
			Value string `yaml:"value"`
		}

		fileData, err := platform.YAMLFile[payload]("stats.yaml", nil, collectorErr)
		require.Nil(t, fileData)
		require.ErrorIs(t, err, collectorErr)
	})

	t.Run("marshal error is appended to collector error", func(t *testing.T) {
		type badPayload struct {
			Bad chan int `json:"bad" yaml:"bad"`
		}

		collectorErr := errors.New("collector failed")
		fileData, err := platform.JSONFile("bad.json", &badPayload{Bad: make(chan int)}, collectorErr)
		require.NotNil(t, fileData)
		require.Error(t, err)
		require.ErrorContains(t, err, "collector failed")
		require.ErrorContains(t, err, "failed to marshal bad.json into json")
	})

	t.Run("yaml marshal error is appended to collector error", func(t *testing.T) {
		type badPayload struct {
			Bad chan int `json:"bad" yaml:"bad"`
		}

		collectorErr := errors.New("collector failed")
		fileData, err := platform.YAMLFile("bad.yaml", &badPayload{Bad: make(chan int)}, collectorErr)
		require.NotNil(t, fileData)
		require.Error(t, err)
		require.ErrorContains(t, err, "collector failed")
		require.ErrorContains(t, err, "failed to marshal bad.yaml into yaml")
	})
}
