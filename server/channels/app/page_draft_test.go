// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func TestSavePageDraftWithMetadata(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	wiki := &model.Wiki{
		ChannelId: th.BasicChannel.Id,
		Title:     "Test Wiki",
	}
	createdWiki, err := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, err)

	t.Run("successfully saves new page draft", func(t *testing.T) {
		pageId := model.NewId()
		validContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Draft content"}]}]}`
		draft, appErr := th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, createdWiki.Id, pageId, validContent, "Test Draft", 0, nil)
		require.Nil(t, appErr)
		require.NotNil(t, draft)
		require.Equal(t, th.BasicUser.Id, draft.UserId)
		require.Equal(t, createdWiki.Id, draft.WikiId)
		require.Equal(t, pageId, draft.PageId)
		require.Equal(t, "Test Draft", draft.Title)

		jsonContent, jsonErr := draft.GetDocumentJSON()
		require.NoError(t, jsonErr)
		require.JSONEq(t, validContent, jsonContent)
	})

	t.Run("successfully updates existing page draft", func(t *testing.T) {
		pageId := model.NewId()
		initialContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Initial"}]}]}`
		savedDraft, appErr := th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, createdWiki.Id, pageId, initialContent, "Initial Title", 0, nil)
		require.Nil(t, appErr)

		updatedContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Updated"}]}]}`
		updatedDraft, appErr := th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, createdWiki.Id, pageId, updatedContent, "Updated Title", savedDraft.UpdateAt, nil)
		require.Nil(t, appErr)
		require.NotNil(t, updatedDraft)
		require.Equal(t, "Updated Title", updatedDraft.Title)

		jsonContent, jsonErr := updatedDraft.GetDocumentJSON()
		require.NoError(t, jsonErr)
		require.JSONEq(t, updatedContent, jsonContent)
	})

	t.Run("successfully saves draft with custom props", func(t *testing.T) {
		pageId := model.NewId()
		validContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Draft content"}]}]}`
		customProps := map[string]any{
			"custom_field":  "custom_value",
			"another_field": 123,
		}
		draft, appErr := th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, createdWiki.Id, pageId, validContent, "Draft Title", 0, customProps)
		require.Nil(t, appErr)
		require.NotNil(t, draft)
		require.NotNil(t, draft.Props)
		require.Equal(t, "custom_value", draft.Props["custom_field"])
		require.Equal(t, 123, draft.Props["another_field"])
	})

	t.Run("fails with non-existent wiki", func(t *testing.T) {
		pageId := model.NewId()
		validContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Draft content"}]}]}`
		draft, appErr := th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, model.NewId(), pageId, validContent, "Test Draft", 0, nil)
		require.NotNil(t, appErr)
		require.Nil(t, draft)
		require.Equal(t, "app.draft.save_page.wiki_not_found.app_error", appErr.Id)
	})

	t.Run("fails when channel is archived", func(t *testing.T) {
		archivedChannel, chanErr := th.App.CreateChannel(th.Context, &model.Channel{
			TeamId:      th.BasicTeam.Id,
			Name:        "archived-channel",
			DisplayName: "Archived Channel",
			Type:        model.ChannelTypeOpen,
		}, false)
		require.Nil(t, chanErr)

		archivedWiki := &model.Wiki{
			ChannelId: archivedChannel.Id,
			Title:     "Archived Wiki",
		}
		createdArchivedWiki, err := th.App.CreateWiki(th.Context, archivedWiki, th.BasicUser.Id)
		require.Nil(t, err)

		err = th.App.DeleteChannel(th.Context, archivedChannel, th.BasicUser.Id)
		require.Nil(t, err)

		pageId := model.NewId()
		validContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Draft content"}]}]}`
		draft, appErr := th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, createdArchivedWiki.Id, pageId, validContent, "Test Draft", 0, nil)
		require.NotNil(t, appErr)
		require.Nil(t, draft)
		require.Equal(t, "app.draft.save_page.deleted_channel.app_error", appErr.Id)
	})
}

