// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package opensearch

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/opensearch-project/opensearch-go/v4"
	"github.com/opensearch-project/opensearch-go/v4/opensearchapi"
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

type OpensearchInterfaceTestSuite struct {
	common.CommonTestSuite

	th          *api4.TestHelper
	client      *opensearchapi.Client
	ctx         context.Context
	fileBackend filestore.FileBackend
}

func TestOpensearchInterfaceTestSuite(t *testing.T) {
	testSuite := &OpensearchInterfaceTestSuite{
		CommonTestSuite: common.CommonTestSuite{},
	}
	suite.Run(t, testSuite)
}

func TestStartTemplateFailureDoesNotCreateBulkProcessors(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.URL.Path == "/":
			_, _ = fmt.Fprint(w, `{"version":{"number":"2.11.0"}}`)
		case r.URL.Path == "/_nodes/plugins":
			_, _ = fmt.Fprint(w, `{"_nodes":{"total":2,"successful":1,"failed":1},"nodes":{"node-1":{"name":"node-1","plugins":[]}}}`)
		case strings.HasPrefix(r.URL.Path, "/_index_template/") && strings.HasSuffix(r.URL.Path, "posts"):
			w.WriteHeader(http.StatusBadRequest)
			_, _ = fmt.Fprint(w, `{"error":{"type":"illegal_argument_exception","reason":"failed to parse template","caused_by":{"type":"illegal_argument_exception","reason":"Custom Analyzer [mm_lowercaser] failed to find tokenizer under name [icu_tokenizer]"}},"status":400}`)
		case strings.HasPrefix(r.URL.Path, "/_index_template/"):
			_, _ = fmt.Fprint(w, `{"acknowledged":true}`)
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()
	t.Setenv("MM_ELASTICSEARCHSETTINGS_CONNECTIONURL", server.URL)
	t.Setenv("MM_ELASTICSEARCHSETTINGS_BACKEND", model.ElasticsearchSettingsOSBackend)

	th := api4.SetupEnterprise(t)
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ElasticsearchSettings.ConnectionURL = server.URL
		*cfg.ElasticsearchSettings.Backend = model.ElasticsearchSettingsOSBackend
		*cfg.ElasticsearchSettings.EnableIndexing = true
		*cfg.ElasticsearchSettings.LiveIndexingBatchSize = 2
	})
	th.App.Srv().SetLicense(model.NewTestLicense())

	impl := &OpensearchInterfaceImpl{Platform: th.Server.Platform()}
	appErr := impl.Start(context.Background())
	require.NotNil(t, appErr)
	require.Contains(t, appErr.Error(), "icu_tokenizer")
	require.Equal(t, int32(0), impl.ready.Load())
	require.Nil(t, impl.bulkProcessor)
	require.Nil(t, impl.syncBulkProcessor)

	require.Nil(t, impl.Stop())
}

func TestStartWithoutAnalysisICUReturnsExplicitError(t *testing.T) {
	templateRequested := make(chan struct{}, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.URL.Path == "/":
			_, _ = fmt.Fprint(w, `{"version":{"number":"2.11.0"}}`)
		case r.URL.Path == "/_nodes/plugins":
			_, _ = fmt.Fprint(w, `{"_nodes":{"total":2,"successful":2,"failed":0},"nodes":{"node-1":{"name":"node-1","plugins":[{"name":"analysis-icu"}]},"node-2":{"name":"node-2","plugins":[]}}}`)
		case strings.HasPrefix(r.URL.Path, "/_index_template/"):
			templateRequested <- struct{}{}
			_, _ = fmt.Fprint(w, `{"acknowledged":true}`)
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()
	t.Setenv("MM_ELASTICSEARCHSETTINGS_CONNECTIONURL", server.URL)
	t.Setenv("MM_ELASTICSEARCHSETTINGS_BACKEND", model.ElasticsearchSettingsOSBackend)

	th := api4.SetupEnterprise(t)
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ElasticsearchSettings.ConnectionURL = server.URL
		*cfg.ElasticsearchSettings.Backend = model.ElasticsearchSettingsOSBackend
		*cfg.ElasticsearchSettings.EnableIndexing = true
	})
	th.App.Srv().SetLicense(model.NewTestLicense())

	impl := &OpensearchInterfaceImpl{Platform: th.Server.Platform()}
	defer func() { require.Nil(t, impl.Stop()) }()
	appErr := impl.Start(context.Background())
	require.NotNil(t, appErr)
	require.Equal(t, "ent.elasticsearch.analysis_icu_required", appErr.Id)
	require.Equal(t, int32(0), impl.ready.Load())
	require.Nil(t, impl.bulkProcessor)
	require.Nil(t, impl.syncBulkProcessor)
	select {
	case <-templateRequested:
		require.Fail(t, "template creation should not be attempted without analysis-icu on every node")
	default:
	}
}

