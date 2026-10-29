// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package elasticsearch

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	elastic "github.com/elastic/go-elasticsearch/v8"
	"github.com/elastic/go-elasticsearch/v8/typedapi/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/api4"
	"github.com/mattermost/mattermost/server/v8/channels/testlib"
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
		case r.Method == http.MethodGet && r.URL.Path == "/_cat/plugins":
			// Plugin inventory is optional and must not prevent the real template check.
			w.WriteHeader(http.StatusInternalServerError)
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
	require.Contains(t, appErr.Error(), "Verify that the required analysis-icu plugin is installed on every elasticsearch node")
	require.Equal(t, int32(0), es.ready.Load())
	require.Nil(t, es.bulkProcessor)
	require.Nil(t, es.syncBulkProcessor)
}

func TestStartWithoutPluginInventoryUsesTemplateValidation(t *testing.T) {
	templateRequested := make(chan string, 4)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Elastic-Product", "Elasticsearch")
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/":
			_, _ = w.Write([]byte(`{"name":"test","version":{"number":"8.19.0"}}`))
		case r.Method == http.MethodGet && r.URL.Path == "/_cat/plugins":
			_, _ = w.Write([]byte(`[]`))
		case r.Method == http.MethodPut && strings.Contains(r.URL.Path, "/_index_template/"):
			templateRequested <- strings.TrimPrefix(r.URL.Path, "/_index_template/")
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

	es := &ElasticsearchInterfaceImpl{Platform: th.Server.Platform()}
	defer func() { require.Nil(t, es.Stop()) }()
	appErr := es.Start(context.Background())
	require.Nil(t, appErr)
	require.Equal(t, int32(1), es.ready.Load())
	require.Len(t, templateRequested, 4)
	requestedTemplates := make([]string, 0, 4)
	for range 4 {
		requestedTemplates = append(requestedTemplates, <-templateRequested)
	}
	require.ElementsMatch(t, []string{common.IndexBasePosts, common.IndexBaseChannels, common.IndexBaseUsers, common.IndexBaseFiles}, requestedTemplates)
}

func TestSearchPostsReturnsHitsWithUnparseableHighlights(t *testing.T) {
	goodPostID, badPostID := model.NewId(), model.NewId()
	searchResponse := fmt.Sprintf(`{"took":1,"timed_out":false,"_shards":{"total":1,"successful":1,"skipped":0,"failed":0},"hits":{"total":{"value":2,"relation":"eq"},"max_score":1,"hits":[
		{"_index":"posts","_id":%[1]q,"_score":1,"_source":{"id":%[1]q},"highlight":{"message":["<em>deployment</em> done"]}},
		{"_index":"posts","_id":%[2]q,"_score":1,"_source":{"id":%[2]q},"highlight":{"message":["<em>deployment</b> broken"]}}
	]}}`, goodPostID, badPostID)

	cluster := pluginsHandler(t, &common.ClusterRecorder{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/_search") {
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("X-Elastic-Product", "Elasticsearch")
			_, _ = fmt.Fprint(w, searchResponse)
			return
		}
		cluster(w, r)
	}))
	defer server.Close()
	t.Setenv("MM_ELASTICSEARCHSETTINGS_CONNECTIONURL", server.URL)
	t.Setenv("MM_ELASTICSEARCHSETTINGS_BACKEND", model.ElasticsearchSettingsESBackend)

	th := api4.SetupEnterprise(t)
	th.App.Srv().SetLicense(model.NewTestLicense())
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ElasticsearchSettings.ConnectionURL = server.URL
		*cfg.ElasticsearchSettings.EnableIndexing = true
		*cfg.ElasticsearchSettings.EnableSearching = true
	})

	es := &ElasticsearchInterfaceImpl{Platform: th.Server.Platform()}
	defer func() { require.Nil(t, es.Stop()) }()
	require.Nil(t, es.Start(context.Background()))

	channels := model.ChannelList{{Id: model.NewId(), TeamId: model.NewId(), Type: model.ChannelTypeOpen}}
	ids, matches, appErr := es.SearchPosts(channels, model.ParseSearchParams("deployment", 0), 0, 20)
	require.Nil(t, appErr)
	require.Equal(t, []string{goodPostID, badPostID}, ids)
	require.Equal(t, []string{"deployment"}, matches[goodPostID])
	require.Empty(t, matches[badPostID])

	require.NoError(t, th.TestLogger.Flush())
	testlib.AssertLog(t, th.LogBuffer, mlog.LvlWarn.Name, "Failed to parse search result highlights, returning post without highlights")
}