func TestGetPageDraft(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	wiki := &model.Wiki{
		ChannelId: th.BasicChannel.Id,
		Title:     "Test Wiki",
	}
	createdWiki, err := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, err)

	pageId := model.NewId()
	validContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Draft content"}]}]}`
	createdDraft, appErr := th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, createdWiki.Id, pageId, validContent, "Test Draft", 0, nil)
	require.Nil(t, appErr)

	t.Run("successfully retrieves existing draft", func(t *testing.T) {
		draft, appErr := th.App.GetPageDraft(th.Context, th.BasicUser.Id, createdWiki.Id, pageId)
		require.Nil(t, appErr)
		require.NotNil(t, draft)
		require.Equal(t, createdDraft.UserId, draft.UserId)
		require.Equal(t, createdDraft.WikiId, draft.WikiId)
		require.Equal(t, createdDraft.PageId, draft.PageId)
		require.Equal(t, "Test Draft", draft.Title)

		jsonContent, jsonErr := draft.GetDocumentJSON()
		require.NoError(t, jsonErr)
		require.JSONEq(t, validContent, jsonContent)
	})

	t.Run("fails with non-existent draft", func(t *testing.T) {
		draft, appErr := th.App.GetPageDraft(th.Context, th.BasicUser.Id, createdWiki.Id, model.NewId())
		require.NotNil(t, appErr)
		require.Nil(t, draft)
		require.Equal(t, "app.draft.get_page_draft.not_found", appErr.Id)
	})

	t.Run("fails with wrong user id", func(t *testing.T) {
		otherUser := th.CreateUser(t)
		draft, appErr := th.App.GetPageDraft(th.Context, otherUser.Id, createdWiki.Id, pageId)
		require.NotNil(t, appErr)
		require.Nil(t, draft)
		require.Equal(t, "app.draft.get_page_draft.not_found", appErr.Id)
	})

	t.Run("fails with wrong wiki id", func(t *testing.T) {
		draft, appErr := th.App.GetPageDraft(th.Context, th.BasicUser.Id, model.NewId(), pageId)
		require.NotNil(t, appErr)
		require.Nil(t, draft)
		require.Equal(t, "app.draft.get_page_draft.wiki_not_found.app_error", appErr.Id)
	})
}

func TestDeletePageDraft(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	wiki := &model.Wiki{
		ChannelId: th.BasicChannel.Id,
		Title:     "Test Wiki",
	}
	createdWiki, err := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, err)

	t.Run("successfully deletes existing draft", func(t *testing.T) {
		pageId := model.NewId()
		validContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Draft to delete"}]}]}`
		_, appErr := th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, createdWiki.Id, pageId, validContent, "Draft to Delete", 0, nil)
		require.Nil(t, appErr)

		draft, appErr := th.App.GetPageDraft(th.Context, th.BasicUser.Id, createdWiki.Id, pageId)
		require.Nil(t, appErr)
		require.NotNil(t, draft)

		appErr = th.App.DeletePageDraft(th.Context, th.BasicUser.Id, createdWiki.Id, pageId)
		require.Nil(t, appErr)

		draft, appErr = th.App.GetPageDraft(th.Context, th.BasicUser.Id, createdWiki.Id, pageId)
		require.NotNil(t, appErr)
		require.Nil(t, draft)
	})

	t.Run("fails when deleting non-existent draft", func(t *testing.T) {
		appErr := th.App.DeletePageDraft(th.Context, th.BasicUser.Id, createdWiki.Id, model.NewId())
		require.NotNil(t, appErr)
		require.Equal(t, "app.draft.delete_page.app_error", appErr.Id)
	})

	t.Run("fails with wrong user id", func(t *testing.T) {
		pageId := model.NewId()
		validContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Draft content"}]}]}`
		_, appErr := th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, createdWiki.Id, pageId, validContent, "Test Draft", 0, nil)
		require.Nil(t, appErr)

		otherUser := th.CreateUser(t)
		appErr = th.App.DeletePageDraft(th.Context, otherUser.Id, createdWiki.Id, pageId)
		require.NotNil(t, appErr)

		draft, appErr := th.App.GetPageDraft(th.Context, th.BasicUser.Id, createdWiki.Id, pageId)
		require.Nil(t, appErr)
		require.NotNil(t, draft)
	})
}

