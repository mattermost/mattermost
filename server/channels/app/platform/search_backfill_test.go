// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"testing"

	"github.com/stretchr/testify/mock"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
	searchenginemocks "github.com/mattermost/mattermost/server/v8/platform/services/searchengine/mocks"
)

func TestBackfillPostsChannelType(t *testing.T) {
	t.Run("already completed", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		mockStore := th.Service.Store.(*mocks.Store)

		systemMock := &mocks.SystemStore{}
		systemMock.On("GetByName", model.SystemPostChannelTypeBackfillComplete).
			Return(&model.System{Name: model.SystemPostChannelTypeBackfillComplete, Value: "true"}, nil)
		mockStore.On("System").Return(systemMock)

		engineMock := &searchenginemocks.SearchEngineInterface{}

		th.Service.backfillPostsChannelType(engineMock)

		systemMock.AssertExpectations(t)
		engineMock.AssertNotCalled(t, "BackfillPostsChannelType", mock.Anything, mock.Anything, mock.Anything)
	})

	t.Run("successful backfill", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		mockStore := th.Service.Store.(*mocks.Store)

		systemMock := &mocks.SystemStore{}
		systemMock.On("GetByName", model.SystemPostChannelTypeBackfillComplete).
			Return(nil, model.NewAppError("test", "not_found", nil, "", 404))
		systemMock.On("SaveOrUpdate", &model.System{
			Name:  model.SystemPostChannelTypeBackfillComplete,
			Value: "true",
		}).Return(nil)
		mockStore.On("System").Return(systemMock)

		channelMock := &mocks.ChannelStore{}

		// Public channels: return 2 channels then empty.
		channelMock.On("GetAllChannels", 0, 10000, mock.MatchedBy(func(opts any) bool {
			// Can't easily match the struct, so accept any call here.
			return true
		})).Return(model.ChannelListWithTeamData{
			{Channel: model.Channel{Id: "ch1"}},
			{Channel: model.Channel{Id: "ch2"}},
		}, nil).Once()

		// Second call for public channels (page 1) — empty means done.
		// But actually, since len(2) < 10000, the loop breaks after the first page.
		// So for private channels, return 1 channel.
		channelMock.On("GetAllChannels", 0, 10000, mock.MatchedBy(func(opts any) bool {
			return true
		})).Return(model.ChannelListWithTeamData{
			{Channel: model.Channel{Id: "ch3"}},
		}, nil).Once()
		mockStore.On("Channel").Return(channelMock)

		engineMock := &searchenginemocks.SearchEngineInterface{}
		engineMock.On("BackfillPostsChannelType", mock.Anything, []string{"ch1", "ch2"}, "O").Return(nil)
		engineMock.On("BackfillPostsChannelType", mock.Anything, []string{"ch3"}, "P").Return(nil)

		th.Service.backfillPostsChannelType(engineMock)

		engineMock.AssertExpectations(t)
		systemMock.AssertExpectations(t)
	})

	t.Run("GetAllChannels error stops backfill", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		mockStore := th.Service.Store.(*mocks.Store)

		systemMock := &mocks.SystemStore{}
		systemMock.On("GetByName", model.SystemPostChannelTypeBackfillComplete).
			Return(nil, model.NewAppError("test", "not_found", nil, "", 404))
		mockStore.On("System").Return(systemMock)

		channelMock := &mocks.ChannelStore{}
		channelMock.On("GetAllChannels", 0, 10000, mock.Anything).
			Return(nil, model.NewAppError("test", "store_error", nil, "", 500))
		mockStore.On("Channel").Return(channelMock)

		engineMock := &searchenginemocks.SearchEngineInterface{}

		th.Service.backfillPostsChannelType(engineMock)

		// BackfillPostsChannelType should never be called.
		engineMock.AssertNotCalled(t, "BackfillPostsChannelType", mock.Anything, mock.Anything, mock.Anything)
		// Completion flag should not be written.
		systemMock.AssertNotCalled(t, "SaveOrUpdate", mock.Anything)
	})

	t.Run("BackfillPostsChannelType error stops backfill", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		mockStore := th.Service.Store.(*mocks.Store)

		systemMock := &mocks.SystemStore{}
		systemMock.On("GetByName", model.SystemPostChannelTypeBackfillComplete).
			Return(nil, model.NewAppError("test", "not_found", nil, "", 404))
		mockStore.On("System").Return(systemMock)

		channelMock := &mocks.ChannelStore{}
		channelMock.On("GetAllChannels", 0, 10000, mock.Anything).
			Return(model.ChannelListWithTeamData{
				{Channel: model.Channel{Id: "ch1"}},
			}, nil).Once()
		mockStore.On("Channel").Return(channelMock)

		engineMock := &searchenginemocks.SearchEngineInterface{}
		engineMock.On("BackfillPostsChannelType", mock.Anything, []string{"ch1"}, "O").
			Return(model.NewAppError("test", "es_error", nil, "", 500))

		th.Service.backfillPostsChannelType(engineMock)

		// Should not continue to private channels after error on public.
		engineMock.AssertNotCalled(t, "BackfillPostsChannelType", mock.Anything, mock.Anything, "P")
		// Completion flag should not be written.
		systemMock.AssertNotCalled(t, "SaveOrUpdate", mock.Anything)
	})
}
