// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"fmt"
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
	t.Run("GetManyPageContent", func(t *testing.T) { testGetManyPageContent(t, rctx, ss) })
	t.Run("UpdatePageContent", func(t *testing.T) { testUpdatePageContent(t, rctx, ss) })
	t.Run("DeletePageContent", func(t *testing.T) { testDeletePageContent(t, rctx, ss) })
	t.Run("GetPageContentWithDeleted", func(t *testing.T) { testGetPageContentWithDeleted(t, rctx, ss) })
	t.Run("RestorePageContent", func(t *testing.T) { testRestorePageContent(t, rctx, ss) })
	t.Run("PermanentDeletePageContent", func(t *testing.T) { testPermanentDeletePageContent(t, rctx, ss) })
	t.Run("PageContentLargeDocument", func(t *testing.T) { testPageContentLargeDocument(t, rctx, ss) })
	t.Run("PageContentSearchTextExtraction", func(t *testing.T) { testPageContentSearchTextExtraction(t, rctx, ss) })

	t.Cleanup(func() {
		typesSQL := pagePostTypesSQL()
		_, _ = s.GetMaster().Exec(fmt.Sprintf("DELETE FROM PropertyValues WHERE TargetType = 'post' AND TargetID IN (SELECT Id FROM Posts WHERE Type IN (%s))", typesSQL))
		_, _ = s.GetMaster().Exec("DELETE FROM PageContents")
		_, _ = s.GetMaster().Exec(fmt.Sprintf("DELETE FROM Posts WHERE Type IN (%s)", typesSQL))
		// Clean up wikis and channels created by page tests
		_, _ = s.GetMaster().Exec("TRUNCATE Wikis CASCADE")
		_, _ = s.GetMaster().Exec("TRUNCATE Channels CASCADE")
	})
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

		saved, saveErr := ss.Page().SavePageContent(pc)
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

		_, saveErr := ss.Page().SavePageContent(pc)
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
	_, err = ss.Page().SavePageContent(pc)
	require.NoError(t, err)

	t.Run("get existing page content", func(t *testing.T) {
		retrieved, getErr := ss.Page().GetPageContent(page.Id)
		require.NoError(t, getErr)
		require.NotNil(t, retrieved)
		require.Equal(t, page.Id, retrieved.PageId)
		require.Contains(t, retrieved.SearchText, testText)
		require.Equal(t, "doc", retrieved.Content.Type)
	})

	t.Run("fails to get non-existent page content", func(t *testing.T) {
		_, getErr := ss.Page().GetPageContent(model.NewId())
		require.Error(t, getErr)

		var nfErr *store.ErrNotFound
		require.ErrorAs(t, getErr, &nfErr)
	})
}

