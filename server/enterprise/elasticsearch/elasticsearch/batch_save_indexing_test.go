// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package elasticsearch

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/api4"
)

// Posts saved through the store's batch path must be
// findable on a live Elasticsearch engine, without a manual reindex.
// Requires the test containers (postgres, elasticsearch, redis) from `make start-docker`.
//
// Synchronization: LiveIndexingBatchSize = 1 makes IsIndexingSync() true, so
// runIndexFn indexes inline and refreshes the index before Save/SaveMultiple
// return. The search helper refreshes once more explicitly; there is no sleep.
func TestBatchSaveIsSearchableOnLiveEngine(t *testing.T) {
	th := api4.SetupEnterprise(t).InitBasic(t)
	th.App.UpdateConfig(func(cfg *model.Config) {
		// Keep this test's indexes separate from other tests and local instances.
		*cfg.ElasticsearchSettings.IndexPrefix = "batch-save-" + model.NewId() + "-"
		*cfg.ElasticsearchSettings.EnableIndexing = true
		*cfg.ElasticsearchSettings.EnableSearching = true
		*cfg.ElasticsearchSettings.LiveIndexingBatchSize = 1
		*cfg.SqlSettings.DisableDatabaseSearch = true
	})
	th.App.Srv().SetLicense(model.NewTestLicense())
	th.App.SearchEngine().RegisterElasticsearchEngine(&ElasticsearchInterfaceImpl{Platform: th.Server.Platform()})
	es := th.App.SearchEngine().ElasticsearchEngine
	require.Nil(t, es.Start(context.Background()))
	t.Cleanup(func() { _ = es.Stop() })
	t.Cleanup(func() { require.Nil(t, es.PurgeIndexes(th.Context)) })
	require.Nil(t, es.PurgeIndexes(th.Context))
	require.Nil(t, es.RefreshIndexes(th.Context))
	require.True(t, es.IsActive(), "engine must be active")
	require.True(t, es.IsHealthy(), "engine must be healthy")
	require.True(t, es.IsIndexingSync(), "test relies on synchronous live indexing")

	posts := th.App.Srv().Store().Post()
	channels := model.ChannelList{th.BasicChannel}
	search := func(term string) []string {
		require.Nil(t, es.RefreshIndexes(th.Context))
		ids, _, appErr := es.SearchPosts(channels, []*model.SearchParams{{Terms: term}}, 0, 20)
		require.Nil(t, appErr)
		return ids
	}
	newPost := func() *model.Post {
		return &model.Post{UserId: th.BasicUser.Id, ChannelId: th.BasicChannel.Id, Message: model.NewId()}
	}

	// Control: the single-save path is searchable.
	single := newPost()
	savedSingle, err := posts.Save(th.Context, single)
	require.NoError(t, err)
	require.Equal(t, []string{savedSingle.Id}, search(savedSingle.Message), "control: single Save must be searchable")

	// Batch of two eligible posts.
	batch := []*model.Post{newPost(), newPost()}
	saved, errIdx, err := posts.SaveMultiple(th.Context, batch)
	require.NoError(t, err)
	require.Equal(t, -1, errIdx)
	require.Len(t, saved, 2)

	// Both rows are in the database ...
	for _, p := range saved {
		got, gerr := posts.GetSingle(th.Context, p.Id, false)
		require.NoError(t, gerr)
		require.Equal(t, p.Id, got.Id)
	}
	// ... and each must be findable under its own ID.
	require.Equal(t, []string{saved[0].Id}, search(saved[0].Message), "batch post A must be searchable after SaveMultiple")
	require.Equal(t, []string{saved[1].Id}, search(saved[1].Message), "batch post B must be searchable after SaveMultiple")
}
