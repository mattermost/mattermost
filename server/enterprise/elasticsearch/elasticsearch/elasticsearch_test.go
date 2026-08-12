// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package elasticsearch

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	elastic "github.com/elastic/go-elasticsearch/v8"
	"github.com/elastic/go-elasticsearch/v8/typedapi/types"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/api4"
	"github.com/mattermost/mattermost/server/v8/enterprise/elasticsearch/common"
	"github.com/mattermost/mattermost/server/v8/platform/shared/filestore"
	"github.com/mattermost/mattermost/server/v8/platform/shared/filestore/mocks"
)

type ElasticsearchInterfaceTestSuite struct {
	common.CommonTestSuite

	th          *api4.TestHelper
	client      *elastic.TypedClient
	ctx         context.Context
	fileBackend filestore.FileBackend
}

func TestElasticsearchInterfaceTestSuite(t *testing.T) {
	testSuite := &ElasticsearchInterfaceTestSuite{
		CommonTestSuite: common.CommonTestSuite{},
	}
	suite.Run(t, testSuite)
}

func (s *ElasticsearchInterfaceTestSuite) SetupSuite() {
	s.th = api4.SetupEnterprise(s.T()).InitBasic(s.T())
	s.CommonTestSuite.TH = s.th
	s.CommonTestSuite.GetDocumentFn = func(index, documentID string) (bool, json.RawMessage, error) {
		resp, err := s.client.API.Get(index, documentID).Do(s.ctx)
		if resp == nil {
			return false, nil, err
		}
		return resp.Found, resp.Source_, err
	}
	s.CommonTestSuite.RefreshIndexFn = func() error {
		_, err := s.client.Indices.Refresh().Do(context.Background())
		return err
	}
	s.CommonTestSuite.CreateIndexFn = func(index string) error {
		_, err := s.client.Indices.Create(index).Do(s.ctx)
		return err
	}
	s.CommonTestSuite.GetIndexFn = func(indexPattern string) ([]string, error) {
		res, err := s.client.Indices.Get(indexPattern).Do(s.ctx)
		if err != nil {
			return nil, err
		}
		var names []string
		for name := range res {
			names = append(names, name)
		}
		return names, nil
	}

	// Set up the state for the tests.
	s.th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ElasticsearchSettings.EnableIndexing = true
		*cfg.ElasticsearchSettings.EnableSearching = true
		*cfg.ElasticsearchSettings.EnableCJKAnalyzers = false
		*cfg.ElasticsearchSettings.EnableAutocomplete = true
		*cfg.ElasticsearchSettings.LiveIndexingBatchSize = 1
		*cfg.SqlSettings.DisableDatabaseSearch = true
	})
	s.th.App.Srv().SetLicense(model.NewTestLicense())

	if s.fileBackend == nil {
		s.fileBackend = &mocks.FileBackend{}
	}

	// Initialise other stuff for the test.
	s.client = createTestClient(s.T(), s.th.Context, s.th.App.Config(), s.th.App.FileBackend())
	s.ctx = context.Background()

	// Register search engine
	s.th.App.SearchEngine().RegisterElasticsearchEngine(&ElasticsearchInterfaceImpl{Platform: s.th.Server.Platform()})
}

func (s *ElasticsearchInterfaceTestSuite) SetupTest() {
	if strings.Contains(s.T().Name(), "CJK") {
		s.th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ElasticsearchSettings.EnableCJKAnalyzers = true
		})
	} else {
		s.th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ElasticsearchSettings.EnableCJKAnalyzers = false
		})
	}

	s.CommonTestSuite.ESImpl = s.th.App.SearchEngine().ElasticsearchEngine

	if s.CommonTestSuite.ESImpl.IsActive() {
		appErr := s.CommonTestSuite.ESImpl.Stop()
		s.Require().Nil(appErr)
	}

	s.Require().Nil(s.CommonTestSuite.ESImpl.Start(context.Background()))

	s.Nil(s.CommonTestSuite.ESImpl.PurgeIndexes(s.th.Context))
	s.NoError(s.RefreshIndexFn())
}

