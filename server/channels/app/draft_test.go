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
	th := Setup(t).InitBasic()
	defer th.TearDown()

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
	th := Setup(t).InitBasic()
	defer th.TearDown()

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
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.Server.platform.SetConfigReadOnlyFF(false)
	defer th.Server.platform.SetConfigReadOnlyFF(true)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = true })

	user := th.BasicUser
	channel := th.BasicChannel
	channel2 := th.CreateChannel(th.Context, th.BasicTeam)
	th.AddUserToChannel(user, channel2)

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
	th := Setup(t).InitBasic()
	defer th.TearDown()

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
		dmChannel := th.CreateDmChannel(th.BasicUser2)

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
		team1 := th.CreateTeam()
		team2 := th.CreateTeam()
		th.LinkUserToTeam(th.BasicUser, team1)
		th.LinkUserToTeam(th.BasicUser2, team2)

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
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.Server.platform.SetConfigReadOnlyFF(false)
	defer th.Server.platform.SetConfigReadOnlyFF(true)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = true })

	user := th.BasicUser
	channel := th.BasicChannel
	channel2 := th.CreateChannel(th.Context, th.BasicTeam)
	th.AddUserToChannel(user, channel2)

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
	th := Setup(t).InitBasic()
	defer th.TearDown()

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
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.Server.platform.SetConfigReadOnlyFF(false)
	defer th.Server.platform.SetConfigReadOnlyFF(true)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = true })

	th.SetupPagePermissions()
	th.AddPermissionToRole(model.PermissionEditWikiPublicChannel.Id, model.ChannelUserRoleId)
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
		draftId := model.NewId()
		title := "New Page"
		content := createTipTapContent("This is the content of the new page")

		_, err := th.App.SavePageDraftWithMetadata(th.Context, user.Id, createdWiki.Id, draftId, content, title, "", nil)
		require.Nil(t, err)

		publishedPage, appErr := th.App.PublishPageDraft(th.Context, user.Id, createdWiki.Id, draftId, "", title, "")
		require.Nil(t, appErr)
		assert.NotNil(t, publishedPage)
		assert.JSONEq(t, content, publishedPage.Message)
		assert.Equal(t, title, publishedPage.Props["title"])
		assert.Equal(t, model.PostTypePage, publishedPage.Type)
		assert.Equal(t, channel.Id, publishedPage.ChannelId)

		_, getDraftErr := th.App.GetPageDraft(th.Context, user.Id, createdWiki.Id, draftId)
		assert.NotNil(t, getDraftErr)
	})

	t.Run("update existing page from draft", func(t *testing.T) {
		originalPage, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Original Title", user.Id)
		require.Nil(t, appErr)

		draftId := model.NewId()
		newTitle := "Updated Title"
		newContent := createTipTapContent("This is the updated content")

		_, err := th.App.SavePageDraftWithMetadata(th.Context, user.Id, createdWiki.Id, draftId, newContent, newTitle, originalPage.Id, nil)
		require.Nil(t, err)

		updatedPage, appErr := th.App.PublishPageDraft(th.Context, user.Id, createdWiki.Id, draftId, "", newTitle, "")
		require.Nil(t, appErr)
		assert.NotNil(t, updatedPage)
		assert.Equal(t, originalPage.Id, updatedPage.Id)
		assert.JSONEq(t, newContent, updatedPage.Message)
		assert.Equal(t, newTitle, updatedPage.Props["title"])

		retrievedPage, getErr := th.App.GetPage(th.Context, originalPage.Id)
		require.Nil(t, getErr)
		assert.JSONEq(t, newContent, retrievedPage.Message)
		assert.Equal(t, newTitle, retrievedPage.Props["title"])
	})

	t.Run("multiple autosaves preserve page_id", func(t *testing.T) {
		originalPage, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Autosave Test", user.Id)
		require.Nil(t, appErr)

		draftId := model.NewId()
		title := "Autosave Test"
		pageId := originalPage.Id
		var finalContent string

		for i := 1; i <= 5; i++ {
			randomText := model.NewRandomString(50)
			finalContent = createTipTapContent(randomText)
			_, err := th.App.SavePageDraftWithMetadata(th.Context, user.Id, createdWiki.Id, draftId, finalContent, title, pageId, nil)
			require.Nil(t, err)

			retrievedDraft, getDraftErr := th.App.GetPageDraft(th.Context, user.Id, createdWiki.Id, draftId)
			require.Nil(t, getDraftErr)
			assert.Equal(t, finalContent, retrievedDraft.Message)
			assert.Equal(t, title, retrievedDraft.Props["title"])
			assert.Equal(t, pageId, retrievedDraft.Props["page_id"])
		}

		publishedPage, appErr := th.App.PublishPageDraft(th.Context, user.Id, createdWiki.Id, draftId, "", title, "")
		require.Nil(t, appErr)
		assert.Equal(t, originalPage.Id, publishedPage.Id)
		assert.JSONEq(t, finalContent, publishedPage.Message)
	})

	t.Run("publish empty draft fails", func(t *testing.T) {
		draftId := model.NewId()
		title := "Empty Draft"

		_, err := th.App.SavePageDraftWithMetadata(th.Context, user.Id, createdWiki.Id, draftId, "", title, "", nil)
		require.Nil(t, err)

		_, appErr := th.App.PublishPageDraft(th.Context, user.Id, createdWiki.Id, draftId, "", title, "")
		require.NotNil(t, appErr)
		assert.Equal(t, "app.draft.publish_page.empty", appErr.Id)
	})

	t.Run("publish non-existent draft fails", func(t *testing.T) {
		nonExistentDraftId := model.NewId()

		_, appErr := th.App.PublishPageDraft(th.Context, user.Id, createdWiki.Id, nonExistentDraftId, "", "Title", "")
		require.NotNil(t, appErr)
		assert.Equal(t, "app.draft.publish_page.not_found", appErr.Id)
	})

	t.Run("publish draft calls CreatePage directly without recursion", func(t *testing.T) {
		draftId := model.NewId()
		title := "Direct CreatePage Test"
		content := createTipTapContent("This test validates that PublishPageDraft calls CreatePage directly")

		_, err := th.App.SavePageDraftWithMetadata(th.Context, user.Id, createdWiki.Id, draftId, content, title, "", nil)
		require.Nil(t, err)

		publishedPage, appErr := th.App.PublishPageDraft(th.Context, user.Id, createdWiki.Id, draftId, "", title, "")
		require.Nil(t, appErr, "PublishPageDraft should not cause infinite recursion")
		assert.NotNil(t, publishedPage)

		assert.JSONEq(t, content, publishedPage.Message, "Page content should match draft")
		assert.Equal(t, title, publishedPage.Props["title"], "Page title should match draft")
		assert.Equal(t, model.PostTypePage, publishedPage.Type, "Post type should be PostTypePage")
		assert.Equal(t, channel.Id, publishedPage.ChannelId, "Page should be in correct channel")
		assert.Equal(t, createdWiki.Id, publishedPage.Props["wiki_id"], "Page should have wiki_id prop")
		assert.Equal(t, user.Id, publishedPage.UserId, "Page should be created by correct user")

		retrievedPage, getErr := th.App.GetPage(th.Context, publishedPage.Id)
		require.Nil(t, getErr)
		assert.Equal(t, model.PostTypePage, retrievedPage.Type)
		assert.JSONEq(t, content, retrievedPage.Message)
	})
}

