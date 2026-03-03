// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/utils/testutils"
)

func TestGetDraft(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.Server.platform.SetConfigReadOnlyFF(false)
	defer th.Server.platform.SetConfigReadOnlyFF(true)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = true })

	user := th.BasicUser
	channel := th.BasicChannel

	draft := &model.Draft{
		CreateAt:  00001,
		UpdateAt:  00001,
		UserId:    user.Id,
		ChannelId: channel.Id,
		Message:   "draft",
	}

	_, upsertDraftErr := th.App.UpsertDraft(th.Context, draft, "")
	assert.Nil(t, upsertDraftErr)

	t.Run("get draft", func(t *testing.T) {
		draftResp, err := th.App.GetDraft(user.Id, channel.Id, "")
		assert.Nil(t, err)

		assert.Equal(t, draft.Message, draftResp.Message)
		assert.Equal(t, draft.ChannelId, draftResp.ChannelId)
	})

	t.Run("get draft feature flag", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = false })
		defer th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = true })

		_, err := th.App.GetDraft(user.Id, channel.Id, "")
		assert.NotNil(t, err)
	})
}

func TestUpsertDraft(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.Server.platform.SetConfigReadOnlyFF(false)
	defer th.Server.platform.SetConfigReadOnlyFF(true)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = true })

	user := th.BasicUser
	channel := th.BasicChannel

	draft := &model.Draft{
		UserId:    user.Id,
		ChannelId: channel.Id,
		Message:   "draft",
	}

	t.Run("upsert draft", func(t *testing.T) {
		_, err := th.App.UpsertDraft(th.Context, draft, "")
		assert.Nil(t, err)

		drafts, err := th.App.GetDraftsForUser(th.Context, user.Id, th.BasicTeam.Id)
		assert.Nil(t, err)
		assert.Len(t, drafts, 1)
		draft1 := drafts[0]

		assert.Equal(t, "draft", draft1.Message)
		assert.Equal(t, channel.Id, draft1.ChannelId)
		assert.Greater(t, draft1.CreateAt, int64(0))

		draft = &model.Draft{
			UserId:    user.Id,
			ChannelId: channel.Id,
			Message:   "updated draft",
		}
		_, err = th.App.UpsertDraft(th.Context, draft, "")
		assert.Nil(t, err)

		drafts, err = th.App.GetDraftsForUser(th.Context, user.Id, th.BasicTeam.Id)
		assert.Nil(t, err)
		assert.Len(t, drafts, 1)
		draft2 := drafts[0]

		assert.Equal(t, "updated draft", draft2.Message)
		assert.Equal(t, channel.Id, draft2.ChannelId)
		assert.Equal(t, draft1.CreateAt, draft2.CreateAt)
	})

	t.Run("upsert draft feature flag", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = false })
		defer th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = true })

		_, err := th.App.UpsertDraft(th.Context, draft, "")
		assert.NotNil(t, err)
	})
}

func TestCreateDraft(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.Server.platform.SetConfigReadOnlyFF(false)
	defer th.Server.platform.SetConfigReadOnlyFF(true)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = true })

	user := th.BasicUser
	channel := th.BasicChannel
	channel2 := th.CreateChannel(t, th.BasicTeam)
	th.AddUserToChannel(t, user, channel2)

	draft1 := &model.Draft{
		CreateAt:  00001,
		UpdateAt:  00001,
		UserId:    user.Id,
		ChannelId: channel.Id,
		Message:   "draft",
	}

	draft2 := &model.Draft{
		CreateAt:  00001,
		UpdateAt:  00001,
		UserId:    user.Id,
		ChannelId: channel2.Id,
		Message:   "draft2",
	}

	t.Run("create draft", func(t *testing.T) {
		draftResp, err := th.App.UpsertDraft(th.Context, draft1, "")
		assert.Nil(t, err)

		assert.Equal(t, draft1.Message, draftResp.Message)
		assert.Equal(t, draft1.ChannelId, draftResp.ChannelId)
	})

	t.Run("create draft with files", func(t *testing.T) {
		// upload file
		sent, readFileErr := testutils.ReadTestFile("test.png")
		require.NoError(t, readFileErr)

		fileResp, uploadFileErr := th.App.UploadFile(th.Context, sent, channel.Id, "test.png")
		assert.Nil(t, uploadFileErr)

		draftWithFiles := draft2
		draftWithFiles.FileIds = []string{fileResp.Id}

		draftResp, err := th.App.UpsertDraft(th.Context, draftWithFiles, "")
		assert.Nil(t, err)

		assert.Equal(t, draftWithFiles.Message, draftResp.Message)
		assert.Equal(t, draftWithFiles.ChannelId, draftResp.ChannelId)
		assert.ElementsMatch(t, draftWithFiles.FileIds, draftResp.FileIds)
	})
}

