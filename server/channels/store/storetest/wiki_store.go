// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func TestWikiStore(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	t.Run("SaveWiki", func(t *testing.T) { testSaveWiki(t, rctx, ss) })
	t.Run("GetWiki", func(t *testing.T) { testGetWiki(t, rctx, ss) })
	t.Run("GetForChannel", func(t *testing.T) { testGetForChannel(t, rctx, ss) })
	t.Run("UpdateWiki", func(t *testing.T) { testUpdateWiki(t, rctx, ss) })
	t.Run("DeleteWiki", func(t *testing.T) { testDeleteWiki(t, rctx, ss) })
	t.Run("GetPages", func(t *testing.T) { testGetPages(t, rctx, ss) })
}

func testSaveWiki(t *testing.T, rctx request.CTX, ss store.Store) {
	team := &model.Team{
		DisplayName: "Test Team",
		Name:        model.NewId(),
		Email:       "test@example.com",
		Type:        model.TeamOpen,
	}
	team, err := ss.Team().Save(team)
	require.NoError(t, err)
	defer func() { _ = ss.Team().PermanentDelete(team.Id) }()

	channel := &model.Channel{
		TeamId:      team.Id,
		DisplayName: "Test Channel",
		Name:        model.NewId(),
		Type:        model.ChannelTypeOpen,
	}
	channel, nErr := ss.Channel().Save(rctx, channel, 100)
	require.NoError(t, nErr)
	defer func() { _ = ss.Channel().PermanentDelete(rctx, channel.Id) }()

	wiki := &model.Wiki{
		ChannelId:   channel.Id,
		Title:       "Test Wiki",
		Description: "Test wiki description",
	}

	t.Run("save wiki successfully", func(t *testing.T) {
		savedWiki, err := ss.Wiki().Save(wiki)
		require.NoError(t, err)
		require.NotEmpty(t, savedWiki.Id)
		assert.Equal(t, wiki.ChannelId, savedWiki.ChannelId)
		assert.Equal(t, wiki.Title, savedWiki.Title)
		assert.Equal(t, wiki.Description, savedWiki.Description)
		assert.NotZero(t, savedWiki.CreateAt)
		assert.NotZero(t, savedWiki.UpdateAt)
		assert.Zero(t, savedWiki.DeleteAt)
	})

	t.Run("save wiki with missing required fields", func(t *testing.T) {
		invalidWiki := &model.Wiki{
			Title: "No Channel",
		}
		_, err := ss.Wiki().Save(invalidWiki)
		assert.Error(t, err)
	})

	t.Run("save wiki with non-existent channel", func(t *testing.T) {
		invalidWiki := &model.Wiki{
			ChannelId: model.NewId(),
			Title:     "Test Wiki",
		}
		_, err := ss.Wiki().Save(invalidWiki)
		assert.Error(t, err)
	})
}

func testGetWiki(t *testing.T, rctx request.CTX, ss store.Store) {
	team := &model.Team{
		DisplayName: "Test Team",
		Name:        model.NewId(),
		Email:       "test@example.com",
		Type:        model.TeamOpen,
	}
	team, err := ss.Team().Save(team)
	require.NoError(t, err)
	defer func() { _ = ss.Team().PermanentDelete(team.Id) }()

	channel := &model.Channel{
		TeamId:      team.Id,
		DisplayName: "Test Channel",
		Name:        model.NewId(),
		Type:        model.ChannelTypeOpen,
	}
	channel, nErr := ss.Channel().Save(rctx, channel, 100)
	require.NoError(t, nErr)
	defer func() { _ = ss.Channel().PermanentDelete(rctx, channel.Id) }()

	wiki := &model.Wiki{
		ChannelId: channel.Id,
		Title:     "Test Wiki",
	}
	wiki, err = ss.Wiki().Save(wiki)
	require.NoError(t, err)

	t.Run("get existing wiki", func(t *testing.T) {
		retrieved, getErr := ss.Wiki().Get(wiki.Id)
		require.NoError(t, getErr)
		assert.Equal(t, wiki.Id, retrieved.Id)
		assert.Equal(t, wiki.ChannelId, retrieved.ChannelId)
		assert.Equal(t, wiki.Title, retrieved.Title)
	})

	t.Run("get non-existent wiki", func(t *testing.T) {
		_, getErr := ss.Wiki().Get(model.NewId())
		assert.Error(t, getErr)
		var nfErr *store.ErrNotFound
		assert.ErrorAs(t, getErr, &nfErr)
	})

	t.Run("get deleted wiki", func(t *testing.T) {
		deletedWiki := &model.Wiki{
			ChannelId: channel.Id,
			Title:     "Deleted Wiki",
		}
		deletedWiki, err = ss.Wiki().Save(deletedWiki)
		require.NoError(t, err)

		err = ss.Wiki().Delete(deletedWiki.Id, false)
		require.NoError(t, err)

		_, err = ss.Wiki().Get(deletedWiki.Id)
		assert.Error(t, err)
		var nfErr *store.ErrNotFound
		assert.ErrorAs(t, err, &nfErr)
	})
}