func TestGetPageDraftsForWiki(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	t.Run("successfully retrieves all drafts for wiki", func(t *testing.T) {
		wiki1 := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Test Wiki 1",
		}
		createdWiki1, err := th.App.CreateWiki(th.Context, wiki1, th.BasicUser.Id)
		require.Nil(t, err)

		pageId1 := model.NewId()
		validContent1 := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Draft 1"}]}]}`
		_, appErr := th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, createdWiki1.Id, pageId1, validContent1, "Draft 1", 0, nil)
		require.Nil(t, appErr)

		pageId2 := model.NewId()
		validContent2 := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Draft 2"}]}]}`
		_, appErr = th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, createdWiki1.Id, pageId2, validContent2, "Draft 2", 0, nil)
		require.Nil(t, appErr)

		pageId3 := model.NewId()
		validContent3 := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Draft 3"}]}]}`
		_, appErr = th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, createdWiki1.Id, pageId3, validContent3, "Draft 3", 0, nil)
		require.Nil(t, appErr)

		drafts, appErr := th.App.GetPageDraftsForWiki(th.Context, th.BasicUser.Id, createdWiki1.Id, 0, 200)
		require.Nil(t, appErr)
		require.NotNil(t, drafts)
		require.Len(t, drafts, 4)

		pageIds := make(map[string]bool)
		foundUntitledDefault := false
		for _, draft := range drafts {
			require.Equal(t, th.BasicUser.Id, draft.UserId)
			require.Equal(t, createdWiki1.Id, draft.WikiId)
			pageIds[draft.PageId] = true
			if draft.Title == "Untitled page" {
				foundUntitledDefault = true
			}
		}

		require.True(t, pageIds[pageId1], "Should contain pageId1")
		require.True(t, pageIds[pageId2], "Should contain pageId2")
		require.True(t, pageIds[pageId3], "Should contain pageId3")
		require.True(t, foundUntitledDefault, "Should contain default 'Untitled page' draft created with wiki")
	})

	t.Run("returns only default draft for new wiki", func(t *testing.T) {
		emptyWiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Empty Wiki",
		}
		createdEmptyWiki, err := th.App.CreateWiki(th.Context, emptyWiki, th.BasicUser.Id)
		require.Nil(t, err)

		drafts, appErr := th.App.GetPageDraftsForWiki(th.Context, th.BasicUser.Id, createdEmptyWiki.Id, 0, 200)
		require.Nil(t, appErr)
		require.NotNil(t, drafts)
		require.Len(t, drafts, 1)
		require.Equal(t, "Untitled page", drafts[0].Title)
	})

	t.Run("only returns drafts for specified user", func(t *testing.T) {
		wiki3 := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Test Wiki 3",
		}
		createdWiki3, err := th.App.CreateWiki(th.Context, wiki3, th.BasicUser.Id)
		require.Nil(t, err)

		otherUser := th.CreateUser(t)
		th.LinkUserToTeam(t, otherUser, th.BasicTeam)
		th.AddUserToChannel(t, otherUser, th.BasicChannel)

		otherPageId := model.NewId()
		validContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Other user draft"}]}]}`
		_, appErr := th.App.SavePageDraftWithMetadata(th.Context, otherUser.Id, createdWiki3.Id, otherPageId, validContent, "Other Draft", 0, nil)
		require.Nil(t, appErr)

		basicUserDrafts, appErr := th.App.GetPageDraftsForWiki(th.Context, th.BasicUser.Id, createdWiki3.Id, 0, 200)
		require.Nil(t, appErr)

		for _, draft := range basicUserDrafts {
			require.Equal(t, th.BasicUser.Id, draft.UserId)
			require.NotEqual(t, otherPageId, draft.PageId)
		}

		otherUserDrafts, appErr := th.App.GetPageDraftsForWiki(th.Context, otherUser.Id, createdWiki3.Id, 0, 200)
		require.Nil(t, appErr)
		require.Len(t, otherUserDrafts, 1)
		require.Equal(t, otherPageId, otherUserDrafts[0].PageId)
	})

	t.Run("fails with non-existent wiki", func(t *testing.T) {
		drafts, appErr := th.App.GetPageDraftsForWiki(th.Context, th.BasicUser.Id, model.NewId(), 0, 200)
		require.NotNil(t, appErr)
		require.Nil(t, drafts)
		require.Equal(t, "app.draft.get_wiki_drafts.wiki_not_found.app_error", appErr.Id)
	})

	t.Run("fails when channel is archived", func(t *testing.T) {
		archivedChannel, chanErr := th.App.CreateChannel(th.Context, &model.Channel{
			TeamId:      th.BasicTeam.Id,
			Name:        "archived-channel-2",
			DisplayName: "Archived Channel 2",
			Type:        model.ChannelTypeOpen,
		}, false)
		require.Nil(t, chanErr)

		archivedWiki := &model.Wiki{
			ChannelId: archivedChannel.Id,
			Title:     "Archived Wiki 2",
		}
		createdArchivedWiki, err := th.App.CreateWiki(th.Context, archivedWiki, th.BasicUser.Id)
		require.Nil(t, err)

		pageId := model.NewId()
		validContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Draft in archived channel"}]}]}`
		_, appErr := th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, createdArchivedWiki.Id, pageId, validContent, "Archived Draft", 0, nil)
		require.Nil(t, appErr)

		err = th.App.DeleteChannel(th.Context, archivedChannel, th.BasicUser.Id)
		require.Nil(t, err)

		drafts, appErr := th.App.GetPageDraftsForWiki(th.Context, th.BasicUser.Id, createdArchivedWiki.Id, 0, 200)
		require.NotNil(t, appErr)
		require.Nil(t, drafts)
		require.Equal(t, "app.draft.get_wiki_drafts.deleted_channel.app_error", appErr.Id)
	})
}