func TestUpdateDraft(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.Server.platform.SetConfigReadOnlyFF(false)
	defer th.Server.platform.SetConfigReadOnlyFF(true)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = true })

	user := th.BasicUser
	channel := th.BasicChannel

	draft1 := &model.Draft{
		UserId:    user.Id,
		ChannelId: channel.Id,
		Message:   "draft1",
	}

	_, createDraftErr := th.App.UpsertDraft(th.Context, draft1, "")
	assert.Nil(t, createDraftErr)

	t.Run("update draft with files", func(t *testing.T) {
		// upload file
		sent, readFileErr := testutils.ReadTestFile("test.png")
		require.NoError(t, readFileErr)

		fileResp, uploadFileErr := th.App.UploadFile(th.Context, sent, channel.Id, "test.png")
		assert.Nil(t, uploadFileErr)

		draftWithFiles := draft1
		draftWithFiles.FileIds = []string{fileResp.Id}

		_, err := th.App.UpsertDraft(th.Context, draft1, "")
		assert.Nil(t, err)

		drafts, err := th.App.GetDraftsForUser(th.Context, user.Id, th.BasicTeam.Id)
		assert.Nil(t, err)

		draftResp := drafts[0]
		assert.Equal(t, draftWithFiles.Message, draftResp.Message)
		assert.Equal(t, draftWithFiles.ChannelId, draftResp.ChannelId)
		assert.ElementsMatch(t, draftWithFiles.FileIds, draftResp.FileIds)
	})

	t.Run("cannot upsert draft in restricted DM", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.TeamSettings.RestrictDirectMessage = model.DirectMessageTeam
		})

		// Create a DM channel between two users who don't share a team
		dmChannel := th.CreateDmChannel(t, th.BasicUser2)

		// Ensure the two users do not share a team
		teams, err := th.App.GetTeamsForUser(th.BasicUser.Id)
		require.Nil(t, err)
		for _, team := range teams {
			teamErr := th.App.RemoveUserFromTeam(th.Context, team.Id, th.BasicUser.Id, th.SystemAdminUser.Id)
			require.Nil(t, teamErr)
		}
		teams, err = th.App.GetTeamsForUser(th.BasicUser2.Id)
		require.Nil(t, err)
		for _, team := range teams {
			teamErr := th.App.RemoveUserFromTeam(th.Context, team.Id, th.BasicUser2.Id, th.SystemAdminUser.Id)
			require.Nil(t, teamErr)
		}

		// Create separate teams for each user
		team1 := th.CreateTeam(t)
		team2 := th.CreateTeam(t)
		th.LinkUserToTeam(t, th.BasicUser, team1)
		th.LinkUserToTeam(t, th.BasicUser2, team2)

		draft := &model.Draft{
			CreateAt:  00001,
			UpdateAt:  00001,
			UserId:    th.BasicUser.Id,
			ChannelId: dmChannel.Id,
			Message:   "draft message",
		}

		_, err = th.App.UpsertDraft(th.Context, draft, "")
		require.NotNil(t, err)
		require.Equal(t, "api.draft.create_draft.can_not_draft_to_restricted_dm.error", err.Id)
		require.Equal(t, http.StatusBadRequest, err.StatusCode)

		// Reset config
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.TeamSettings.RestrictDirectMessage = model.DirectMessageAny
		})
	})
}