func testGetForChannel(t *testing.T, rctx request.CTX, ss store.Store) {
	team := &model.Team{
		DisplayName: "Test Team",
		Name:        model.NewId(),
		Email:       "test@example.com",
		Type:        model.TeamOpen,
	}
	team, err := ss.Team().Save(team)
	require.NoError(t, err)
	defer func() { _ = ss.Team().PermanentDelete(team.Id) }()

	channel := &model.Channel{
		TeamId:      team.Id,
		DisplayName: "Test Channel",
		Name:        model.NewId(),
		Type:        model.ChannelTypeOpen,
	}
	channel, nErr := ss.Channel().Save(rctx, channel, 100)
	require.NoError(t, nErr)
	defer func() { _ = ss.Channel().PermanentDelete(rctx, channel.Id) }()

	wiki1 := &model.Wiki{
		ChannelId: channel.Id,
		Title:     "Wiki 1",
	}
	_, err = ss.Wiki().Save(wiki1)
	require.NoError(t, err)

	wiki2 := &model.Wiki{
		ChannelId: channel.Id,
		Title:     "Wiki 2",
	}
	_, err = ss.Wiki().Save(wiki2)
	require.NoError(t, err)

	deletedWiki := &model.Wiki{
		ChannelId: channel.Id,
		Title:     "Deleted Wiki",
	}
	deletedWiki, err = ss.Wiki().Save(deletedWiki)
	require.NoError(t, err)
	err = ss.Wiki().Delete(deletedWiki.Id, false)
	require.NoError(t, err)

	t.Run("get wikis for channel excluding deleted", func(t *testing.T) {
		wikis, err := ss.Wiki().GetForChannel(channel.Id, false)
		require.NoError(t, err)
		assert.Len(t, wikis, 2)
		for _, w := range wikis {
			assert.Zero(t, w.DeleteAt)
		}
	})

	t.Run("get wikis for channel including deleted", func(t *testing.T) {
		wikis, getErr := ss.Wiki().GetForChannel(channel.Id, true)
		require.NoError(t, getErr)
		assert.Len(t, wikis, 3)
	})

	t.Run("get wikis for non-existent channel", func(t *testing.T) {
		wikis, err := ss.Wiki().GetForChannel(model.NewId(), false)
		require.NoError(t, err)
		assert.Empty(t, wikis)
	})
}

func testUpdateWiki(t *testing.T, rctx request.CTX, ss store.Store) {
	team := &model.Team{
		DisplayName: "Test Team",
		Name:        model.NewId(),
		Email:       "test@example.com",
		Type:        model.TeamOpen,
	}
	team, err := ss.Team().Save(team)
	require.NoError(t, err)
	defer func() { _ = ss.Team().PermanentDelete(team.Id) }()

	channel := &model.Channel{
		TeamId:      team.Id,
		DisplayName: "Test Channel",
		Name:        model.NewId(),
		Type:        model.ChannelTypeOpen,
	}
	channel, nErr := ss.Channel().Save(rctx, channel, 100)
	require.NoError(t, nErr)
	defer func() { _ = ss.Channel().PermanentDelete(rctx, channel.Id) }()

	wiki := &model.Wiki{
		ChannelId: channel.Id,
		Title:     "Original Title",
	}
	wiki, err = ss.Wiki().Save(wiki)
	require.NoError(t, err)

	t.Run("update wiki successfully", func(t *testing.T) {
		wiki.Title = "Updated Title"
		wiki.Description = "Updated description"

		updated, updateErr := ss.Wiki().Update(wiki)
		require.NoError(t, updateErr)
		assert.Equal(t, wiki.Id, updated.Id)
		assert.Equal(t, "Updated Title", updated.Title)
		assert.Equal(t, "Updated description", updated.Description)
		assert.Greater(t, updated.UpdateAt, wiki.CreateAt)
	})

	t.Run("update non-existent wiki", func(t *testing.T) {
		nonExistent := &model.Wiki{
			Id:        model.NewId(),
			ChannelId: channel.Id,
			Title:     "Non-existent",
		}
		_, updateErr := ss.Wiki().Update(nonExistent)
		assert.Error(t, updateErr)
		var nfErr *store.ErrNotFound
		assert.ErrorAs(t, updateErr, &nfErr)
	})

	t.Run("update deleted wiki", func(t *testing.T) {
		deletedWiki := &model.Wiki{
			ChannelId: channel.Id,
			Title:     "To be deleted",
		}
		deletedWiki, err = ss.Wiki().Save(deletedWiki)
		require.NoError(t, err)

		err = ss.Wiki().Delete(deletedWiki.Id, false)
		require.NoError(t, err)

		deletedWiki.Title = "Should not update"
		_, err = ss.Wiki().Update(deletedWiki)
		assert.Error(t, err)
		var nfErr *store.ErrNotFound
		assert.ErrorAs(t, err, &nfErr)
	})
}