func TestCheckPageDraftExists(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	wiki := &model.Wiki{
		ChannelId: th.BasicChannel.Id,
		Title:     "Test Wiki",
	}
	createdWiki, err := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, err)

	t.Run("returns true for existing draft", func(t *testing.T) {
		pageId := model.NewId()
		validContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Draft content"}]}]}`
		draft, appErr := th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, createdWiki.Id, pageId, validContent, "Test Draft", 0, nil)
		require.Nil(t, appErr)
		require.NotNil(t, draft)

		exists, updateAt, appErr := th.App.CheckPageDraftExists(pageId, th.BasicUser.Id)
		require.Nil(t, appErr)
		require.True(t, exists)
		require.Greater(t, updateAt, int64(0))
	})

	t.Run("returns false for non-existent draft", func(t *testing.T) {
		nonExistentPageId := model.NewId()
		exists, updateAt, appErr := th.App.CheckPageDraftExists(nonExistentPageId, th.BasicUser.Id)
		require.Nil(t, appErr)
		require.False(t, exists)
		require.Equal(t, int64(0), updateAt)
	})

	t.Run("returns false for different user", func(t *testing.T) {
		pageId := model.NewId()
		validContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Draft content"}]}]}`
		draft, appErr := th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, createdWiki.Id, pageId, validContent, "Test Draft", 0, nil)
		require.Nil(t, appErr)
		require.NotNil(t, draft)

		otherUser := th.CreateUser(t)
		exists, _, appErr := th.App.CheckPageDraftExists(pageId, otherUser.Id)
		require.Nil(t, appErr)
		require.False(t, exists)
	})
}

