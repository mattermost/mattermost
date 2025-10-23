// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func TestPageContentStore(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	t.Run("SavePageContent", func(t *testing.T) { testSavePageContent(t, rctx, ss) })
	t.Run("GetPageContent", func(t *testing.T) { testGetPageContent(t, rctx, ss) })
	t.Run("UpdatePageContent", func(t *testing.T) { testUpdatePageContent(t, rctx, ss) })
	t.Run("DeletePageContent", func(t *testing.T) { testDeletePageContent(t, rctx, ss) })
	t.Run("GetPageContentWithDeleted", func(t *testing.T) { testGetPageContentWithDeleted(t, rctx, ss) })
	t.Run("RestorePageContent", func(t *testing.T) { testRestorePageContent(t, rctx, ss) })
	t.Run("PermanentDeletePageContent", func(t *testing.T) { testPermanentDeletePageContent(t, rctx, ss) })
	t.Run("PageContentLargeDocument", func(t *testing.T) { testPageContentLargeDocument(t, rctx, ss) })
	t.Run("PageContentSearchTextExtraction", func(t *testing.T) { testPageContentSearchTextExtraction(t, rctx, ss) })
}

func testSavePageContent(t *testing.T, rctx request.CTX, ss store.Store) {
	team := &model.Team{
		DisplayName: "Test Team",
		Name:        model.NewId(),
		Email:       "test@example.com",
		Type:        model.TeamOpen,
	}
	team, err := ss.Team().Save(team)
	require.NoError(t, err)

	channel := &model.Channel{
		TeamId:      team.Id,
		DisplayName: "Test Channel",
		Name:        model.NewId(),
		Type:        model.ChannelTypeOpen,
	}
	channel, nErr := ss.Channel().Save(rctx, channel, 1000)
	require.NoError(t, nErr)

	user := &model.User{
		Email:    MakeEmail(),
		Username: model.NewUsername(),
	}
	user, err = ss.User().Save(rctx, user)
	require.NoError(t, err)

	page := &model.Post{
		ChannelId: channel.Id,
		UserId:    user.Id,
		Message:   "",
		Type:      model.PostTypePage,
		Props: model.StringInterface{
			"title": "Test Page",
		},
	}
	page, err = ss.Post().Save(rctx, page)
	require.NoError(t, err)

	t.Run("save new page content", func(t *testing.T) {
		pc := &model.PageContent{
			PageId: page.Id,
			Content: model.TipTapDocument{
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
			},
		}

		saved, saveErr := ss.PageContent().Save(pc)
		require.NoError(t, saveErr)
		require.NotNil(t, saved)
		require.Equal(t, page.Id, saved.PageId)
		require.Greater(t, saved.CreateAt, int64(0))
		require.Greater(t, saved.UpdateAt, int64(0))
		require.Contains(t, saved.SearchText, "Test content")
	})

	t.Run("fails to save duplicate page content", func(t *testing.T) {
		pc := &model.PageContent{
			PageId: page.Id,
			Content: model.TipTapDocument{
				Type: "doc",
				Content: []map[string]any{
					{
						"type": "paragraph",
						"content": []any{
							map[string]any{
								"type": "text",
								"text": "Duplicate",
							},
						},
					},
				},
			},
		}

		_, saveErr := ss.PageContent().Save(pc)
		require.Error(t, saveErr)
	})
}

func testGetPageContent(t *testing.T, rctx request.CTX, ss store.Store) {
	team := &model.Team{
		DisplayName: "Test Team",
		Name:        model.NewId(),
		Email:       "test@example.com",
		Type:        model.TeamOpen,
	}
	team, err := ss.Team().Save(team)
	require.NoError(t, err)

	channel := &model.Channel{
		TeamId:      team.Id,
		DisplayName: "Test Channel",
		Name:        model.NewId(),
		Type:        model.ChannelTypeOpen,
	}
	channel, nErr := ss.Channel().Save(rctx, channel, 1000)
	require.NoError(t, nErr)

	user := &model.User{
		Email:    MakeEmail(),
		Username: model.NewUsername(),
	}
	user, err = ss.User().Save(rctx, user)
	require.NoError(t, err)

	page := &model.Post{
		ChannelId: channel.Id,
		UserId:    user.Id,
		Message:   "",
		Type:      model.PostTypePage,
		Props: model.StringInterface{
			"title": "Test Page",
		},
	}
	page, err = ss.Post().Save(rctx, page)
	require.NoError(t, err)

	testText := "Retrieved content"
	pc := &model.PageContent{
		PageId: page.Id,
		Content: model.TipTapDocument{
			Type: "doc",
			Content: []map[string]any{
				{
					"type": "paragraph",
					"content": []any{
						map[string]any{
							"type": "text",
							"text": testText,
						},
					},
				},
			},
		},
	}
	_, err = ss.PageContent().Save(pc)
	require.NoError(t, err)

	t.Run("get existing page content", func(t *testing.T) {
		retrieved, getErr := ss.PageContent().Get(page.Id)
		require.NoError(t, getErr)
		require.NotNil(t, retrieved)
		require.Equal(t, page.Id, retrieved.PageId)
		require.Contains(t, retrieved.SearchText, testText)
		require.Equal(t, "doc", retrieved.Content.Type)
	})

	t.Run("fails to get non-existent page content", func(t *testing.T) {
		_, getErr := ss.PageContent().Get(model.NewId())
		require.Error(t, getErr)

		var nfErr *store.ErrNotFound
		require.ErrorAs(t, getErr, &nfErr)
	})
}

