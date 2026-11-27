// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package opensearch

import (
	"context"
	"encoding/json"
	"io"
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
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/api4"
	"github.com/mattermost/mattermost/server/v8/channels/store"
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

// TestOpenSearchDeleteNonExistentDocument verifies that bulk deletes returning 404
// (document not found) do not cause the indexing job to fail. A soft-deleted post
// that was never indexed is used so the delete operation is guaranteed to 404.
//
// Requires a running OpenSearch instance (skipped otherwise).
func TestOpenSearchDeleteNonExistentDocument(t *testing.T) {
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

	_, err := client.Info(context.Background(), nil)
	if err != nil {
		t.Skipf("OpenSearch not available at %s: %v", connURL, err)
	}

	// Soft-delete a post so the job issues a bulk delete for it. Since the index
	// is empty (no prior reindex), the document doesn't exist and OS returns 404.
	_, appErr := th.App.DeletePost(th.Context, th.BasicPost.Id, th.BasicUser.Id)
	require.Nil(t, appErr)

	impl := OpensearchIndexerInterfaceImpl{Server: th.App.Srv()}
	worker := impl.MakeWorker()
	require.NotNil(t, worker)
	th.Server.Jobs.RegisterJobType(model.JobTypeElasticsearchPostIndexing, worker, nil)

	go worker.Run()
	defer worker.Stop()

	job, appErr := th.App.Srv().Jobs.CreateJob(th.Context, model.JobTypeElasticsearchPostIndexing, map[string]string{})
	require.Nil(t, appErr)
	worker.JobChannel() <- *job
	job = waitForIndexingJob(t, th, job.Id, 60*time.Second)
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

type memberLookupCountingStore struct {
	store.Store
	channelStore *memberLookupCountingChannelStore
}

func (s *memberLookupCountingStore) Channel() store.ChannelStore { return s.channelStore }

type memberLookupCountingChannelStore struct {
	store.ChannelStore
	perChannelCalls int
	perBatchCalls   map[string]int
}

func (s *memberLookupCountingChannelStore) GetTeamMembersForChannel(rctx request.CTX, channelID string) ([]string, error) {
	s.perChannelCalls++
	return s.ChannelStore.GetTeamMembersForChannel(rctx, channelID)
}

func (s *memberLookupCountingChannelStore) GetAllChannelMemberIdsByChannelId(channelID string) ([]string, error) {
	s.perChannelCalls++
	return s.ChannelStore.GetAllChannelMemberIdsByChannelId(channelID)
}

func (s *memberLookupCountingChannelStore) GetTeamMembersForTeams(rctx request.CTX, teamIDs []string) (map[string][]string, error) {
	s.perBatchCalls["GetTeamMembersForTeams"]++
	return s.ChannelStore.GetTeamMembersForTeams(rctx, teamIDs)
}

func (s *memberLookupCountingChannelStore) GetAllChannelMemberIdsByChannelIds(channelIDs []string) (map[string][]string, error) {
	s.perBatchCalls["GetAllChannelMemberIdsByChannelIds"]++
	return s.ChannelStore.GetAllChannelMemberIdsByChannelIds(channelIDs)
}

func TestBulkIndexChannelsMemberData(t *testing.T) {
	th := api4.SetupEnterprise(t)
	ss := th.App.Srv().Store()

	newTeam := func(userIDs ...string) *model.Team {
		team, err := ss.Team().Save(&model.Team{DisplayName: "Team", Name: "team" + model.NewId(), Email: "team@example.com", Type: model.TeamOpen})
		require.NoError(t, err)
		for _, userID := range userIDs {
			_, err = ss.Team().SaveMember(th.Context, &model.TeamMember{TeamId: team.Id, UserId: userID}, -1)
			require.NoError(t, err)
		}
		return team
	}
	newChannel := func(teamID string, channelType model.ChannelType, memberIDs ...string) *model.Channel {
		channel, err := ss.Channel().Save(th.Context, &model.Channel{TeamId: teamID, DisplayName: "Channel", Name: "channel" + model.NewId(), Type: channelType}, -1)
		require.NoError(t, err)
		for _, userID := range memberIDs {
			_, err = ss.Channel().SaveMember(th.Context, &model.ChannelMember{ChannelId: channel.Id, UserId: userID, NotifyProps: model.GetDefaultChannelNotifyProps()})
			require.NoError(t, err)
		}
		return channel
	}

	user1, user2, user3 := th.CreateUser(t), th.CreateUser(t), th.CreateUser(t)
	team1 := newTeam(user1.Id, user2.Id)
	team2 := newTeam(user3.Id)

	publicChannel1 := newChannel(team1.Id, model.ChannelTypeOpen, user1.Id)
	privateChannel1 := newChannel(team1.Id, model.ChannelTypePrivate, user1.Id)
	publicChannel2 := newChannel(team2.Id, model.ChannelTypeOpen)
	emptyPrivateChannel2 := newChannel(team2.Id, model.ChannelTypePrivate)
	dmChannel, err := ss.Channel().CreateDirectChannel(th.Context, user1, user2)
	require.NoError(t, err)

	channels := []*model.Channel{publicChannel1, privateChannel1, publicChannel2, emptyPrivateChannel2, dmChannel}

	docs := map[string]common.ESChannel{}
	addItemToBulkProcessorFn := func(_, _, docID string, body io.ReadSeeker) error {
		var doc common.ESChannel
		require.NoError(t, json.NewDecoder(body).Decode(&doc))
		docs[docID] = doc
		return nil
	}

	countingChannelStore := &memberLookupCountingChannelStore{ChannelStore: ss.Channel(), perBatchCalls: map[string]int{}}
	countingStore := &memberLookupCountingStore{Store: ss, channelStore: countingChannelStore}
	lastChannel, appErr := common.BulkIndexChannels(th.App.Config(), countingStore, th.TestLogger, addItemToBulkProcessorFn, channels, common.IndexingProgress{})
	require.Nil(t, appErr)
	assert.Equal(t, dmChannel.Id, lastChannel.Id)
	assert.Zero(t, countingChannelStore.perChannelCalls, "member data must be fetched per batch, not per channel")
	assert.Equal(t, map[string]int{"GetTeamMembersForTeams": 1, "GetAllChannelMemberIdsByChannelIds": 1}, countingChannelStore.perBatchCalls)

	require.Len(t, docs, len(channels))

	assert.Nil(t, docs[publicChannel1.Id].UserIDs, "public channels carry no member list")
	assert.ElementsMatch(t, []string{user1.Id, user2.Id}, docs[publicChannel1.Id].TeamMemberIDs)

	assert.Equal(t, []string{user1.Id}, docs[privateChannel1.Id].UserIDs)
	assert.ElementsMatch(t, []string{user1.Id, user2.Id}, docs[privateChannel1.Id].TeamMemberIDs)

	assert.Nil(t, docs[publicChannel2.Id].UserIDs)
	assert.Equal(t, []string{user3.Id}, docs[publicChannel2.Id].TeamMemberIDs)

	assert.Equal(t, []string{}, docs[emptyPrivateChannel2.Id].UserIDs, "a private channel without members is indexed with an empty list")
	assert.Equal(t, []string{user3.Id}, docs[emptyPrivateChannel2.Id].TeamMemberIDs)

	assert.Nil(t, docs[dmChannel.Id].UserIDs)
	assert.Equal(t, []string{}, docs[dmChannel.Id].TeamMemberIDs, "a channel without a team is indexed with an empty team member list")
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
