// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"
)

// TestHealthCheckReadsFromMaster verifies that the reads behind starting a health check run and
// reloading its results go to master. A client reloads the findings as soon as a run reports
// success, and Run now decides from the active run whether to start one, so a lagging replica would
// show a previous run's findings or a finished run as still in progress. The replica is a separate,
// empty database, so a read from it would find nothing.
func TestHealthCheckReadsFromMaster(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping test in short mode")
	}

	logger := mlog.CreateTestLogger(t)

	masterSettings, err := makeSqlSettings(model.DatabaseDriverPostgres)
	if err != nil {
		t.Skip(err)
	}
	defer storetest.CleanupSqlSettings(masterSettings)

	replicaSettings, err := makeSqlSettings(model.DatabaseDriverPostgres)
	if err != nil {
		t.Skip(err)
	}
	defer storetest.CleanupSqlSettings(replicaSettings)

	replicaStore, err := New(*replicaSettings, logger, nil)
	require.NoError(t, err)
	replicaStore.Close()

	masterSettings.DataSourceReplicas = []string{*replicaSettings.DataSource}

	ss, err := New(*masterSettings, logger, nil)
	require.NoError(t, err)
	defer ss.Close()

	// Without a license, GetReplica() falls back to master and the test would prove nothing.
	ss.UpdateLicense(&model.License{})
	require.NotSame(t, ss.GetMaster(), ss.GetReplica(), "replica must be a distinct connection for this test to be meaningful")

	job, err := ss.Job().Save(&model.Job{
		Id:       model.NewId(),
		Type:     model.JobTypeHealthCheck,
		Status:   model.JobStatusInProgress,
		CreateAt: model.GetMillis(),
	})
	require.NoError(t, err)

	require.NoError(t, ss.HealthFinding().Upsert([]*model.HealthFinding{{
		Fingerprint:     model.NewId(),
		Code:            "check_cluster_status",
		Subject:         "subject",
		Severity:        "warning",
		State:           "firing",
		Area:            model.AreaCluster,
		Surface:         "product",
		MessageID:       "health.rule.check_cluster_status.message",
		Details:         map[string]string{},
		FirstSeenAt:     1,
		LastSeenAt:      1,
		StateSince:      1,
		ConsecutiveHits: 1,
	}}))

	var replicaJobs int
	require.NoError(t, ss.GetReplica().Get(&replicaJobs, "SELECT COUNT(*) FROM Jobs"))
	require.Zero(t, replicaJobs, "replica should be empty so the test can tell master and replica reads apart")

	running, err := ss.Job().GetNewestJobByStatusAndType(model.JobStatusInProgress, model.JobTypeHealthCheck)
	require.NoError(t, err, "the active run must be read from master, not the empty replica")
	require.Equal(t, job.Id, running.Id)

	findings, err := ss.HealthFinding().List(model.HealthFindingFilter{})
	require.NoError(t, err)
	require.Len(t, findings, 1, "findings must be read from master, not the empty replica")
}