func testUpdatePageContent(t *testing.T, rctx request.CTX, ss store.Store) {
	team := &model.Team{
		DisplayName: "Test Team",
		Name:        model.NewId(),
		Email:       "test@example.com",
		Type:        model.TeamOpen,
	}
	team, err := ss.Team().Save(team)
	require.NoError(t, err)

	channel := &model.Channel{
		TeamId:      team.Id,
		DisplayName: "Test Channel",
		Name:        model.NewId(),
		Type:        model.ChannelTypeOpen,
	}
	channel, nErr := ss.Channel().Save(rctx, channel, 1000)
	require.NoError(t, nErr)

	user := &model.User{
		Email:    MakeEmail(),
		Username: model.NewUsername(),
	}
	user, err = ss.User().Save(rctx, user)
	require.NoError(t, err)

	page := &model.Post{
		ChannelId: channel.Id,
		UserId:    user.Id,
		Message:   "",
		Type:      model.PostTypePage,
		Props: model.StringInterface{
			"title": "Test Page",
		},
	}
	page, err = ss.Post().Save(rctx, page)
	require.NoError(t, err)

	pc := &model.PageContent{
		PageId: page.Id,
		Content: model.TipTapDocument{
			Type: "doc",
			Content: []map[string]any{
				{
					"type": "paragraph",
					"content": []any{
						map[string]any{
							"type": "text",
							"text": "Original content",
						},
					},
				},
			},
		},
	}
	saved, err := ss.PageContent().Save(pc)
	require.NoError(t, err)

	t.Run("update existing page content", func(t *testing.T) {
		originalUpdateAt := saved.UpdateAt

		// Sleep briefly to ensure timestamp will be different
		time.Sleep(2 * time.Millisecond)

		saved.Content = model.TipTapDocument{
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

		updated, updateErr := ss.PageContent().Update(saved)
		require.NoError(t, updateErr)
		require.NotNil(t, updated)
		require.Contains(t, updated.SearchText, "Updated content")
		require.NotContains(t, updated.SearchText, "Original content")
		require.Greater(t, updated.UpdateAt, originalUpdateAt)
	})

	t.Run("fails to update non-existent page content", func(t *testing.T) {
		nonExistent := &model.PageContent{
			PageId: model.NewId(),
			Content: model.TipTapDocument{
				Type:    "doc",
				Content: []map[string]any{},
			},
		}
		nonExistent.PreSave()

		_, updateErr := ss.PageContent().Update(nonExistent)
		require.Error(t, updateErr)

		var nfErr *store.ErrNotFound
		require.ErrorAs(t, updateErr, &nfErr)
	})
}

func testDeletePageContent(t *testing.T, rctx request.CTX, ss store.Store) {
	team := &model.Team{
		DisplayName: "Test Team",
		Name:        model.NewId(),
		Email:       "test@example.com",
		Type:        model.TeamOpen,
	}
	team, err := ss.Team().Save(team)
	require.NoError(t, err)

	channel := &model.Channel{
		TeamId:      team.Id,
		DisplayName: "Test Channel",
		Name:        model.NewId(),
		Type:        model.ChannelTypeOpen,
	}
	channel, nErr := ss.Channel().Save(rctx, channel, 1000)
	require.NoError(t, nErr)

	user := &model.User{
		Email:    MakeEmail(),
		Username: model.NewUsername(),
	}
	user, err = ss.User().Save(rctx, user)
	require.NoError(t, err)

	page := &model.Post{
		ChannelId: channel.Id,
		UserId:    user.Id,
		Message:   "",
		Type:      model.PostTypePage,
		Props: model.StringInterface{
			"title": "Test Page",
		},
	}
	page, err = ss.Post().Save(rctx, page)
	require.NoError(t, err)

	pc := &model.PageContent{
		PageId: page.Id,
		Content: model.TipTapDocument{
			Type: "doc",
			Content: []map[string]any{
				{
					"type": "paragraph",
					"content": []any{
						map[string]any{
							"type": "text",
							"text": "Content to delete",
						},
					},
				},
			},
		},
	}
	_, err = ss.PageContent().Save(pc)
	require.NoError(t, err)

	t.Run("delete existing page content", func(t *testing.T) {
		deleteErr := ss.PageContent().Delete(page.Id)
		require.NoError(t, deleteErr)

		_, getErr := ss.PageContent().Get(page.Id)
		require.Error(t, getErr)

		var nfErr *store.ErrNotFound
		require.ErrorAs(t, getErr, &nfErr)
	})

	t.Run("fails to delete non-existent page content", func(t *testing.T) {
		deleteErr := ss.PageContent().Delete(model.NewId())
		require.Error(t, deleteErr)

		var nfErr *store.ErrNotFound
		require.ErrorAs(t, deleteErr, &nfErr)
	})
}

func testPageContentLargeDocument(t *testing.T, rctx request.CTX, ss store.Store) {
	team := &model.Team{
		DisplayName: "Test Team",
		Name:        model.NewId(),
		Email:       "test@example.com",
		Type:        model.TeamOpen,
	}
	team, err := ss.Team().Save(team)
	require.NoError(t, err)

	channel := &model.Channel{
		TeamId:      team.Id,
		DisplayName: "Test Channel",
		Name:        model.NewId(),
		Type:        model.ChannelTypeOpen,
	}
	channel, nErr := ss.Channel().Save(rctx, channel, 1000)
	require.NoError(t, nErr)

	user := &model.User{
		Email:    MakeEmail(),
		Username: model.NewUsername(),
	}
	user, err = ss.User().Save(rctx, user)
	require.NoError(t, err)

	page := &model.Post{
		ChannelId: channel.Id,
		UserId:    user.Id,
		Message:   "",
		Type:      model.PostTypePage,
		Props: model.StringInterface{
			"title": "Large Page",
		},
	}
	page, err = ss.Post().Save(rctx, page)
	require.NoError(t, err)

	t.Run("save and retrieve large document", func(t *testing.T) {
		content := []map[string]any{}
		for range 100 {
			content = append(content, map[string]any{
				"type": "paragraph",
				"content": []any{
					map[string]any{
						"type": "text",
						"text": "This is paragraph number " + model.NewId() + " with some content to make it larger",
					},
				},
			})
		}

		pc := &model.PageContent{
			PageId: page.Id,
			Content: model.TipTapDocument{
				Type:    "doc",
				Content: content,
			},
		}

		saved, saveErr := ss.PageContent().Save(pc)
		require.NoError(t, saveErr)
		require.NotNil(t, saved)

		retrieved, getErr := ss.PageContent().Get(page.Id)
		require.NoError(t, getErr)
		require.NotNil(t, retrieved)
		require.Len(t, retrieved.Content.Content, 100)
	})
}

func testPageContentSearchTextExtraction(t *testing.T, rctx request.CTX, ss store.Store) {
	team := &model.Team{
		DisplayName: "Test Team",
		Name:        model.NewId(),
		Email:       "test@example.com",
		Type:        model.TeamOpen,
	}
	team, err := ss.Team().Save(team)
	require.NoError(t, err)

	channel := &model.Channel{
		TeamId:      team.Id,
		DisplayName: "Test Channel",
		Name:        model.NewId(),
		Type:        model.ChannelTypeOpen,
	}
	channel, nErr := ss.Channel().Save(rctx, channel, 1000)
	require.NoError(t, nErr)

	user := &model.User{
		Email:    MakeEmail(),
		Username: model.NewUsername(),
	}
	user, err = ss.User().Save(rctx, user)
	require.NoError(t, err)

	page := &model.Post{
		ChannelId: channel.Id,
		UserId:    user.Id,
		Message:   "",
		Type:      model.PostTypePage,
		Props: model.StringInterface{
			"title": "Search Test Page",
		},
	}
	page, err = ss.Post().Save(rctx, page)
	require.NoError(t, err)

	t.Run("extracts search text from complex document", func(t *testing.T) {
		pc := &model.PageContent{
			PageId: page.Id,
			Content: model.TipTapDocument{
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
								"text": "Important Heading",
							},
						},
					},
					{
						"type": "paragraph",
						"content": []any{
							map[string]any{
								"type": "text",
								"text": "This is a paragraph with ",
							},
							map[string]any{
								"type": "text",
								"text": "bold text",
								"marks": []any{
									map[string]any{
										"type": "bold",
									},
								},
							},
							map[string]any{
								"type": "text",
								"text": " and normal text.",
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
												"text": "List item one",
											},
										},
									},
								},
							},
							map[string]any{
								"type": "listItem",
								"content": []any{
									map[string]any{
										"type": "paragraph",
										"content": []any{
											map[string]any{
												"type": "text",
												"text": "List item two",
											},
										},
									},
								},
							},
						},
					},
				},
			},
		}

		saved, saveErr := ss.PageContent().Save(pc)
		require.NoError(t, saveErr)
		require.NotNil(t, saved)

		assert.Contains(t, saved.SearchText, "Important Heading")
		assert.Contains(t, saved.SearchText, "paragraph")
		assert.Contains(t, saved.SearchText, "bold text")
		assert.Contains(t, saved.SearchText, "List item one")
		assert.Contains(t, saved.SearchText, "List item two")
	})
}