// missingCJKPluginsWarning mirrors the warning Start logs when no CJK analyzer plugin is detected.
const missingCJKPluginsWarning = "EnableCJKAnalyzers is set but no CJK analyzer plugins found installed. Please review elasticsearch settings."

// pluginsHandler serves the endpoints Start and SearchPosts need, reporting one node per given list
// of plugin names and recording the posts template and search request bodies.
func pluginsHandler(t *testing.T, recorder *common.ClusterRecorder, nodePlugins ...[]string) http.HandlerFunc {
	info := infoHandler("8.19.0")
	catPlugins := common.CatPluginsResponse(nodePlugins...)

	readBody := func(w http.ResponseWriter, r *http.Request) ([]byte, bool) {
		body, err := io.ReadAll(r.Body)
		if !assert.NoError(t, err) {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return nil, false
		}
		return body, true
	}

	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Elastic-Product", "Elasticsearch")
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/":
			info(w, r)
		case r.Method == http.MethodGet && r.URL.Path == "/_cat/plugins":
			_, _ = fmt.Fprint(w, catPlugins)
		case r.Method == http.MethodPut && strings.Contains(r.URL.Path, "/_index_template/"):
			body, ok := readBody(w, r)
			if !ok {
				return
			}
			if strings.HasSuffix(r.URL.Path, common.IndexBasePosts) {
				recorder.RecordPostsTemplate(body)
			}
			_, _ = fmt.Fprint(w, `{"acknowledged":true}`)
		case strings.HasSuffix(r.URL.Path, "/_search"):
			body, ok := readBody(w, r)
			if !ok {
				return
			}
			recorder.RecordSearch(body)
			_, _ = fmt.Fprint(w, `{"took":1,"timed_out":false,"hits":{"total":{"value":0,"relation":"eq"},"max_score":0,"hits":[]}}`)
		default:
			w.WriteHeader(http.StatusInternalServerError)
		}
	}
}

func setupCJKCluster(t *testing.T, recorder *common.ClusterRecorder, nodePlugins ...[]string) (*api4.TestHelper, *ElasticsearchInterfaceImpl) {
	server := httptest.NewServer(pluginsHandler(t, recorder, nodePlugins...))
	t.Cleanup(server.Close)

	t.Setenv("MM_ELASTICSEARCHSETTINGS_CONNECTIONURL", server.URL)
	t.Setenv("MM_ELASTICSEARCHSETTINGS_BACKEND", model.ElasticsearchSettingsESBackend)

	th := api4.SetupEnterprise(t)
	th.App.Srv().SetLicense(model.NewTestLicense())
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ElasticsearchSettings.ConnectionURL = server.URL
		*cfg.ElasticsearchSettings.EnableIndexing = true
		*cfg.ElasticsearchSettings.EnableSearching = true
		*cfg.ElasticsearchSettings.EnableCJKAnalyzers = true
	})

	es := &ElasticsearchInterfaceImpl{Platform: th.Server.Platform()}
	t.Cleanup(func() { require.Nil(t, es.Stop()) })

	return th, es
}

