// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func createTestContent(text string) model.TipTapDocument {
	return model.TipTapDocument{
		Type: "doc",
		Content: []map[string]any{
			{
				"type": "paragraph",
				"content": []any{
					map[string]any{
						"type": "text",
						"text": text,
					},
				},
			},
		},
	}
}

func assertContentEquals(t *testing.T, expected, actual model.TipTapDocument) {
	expectedJSON, _ := json.Marshal(expected)
	actualJSON, _ := json.Marshal(actual)
	assert.JSONEq(t, string(expectedJSON), string(actualJSON))
}

func TestPageDraftContentStore(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	t.Run("UpsertInsert", func(t *testing.T) { testPageDraftContentUpsertInsert(t, rctx, ss) })
	t.Run("UpsertUpdate", func(t *testing.T) { testPageDraftContentUpsertUpdate(t, rctx, ss) })
	t.Run("Get", func(t *testing.T) { testPageDraftContentGet(t, rctx, ss) })
	t.Run("GetNotFound", func(t *testing.T) { testPageDraftContentGetNotFound(t, rctx, ss) })
	t.Run("Delete", func(t *testing.T) { testPageDraftContentDelete(t, rctx, ss) })
	t.Run("DeleteNotFound", func(t *testing.T) { testPageDraftContentDeleteNotFound(t, rctx, ss) })
	t.Run("GetForWiki", func(t *testing.T) { testPageDraftContentGetForWiki(t, rctx, ss) })
	t.Run("GetForWikiOrdering", func(t *testing.T) { testPageDraftContentGetForWikiOrdering(t, rctx, ss) })
	t.Run("JSONBSerialization", func(t *testing.T) { testPageDraftContentJSONBSerialization(t, rctx, ss) })
	t.Run("LargeContent", func(t *testing.T) { testPageDraftContentLargeContent(t, rctx, ss) })
}

func testPageDraftContentUpsertInsert(t *testing.T, rctx request.CTX, ss store.Store) {
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

	t.Run("insert new page draft content successfully", func(t *testing.T) {
		content := model.TipTapDocument{
			Type: "doc",
			Content: []map[string]any{
				{
					"type": "paragraph",
					"content": []any{
						map[string]any{
							"type": "text",
							"text": "Test content",
						},
					},
				},
			},
		}

		pageDraftContent := &model.PageDraftContent{
			UserId:  user.Id,
			WikiId:  wiki.Id,
			DraftId: model.NewId(),
			Title:   "Test Draft",
			Content: content,
		}

		savedContent, err := ss.PageDraftContent().Upsert(pageDraftContent)
		require.NoError(t, err)
		require.NotNil(t, savedContent)
		assert.Equal(t, pageDraftContent.UserId, savedContent.UserId)
		assert.Equal(t, pageDraftContent.WikiId, savedContent.WikiId)
		assert.Equal(t, pageDraftContent.DraftId, savedContent.DraftId)
		assert.Equal(t, pageDraftContent.Title, savedContent.Title)

		expectedJSON, _ := json.Marshal(pageDraftContent.Content)
		actualJSON, _ := json.Marshal(savedContent.Content)
		assert.JSONEq(t, string(expectedJSON), string(actualJSON))
		assert.NotZero(t, savedContent.CreateAt)
		assert.NotZero(t, savedContent.UpdateAt)
		assert.Equal(t, savedContent.CreateAt, savedContent.UpdateAt)
	})

	t.Run("insert with empty content", func(t *testing.T) {
		emptyContent := model.TipTapDocument{
			Type:    "doc",
			Content: []map[string]any{},
		}

		pageDraftContent := &model.PageDraftContent{
			UserId:  user.Id,
			WikiId:  wiki.Id,
			DraftId: model.NewId(),
			Title:   "",
			Content: emptyContent,
		}

		savedContent, err := ss.PageDraftContent().Upsert(pageDraftContent)
		require.NoError(t, err)
		assert.Equal(t, "", savedContent.Title)

		expectedJSON, _ := json.Marshal(emptyContent)
		actualJSON, _ := json.Marshal(savedContent.Content)
		assert.JSONEq(t, string(expectedJSON), string(actualJSON))
	})
}