func testGetPageContentWithDeleted(t *testing.T, rctx request.CTX, ss store.Store) {
	team := &model.Team{
		DisplayName: "Test Team",
		Name:        model.NewId(),
		Email:       "test@example.com",
		Type:        model.TeamOpen,
	}
	team, err := ss.Team().Save(team)
	require.NoError(t, err)

	channel := &model.Channel{
		TeamId:      team.Id,
		DisplayName: "Test Channel",
		Name:        model.NewId(),
		Type:        model.ChannelTypeOpen,
	}
	channel, nErr := ss.Channel().Save(rctx, channel, 1000)
	require.NoError(t, nErr)

	user := &model.User{
		Email:    MakeEmail(),
		Username: model.NewUsername(),
	}
	user, err = ss.User().Save(rctx, user)
	require.NoError(t, err)

	page := &model.Post{
		ChannelId: channel.Id,
		UserId:    user.Id,
		Message:   "",
		Type:      model.PostTypePage,
		Props: model.StringInterface{
			"title": "Test Page",
		},
	}
	page, err = ss.Post().Save(rctx, page)
	require.NoError(t, err)

	pc := &model.PageContent{
		PageId: page.Id,
		Content: model.TipTapDocument{
			Type: "doc",
			Content: []map[string]any{
				{
					"type": "paragraph",
					"content": []any{
						map[string]any{
							"type": "text",
							"text": "Content to soft delete",
						},
					},
				},
			},
		},
	}
	_, err = ss.PageContent().Save(pc)
	require.NoError(t, err)

	t.Run("GetWithDeleted returns soft-deleted content", func(t *testing.T) {
		deleteErr := ss.PageContent().Delete(page.Id)
		require.NoError(t, deleteErr)

		_, getErr := ss.PageContent().Get(page.Id)
		require.Error(t, getErr)

		retrieved, getWithDeletedErr := ss.PageContent().GetWithDeleted(page.Id)
		require.NoError(t, getWithDeletedErr)
		require.NotNil(t, retrieved)
		require.Equal(t, page.Id, retrieved.PageId)
		require.Greater(t, retrieved.DeleteAt, int64(0))
		require.Contains(t, retrieved.SearchText, "Content to soft delete")
	})
}