func TestGetDraftsForUser(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.Server.platform.SetConfigReadOnlyFF(false)
	defer th.Server.platform.SetConfigReadOnlyFF(true)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = true })

	user := th.BasicUser
	channel := th.BasicChannel
	channel2 := th.CreateChannel(t, th.BasicTeam)
	th.AddUserToChannel(t, user, channel2)

	draft1 := &model.Draft{
		CreateAt:  00001,
		UserId:    user.Id,
		ChannelId: channel.Id,
		Message:   "draft1",
	}

	draft2 := &model.Draft{
		CreateAt:  00005,
		UserId:    user.Id,
		ChannelId: channel2.Id,
		Message:   "draft2",
	}

	_, createDraftErr1 := th.App.UpsertDraft(th.Context, draft1, "")
	assert.Nil(t, createDraftErr1)

	// Wait a bit so the second draft gets a newer UpdateAt
	time.Sleep(100 * time.Millisecond)

	_, createDraftErr2 := th.App.UpsertDraft(th.Context, draft2, "")
	assert.Nil(t, createDraftErr2)

	t.Run("get drafts", func(t *testing.T) {
		draftResp, err := th.App.GetDraftsForUser(th.Context, user.Id, th.BasicTeam.Id)
		assert.Nil(t, err)

		assert.Equal(t, draft2.Message, draftResp[0].Message)
		assert.Equal(t, draft2.ChannelId, draftResp[0].ChannelId)

		assert.Equal(t, draft1.Message, draftResp[1].Message)
		assert.Equal(t, draft1.ChannelId, draftResp[1].ChannelId)
	})

	t.Run("get drafts with files", func(t *testing.T) {
		// upload file
		sent, readFileErr := testutils.ReadTestFile("test.png")
		require.NoError(t, readFileErr)

		fileResp, updateDraftErr := th.App.UploadFileForUserAndTeam(th.Context, sent, channel.Id, "test.png", user.Id, "")
		assert.Nil(t, updateDraftErr)

		draftWithFiles := draft1
		draftWithFiles.FileIds = []string{fileResp.Id}

		draftResp, updateDraftErr := th.App.UpsertDraft(th.Context, draft1, "")
		assert.Nil(t, updateDraftErr)

		assert.Equal(t, draftWithFiles.Message, draftResp.Message)
		assert.Equal(t, draftWithFiles.ChannelId, draftResp.ChannelId)
		assert.ElementsMatch(t, draftWithFiles.FileIds, draftResp.FileIds)

		draftsWithFilesResp, err := th.App.GetDraftsForUser(th.Context, user.Id, th.BasicTeam.Id)
		assert.Nil(t, err)

		assert.Equal(t, draftWithFiles.Message, draftsWithFilesResp[0].Message)
		assert.Equal(t, draftWithFiles.ChannelId, draftsWithFilesResp[0].ChannelId)
		assert.ElementsMatch(t, draftWithFiles.FileIds, draftsWithFilesResp[0].FileIds)

		assert.Len(t, draftsWithFilesResp[0].Metadata.Files, 1)
		assert.Equal(t, fileResp.Name, draftsWithFilesResp[0].Metadata.Files[0].Name)

		assert.Len(t, draftsWithFilesResp, 2)
	})

	t.Run("get draft with invalid files", func(t *testing.T) {
		// upload file
		sent, readFileErr := testutils.ReadTestFile("test.png")
		require.NoError(t, readFileErr)

		fileResp1, updateDraftErr := th.App.UploadFileForUserAndTeam(th.Context, sent, channel.Id, "test1.png", user.Id, "")
		assert.Nil(t, updateDraftErr)

		fileResp2, updateDraftErr := th.App.UploadFileForUserAndTeam(th.Context, sent, channel.Id, "test2.png", th.BasicUser2.Id, "")
		assert.Nil(t, updateDraftErr)

		draftWithFiles := draft1
		draftWithFiles.FileIds = []string{fileResp1.Id, fileResp2.Id}

		draftResp, updateDraftErr := th.App.UpsertDraft(th.Context, draft1, "")
		assert.Nil(t, updateDraftErr)

		assert.Equal(t, draftWithFiles.Message, draftResp.Message)
		assert.Equal(t, draftWithFiles.ChannelId, draftResp.ChannelId)
		assert.ElementsMatch(t, draftWithFiles.FileIds, draftResp.FileIds)

		assert.Len(t, draftWithFiles.Metadata.Files, 1)
		assert.Equal(t, fileResp1.Name, draftWithFiles.Metadata.Files[0].Name)

		draftsWithFilesResp, err := th.App.GetDraftsForUser(th.Context, user.Id, th.BasicTeam.Id)
		assert.Nil(t, err)

		assert.Equal(t, draftWithFiles.Message, draftsWithFilesResp[0].Message)
		assert.Equal(t, draftWithFiles.ChannelId, draftsWithFilesResp[0].ChannelId)
		assert.ElementsMatch(t, draftWithFiles.FileIds, draftsWithFilesResp[0].FileIds)

		assert.Len(t, draftsWithFilesResp[0].Metadata.Files, 1)
		assert.Equal(t, fileResp1.Name, draftsWithFilesResp[0].Metadata.Files[0].Name)
	})

	t.Run("get drafts feature flag", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = false })
		defer th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = true })

		_, err := th.App.GetDraftsForUser(th.Context, user.Id, th.BasicTeam.Id)
		assert.NotNil(t, err)
	})
}

