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
	setupPagePermissions(th)

	wiki := &model.Wiki{
		ChannelId: th.BasicChannel.Id,
		Title:     "Test Wiki",
	}
	createdWiki, err := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, err)

	t.Run("successfully saves new page draft", func(t *testing.T) {
		validContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Draft content"}]}]}`
		draft, appErr := th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, createdWiki.Id, "draft-1", validContent, "Test Draft", "", nil)
		require.Nil(t, appErr)
		require.NotNil(t, draft)
		require.Equal(t, th.BasicUser.Id, draft.UserId)
		require.Equal(t, createdWiki.Id, draft.WikiId)
		require.Equal(t, "draft-1", draft.DraftId)
		require.Equal(t, "Test Draft", draft.Title)

		jsonContent, jsonErr := draft.GetDocumentJSON()
		require.NoError(t, jsonErr)
		require.JSONEq(t, validContent, jsonContent)
	})

	t.Run("successfully updates existing page draft", func(t *testing.T) {
		initialContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Initial"}]}]}`
		_, appErr := th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, createdWiki.Id, "draft-2", initialContent, "Initial Title", "", nil)
		require.Nil(t, appErr)

		updatedContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Updated"}]}]}`
		updatedDraft, appErr := th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, createdWiki.Id, "draft-2", updatedContent, "Updated Title", "", nil)
		require.Nil(t, appErr)
		require.NotNil(t, updatedDraft)
		require.Equal(t, "Updated Title", updatedDraft.Title)

		jsonContent, jsonErr := updatedDraft.GetDocumentJSON()
		require.NoError(t, jsonErr)
		require.JSONEq(t, updatedContent, jsonContent)
	})

	t.Run("successfully saves draft with page_id in props", func(t *testing.T) {
		page, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Test Page", "", "", th.BasicUser.Id, "")
		require.Nil(t, err)

		validContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Draft content"}]}]}`
		draft, appErr := th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, createdWiki.Id, "draft-3", validContent, "Draft Title", page.Id, nil)
		require.Nil(t, appErr)
		require.NotNil(t, draft)
		require.NotNil(t, draft.Props)
		require.Equal(t, page.Id, draft.Props["page_id"])
	})

	t.Run("successfully saves draft with custom props", func(t *testing.T) {
		validContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Draft content"}]}]}`
		customProps := map[string]any{
			"custom_field":  "custom_value",
			"another_field": 123,
		}
		draft, appErr := th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, createdWiki.Id, "draft-4", validContent, "Draft Title", "", customProps)
		require.Nil(t, appErr)
		require.NotNil(t, draft)
		require.NotNil(t, draft.Props)
		require.Equal(t, "custom_value", draft.Props["custom_field"])
		require.Equal(t, 123, draft.Props["another_field"])
	})

	t.Run("fails with invalid JSON content", func(t *testing.T) {
		invalidContent := `{"invalid json`
		draft, appErr := th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, createdWiki.Id, "draft-5", invalidContent, "Test Draft", "", nil)
		require.NotNil(t, appErr)
		require.Nil(t, draft)
		require.Equal(t, "app.draft.save_page.invalid_content.app_error", appErr.Id)
	})

	t.Run("fails with non-existent wiki", func(t *testing.T) {
		validContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Draft content"}]}]}`
		draft, appErr := th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, model.NewId(), "draft-6", validContent, "Test Draft", "", nil)
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

		validContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Draft content"}]}]}`
		draft, appErr := th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, createdArchivedWiki.Id, "draft-7", validContent, "Test Draft", "", nil)
		require.NotNil(t, appErr)
		require.Nil(t, draft)
		require.Equal(t, "app.draft.save_page.deleted_channel.app_error", appErr.Id)
	})
}