func testRestorePageContent(t *testing.T, rctx request.CTX, ss store.Store) {
	team := &model.Team{
		DisplayName: "Test Team",
		Name:        model.NewId(),
		Email:       "test@example.com",
		Type:        model.TeamOpen,
	}
	team, err := ss.Team().Save(team)
	require.NoError(t, err)

	channel := &model.Channel{
		TeamId:      team.Id,
		DisplayName: "Test Channel",
		Name:        model.NewId(),
		Type:        model.ChannelTypeOpen,
	}
	channel, nErr := ss.Channel().Save(rctx, channel, 1000)
	require.NoError(t, nErr)

	user := &model.User{
		Email:    MakeEmail(),
		Username: model.NewUsername(),
	}
	user, err = ss.User().Save(rctx, user)
	require.NoError(t, err)

	page := &model.Post{
		ChannelId: channel.Id,
		UserId:    user.Id,
		Message:   "",
		Type:      model.PostTypePage,
		Props: model.StringInterface{
			"title": "Test Page",
		},
	}
	page, err = ss.Post().Save(rctx, page)
	require.NoError(t, err)

	pc := &model.PageContent{
		PageId: page.Id,
		Content: model.TipTapDocument{
			Type: "doc",
			Content: []map[string]any{
				{
					"type": "paragraph",
					"content": []any{
						map[string]any{
							"type": "text",
							"text": "Content to restore",
						},
					},
				},
			},
		},
	}
	_, err = ss.PageContent().Save(pc)
	require.NoError(t, err)

	t.Run("Restore clears DeleteAt and makes content accessible", func(t *testing.T) {
		deleteErr := ss.PageContent().Delete(page.Id)
		require.NoError(t, deleteErr)

		_, getErr := ss.PageContent().Get(page.Id)
		require.Error(t, getErr)

		restoreErr := ss.PageContent().Restore(page.Id)
		require.NoError(t, restoreErr)

		restored, getErr := ss.PageContent().Get(page.Id)
		require.NoError(t, getErr)
		require.NotNil(t, restored)
		require.Equal(t, page.Id, restored.PageId)
		require.Equal(t, int64(0), restored.DeleteAt)
		require.Contains(t, restored.SearchText, "Content to restore")
	})

	t.Run("Restore fails for non-deleted content", func(t *testing.T) {
		page2 := &model.Post{
			ChannelId: channel.Id,
			UserId:    user.Id,
			Message:   "",
			Type:      model.PostTypePage,
			Props: model.StringInterface{
				"title": "Non-deleted Page",
			},
		}
		page2, err = ss.Post().Save(rctx, page2)
		require.NoError(t, err)

		pc2 := &model.PageContent{
			PageId: page2.Id,
			Content: model.TipTapDocument{
				Type:    "doc",
				Content: []map[string]any{},
			},
		}
		_, err = ss.PageContent().Save(pc2)
		require.NoError(t, err)

		restoreErr := ss.PageContent().Restore(page2.Id)
		require.Error(t, restoreErr)

		var nfErr *store.ErrNotFound
		require.ErrorAs(t, restoreErr, &nfErr)
	})
}

