// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package opensearch

import (
	"context"
	"encoding/json"
	"os"
	"testing"

	"github.com/opensearch-project/opensearch-go/v4/opensearchapi"
	"github.com/stretchr/testify/suite"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/api4"
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

func (s *OpensearchInterfaceTestSuite) SetupSuite() {
	if os.Getenv("IS_CI") == "true" {
		os.Setenv("MM_ELASTICSEARCHSETTINGS_CONNECTIONURL", "http://opensearch:9201")
		os.Setenv("MM_ELASTICSEARCHSETTINGS_BACKEND", "opensearch")
	}

	s.th = api4.SetupEnterprise(s.T()).InitBasic()
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
		for name := range res.Indices {
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
	s.CommonTestSuite.ESImpl = s.th.App.SearchEngine().ElasticsearchEngine

	if s.CommonTestSuite.ESImpl.IsActive() {
		appErr := s.CommonTestSuite.ESImpl.Stop()
		s.Require().Nil(appErr)
	}

	s.Require().Nil(s.CommonTestSuite.ESImpl.Start())

	s.Nil(s.CommonTestSuite.ESImpl.PurgeIndexes(s.th.Context))
}
