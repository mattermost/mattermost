// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/utils/testutils"
)

func TestUpsertDraft(t *testing.T) {
	mainHelper.Parallel(t)

	th := Setup(t).InitBasic(t)

	// set config
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = true })

	client := th.Client
	channel := th.BasicChannel
	user := th.BasicUser

	draft := &model.Draft{
		CreateAt:  12345,
		UpdateAt:  12345,
		UserId:    user.Id,
		ChannelId: channel.Id,
		Message:   "original",
	}

	// try to upsert draft
	draftResp, _, err := client.UpsertDraft(context.Background(), draft)
	require.NoError(t, err)

	assert.Equal(t, draft.UserId, draftResp.UserId)
	assert.Equal(t, draft.Message, draftResp.Message)
	assert.Equal(t, draft.ChannelId, draftResp.ChannelId)

	// upload file
	sent, err := testutils.ReadTestFile("test.png")
	require.NoError(t, err)

	fileResp, _, err := client.UploadFile(context.Background(), sent, channel.Id, "test.png")
	require.NoError(t, err)

	draftWithFiles := draft
	draftWithFiles.FileIds = []string{fileResp.FileInfos[0].Id}

	// try to upsert draft with file
	draftResp, _, err = client.UpsertDraft(context.Background(), draftWithFiles)
	require.NoError(t, err)

	assert.Equal(t, draftWithFiles.UserId, draftResp.UserId)
	assert.Equal(t, draftWithFiles.Message, draftResp.Message)
	assert.Equal(t, draftWithFiles.ChannelId, draftResp.ChannelId)
	assert.ElementsMatch(t, draftWithFiles.FileIds, draftResp.FileIds)

	// try to upsert draft for invalid channel
	draftInvalidChannel := draft
	draftInvalidChannel.ChannelId = "12345"

	_, resp, err := client.UpsertDraft(context.Background(), draft)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	// try to upsert draft without config setting set to true
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = false })

	_, resp, err = client.UpsertDraft(context.Background(), draft)
	require.Error(t, err)
	CheckNotImplementedStatus(t, resp)
}

func TestGetDrafts(t *testing.T) {
	mainHelper.Parallel(t)

	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = true })

	client := th.Client
	channel1 := th.BasicChannel
	channel2 := th.BasicChannel2
	user := th.BasicUser
	team := th.BasicTeam

	draft1 := &model.Draft{
		CreateAt:  00001,
		UserId:    user.Id,
		ChannelId: channel1.Id,
		Message:   "draft1",
	}

	draft2 := &model.Draft{
		CreateAt:  11111,
		UserId:    user.Id,
		ChannelId: channel2.Id,
		Message:   "draft2",
	}

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = true })

	// upsert draft1
	_, _, err := client.UpsertDraft(context.Background(), draft1)
	require.NoError(t, err)

	// Wait a bit so the second draft gets a newer UpdateAt
	time.Sleep(100 * time.Millisecond)

	// upsert draft2
	_, _, err = client.UpsertDraft(context.Background(), draft2)
	require.NoError(t, err)

	// try to get drafts
	draftResp, _, err := client.GetDrafts(context.Background(), user.Id, team.Id)
	require.NoError(t, err)

	assert.Equal(t, draft2.UserId, draftResp[0].UserId)
	assert.Equal(t, draft2.Message, draftResp[0].Message)
	assert.Equal(t, draft2.ChannelId, draftResp[0].ChannelId)

	assert.Equal(t, draft1.UserId, draftResp[1].UserId)
	assert.Equal(t, draft1.Message, draftResp[1].Message)
	assert.Equal(t, draft1.ChannelId, draftResp[1].ChannelId)

	assert.Len(t, draftResp, 2)

	// try to get drafts on invalid team
	_, resp, err := client.GetDrafts(context.Background(), user.Id, "12345")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	// try to get drafts when config is turned off
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = false })
	_, resp, err = client.GetDrafts(context.Background(), user.Id, team.Id)
	require.Error(t, err)
	CheckNotImplementedStatus(t, resp)
}