// missingCJKPluginsWarning mirrors the warning Start logs when no CJK analyzer plugin is detected.
const missingCJKPluginsWarning = "EnableCJKAnalyzers is set but no CJK analyzer plugins found installed. Please review opensearch settings."

// pluginsHandler serves the endpoints Start and SearchPosts need, reporting one node per given list
// of plugin names and recording the posts template and search request bodies.
func pluginsHandler(t *testing.T, recorder *common.ClusterRecorder, nodePlugins ...[]string) http.HandlerFunc {
	info := infoHandler("2.11.0")
	nodesInfo := common.NodesPluginsResponse(nodePlugins...)

	readBody := func(w http.ResponseWriter, r *http.Request) ([]byte, bool) {
		body, err := io.ReadAll(r.Body)
		if !assert.NoError(t, err) {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return nil, false
		}
		return body, true
	}

	return func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.URL.Path == "/":
			info(w, r)
		case r.URL.Path == "/_nodes/plugins":
			_, _ = fmt.Fprint(w, nodesInfo)
		case strings.HasPrefix(r.URL.Path, "/_index_template/"):
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
			w.WriteHeader(http.StatusNotFound)
		}
	}
}

func setupCJKCluster(t *testing.T, recorder *common.ClusterRecorder, nodePlugins ...[]string) (*api4.TestHelper, *OpensearchInterfaceImpl) {
	server := httptest.NewServer(pluginsHandler(t, recorder, nodePlugins...))
	t.Cleanup(server.Close)

	t.Setenv("MM_ELASTICSEARCHSETTINGS_CONNECTIONURL", server.URL)
	t.Setenv("MM_ELASTICSEARCHSETTINGS_BACKEND", model.ElasticsearchSettingsOSBackend)

	th := api4.SetupEnterprise(t)
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ElasticsearchSettings.ConnectionURL = server.URL
		*cfg.ElasticsearchSettings.Backend = model.ElasticsearchSettingsOSBackend
		*cfg.ElasticsearchSettings.EnableIndexing = true
		*cfg.ElasticsearchSettings.EnableSearching = true
		*cfg.ElasticsearchSettings.EnableCJKAnalyzers = true
	})
	th.App.Srv().SetLicense(model.NewTestLicense())

	impl := &OpensearchInterfaceImpl{Platform: th.Server.Platform()}
	t.Cleanup(func() { require.Nil(t, impl.Stop()) })

	return th, impl
}

// TestCJKAnalyzersWithPrefixedPluginNames covers a cluster that reports analysis plugins under the
// prefixed component name a managed service assigns to plugins it does not bundle. AWS OpenSearch
// Service reports the Korean analyzer installed through associate-package as
// "opensearch-analysis-nori" while its bundled analyzers keep their unprefixed names.
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
			th, impl := setupCJKCluster(t, recorder, naming.Plugins)
			require.Nil(t, impl.Start(context.Background()))

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
				_, _, appErr := impl.SearchPosts(channels, model.ParseSearchParams(terms, 0), 0, 20)
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
	th, impl := setupCJKCluster(t, recorder, []string{"analysis-icu"})
	require.Nil(t, impl.Start(context.Background()))

	template := recorder.PostsTemplate()
	require.NotEmpty(t, template, "no posts index template was created")
	require.Empty(t, common.TemplatePropertyFields(t, template, "message"))

	channels := model.ChannelList{{Id: model.NewId(), TeamId: model.NewId(), Type: model.ChannelTypeOpen}}
	_, _, appErr := impl.SearchPosts(channels, model.ParseSearchParams("검색", 0), 0, 20)
	require.Nil(t, appErr)

	bodies := recorder.SearchBodies()
	require.Len(t, bodies, 1)
	common.RequireOnlyBaseFields(t, common.SimpleQueryStringFields(t, bodies[0]))

	require.NoError(t, th.TestLogger.Flush())
	testlib.AssertLog(t, th.LogBuffer, mlog.LvlWarn.Name, missingCJKPluginsWarning)
}

