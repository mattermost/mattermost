// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestWikiEndpointsRequireAuth(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionCreatePage.Id, model.TeamUserRoleId)
	th.AddPermissionToRole(t, model.PermissionEditPage.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionReadPage.Id, model.ChannelUserRoleId)
	th.Context.Session().UserId = th.BasicUser.Id

	// Setup: create wiki + page + comment for testing
	wiki := &model.Wiki{
		TeamId: th.BasicTeam.Id,
		Title:  "Auth Test Wiki",
	}
	createdWiki, resp, err := th.Client.CreateWiki(context.Background(), wiki)
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)

	// Link wiki to BasicChannel so read/comment permission checks resolve via the linked source channel.
	// Direct channel-membership checks against wiki backing channels always fail (Channels.Type='W' is
	// excluded from member lookups); proper fix is a per-wiki ACL — see plans/wiki-acl-confluence-model.md.
	_, linkErr := th.App.LinkWikiToChannel(th.Context, createdWiki.Id, th.BasicChannel.Id, th.BasicUser.Id)
	require.Nil(t, linkErr)

	page, resp, err := th.Client.CreatePage(context.Background(), createdWiki.Id, "", "Auth Test Page")
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)

	comment, resp, err := th.Client.CreatePageComment(context.Background(), createdWiki.Id, page.Id, "Test Comment")
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)

	// Save a draft for testing
	draftContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Draft content"}]}]}`
	_, appErr := th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, createdWiki.Id, page.Id, draftContent, "Draft Title", 0, nil)
	require.Nil(t, appErr)

	// Logout to test unauthenticated access
	_, err = th.Client.Logout(context.Background())
	require.NoError(t, err)

	t.Run("CreateWiki requires auth", func(t *testing.T) {
		_, resp, err := th.Client.CreateWiki(context.Background(), wiki)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("GetWiki requires auth", func(t *testing.T) {
		_, resp, err := th.Client.GetWiki(context.Background(), createdWiki.Id)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("GetWikisForChannel requires auth", func(t *testing.T) {
		_, resp, err := th.Client.GetWikisForChannel(context.Background(), th.BasicChannel.Id)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("UpdateWiki requires auth", func(t *testing.T) {
		_, resp, err := th.Client.UpdateWiki(context.Background(), createdWiki)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("DeleteWiki requires auth", func(t *testing.T) {
		resp, err := th.Client.DeleteWiki(context.Background(), createdWiki.Id)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("GetPages requires auth", func(t *testing.T) {
		_, resp, err := th.Client.GetPages(context.Background(), createdWiki.Id, 0, 60)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("CreatePage requires auth", func(t *testing.T) {
		_, resp, err := th.Client.CreatePage(context.Background(), createdWiki.Id, "", "New Page")
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("GetPage requires auth", func(t *testing.T) {
		_, resp, err := th.Client.GetPage(context.Background(), createdWiki.Id, page.Id)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("UpdatePage requires auth", func(t *testing.T) {
		_, resp, err := th.Client.UpdatePage(context.Background(), createdWiki.Id, page.Id, "Updated", "", "", 0)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("DeletePage requires auth", func(t *testing.T) {
		resp, err := th.Client.DeletePage(context.Background(), createdWiki.Id, page.Id)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("RestorePage requires auth", func(t *testing.T) {
		resp, err := th.Client.RestorePage(context.Background(), createdWiki.Id, page.Id)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("GetPageActiveEditors requires auth", func(t *testing.T) {
		url := "/wikis/" + createdWiki.Id + "/pages/" + page.Id + "/active_editors"
		httpResp, err := th.Client.DoAPIGet(context.Background(), url, "")
		require.Error(t, err)
		CheckUnauthorizedStatus(t, model.BuildResponse(httpResp))
	})

	t.Run("GetPageBreadcrumb requires auth", func(t *testing.T) {
		_, resp, err := th.Client.GetPageBreadcrumb(context.Background(), createdWiki.Id, page.Id)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("MovePage requires auth", func(t *testing.T) {
		_, resp, err := th.Client.MovePage(context.Background(), createdWiki.Id, page.Id, nil, nil)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("MovePageToWiki requires auth", func(t *testing.T) {
		resp, err := th.Client.MovePageToWiki(context.Background(), createdWiki.Id, page.Id, model.NewId())
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("DuplicatePage requires auth", func(t *testing.T) {
		_, resp, err := th.Client.DuplicatePage(context.Background(), createdWiki.Id, page.Id, createdWiki.Id, nil, nil)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("GetPageComments requires auth", func(t *testing.T) {
		_, resp, err := th.Client.GetPageComments(context.Background(), createdWiki.Id, page.Id)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("CreatePageComment requires auth", func(t *testing.T) {
		_, resp, err := th.Client.CreatePageComment(context.Background(), createdWiki.Id, page.Id, "Comment")
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("CreatePageCommentReply requires auth", func(t *testing.T) {
		_, resp, err := th.Client.CreatePageCommentReply(context.Background(), createdWiki.Id, page.Id, comment.Id, "Reply")
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("ResolvePageComment requires auth", func(t *testing.T) {
		url := "/wikis/" + createdWiki.Id + "/pages/" + page.Id + "/comments/" + comment.Id + "/resolve"
		httpResp, err := th.Client.DoAPIPost(context.Background(), url, "")
		require.Error(t, err)
		CheckUnauthorizedStatus(t, model.BuildResponse(httpResp))
	})

	t.Run("UnresolvePageComment requires auth", func(t *testing.T) {
		url := "/wikis/" + createdWiki.Id + "/pages/" + page.Id + "/comments/" + comment.Id + "/unresolve"
		httpResp, err := th.Client.DoAPIPost(context.Background(), url, "")
		require.Error(t, err)
		CheckUnauthorizedStatus(t, model.BuildResponse(httpResp))
	})

	t.Run("GetPageDraft requires auth", func(t *testing.T) {
		_, resp, err := th.Client.GetPageDraft(context.Background(), createdWiki.Id, page.Id)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("SavePageDraft requires auth", func(t *testing.T) {
		_, resp, err := th.Client.SavePageDraft(context.Background(), createdWiki.Id, page.Id, draftContent, 0)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("DeletePageDraft requires auth", func(t *testing.T) {
		resp, err := th.Client.DeletePageDraft(context.Background(), createdWiki.Id, page.Id)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("GetPageDraftsForWiki requires auth", func(t *testing.T) {
		_, resp, err := th.Client.GetPageDraftsForWiki(context.Background(), createdWiki.Id)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("PublishPageDraft requires auth", func(t *testing.T) {
		_, resp, err := th.Client.PublishPageDraft(context.Background(), createdWiki.Id, page.Id, model.PublishPageDraftOptions{})
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("GetChannelPages requires auth", func(t *testing.T) {
		_, resp, err := th.Client.GetChannelPages(context.Background(), th.BasicChannel.Id)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

func TestUpdatePageOptimisticLocking(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionCreatePage.Id, model.TeamUserRoleId)
	th.AddPermissionToRole(t, model.PermissionEditPage.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionReadPage.Id, model.ChannelUserRoleId)
	th.Context.Session().UserId = th.BasicUser.Id

	validContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Original content"}]}]}`

	wiki := &model.Wiki{
		TeamId: th.BasicTeam.Id,
		Title:  "Optimistic Lock Wiki",
	}
	wiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, appErr)

	// Create page via draft+publish to establish base content
	pageId := model.NewId()
	_, appErr = th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, wiki.Id, pageId, validContent, "Original Title", 0, nil)
	require.Nil(t, appErr)

	createdPage, appErr := th.App.PublishPageDraft(th.Context, th.BasicUser.Id, model.PublishPageDraftOptions{
		WikiId:  wiki.Id,
		PageId:  pageId,
		Title:   "Original Title",
		Content: validContent,
	})
	require.Nil(t, appErr)
	actualPageId := createdPage.Id

	// First update to establish a non-zero EditAt
	firstUpdateContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"First update"}]}]}`
	updatedPage, resp, err := th.Client.UpdatePage(context.Background(), wiki.Id, actualPageId, "First Update", firstUpdateContent, "first update", 0)
	require.NoError(t, err)
	CheckOKStatus(t, resp)
	require.Greater(t, updatedPage.EditAt, int64(0))

	baseEditAt := updatedPage.EditAt

	t.Run("update with correct base_edit_at succeeds", func(t *testing.T) {
		newContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Second update"}]}]}`
		result, resp, err := th.Client.UpdatePage(context.Background(), wiki.Id, actualPageId, "Second Update", newContent, "second update", baseEditAt)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Greater(t, result.EditAt, baseEditAt)
	})

	t.Run("update with stale base_edit_at returns 409 conflict", func(t *testing.T) {
		staleContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Stale update"}]}]}`
		_, resp, err := th.Client.UpdatePage(context.Background(), wiki.Id, actualPageId, "Stale Update", staleContent, "stale update", baseEditAt)
		require.Error(t, err)
		require.Equal(t, http.StatusConflict, resp.StatusCode)
	})

	t.Run("update with force=true and stale base_edit_at succeeds", func(t *testing.T) {
		forceContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Force update"}]}]}`
		payload := map[string]any{
			"title":        "Force Update",
			"content":      forceContent,
			"search_text":  "force update",
			"base_edit_at": baseEditAt,
			"force":        true,
		}
		payloadBytes, _ := json.Marshal(payload)
		httpResp, err := th.Client.DoAPIPut(context.Background(), "/wikis/"+wiki.Id+"/pages/"+actualPageId, string(payloadBytes))
		require.NoError(t, err)
		CheckOKStatus(t, model.BuildResponse(httpResp))

		var forcedPage model.Post
		err = json.NewDecoder(httpResp.Body).Decode(&forcedPage)
		require.NoError(t, err)
		require.Greater(t, forcedPage.EditAt, baseEditAt)
	})
}

func TestCreatePageValidation(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionCreatePage.Id, model.TeamUserRoleId)
	th.Context.Session().UserId = th.BasicUser.Id

	wiki := &model.Wiki{
		TeamId: th.BasicTeam.Id,
		Title:  "Validation Wiki",
	}
	createdWiki, resp, err := th.Client.CreateWiki(context.Background(), wiki)
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)

	t.Run("empty title fails", func(t *testing.T) {
		_, resp, err := th.Client.CreatePage(context.Background(), createdWiki.Id, "", "")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("whitespace-only title fails", func(t *testing.T) {
		_, resp, err := th.Client.CreatePage(context.Background(), createdWiki.Id, "", "   ")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("title exceeding max length fails", func(t *testing.T) {
		longTitle := strings.Repeat("a", model.MaxPageTitleLength+1)
		_, resp, err := th.Client.CreatePage(context.Background(), createdWiki.Id, "", longTitle)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("non-existent parent_id fails", func(t *testing.T) {
		_, resp, err := th.Client.CreatePage(context.Background(), createdWiki.Id, model.NewId(), "Child Page")
		require.Error(t, err)
		assert.True(t, resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusBadRequest,
			"expected 404 or 400 but got %d", resp.StatusCode)
	})

	t.Run("valid parent_id succeeds", func(t *testing.T) {
		parent, resp, err := th.Client.CreatePage(context.Background(), createdWiki.Id, "", "Parent Page")
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		child, resp, err := th.Client.CreatePage(context.Background(), createdWiki.Id, parent.Id, "Child Page")
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotEmpty(t, child.Id)
	})
}

func TestCrossWikiIDOR(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionCreatePage.Id, model.TeamUserRoleId)
	th.AddPermissionToRole(t, model.PermissionEditPage.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionReadPage.Id, model.ChannelUserRoleId)
	th.Context.Session().UserId = th.BasicUser.Id

	// Create wiki A with a page
	wikiA := &model.Wiki{
		TeamId: th.BasicTeam.Id,
		Title:  "Wiki A",
	}
	wikiA, appErr := th.App.CreateWiki(th.Context, wikiA, th.BasicUser.Id)
	require.Nil(t, appErr)

	pageA, resp, err := th.Client.CreatePage(context.Background(), wikiA.Id, "", "Page in Wiki A")
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)

	// Create wiki B (same channel)
	wikiB := &model.Wiki{
		TeamId: th.BasicTeam.Id,
		Title:  "Wiki B",
	}
	wikiB, appErr = th.App.CreateWiki(th.Context, wikiB, th.BasicUser.Id)
	require.Nil(t, appErr)

	t.Run("GET page from wiki A using wiki B ID fails", func(t *testing.T) {
		_, resp, err := th.Client.GetPage(context.Background(), wikiB.Id, pageA.Id)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("UPDATE page from wiki A using wiki B ID fails", func(t *testing.T) {
		_, resp, err := th.Client.UpdatePage(context.Background(), wikiB.Id, pageA.Id, "Tampered", "", "", 0)
		require.Error(t, err)
		assert.True(t, resp.StatusCode == http.StatusBadRequest || resp.StatusCode == http.StatusForbidden,
			"expected 400 or 403 but got %d", resp.StatusCode)
	})

	t.Run("DELETE page from wiki A using wiki B ID fails", func(t *testing.T) {
		resp, err := th.Client.DeletePage(context.Background(), wikiB.Id, pageA.Id)
		require.Error(t, err)
		assert.True(t, resp.StatusCode == http.StatusBadRequest || resp.StatusCode == http.StatusForbidden,
			"expected 400 or 403 but got %d", resp.StatusCode)
	})
}

func TestDraftOwnership(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionCreatePage.Id, model.TeamUserRoleId)
	th.AddPermissionToRole(t, model.PermissionEditPage.Id, model.ChannelUserRoleId)
	th.Context.Session().UserId = th.BasicUser.Id

	wiki := &model.Wiki{
		TeamId: th.BasicTeam.Id,
		Title:  "Draft Ownership Wiki",
	}
	wiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, appErr)

	// User A creates a draft
	draftPageId := model.NewId()
	draftContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"User A draft"}]}]}`
	_, appErr = th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, wiki.Id, draftPageId, draftContent, "User A Draft", 0, nil)
	require.Nil(t, appErr)

	// Login as User B
	client2 := th.CreateClient()
	_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, th.BasicUser2.Password)
	require.NoError(t, lErr)

	t.Run("User B cannot delete User A draft", func(t *testing.T) {
		resp, err := client2.DeletePageDraft(context.Background(), wiki.Id, draftPageId)
		require.Error(t, err)
		assert.True(t, resp.StatusCode == http.StatusForbidden || resp.StatusCode == http.StatusNotFound,
			"expected 403 or 404 but got %d", resp.StatusCode)
	})

	t.Run("User B cannot get User A draft", func(t *testing.T) {
		_, resp, err := client2.GetPageDraft(context.Background(), wiki.Id, draftPageId)
		require.Error(t, err)
		assert.True(t, resp.StatusCode == http.StatusForbidden || resp.StatusCode == http.StatusNotFound,
			"expected 403 or 404 but got %d", resp.StatusCode)
	})
}

func TestChannelMemberLinksUnauthenticated(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.SetupChannelSchemeWithPermissions(t, th.BasicChannel,
		model.PermissionManagePublicChannelProperties, model.PermissionCreatePage,
		model.PermissionAddBookmarkPublicChannel, model.PermissionDeleteBookmarkPublicChannel,
	)
	th.Context.Session().UserId = th.BasicUser.Id

	wiki := &model.Wiki{

		Title:  "Unauth Wiki",
		TeamId: th.BasicTeam.Id,
	}
	wiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, appErr)

	targetChannel := th.CreatePublicChannel(t)
	_, appErr = th.App.LinkWikiToChannel(th.Context, wiki.Id, targetChannel.Id, th.BasicUser.Id)
	require.Nil(t, appErr)

	_, err := th.Client.Logout(context.Background())
	require.NoError(t, err)

	t.Run("link requires auth", func(t *testing.T) {
		url := "/channels/" + targetChannel.Id + "/channel_member_links"
		payload := `{"wiki_id":"` + wiki.Id + `"}`
		httpResp, err := th.Client.DoAPIPost(context.Background(), url, payload)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, model.BuildResponse(httpResp))
	})

	t.Run("list requires auth", func(t *testing.T) {
		url := "/channels/" + targetChannel.Id + "/channel_member_links"
		httpResp, err := th.Client.DoAPIGet(context.Background(), url, "")
		require.Error(t, err)
		CheckUnauthorizedStatus(t, model.BuildResponse(httpResp))
	})

	t.Run("unlink requires auth", func(t *testing.T) {
		url := "/channels/" + targetChannel.Id + "/channel_member_links/" + wiki.Id
		httpResp, err := th.Client.DoAPIDelete(context.Background(), url)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, model.BuildResponse(httpResp))
	})
}

func TestChannelMemberLinksRequireBookmarkPermission(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.SetupChannelSchemeWithPermissions(t, th.BasicChannel,
		model.PermissionManagePublicChannelProperties, model.PermissionCreatePage,
	)
	th.Context.Session().UserId = th.BasicUser.Id

	wiki := &model.Wiki{

		Title:  "Bookmark Perm Wiki",
		TeamId: th.BasicTeam.Id,
	}
	wiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, appErr)

	// user2 has no bookmark permission on targetChannel
	targetChannel := th.CreatePublicChannel(t)
	th.AddUserToChannel(t, th.BasicUser2, targetChannel)

	scheme := th.SetupChannelScheme(t)
	targetChannel.SchemeId = &scheme.Id
	_, appErr = th.App.UpdateChannelScheme(th.Context, targetChannel)
	require.Nil(t, appErr)

	th.RemovePermissionFromRole(t, model.PermissionAddBookmarkPublicChannel.Id, scheme.DefaultChannelUserRole)
	th.RemovePermissionFromRole(t, model.PermissionAddBookmarkPublicChannel.Id, scheme.DefaultChannelAdminRole)
	th.RemovePermissionFromRole(t, model.PermissionDeleteBookmarkPublicChannel.Id, scheme.DefaultChannelUserRole)
	th.RemovePermissionFromRole(t, model.PermissionDeleteBookmarkPublicChannel.Id, scheme.DefaultChannelAdminRole)

	client2 := th.CreateClient()
	_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, th.BasicUser2.Password)
	require.NoError(t, lErr)

	t.Run("link forbidden without bookmark permission", func(t *testing.T) {
		url := "/channels/" + targetChannel.Id + "/channel_member_links"
		payload := `{"wiki_id":"` + wiki.Id + `"}`
		httpResp, err := client2.DoAPIPost(context.Background(), url, payload)
		require.Error(t, err)
		CheckForbiddenStatus(t, model.BuildResponse(httpResp))
	})

	// Create link as admin to test unlink permission
	_, appErr = th.App.LinkWikiToChannel(th.Context, wiki.Id, targetChannel.Id, th.BasicUser.Id)
	require.Nil(t, appErr)

	t.Run("unlink forbidden without bookmark permission", func(t *testing.T) {
		url := "/channels/" + targetChannel.Id + "/channel_member_links/" + wiki.Id
		httpResp, err := client2.DoAPIDelete(context.Background(), url)
		require.Error(t, err)
		CheckForbiddenStatus(t, model.BuildResponse(httpResp))
	})
}

func TestChannelMemberLinksRequireWikiModifyPermission(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	// BasicChannel has bookmark permission but NOT manage-channel-properties (wiki modify)
	th.SetupChannelSchemeWithPermissions(t, th.BasicChannel,
		model.PermissionAddBookmarkPublicChannel,
	)
	th.Context.Session().UserId = th.BasicUser.Id

	// user2 has bookmark permission but no wiki-modify permission on the wiki's backing channel
	targetChannel := th.CreatePublicChannel(t)
	th.AddUserToChannel(t, th.BasicUser2, targetChannel)
	th.AddUserToChannel(t, th.BasicUser2, th.BasicChannel)

	targetScheme := th.SetupChannelScheme(t)
	targetChannel.SchemeId = &targetScheme.Id
	_, appErr := th.App.UpdateChannelScheme(th.Context, targetChannel)
	require.Nil(t, appErr)
	th.AddPermissionToRole(t, model.PermissionAddBookmarkPublicChannel.Id, targetScheme.DefaultChannelUserRole)

	wiki := &model.Wiki{

		Title:  "Wiki Modify Perm Wiki",
		TeamId: th.BasicTeam.Id,
	}
	wiki, appErr = th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, appErr)

	client2 := th.CreateClient()
	_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, th.BasicUser2.Password)
	require.NoError(t, lErr)

	t.Run("link forbidden without wiki-modify permission on wiki channel", func(t *testing.T) {
		// In Phase 1, wiki-modify resolves to PermissionReadWiki at the team
		// level — any team member passes. Per-wiki ACLs that would block a
		// team member from linking are Phase 2. Keep the test scaffold so the
		// gap is visible; reactivate when Phase 2 ACLs land.
		t.Skip("requires Phase 2 per-wiki ACLs; see plans/wiki-page-permissions-confluence.md")
		url := "/channels/" + targetChannel.Id + "/channel_member_links"
		payload := `{"wiki_id":"` + wiki.Id + `"}`
		httpResp, err := client2.DoAPIPost(context.Background(), url, payload)
		require.Error(t, err)
		CheckNotFoundStatus(t, model.BuildResponse(httpResp))
	})
}

func TestChannelMemberLinksRejectCrossTeam(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.SetupChannelSchemeWithPermissions(t, th.BasicChannel,
		model.PermissionManagePublicChannelProperties, model.PermissionCreatePage,
		model.PermissionAddBookmarkPublicChannel,
	)
	th.Context.Session().UserId = th.BasicUser.Id

	wiki := &model.Wiki{

		Title:  "Cross Team Wiki",
		TeamId: th.BasicTeam.Id,
	}
	wiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, appErr)

	// Create a channel on a different team
	otherTeam := th.CreateTeam(t)
	otherChannel := th.CreateChannelWithClientAndTeam(t, th.Client, model.ChannelTypeOpen, otherTeam.Id)

	t.Run("link to cross-team channel returns 404", func(t *testing.T) {
		url := "/channels/" + otherChannel.Id + "/channel_member_links"
		payload := `{"wiki_id":"` + wiki.Id + `"}`
		httpResp, err := th.Client.DoAPIPost(context.Background(), url, payload)
		require.Error(t, err)
		checkHTTPStatus(t, model.BuildResponse(httpResp), http.StatusNotFound)
	})
}

func TestPageCommentsSecurityAndValidation(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionCreatePage.Id, model.TeamUserRoleId)
	th.AddPermissionToRole(t, model.PermissionReadPage.Id, model.ChannelUserRoleId)
	th.Context.Session().UserId = th.BasicUser.Id

	wiki := &model.Wiki{
		TeamId: th.BasicTeam.Id,
		Title:  "Comments Security Wiki",
	}
	wiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, appErr)

	page, resp, err := th.Client.CreatePage(context.Background(), wiki.Id, "", "Comments Security Page")
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)

	t.Run("createPageComment success", func(t *testing.T) {
		comment, resp, err := th.Client.CreatePageComment(context.Background(), wiki.Id, page.Id, "Test comment body")
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotEmpty(t, comment.Id)
		require.Equal(t, "Test comment body", comment.Message)
	})

	t.Run("createPageComment with empty message fails", func(t *testing.T) {
		_, resp, err := th.Client.CreatePageComment(context.Background(), wiki.Id, page.Id, "")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("createPageComment on non-existent page fails", func(t *testing.T) {
		_, resp, err := th.Client.CreatePageComment(context.Background(), wiki.Id, model.NewId(), "Comment")
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("createPageCommentReply success", func(t *testing.T) {
		parentComment, resp, err := th.Client.CreatePageComment(context.Background(), wiki.Id, page.Id, "Parent comment")
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		reply, resp, err := th.Client.CreatePageCommentReply(context.Background(), wiki.Id, page.Id, parentComment.Id, "Reply message")
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotEmpty(t, reply.Id)
		require.Equal(t, "Reply message", reply.Message)
	})

	t.Run("createPageCommentReply with empty message fails", func(t *testing.T) {
		parentComment, resp, err := th.Client.CreatePageComment(context.Background(), wiki.Id, page.Id, "Parent for empty reply")
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		_, resp, err = th.Client.CreatePageCommentReply(context.Background(), wiki.Id, page.Id, parentComment.Id, "")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	wikiChannel, wikiChanErr := th.App.GetWikiBackingChannel(th.Context, wiki.ChannelId)
	require.Nil(t, wikiChanErr)

	t.Run("unresolvePageComment success", func(t *testing.T) {
		inlineComment := &model.Post{
			ChannelId: wiki.ChannelId,
			UserId:    th.BasicUser.Id,
			Message:   "Inline comment for unresolve test",
			RootId:    "",
			Type:      model.PostTypePageComment,
			Props: model.StringInterface{
				model.PagePropsWikiID:      wiki.Id,
				model.PagePropsPageID:      page.Id,
				model.PostPropsCommentType: model.PageCommentTypeInline,
				model.PagePropsInlineAnchor: map[string]any{
					"text": "some text",
				},
			},
		}
		inlineComment, _, appErr := th.App.CreatePost(th.Context, inlineComment, wikiChannel, model.CreatePostFlags{})
		require.Nil(t, appErr)

		resolveURL := "/wikis/" + wiki.Id + "/pages/" + page.Id + "/comments/" + inlineComment.Id + "/resolve"
		httpResp, err := th.Client.DoAPIPost(context.Background(), resolveURL, "")
		require.NoError(t, err)
		CheckOKStatus(t, model.BuildResponse(httpResp))

		unresolveURL := "/wikis/" + wiki.Id + "/pages/" + page.Id + "/comments/" + inlineComment.Id + "/unresolve"
		httpResp, err = th.Client.DoAPIPost(context.Background(), unresolveURL, "")
		require.NoError(t, err)
		CheckOKStatus(t, model.BuildResponse(httpResp))

		var unresolvedComment model.Post
		err = json.NewDecoder(httpResp.Body).Decode(&unresolvedComment)
		require.NoError(t, err)
		require.Nil(t, unresolvedComment.Props[model.PagePropsCommentResolved])
	})

	t.Run("unresolvePageComment by third-party user denied", func(t *testing.T) {
		inlineComment := &model.Post{
			ChannelId: wiki.ChannelId,
			UserId:    th.BasicUser.Id,
			Message:   "Inline comment for third-party test",
			RootId:    "",
			Type:      model.PostTypePageComment,
			Props: model.StringInterface{
				model.PagePropsWikiID:      wiki.Id,
				model.PagePropsPageID:      page.Id,
				model.PostPropsCommentType: model.PageCommentTypeInline,
				model.PagePropsInlineAnchor: map[string]any{
					"text": "third party text",
				},
			},
		}
		inlineComment, _, appErr := th.App.CreatePost(th.Context, inlineComment, wikiChannel, model.CreatePostFlags{})
		require.Nil(t, appErr)

		resolveURL := "/wikis/" + wiki.Id + "/pages/" + page.Id + "/comments/" + inlineComment.Id + "/resolve"
		httpResp, err := th.Client.DoAPIPost(context.Background(), resolveURL, "")
		require.NoError(t, err)
		CheckOKStatus(t, model.BuildResponse(httpResp))

		thirdUser := th.CreateUser(t)
		th.LinkUserToTeam(t, thirdUser, th.BasicTeam)
		th.AddUserToChannel(t, thirdUser, th.BasicChannel)

		client3 := th.CreateClient()
		_, _, lErr := client3.Login(context.Background(), thirdUser.Username, thirdUser.Password)
		require.NoError(t, lErr)

		unresolveURL := "/wikis/" + wiki.Id + "/pages/" + page.Id + "/comments/" + inlineComment.Id + "/unresolve"
		httpResp, err = client3.DoAPIPost(context.Background(), unresolveURL, "")
		require.Error(t, err)
		CheckForbiddenStatus(t, model.BuildResponse(httpResp))
	})

	t.Run("unresolvePageComment on already-unresolved comment succeeds idempotently", func(t *testing.T) {
		inlineComment := &model.Post{
			ChannelId: wiki.ChannelId,
			UserId:    th.BasicUser.Id,
			Message:   "Already unresolved comment",
			RootId:    "",
			Type:      model.PostTypePageComment,
			Props: model.StringInterface{
				model.PagePropsWikiID:      wiki.Id,
				model.PagePropsPageID:      page.Id,
				model.PostPropsCommentType: model.PageCommentTypeInline,
				model.PagePropsInlineAnchor: map[string]any{
					"text": "idempotent text",
				},
			},
		}
		inlineComment, _, appErr := th.App.CreatePost(th.Context, inlineComment, wikiChannel, model.CreatePostFlags{})
		require.Nil(t, appErr)

		unresolveURL := "/wikis/" + wiki.Id + "/pages/" + page.Id + "/comments/" + inlineComment.Id + "/unresolve"
		httpResp, err := th.Client.DoAPIPost(context.Background(), unresolveURL, "")
		require.NoError(t, err)
		CheckOKStatus(t, model.BuildResponse(httpResp))

		var result model.Post
		err = json.NewDecoder(httpResp.Body).Decode(&result)
		require.NoError(t, err)
		require.Nil(t, result.Props[model.PagePropsCommentResolved])
	})
}