// TestCJKAnalyzersWithPrefixedPluginNames covers a cluster that reports analysis plugins under the
// prefixed component name a managed service assigns to plugins it does not bundle, as AWS
// OpenSearch Service does for the Korean analyzer installed through associate-package.
func TestCJKAnalyzersWithPrefixedPluginNames(t *testing.T) {
	namings := []struct {
		Name    string
		Plugins []string
	}{
		{"only nori prefixed", []string{"analysis-icu", "opensearch-analysis-nori", "analysis-kuromoji", "analysis-smartcn"}},
		{"every analysis plugin prefixed", []string{"opensearch-analysis-icu", "opensearch-analysis-nori", "opensearch-analysis-kuromoji", "opensearch-analysis-smartcn"}},
	}

	for _, naming := range namings {
		t.Run(naming.Name, func(t *testing.T) {
			recorder := &common.ClusterRecorder{}
			th, es := setupCJKCluster(t, recorder, naming.Plugins)
			require.Nil(t, es.Start(context.Background()))

			expectedSubFields := map[string]string{
				"nori":     "mm_nori",
				"kuromoji": "mm_kuromoji",
				"smartcn":  "mm_smartcn",
			}

			t.Run("the posts index template maps every CJK sub-field", func(t *testing.T) {
				template := recorder.PostsTemplate()
				require.NotEmpty(t, template, "no posts index template was created")

				require.Equal(t, expectedSubFields, common.TemplatePropertyFields(t, template, "message"))
				require.Equal(t, expectedSubFields, common.TemplatePropertyFields(t, template, "attachments"))
				require.Subset(t, common.TemplateAnalyzers(t, template), []string{"mm_nori", "mm_kuromoji", "mm_smartcn"})
			})

			t.Run("no missing plugin warning is logged", func(t *testing.T) {
				require.NoError(t, th.TestLogger.Flush())
				testlib.AssertNoLog(t, th.LogBuffer, mlog.LvlWarn.Name, missingCJKPluginsWarning)
			})

			channels := model.ChannelList{{Id: model.NewId(), TeamId: model.NewId(), Type: model.ChannelTypeOpen}}

			searchFields := func(t *testing.T, terms string) [][]string {
				t.Helper()

				recorder.ResetSearches()
				_, _, appErr := es.SearchPosts(channels, model.ParseSearchParams(terms, 0), 0, 20)
				require.Nil(t, appErr)

				bodies := recorder.SearchBodies()
				require.Len(t, bodies, 1)

				return common.SimpleQueryStringFields(t, bodies[0])
			}

			t.Run("a CJK query searches the CJK sub-fields", func(t *testing.T) {
				fields := searchFields(t, "검색")
				require.Contains(t, fields, []string{"message", "message.nori", "message.kuromoji", "message.smartcn"})
				require.Contains(t, fields, []string{"attachments", "attachments.nori", "attachments.kuromoji", "attachments.smartcn"})
			})

			t.Run("a non-CJK query only searches the base fields", func(t *testing.T) {
				common.RequireOnlyBaseFields(t, searchFields(t, "search"))
			})

			t.Run("a CJK query only searches the base fields when CJK analyzers are disabled", func(t *testing.T) {
				th.App.UpdateConfig(func(cfg *model.Config) {
					*cfg.ElasticsearchSettings.EnableCJKAnalyzers = false
				})
				defer th.App.UpdateConfig(func(cfg *model.Config) {
					*cfg.ElasticsearchSettings.EnableCJKAnalyzers = true
				})

				common.RequireOnlyBaseFields(t, searchFields(t, "검색"))
			})
		})
	}
}

// TestCJKAnalyzersWithoutAnyCJKPlugin covers the diagnostic that made this failure mode hard to
// spot: the warning only fires when no CJK analyzer plugin is detected at all.
func TestCJKAnalyzersWithoutAnyCJKPlugin(t *testing.T) {
	recorder := &common.ClusterRecorder{}
	th, es := setupCJKCluster(t, recorder, []string{"analysis-icu"})
	require.Nil(t, es.Start(context.Background()))

	template := recorder.PostsTemplate()
	require.NotEmpty(t, template, "no posts index template was created")
	require.Empty(t, common.TemplatePropertyFields(t, template, "message"))

	channels := model.ChannelList{{Id: model.NewId(), TeamId: model.NewId(), Type: model.ChannelTypeOpen}}
	_, _, appErr := es.SearchPosts(channels, model.ParseSearchParams("검색", 0), 0, 20)
	require.Nil(t, appErr)

	bodies := recorder.SearchBodies()
	require.Len(t, bodies, 1)
	common.RequireOnlyBaseFields(t, common.SimpleQueryStringFields(t, bodies[0]))

	require.NoError(t, th.TestLogger.Flush())
	testlib.AssertLog(t, th.LogBuffer, mlog.LvlWarn.Name, missingCJKPluginsWarning)
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

// TestTestConfigLeavesEngineStateUnchanged checks that TestConfig only probes the cluster: it must
// not start a stopped engine, nor change what a running engine reports when given a candidate
// config that points at another cluster.
func TestTestConfigLeavesEngineStateUnchanged(t *testing.T) {
	th, es := setupCJKCluster(t, &common.ClusterRecorder{}, []string{"analysis-nori"})

	require.Nil(t, es.TestConfig(th.Context, th.App.Config()))
	require.False(t, es.IsActive())
	require.Nil(t, es.client)
	require.Nil(t, es.syncBulkProcessor)
	require.Zero(t, es.GetVersion())
	require.Empty(t, es.GetFullVersion())
	require.Empty(t, es.GetPlugins())

	require.Nil(t, es.Start(context.Background()))
	client := es.client

	otherCluster := httptest.NewServer(infoHandler("9.1.0"))
	t.Cleanup(otherCluster.Close)
	candidate := th.App.Config().Clone()
	*candidate.ElasticsearchSettings.ConnectionURL = otherCluster.URL

	require.Nil(t, es.TestConfig(th.Context, candidate))
	require.True(t, es.IsActive())
	require.Same(t, client, es.client)
	require.Equal(t, 8, es.GetVersion())
	require.Equal(t, "8.19.0", es.GetFullVersion())
	require.Equal(t, []string{"analysis-nori"}, es.GetPlugins())
}

// lifecycleCluster serves a fake cluster for the watcher lifecycle tests. While
// down is set it fails every request with a status the client doesn't retry,
// and counts the failed version requests so a test can tell Start() failed.
func lifecycleCluster(t *testing.T, down *atomic.Bool, failedVersionRequests *atomic.Int32) *httptest.Server {
	cluster := pluginsHandler(t, &common.ClusterRecorder{}, []string{"analysis-icu"})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if down.Load() {
			w.WriteHeader(http.StatusInternalServerError)
			if r.Method == http.MethodGet && r.URL.Path == "/" {
				failedVersionRequests.Add(1)
			}
			return
		}
		if r.URL.Path == "/_cluster/health" {
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("X-Elastic-Product", "Elasticsearch")
			_, _ = fmt.Fprint(w, `{"cluster_name":"test","status":"green"}`)
			return
		}
		cluster(w, r)
	}))
	t.Cleanup(server.Close)
	return server
}

