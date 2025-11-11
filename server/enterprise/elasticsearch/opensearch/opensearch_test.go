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
