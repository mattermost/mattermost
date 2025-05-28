// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/mock"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/store/sqlstore"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
	"github.com/mattermost/mattermost/server/v8/channels/testlib"
	"github.com/mattermost/mattermost/server/v8/platform/services/cache"
	cachemocks "github.com/mattermost/mattermost/server/v8/platform/services/cache/mocks"
)

var mainHelper *testlib.MainHelper

func getMockCacheProvider() cache.Provider {
	mockCacheProvider := cachemocks.Provider{}
	mockCacheProvider.On("NewCache", mock.Anything).
		Return(cache.NewLRU(&cache.CacheOptions{Size: 128}), nil)
	mockCacheProvider.On("Type").Return("lru")
	return &mockCacheProvider
}

func getMockStore(t *testing.T) *mocks.Store {
	mockStore := mocks.Store{}

	fakeReaction := model.Reaction{PostId: "123"}
	mockReactionsStore := mocks.ReactionStore{}
	mockReactionsStore.On("Save", &fakeReaction).Return(&model.Reaction{}, nil)
	mockReactionsStore.On("Delete", &fakeReaction).Return(&model.Reaction{}, nil)
	mockReactionsStore.On("GetForPost", "123", false).Return([]*model.Reaction{&fakeReaction}, nil)
	mockReactionsStore.On("GetForPost", "123", true).Return([]*model.Reaction{&fakeReaction}, nil)
	mockStore.On("Reaction").Return(&mockReactionsStore)

	fakeRole := model.Role{Id: "123", Name: "role-name"}
	fakeRole2 := model.Role{Id: "456", Name: "role-name2"}
	mockRolesStore := mocks.RoleStore{}
	mockRolesStore.On("Save", &fakeRole).Return(&model.Role{}, nil)
	mockRolesStore.On("Delete", "123").Return(&fakeRole, nil)
	mockRolesStore.On("GetByName", context.Background(), "role-name").Return(&fakeRole, nil)
	mockRolesStore.On("GetByNames", []string{"role-name"}).Return([]*model.Role{&fakeRole}, nil)
	mockRolesStore.On("GetByNames", []string{"role-name2"}).Return([]*model.Role{&fakeRole2}, nil)
	mockRolesStore.On("PermanentDeleteAll").Return(nil)
	mockStore.On("Role").Return(&mockRolesStore)

	fakeScheme := model.Scheme{Id: "123", Name: "scheme-name"}
	mockSchemesStore := mocks.SchemeStore{}
	mockSchemesStore.On("Save", &fakeScheme).Return(&model.Scheme{}, nil)
	mockSchemesStore.On("Delete", "123").Return(&model.Scheme{}, nil)
	mockSchemesStore.On("Get", "123").Return(&fakeScheme, nil)
	mockSchemesStore.On("PermanentDeleteAll").Return(nil)
	mockStore.On("Scheme").Return(&mockSchemesStore)

	fakeFileInfo := model.FileInfo{PostId: "123"}
	mockFileInfoStore := mocks.FileInfoStore{}
	mockFileInfoStore.On("GetForPost", "123", true, true, false).Return([]*model.FileInfo{&fakeFileInfo}, nil)
	mockFileInfoStore.On("GetForPost", "123", true, true, true).Return([]*model.FileInfo{&fakeFileInfo}, nil)
	mockFileInfoStore.On("GetByIds", []string{"123"}, true, false).Return([]*model.FileInfo{&fakeFileInfo}, nil)
	mockStore.On("FileInfo").Return(&mockFileInfoStore)

	fakeWebhook := model.IncomingWebhook{Id: "123"}
	mockWebhookStore := mocks.WebhookStore{}
	mockWebhookStore.On("GetIncoming", "123", true).Return(&fakeWebhook, nil)
	mockWebhookStore.On("GetIncoming", "123", false).Return(&fakeWebhook, nil)
	mockStore.On("Webhook").Return(&mockWebhookStore)

	fakeEmoji := model.Emoji{Id: "123", Name: "name123"}
	fakeEmoji2 := model.Emoji{Id: "321", Name: "name321"}
	ctxEmoji := model.Emoji{Id: "master", Name: "name123"}
	mockEmojiStore := mocks.EmojiStore{}
	mockEmojiStore.On("Get", mock.Anything, "123", true).Return(&fakeEmoji, nil)
	mockEmojiStore.On("Get", mock.Anything, "123", false).Return(&fakeEmoji, nil)
	mockEmojiStore.On("Get", mock.IsType(&request.Context{}), "master", true).Return(&ctxEmoji, nil)
	mockEmojiStore.On("Get", sqlstore.RequestContextWithMaster(request.TestContext(t)), "master", true).Return(&ctxEmoji, nil)
	mockEmojiStore.On("GetByName", mock.Anything, "name123", true).Return(&fakeEmoji, nil)
	mockEmojiStore.On("GetByName", mock.Anything, "name123", false).Return(&fakeEmoji, nil)
	mockEmojiStore.On("GetMultipleByName", mock.IsType(&request.Context{}), []string{"name123"}).Return([]*model.Emoji{&fakeEmoji}, nil)
	mockEmojiStore.On("GetMultipleByName", mock.IsType(&request.Context{}), []string{"name123", "name321"}).Return([]*model.Emoji{&fakeEmoji, &fakeEmoji2}, nil)
	mockEmojiStore.On("GetByName", mock.IsType(&request.Context{}), "master", true).Return(&ctxEmoji, nil)
	mockEmojiStore.On("GetByName", sqlstore.RequestContextWithMaster(request.TestContext(t)), "master", false).Return(&ctxEmoji, nil)
	mockEmojiStore.On("Delete", &fakeEmoji, int64(0)).Return(nil)
	mockEmojiStore.On("Delete", &ctxEmoji, int64(0)).Return(nil)
	mockStore.On("Emoji").Return(&mockEmojiStore)

	mockCount := int64(10)
	mockGuestCount := int64(12)
	channelId := "channel1"
	fakeChannel1 := model.Channel{Id: channelId, Name: "channel1-name"}
	fakeChannel2 := model.Channel{Id: "channel2", Name: "channel2-name"}
	mockChannelStore := mocks.ChannelStore{}
	mockChannelStore.On("ClearCaches").Return()
	mockChannelStore.On("GetMemberCount", "id", true).Return(mockCount, nil)
	mockChannelStore.On("GetMemberCount", "id", false).Return(mockCount, nil)
	mockChannelStore.On("GetGuestCount", "id", true).Return(mockGuestCount, nil)
	mockChannelStore.On("GetGuestCount", "id", false).Return(mockGuestCount, nil)
	mockChannelStore.On("Get", channelId, true).Return(&fakeChannel1, nil)
	mockChannelStore.On("Get", channelId, false).Return(&fakeChannel1, nil)
	mockChannelStore.On("GetMany", []string{channelId}, true).Return(model.ChannelList{&fakeChannel1}, nil)
	mockChannelStore.On("GetMany", []string{channelId}, false).Return(model.ChannelList{&fakeChannel1}, nil)
	mockChannelStore.On("GetMany", []string{fakeChannel2.Id}, true).Return(model.ChannelList{&fakeChannel2}, nil)
	mockChannelStore.On("GetByNames", "team1", []string{fakeChannel1.Name}, true).Return([]*model.Channel{&fakeChannel1}, nil)
	mockChannelStore.On("GetByNames", "team1", []string{fakeChannel2.Name}, true).Return([]*model.Channel{&fakeChannel2}, nil)
	mockStore.On("Channel").Return(&mockChannelStore)

	mockChannelsMemberCount := map[string]int64{
		"channel1": 10,
		"channel2": 20,
	}
	mockChannelStore.On("GetChannelsMemberCount", []string{"channel1", "channel2"}).Return(mockChannelsMemberCount, nil)

	mockPinnedPostsCount := int64(10)
	mockChannelStore.On("GetPinnedPostCount", "id", true).Return(mockPinnedPostsCount, nil)
	mockChannelStore.On("GetPinnedPostCount", "id", false).Return(mockPinnedPostsCount, nil)

	fakePosts := &model.PostList{}
	fakeOptions := model.GetPostsOptions{ChannelId: "123", PerPage: 30}
	mockPostStore := mocks.PostStore{}
	mockPostStore.On("GetPosts", fakeOptions, true, map[string]bool{}).Return(fakePosts, nil)
	mockPostStore.On("GetPosts", fakeOptions, false, map[string]bool{}).Return(fakePosts, nil)
	mockPostStore.On("InvalidateLastPostTimeCache", "12360")

	mockPostStoreOptions := model.GetPostsSinceOptions{
		ChannelId:        "channelId",
		Time:             1,
		SkipFetchThreads: false,
	}

	mockPostStoreEtagResult := fmt.Sprintf("%v.%v", model.CurrentVersion, 1)
	mockPostStore.On("ClearCaches")
	mockPostStore.On("InvalidateLastPostTimeCache", "channelId")
	mockPostStore.On("GetEtag", "channelId", true, false).Return(mockPostStoreEtagResult)
	mockPostStore.On("GetEtag", "channelId", false, false).Return(mockPostStoreEtagResult)
	mockPostStore.On("GetPostsSince", mockPostStoreOptions, true, map[string]bool{}).Return(model.NewPostList(), nil)
	mockPostStore.On("GetPostsSince", mockPostStoreOptions, false, map[string]bool{}).Return(model.NewPostList(), nil)
	mockStore.On("Post").Return(&mockPostStore)

	fakeTermsOfService := model.TermsOfService{Id: "123", CreateAt: 11111, UserId: "321", Text: "Terms of service test"}
	mockTermsOfServiceStore := mocks.TermsOfServiceStore{}
	mockTermsOfServiceStore.On("InvalidateTermsOfService", "123")
	mockTermsOfServiceStore.On("Save", &fakeTermsOfService).Return(&fakeTermsOfService, nil)
	mockTermsOfServiceStore.On("GetLatest", true).Return(&fakeTermsOfService, nil)
	mockTermsOfServiceStore.On("GetLatest", false).Return(&fakeTermsOfService, nil)
	mockTermsOfServiceStore.On("Get", "123", true).Return(&fakeTermsOfService, nil)
	mockTermsOfServiceStore.On("Get", "123", false).Return(&fakeTermsOfService, nil)
	mockStore.On("TermsOfService").Return(&mockTermsOfServiceStore)

	fakeUser := []*model.User{{
		Id:          "123",
		AuthData:    model.NewPointer("authData"),
		AuthService: "authService",
	}}
	mockUserStore := mocks.UserStore{}
	mockUserStore.On("GetProfileByIds", mock.Anything, []string{"123"}, &store.UserGetByIdsOpts{}, true).Return(fakeUser, nil)
	mockUserStore.On("GetProfileByIds", mock.Anything, []string{"123"}, &store.UserGetByIdsOpts{}, false).Return(fakeUser, nil)

	fakeProfilesInChannelMap := map[string]*model.User{
		"456": {Id: "456"},
	}
	mockUserStore.On("GetAllProfilesInChannel", mock.Anything, "123", true).Return(fakeProfilesInChannelMap, nil)
	mockUserStore.On("GetAllProfilesInChannel", mock.Anything, "123", false).Return(fakeProfilesInChannelMap, nil)
	mockUserStore.On("GetAllProfiles", mock.AnythingOfType("*model.UserGetOptions")).Return(fakeUser, nil)

	mockUserStore.On("Get", mock.Anything, "123").Return(fakeUser[0], nil)
	users := []*model.User{
		fakeUser[0],
		{
			Id:          "456",
			AuthData:    model.NewPointer("authData"),
			AuthService: "authService",
		},
	}
	mockUserStore.On("GetMany", mock.Anything, []string{"123", "456"}).Return(users, nil)
	mockUserStore.On("GetMany", mock.Anything, []string{"123"}).Return(users[0:1], nil)
	mockStore.On("User").Return(&mockUserStore)

	fakeUserTeamIds := []string{"1", "2", "3"}
	mockTeamStore := mocks.TeamStore{}
	mockTeamStore.On("GetUserTeamIds", "123", true).Return(fakeUserTeamIds, nil)
	mockTeamStore.On("GetUserTeamIds", "123", false).Return(fakeUserTeamIds, nil)
	mockStore.On("Team").Return(&mockTeamStore)

	return &mockStore
}

func TestMain(m *testing.M) {
	mainHelper = testlib.NewMainHelperWithOptions(nil)
	defer mainHelper.Close()

	initStores(mainHelper.Logger)
	mainHelper.Main(m)
	tearDownStores()
}
