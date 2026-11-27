// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package opensearch

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/opensearch-project/opensearch-go/v4/opensearchapi"
	"github.com/opensearch-project/opensearch-go/v4/opensearchutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/api4"
	"github.com/mattermost/mattermost/server/v8/enterprise/elasticsearch/common"
)

func TestOpenSearchIndexerClientTimesOutStalledResponse(t *testing.T) {
	release := make(chan struct{})
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"took":1,`))
		w.(http.Flusher).Flush()
		select {
		case <-r.Context().Done():
		case <-release:
		}
	}))
	t.Cleanup(ts.Close)
	t.Cleanup(func() { close(release) })

	cfg := &model.Config{}
	cfg.SetDefaults()
	cfg.ElasticsearchSettings.ConnectionURL = model.NewPointer(ts.URL)
	cfg.ElasticsearchSettings.RequestTimeoutSeconds = model.NewPointer(1)
	cfg.ElasticsearchSettings.Sniff = model.NewPointer(false)

	client, appErr := createIndexerClient(mlog.CreateConsoleTestLogger(t), cfg, nil)
	require.Nil(t, appErr)

	bi, err := opensearchutil.NewBulkIndexer(opensearchutil.BulkIndexerConfig{
		Client:     client,
		NumWorkers: 1,
		FlushBytes: 1,
	})
	require.NoError(t, err)

	var failed atomic.Int64
	err = bi.Add(context.Background(), opensearchutil.BulkIndexerItem{
		Index:      "posts",
		Action:     "index",
		DocumentID: model.NewId(),
		Body:       strings.NewReader(`{}`),
		OnFailure: func(_ context.Context, _ opensearchutil.BulkIndexerItem, _ opensearchapi.BulkRespItem, err error) {
			assert.Error(t, err)
			failed.Add(1)
		},
	})
	require.NoError(t, err)

	closeErr := make(chan error, 1)
	go func() { closeErr <- bi.Close(context.Background()) }()
	select {
	case err := <-closeErr:
		require.NoError(t, err)
	case <-time.After(10 * time.Second):
		require.FailNow(t, "bulk indexer blocked on a stalled response")
	}
	assert.Equal(t, int64(1), failed.Load())
}

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
				EnableIndexing: new(true),
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
				EnableIndexing: new(true),
			},
		}

		result := worker.IsEnabled(config)

		assert.Equal(t, result, false)
	})
}

// setupOpenSearchIndexerThroughRecorder points the server at OpenSearch through
// a common.BulkDeleteRecorder, using an index prefix unique to the test so that its
// indexes start out missing, as they are after a purge. It returns a running
// indexer worker, a client for direct assertions and the recorder.
//
// Skips the test if OpenSearch is not available.
func setupOpenSearchIndexerThroughRecorder(t *testing.T, th *api4.TestHelper) (model.Worker, *opensearchapi.Client, *common.BulkDeleteRecorder, string) {
	t.Helper()

	connURL := "http://localhost:9201"
	if os.Getenv("IS_CI") == "true" {
		connURL = "http://opensearch:9201"
	}
	rec := common.NewBulkDeleteRecorder(t, connURL)
	indexPrefix := "test" + model.NewId()[:8] + "_"

	// CI sets the connection URL through the environment, which overrides UpdateConfig.
	t.Setenv("MM_ELASTICSEARCHSETTINGS_CONNECTIONURL", rec.URL)
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ElasticsearchSettings.ConnectionURL = rec.URL
		*cfg.ElasticsearchSettings.Sniff = false
		*cfg.ElasticsearchSettings.IndexPrefix = indexPrefix
		*cfg.ElasticsearchSettings.Backend = model.ElasticsearchSettingsOSBackend
		*cfg.ElasticsearchSettings.EnableIndexing = true
	})
	th.App.Srv().SetLicense(model.NewTestLicense())

	client := createTestClient(t, th.Context, th.App.Config(), th.App.FileBackend())
	if _, err := client.Info(context.Background(), nil); err != nil {
		t.Skipf("OpenSearch not available at %s: %v", connURL, err)
	}
	t.Cleanup(func() {
		_, _ = client.Indices.Delete(context.Background(), opensearchapi.IndicesDeleteReq{Indices: []string{indexPrefix + "*"}})
	})

	impl := OpensearchIndexerInterfaceImpl{Server: th.App.Srv()}
	worker := impl.MakeWorker()
	require.NotNil(t, worker)
	th.Server.Jobs.RegisterJobType(model.JobTypeElasticsearchPostIndexing, worker, nil)
	go worker.Run()
	t.Cleanup(worker.Stop)

	return worker, client, rec, indexPrefix
}

func runIndexingJob(t *testing.T, th *api4.TestHelper, worker model.Worker) *model.Job {
	t.Helper()
	job, appErr := th.App.Srv().Jobs.CreateJob(th.Context, model.JobTypeElasticsearchPostIndexing, map[string]string{})
	require.Nil(t, appErr)
	worker.JobChannel() <- *job
	return waitForIndexingJob(t, th, job.Id, 60*time.Second)
}

func countIndexedPosts(t *testing.T, client *opensearchapi.Client, indexPrefix string, postIDs ...string) int {
	t.Helper()
	postIndexes := indexPrefix + common.IndexBasePosts + "*"
	_, err := client.Indices.Refresh(context.Background(), &opensearchapi.IndicesRefreshReq{Index: []string{postIndexes}})
	require.NoError(t, err)

	query, err := json.Marshal(map[string]any{"query": map[string]any{"ids": map[string]any{"values": postIDs}}})
	require.NoError(t, err)
	resp, err := client.Indices.Count(context.Background(), &opensearchapi.IndicesCountReq{
		Indices: []string{postIndexes},
		Body:    bytes.NewReader(query),
	})
	require.NoError(t, err)
	return resp.Count
}

// softDeletePost marks a post as deleted in the database only, as if it had been
// deleted while live indexing was unavailable.
func softDeletePost(t *testing.T, th *api4.TestHelper, post *model.Post) {
	t.Helper()
	require.NoError(t, th.App.Srv().Store().Post().Delete(th.Context, post.Id, model.GetMillis(), th.BasicUser.Id))
}

// TestOpenSearchIndexerSkipsDeletesForEmptyIndexes verifies that a reindex into
// empty indexes, such as after a purge, sends no delete operations for
// soft-deleted posts, while a reindex into populated indexes still deletes them.
//
// Requires a running OpenSearch instance (skipped otherwise).
func TestOpenSearchIndexerSkipsDeletesForEmptyIndexes(t *testing.T) {
	th := api4.SetupEnterprise(t).InitBasic(t)
	postDeletedBeforeRebuild := th.CreatePost(t)
	postDeletedAfterRebuild := th.CreatePost(t)

	worker, client, rec, indexPrefix := setupOpenSearchIndexerThroughRecorder(t, th)

	softDeletePost(t, th, postDeletedBeforeRebuild)

	job := runIndexingJob(t, th, worker)
	require.Equal(t, model.JobStatusSuccess, job.Status)
	assert.Empty(t, rec.DeletedIDs(), "a rebuild into empty indexes should not send delete operations")
	assert.Equal(t, 2, countIndexedPosts(t, client, indexPrefix, th.BasicPost.Id, postDeletedAfterRebuild.Id))
	assert.Zero(t, countIndexedPosts(t, client, indexPrefix, postDeletedBeforeRebuild.Id))

	softDeletePost(t, th, postDeletedAfterRebuild)

	job = runIndexingJob(t, th, worker)
	require.Equal(t, model.JobStatusSuccess, job.Status)
	assert.ElementsMatch(t, []string{postDeletedBeforeRebuild.Id, postDeletedAfterRebuild.Id}, rec.DeletedIDs(),
		"a reindex into populated indexes should send delete operations for soft-deleted posts")
	assert.Zero(t, countIndexedPosts(t, client, indexPrefix, postDeletedAfterRebuild.Id), "the stale document should be removed")
	assert.Equal(t, 1, countIndexedPosts(t, client, indexPrefix, th.BasicPost.Id))
}

// TestOpenSearchDeleteNonExistentDocument verifies that bulk deletes returning 404
// (document not found) do not cause the indexing job to fail. A soft-deleted post
// that was never indexed is used so the delete operation is guaranteed to 404.
//
// Requires a running OpenSearch instance (skipped otherwise).
func TestOpenSearchDeleteNonExistentDocument(t *testing.T) {
	th := api4.SetupEnterprise(t).InitBasic(t)

	worker, _, rec, _ := setupOpenSearchIndexerThroughRecorder(t, th)

	// Populate the indexes first: deletes are only sent to indexes that are not empty.
	job := runIndexingJob(t, th, worker)
	require.Equal(t, model.JobStatusSuccess, job.Status)

	neverIndexedPost, err := th.App.Srv().Store().Post().Save(th.Context, &model.Post{
		ChannelId: th.BasicChannel.Id,
		UserId:    th.BasicUser.Id,
		Message:   "never indexed",
		DeleteAt:  model.GetMillis(),
	})
	require.NoError(t, err)

	job = runIndexingJob(t, th, worker)
	require.Contains(t, rec.DeletedIDs(), neverIndexedPost.Id)
	assert.Equal(t, model.JobStatusSuccess, job.Status, "reindex with 404 deletes should succeed")
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
	for name := range settingsResp.GetIndices() {
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