func (s *ElasticsearchInterfaceTestSuite) TestSyncBulkIndexChannels() {
	s.Run("Should index multiple channels successfully", func() {
		// Create test channels
		channel1 := &model.Channel{
			TeamId:      s.th.BasicTeam.Id,
			Type:        model.ChannelTypeOpen,
			Name:        "test-channel-1",
			DisplayName: "Test Channel 1",
		}
		channel1.PreSave()

		channel2 := &model.Channel{
			TeamId:      s.th.BasicTeam.Id,
			Type:        model.ChannelTypePrivate,
			Name:        "test-channel-2",
			DisplayName: "Test Channel 2",
		}
		channel2.PreSave()

		channels := []*model.Channel{channel1, channel2}

		// Mock getUserIDsForChannel function
		getUserIDsForChannel := func(channel *model.Channel) ([]string, error) {
			return []string{s.th.BasicUser.Id, s.th.BasicUser2.Id}, nil
		}

		teamMemberIDs := []string{s.th.BasicUser.Id, s.th.BasicUser2.Id}

		// Test the bulk indexing
		appErr := s.CommonTestSuite.ESImpl.SyncBulkIndexChannels(s.th.Context, channels, getUserIDsForChannel, teamMemberIDs)
		s.Require().Nil(appErr)

		// Refresh the index to ensure data is searchable
		s.Require().NoError(s.CommonTestSuite.RefreshIndexFn())

		// Verify both channels are indexed
		found, _, err := s.CommonTestSuite.GetDocumentFn("channels", channel1.Id)
		s.Require().NoError(err)
		s.Require().True(found)

		found, _, err = s.CommonTestSuite.GetDocumentFn("channels", channel2.Id)
		s.Require().NoError(err)
		s.Require().True(found)
	})

	s.Run("Should handle empty channels list", func() {
		getUserIDsForChannel := func(channel *model.Channel) ([]string, error) {
			return []string{}, nil
		}

		appErr := s.CommonTestSuite.ESImpl.SyncBulkIndexChannels(s.th.Context, []*model.Channel{}, getUserIDsForChannel, []string{})
		s.Require().Nil(appErr)
	})

	s.Run("Should handle getUserIDsForChannel error", func() {
		channel := &model.Channel{
			TeamId:      s.th.BasicTeam.Id,
			Type:        model.ChannelTypeOpen,
			Name:        "test-channel-error",
			DisplayName: "Test Channel Error",
		}
		channel.PreSave()

		getUserIDsForChannel := func(channel *model.Channel) ([]string, error) {
			return nil, model.NewAppError("TestError", "test.error", nil, "", 500)
		}

		appErr := s.CommonTestSuite.ESImpl.SyncBulkIndexChannels(s.th.Context, []*model.Channel{channel}, getUserIDsForChannel, []string{})
		s.Require().NotNil(appErr)
		s.Require().Contains(appErr.Error(), "test.error")
	})
}

func (s *ElasticsearchInterfaceTestSuite) TestTemplateCreationClientError() {
	s.Run("Should handle error with CausedBy information from elasticsearch", func() {
		// Invalid template request that will trigger an error with caused_by
		invalidTemplateBody := map[string]any{
			"index_patterns": []string{"test-invalid-*"},
			"template": map[string]any{
				"settings": map[string]any{
					"analysis": map[string]any{
						"analyzer": map[string]any{
							"my_analyzer": map[string]any{
								"type":      "custom",
								"tokenizer": "nonexistent_tokenizer",
							},
						},
					},
				},
			},
		}

		templateBytes, err := json.Marshal(invalidTemplateBody)
		s.Require().NoError(err)

		_, err = s.client.Indices.PutIndexTemplate("test-invalid-template").
			Raw(bytes.NewReader(templateBytes)).
			Do(s.ctx)

		var esErr *types.ElasticsearchError
		s.Require().ErrorAs(err, &esErr)

		s.Require().NotNil(esErr.ErrorCause.CausedBy, "Expected CausedBy to be present")
		s.Require().NotEmpty(esErr.ErrorCause.CausedBy.Type)
		s.Require().NotEmpty(*esErr.ErrorCause.CausedBy.Reason)

		// clean up after test
		_, _ = s.client.Indices.DeleteIndexTemplate("test-invalid-template").Do(s.ctx)
	})
}