func TestGetPageDraft(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	setupPagePermissions(th)

	wiki := &model.Wiki{
		ChannelId: th.BasicChannel.Id,
		Title:     "Test Wiki",
	}
	createdWiki, err := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, err)

	validContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Draft content"}]}]}`
	createdDraft, appErr := th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, createdWiki.Id, "draft-1", validContent, "Test Draft", "", nil)
	require.Nil(t, appErr)

	t.Run("successfully retrieves existing draft", func(t *testing.T) {
		draft, appErr := th.App.GetPageDraft(th.Context, th.BasicUser.Id, createdWiki.Id, "draft-1")
		require.Nil(t, appErr)
		require.NotNil(t, draft)
		require.Equal(t, createdDraft.UserId, draft.UserId)
		require.Equal(t, createdDraft.WikiId, draft.WikiId)
		require.Equal(t, createdDraft.DraftId, draft.DraftId)
		require.Equal(t, "Test Draft", draft.Title)

		jsonContent, jsonErr := draft.GetDocumentJSON()
		require.NoError(t, jsonErr)
		require.JSONEq(t, validContent, jsonContent)
	})

	t.Run("fails with non-existent draft", func(t *testing.T) {
		draft, appErr := th.App.GetPageDraft(th.Context, th.BasicUser.Id, createdWiki.Id, "non-existent-draft")
		require.NotNil(t, appErr)
		require.Nil(t, draft)
		require.Equal(t, "app.draft.get_page_draft.not_found", appErr.Id)
	})

	t.Run("fails with wrong user id", func(t *testing.T) {
		otherUser := th.CreateUser(t)
		draft, appErr := th.App.GetPageDraft(th.Context, otherUser.Id, createdWiki.Id, "draft-1")
		require.NotNil(t, appErr)
		require.Nil(t, draft)
		require.Equal(t, "app.draft.get_page_draft.not_found", appErr.Id)
	})

	t.Run("fails with wrong wiki id", func(t *testing.T) {
		draft, appErr := th.App.GetPageDraft(th.Context, th.BasicUser.Id, model.NewId(), "draft-1")
		require.NotNil(t, appErr)
		require.Nil(t, draft)
		require.Equal(t, "app.draft.get_page_draft.wiki_not_found.app_error", appErr.Id)
	})
}

func TestDeletePageDraft(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	setupPagePermissions(th)

	wiki := &model.Wiki{
		ChannelId: th.BasicChannel.Id,
		Title:     "Test Wiki",
	}
	createdWiki, err := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, err)

	t.Run("successfully deletes existing draft", func(t *testing.T) {
		validContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Draft to delete"}]}]}`
		_, appErr := th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, createdWiki.Id, "draft-1", validContent, "Draft to Delete", "", nil)
		require.Nil(t, appErr)

		draft, appErr := th.App.GetPageDraft(th.Context, th.BasicUser.Id, createdWiki.Id, "draft-1")
		require.Nil(t, appErr)
		require.NotNil(t, draft)

		appErr = th.App.DeletePageDraft(th.Context, th.BasicUser.Id, createdWiki.Id, "draft-1")
		require.Nil(t, appErr)

		draft, appErr = th.App.GetPageDraft(th.Context, th.BasicUser.Id, createdWiki.Id, "draft-1")
		require.NotNil(t, appErr)
		require.Nil(t, draft)
	})

	t.Run("fails when deleting non-existent draft", func(t *testing.T) {
		appErr := th.App.DeletePageDraft(th.Context, th.BasicUser.Id, createdWiki.Id, "non-existent-draft")
		require.NotNil(t, appErr)
		require.Equal(t, "app.draft.delete_page.app_error", appErr.Id)
	})

	t.Run("fails with wrong user id", func(t *testing.T) {
		validContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Draft content"}]}]}`
		_, appErr := th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, createdWiki.Id, "draft-2", validContent, "Test Draft", "", nil)
		require.Nil(t, appErr)

		otherUser := th.CreateUser(t)
		appErr = th.App.DeletePageDraft(th.Context, otherUser.Id, createdWiki.Id, "draft-2")
		require.NotNil(t, appErr)

		draft, appErr := th.App.GetPageDraft(th.Context, th.BasicUser.Id, createdWiki.Id, "draft-2")
		require.Nil(t, appErr)
		require.NotNil(t, draft)
	})
}

