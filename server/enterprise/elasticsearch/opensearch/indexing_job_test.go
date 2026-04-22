// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package opensearch

import (
	"context"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/opensearch-project/opensearch-go/v4/opensearchapi"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/api4"
)

func TestOpenSearchIndexerJobIsEnabled(t *testing.T) {
	t.Run("ElasticSearch feature is enabled then job is enabled", func(t *testing.T) {
		th := api4.SetupEnterpriseWithStoreMock(t)

		th.Server.SetLicense(model.NewTestLicense("elastic_search"))

		osImpl := &OpensearchIndexerInterfaceImpl{
			Server: th.Server,
		}
		worker := osImpl.MakeWorker()

		config := &model.Config{
			ElasticsearchSettings: model.ElasticsearchSettings{
				EnableIndexing: model.NewPointer(true),
			},
		}

		result := worker.IsEnabled(config)

		assert.Equal(t, result, true)
	})

	t.Run("there is NO license then job is disabled", func(t *testing.T) {
		th := api4.SetupEnterpriseWithStoreMock(t)

		th.Server.SetLicense(nil)

		osImpl := &OpensearchIndexerInterfaceImpl{
			Server: th.Server,
		}
		worker := osImpl.MakeWorker()

		config := &model.Config{
			ElasticsearchSettings: model.ElasticsearchSettings{
				EnableIndexing: model.NewPointer(true),
			},
		}

		result := worker.IsEnabled(config)

		assert.Equal(t, result, false)
	})
}

// TestOpenSearchIndexerBulkWriteFailures verifies that a reindex job is marked as
// failed when OpenSearch rejects bulk writes with per-item errors (e.g. a write
// block on the index), rather than silently reporting success.
//
// Requires a running OpenSearch instance (skipped otherwise).
func TestOpenSearchIndexerBulkWriteFailures(t *testing.T) {
	th := api4.SetupEnterprise(t).InitBasic(t)

	connURL := "http://localhost:9201"
	if os.Getenv("IS_CI") == "true" {
		connURL = "http://opensearch:9201"
	}

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ElasticsearchSettings.ConnectionURL = connURL
		*cfg.ElasticsearchSettings.Backend = model.ElasticsearchSettingsOSBackend
		*cfg.ElasticsearchSettings.EnableIndexing = true
		*cfg.ElasticsearchSettings.EnableSearching = true
		*cfg.ElasticsearchSettings.EnableAutocomplete = true
		*cfg.SqlSettings.DisableDatabaseSearch = true
	})
	th.App.Srv().SetLicense(model.NewTestLicense())

	client := createTestClient(t, th.Context, th.App.Config(), th.App.FileBackend())

	// Skip if OpenSearch is not reachable.
	_, err := client.Info(context.Background(), nil)
	if err != nil {
		t.Skipf("OpenSearch not available at %s: %v", connURL, err)
	}

	impl := OpensearchIndexerInterfaceImpl{Server: th.App.Srv()}
	worker := impl.MakeWorker()
	require.NotNil(t, worker)
	th.Server.Jobs.RegisterJobType(model.JobTypeElasticsearchPostIndexing, worker, nil)

	go worker.Run()
	defer worker.Stop()

	// Phase 1: clean reindex so the indices exist.
	job, appErr := th.App.Srv().Jobs.CreateJob(th.Context, model.JobTypeElasticsearchPostIndexing, map[string]string{})
	require.Nil(t, appErr)
	worker.JobChannel() <- *job
	job = waitForIndexingJob(t, th, job.Id, 60*time.Second)
	require.Equal(t, model.JobStatusSuccess, job.Status, "initial reindex should succeed")

	// Collect the indices that were created (skip internal dot-prefixed ones).
	settingsResp, err := client.Indices.Settings.Get(context.Background(), &opensearchapi.SettingsGetReq{})
	require.NoError(t, err)
	var indexNames []string
	for name := range settingsResp.Indices {
		if !strings.HasPrefix(name, ".") {
			indexNames = append(indexNames, name)
		}
	}
	require.NotEmpty(t, indexNames, "initial reindex should have created at least one index")

	// Apply a write block to all Mattermost indices and remove it on cleanup.
	setWriteBlock := func(blocked bool) {
		body := `{"index.blocks.write":true}`
		if !blocked {
			body = `{"index.blocks.write":false}`
		}
		for _, idx := range indexNames {
			_, putErr := client.Indices.Settings.Put(context.Background(), opensearchapi.SettingsPutReq{
				Indices: []string{idx},
				Body:    strings.NewReader(body),
			})
			require.NoError(t, putErr, "failed to set write block=%v on index %s", blocked, idx)
		}
	}
	setWriteBlock(true)
	defer setWriteBlock(false)

	// Phase 2: reindex against write-blocked indices — job must be marked as error.
	job, appErr = th.App.Srv().Jobs.CreateJob(th.Context, model.JobTypeElasticsearchPostIndexing, map[string]string{})
	require.Nil(t, appErr)
	worker.JobChannel() <- *job
	job = waitForIndexingJob(t, th, job.Id, 60*time.Second)
	assert.Equal(t, model.JobStatusError, job.Status, "reindex against write-blocked indices should fail")
}

// waitForIndexingJob polls the job store until the job reaches a terminal status
// or the timeout expires.
func waitForIndexingJob(t *testing.T, th *api4.TestHelper, jobID string, timeout time.Duration) *model.Job {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		job, err := th.App.Srv().Store().Job().Get(th.Context, jobID)
		require.NoError(t, err)
		switch job.Status {
		case model.JobStatusSuccess, model.JobStatusError, model.JobStatusCanceled:
			return job
		}
		time.Sleep(250 * time.Millisecond)
	}
	t.Fatalf("job %s did not reach a terminal status within %s", jobID, timeout)
	return nil
}

func TestOpenSearchIndexerPending(t *testing.T) {
	th := api4.SetupEnterprise(t).InitBasic(t)

	// Set up the state for the tests.
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ElasticsearchSettings.EnableIndexing = true
		*cfg.ElasticsearchSettings.EnableSearching = true
		*cfg.ElasticsearchSettings.EnableAutocomplete = true
		*cfg.SqlSettings.DisableDatabaseSearch = true
	})
	th.App.Srv().SetLicense(model.NewTestLicense())

	impl := OpensearchIndexerInterfaceImpl{
		Server: th.App.Srv(),
	}

	worker := impl.MakeWorker()
	th.Server.Jobs.RegisterJobType(model.JobTypeElasticsearchPostIndexing, worker, nil)

	go worker.Run()

	job, appErr := th.App.Srv().Jobs.CreateJob(th.Context, model.JobTypeElasticsearchPostIndexing, map[string]string{})
	require.Nil(t, appErr)

	worker.JobChannel() <- *job

	worker.Stop()

	job, err := th.App.Srv().Store().Job().Get(th.Context, job.Id)
	require.NoError(t, err)
	assert.Equal(t, job.Status, model.JobStatusPending)
}