func testPermanentDeletePageContent(t *testing.T, rctx request.CTX, ss store.Store) {
	team := &model.Team{
		DisplayName: "Test Team",
		Name:        model.NewId(),
		Email:       "test@example.com",
		Type:        model.TeamOpen,
	}
	team, err := ss.Team().Save(team)
	require.NoError(t, err)

	channel := &model.Channel{
		TeamId:      team.Id,
		DisplayName: "Test Channel",
		Name:        model.NewId(),
		Type:        model.ChannelTypeOpen,
	}
	channel, nErr := ss.Channel().Save(rctx, channel, 1000)
	require.NoError(t, nErr)

	user := &model.User{
		Email:    MakeEmail(),
		Username: model.NewUsername(),
	}
	user, err = ss.User().Save(rctx, user)
	require.NoError(t, err)

	page := &model.Post{
		ChannelId: channel.Id,
		UserId:    user.Id,
		Message:   "",
		Type:      model.PostTypePage,
		Props: model.StringInterface{
			"title": "Test Page",
		},
	}
	page, err = ss.Post().Save(rctx, page)
	require.NoError(t, err)

	pc := &model.PageContent{
		PageId: page.Id,
		Content: model.TipTapDocument{
			Type: "doc",
			Content: []map[string]any{
				{
					"type": "paragraph",
					"content": []any{
						map[string]any{
							"type": "text",
							"text": "Content to permanently delete",
						},
					},
				},
			},
		},
	}
	_, err = ss.PageContent().Save(pc)
	require.NoError(t, err)

	t.Run("PermanentDelete removes content from database", func(t *testing.T) {
		permanentDeleteErr := ss.PageContent().PermanentDelete(page.Id)
		require.NoError(t, permanentDeleteErr)

		_, getErr := ss.PageContent().Get(page.Id)
		require.Error(t, getErr)

		_, getWithDeletedErr := ss.PageContent().GetWithDeleted(page.Id)
		require.Error(t, getWithDeletedErr)

		var nfErr *store.ErrNotFound
		require.ErrorAs(t, getWithDeletedErr, &nfErr)
	})

	t.Run("PermanentDelete succeeds even if content does not exist", func(t *testing.T) {
		permanentDeleteErr := ss.PageContent().PermanentDelete(model.NewId())
		require.NoError(t, permanentDeleteErr)
	})
}