func TestDeleteDraft(t *testing.T) {
	mainHelper.Parallel(t)

	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = true })

	client := th.Client
	channel1 := th.BasicChannel
	channel2 := th.BasicChannel2
	user := th.BasicUser
	team := th.BasicTeam

	draft1 := &model.Draft{
		CreateAt:  00001,
		UserId:    user.Id,
		ChannelId: channel1.Id,
		Message:   "draft1",
		RootId:    "",
	}

	draft2 := &model.Draft{
		CreateAt:  11111,
		UserId:    user.Id,
		ChannelId: channel2.Id,
		Message:   "draft2",
		RootId:    model.NewId(),
	}

	// upsert draft1
	_, _, err := client.UpsertDraft(context.Background(), draft1)
	require.NoError(t, err)

	// Wait a bit so the second draft gets a newer UpdateAt
	time.Sleep(100 * time.Millisecond)

	// upsert draft2
	_, _, err = client.UpsertDraft(context.Background(), draft2)
	require.NoError(t, err)

	// get drafts
	draftResp, _, err := client.GetDrafts(context.Background(), user.Id, team.Id)
	require.NoError(t, err)

	assert.Equal(t, draft2.UserId, draftResp[0].UserId)
	assert.Equal(t, draft2.Message, draftResp[0].Message)
	assert.Equal(t, draft2.ChannelId, draftResp[0].ChannelId)

	assert.Equal(t, draft1.UserId, draftResp[1].UserId)
	assert.Equal(t, draft1.Message, draftResp[1].Message)
	assert.Equal(t, draft1.ChannelId, draftResp[1].ChannelId)

	// try to delete draft1
	_, _, err = client.DeleteDraft(context.Background(), user.Id, channel1.Id, draft1.RootId)
	require.NoError(t, err)

	// get drafts
	draftResp, _, err = client.GetDrafts(context.Background(), user.Id, team.Id)
	require.NoError(t, err)

	assert.Equal(t, draft2.UserId, draftResp[0].UserId)
	assert.Equal(t, draft2.Message, draftResp[0].Message)
	assert.Equal(t, draft2.ChannelId, draftResp[0].ChannelId)
	assert.Len(t, draftResp, 1)
}

func TestPageDraftPermissions(t *testing.T) {
	mainHelper.Parallel(t)

	th := Setup(t).InitBasic(t)

	th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
	th.Context.Session().UserId = th.BasicUser.Id

	wiki := &model.Wiki{
		ChannelId: th.BasicChannel.Id,
		Title:     "Test Wiki",
	}
	wiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, appErr)

	draftId := model.NewId()

	t.Run("save page draft successfully", func(t *testing.T) {
		tipTapContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Test draft content"}]}]}`
		draft, resp, err := th.Client.SavePageDraft(context.Background(), wiki.Id, draftId, tipTapContent, 0)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotNil(t, draft)
		require.NotEmpty(t, draft.Content.Content)
	})

	t.Run("get page draft successfully", func(t *testing.T) {
		draft, resp, err := th.Client.GetPageDraft(context.Background(), wiki.Id, draftId)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotNil(t, draft)
		require.NotEmpty(t, draft.Content.Content)
	})

	t.Run("fail to get page draft without read permission", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t)
		th.Context.Session().UserId = th.BasicUser.Id

		privateWiki := &model.Wiki{
			ChannelId: privateChannel.Id,
			Title:     "Private Wiki",
		}
		privateWiki, appErr := th.App.CreateWiki(th.Context, privateWiki, th.BasicUser.Id)
		require.Nil(t, appErr)

		privatePageId := model.NewId()
		_, appErr = th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, privateWiki.Id, privatePageId, createTipTapContent("Private draft"), "Private draft", 0, nil)
		require.Nil(t, appErr)

		client2 := th.CreateClient()
		_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
		require.NoError(t, lErr)

		_, resp, err := client2.GetPageDraft(context.Background(), privateWiki.Id, privatePageId)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("fail to save page draft without edit wiki permission", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t)
		th.Context.Session().UserId = th.BasicUser.Id

		privateWiki := &model.Wiki{
			ChannelId: privateChannel.Id,
			Title:     "Private Wiki",
		}
		privateWiki, appErr := th.App.CreateWiki(th.Context, privateWiki, th.BasicUser.Id)
		require.Nil(t, appErr)

		client2 := th.CreateClient()
		_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
		require.NoError(t, lErr)

		tipTapContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Unauthorized draft"}]}]}`
		_, resp, err := client2.SavePageDraft(context.Background(), privateWiki.Id, model.NewId(), tipTapContent, 0)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("fail to delete page draft without edit wiki permission", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t)
		th.Context.Session().UserId = th.BasicUser.Id

		privateWiki := &model.Wiki{
			ChannelId: privateChannel.Id,
			Title:     "Private Wiki",
		}
		privateWiki, appErr := th.App.CreateWiki(th.Context, privateWiki, th.BasicUser.Id)
		require.Nil(t, appErr)

		privatePageId := model.NewId()
		_, appErr = th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, privateWiki.Id, privatePageId, createTipTapContent("Private draft"), "Private draft", 0, nil)
		require.Nil(t, appErr)

		client2 := th.CreateClient()
		_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
		require.NoError(t, lErr)

		resp, err := client2.DeletePageDraft(context.Background(), privateWiki.Id, privatePageId)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("fail to get page drafts for wiki without read permission", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t)
		th.Context.Session().UserId = th.BasicUser.Id

		privateWiki := &model.Wiki{
			ChannelId: privateChannel.Id,
			Title:     "Private Wiki",
		}
		privateWiki, appErr := th.App.CreateWiki(th.Context, privateWiki, th.BasicUser.Id)
		require.Nil(t, appErr)

		client2 := th.CreateClient()
		_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
		require.NoError(t, lErr)

		_, resp, err := client2.GetPageDraftsForWiki(context.Background(), privateWiki.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})
}

