// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package searchlayer_test

import (
	"testing"

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
	setup := func(t *testing.T, enableFileIndexing bool) (*searchlayer.SearchStore, *storemocks.FileInfoStore, *mocks.SearchEngineInterface) {
		cfg := &model.Config{}
		cfg.SetDefaults()
		cfg.ElasticsearchSettings.EnableFileIndexing = model.NewPointer(enableFileIndexing)

		fileInfoStore := &storemocks.FileInfoStore{}
		baseStore := &storemocks.Store{}
		baseStore.On("FileInfo").Return(fileInfoStore)
		baseStore.On("Channel").Return(&storemocks.ChannelStore{})
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

		return searchlayer.NewSearchLayer(baseStore, broker, cfg), fileInfoStore, es
	}

	file := &model.FileInfo{Id: model.NewId(), PostId: model.NewId(), ChannelId: model.NewId()}

	t.Run("indexes saved files when file indexing is enabled", func(t *testing.T) {
		layer, fileInfoStore, es := setup(t, true)
		fileInfoStore.On("Save", mock.Anything, file).Return(file, nil)
		es.On("IndexFile", file, file.ChannelId).Return(nil)

		_, err := layer.FileInfo().Save(request.TestContext(t), file)
		require.NoError(t, err)

		es.AssertCalled(t, "IndexFile", file, file.ChannelId)
	})

	t.Run("does not index saved files when file indexing is disabled", func(t *testing.T) {
		layer, fileInfoStore, es := setup(t, false)
		fileInfoStore.On("Save", mock.Anything, file).Return(file, nil)

		_, err := layer.FileInfo().Save(request.TestContext(t), file)
		require.NoError(t, err)

		es.AssertNotCalled(t, "IndexFile", mock.Anything, mock.Anything)
	})
}