func TestGetPageDraftsForWiki(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	setupPagePermissions(th)

	t.Run("successfully retrieves all drafts for wiki", func(t *testing.T) {
		wiki1 := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Test Wiki 1",
		}
		createdWiki1, err := th.App.CreateWiki(th.Context, wiki1, th.BasicUser.Id)
		require.Nil(t, err)

		validContent1 := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Draft 1"}]}]}`
		_, appErr := th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, createdWiki1.Id, "wiki1-draft-1", validContent1, "Draft 1", "", nil)
		require.Nil(t, appErr)

		validContent2 := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Draft 2"}]}]}`
		_, appErr = th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, createdWiki1.Id, "wiki1-draft-2", validContent2, "Draft 2", "", nil)
		require.Nil(t, appErr)

		validContent3 := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Draft 3"}]}]}`
		_, appErr = th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, createdWiki1.Id, "wiki1-draft-3", validContent3, "Draft 3", "", nil)
		require.Nil(t, appErr)

		drafts, appErr := th.App.GetPageDraftsForWiki(th.Context, th.BasicUser.Id, createdWiki1.Id)
		require.Nil(t, appErr)
		require.NotNil(t, drafts)
		require.Len(t, drafts, 4)

		draftIds := make(map[string]bool)
		foundUntitledDefault := false
		for _, draft := range drafts {
			require.Equal(t, th.BasicUser.Id, draft.UserId)
			require.Equal(t, createdWiki1.Id, draft.WikiId)
			draftIds[draft.DraftId] = true
			if draft.Title == "Untitled page" {
				foundUntitledDefault = true
			}
		}

		require.True(t, draftIds["wiki1-draft-1"], "Should contain wiki1-draft-1")
		require.True(t, draftIds["wiki1-draft-2"], "Should contain wiki1-draft-2")
		require.True(t, draftIds["wiki1-draft-3"], "Should contain wiki1-draft-3")
		require.True(t, foundUntitledDefault, "Should contain default 'Untitled page' draft created with wiki")
	})

	t.Run("returns only default draft for new wiki", func(t *testing.T) {
		emptyWiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Empty Wiki",
		}
		createdEmptyWiki, err := th.App.CreateWiki(th.Context, emptyWiki, th.BasicUser.Id)
		require.Nil(t, err)

		drafts, appErr := th.App.GetPageDraftsForWiki(th.Context, th.BasicUser.Id, createdEmptyWiki.Id)
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

		validContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Other user draft"}]}]}`
		_, appErr := th.App.SavePageDraftWithMetadata(th.Context, otherUser.Id, createdWiki3.Id, "other-draft", validContent, "Other Draft", "", nil)
		require.Nil(t, appErr)

		basicUserDrafts, appErr := th.App.GetPageDraftsForWiki(th.Context, th.BasicUser.Id, createdWiki3.Id)
		require.Nil(t, appErr)

		for _, draft := range basicUserDrafts {
			require.Equal(t, th.BasicUser.Id, draft.UserId)
			require.NotEqual(t, "other-draft", draft.DraftId)
		}

		otherUserDrafts, appErr := th.App.GetPageDraftsForWiki(th.Context, otherUser.Id, createdWiki3.Id)
		require.Nil(t, appErr)
		require.Len(t, otherUserDrafts, 1)
		require.Equal(t, "other-draft", otherUserDrafts[0].DraftId)
	})

	t.Run("fails with non-existent wiki", func(t *testing.T) {
		drafts, appErr := th.App.GetPageDraftsForWiki(th.Context, th.BasicUser.Id, model.NewId())
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

		validContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Draft in archived channel"}]}]}`
		_, appErr := th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, createdArchivedWiki.Id, "archived-draft", validContent, "Archived Draft", "", nil)
		require.Nil(t, appErr)

		err = th.App.DeleteChannel(th.Context, archivedChannel, th.BasicUser.Id)
		require.Nil(t, err)

		drafts, appErr := th.App.GetPageDraftsForWiki(th.Context, th.BasicUser.Id, createdArchivedWiki.Id)
		require.NotNil(t, appErr)
		require.Nil(t, drafts)
		require.Equal(t, "app.draft.get_wiki_drafts.deleted_channel.app_error", appErr.Id)
	})
}