func testDeleteWiki(t *testing.T, rctx request.CTX, ss store.Store) {
	team := &model.Team{
		DisplayName: "Test Team",
		Name:        model.NewId(),
		Email:       "test@example.com",
		Type:        model.TeamOpen,
	}
	team, err := ss.Team().Save(team)
	require.NoError(t, err)
	defer func() { _ = ss.Team().PermanentDelete(team.Id) }()

	channel := &model.Channel{
		TeamId:      team.Id,
		DisplayName: "Test Channel",
		Name:        model.NewId(),
		Type:        model.ChannelTypeOpen,
	}
	channel, nErr := ss.Channel().Save(rctx, channel, 100)
	require.NoError(t, nErr)
	defer func() { _ = ss.Channel().PermanentDelete(rctx, channel.Id) }()

	t.Run("soft delete wiki", func(t *testing.T) {
		wiki := &model.Wiki{
			ChannelId: channel.Id,
			Title:     "To be soft deleted",
		}
		wiki, saveErr := ss.Wiki().Save(wiki)
		require.NoError(t, saveErr)

		deleteErr := ss.Wiki().Delete(wiki.Id, false)
		require.NoError(t, deleteErr)

		_, getErr := ss.Wiki().Get(wiki.Id)
		assert.Error(t, getErr)

		wikis, listErr := ss.Wiki().GetForChannel(channel.Id, true)
		require.NoError(t, listErr)
		found := false
		for _, w := range wikis {
			if w.Id == wiki.Id {
				found = true
				assert.NotZero(t, w.DeleteAt)
				break
			}
		}
		assert.True(t, found)
	})

	t.Run("permanent delete wiki", func(t *testing.T) {
		wiki := &model.Wiki{
			ChannelId: channel.Id,
			Title:     "To be permanently deleted",
		}
		wiki, saveErr := ss.Wiki().Save(wiki)
		require.NoError(t, saveErr)

		deleteErr := ss.Wiki().Delete(wiki.Id, true)
		require.NoError(t, deleteErr)

		_, getErr := ss.Wiki().Get(wiki.Id)
		assert.Error(t, getErr)

		wikis, listErr := ss.Wiki().GetForChannel(channel.Id, true)
		require.NoError(t, listErr)
		for _, w := range wikis {
			assert.NotEqual(t, wiki.Id, w.Id)
		}
	})

	t.Run("delete non-existent wiki", func(t *testing.T) {
		err := ss.Wiki().Delete(model.NewId(), false)
		assert.Error(t, err)
		var nfErr *store.ErrNotFound
		assert.ErrorAs(t, err, &nfErr)
	})
}

