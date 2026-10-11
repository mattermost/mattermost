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
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
	"github.com/mattermost/mattermost/server/v8/platform/services/searchengine"
	enginemocks "github.com/mattermost/mattermost/server/v8/platform/services/searchengine/mocks"
)

// An engine is handed the channels to search; an empty list would search every channel,
// so leaving out conversations must never reach the engine as an empty list.
func TestSearchEngineLeavesOutDirectAndGroupChannels(t *testing.T) {
	open := &model.Channel{Id: model.NewId(), Type: model.ChannelTypeOpen}
	dm := &model.Channel{Id: model.NewId(), Type: model.ChannelTypeDirect}
	gm := &model.Channel{Id: model.NewId(), Type: model.ChannelTypeGroup}

	setup := func(t *testing.T, userChannels model.ChannelList) (*searchlayer.SearchStore, *enginemocks.SearchEngineInterface) {
		t.Helper()

		channelStore := &mocks.ChannelStore{}
		channelStore.On("GetChannels", mock.Anything, mock.Anything, mock.Anything).Return(userChannels, nil)
		postStore := &mocks.PostStore{}
		postStore.On("GetPostsByIds", mock.Anything).Return([]*model.Post{}, nil).Maybe()
		fileInfoStore := &mocks.FileInfoStore{}
		fileInfoStore.On("GetByIds", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return([]*model.FileInfo{}, nil).Maybe()
		baseStore := &mocks.Store{}
		baseStore.On("Channel").Return(channelStore)
		baseStore.On("Post").Return(postStore)
		baseStore.On("FileInfo").Return(fileInfoStore)
		baseStore.On("Team").Return(&mocks.TeamStore{})
		baseStore.On("User").Return(&mocks.UserStore{})

		engine := &enginemocks.SearchEngineInterface{}
		engine.On("IsActive").Return(true)
		engine.On("IsHealthy").Return(true)
		engine.On("IsSearchEnabled").Return(true)

		cfg := &model.Config{}
		cfg.SetDefaults()
		broker := searchengine.NewBroker(cfg)
		broker.ElasticsearchEngine = engine
		return searchlayer.NewSearchLayer(baseStore, broker, cfg), engine
	}
	params := func(exclude bool) []*model.SearchParams {
		return []*model.SearchParams{{Terms: "test", ExcludeDirectAndGroupChannels: exclude}}
	}
	rctx := request.TestContext(t)

	t.Run("posts: conversations are dropped from the channel list", func(t *testing.T) {
		layer, engine := setup(t, model.ChannelList{open, dm, gm})
		engine.On("SearchPosts", model.ChannelList{open}, mock.Anything, 0, 20).Return([]string{}, model.PostSearchMatches{}, nil).Once()

		_, err := layer.Post().SearchPostsForUser(rctx, params(true), model.NewId(), model.NewId(), 0, 20)
		require.NoError(t, err)
		engine.AssertExpectations(t)
	})

	t.Run("posts: the engine isn't asked when only conversations remain", func(t *testing.T) {
		layer, engine := setup(t, model.ChannelList{dm, gm})

		results, err := layer.Post().SearchPostsForUser(rctx, params(true), model.NewId(), model.NewId(), 0, 20)
		require.NoError(t, err)
		require.Empty(t, results.Order)
		engine.AssertNotCalled(t, "SearchPosts", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
	})

	t.Run("posts: conversations are kept otherwise", func(t *testing.T) {
		layer, engine := setup(t, model.ChannelList{open, dm, gm})
		engine.On("SearchPosts", model.ChannelList{open, dm, gm}, mock.Anything, 0, 20).Return([]string{}, model.PostSearchMatches{}, nil).Once()

		_, err := layer.Post().SearchPostsForUser(rctx, params(false), model.NewId(), model.NewId(), 0, 20)
		require.NoError(t, err)
		engine.AssertExpectations(t)
	})

	t.Run("files: conversations are dropped from the channel list", func(t *testing.T) {
		layer, engine := setup(t, model.ChannelList{open, dm, gm})
		engine.On("SearchFiles", model.ChannelList{open}, mock.Anything, 0, 20).Return([]string{}, nil).Once()

		_, err := layer.FileInfo().Search(rctx, params(true), model.NewId(), model.NewId(), 0, 20)
		require.NoError(t, err)
		engine.AssertExpectations(t)
	})

	t.Run("files: the engine isn't asked when only conversations remain", func(t *testing.T) {
		layer, engine := setup(t, model.ChannelList{dm})

		results, err := layer.FileInfo().Search(rctx, params(true), model.NewId(), model.NewId(), 0, 20)
		require.NoError(t, err)
		require.Empty(t, results.Order)
		engine.AssertNotCalled(t, "SearchFiles", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
	})
}
