// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package pglayer

import (
	"testing"

	"github.com/mattermost/mattermost-server/v5/store/storetest/mocks"
	"github.com/mattermost/mattermost-server/v5/testlib"
)

var mainHelper *testlib.MainHelper

func getMockStore() *mocks.Store {
	mockStore := mocks.Store{}

	// fakeReaction := model.Reaction{PostId: "123"}
	// mockReactionsStore := mocks.ReactionStore{}
	// mockReactionsStore.On("Save", &fakeReaction).Return(&model.Reaction{}, nil)
	// mockReactionsStore.On("Delete", &fakeReaction).Return(&model.Reaction{}, nil)
	// mockReactionsStore.On("GetForPost", "123", false).Return([]*model.Reaction{&fakeReaction}, nil)
	// mockReactionsStore.On("GetForPost", "123", true).Return([]*model.Reaction{&fakeReaction}, nil)
	// mockStore.On("Reaction").Return(&mockReactionsStore)

	return &mockStore
}

func TestMain(m *testing.M) {
	mainHelper = testlib.NewMainHelperWithOptions(nil)
	defer mainHelper.Close()

	initStores()
	mainHelper.Main(m)
	tearDownStores()
}