// TestPageDraftOwnershipValidation tests that users cannot access other users' drafts
// even when they have wiki/channel permissions (IDOR protection)
func TestPageDraftOwnershipValidation(t *testing.T) {
	mainHelper.Parallel(t)

	th := Setup(t).InitBasic(t)

	// Give both users wiki permissions
	th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionCreatePage.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionEditPage.Id, model.ChannelUserRoleId)

	// Add user2 to the channel so they have wiki access
	th.LinkUserToTeam(t, th.BasicUser2, th.BasicTeam)
	th.AddUserToChannel(t, th.BasicUser2, th.BasicChannel)

	th.Context.Session().UserId = th.BasicUser.Id

	wiki := &model.Wiki{
		ChannelId: th.BasicChannel.Id,
		Title:     "Test Wiki",
	}
	wiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, appErr)

	// User1 creates a draft
	draftPageId := model.NewId()
	draftContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"User1 private draft"}]}]}`
	_, appErr = th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, wiki.Id, draftPageId, draftContent, "User1 Draft", 0, nil)
	require.Nil(t, appErr)

	// Login as user2 who has channel access but doesn't own the draft
	client2 := th.CreateClient()
	_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
	require.NoError(t, lErr)

	t.Run("user cannot get another user's draft", func(t *testing.T) {
		_, resp, err := client2.GetPageDraft(context.Background(), wiki.Id, draftPageId)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("user cannot delete another user's draft", func(t *testing.T) {
		resp, err := client2.DeletePageDraft(context.Background(), wiki.Id, draftPageId)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("user cannot move another user's draft", func(t *testing.T) {
		url := "/wikis/" + wiki.Id + "/drafts/" + draftPageId + "/move"
		payload := `{"parent_id":""}`
		httpResp, err := client2.DoAPIPost(context.Background(), url, payload)
		require.Error(t, err)
		CheckNotFoundStatus(t, model.BuildResponse(httpResp))
	})

	t.Run("user cannot publish another user's draft", func(t *testing.T) {
		_, resp, err := client2.PublishPageDraft(context.Background(), wiki.Id, draftPageId, model.PublishPageDraftOptions{
			Title: "Stolen Page",
		})
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("user can access their own draft", func(t *testing.T) {
		// User2 creates their own draft
		user2DraftId := model.NewId()
		user2Content := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"User2 draft"}]}]}`
		draft, resp, err := client2.SavePageDraft(context.Background(), wiki.Id, user2DraftId, user2Content, 0)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotNil(t, draft)

		// User2 can get their own draft
		retrievedDraft, resp, err := client2.GetPageDraft(context.Background(), wiki.Id, user2DraftId)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotNil(t, retrievedDraft)

		// User2 can delete their own draft
		resp, err = client2.DeletePageDraft(context.Background(), wiki.Id, user2DraftId)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
	})
}

