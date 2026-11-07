// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package searchlayer_test

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store/searchlayer"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
	"github.com/mattermost/mattermost/server/v8/platform/services/searchengine"
	semocks "github.com/mattermost/mattermost/server/v8/platform/services/searchengine/mocks"
)

const harnessTeamID = "team-index-harness"

// postIndexHarness composes the search layer over a mocked base store and a
// mocked search engine, and records every post ID handed to engine.IndexPost.
//
// Synchronization decision: the engine mock reports IsIndexingSync() == true.
// runIndexFn (layer.go) then executes the index function inline and calls
// RefreshIndexes before returning, so by the time Save/SaveMultiple returns,
// every IndexPost call has already happened. No sleeps, no polling.
type postIndexHarness struct {
	layer     *searchlayer.SearchStore
	postStore *mocks.PostStore
	engine    *semocks.SearchEngineInterface
	indexed   []string
}

func newPostIndexHarness(t *testing.T) *postIndexHarness {
	t.Helper()
	h := &postIndexHarness{}

	baseStore := &mocks.Store{}
	h.postStore = &mocks.PostStore{}
	channelStore := &mocks.ChannelStore{}
	baseStore.On("Post").Return(h.postStore)
	baseStore.On("Channel").Return(channelStore)
	baseStore.On("Team").Return(&mocks.TeamStore{})
	baseStore.On("User").Return(&mocks.UserStore{})
	baseStore.On("FileInfo").Return(&mocks.FileInfoStore{})

	channelStore.On("Get", mock.AnythingOfType("string"), true).Return(
		func(id string, _ bool) *model.Channel {
			return &model.Channel{Id: id, TeamId: harnessTeamID, Type: model.ChannelTypeOpen}
		}, nil)

	h.engine = &semocks.SearchEngineInterface{}
	h.engine.On("IsActive").Return(true)
	h.engine.On("IsHealthy").Return(true)
	h.engine.On("IsIndexingEnabled").Return(true)
	h.engine.On("IsIndexingSync").Return(true)
	h.engine.On("RefreshIndexes", mock.Anything).Return(nil).Maybe()
	h.engine.On("GetName").Return("mock-engine").Maybe()
	h.engine.On("IndexPost", mock.Anything, harnessTeamID, string(model.ChannelTypeOpen)).
		Run(func(args mock.Arguments) {
			h.indexed = append(h.indexed, args.Get(0).(*model.Post).Id)
		}).Return(nil).Maybe()

	cfg := &model.Config{}
	cfg.SetDefaults()
	broker := searchengine.NewBroker(cfg)
	broker.RegisterElasticsearchEngine(h.engine)

	h.layer = searchlayer.NewSearchLayer(baseStore, broker, cfg)
	return h
}

// Control: the existing single-post path indexes the post returned by the
// underlying store, under its own ID.
func TestSearchPostStore_SaveIndexesPost(t *testing.T) {
	h := newPostIndexHarness(t)
	rctx := request.TestContext(t)

	input := &model.Post{ChannelId: "chan-1", UserId: "user-1", Message: "hello"}
	saved := &model.Post{Id: model.NewId(), ChannelId: "chan-1", UserId: "user-1", Message: "hello"}
	h.postStore.On("Save", mock.Anything, input).Return(saved, nil)

	got, err := h.layer.Post().Save(rctx, input)
	require.NoError(t, err)
	require.Same(t, saved, got)
	require.Equal(t, []string{saved.Id}, h.indexed)
}

// Requirement (admin console, "Enable Elasticsearch for indexing": "When true,
// indexing of new posts occurs automatically"): a batch save is a save of new
// posts, so every eligible post in the batch must be indexed, each under its
// own ID, and the exclusions of the single-save path still apply.
func TestSearchPostStore_SaveMultipleIndexesEachEligiblePost(t *testing.T) {
	h := newPostIndexHarness(t)
	rctx := request.TestContext(t)

	input := []*model.Post{
		{ChannelId: "chan-1", UserId: "user-1", Message: "first"},
		{ChannelId: "chan-1", UserId: "user-1", Message: "second"},
		{ChannelId: "chan-1", UserId: "user-1", Message: "ephemeral", Type: model.PostTypeBurnOnRead},
		{ChannelId: "chan-1", UserId: "user-1", Message: "card", Type: model.PostTypeCard},
	}
	returned := []*model.Post{
		{Id: model.NewId(), ChannelId: "chan-1", UserId: "user-1", Message: "first"},
		{Id: model.NewId(), ChannelId: "chan-1", UserId: "user-1", Message: "second"},
		{Id: model.NewId(), ChannelId: "chan-1", UserId: "user-1", Message: "ephemeral", Type: model.PostTypeBurnOnRead},
		{Id: model.NewId(), ChannelId: "chan-1", UserId: "user-1", Message: "card", Type: model.PostTypeCard},
	}
	h.postStore.On("SaveMultiple", mock.Anything, input).Return(returned, -1, nil)

	got, errIdx, err := h.layer.Post().SaveMultiple(rctx, input)
	require.NoError(t, err)
	require.Equal(t, -1, errIdx, "success index must pass through unchanged")
	require.Equal(t, returned, got, "saved posts must pass through unchanged")

	// Identity: exactly the two eligible posts, each once, under their own IDs.
	// ElementsMatch also rejects a duplicate or a missing entry.
	require.ElementsMatch(t, []string{returned[0].Id, returned[1].Id}, h.indexed,
		"batch save must index each eligible post exactly once")
	require.NotContains(t, h.indexed, returned[2].Id, "burn-on-read post must not be indexed")
	require.NotContains(t, h.indexed, returned[3].Id, "card post must not be indexed")
}

// Error contract (sqlstore SaveMultiple): on failure the store returns the
// index of the offending post (or -1 for transaction failures) and an error.
// The search layer must pass both through unchanged and index nothing.
func TestSearchPostStore_SaveMultiplePropagatesErrorWithoutIndexing(t *testing.T) {
	h := newPostIndexHarness(t)
	rctx := request.TestContext(t)

	input := []*model.Post{
		{ChannelId: "chan-1", UserId: "user-1", Message: "first"},
		{Id: "preset-id", ChannelId: "chan-1", UserId: "user-1", Message: "second"},
	}
	storeErr := errors.New("invalid input: post id")
	h.postStore.On("SaveMultiple", mock.Anything, input).Return(nil, 1, storeErr)

	got, errIdx, err := h.layer.Post().SaveMultiple(rctx, input)
	require.ErrorIs(t, err, storeErr)
	require.Equal(t, 1, errIdx)
	require.Nil(t, got)
	require.Empty(t, h.indexed, "nothing may be indexed when the batch save fails")
}