func TestDeleteDraft(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.Server.platform.SetConfigReadOnlyFF(false)
	defer th.Server.platform.SetConfigReadOnlyFF(true)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = true })

	user := th.BasicUser
	channel := th.BasicChannel

	draft1 := &model.Draft{
		CreateAt:  00001,
		UpdateAt:  00001,
		UserId:    user.Id,
		ChannelId: channel.Id,
		Message:   "draft1",
	}

	_, createDraftErr := th.App.UpsertDraft(th.Context, draft1, "")
	assert.Nil(t, createDraftErr)

	t.Run("delete draft", func(t *testing.T) {
		err := th.App.DeleteDraft(th.Context, draft1, "")
		assert.Nil(t, err)
	})

	t.Run("delete drafts feature flag", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = false })
		defer th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = true })

		err := th.App.DeleteDraft(th.Context, draft1, "")
		assert.NotNil(t, err)
	})
}

// Helper function to create TipTap JSON content
func createTipTapContent(text string) string {
	return `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"` + text + `"}]}]}`
}

func TestPublishPageDraft(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.Server.platform.SetConfigReadOnlyFF(false)
	defer th.Server.platform.SetConfigReadOnlyFF(true)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = true })

	th.SetupPagePermissions()
	th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
	th.Context.Session().UserId = th.BasicUser.Id

	user := th.BasicUser
	channel := th.BasicChannel

	wiki := &model.Wiki{
		ChannelId: channel.Id,
		Title:     "Test Wiki",
	}
	createdWiki, err := th.App.CreateWiki(th.Context, wiki, user.Id)
	require.Nil(t, err)

	t.Run("create new page from draft", func(t *testing.T) {
		pageId := model.NewId()
		title := "New Page"
		content := createTipTapContent("This is the content of the new page")

		_, err := th.App.SavePageDraftWithMetadata(th.Context, user.Id, createdWiki.Id, pageId, content, title, 0, nil)
		require.Nil(t, err)

		publishedPage, appErr := th.App.PublishPageDraft(th.Context, user.Id, model.PublishPageDraftOptions{
			WikiId: createdWiki.Id,
			PageId: pageId,
			Title:  title,
		})
		require.Nil(t, appErr)
		assert.NotNil(t, publishedPage)
		assert.JSONEq(t, content, publishedPage.Message)
		assert.Equal(t, title, publishedPage.Props["title"])
		assert.Equal(t, model.PostTypePage, publishedPage.Type)
		assert.Equal(t, channel.Id, publishedPage.ChannelId)

		_, getDraftErr := th.App.GetPageDraft(th.Context, user.Id, createdWiki.Id, pageId, false)
		assert.NotNil(t, getDraftErr)
	})

	t.Run("update existing page from draft", func(t *testing.T) {
		originalPage, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Original Title", "", user.Id, "", "")
		require.Nil(t, appErr)

		// With unified page ID model, use the page's ID as the draft ID
		pageId := originalPage.Id
		newTitle := "Updated Title"
		newContent := createTipTapContent("This is the updated content")

		_, err := th.App.SavePageDraftWithMetadata(th.Context, user.Id, createdWiki.Id, pageId, newContent, newTitle, originalPage.EditAt, nil)
		require.Nil(t, err)

		updatedPage, appErr := th.App.PublishPageDraft(th.Context, user.Id, model.PublishPageDraftOptions{
			WikiId:     createdWiki.Id,
			PageId:     pageId,
			Title:      newTitle,
			BaseEditAt: originalPage.EditAt,
		})
		require.Nil(t, appErr)
		assert.NotNil(t, updatedPage)
		assert.Equal(t, originalPage.Id, updatedPage.Id)
		assert.JSONEq(t, newContent, updatedPage.Message)
		assert.Equal(t, newTitle, updatedPage.Props["title"])

		retrievedPage, getErr := th.App.GetPageWithContent(th.Context, originalPage.Id)
		require.Nil(t, getErr)
		assert.JSONEq(t, newContent, retrievedPage.Message)
		assert.Equal(t, newTitle, retrievedPage.Props["title"])
	})

	t.Run("multiple autosaves update draft content", func(t *testing.T) {
		originalPage, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Autosave Test", "", user.Id, "", "")
		require.Nil(t, appErr)

		// With unified page ID model, use the page's ID as the draft ID
		pageId := originalPage.Id
		title := "Autosave Test"
		var finalContent string
		var lastUpdateAt int64 = originalPage.EditAt

		for i := 1; i <= 5; i++ {
			randomText := model.NewRandomString(50)
			finalContent = createTipTapContent(randomText)
			savedDraft, err := th.App.SavePageDraftWithMetadata(th.Context, user.Id, createdWiki.Id, pageId, finalContent, title, lastUpdateAt, nil)
			require.Nil(t, err)
			lastUpdateAt = savedDraft.UpdateAt

			retrievedDraft, getDraftErr := th.App.GetPageDraft(th.Context, user.Id, createdWiki.Id, pageId, false)
			require.Nil(t, getDraftErr)
			retrievedContent, _ := retrievedDraft.GetDocumentJSON()
			assert.JSONEq(t, finalContent, retrievedContent)
			assert.Equal(t, title, retrievedDraft.Title)
		}

		publishedPage, appErr := th.App.PublishPageDraft(th.Context, user.Id, model.PublishPageDraftOptions{
			WikiId:     createdWiki.Id,
			PageId:     pageId,
			Title:      title,
			BaseEditAt: originalPage.EditAt,
		})
		require.Nil(t, appErr)
		assert.Equal(t, originalPage.Id, publishedPage.Id)
		assert.JSONEq(t, finalContent, publishedPage.Message)
	})

	t.Run("publish non-existent draft fails", func(t *testing.T) {
		nonExistentPageId := model.NewId()

		_, appErr := th.App.PublishPageDraft(th.Context, user.Id, model.PublishPageDraftOptions{
			WikiId: createdWiki.Id,
			PageId: nonExistentPageId,
			Title:  "Title",
		})
		require.NotNil(t, appErr)
		assert.Equal(t, "app.draft.publish_page.not_found", appErr.Id)
	})

	t.Run("publish draft calls CreatePage directly without recursion", func(t *testing.T) {
		pageId := model.NewId()
		title := "Direct CreatePage Test"
		content := createTipTapContent("This test validates that PublishPageDraft calls CreatePage directly")

		_, err := th.App.SavePageDraftWithMetadata(th.Context, user.Id, createdWiki.Id, pageId, content, title, 0, nil)
		require.Nil(t, err)

		publishedPage, appErr := th.App.PublishPageDraft(th.Context, user.Id, model.PublishPageDraftOptions{
			WikiId: createdWiki.Id,
			PageId: pageId,
			Title:  title,
		})
		require.Nil(t, appErr, "PublishPageDraft should not cause infinite recursion")
		assert.NotNil(t, publishedPage)

		assert.JSONEq(t, content, publishedPage.Message, "Page content should match draft")
		assert.Equal(t, title, publishedPage.Props["title"], "Page title should match draft")
		assert.Equal(t, model.PostTypePage, publishedPage.Type, "Post type should be PostTypePage")
		assert.Equal(t, channel.Id, publishedPage.ChannelId, "Page should be in correct channel")
		assert.Equal(t, user.Id, publishedPage.UserId, "Page should be created by correct user")

		retrievedPage, getErr := th.App.GetPageWithContent(th.Context, publishedPage.Id)
		require.Nil(t, getErr)
		assert.Equal(t, model.PostTypePage, retrievedPage.Type)
		assert.JSONEq(t, content, retrievedPage.Message)
	})

	t.Run("publish parent draft updates child draft references", func(t *testing.T) {
		// With the unified page ID model, the draft ID and the published page ID are the same.
		// This test verifies that child drafts can properly reference parent drafts,
		// and that the reference remains valid after the parent is published.
		parentPageId := model.NewId()
		parentTitle := "Parent Draft"
		parentContent := createTipTapContent("This is the parent page content")

		_, err := th.App.SavePageDraftWithMetadata(th.Context, user.Id, createdWiki.Id, parentPageId, parentContent, parentTitle, 0, nil)
		require.Nil(t, err)

		childPageId := model.NewId()
		childTitle := "Child Draft"
		childContent := createTipTapContent("This is the child page content")

		_, err = th.App.SavePageDraftWithMetadata(th.Context, user.Id, createdWiki.Id, childPageId, childContent, childTitle, 0, map[string]any{
			model.DraftPropsPageParentID: parentPageId,
		})
		require.Nil(t, err)

		childDraft, err := th.App.GetPageDraft(th.Context, user.Id, createdWiki.Id, childPageId, false)
		require.Nil(t, err)
		assert.Equal(t, parentPageId, childDraft.Props[model.DraftPropsPageParentID], "Child draft should reference parent page ID")

		publishedParent, appErr := th.App.PublishPageDraft(th.Context, user.Id, model.PublishPageDraftOptions{
			WikiId: createdWiki.Id,
			PageId: parentPageId,
			Title:  parentTitle,
		})
		require.Nil(t, appErr)
		require.NotNil(t, publishedParent)

		// With unified ID model, published page ID equals draft ID
		assert.Equal(t, parentPageId, publishedParent.Id, "Published page should have same ID as draft (unified ID model)")

		updatedChildDraft, err := th.App.GetPageDraft(th.Context, user.Id, createdWiki.Id, childPageId, false)
		require.Nil(t, err)
		// The child draft's parent reference should still be valid since draft ID == published page ID
		assert.Equal(t, publishedParent.Id, updatedChildDraft.Props[model.DraftPropsPageParentID], "Child draft should reference the parent page ID")

		publishedChild, appErr := th.App.PublishPageDraft(th.Context, user.Id, model.PublishPageDraftOptions{
			WikiId:   createdWiki.Id,
			PageId:   childPageId,
			ParentId: publishedParent.Id,
			Title:    childTitle,
		})
		require.Nil(t, appErr)
		require.NotNil(t, publishedChild)
		assert.Equal(t, publishedParent.Id, publishedChild.PageParentId, "Published child page should have correct parent")
	})

	t.Run("handles malformed TipTap JSON gracefully", func(t *testing.T) {
		// This test validates that the system handles malformed/corrupted TipTap JSON
		// that might exist due to bugs, data migration issues, or database corruption.
		// The server should accept and store the malformed content (as it's just JSON),
		// allowing the frontend to handle rendering gracefully.

		pageId := model.NewId()
		title := "Malformed Content Page"

		// Create malformed TipTap JSON with invalid node type
		malformedContent := `{"type":"doc","content":[{"type":"invalid_node_type"}]}`

		// # Save draft with malformed content - should succeed (server stores JSON as-is)
		_, err := th.App.SavePageDraftWithMetadata(th.Context, user.Id, createdWiki.Id, pageId, malformedContent, title, 0, nil)
		require.Nil(t, err, "Server should accept malformed TipTap JSON")

		// # Publish the draft - should succeed
		publishedPage, appErr := th.App.PublishPageDraft(th.Context, user.Id, model.PublishPageDraftOptions{
			WikiId: createdWiki.Id,
			PageId: pageId,
			Title:  title,
		})
		require.Nil(t, appErr, "Publishing malformed content should succeed")
		require.NotNil(t, publishedPage)

		// * Verify page was created with the malformed content
		assert.Equal(t, title, publishedPage.Props["title"])
		assert.Equal(t, model.PostTypePage, publishedPage.Type)
		assert.JSONEq(t, malformedContent, publishedPage.Message, "Malformed content should be stored as-is")

		// * Verify page can be retrieved
		retrievedPage, getErr := th.App.GetPageWithContent(th.Context, publishedPage.Id)
		require.Nil(t, getErr, "Should be able to retrieve page with malformed content")
		assert.JSONEq(t, malformedContent, retrievedPage.Message)
	})
}