func TestStartPostsTemplateFailureDoesNotCreateProcessors(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Elastic-Product", "Elasticsearch")
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/":
			_, _ = w.Write([]byte(`{"name":"test","version":{"number":"8.19.0"}}`))
		case r.Method == http.MethodGet && r.URL.Path == "/_nodes/plugins":
			_, _ = w.Write([]byte(`{"_nodes":{"total":2,"successful":1,"failed":1},"nodes":{"node-1":{"name":"node-1","plugins":[]}}}`))
		case r.Method == http.MethodPut && strings.Contains(r.URL.Path, "/_index_template/"):
			w.WriteHeader(http.StatusBadRequest)
			_, _ = w.Write([]byte(`{"error":{"type":"illegal_argument_exception","reason":"composable template [posts] template after composition is invalid","caused_by":{"type":"illegal_argument_exception","reason":"Custom Analyzer [mm_lowercaser] failed to find tokenizer under name [icu_tokenizer]"}},"status":400}`))
		default:
			w.WriteHeader(http.StatusInternalServerError)
		}
	}))
	defer server.Close()
	t.Setenv("MM_ELASTICSEARCHSETTINGS_CONNECTIONURL", server.URL)
	t.Setenv("MM_ELASTICSEARCHSETTINGS_BACKEND", model.ElasticsearchSettingsESBackend)

	th := api4.SetupEnterprise(t).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicense())

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ElasticsearchSettings.ConnectionURL = server.URL
		*cfg.ElasticsearchSettings.LiveIndexingBatchSize = 10
		*cfg.ElasticsearchSettings.EnableIndexing = true
	})

	es := &ElasticsearchInterfaceImpl{Platform: th.Server.Platform()}
	defer func() { require.Nil(t, es.Stop()) }()
	appErr := es.Start(context.Background())
	require.NotNil(t, appErr)
	require.Contains(t, appErr.Error(), "failed to find tokenizer under name [icu_tokenizer]")
	require.Equal(t, int32(0), es.ready.Load())
	require.Nil(t, es.bulkProcessor)
	require.Nil(t, es.syncBulkProcessor)
}

