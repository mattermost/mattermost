// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package elasticsearch

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/elastic/go-elasticsearch/v8"
	"github.com/elastic/go-elasticsearch/v8/typedapi/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/api4"
	"github.com/mattermost/mattermost/server/v8/enterprise/elasticsearch/common"
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
				EnableIndexing: new(true),
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
				EnableIndexing: new(true),
			},
		}

		result := worker.IsEnabled(config)

		assert.Equal(t, result, false)
	})
}

// setupElasticsearchIndexerThroughRecorder points the server at Elasticsearch
// through a common.BulkDeleteRecorder, using an index prefix unique to the test
// so that its indexes start out missing, as they are after a purge. It returns a
// running indexer worker, a client for direct assertions, the recorder and the
// index prefix.
//
// Skips the test if Elasticsearch is not available.
func setupElasticsearchIndexerThroughRecorder(t *testing.T, th *api4.TestHelper) (model.Worker, *elasticsearch.TypedClient, *common.BulkDeleteRecorder, string) {
	t.Helper()

	connURL := *th.App.Config().ElasticsearchSettings.ConnectionURL
	rec := common.NewBulkDeleteRecorder(t, connURL)
	indexPrefix := "test" + model.NewId()[:8] + "_"

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ElasticsearchSettings.ConnectionURL = rec.URL
		*cfg.ElasticsearchSettings.Sniff = false
		*cfg.ElasticsearchSettings.IndexPrefix = indexPrefix
		*cfg.ElasticsearchSettings.EnableIndexing = true
	})
	th.App.Srv().SetLicense(model.NewTestLicense())

	client := createTestClient(t, th.Context, th.App.Config(), th.App.FileBackend())
	if _, err := client.Info().Do(context.Background()); err != nil {
		t.Skipf("Elasticsearch not available at %s: %v", connURL, err)
	}
	t.Cleanup(func() {
		_, _ = client.Indices.Delete(indexPrefix + "*").Do(context.Background())
	})

	impl := ElasticsearchIndexerInterfaceImpl{Server: th.App.Srv()}
	worker := impl.MakeWorker()
	require.NotNil(t, worker)
	th.Server.Jobs.RegisterJobType(model.JobTypeElasticsearchPostIndexing, worker, nil)
	go worker.Run()
	t.Cleanup(worker.Stop)

	return worker, client, rec, indexPrefix
}

func runElasticsearchIndexingJob(t *testing.T, th *api4.TestHelper, worker model.Worker) *model.Job {
	t.Helper()
	job, appErr := th.App.Srv().Jobs.CreateJob(th.Context, model.JobTypeElasticsearchPostIndexing, map[string]string{})
	require.Nil(t, appErr)
	worker.JobChannel() <- *job
	return waitForElasticsearchJob(t, th, job.Id, 60*time.Second)
}

func countIndexedPosts(t *testing.T, client *elasticsearch.TypedClient, indexPrefix string, postIDs ...string) int64 {
	t.Helper()
	postIndexes := indexPrefix + common.IndexBasePosts + "*"
	_, err := client.Indices.Refresh().Index(postIndexes).Do(context.Background())
	require.NoError(t, err)

	resp, err := client.Count().Index(postIndexes).Query(&types.Query{Ids: &types.IdsQuery{Values: postIDs}}).Do(context.Background())
	require.NoError(t, err)
	return resp.Count
}

// softDeletePost marks a post as deleted in the database only, as if it had been
// deleted while live indexing was unavailable.
func softDeletePost(t *testing.T, th *api4.TestHelper, post *model.Post) {
	t.Helper()
	require.NoError(t, th.App.Srv().Store().Post().Delete(th.Context, post.Id, model.GetMillis(), th.BasicUser.Id))
}

// TestElasticsearchIndexerSkipsDeletesForEmptyIndexes verifies that a reindex
// into empty indexes, such as after a purge, sends no delete operations for
// soft-deleted posts, while a reindex into populated indexes still deletes them.
//
// Requires a running Elasticsearch instance (skipped otherwise).
func TestElasticsearchIndexerSkipsDeletesForEmptyIndexes(t *testing.T) {
	th := api4.SetupEnterprise(t).InitBasic(t)
	postDeletedBeforeRebuild := th.CreatePost(t)
	postDeletedAfterRebuild := th.CreatePost(t)

	worker, client, rec, indexPrefix := setupElasticsearchIndexerThroughRecorder(t, th)

	softDeletePost(t, th, postDeletedBeforeRebuild)

	job := runElasticsearchIndexingJob(t, th, worker)
	require.Equal(t, model.JobStatusSuccess, job.Status)
	assert.Empty(t, rec.DeletedIDs(), "a rebuild into empty indexes should not send delete operations")
	assert.Equal(t, int64(2), countIndexedPosts(t, client, indexPrefix, th.BasicPost.Id, postDeletedAfterRebuild.Id))
	assert.Zero(t, countIndexedPosts(t, client, indexPrefix, postDeletedBeforeRebuild.Id))

	softDeletePost(t, th, postDeletedAfterRebuild)

	job = runElasticsearchIndexingJob(t, th, worker)
	require.Equal(t, model.JobStatusSuccess, job.Status)
	assert.ElementsMatch(t, []string{postDeletedBeforeRebuild.Id, postDeletedAfterRebuild.Id}, rec.DeletedIDs(),
		"a reindex into populated indexes should send delete operations for soft-deleted posts")
	assert.Zero(t, countIndexedPosts(t, client, indexPrefix, postDeletedAfterRebuild.Id), "the stale document should be removed")
	assert.Equal(t, int64(1), countIndexedPosts(t, client, indexPrefix, th.BasicPost.Id))
}

// TestElasticsearchDeleteNonExistentDocument verifies that bulk deletes returning
// 404 (document not found) do not cause the indexing job to fail. A soft-deleted
// post that was never indexed is used so the delete operation is guaranteed to 404.
//
// Requires a running Elasticsearch instance (skipped otherwise).
func TestElasticsearchDeleteNonExistentDocument(t *testing.T) {
	th := api4.SetupEnterprise(t).InitBasic(t)

	worker, _, rec, _ := setupElasticsearchIndexerThroughRecorder(t, th)

	// Populate the indexes first: deletes are only sent to indexes that are not empty.
	job := runElasticsearchIndexingJob(t, th, worker)
	require.Equal(t, model.JobStatusSuccess, job.Status)

	neverIndexedPost, err := th.App.Srv().Store().Post().Save(th.Context, &model.Post{
		ChannelId: th.BasicChannel.Id,
		UserId:    th.BasicUser.Id,
		Message:   "never indexed",
		DeleteAt:  model.GetMillis(),
	})
	require.NoError(t, err)

	job = runElasticsearchIndexingJob(t, th, worker)
	require.Contains(t, rec.DeletedIDs(), neverIndexedPost.Id)
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