func testPageDraftContentUpsertUpdate(t *testing.T, rctx request.CTX, ss store.Store) {
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

	t.Run("update existing page draft content via upsert", func(t *testing.T) {
		initialContent := model.TipTapDocument{
			Type: "doc",
			Content: []map[string]any{
				{
					"type": "paragraph",
					"content": []any{
						map[string]any{
							"type": "text",
							"text": "Initial content",
						},
					},
				},
			},
		}

		pageDraftContent := &model.PageDraftContent{
			UserId:  user.Id,
			WikiId:  wiki.Id,
			DraftId: model.NewId(),
			Title:   "Initial Title",
			Content: initialContent,
		}

		savedContent, err := ss.PageDraftContent().Upsert(pageDraftContent)
		require.NoError(t, err)
		initialCreateAt := savedContent.CreateAt
		initialUpdateAt := savedContent.UpdateAt

		time.Sleep(2 * time.Millisecond)

		updatedContent := model.TipTapDocument{
			Type: "doc",
			Content: []map[string]any{
				{
					"type": "paragraph",
					"content": []any{
						map[string]any{
							"type": "text",
							"text": "Updated content",
						},
					},
				},
			},
		}

		pageDraftContent.Title = "Updated Title"
		pageDraftContent.Content = updatedContent

		updatedContentResult, err := ss.PageDraftContent().Upsert(pageDraftContent)
		require.NoError(t, err)
		assert.Equal(t, "Updated Title", updatedContentResult.Title)

		updatedJSON, _ := json.Marshal(updatedContent)
		actualJSON, _ := json.Marshal(updatedContentResult.Content)
		assert.JSONEq(t, string(updatedJSON), string(actualJSON))
		assert.Equal(t, initialCreateAt, updatedContentResult.CreateAt)
		assert.Greater(t, updatedContentResult.UpdateAt, initialUpdateAt)

		retrievedContent, err := ss.PageDraftContent().Get(user.Id, wiki.Id, pageDraftContent.DraftId)
		require.NoError(t, err)
		assert.Equal(t, "Updated Title", retrievedContent.Title)

		retrievedJSON, _ := json.Marshal(retrievedContent.Content)
		assert.JSONEq(t, string(updatedJSON), string(retrievedJSON))
	})
}

func testPageDraftContentGet(t *testing.T, rctx request.CTX, ss store.Store) {
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

	content := createTestContent("Test content")

	pageDraftContent := &model.PageDraftContent{
		UserId:  user.Id,
		WikiId:  wiki.Id,
		DraftId: model.NewId(),
		Title:   "Test Draft",
		Content: content,
	}
	_, err = ss.PageDraftContent().Upsert(pageDraftContent)
	require.NoError(t, err)

	t.Run("get existing page draft content", func(t *testing.T) {
		retrieved, getErr := ss.PageDraftContent().Get(user.Id, wiki.Id, pageDraftContent.DraftId)
		require.NoError(t, getErr)
		assert.Equal(t, pageDraftContent.UserId, retrieved.UserId)
		assert.Equal(t, pageDraftContent.WikiId, retrieved.WikiId)
		assert.Equal(t, pageDraftContent.DraftId, retrieved.DraftId)
		assert.Equal(t, pageDraftContent.Title, retrieved.Title)
		assertContentEquals(t, pageDraftContent.Content, retrieved.Content)
	})
}

func testPageDraftContentGetNotFound(t *testing.T, rctx request.CTX, ss store.Store) {
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

	t.Run("get non-existent page draft", func(t *testing.T) {
		_, getErr := ss.PageDraftContent().Get(user.Id, wiki.Id, model.NewId())
		assert.Error(t, getErr)
		var nfErr *store.ErrNotFound
		assert.ErrorAs(t, getErr, &nfErr)
	})

	t.Run("get with wrong user id", func(t *testing.T) {
		content := model.TipTapDocument{Type: "doc", Content: []map[string]any{}}

		pageDraftContent := &model.PageDraftContent{
			UserId:  user.Id,
			WikiId:  wiki.Id,
			DraftId: model.NewId(),
			Title:   "Test Draft",
			Content: content,
		}
		_, err := ss.PageDraftContent().Upsert(pageDraftContent)
		require.NoError(t, err)

		_, getErr := ss.PageDraftContent().Get(model.NewId(), wiki.Id, pageDraftContent.DraftId)
		assert.Error(t, getErr)
		var nfErr *store.ErrNotFound
		assert.ErrorAs(t, getErr, &nfErr)
	})

	t.Run("get with wrong wiki id", func(t *testing.T) {
		content := model.TipTapDocument{Type: "doc", Content: []map[string]any{}}

		pageDraftContent := &model.PageDraftContent{
			UserId:  user.Id,
			WikiId:  wiki.Id,
			DraftId: model.NewId(),
			Title:   "Test Draft",
			Content: content,
		}
		_, err := ss.PageDraftContent().Upsert(pageDraftContent)
		require.NoError(t, err)

		_, getErr := ss.PageDraftContent().Get(user.Id, model.NewId(), pageDraftContent.DraftId)
		assert.Error(t, getErr)
		var nfErr *store.ErrNotFound
		assert.ErrorAs(t, getErr, &nfErr)
	})
}