func TestUpsertPageDraft(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	rctx := th.CreateSessionContext()

	wiki := &model.Wiki{
		ChannelId: th.BasicChannel.Id,
		Title:     "Test Wiki",
	}
	createdWiki, err := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, err)

	t.Run("creates new draft", func(t *testing.T) {
		pageId := model.NewId()
		content := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Draft content"}]}]}`

		draft, appErr := th.App.UpsertPageDraft(rctx, th.BasicUser.Id, createdWiki.Id, pageId, content, "New Draft", 0, nil)
		require.Nil(t, appErr)
		require.NotNil(t, draft)
		require.Equal(t, "New Draft", draft.Title)
		require.Equal(t, pageId, draft.PageId)
	})

	t.Run("updates existing draft", func(t *testing.T) {
		pageId := model.NewId()
		content := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Initial"}]}]}`

		draft, appErr := th.App.UpsertPageDraft(rctx, th.BasicUser.Id, createdWiki.Id, pageId, content, "Initial Title", 0, nil)
		require.Nil(t, appErr)

		updateAt := draft.UpdateAt
		updatedContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Updated"}]}]}`

		updatedDraft, appErr := th.App.UpsertPageDraft(rctx, th.BasicUser.Id, createdWiki.Id, pageId, updatedContent, "Updated Title", updateAt, nil)
		require.Nil(t, appErr)
		require.NotNil(t, updatedDraft)
		require.Equal(t, "Updated Title", updatedDraft.Title)
	})

	t.Run("stores parent page ID in props", func(t *testing.T) {
		parentPage, appErr := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Parent", "", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		pageId := model.NewId()
		content := `{"type":"doc","content":[]}`
		props := map[string]any{model.DraftPropsPageParentID: parentPage.Id}

		draft, appErr := th.App.UpsertPageDraft(rctx, th.BasicUser.Id, createdWiki.Id, pageId, content, "Child Draft", 0, props)
		require.Nil(t, appErr)
		require.NotNil(t, draft)
		require.Equal(t, parentPage.Id, draft.Props[model.DraftPropsPageParentID])
	})
}

func TestMovePageDraft(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	rctx := th.CreateSessionContext()

	wiki := &model.Wiki{
		ChannelId: th.BasicChannel.Id,
		Title:     "Test Wiki",
	}
	createdWiki, err := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, err)

	t.Run("moves draft to new parent", func(t *testing.T) {
		parentPage, appErr := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Parent", "", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		pageId := model.NewId()
		content := `{"type":"doc","content":[]}`
		_, appErr = th.App.UpsertPageDraft(rctx, th.BasicUser.Id, createdWiki.Id, pageId, content, "Draft to Move", 0, nil)
		require.Nil(t, appErr)

		appErr = th.App.MovePageDraft(rctx, th.BasicUser.Id, createdWiki.Id, pageId, parentPage.Id)
		require.Nil(t, appErr)

		// Verify the draft was updated
		draft, appErr := th.App.GetPageDraft(rctx, th.BasicUser.Id, createdWiki.Id, pageId)
		require.Nil(t, appErr)
		require.Equal(t, parentPage.Id, draft.Props[model.DraftPropsPageParentID])
	})

	t.Run("moves draft to root", func(t *testing.T) {
		parentPage, appErr := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Parent", "", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		pageId := model.NewId()
		content := `{"type":"doc","content":[]}`
		props := map[string]any{model.DraftPropsPageParentID: parentPage.Id}
		_, appErr = th.App.UpsertPageDraft(rctx, th.BasicUser.Id, createdWiki.Id, pageId, content, "Draft with Parent", 0, props)
		require.Nil(t, appErr)

		appErr = th.App.MovePageDraft(rctx, th.BasicUser.Id, createdWiki.Id, pageId, "")
		require.Nil(t, appErr)

		// Verify the draft was moved to root
		draft, appErr := th.App.GetPageDraft(rctx, th.BasicUser.Id, createdWiki.Id, pageId)
		require.Nil(t, appErr)
		require.Empty(t, draft.Props[model.DraftPropsPageParentID])
	})

	t.Run("fails for non-existent draft", func(t *testing.T) {
		appErr := th.App.MovePageDraft(rctx, th.BasicUser.Id, createdWiki.Id, model.NewId(), "")
		require.NotNil(t, appErr)
	})
}