func testGetPages(t *testing.T, rctx request.CTX, ss store.Store) {
	team := &model.Team{
		DisplayName: "Test Team",
		Name:        model.NewId(),
		Email:       "test@example.com",
		Type:        model.TeamOpen,
	}
	team, err := ss.Team().Save(team)
	require.NoError(t, err)
	defer func() { _ = ss.Team().PermanentDelete(team.Id) }()

	channel := &model.Channel{
		TeamId:      team.Id,
		DisplayName: "Test Channel",
		Name:        model.NewId(),
		Type:        model.ChannelTypeOpen,
	}
	channel, nErr := ss.Channel().Save(rctx, channel, 100)
	require.NoError(t, nErr)
	defer func() { _ = ss.Channel().PermanentDelete(rctx, channel.Id) }()

	user := &model.User{
		Email:    "test@example.com",
		Username: "testuser" + model.NewId(),
	}
	user, err = ss.User().Save(rctx, user)
	require.NoError(t, err)
	defer func() { _ = ss.User().PermanentDelete(rctx, user.Id) }()

	wiki := &model.Wiki{
		ChannelId: channel.Id,
		Title:     "Test Wiki",
	}
	wiki, err = ss.Wiki().Save(wiki)
	require.NoError(t, err)

	page1 := &model.Post{
		ChannelId: channel.Id,
		UserId:    user.Id,
		Message:   "Page 1",
		Type:      model.PostTypePage,
	}
	page1, err = ss.Post().Save(rctx, page1)
	require.NoError(t, err)

	page2 := &model.Post{
		ChannelId: channel.Id,
		UserId:    user.Id,
		Message:   "Page 2",
		Type:      model.PostTypePage,
	}
	page2, err = ss.Post().Save(rctx, page2)
	require.NoError(t, err)

	regularPost := &model.Post{
		ChannelId: channel.Id,
		UserId:    user.Id,
		Message:   "Regular post",
		Type:      "",
	}
	_, err = ss.Post().Save(rctx, regularPost)
	require.NoError(t, err)

	value1 := model.NewId()
	value1JSON := []byte(`"` + value1 + `"`)
	prop1 := &model.PropertyValue{
		TargetType: "post",
		TargetID:   page1.Id,
		GroupID:    model.WikiPropertyGroupID,
		FieldID:    model.WikiPropertyFieldID,
		Value:      value1JSON,
	}
	_, err = ss.PropertyValue().Create(prop1)
	require.NoError(t, err)

	value2 := wiki.Id
	value2JSON := []byte(`"` + value2 + `"`)
	prop2 := &model.PropertyValue{
		TargetType: "post",
		TargetID:   page2.Id,
		GroupID:    model.WikiPropertyGroupID,
		FieldID:    model.WikiPropertyFieldID,
		Value:      value2JSON,
	}
	_, err = ss.PropertyValue().Create(prop2)
	require.NoError(t, err)

	t.Run("get pages for wiki", func(t *testing.T) {
		pages, pagesErr := ss.Wiki().GetPages(wiki.Id, 0, 100)
		require.NoError(t, pagesErr)
		assert.Len(t, pages, 1)
		assert.Equal(t, page2.Id, pages[0].Id)
	})

	t.Run("get pages with pagination", func(t *testing.T) {
		page3 := &model.Post{
			ChannelId: channel.Id,
			UserId:    user.Id,
			Message:   "Page 3",
			Type:      model.PostTypePage,
		}
		page3, saveErr := ss.Post().Save(rctx, page3)
		require.NoError(t, saveErr)

		value3 := wiki.Id
		value3JSON := []byte(`"` + value3 + `"`)
		prop3 := &model.PropertyValue{
			TargetType: "post",
			TargetID:   page3.Id,
			GroupID:    model.WikiPropertyGroupID,
			FieldID:    model.WikiPropertyFieldID,
			Value:      value3JSON,
		}
		_, createErr := ss.PropertyValue().Create(prop3)
		require.NoError(t, createErr)

		pages, pagesErr := ss.Wiki().GetPages(wiki.Id, 0, 1)
		require.NoError(t, pagesErr)
		assert.Len(t, pages, 1)

		pages, pagesErr = ss.Wiki().GetPages(wiki.Id, 1, 1)
		require.NoError(t, pagesErr)
		assert.Len(t, pages, 1)

		pages, pagesErr = ss.Wiki().GetPages(wiki.Id, 0, 100)
		require.NoError(t, pagesErr)
		assert.Len(t, pages, 2)
	})

	t.Run("get pages for non-existent wiki", func(t *testing.T) {
		pages, pagesErr := ss.Wiki().GetPages(model.NewId(), 0, 100)
		require.NoError(t, pagesErr)
		assert.Empty(t, pages)
	})

	t.Run("get pages excludes deleted posts", func(t *testing.T) {
		deletedPage := &model.Post{
			ChannelId: channel.Id,
			UserId:    user.Id,
			Message:   "Deleted page",
			Type:      model.PostTypePage,
		}
		deletedPage, saveErr := ss.Post().Save(rctx, deletedPage)
		require.NoError(t, saveErr)

		valueDeleted := wiki.Id
		valueDeletedJSON := []byte(`"` + valueDeleted + `"`)
		propDeleted := &model.PropertyValue{
			TargetType: "post",
			TargetID:   deletedPage.Id,
			GroupID:    model.WikiPropertyGroupID,
			FieldID:    model.WikiPropertyFieldID,
			Value:      valueDeletedJSON,
		}
		_, createErr := ss.PropertyValue().Create(propDeleted)
		require.NoError(t, createErr)

		deleteErr := ss.Post().Delete(rctx, deletedPage.Id, model.GetMillis(), user.Id)
		require.NoError(t, deleteErr)

		pages, pagesErr := ss.Wiki().GetPages(wiki.Id, 0, 100)
		require.NoError(t, pagesErr)
		for _, p := range pages {
			assert.NotEqual(t, deletedPage.Id, p.Id)
		}
	})
}