func testPageDraftContentDelete(t *testing.T, rctx request.CTX, ss store.Store) {
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

	t.Run("delete existing page draft", func(t *testing.T) {
		content := model.TipTapDocument{Type: "doc", Content: []map[string]any{}}

		pageDraftContent := &model.PageDraftContent{
			UserId:  user.Id,
			WikiId:  wiki.Id,
			DraftId: model.NewId(),
			Title:   "Test Draft",
			Content: content,
		}
		_, err := ss.PageDraftContent().Upsert(pageDraftContent)
		require.NoError(t, err)

		deleteErr := ss.PageDraftContent().Delete(user.Id, wiki.Id, pageDraftContent.DraftId)
		require.NoError(t, deleteErr)

		_, getErr := ss.PageDraftContent().Get(user.Id, wiki.Id, pageDraftContent.DraftId)
		assert.Error(t, getErr)
		var nfErr *store.ErrNotFound
		assert.ErrorAs(t, getErr, &nfErr)
	})
}

func testPageDraftContentDeleteNotFound(t *testing.T, rctx request.CTX, ss store.Store) {
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

	t.Run("delete non-existent page draft", func(t *testing.T) {
		deleteErr := ss.PageDraftContent().Delete(user.Id, wiki.Id, model.NewId())
		assert.Error(t, deleteErr)
		var nfErr *store.ErrNotFound
		assert.ErrorAs(t, deleteErr, &nfErr)
	})
}

func testPageDraftContentGetForWiki(t *testing.T, rctx request.CTX, ss store.Store) {
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

	wiki1 := &model.Wiki{
		ChannelId: channel.Id,
		Title:     "Wiki 1",
	}
	wiki1, err = ss.Wiki().Save(wiki1)
	require.NoError(t, err)

	wiki2 := &model.Wiki{
		ChannelId: channel.Id,
		Title:     "Wiki 2",
	}
	wiki2, err = ss.Wiki().Save(wiki2)
	require.NoError(t, err)

	content := model.TipTapDocument{Type: "doc", Content: []map[string]any{}}

	draft1 := &model.PageDraftContent{
		UserId:  user.Id,
		WikiId:  wiki1.Id,
		DraftId: model.NewId(),
		Title:   "Draft 1",
		Content: content,
	}
	_, err = ss.PageDraftContent().Upsert(draft1)
	require.NoError(t, err)

	draft2 := &model.PageDraftContent{
		UserId:  user.Id,
		WikiId:  wiki1.Id,
		DraftId: model.NewId(),
		Title:   "Draft 2",
		Content: content,
	}
	_, err = ss.PageDraftContent().Upsert(draft2)
	require.NoError(t, err)

	draft3 := &model.PageDraftContent{
		UserId:  user.Id,
		WikiId:  wiki2.Id,
		DraftId: model.NewId(),
		Title:   "Draft 3",
		Content: content,
	}
	_, err = ss.PageDraftContent().Upsert(draft3)
	require.NoError(t, err)

	t.Run("get all drafts for wiki", func(t *testing.T) {
		drafts, getErr := ss.PageDraftContent().GetForWiki(user.Id, wiki1.Id)
		require.NoError(t, getErr)
		assert.Len(t, drafts, 2)
		for _, d := range drafts {
			assert.Equal(t, user.Id, d.UserId)
			assert.Equal(t, wiki1.Id, d.WikiId)
		}
	})

	t.Run("get drafts for wiki with no drafts", func(t *testing.T) {
		emptyWiki := &model.Wiki{
			ChannelId: channel.Id,
			Title:     "Empty Wiki",
		}
		emptyWiki, err := ss.Wiki().Save(emptyWiki)
		require.NoError(t, err)

		drafts, getErr := ss.PageDraftContent().GetForWiki(user.Id, emptyWiki.Id)
		require.NoError(t, getErr)
		assert.Empty(t, drafts)
	})

	t.Run("get drafts for non-existent wiki", func(t *testing.T) {
		drafts, getErr := ss.PageDraftContent().GetForWiki(user.Id, model.NewId())
		require.NoError(t, getErr)
		assert.Empty(t, drafts)
	})
}

