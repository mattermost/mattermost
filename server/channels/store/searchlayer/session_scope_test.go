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

func TestScopedSearchUsesScopeChannels(t *testing.T) {
	listed := model.NewId()
	publicOpen := model.NewId()

	setup := func(t *testing.T) (*searchlayer.SearchStore, *storemocks.ChannelStore, *mocks.SearchEngineInterface) {
		cfg := &model.Config{}
		cfg.SetDefaults()

		channelStore := &storemocks.ChannelStore{}
		postStore := &storemocks.PostStore{}
		postStore.On("GetPostsByIds", mock.Anything).Return([]*model.Post{}, nil).Maybe()
		baseStore := &storemocks.Store{}
		baseStore.On("Channel").Return(channelStore)
		baseStore.On("Post").Return(postStore)
		baseStore.On("Team").Return(&storemocks.TeamStore{})
		baseStore.On("User").Return(&storemocks.UserStore{})
		baseStore.On("FileInfo").Return(&storemocks.FileInfoStore{})

		es := &mocks.SearchEngineInterface{}
		es.On("IsActive").Return(true)
		es.On("IsHealthy").Return(true)
		es.On("IsSearchEnabled").Return(true)
		es.On("GetName").Return("mock").Maybe()

		broker := searchengine.NewBroker(cfg)
		broker.ElasticsearchEngine = es
		return searchlayer.NewSearchLayer(baseStore, broker, cfg), channelStore, es
	}

	scoped := &model.SessionScopeResources{ChannelIDs: []string{listed}, OpenTeamPublicChannels: true}
	channelIDs := func(channels model.ChannelList) []string {
		ids := []string{}
		for _, channel := range channels {
			ids = append(ids, channel.Id)
		}
		return ids
	}

	t.Run("scoped post search passes the scope's channels, not memberships", func(t *testing.T) {
		layer, channelStore, es := setup(t)
		teamID := model.NewId()
		channelStore.On("GetChannelIDsInSessionScope", teamID, scoped, false).Return([]string{listed, publicOpen}, nil)

		var searched model.ChannelList
		es.On("SearchPosts", mock.Anything, mock.Anything, 0, 20).Run(func(args mock.Arguments) {
			searched = args.Get(0).(model.ChannelList)
		}).Return([]string{}, model.PostSearchMatches{}, nil)

		params := &model.SearchParams{Terms: "x", ScopedChannels: scoped}
		_, err := layer.Post().SearchPostsForUser(request.TestContext(t), []*model.SearchParams{params}, model.NewId(), teamID, 0, 20)
		require.NoError(t, err)
		assert.Equal(t, []string{listed, publicOpen}, channelIDs(searched))
		channelStore.AssertNotCalled(t, "GetChannels", mock.Anything, mock.Anything, mock.Anything)
	})

	t.Run("scoped file search passes the scope's channels", func(t *testing.T) {
		layer, channelStore, es := setup(t)
		channelStore.On("GetChannelIDsInSessionScope", "", scoped, false).Return([]string{listed}, nil)

		var searched model.ChannelList
		es.On("SearchFiles", mock.Anything, mock.Anything, 0, 20).Run(func(args mock.Arguments) {
			searched = args.Get(0).(model.ChannelList)
		}).Return([]string{}, nil)

		params := &model.SearchParams{Terms: "x", ScopedChannels: scoped}
		_, err := layer.FileInfo().Search(request.TestContext(t), []*model.SearchParams{params}, model.NewId(), "", 0, 20)
		require.NoError(t, err)
		assert.Equal(t, []string{listed}, channelIDs(searched))
	})

	t.Run("unscoped search still uses memberships", func(t *testing.T) {
		layer, channelStore, es := setup(t)
		userID := model.NewId()
		member := &model.Channel{Id: listed}
		channelStore.On("GetChannels", "", userID, mock.Anything).Return(model.ChannelList{member}, nil)
		es.On("SearchPosts", model.ChannelList{member}, mock.Anything, 0, 20).Return([]string{}, model.PostSearchMatches{}, nil)

		_, err := layer.Post().SearchPostsForUser(request.TestContext(t), []*model.SearchParams{{Terms: "x"}}, userID, "", 0, 20)
		require.NoError(t, err)
		channelStore.AssertNotCalled(t, "GetChannelIDsInSessionScope", mock.Anything, mock.Anything, mock.Anything)
	})
}
