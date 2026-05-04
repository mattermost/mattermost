// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package elasticsearch

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/api4"
)

func TestElasticSearchIndexerJobIsEnabled(t *testing.T) {
	t.Run("ElasticSearch feature is enabled then job is enabled", func(t *testing.T) {
		th := api4.SetupEnterpriseWithStoreMock(t)

		th.Server.SetLicense(model.NewTestLicense("elastic_search"))

		esImpl := &ElasticsearchIndexerInterfaceImpl{
			Server: th.Server,
		}
		worker := esImpl.MakeWorker()

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

		esImpl := &ElasticsearchIndexerInterfaceImpl{
			Server: th.Server,
		}
		worker := esImpl.MakeWorker()

		config := &model.Config{
			ElasticsearchSettings: model.ElasticsearchSettings{
				EnableIndexing: model.NewPointer(true),
			},
		}

		result := worker.IsEnabled(config)

		assert.Equal(t, result, false)
	})
}

// TestElasticsearchDeleteNonExistentDocument verifies that bulk deletes returning
// 404 (document not found) do not cause the indexing job to fail. A soft-deleted
// post that was never indexed is used so the delete operation is guaranteed to 404.
//
// Requires a running Elasticsearch instance (skipped otherwise).
func TestElasticsearchDeleteNonExistentDocument(t *testing.T) {
	th := api4.SetupEnterprise(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ElasticsearchSettings.EnableIndexing = true
		*cfg.ElasticsearchSettings.EnableSearching = true
		*cfg.ElasticsearchSettings.EnableAutocomplete = true
		*cfg.SqlSettings.DisableDatabaseSearch = true
	})
	th.App.Srv().SetLicense(model.NewTestLicense())

	client := createTestClient(t, th.Context, th.App.Config(), th.App.FileBackend())
	ctx := context.Background()

	_, err := client.Info().Do(ctx)
	if err != nil {
		t.Skipf("Elasticsearch not available at %s: %v", *th.App.Config().ElasticsearchSettings.ConnectionURL, err)
	}

	// Soft-delete a post so the job issues a bulk delete for it. Since the index
	// is empty (no prior reindex), the document doesn't exist and ES returns 404.
	_, appErr := th.App.DeletePost(th.Context, th.BasicPost.Id, th.BasicUser.Id)
	require.Nil(t, appErr)

	impl := ElasticsearchIndexerInterfaceImpl{Server: th.App.Srv()}
	worker := impl.MakeWorker()
	require.NotNil(t, worker)
	th.Server.Jobs.RegisterJobType(model.JobTypeElasticsearchPostIndexing, worker, nil)

	go worker.Run()
	defer worker.Stop()

	job, appErr := th.App.Srv().Jobs.CreateJob(th.Context, model.JobTypeElasticsearchPostIndexing, map[string]string{})
	require.Nil(t, appErr)
	worker.JobChannel() <- *job
	job = waitForElasticsearchJob(t, th, job.Id, 60*time.Second)
	assert.Equal(t, model.JobStatusSuccess, job.Status, "reindex with 404 deletes should succeed")
}

// TestElasticsearchIndexerBulkWriteFailures verifies that a reindex job is marked
// as failed when Elasticsearch rejects bulk writes with per-item errors (e.g. a
// write block on the index), rather than silently reporting success.
//
// Requires a running Elasticsearch instance (skipped otherwise).
func TestElasticsearchIndexerBulkWriteFailures(t *testing.T) {
	th := api4.SetupEnterprise(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ElasticsearchSettings.EnableIndexing = true
		*cfg.ElasticsearchSettings.EnableSearching = true
		*cfg.ElasticsearchSettings.EnableAutocomplete = true
		*cfg.SqlSettings.DisableDatabaseSearch = true
	})
	th.App.Srv().SetLicense(model.NewTestLicense())

	client := createTestClient(t, th.Context, th.App.Config(), th.App.FileBackend())
	ctx := context.Background()

	// Skip if Elasticsearch is not reachable.
	_, err := client.Info().Do(ctx)
	if err != nil {
		t.Skipf("Elasticsearch not available at %s: %v", *th.App.Config().ElasticsearchSettings.ConnectionURL, err)
	}

	impl := ElasticsearchIndexerInterfaceImpl{Server: th.App.Srv()}
	worker := impl.MakeWorker()
	require.NotNil(t, worker)
	th.Server.Jobs.RegisterJobType(model.JobTypeElasticsearchPostIndexing, worker, nil)

	go worker.Run()
	defer worker.Stop()

	// Phase 1: clean reindex so the indices exist.
	job, appErr := th.App.Srv().Jobs.CreateJob(th.Context, model.JobTypeElasticsearchPostIndexing, map[string]string{})
	require.Nil(t, appErr)
	worker.JobChannel() <- *job
	job = waitForElasticsearchJob(t, th, job.Id, 60*time.Second)
	require.Equal(t, model.JobStatusSuccess, job.Status, "initial reindex should succeed")

	// Collect the indices that were created (skip internal dot-prefixed ones).
	indexMap, err := client.Indices.Get("*").Do(ctx)
	require.NoError(t, err)
	var indexNames []string
	for name := range indexMap {
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
		_, putErr := client.Indices.PutSettings().
			Indices(strings.Join(indexNames, ",")).
			Raw(strings.NewReader(body)).
			Do(ctx)
		require.NoError(t, putErr, "failed to set write block=%v", blocked)
	}
	setWriteBlock(true)
	defer setWriteBlock(false)

	// Phase 2: reindex against write-blocked indices — job must be marked as error.
	job, appErr = th.App.Srv().Jobs.CreateJob(th.Context, model.JobTypeElasticsearchPostIndexing, map[string]string{})
	require.Nil(t, appErr)
	worker.JobChannel() <- *job
	job = waitForElasticsearchJob(t, th, job.Id, 60*time.Second)
	assert.Equal(t, model.JobStatusError, job.Status, "reindex against write-blocked indices should fail")
}

// waitForElasticsearchJob polls the job store until the job reaches a terminal
// status or the timeout expires.
func waitForElasticsearchJob(t *testing.T, th *api4.TestHelper, jobID string, timeout time.Duration) *model.Job {
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

func TestElasticSearchIndexerPending(t *testing.T) {
	th := api4.SetupEnterprise(t).InitBasic(t)

	// Set up the state for the tests.
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ElasticsearchSettings.EnableIndexing = true
		*cfg.ElasticsearchSettings.EnableSearching = true
		*cfg.ElasticsearchSettings.EnableAutocomplete = true
		*cfg.SqlSettings.DisableDatabaseSearch = true
	})
	th.App.Srv().SetLicense(model.NewTestLicense())

	impl := ElasticsearchIndexerInterfaceImpl{
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
