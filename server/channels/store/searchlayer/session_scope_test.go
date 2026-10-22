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
	publicOpen := &model.Channel{Id: model.NewId(), Type: model.ChannelTypeOpen}
	listed := &model.Channel{Id: model.NewId(), Type: model.ChannelTypePrivate}
	openOnly := &model.SessionScopeResources{OpenTeamPublicChannels: true}
	listedOnly := &model.SessionScopeResources{ChannelIDs: []string{listed.Id, publicOpen.Id}}

	setup := func(t *testing.T) (*searchlayer.SearchStore, *storemocks.ChannelStore, *storemocks.TeamStore, *mocks.SearchEngineInterface) {
		cfg := &model.Config{}
		cfg.SetDefaults()

		channelStore := &storemocks.ChannelStore{}
		teamStore := &storemocks.TeamStore{}
		postStore := &storemocks.PostStore{}
		postStore.On("GetPostsByIds", mock.Anything).Return([]*model.Post{}, nil).Maybe()
		baseStore := &storemocks.Store{}
		baseStore.On("Channel").Return(channelStore)
		baseStore.On("Post").Return(postStore)
		baseStore.On("Team").Return(teamStore)
		baseStore.On("User").Return(&storemocks.UserStore{})
		baseStore.On("FileInfo").Return(&storemocks.FileInfoStore{})

		es := &mocks.SearchEngineInterface{}
		es.On("IsActive").Return(true)
		es.On("IsHealthy").Return(true)
		es.On("IsSearchEnabled").Return(true)
		es.On("GetName").Return("mock").Maybe()

		broker := searchengine.NewBroker(cfg)
		broker.ElasticsearchEngine = es
		return searchlayer.NewSearchLayer(baseStore, broker, cfg), channelStore, teamStore, es
	}

	t.Run("scoped search passes the scope's channels, not memberships", func(t *testing.T) {
		layer, channelStore, _, es := setup(t)
		channelStore.On("GetChannelsInSessionScope", "", openOnly).Return(model.ChannelList{publicOpen}, nil).Once()
		channelStore.On("GetChannelsInSessionScope", "", listedOnly).Return(model.ChannelList{listed, publicOpen}, nil)

		var searched model.ChannelList
		es.On("SearchPosts", mock.Anything, mock.Anything, 0, 20).Run(func(args mock.Arguments) {
			searched = args.Get(0).(model.ChannelList)
		}).Return([]string{}, model.PostSearchMatches{}, nil)

		params := &model.SearchParams{Terms: "x", ScopedChannels: &model.SessionScopeResources{ChannelIDs: listedOnly.ChannelIDs, OpenTeamPublicChannels: true}}
		_, err := layer.Post().SearchPostsForUser(request.TestContext(t), []*model.SearchParams{params}, model.NewId(), "", 0, 20)
		require.NoError(t, err)
		assert.ElementsMatch(t, model.ChannelList{publicOpen, listed}, searched, "deduplicated union of open-team and listed channels")
		channelStore.AssertNotCalled(t, "GetChannels", mock.Anything, mock.Anything, mock.Anything)

		_, err = layer.Post().SearchPostsForUser(request.TestContext(t), []*model.SearchParams{params}, model.NewId(), "", 0, 20)
		require.NoError(t, err)
		channelStore.AssertNumberOfCalls(t, "GetChannelsInSessionScope", 3)
	})

	t.Run("team writes clear the open-team cache", func(t *testing.T) {
		layer, channelStore, teamStore, es := setup(t)
		channelStore.On("GetChannelsInSessionScope", "", openOnly).Return(model.ChannelList{publicOpen}, nil)
		teamStore.On("Update", mock.Anything).Return(&model.Team{}, nil)
		es.On("SearchFiles", mock.Anything, mock.Anything, 0, 20).Return([]string{}, nil)

		params := &model.SearchParams{Terms: "x", ScopedChannels: openOnly}
		_, err := layer.FileInfo().Search(request.TestContext(t), []*model.SearchParams{params}, model.NewId(), "", 0, 20)
		require.NoError(t, err)
		_, err = layer.Team().Update(&model.Team{})
		require.NoError(t, err)
		_, err = layer.FileInfo().Search(request.TestContext(t), []*model.SearchParams{params}, model.NewId(), "", 0, 20)
		require.NoError(t, err)
		channelStore.AssertNumberOfCalls(t, "GetChannelsInSessionScope", 2)
	})

	t.Run("unscoped search still uses memberships", func(t *testing.T) {
		layer, channelStore, _, es := setup(t)
		userID := model.NewId()
		channelStore.On("GetChannels", "", userID, mock.Anything).Return(model.ChannelList{listed}, nil)
		es.On("SearchPosts", model.ChannelList{listed}, mock.Anything, 0, 20).Return([]string{}, model.PostSearchMatches{}, nil)

		_, err := layer.Post().SearchPostsForUser(request.TestContext(t), []*model.SearchParams{{Terms: "x"}}, userID, "", 0, 20)
		require.NoError(t, err)
		channelStore.AssertNotCalled(t, "GetChannelsInSessionScope", mock.Anything, mock.Anything)
	})
}