func TestStartWithoutAnalysisICUReturnsExplicitError(t *testing.T) {
	templateRequested := make(chan struct{}, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Elastic-Product", "Elasticsearch")
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/":
			_, _ = w.Write([]byte(`{"name":"test","version":{"number":"8.19.0"}}`))
		case r.Method == http.MethodGet && r.URL.Path == "/_nodes/plugins":
			_, _ = w.Write([]byte(`{"_nodes":{"total":2,"successful":2,"failed":0},"nodes":{"node-1":{"name":"node-1","plugins":[{"name":"analysis-icu"}]},"node-2":{"name":"node-2","plugins":[]}}}`))
		case r.Method == http.MethodPut && strings.Contains(r.URL.Path, "/_index_template/"):
			templateRequested <- struct{}{}
			_, _ = w.Write([]byte(`{"acknowledged":true}`))
		default:
			w.WriteHeader(http.StatusInternalServerError)
		}
	}))
	defer server.Close()
	t.Setenv("MM_ELASTICSEARCHSETTINGS_CONNECTIONURL", server.URL)
	t.Setenv("MM_ELASTICSEARCHSETTINGS_BACKEND", model.ElasticsearchSettingsESBackend)

	th := api4.SetupEnterprise(t)
	th.App.Srv().SetLicense(model.NewTestLicense())
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ElasticsearchSettings.ConnectionURL = server.URL
		*cfg.ElasticsearchSettings.EnableIndexing = true
	})

	originalClient := &elastic.TypedClient{}
	es := &ElasticsearchInterfaceImpl{
		Platform:    th.Server.Platform(),
		client:      originalClient,
		version:     8,
		fullVersion: "8.18.0",
		plugins:     []string{"existing-plugin"},
	}
	defer func() { require.Nil(t, es.Stop()) }()
	serverVersion, serverPlugins, testErr := es.TestConfigWithServerInfo(th.Context, th.App.Config())
	require.NotNil(t, testErr)
	require.Equal(t, "ent.elasticsearch.analysis_icu_required", testErr.Id)
	require.Equal(t, "8.19.0", serverVersion)
	require.Equal(t, []string{"analysis-icu"}, serverPlugins)
	require.Same(t, originalClient, es.client)
	require.Equal(t, 8, es.version)
	require.Equal(t, "8.18.0", es.fullVersion)
	require.Equal(t, []string{"existing-plugin"}, es.plugins)
	appErr := es.Start(context.Background())
	require.NotNil(t, appErr)
	require.Equal(t, "ent.elasticsearch.analysis_icu_required", appErr.Id)
	require.Equal(t, int32(0), es.ready.Load())
	require.Nil(t, es.bulkProcessor)
	require.Nil(t, es.syncBulkProcessor)
	select {
	case <-templateRequested:
		require.Fail(t, "template creation should not be attempted without analysis-icu on every node")
	default:
	}
}

func TestStartPreservesPluginsWhenDiscoveryFails(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Elastic-Product", "Elasticsearch")
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/":
			_, _ = w.Write([]byte(`{"name":"test","version":{"number":"8.19.0"}}`))
		case r.Method == http.MethodGet && r.URL.Path == "/_nodes/plugins":
			w.WriteHeader(http.StatusServiceUnavailable)
			_, _ = w.Write([]byte(`{"error":"temporarily unavailable","status":503}`))
		case r.Method == http.MethodPut && strings.HasPrefix(r.URL.Path, "/_index_template/"):
			_, _ = w.Write([]byte(`{"acknowledged":true}`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()
	t.Setenv("MM_ELASTICSEARCHSETTINGS_CONNECTIONURL", server.URL)
	t.Setenv("MM_ELASTICSEARCHSETTINGS_BACKEND", model.ElasticsearchSettingsESBackend)

	th := api4.SetupEnterprise(t)
	th.App.Srv().SetLicense(model.NewTestLicense())
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ElasticsearchSettings.ConnectionURL = server.URL
		*cfg.ElasticsearchSettings.Backend = model.ElasticsearchSettingsESBackend
		*cfg.ElasticsearchSettings.EnableIndexing = true
		*cfg.ElasticsearchSettings.LiveIndexingBatchSize = 1
	})

	es := &ElasticsearchInterfaceImpl{
		Platform: th.Server.Platform(),
		plugins:  []string{"analysis-nori"},
	}
	defer func() { require.Nil(t, es.Stop()) }()
	require.Nil(t, es.Start(context.Background()))
	require.Equal(t, "8.19.0", es.fullVersion)
	require.Equal(t, []string{"analysis-nori"}, es.plugins)
}