func testPageDraftContentGetForWikiOrdering(t *testing.T, rctx request.CTX, ss store.Store) {
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

	content := model.TipTapDocument{Type: "doc", Content: []map[string]any{}}

	t.Run("drafts ordered by UpdateAt DESC", func(t *testing.T) {
		draft1 := &model.PageDraftContent{
			UserId:  user.Id,
			WikiId:  wiki.Id,
			DraftId: model.NewId(),
			Title:   "First Draft",
			Content: content,
		}
		_, err := ss.PageDraftContent().Upsert(draft1)
		require.NoError(t, err)

		draft2 := &model.PageDraftContent{
			UserId:  user.Id,
			WikiId:  wiki.Id,
			DraftId: model.NewId(),
			Title:   "Second Draft",
			Content: content,
		}
		_, err = ss.PageDraftContent().Upsert(draft2)
		require.NoError(t, err)

		draft3 := &model.PageDraftContent{
			UserId:  user.Id,
			WikiId:  wiki.Id,
			DraftId: model.NewId(),
			Title:   "Third Draft",
			Content: content,
		}
		_, err = ss.PageDraftContent().Upsert(draft3)
		require.NoError(t, err)

		drafts, getErr := ss.PageDraftContent().GetForWiki(user.Id, wiki.Id)
		require.NoError(t, getErr)
		require.Len(t, drafts, 3)

		assert.GreaterOrEqual(t, drafts[0].UpdateAt, drafts[1].UpdateAt)
		assert.GreaterOrEqual(t, drafts[1].UpdateAt, drafts[2].UpdateAt)
	})
}

func testPageDraftContentJSONBSerialization(t *testing.T, rctx request.CTX, ss store.Store) {
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

	t.Run("complex TipTap document serialization", func(t *testing.T) {
		complexContent := model.TipTapDocument{
			Type: "doc",
			Content: []map[string]any{
				{
					"type": "heading",
					"attrs": map[string]any{
						"level": 1,
					},
					"content": []any{
						map[string]any{
							"type": "text",
							"text": "Heading",
						},
					},
				},
				{
					"type": "paragraph",
					"content": []any{
						map[string]any{
							"type": "text",
							"text": "Bold text",
							"marks": []any{
								map[string]any{
									"type": "bold",
								},
							},
						},
						map[string]any{
							"type": "text",
							"text": " and ",
						},
						map[string]any{
							"type": "text",
							"text": "italic text",
							"marks": []any{
								map[string]any{
									"type": "italic",
								},
							},
						},
					},
				},
				{
					"type": "bulletList",
					"content": []any{
						map[string]any{
							"type": "listItem",
							"content": []any{
								map[string]any{
									"type": "paragraph",
									"content": []any{
										map[string]any{
											"type": "text",
											"text": "Item 1",
										},
									},
								},
							},
						},
					},
				},
			},
		}

		pageDraftContent := &model.PageDraftContent{
			UserId:  user.Id,
			WikiId:  wiki.Id,
			DraftId: model.NewId(),
			Title:   "Complex Draft",
			Content: complexContent,
		}

		savedContent, err := ss.PageDraftContent().Upsert(pageDraftContent)
		require.NoError(t, err)
		assertContentEquals(t, complexContent, savedContent.Content)

		retrieved, err := ss.PageDraftContent().Get(user.Id, wiki.Id, pageDraftContent.DraftId)
		require.NoError(t, err)
		assertContentEquals(t, complexContent, retrieved.Content)

		assert.Equal(t, "doc", retrieved.Content.Type)
		assert.NotNil(t, retrieved.Content.Content)
	})

	t.Run("special characters in content", func(t *testing.T) {
		specialContent := model.TipTapDocument{
			Type: "doc",
			Content: []map[string]any{
				{
					"type": "paragraph",
					"content": []any{
						map[string]any{
							"type": "text",
							"text": "Special chars: 日本語 中文 한국어 🎉 \" ' \\ / \n \t",
						},
					},
				},
			},
		}

		pageDraftContent := &model.PageDraftContent{
			UserId:  user.Id,
			WikiId:  wiki.Id,
			DraftId: model.NewId(),
			Title:   "Special Characters",
			Content: specialContent,
		}

		_, err := ss.PageDraftContent().Upsert(pageDraftContent)
		require.NoError(t, err)

		retrieved, err := ss.PageDraftContent().Get(user.Id, wiki.Id, pageDraftContent.DraftId)
		require.NoError(t, err)

		assert.Equal(t, specialContent.Type, retrieved.Content.Type)
		assert.Len(t, retrieved.Content.Content, 1)

		retrievedText := retrieved.Content.Content[0]["content"].([]any)[0].(map[string]any)["text"].(string)
		assert.Contains(t, retrievedText, "日本語")
		assert.Contains(t, retrievedText, "中文")
		assert.Contains(t, retrievedText, "한국어")
		assert.Contains(t, retrievedText, "🎉")
		assert.Contains(t, retrievedText, "\\")
		assert.Contains(t, retrievedText, "/")
	})
}

