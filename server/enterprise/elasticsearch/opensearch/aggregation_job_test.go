// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package opensearch

import (
	"bytes"
	"context"
	"encoding/json"
	"os"
	"testing"
	"time"

	"github.com/opensearch-project/opensearch-go/v4/opensearchapi"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/api4"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
	"github.com/mattermost/mattermost/server/v8/enterprise/elasticsearch/common"
)

func TestElasticsearchAggregation(t *testing.T) {
	if os.Getenv("IS_CI") == "true" {
		os.Setenv("MM_ELASTICSEARCHSETTINGS_CONNECTIONURL", "http://opensearch:9201")
		os.Setenv("MM_ELASTICSEARCHSETTINGS_BACKEND", "opensearch")
	}

	defer func() {
		if os.Getenv("IS_CI") == "true" {
			os.Setenv("MM_ELASTICSEARCHSETTINGS_CONNECTIONURL", "http://elasticsearch:9201")
			os.Unsetenv("MM_ELASTICSEARCHSETTINGS_BACKEND")
		}
	}()

	th := api4.SetupEnterpriseWithStoreMock(t)
	rctx := request.TestContext(t)

	mockUserStore := mocks.UserStore{}
	mockUserStore.On("Count", mock.Anything).Return(int64(10), nil)
	mockUserStore.On("GetAllProfiles", mock.Anything).Return(nil, nil)

	mockPostStore := mocks.PostStore{}
	mockPostStore.On("GetMaxPostSize").Return(65535, nil)

	mockSystemStore := mocks.SystemStore{}
	mockSystemStore.On("GetByName", "UpgradedFromTE").Return(&model.System{Name: "UpgradedFromTE", Value: "false"}, nil)
	mockSystemStore.On("GetByName", "InstallationDate").Return(&model.System{Name: "InstallationDate", Value: "10"}, nil)
	mockSystemStore.On("GetByName", "FirstServerRunTimestamp").Return(&model.System{Name: "FirstServerRunTimestamp", Value: "10"}, nil)

	mockJobStore := mocks.JobStore{}
	mockJobStore.On("Save", mock.AnythingOfType("*model.Job")).Return(&model.Job{}, nil)
	mockJobStore.On("UpdateStatus", mock.AnythingOfType("string"), model.JobStatusSuccess).Return(&model.Job{}, nil)
	mockJobStore.On("Get", mock.AnythingOfType("*request.Context"), mock.AnythingOfType("string")).Return(&model.Job{
		Status: model.JobStatusSuccess,
	}, nil)
	mockJobStore.On("UpdateStatusOptimistically",
		mock.AnythingOfType("string"),
		model.JobStatusPending,
		model.JobStatusInProgress).
		Return(&model.Job{}, nil)
	mockJobStore.On("GetAllByType", mock.AnythingOfType("string")).Return([]*model.Job{{
		Id:     "abcxyz123",
		Type:   "EnterpriseElasticsearchIndexer",
		Status: model.JobStatusCanceled,
	}}, nil)

	mockStore := th.App.Srv().Platform().Store.(*mocks.Store)
	mockStore.On("User").Return(&mockUserStore)
	mockStore.On("Post").Return(&mockPostStore)
	mockStore.On("System").Return(&mockSystemStore)
	mockStore.On("Job").Return(&mockJobStore)
	mockStore.On("GetDBSchemaVersion").Return(1, nil)

	aggImpl := OpensearchAggregatorInterfaceImpl{Server: th.Server}

	// Register search engine
	th.App.SearchEngine().RegisterElasticsearchEngine(&OpensearchInterfaceImpl{
		Platform: th.Server.Platform(),
	})

	// Set up the state for the tests.
	th.App.UpdateConfig(func(cfg *model.Config) {
		if os.Getenv("IS_CI") == "true" {
			*cfg.ElasticsearchSettings.ConnectionURL = "http://opensearch:9201"
		} else {
			*cfg.ElasticsearchSettings.ConnectionURL = "http://localhost:9201"
		}
		*cfg.ElasticsearchSettings.Backend = model.ElasticsearchSettingsOSBackend
		*cfg.ElasticsearchSettings.EnableIndexing = true
		*cfg.ElasticsearchSettings.EnableSearching = true
		*cfg.ElasticsearchSettings.EnableAutocomplete = true
		*cfg.ElasticsearchSettings.LiveIndexingBatchSize = 1
		*cfg.ElasticsearchSettings.AggregatePostsAfterDays = 1
		*cfg.SqlSettings.DisableDatabaseSearch = true
	})

	esImpl := th.App.SearchEngine().ElasticsearchEngine
	appErr := esImpl.Start()
	if appErr != nil && appErr.Id != "ent.elasticsearch.start.already_started.app_error" {
		require.Fail(t, "failed to start elasticsearch", appErr)
	}
	require.Nil(t, esImpl.PurgeIndexes(rctx))

	post := &model.Post{
		Id:        model.NewId(),
		ChannelId: "channel",
		Message:   "hi",
	}
	for i := 0; i < indexDeletionBatchSize+1; i++ {
		indexPost(t, th, esImpl.(*OpensearchInterfaceImpl),
			post,
			time.Now().Add(-time.Duration(4+i)*24*time.Hour))
	}

	job := &model.Job{
		Id:     model.NewId(),
		Type:   model.JobTypeElasticsearchPostAggregation,
		Status: model.JobStatusPending,
	}

	_, err := th.Server.Store().Job().Save(job)
	require.NoError(t, err)

	worker := aggImpl.MakeWorker().(*OpensearchAggregatorWorker)
	worker.client = createTestClient(t, th.Context, th.App.Config(), th.App.FileBackend())
	worker.jobServer.Store = mockStore

	indexingImpl := OpensearchIndexerInterfaceImpl{
		Server: th.App.Srv(),
	}
	th.Server.Jobs.RegisterJobType(model.JobTypeElasticsearchPostIndexing, indexingImpl.MakeWorker(), nil)

	worker.DoJob(job)

	// We assert the minimum number of calls to verify that
	// batching is working correctly. Because job().Get() will happen
	// in each iteration.
	numCalls := 0
	for _, call := range mockJobStore.Calls {
		if call.Method == "Get" {
			numCalls++
		}
	}
	assert.GreaterOrEqual(t, numCalls, 8, "Unexpected number of Jobstore.Get calls")
}