func TestMovePageDraft(t *testing.T) {
	mainHelper.Parallel(t)

	th := Setup(t).InitBasic(t)

	th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionCreatePage.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionEditPage.Id, model.ChannelUserRoleId)
	th.Context.Session().UserId = th.BasicUser.Id

	wiki := &model.Wiki{
		ChannelId: th.BasicChannel.Id,
		Title:     "Test Wiki",
	}
	wiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, appErr)

	t.Run("move draft to new parent successfully", func(t *testing.T) {
		// Create a parent page
		parentPage, _, err := th.Client.CreatePage(context.Background(), wiki.Id, "", "Parent Page")
		require.NoError(t, err)

		// Create a draft
		draftId := model.NewId()
		draftContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Draft to move"}]}]}`
		_, resp, err := th.Client.SavePageDraft(context.Background(), wiki.Id, draftId, draftContent, 0)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		// Move draft to parent
		url := "/wikis/" + wiki.Id + "/drafts/" + draftId + "/move"
		payload := `{"parent_id":"` + parentPage.Id + `"}`
		httpResp, err := th.Client.DoAPIPost(context.Background(), url, payload)
		require.NoError(t, err)
		CheckOKStatus(t, model.BuildResponse(httpResp))

		// Verify draft has new parent
		draft, _, err := th.Client.GetPageDraft(context.Background(), wiki.Id, draftId)
		require.NoError(t, err)
		parentId, _ := draft.Props[model.DraftPropsPageParentID].(string)
		require.Equal(t, parentPage.Id, parentId)
	})

	t.Run("move draft to root (no parent)", func(t *testing.T) {
		// Create a parent page first
		parentPage, _, err := th.Client.CreatePage(context.Background(), wiki.Id, "", "Initial Parent")
		require.NoError(t, err)

		// Create a draft with a parent
		draftId := model.NewId()
		draftContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Draft with parent"}]}]}`
		props := map[string]any{model.DraftPropsPageParentID: parentPage.Id}
		_, appErr := th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, wiki.Id, draftId, draftContent, "Draft", 0, props)
		require.Nil(t, appErr)

		// Move draft to root (empty parent_id)
		url := "/wikis/" + wiki.Id + "/drafts/" + draftId + "/move"
		payload := `{"parent_id":""}`
		httpResp, err := th.Client.DoAPIPost(context.Background(), url, payload)
		require.NoError(t, err)
		CheckOKStatus(t, model.BuildResponse(httpResp))

		// Verify draft has no parent (empty string)
		draft, _, err := th.Client.GetPageDraft(context.Background(), wiki.Id, draftId)
		require.NoError(t, err)
		parentId, _ := draft.Props[model.DraftPropsPageParentID].(string)
		require.Empty(t, parentId)
	})

	t.Run("fail for non-existent draft", func(t *testing.T) {
		url := "/wikis/" + wiki.Id + "/drafts/" + model.NewId() + "/move"
		payload := `{"parent_id":""}`
		httpResp, err := th.Client.DoAPIPost(context.Background(), url, payload)
		require.Error(t, err)
		CheckNotFoundStatus(t, model.BuildResponse(httpResp))
	})

	t.Run("fail for non-existent wiki", func(t *testing.T) {
		draftId := model.NewId()
		draftContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Test"}]}]}`
		_, _, err := th.Client.SavePageDraft(context.Background(), wiki.Id, draftId, draftContent, 0)
		require.NoError(t, err)

		url := "/wikis/" + model.NewId() + "/drafts/" + draftId + "/move"
		payload := `{"parent_id":""}`
		httpResp, err := th.Client.DoAPIPost(context.Background(), url, payload)
		require.Error(t, err)
		CheckNotFoundStatus(t, model.BuildResponse(httpResp))
	})

	t.Run("fail with invalid request body", func(t *testing.T) {
		draftId := model.NewId()
		draftContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Test"}]}]}`
		_, _, err := th.Client.SavePageDraft(context.Background(), wiki.Id, draftId, draftContent, 0)
		require.NoError(t, err)

		url := "/wikis/" + wiki.Id + "/drafts/" + draftId + "/move"
		payload := `invalid json`
		httpResp, err := th.Client.DoAPIPost(context.Background(), url, payload)
		require.Error(t, err)
		CheckBadRequestStatus(t, model.BuildResponse(httpResp))
	})

	t.Run("fail without wiki modify permission", func(t *testing.T) {
		// Create a private channel and wiki that user2 cannot access
		privateChannel := th.CreatePrivateChannel(t)
		th.Context.Session().UserId = th.BasicUser.Id

		privateWiki := &model.Wiki{
			ChannelId: privateChannel.Id,
			Title:     "Private Wiki",
		}
		privateWiki, appErr := th.App.CreateWiki(th.Context, privateWiki, th.BasicUser.Id)
		require.Nil(t, appErr)

		// User1 creates a draft in the private wiki
		draftId := model.NewId()
		draftContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Private draft"}]}]}`
		_, appErr = th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, privateWiki.Id, draftId, draftContent, "Private Draft", 0, nil)
		require.Nil(t, appErr)

		// Login as user2 who cannot access the private wiki
		client2 := th.CreateClient()
		_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
		require.NoError(t, lErr)

		// Try to move the draft
		url := "/wikis/" + privateWiki.Id + "/drafts/" + draftId + "/move"
		payload := `{"parent_id":""}`
		httpResp, err := client2.DoAPIPost(context.Background(), url, payload)
		require.Error(t, err)
		CheckForbiddenStatus(t, model.BuildResponse(httpResp))
	})
}
