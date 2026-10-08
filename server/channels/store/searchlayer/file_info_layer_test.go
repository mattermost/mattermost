// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package searchlayer_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store/searchlayer"
	storemocks "github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
	"github.com/mattermost/mattermost/server/v8/platform/services/searchengine"
	"github.com/mattermost/mattermost/server/v8/platform/services/searchengine/mocks"
)

func TestFileIndexing(t *testing.T) {
	setup := func(t *testing.T, enableFileIndexing bool) (*searchlayer.SearchStore, *storemocks.FileInfoStore, *storemocks.ChannelStore, *mocks.SearchEngineInterface) {
		cfg := &model.Config{}
		cfg.SetDefaults()
		cfg.ElasticsearchSettings.EnableFileIndexing = model.NewPointer(enableFileIndexing)

		fileInfoStore := &storemocks.FileInfoStore{}
		channelStore := &storemocks.ChannelStore{}
		baseStore := &storemocks.Store{}
		baseStore.On("FileInfo").Return(fileInfoStore)
		baseStore.On("Channel").Return(channelStore)
		baseStore.On("Post").Return(&storemocks.PostStore{})
		baseStore.On("Team").Return(&storemocks.TeamStore{})
		baseStore.On("User").Return(&storemocks.UserStore{})

		es := &mocks.SearchEngineInterface{}
		es.On("IsActive").Return(true)
		es.On("IsHealthy").Return(true)
		es.On("IsIndexingEnabled").Return(true).Maybe()
		es.On("IsSearchEnabled").Return(true).Maybe()
		es.On("IsIndexingSync").Return(true).Maybe()
		es.On("RefreshIndexes", mock.Anything).Return(nil).Maybe()
		es.On("GetName").Return("mock").Maybe()

		broker := searchengine.NewBroker(cfg)
		broker.ElasticsearchEngine = es

		return searchlayer.NewSearchLayer(baseStore, broker, cfg), fileInfoStore, channelStore, es
	}

	file := &model.FileInfo{Id: model.NewId(), PostId: model.NewId(), ChannelId: model.NewId()}

	t.Run("indexes saved files when file indexing is enabled", func(t *testing.T) {
		layer, fileInfoStore, _, es := setup(t, true)
		fileInfoStore.On("Save", mock.Anything, file).Return(file, nil)
		es.On("IndexFile", file, file.ChannelId).Return(nil)

		_, err := layer.FileInfo().Save(request.TestContext(t), file)
		require.NoError(t, err)

		es.AssertCalled(t, "IndexFile", file, file.ChannelId)
	})

	t.Run("does not index saved files when file indexing is disabled", func(t *testing.T) {
		layer, fileInfoStore, _, es := setup(t, false)
		fileInfoStore.On("Save", mock.Anything, file).Return(file, nil)

		_, err := layer.FileInfo().Save(request.TestContext(t), file)
		require.NoError(t, err)

		es.AssertNotCalled(t, "IndexFile", mock.Anything, mock.Anything)
	})

	t.Run("still removes deleted files from the index when file indexing is disabled", func(t *testing.T) {
		layer, fileInfoStore, _, es := setup(t, false)
		fileInfoStore.On("PermanentDelete", mock.Anything, file.Id).Return(nil)
		es.On("DeleteFile", file.Id).Return(nil)

		err := layer.FileInfo().PermanentDelete(request.TestContext(t), file.Id)
		require.NoError(t, err)

		es.AssertCalled(t, "DeleteFile", file.Id)
	})

	t.Run("still searches previously indexed files when file indexing is disabled", func(t *testing.T) {
		layer, fileInfoStore, channelStore, es := setup(t, false)
		paramsList := []*model.SearchParams{{Terms: "test"}}
		channelStore.On("GetChannels", "team_id", "user_id", mock.Anything).Return(model.ChannelList{}, nil)
		es.On("SearchFiles", model.ChannelList{}, paramsList, 0, 20).Return([]string{file.Id}, nil)
		fileInfoStore.On("GetByIds", []string{file.Id}, false, true, false).Return([]*model.FileInfo{file}, nil)

		results, err := layer.FileInfo().Search(request.TestContext(t), paramsList, "user_id", "team_id", 0, 20)
		require.NoError(t, err)

		assert.Equal(t, []string{file.Id}, results.Order)
		fileInfoStore.AssertNotCalled(t, "Search", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything)
	})
}