func testGetManyPageContent(t *testing.T, rctx request.CTX, ss store.Store) {
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

	pages := []*model.Post{}

	for i := range 5 {
		page := &model.Post{
			ChannelId: channel.Id,
			UserId:    user.Id,
			Message:   "",
			Type:      model.PostTypePage,
			Props: model.StringInterface{
				"title": "Test Page " + string(rune('A'+i)),
			},
		}
		page, err = ss.Post().Save(rctx, page)
		require.NoError(t, err)
		pages = append(pages, page)

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
								"text": "Content for page " + string(rune('A'+i)),
							},
						},
					},
				},
			},
		}
		_, saveErr := ss.Page().SavePageContent(pc)
		require.NoError(t, saveErr)
	}

	t.Run("get multiple page contents", func(t *testing.T) {
		pageIDs := []string{pages[0].Id, pages[1].Id, pages[2].Id}

		retrieved, getErr := ss.Page().GetManyPageContents(pageIDs)
		require.NoError(t, getErr)
		require.Len(t, retrieved, 3)

		retrievedMap := make(map[string]*model.PageContent)
		for _, pc := range retrieved {
			retrievedMap[pc.PageId] = pc
		}

		for _, pageID := range pageIDs {
			content, found := retrievedMap[pageID]
			require.True(t, found, "page content not found for %s", pageID)
			require.Equal(t, pageID, content.PageId)
			require.Equal(t, "doc", content.Content.Type)
		}
	})

	t.Run("get all page contents", func(t *testing.T) {
		allPageIDs := []string{}
		for _, page := range pages {
			allPageIDs = append(allPageIDs, page.Id)
		}

		retrieved, getErr := ss.Page().GetManyPageContents(allPageIDs)
		require.NoError(t, getErr)
		require.Len(t, retrieved, 5)
	})

	t.Run("get many with empty list returns empty result", func(t *testing.T) {
		retrieved, getErr := ss.Page().GetManyPageContents([]string{})
		require.NoError(t, getErr)
		require.Empty(t, retrieved)
	})

	t.Run("get many with non-existent IDs returns only existing content", func(t *testing.T) {
		mixedIDs := []string{pages[0].Id, model.NewId(), pages[2].Id, model.NewId()}

		retrieved, getErr := ss.Page().GetManyPageContents(mixedIDs)
		require.NoError(t, getErr)
		require.Len(t, retrieved, 2)

		retrievedMap := make(map[string]*model.PageContent)
		for _, pc := range retrieved {
			retrievedMap[pc.PageId] = pc
		}

		require.Contains(t, retrievedMap, pages[0].Id)
		require.Contains(t, retrievedMap, pages[2].Id)
	})

	t.Run("get many excludes soft-deleted content", func(t *testing.T) {
		deleteErr := ss.Page().DeletePageContent(pages[1].Id, "")
		require.NoError(t, deleteErr)

		pageIDs := []string{pages[0].Id, pages[1].Id, pages[2].Id}
		retrieved, getErr := ss.Page().GetManyPageContents(pageIDs)
		require.NoError(t, getErr)
		require.Len(t, retrieved, 2)

		retrievedMap := make(map[string]*model.PageContent)
		for _, pc := range retrieved {
			retrievedMap[pc.PageId] = pc
		}

		require.Contains(t, retrievedMap, pages[0].Id)
		require.NotContains(t, retrievedMap, pages[1].Id)
		require.Contains(t, retrievedMap, pages[2].Id)
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
	saved, err := ss.Page().SavePageContent(pc)
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

		updated, updateErr := ss.Page().UpdatePageContent(saved)
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

		_, updateErr := ss.Page().UpdatePageContent(nonExistent)
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
	_, err = ss.Page().SavePageContent(pc)
	require.NoError(t, err)

	t.Run("delete existing page content", func(t *testing.T) {
		deleteErr := ss.Page().DeletePageContent(page.Id, "")
		require.NoError(t, deleteErr)

		_, getErr := ss.Page().GetPageContent(page.Id)
		require.Error(t, getErr)

		var nfErr *store.ErrNotFound
		require.ErrorAs(t, getErr, &nfErr)
	})

	t.Run("fails to delete non-existent page content", func(t *testing.T) {
		deleteErr := ss.Page().DeletePageContent(model.NewId(), "")
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

		saved, saveErr := ss.Page().SavePageContent(pc)
		require.NoError(t, saveErr)
		require.NotNil(t, saved)

		retrieved, getErr := ss.Page().GetPageContent(page.Id)
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

		saved, saveErr := ss.Page().SavePageContent(pc)
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
	_, err = ss.Page().SavePageContent(pc)
	require.NoError(t, err)

	t.Run("GetWithDeleted returns soft-deleted content", func(t *testing.T) {
		deleteErr := ss.Page().DeletePageContent(page.Id, "")
		require.NoError(t, deleteErr)

		_, getErr := ss.Page().GetPageContent(page.Id)
		require.Error(t, getErr)

		retrieved, getWithDeletedErr := ss.Page().GetPageContentWithDeleted(page.Id)
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
	_, err = ss.Page().SavePageContent(pc)
	require.NoError(t, err)

	t.Run("Restore clears DeleteAt and makes content accessible", func(t *testing.T) {
		deleteErr := ss.Page().DeletePageContent(page.Id, "")
		require.NoError(t, deleteErr)

		_, getErr := ss.Page().GetPageContent(page.Id)
		require.Error(t, getErr)

		restoreErr := ss.Page().RestorePageContent(page.Id)
		require.NoError(t, restoreErr)

		restored, getErr := ss.Page().GetPageContent(page.Id)
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
		_, err = ss.Page().SavePageContent(pc2)
		require.NoError(t, err)

		restoreErr := ss.Page().RestorePageContent(page2.Id)
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
	_, err = ss.Page().SavePageContent(pc)
	require.NoError(t, err)

	t.Run("PermanentDelete removes content from database", func(t *testing.T) {
		permanentDeleteErr := ss.Page().PermanentDeletePageContent(page.Id)
		require.NoError(t, permanentDeleteErr)

		_, getErr := ss.Page().GetPageContent(page.Id)
		require.Error(t, getErr)

		_, getWithDeletedErr := ss.Page().GetPageContentWithDeleted(page.Id)
		require.Error(t, getWithDeletedErr)

		var nfErr *store.ErrNotFound
		require.ErrorAs(t, getWithDeletedErr, &nfErr)
	})

	t.Run("PermanentDelete succeeds even if content does not exist", func(t *testing.T) {
		permanentDeleteErr := ss.Page().PermanentDeletePageContent(model.NewId())
		require.NoError(t, permanentDeleteErr)
	})
}