func testPageDraftContentLargeContent(t *testing.T, rctx request.CTX, ss store.Store) {
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

	t.Run("content exceeding 64KB", func(t *testing.T) {
		largeText := strings.Repeat("This is a test paragraph with reasonable length. ", 2000)

		largeContent := model.TipTapDocument{
			Type: "doc",
			Content: []map[string]any{
				{
					"type": "paragraph",
					"content": []any{
						map[string]any{
							"type": "text",
							"text": largeText,
						},
					},
				},
			},
		}

		contentJSON, _ := json.Marshal(largeContent)
		require.Greater(t, len(contentJSON), 64*1024)

		pageDraftContent := &model.PageDraftContent{
			UserId:  user.Id,
			WikiId:  wiki.Id,
			DraftId: model.NewId(),
			Title:   "Large Content Draft",
			Content: largeContent,
		}

		savedContent, err := ss.PageDraftContent().Upsert(pageDraftContent)
		require.NoError(t, err)
		assertContentEquals(t, largeContent, savedContent.Content)

		retrieved, err := ss.PageDraftContent().Get(user.Id, wiki.Id, pageDraftContent.DraftId)
		require.NoError(t, err)
		assertContentEquals(t, largeContent, retrieved.Content)

		retrievedJSON, _ := json.Marshal(retrieved.Content)
		assert.Greater(t, len(retrievedJSON), 64*1024)
	})

	t.Run("content approaching 10MB limit", func(t *testing.T) {
		veryLargeText := strings.Repeat("A", 9*1024*1024)

		veryLargeContent := model.TipTapDocument{
			Type: "doc",
			Content: []map[string]any{
				{
					"type": "paragraph",
					"content": []any{
						map[string]any{
							"type": "text",
							"text": veryLargeText,
						},
					},
				},
			},
		}

		contentJSON, _ := json.Marshal(veryLargeContent)
		require.Greater(t, len(contentJSON), 9*1024*1024)

		pageDraftContent := &model.PageDraftContent{
			UserId:  user.Id,
			WikiId:  wiki.Id,
			DraftId: model.NewId(),
			Title:   "Very Large Content Draft",
			Content: veryLargeContent,
		}

		_, err := ss.PageDraftContent().Upsert(pageDraftContent)
		require.NoError(t, err)

		retrieved, err := ss.PageDraftContent().Get(user.Id, wiki.Id, pageDraftContent.DraftId)
		require.NoError(t, err)

		retrievedJSON, _ := json.Marshal(retrieved.Content)
		assert.Equal(t, len(contentJSON), len(retrievedJSON))
	})
}