// TestAnalysisICURequirementAcceptsPrefixedNames covers the per-node analysis-icu requirement when
// only some of the nodes report the plugin under a prefixed name.
func TestAnalysisICURequirementAcceptsPrefixedNames(t *testing.T) {
	recorder := &common.ClusterRecorder{}
	_, impl := setupCJKCluster(t, recorder, []string{"opensearch-analysis-icu"}, []string{"analysis-icu"})

	require.Nil(t, impl.Start(context.Background()))
	require.Equal(t, int32(1), impl.ready.Load())
	require.NotEmpty(t, recorder.PostsTemplate(), "no posts index template was created")
}

func (s *OpensearchInterfaceTestSuite) SetupSuite() {
	if os.Getenv("IS_CI") == "true" {
		os.Setenv("MM_ELASTICSEARCHSETTINGS_CONNECTIONURL", "http://opensearch:9201")
		os.Setenv("MM_ELASTICSEARCHSETTINGS_BACKEND", "opensearch")
	}

	s.th = api4.SetupEnterprise(s.T()).InitBasic(s.T())
	s.CommonTestSuite.TH = s.th
	s.CommonTestSuite.GetDocumentFn = func(index, documentID string) (bool, json.RawMessage, error) {
		resp, err := s.client.Document.Get(s.ctx, opensearchapi.DocumentGetReq{
			Index:      index,
			DocumentID: documentID,
		})
		if resp == nil {
			return false, nil, err
		}
		return resp.Found, resp.Source, err
	}
	s.CommonTestSuite.RefreshIndexFn = func() error {
		_, err := s.client.Indices.Refresh(context.Background(), nil)
		return err
	}
	s.CommonTestSuite.CreateIndexFn = func(index string) error {
		_, err := s.client.Indices.Create(s.ctx, opensearchapi.IndicesCreateReq{
			Index: index,
		})
		return err
	}
	s.CommonTestSuite.GetIndexFn = func(indexPattern string) ([]string, error) {
		res, err := s.client.Indices.Get(s.ctx, opensearchapi.IndicesGetReq{
			Indices: []string{indexPattern},
		})
		if err != nil {
			return nil, err
		}
		var names []string
		for name := range *res.IndicesGetRespData {
			names = append(names, name)
		}
		return names, nil
	}

	// Set up the state for the tests.
	s.th.App.UpdateConfig(func(cfg *model.Config) {
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
	s.th.App.SearchEngine().RegisterElasticsearchEngine(&OpensearchInterfaceImpl{Platform: s.th.Server.Platform()})
}

func (s *OpensearchInterfaceTestSuite) TearDownSuite() {
	if os.Getenv("IS_CI") == "true" {
		os.Setenv("MM_ELASTICSEARCHSETTINGS_CONNECTIONURL", "http://elasticsearch:9201")
		os.Unsetenv("MM_ELASTICSEARCHSETTINGS_BACKEND")
	}
}

func (s *OpensearchInterfaceTestSuite) SetupTest() {
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

func (s *OpensearchInterfaceTestSuite) newBulk(client *opensearchapi.Client) *Bulk {
	return NewBulk(
		common.BulkSettings{
			FlushBytes:    0,
			FlushInterval: 0,
			FlushNumReqs:  0,
		},
		client,
		time.Second,
		s.th.Server.Platform().Log())
}

func (s *OpensearchInterfaceTestSuite) TestStopReleasesBothBulkProcessors() {
	impl := s.CommonTestSuite.ESImpl.(*OpensearchInterfaceImpl)
	impl.bulkProcessor = s.newBulk(s.client)
	impl.syncBulkProcessor = s.newBulk(s.client)
	impl.ready.Store(1)
	impl.healthy.Store(1)

	s.Require().Nil(impl.Stop())
	s.Require().Nil(impl.bulkProcessor)
	s.Require().Nil(impl.syncBulkProcessor)
	s.Require().Nil(impl.client)
	s.Require().Equal(int32(0), impl.ready.Load())
	s.Require().Equal(int32(0), impl.healthy.Load())

	// Stop is idempotent after all resources have been detached.
	s.Require().Nil(impl.Stop())
}

type failingRoundTripper struct {
	calls atomic.Int32
}

func (t *failingRoundTripper) RoundTrip(_ *http.Request) (*http.Response, error) {
	t.calls.Add(1)
	return nil, errors.New("bulk request failed")
}

func (s *OpensearchInterfaceTestSuite) TestStopAttemptsBothBulkProcessorsAfterError() {
	transport := &failingRoundTripper{}
	client, err := opensearchapi.NewClient(opensearchapi.Config{
		Client: opensearch.Config{
			Addresses:    []string{"http://localhost:9201"},
			DisableRetry: true,
			Transport:    transport,
		},
	})
	s.Require().NoError(err)

	impl := s.CommonTestSuite.ESImpl.(*OpensearchInterfaceImpl)
	impl.client = client
	impl.bulkProcessor = s.newBulk(client)
	impl.bulkProcessor.pendingRequests = 1
	impl.syncBulkProcessor = s.newBulk(client)
	impl.syncBulkProcessor.pendingRequests = 1
	impl.ready.Store(1)
	impl.healthy.Store(1)

	s.Require().Nil(impl.Stop())
	s.Require().Equal(int32(2), transport.calls.Load())
	s.Require().Nil(impl.bulkProcessor)
	s.Require().Nil(impl.syncBulkProcessor)
}

func (s *OpensearchInterfaceTestSuite) TestStopCleansPartiallyInitializedEngine() {
	impl := s.CommonTestSuite.ESImpl.(*OpensearchInterfaceImpl)
	impl.client = s.client
	impl.bulkProcessor = s.newBulk(s.client)
	impl.syncBulkProcessor = s.newBulk(s.client)
	impl.ready.Store(0)
	impl.healthy.Store(1)

	s.Require().Nil(impl.Stop())
	s.Require().Nil(impl.bulkProcessor)
	s.Require().Nil(impl.syncBulkProcessor)
	s.Require().Nil(impl.client)
	s.Require().Equal(int32(0), impl.ready.Load())
	s.Require().Equal(int32(0), impl.healthy.Load())
}

func (s *OpensearchInterfaceTestSuite) TestSyncBulkIndexChannels() {
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

// TestNoIndexesGracefulHandling verifies that write and search operations
// return nil/empty (not an error) when no indexes exist yet. This covers the
// state before any reindex has run: the index templates are present but the
// actual indexes have never been created.
func (s *OpensearchInterfaceTestSuite) TestNoIndexesGracefulHandling() {
	// SetupTest already calls PurgeIndexes, so there are no indexes at this point.
	impl := s.CommonTestSuite.ESImpl
	rctx := s.th.Context

	s.Run("BackfillPostsChannelType", func() {
		appErr := impl.BackfillPostsChannelType(rctx, []string{"channel1", "channel2"}, "O")
		s.Nil(appErr)
	})

	s.Run("DeleteChannelPosts", func() {
		appErr := impl.DeleteChannelPosts(rctx, s.th.BasicChannel.Id)
		s.Nil(appErr)
	})

	s.Run("DeleteUserPosts", func() {
		appErr := impl.DeleteUserPosts(rctx, s.th.BasicUser.Id)
		s.Nil(appErr)
	})

	s.Run("UpdatePostsChannelTypeByChannelId", func() {
		appErr := impl.UpdatePostsChannelTypeByChannelId(rctx, s.th.BasicChannel.Id, "O")
		s.Nil(appErr)
	})

	s.Run("SearchFiles", func() {
		channels := model.ChannelList{s.th.BasicChannel}
		params := model.ParseSearchParams("test", 0)
		fileIDs, appErr := impl.SearchFiles(channels, params, 0, 20)
		s.Nil(appErr)
		s.Empty(fileIDs)
	})

	s.Run("DeletePostFiles", func() {
		appErr := impl.DeletePostFiles(rctx, s.th.BasicPost.Id)
		s.Nil(appErr)
	})

	s.Run("DeleteUserFiles", func() {
		appErr := impl.DeleteUserFiles(rctx, s.th.BasicUser.Id)
		s.Nil(appErr)
	})

	s.Run("DeleteFilesBatch", func() {
		appErr := impl.DeleteFilesBatch(rctx, model.GetMillis(), 1000)
		s.Nil(appErr)
	})
}

func (s *OpensearchInterfaceTestSuite) TestTemplateCreationClientError() {
	s.Run("Should handle error with CausedBy information from opensearch", func() {
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

		_, err = s.client.IndexTemplate.Create(s.ctx, opensearchapi.IndexTemplateCreateReq{
			IndexTemplate: "test-invalid-template",
			Body:          bytes.NewReader(templateBytes),
		})

		var osErr *opensearch.StructError
		s.Require().ErrorAs(err, &osErr)

		s.Require().NotNil(osErr.Err.CausedBy, "Expected CausedBy to be present")
		s.Require().NotEmpty(osErr.Err.CausedBy.Type)
		s.Require().NotEmpty(osErr.Err.CausedBy.Reason)

		// clean up after test
		_, _ = s.client.IndexTemplate.Delete(s.ctx, opensearchapi.IndexTemplateDeleteReq{
			IndexTemplate: "test-invalid-template",
		})
	})
}
