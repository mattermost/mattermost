// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package localcachelayer

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store/storetest/mocks"
	"github.com/mattermost/mattermost-server/testlib"
)

var mainHelper *testlib.MainHelper

func getMockStore() *mocks.Store {
	mockStore := mocks.Store{}

	fakeReaction := model.Reaction{PostId: "123"}
	mockReactionsStore := mocks.ReactionStore{}
	mockReactionsStore.On("Save", &fakeReaction).Return(&model.Reaction{}, nil)
	mockReactionsStore.On("Delete", &fakeReaction).Return(&model.Reaction{}, nil)
	mockReactionsStore.On("GetForPost", "123", false).Return([]*model.Reaction{&fakeReaction}, nil)
	mockReactionsStore.On("GetForPost", "123", true).Return([]*model.Reaction{&fakeReaction}, nil)
	mockStore.On("Reaction").Return(&mockReactionsStore)

	fakeRole := model.Role{Id: "123", Name: "role-name"}
	mockRolesStore := mocks.RoleStore{}
	mockRolesStore.On("Save", &fakeRole).Return(&model.Role{}, nil)
	mockRolesStore.On("Delete", "123").Return(&fakeRole, nil)
	mockRolesStore.On("GetByName", "role-name").Return(&fakeRole, nil)
	mockRolesStore.On("GetByNames", []string{"role-name"}).Return([]*model.Role{&fakeRole}, nil)
	mockRolesStore.On("PermanentDeleteAll").Return(nil)
	mockStore.On("Role").Return(&mockRolesStore)

	fakeScheme := model.Scheme{Id: "123", Name: "scheme-name"}
	mockSchemesStore := mocks.SchemeStore{}
	mockSchemesStore.On("Save", &fakeScheme).Return(&model.Scheme{}, nil)
	mockSchemesStore.On("Delete", "123").Return(&model.Scheme{}, nil)
	mockSchemesStore.On("Get", "123").Return(&fakeScheme, nil)
	mockSchemesStore.On("PermanentDeleteAll").Return(nil)
	mockStore.On("Scheme").Return(&mockSchemesStore)

	fakeEmoji := model.Emoji{Id: "123", Name: "name123"}
	mockEmojiStore := mocks.EmojiStore{}
	mockEmojiStore.On("Get", "123", true).Return(&fakeEmoji, nil)
	mockEmojiStore.On("Get", "123", false).Return(&fakeEmoji, nil)
	mockEmojiStore.On("GetByName", "name123", true).Return(&fakeEmoji, nil)
	mockEmojiStore.On("GetByName", "name123", false).Return(&fakeEmoji, nil)
	mockEmojiStore.On("Delete", &fakeEmoji, int64(0)).Return(nil)
	mockStore.On("Emoji").Return(&mockEmojiStore)

	mockCount := int64(10)
	mockChannelStore := mocks.ChannelStore{}
	mockChannelStore.On("ClearCaches").Return()
	mockChannelStore.On("GetMemberCount", "id", true).Return(mockCount, nil)
	mockChannelStore.On("GetMemberCount", "id", false).Return(mockCount, nil)
	mockStore.On("Channel").Return(&mockChannelStore)

	return &mockStore
}

func TestMain(m *testing.M) {
	mainHelper = testlib.NewMainHelperWithOptions(nil)
	defer mainHelper.Close()

	initStores()
	mainHelper.Main(m)
	tearDownStores()
}