func TestElasticsearchAggregationSkipDuringBulkIndexing(t *testing.T) {
	th := api4.SetupEnterpriseWithStoreMock(t)

	mockUserStore := mocks.UserStore{}
	mockUserStore.On("Count", mock.Anything).Return(int64(10), nil)

	mockPostStore := mocks.PostStore{}
	mockPostStore.On("GetMaxPostSize").Return(65535, nil)

	mockSystemStore := mocks.SystemStore{}
	mockSystemStore.On("GetByName", "UpgradedFromTE").Return(&model.System{Name: "UpgradedFromTE", Value: "false"}, nil)
	mockSystemStore.On("GetByName", "InstallationDate").Return(&model.System{Name: "InstallationDate", Value: "10"}, nil)
	mockSystemStore.On("GetByName", "FirstServerRunTimestamp").Return(&model.System{Name: "FirstServerRunTimestamp", Value: "10"}, nil)

	mockJobStore := mocks.JobStore{}

	mockStore := th.App.Srv().Platform().Store.(*mocks.Store)
	mockStore.On("User").Return(&mockUserStore)
	mockStore.On("Post").Return(&mockPostStore)
	mockStore.On("System").Return(&mockSystemStore)
	mockStore.On("Job").Return(&mockJobStore)
	mockStore.On("GetDBSchemaVersion").Return(1, nil)

	aggImpl := OpensearchAggregatorInterfaceImpl{Server: th.Server}
	aggImpl.Server.Jobs.Store = mockStore

	// Register search engine
	th.App.SearchEngine().RegisterElasticsearchEngine(&OpensearchInterfaceImpl{
		Platform: th.Server.Platform(),
	})

	// Set up the state for the tests.
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ElasticsearchSettings.EnableIndexing = true
		*cfg.ElasticsearchSettings.EnableSearching = true
		*cfg.ElasticsearchSettings.EnableAutocomplete = true
		*cfg.ElasticsearchSettings.LiveIndexingBatchSize = 1
		*cfg.ElasticsearchSettings.AggregatePostsAfterDays = 1
		*cfg.SqlSettings.DisableDatabaseSearch = true
	})

	sched := aggImpl.MakeScheduler()
	// Pass pending jobs as true
	job, appErr := sched.ScheduleJob(th.Context, th.App.Config(), true, nil)
	require.Nil(t, job)
	require.Nil(t, appErr)

	mockJobStore.AssertNotCalled(t, "GetCountByStatusAndType")
}

func indexPost(t *testing.T, th *api4.TestHelper, esImpl *OpensearchInterfaceImpl, post *model.Post, createTime time.Time) { //nolint:unused
	t.Helper()
	indexName := common.BuildPostIndexName(*th.Server.Config().ElasticsearchSettings.AggregatePostsAfterDays,
		common.IndexBasePosts,
		common.IndexBasePosts_MONTH,
		createTime.Add(-1*24*time.Hour),
		model.GetMillisForTime(createTime),
	)
	searchPost, err := common.ESPostFromPost(post, "teamID")
	require.NoError(t, err)
	ctx, cancel := context.WithTimeout(context.Background(),
		time.Duration(*esImpl.Platform.Config().ElasticsearchSettings.RequestTimeoutSeconds)*time.Second)
	defer cancel()

	buf, err := json.Marshal(searchPost)
	require.NoError(t, err)

	_, err = esImpl.client.Index(ctx, opensearchapi.IndexReq{
		Index:      indexName,
		DocumentID: post.Id,
		Body:       bytes.NewReader(buf),
	})
	require.NoError(t, err)
}