func TestTestConfigDoesNotActivateEngine(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Elastic-Product", "Elasticsearch")
		switch r.URL.Path {
		case "/":
			_, _ = w.Write([]byte(`{"name":"test","version":{"number":"8.19.0"}}`))
		case "/_nodes/plugins":
			_, _ = w.Write([]byte(`{"_nodes":{"total":1,"successful":1,"failed":0},"nodes":{"node-1":{"name":"node-1","plugins":[{"name":"analysis-icu"}]}}}`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()
	t.Setenv("MM_ELASTICSEARCHSETTINGS_CONNECTIONURL", server.URL)
	t.Setenv("MM_ELASTICSEARCHSETTINGS_BACKEND", model.ElasticsearchSettingsESBackend)

	th := api4.SetupEnterprise(t)
	th.App.Srv().SetLicense(model.NewTestLicense())
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ElasticsearchSettings.ConnectionURL = server.URL
		*cfg.ElasticsearchSettings.Backend = model.ElasticsearchSettingsESBackend
		*cfg.ElasticsearchSettings.EnableIndexing = true
	})

	originalClient := &elastic.TypedClient{}
	es := &ElasticsearchInterfaceImpl{
		Platform:    th.Server.Platform(),
		client:      originalClient,
		version:     8,
		fullVersion: "8.18.0",
		plugins:     []string{"existing-plugin"},
	}
	defer func() { require.Nil(t, es.Stop()) }()
	serverVersion, serverPlugins, appErr := es.TestConfigWithServerInfo(th.Context, th.App.Config())
	require.Nil(t, appErr)
	require.Equal(t, "8.19.0", serverVersion)
	require.Equal(t, []string{"analysis-icu"}, serverPlugins)
	require.Nil(t, es.TestConfig(th.Context, th.App.Config()))
	require.Equal(t, int32(0), es.ready.Load())
	require.Same(t, originalClient, es.client)
	require.Nil(t, es.bulkProcessor)
	require.Nil(t, es.syncBulkProcessor)
	require.Equal(t, 8, es.version)
	require.Equal(t, "8.18.0", es.fullVersion)
	require.Equal(t, []string{"existing-plugin"}, es.plugins)

	// A partially initialized state must return an error instead of panicking.
	es.ready.Store(1)
	syncErr := es.SyncBulkIndexChannels(th.Context, []*model.Channel{{Id: model.NewId()}}, func(*model.Channel) ([]string, error) {
		return nil, nil
	}, nil)
	require.NotNil(t, syncErr)
	require.Equal(t, "ent.elasticsearch.not_started.error", syncErr.Id)
}

func TestTestConfigThenSavingConfigStartsEngine(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Elastic-Product", "Elasticsearch")
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/":
			_, _ = w.Write([]byte(`{"name":"test","version":{"number":"8.19.0"}}`))
		case r.Method == http.MethodGet && r.URL.Path == "/_nodes/plugins":
			_, _ = w.Write([]byte(`{"_nodes":{"total":1,"successful":1,"failed":0},"nodes":{"node-1":{"name":"node-1","plugins":[{"name":"analysis-icu"}]}}}`))
		case r.Method == http.MethodPut && strings.HasPrefix(r.URL.Path, "/_index_template/"):
			_, _ = w.Write([]byte(`{"acknowledged":true}`))
		case r.Method == http.MethodGet && r.URL.Path == "/_cluster/health":
			_, _ = w.Write([]byte(`{"status":"green"}`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	th := api4.SetupEnterpriseWithServerOptions(t, nil)
	ps := th.Server.Platform()
	ps.StopSearchEngine()
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ElasticsearchSettings.ConnectionURL = server.URL
		*cfg.ElasticsearchSettings.Backend = model.ElasticsearchSettingsESBackend
		*cfg.ElasticsearchSettings.EnableIndexing = false
		*cfg.ElasticsearchSettings.LiveIndexingBatchSize = 1
	})
	th.App.Srv().SetLicense(model.NewTestLicense())

	es := &ElasticsearchInterfaceImpl{Platform: ps}
	th.App.SearchEngine().RegisterElasticsearchEngine(es)
	configListenerID, licenseListenerID := ps.StartSearchEngine()
	t.Cleanup(func() {
		ps.StopSearchEngine()
		ps.RemoveConfigListener(configListenerID)
		ps.RemoveLicenseListener(licenseListenerID)
		server.Close()
	})
	require.False(t, es.IsActive())

	submittedConfig := th.App.Config().Clone()
	*submittedConfig.ElasticsearchSettings.EnableIndexing = true
	require.Nil(t, es.TestConfig(th.Context, submittedConfig))
	require.False(t, es.IsActive())
	require.Nil(t, es.client)
	require.Nil(t, es.syncBulkProcessor)

	// Saving the submitted config must wake the watcher, which performs the
	// full Start sequence and creates the synchronous bulk processor.
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ElasticsearchSettings.EnableIndexing = true
	})

	require.Eventually(t, func() bool {
		return es.IsActive() && es.syncBulkProcessor != nil
	}, 5*time.Second, 10*time.Millisecond)
	require.Equal(t, "8.19.0", es.GetFullVersion())
	require.Equal(t, []string{"analysis-icu"}, es.GetPlugins())
}