// setupWatchedEngine registers a fresh engine with the platform and starts the
// search engine watcher on it, so tests go through the real Start() path.
func setupWatchedEngine(t *testing.T, serverURL string, enableIndexing bool) (*api4.TestHelper, *ElasticsearchInterfaceImpl) {
	t.Setenv("MM_ELASTICSEARCHSETTINGS_CONNECTIONURL", serverURL)
	t.Setenv("MM_ELASTICSEARCHSETTINGS_BACKEND", model.ElasticsearchSettingsESBackend)

	th := api4.SetupEnterpriseWithServerOptions(t, nil)
	ps := th.Server.Platform()
	ps.StopSearchEngine()
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ElasticsearchSettings.ConnectionURL = serverURL
		*cfg.ElasticsearchSettings.Backend = model.ElasticsearchSettingsESBackend
		*cfg.ElasticsearchSettings.EnableIndexing = enableIndexing
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
	})

	return th, es
}

func hasSyncBulkProcessor(engine *ElasticsearchInterfaceImpl) bool {
	engine.mutex.RLock()
	defer engine.mutex.RUnlock()
	return engine.syncBulkProcessor != nil
}

// TestTestConfigThenSavingConfigStartsEngine follows TestConfig, then saving the
// tested config, through the watcher to a full Start().
func TestTestConfigThenSavingConfigStartsEngine(t *testing.T) {
	var down atomic.Bool
	var failedVersionRequests atomic.Int32
	server := lifecycleCluster(t, &down, &failedVersionRequests)
	th, es := setupWatchedEngine(t, server.URL, false)
	require.False(t, es.IsActive())

	submittedConfig := th.App.Config().Clone()
	*submittedConfig.ElasticsearchSettings.EnableIndexing = true
	require.Nil(t, es.TestConfig(th.Context, submittedConfig))
	require.False(t, es.IsActive())
	require.Nil(t, es.client)
	require.False(t, hasSyncBulkProcessor(es))

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ElasticsearchSettings.EnableIndexing = true
	})

	require.Eventually(t, func() bool {
		return es.IsActive() && hasSyncBulkProcessor(es)
	}, 5*time.Second, 10*time.Millisecond)
	require.Equal(t, "8.19.0", es.GetFullVersion())
	require.Equal(t, []string{"analysis-icu"}, es.GetPlugins())
}

// TestTestElasticsearchStartsEngineWithoutWaitingForBackoff covers a saved
// cluster that comes back while the watcher waits out its retry backoff: a
// successful connection test starts the engine through the watcher right away.
func TestTestElasticsearchStartsEngineWithoutWaitingForBackoff(t *testing.T) {
	var down atomic.Bool
	var failedVersionRequests atomic.Int32
	down.Store(true)
	server := lifecycleCluster(t, &down, &failedVersionRequests)
	th, es := setupWatchedEngine(t, server.URL, true)

	// Wait for the watcher's first Start() to fail; it then backs off for 15s.
	require.Eventually(t, func() bool {
		return failedVersionRequests.Load() >= 1
	}, 5*time.Second, 10*time.Millisecond)
	require.Never(t, es.IsActive, 200*time.Millisecond, 10*time.Millisecond)

	down.Store(false)
	require.Nil(t, th.App.TestElasticsearch(th.Context, th.App.Config().Clone()))

	require.Eventually(t, func() bool {
		return es.IsActive() && hasSyncBulkProcessor(es)
	}, 5*time.Second, 10*time.Millisecond)
}