// TestPageDraftWhenPageDeleted tests concurrent editing conflict scenarios where users
// have unpublished drafts (unsaved work-in-progress) when a page is deleted by another user.
// These tests verify that unpublished work is retained to prevent data loss, similar to
// how Confluence retains drafts when pages are moved to trash.
//
// Scenario: User A is editing a page (has unsaved changes in draft), User B deletes the page.
// Expected: User A's draft is retained for potential recovery, but publishing fails gracefully.
func TestPageDraftWhenPageDeleted(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.SetupPagePermissions()
	th.AddPermissionToRole(model.PermissionCreateWikiPublicChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionEditWikiPublicChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionDeleteWikiPublicChannel.Id, model.ChannelUserRoleId)

	user := th.BasicUser
	channel := th.BasicChannel

	wiki := &model.Wiki{
		ChannelId:   channel.Id,
		Title:       "Test Wiki for Deletion Tests",
		Description: "Testing draft behavior when pages are deleted",
	}
	createdWiki, appErr := th.App.CreateWiki(th.Context, wiki, user.Id)
	require.Nil(t, appErr)

	sessionCtx := createSessionContext(th)

	t.Run("unpublished draft retained when page deleted by another user", func(t *testing.T) {
		page, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Page to Delete", user.Id)
		require.Nil(t, appErr)

		draftId := model.NewId()
		content := createTipTapContent("Draft content for page about to be deleted")
		_, err := th.App.SavePageDraftWithMetadata(th.Context, user.Id, createdWiki.Id, draftId, content, "Updated Title", page.Id, nil)
		require.Nil(t, err)

		draftBefore, getDraftErr := th.App.GetPageDraft(th.Context, user.Id, createdWiki.Id, draftId)
		require.Nil(t, getDraftErr)
		require.Equal(t, page.Id, draftBefore.Props["page_id"])

		err = th.App.DeletePage(sessionCtx, page.Id)
		require.Nil(t, err)

		draftAfter, getDraftErr := th.App.GetPageDraft(th.Context, user.Id, createdWiki.Id, draftId)
		require.Nil(t, getDraftErr, "Unpublished draft should be retained to prevent work loss")
		require.Equal(t, content, draftAfter.Message)
		require.Equal(t, page.Id, draftAfter.Props["page_id"], "Draft should still reference deleted page ID for potential recovery")
	})

	t.Run("publishing orphaned draft fails when page was deleted concurrently", func(t *testing.T) {
		page, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Page to Delete Before Publish", user.Id)
		require.Nil(t, appErr)

		draftId := model.NewId()
		content := createTipTapContent("Draft for deleted page")
		title := "Updated Title After Deletion"
		_, err := th.App.SavePageDraftWithMetadata(th.Context, user.Id, createdWiki.Id, draftId, content, title, page.Id, nil)
		require.Nil(t, err)

		err = th.App.DeletePage(sessionCtx, page.Id)
		require.Nil(t, err)

		_, publishErr := th.App.PublishPageDraft(th.Context, user.Id, createdWiki.Id, draftId, "", title, "")
		require.NotNil(t, publishErr, "Publishing draft should fail when target page no longer exists")
	})

	t.Run("draft for new page unaffected when different page deleted", func(t *testing.T) {
		pageToDelete, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Unrelated Page", user.Id)
		require.Nil(t, appErr)

		draftId := model.NewId()
		content := createTipTapContent("Draft for new page")
		title := "New Page Draft"
		_, err := th.App.SavePageDraftWithMetadata(th.Context, user.Id, createdWiki.Id, draftId, content, title, "", nil)
		require.Nil(t, err)

		err = th.App.DeletePage(sessionCtx, pageToDelete.Id)
		require.Nil(t, err)

		draftAfter, getDraftErr := th.App.GetPageDraft(th.Context, user.Id, createdWiki.Id, draftId)
		require.Nil(t, getDraftErr, "Draft for new page should be unaffected")
		require.Equal(t, content, draftAfter.Message)
		require.Empty(t, draftAfter.Props["page_id"], "Draft for new page should not have page_id")

		publishedPage, publishErr := th.App.PublishPageDraft(sessionCtx, user.Id, createdWiki.Id, draftId, "", title, "")
		require.Nil(t, publishErr, "Should be able to publish draft for new page")
		require.Equal(t, title, publishedPage.Props["title"])
	})

	t.Run("multiple users' unpublished drafts all retained after page deletion", func(t *testing.T) {
		page, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Page with Multiple Drafts", user.Id)
		require.Nil(t, appErr)

		user2 := th.CreateUser()
		th.LinkUserToTeam(user2, th.BasicTeam)
		th.AddUserToChannel(user2, channel)

		draft1Id := model.NewId()
		content1 := createTipTapContent("User 1 draft")
		_, err := th.App.SavePageDraftWithMetadata(th.Context, user.Id, createdWiki.Id, draft1Id, content1, "Title 1", page.Id, nil)
		require.Nil(t, err)

		draft2Id := model.NewId()
		content2 := createTipTapContent("User 2 draft")
		_, err = th.App.SavePageDraftWithMetadata(th.Context, user2.Id, createdWiki.Id, draft2Id, content2, "Title 2", page.Id, nil)
		require.Nil(t, err)

		err = th.App.DeletePage(sessionCtx, page.Id)
		require.Nil(t, err)

		draft1After, err := th.App.GetPageDraft(th.Context, user.Id, createdWiki.Id, draft1Id)
		require.Nil(t, err, "User 1 unpublished work should be retained")
		require.Equal(t, page.Id, draft1After.Props["page_id"])

		draft2After, err := th.App.GetPageDraft(th.Context, user2.Id, createdWiki.Id, draft2Id)
		require.Nil(t, err, "User 2 unpublished work should be retained")
		require.Equal(t, page.Id, draft2After.Props["page_id"])
	})

	t.Run("regular post drafts unaffected by page deletion", func(t *testing.T) {
		page, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Page Unrelated to Post Draft", user.Id)
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

		err := th.App.DeletePage(sessionCtx, page.Id)
		require.Nil(t, err)

		retrievedDraft, getErr := th.App.Srv().Store().Draft().Get(user.Id, channel.Id, "", false)
		require.NoError(t, getErr, "Regular post draft should be unaffected by page deletion")
		require.Equal(t, savedDraft.Message, retrievedDraft.Message)
	})
}