// TestPageDraftWhenPageDeleted tests concurrent editing conflict scenarios where users
// have unpublished drafts (unsaved work-in-progress) when a page is deleted by another user.
// With the unified page ID model, when editing an existing page the draft ID IS the page ID.
// These tests verify that draft content can still be retained even after the published page is deleted.
func TestPageDraftWhenPageDeleted(t *testing.T) {
	th := Setup(t).InitBasic(t)

	th.SetupPagePermissions()
	th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)

	user := th.BasicUser
	channel := th.BasicChannel

	wiki := &model.Wiki{
		ChannelId:   channel.Id,
		Title:       "Test Wiki for Deletion Tests",
		Description: "Testing draft behavior when pages are deleted",
	}
	createdWiki, appErr := th.App.CreateWiki(th.Context, wiki, user.Id)
	require.Nil(t, appErr)

	sessionCtx := th.CreateSessionContext()

	t.Run("draft deleted when page deleted", func(t *testing.T) {
		// Create a page
		page, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Page to Delete", "", user.Id, "", "")
		require.Nil(t, appErr)

		// With unified model, use page ID as draft ID when editing existing page
		pageId := page.Id
		content := createTipTapContent("Draft content for page about to be deleted")
		_, err := th.App.SavePageDraftWithMetadata(th.Context, user.Id, createdWiki.Id, pageId, content, "Updated Title", page.EditAt, nil)
		require.Nil(t, err)

		// Verify draft exists before deletion
		draftBefore, getDraftErr := th.App.GetPageDraft(th.Context, user.Id, createdWiki.Id, pageId, false)
		require.Nil(t, getDraftErr)
		require.NotNil(t, draftBefore)

		// Delete the page
		err = th.App.DeletePage(sessionCtx, page, "")
		require.Nil(t, err)

		// Draft should be deleted along with the page
		_, getDraftErr = th.App.GetPageDraft(th.Context, user.Id, createdWiki.Id, pageId, false)
		require.NotNil(t, getDraftErr, "Draft should be deleted when page is deleted")
		require.Equal(t, "app.draft.get_page_draft.not_found", getDraftErr.Id)
	})

	t.Run("draft for new page unaffected when different page deleted", func(t *testing.T) {
		pageToDelete, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Unrelated Page", "", user.Id, "", "")
		require.Nil(t, appErr)

		// Create a new draft (new page)
		newPageId := model.NewId()
		content := createTipTapContent("Draft for new page")
		title := "New Page Draft"
		_, err := th.App.SavePageDraftWithMetadata(th.Context, user.Id, createdWiki.Id, newPageId, content, title, 0, nil)
		require.Nil(t, err)

		// Delete unrelated page
		err = th.App.DeletePage(sessionCtx, pageToDelete, "")
		require.Nil(t, err)

		// New draft should be unaffected
		draftAfter, getDraftErr := th.App.GetPageDraft(th.Context, user.Id, createdWiki.Id, newPageId, false)
		require.Nil(t, getDraftErr, "Draft for new page should be unaffected")
		draftAfterContent, _ := draftAfter.GetDocumentJSON()
		require.JSONEq(t, content, draftAfterContent)

		// Should be able to publish the new page
		publishedPage, publishErr := th.App.PublishPageDraft(sessionCtx, user.Id, model.PublishPageDraftOptions{
			WikiId: createdWiki.Id,
			PageId: newPageId,
			Title:  title,
		})
		require.Nil(t, publishErr, "Should be able to publish draft for new page")
		require.Equal(t, title, publishedPage.Props["title"])
	})

	t.Run("all user drafts deleted when page deleted", func(t *testing.T) {
		// Create a page
		page, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Page with Multiple Drafts", "", user.Id, "", "")
		require.Nil(t, appErr)

		user2 := th.CreateUser(t)
		th.LinkUserToTeam(t, user2, th.BasicTeam)
		th.AddUserToChannel(t, user2, channel)

		// User 1 creates a draft (editing the same page)
		pageId := page.Id
		content1 := createTipTapContent("User 1 draft")
		_, err := th.App.SavePageDraftWithMetadata(th.Context, user.Id, createdWiki.Id, pageId, content1, "Title 1", page.EditAt, nil)
		require.Nil(t, err)

		// User 2 creates a draft (editing the same page)
		content2 := createTipTapContent("User 2 draft")
		_, err = th.App.SavePageDraftWithMetadata(th.Context, user2.Id, createdWiki.Id, pageId, content2, "Title 2", page.EditAt, nil)
		require.Nil(t, err)

		// Delete the page
		err = th.App.DeletePage(sessionCtx, page, "")
		require.Nil(t, err)

		// Both drafts should be deleted along with the page
		_, err = th.App.GetPageDraft(th.Context, user.Id, createdWiki.Id, pageId, false)
		require.NotNil(t, err, "User 1 draft should be deleted")
		require.Equal(t, "app.draft.get_page_draft.not_found", err.Id)

		_, err = th.App.GetPageDraft(th.Context, user2.Id, createdWiki.Id, pageId, false)
		require.NotNil(t, err, "User 2 draft should be deleted")
		require.Equal(t, "app.draft.get_page_draft.not_found", err.Id)
	})

	t.Run("regular post drafts unaffected by page deletion", func(t *testing.T) {
		page, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Page Unrelated to Post Draft", "", user.Id, "", "")
		require.Nil(t, appErr)

		regularPostDraft := &model.Draft{
			CreateAt:  model.GetMillis(),
			UpdateAt:  model.GetMillis(),
			UserId:    user.Id,
			ChannelId: channel.Id,
			Message:   "Regular post draft message",
			RootId:    "",
		}
		savedDraft, nErr := th.App.Srv().Store().Draft().Upsert(regularPostDraft)
		require.NoError(t, nErr)

		err := th.App.DeletePage(sessionCtx, page, "")
		require.Nil(t, err)

		retrievedDraft, getErr := th.App.Srv().Store().Draft().Get(user.Id, channel.Id, "", false)
		require.NoError(t, getErr, "Regular post draft should be unaffected by page deletion")
		require.Equal(t, savedDraft.Message, retrievedDraft.Message)
	})
}