func TestWrapElasticsearchTemplateError(t *testing.T) {
	nestedReason := "Custom Analyzer [mm_lowercaser] failed to find tokenizer under name [icu_tokenizer]"
	nested := &types.ErrorCause{Type: "illegal_argument_exception", Reason: &nestedReason}
	outerReason := "failed to build posts template"
	stackTrace := "stack trace"
	original := &types.ElasticsearchError{
		ErrorCause: types.ErrorCause{
			Type:       "illegal_argument_exception",
			Reason:     &outerReason,
			CausedBy:   nested,
			StackTrace: &stackTrace,
			Metadata: map[string]json.RawMessage{
				"arbitrary": json.RawMessage(`"metadata"`),
			},
		},
		Status: 400,
	}
	wrapped := fmt.Errorf("request context: %w", original)

	formatted := wrapElasticsearchTemplateError(wrapped)
	require.Contains(t, formatted.Error(), "status: 400, failed: [illegal_argument_exception], reason: failed to build posts template")
	require.Contains(t, formatted.Error(), "caused by: [illegal_argument_exception] Custom Analyzer [mm_lowercaser] failed to find tokenizer under name [icu_tokenizer]")
	require.NotContains(t, formatted.Error(), "stack trace")
	require.NotContains(t, formatted.Error(), "arbitrary metadata")
	require.ErrorIs(t, formatted, wrapped)
	var extracted *types.ElasticsearchError
	require.True(t, errors.As(formatted, &extracted))
	require.Same(t, original, extracted)

	generic := errors.New("template request failed")
	require.Same(t, generic, wrapElasticsearchTemplateError(generic))
	require.NoError(t, wrapElasticsearchTemplateError(nil))
}

type testBulkClient struct {
	stopCalls int
	stopErr   error
}

func (b *testBulkClient) IndexOp(types.IndexOperation, any) error {
	return nil
}

func (b *testBulkClient) DeleteOp(types.DeleteOperation) error {
	return nil
}

func (b *testBulkClient) Flush() error {
	return nil
}

func (b *testBulkClient) Stop() error {
	b.stopCalls++
	return b.stopErr
}

func TestElasticsearchStopCleansUpProcessors(t *testing.T) {
	tests := []struct {
		name       string
		ready      bool
		firstError bool
	}{
		{name: "ready", ready: true},
		{name: "ready first stop error", ready: true, firstError: true},
		{name: "partially initialized", ready: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			bulk := &testBulkClient{}
			syncBulk := &testBulkClient{}
			if tt.firstError {
				bulk.stopErr = errors.New("bulk stop failed")
			}

			es := &ElasticsearchInterfaceImpl{
				client:            &elastic.TypedClient{},
				bulkProcessor:     bulk,
				syncBulkProcessor: syncBulk,
			}
			if tt.ready {
				es.ready.Store(1)
				es.healthy.Store(1)
			}

			require.Nil(t, es.Stop())
			require.Equal(t, int32(0), es.ready.Load())
			require.Equal(t, int32(0), es.healthy.Load())
			require.Nil(t, es.client)
			require.Nil(t, es.bulkProcessor)
			require.Nil(t, es.syncBulkProcessor)
			require.Equal(t, 1, bulk.stopCalls)
			require.Equal(t, 1, syncBulk.stopCalls)

			require.Nil(t, es.Stop())
			require.Equal(t, 1, bulk.stopCalls)
			require.Equal(t, 1, syncBulk.stopCalls)
		})
	}
}
