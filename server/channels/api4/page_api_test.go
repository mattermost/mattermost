// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func TestGetChannelPages(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.AddPermissionToRole(t, model.PermissionCreatePage.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionReadPage.Id, model.ChannelUserRoleId)

	th.Context.Session().UserId = th.BasicUser.Id

	wiki := &model.Wiki{
		ChannelId: th.BasicChannel.Id,
		Title:     "Test Wiki",
	}
	wiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, appErr)

	// Create pages
	_, _, err := th.Client.CreatePage(context.Background(), wiki.Id, "", "Test Page 1")
	require.NoError(t, err)
	_, _, err = th.Client.CreatePage(context.Background(), wiki.Id, "", "Test Page 2")
	require.NoError(t, err)

	t.Run("get channel pages successfully", func(t *testing.T) {
		postList, resp, err := th.Client.GetChannelPages(context.Background(), th.BasicChannel.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotNil(t, postList)
		require.GreaterOrEqual(t, len(postList.Posts), 2)
	})

	t.Run("fail without channel access", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t)

		client2 := th.CreateClient()
		_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
		require.NoError(t, lErr)

		_, resp, err := client2.GetChannelPages(context.Background(), privateChannel.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("fail for non-existent channel", func(t *testing.T) {
		_, resp, err := th.Client.GetChannelPages(context.Background(), model.NewId())
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})
}

func TestCreatePage(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.AddPermissionToRole(t, model.PermissionCreatePage.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionReadPage.Id, model.ChannelUserRoleId)

	th.Context.Session().UserId = th.BasicUser.Id

	wiki := &model.Wiki{
		ChannelId: th.BasicChannel.Id,
		Title:     "Test Wiki",
	}
	wiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, appErr)

	t.Run("create page successfully", func(t *testing.T) {
		page, resp, err := th.Client.CreatePage(context.Background(), wiki.Id, "", "New Test Page")
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotNil(t, page)
		require.Equal(t, model.PostTypePage, page.Type)
		require.Equal(t, "New Test Page", page.GetProps()["title"])
	})

	t.Run("create page with parent", func(t *testing.T) {
		parentPage, _, err := th.Client.CreatePage(context.Background(), wiki.Id, "", "Parent Page")
		require.NoError(t, err)

		childPage, resp, err := th.Client.CreatePage(context.Background(), wiki.Id, parentPage.Id, "Child Page")
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.Equal(t, parentPage.Id, childPage.PageParentId)
	})

	t.Run("fail without create permission", func(t *testing.T) {
		th.RemovePermissionFromRole(t, model.PermissionCreatePage.Id, model.ChannelUserRoleId)
		defer th.AddPermissionToRole(t, model.PermissionCreatePage.Id, model.ChannelUserRoleId)

		_, resp, err := th.Client.CreatePage(context.Background(), wiki.Id, "", "Should Fail")
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("fail for non-existent wiki", func(t *testing.T) {
		_, resp, err := th.Client.CreatePage(context.Background(), model.NewId(), "", "Should Fail")
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("fail for user not in channel", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t)
		privateWiki := &model.Wiki{
			ChannelId: privateChannel.Id,
			Title:     "Private Wiki",
		}
		privateWiki, appErr := th.App.CreateWiki(th.Context, privateWiki, th.BasicUser.Id)
		require.Nil(t, appErr)

		client2 := th.CreateClient()
		_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
		require.NoError(t, lErr)

		_, resp, err := client2.CreatePage(context.Background(), privateWiki.Id, "", "Should Fail")
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})
}

func TestUpdatePage(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.AddPermissionToRole(t, model.PermissionCreatePage.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionReadPage.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionEditPage.Id, model.ChannelUserRoleId)

	th.Context.Session().UserId = th.BasicUser.Id

	wiki := &model.Wiki{
		ChannelId: th.BasicChannel.Id,
		Title:     "Test Wiki",
	}
	wiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, appErr)

	t.Run("update page title successfully", func(t *testing.T) {
		page, _, err := th.Client.CreatePage(context.Background(), wiki.Id, "", "Original Title")
		require.NoError(t, err)

		updatedPage, resp, err := th.Client.UpdatePage(context.Background(), wiki.Id, page.Id, "Updated Title", "", "", 0)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Equal(t, "Updated Title", updatedPage.GetProps()["title"])
	})

	t.Run("update page content successfully", func(t *testing.T) {
		page, _, err := th.Client.CreatePage(context.Background(), wiki.Id, "", "Test Page")
		require.NoError(t, err)

		contentJSON := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Updated content"}]}]}`
		updatedPage, resp, err := th.Client.UpdatePage(context.Background(), wiki.Id, page.Id, "", contentJSON, "Updated content", 0)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotNil(t, updatedPage)
	})

	t.Run("fail without edit permission", func(t *testing.T) {
		page, _, err := th.Client.CreatePage(context.Background(), wiki.Id, "", "Test Page")
		require.NoError(t, err)

		th.RemovePermissionFromRole(t, model.PermissionEditPage.Id, model.ChannelUserRoleId)
		defer th.AddPermissionToRole(t, model.PermissionEditPage.Id, model.ChannelUserRoleId)

		_, resp, err := th.Client.UpdatePage(context.Background(), wiki.Id, page.Id, "Should Fail", "", "", 0)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("fail for non-existent page", func(t *testing.T) {
		_, resp, err := th.Client.UpdatePage(context.Background(), wiki.Id, model.NewId(), "Should Fail", "", "", 0)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("fail for deleted page", func(t *testing.T) {
		page, _, err := th.Client.CreatePage(context.Background(), wiki.Id, "", "Page to Delete")
		require.NoError(t, err)

		th.AddPermissionToRole(t, model.PermissionDeletePage.Id, model.ChannelUserRoleId)
		_, err = th.Client.DeletePage(context.Background(), wiki.Id, page.Id)
		require.NoError(t, err)

		_, resp, err := th.Client.UpdatePage(context.Background(), wiki.Id, page.Id, "Should Fail", "", "", 0)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})
}

func TestDeletePage(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.AddPermissionToRole(t, model.PermissionCreatePage.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionReadPage.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionDeletePage.Id, model.ChannelUserRoleId)

	th.Context.Session().UserId = th.BasicUser.Id

	wiki := &model.Wiki{
		ChannelId: th.BasicChannel.Id,
		Title:     "Test Wiki",
	}
	wiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, appErr)

	t.Run("delete page successfully", func(t *testing.T) {
		page, _, err := th.Client.CreatePage(context.Background(), wiki.Id, "", "Page to Delete")
		require.NoError(t, err)

		resp, err := th.Client.DeletePage(context.Background(), wiki.Id, page.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		// Verify page is deleted
		_, resp, err = th.Client.GetPage(context.Background(), wiki.Id, page.Id)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("delete page with children", func(t *testing.T) {
		parentPage, _, err := th.Client.CreatePage(context.Background(), wiki.Id, "", "Parent Page")
		require.NoError(t, err)

		childPage, _, err := th.Client.CreatePage(context.Background(), wiki.Id, parentPage.Id, "Child Page")
		require.NoError(t, err)

		resp, err := th.Client.DeletePage(context.Background(), wiki.Id, parentPage.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		// Verify parent is deleted
		_, resp, err = th.Client.GetPage(context.Background(), wiki.Id, parentPage.Id)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)

		// Verify child still exists (cascade delete behavior)
		_, resp, err = th.Client.GetPage(context.Background(), wiki.Id, childPage.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
	})

	t.Run("fail without delete permission", func(t *testing.T) {
		page, _, err := th.Client.CreatePage(context.Background(), wiki.Id, "", "Test Page")
		require.NoError(t, err)

		// Remove both delete permissions - user can't delete any page, including their own
		th.RemovePermissionFromRole(t, model.PermissionDeletePage.Id, model.ChannelUserRoleId)
		th.RemovePermissionFromRole(t, model.PermissionDeleteOwnPage.Id, model.ChannelUserRoleId)
		defer th.AddPermissionToRole(t, model.PermissionDeletePage.Id, model.ChannelUserRoleId)
		defer th.AddPermissionToRole(t, model.PermissionDeleteOwnPage.Id, model.ChannelUserRoleId)

		resp, err := th.Client.DeletePage(context.Background(), wiki.Id, page.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("fail for non-existent page", func(t *testing.T) {
		resp, err := th.Client.DeletePage(context.Background(), wiki.Id, model.NewId())
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("fail for already deleted page", func(t *testing.T) {
		page, _, err := th.Client.CreatePage(context.Background(), wiki.Id, "", "Page to Delete Twice")
		require.NoError(t, err)

		_, err = th.Client.DeletePage(context.Background(), wiki.Id, page.Id)
		require.NoError(t, err)

		resp, err := th.Client.DeletePage(context.Background(), wiki.Id, page.Id)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})
}

func TestRestorePage(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.AddPermissionToRole(t, model.PermissionCreatePage.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionReadPage.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionDeletePage.Id, model.ChannelUserRoleId)

	th.Context.Session().UserId = th.BasicUser.Id

	wiki := &model.Wiki{
		ChannelId: th.BasicChannel.Id,
		Title:     "Test Wiki",
	}
	wiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, appErr)

	t.Run("restore deleted page successfully", func(t *testing.T) {
		page, _, err := th.Client.CreatePage(context.Background(), wiki.Id, "", "Page to Restore")
		require.NoError(t, err)

		// Delete the page
		_, err = th.Client.DeletePage(context.Background(), wiki.Id, page.Id)
		require.NoError(t, err)

		// Verify page is deleted
		_, resp, err := th.Client.GetPage(context.Background(), wiki.Id, page.Id)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)

		// Restore the page
		resp, err = th.Client.RestorePage(context.Background(), wiki.Id, page.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		// Verify page is restored
		restoredPage, resp, err := th.Client.GetPage(context.Background(), wiki.Id, page.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Equal(t, page.Id, restoredPage.Id)
	})

	t.Run("fail without delete permission", func(t *testing.T) {
		page, _, err := th.Client.CreatePage(context.Background(), wiki.Id, "", "Test Page")
		require.NoError(t, err)

		// Delete the page
		_, err = th.Client.DeletePage(context.Background(), wiki.Id, page.Id)
		require.NoError(t, err)

		// Remove delete permission
		th.RemovePermissionFromRole(t, model.PermissionDeletePage.Id, model.ChannelUserRoleId)
		th.RemovePermissionFromRole(t, model.PermissionDeleteOwnPage.Id, model.ChannelUserRoleId)
		defer th.AddPermissionToRole(t, model.PermissionDeletePage.Id, model.ChannelUserRoleId)
		defer th.AddPermissionToRole(t, model.PermissionDeleteOwnPage.Id, model.ChannelUserRoleId)

		// Try to restore without permission
		resp, err := th.Client.RestorePage(context.Background(), wiki.Id, page.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("fail for non-existent page", func(t *testing.T) {
		resp, err := th.Client.RestorePage(context.Background(), wiki.Id, model.NewId())
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("fail for non-deleted page", func(t *testing.T) {
		page, _, err := th.Client.CreatePage(context.Background(), wiki.Id, "", "Active Page")
		require.NoError(t, err)

		// Try to restore an active page
		resp, err := th.Client.RestorePage(context.Background(), wiki.Id, page.Id)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})
}

func TestGetWikiPage(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.AddPermissionToRole(t, model.PermissionCreatePage.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionReadPage.Id, model.ChannelUserRoleId)

	th.Context.Session().UserId = th.BasicUser.Id

	wiki := &model.Wiki{
		ChannelId: th.BasicChannel.Id,
		Title:     "Test Wiki",
	}
	wiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, appErr)

	t.Run("get page successfully", func(t *testing.T) {
		page, _, err := th.Client.CreatePage(context.Background(), wiki.Id, "", "Test Page")
		require.NoError(t, err)

		retrievedPage, resp, err := th.Client.GetPage(context.Background(), wiki.Id, page.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Equal(t, page.Id, retrievedPage.Id)
	})

	t.Run("fail for non-existent page", func(t *testing.T) {
		_, resp, err := th.Client.GetPage(context.Background(), wiki.Id, model.NewId())
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("fail without read permission", func(t *testing.T) {
		page, _, err := th.Client.CreatePage(context.Background(), wiki.Id, "", "Test Page")
		require.NoError(t, err)

		th.RemovePermissionFromRole(t, model.PermissionReadPage.Id, model.ChannelUserRoleId)
		defer th.AddPermissionToRole(t, model.PermissionReadPage.Id, model.ChannelUserRoleId)

		_, resp, err := th.Client.GetPage(context.Background(), wiki.Id, page.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("fail for user not in channel", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t)
		privateWiki := &model.Wiki{
			ChannelId: privateChannel.Id,
			Title:     "Private Wiki",
		}
		privateWiki, appErr := th.App.CreateWiki(th.Context, privateWiki, th.BasicUser.Id)
		require.Nil(t, appErr)

		privatePage, appErr := th.App.CreateWikiPage(th.Context, privateWiki.Id, "", "Private Page", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		client2 := th.CreateClient()
		_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
		require.NoError(t, lErr)

		_, resp, err := client2.GetPage(context.Background(), privateWiki.Id, privatePage.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})
}

func TestGetPageComments(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.AddPermissionToRole(t, model.PermissionCreatePage.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionReadPage.Id, model.ChannelUserRoleId)

	th.Context.Session().UserId = th.BasicUser.Id

	wiki := &model.Wiki{
		ChannelId: th.BasicChannel.Id,
		Title:     "Test Wiki",
	}
	wiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, appErr)

	page, _, err := th.Client.CreatePage(context.Background(), wiki.Id, "", "Test Page")
	require.NoError(t, err)

	t.Run("get comments for page with no comments", func(t *testing.T) {
		comments, resp, err := th.Client.GetPageComments(context.Background(), wiki.Id, page.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Empty(t, comments)
	})

	t.Run("get comments for page with comments", func(t *testing.T) {
		// Create comments
		_, _, err := th.Client.CreatePageComment(context.Background(), wiki.Id, page.Id, "Test comment 1")
		require.NoError(t, err)
		_, _, err = th.Client.CreatePageComment(context.Background(), wiki.Id, page.Id, "Test comment 2")
		require.NoError(t, err)

		comments, resp, err := th.Client.GetPageComments(context.Background(), wiki.Id, page.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, comments, 2)
	})

	t.Run("fail without read permission", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t)
		th.Context.Session().UserId = th.BasicUser.Id

		privateWiki := &model.Wiki{
			ChannelId: privateChannel.Id,
			Title:     "Private Wiki",
		}
		privateWiki, appErr := th.App.CreateWiki(th.Context, privateWiki, th.BasicUser.Id)
		require.Nil(t, appErr)

		privatePage, appErr := th.App.CreateWikiPage(th.Context, privateWiki.Id, "", "Private Page", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		client2 := th.CreateClient()
		_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
		require.NoError(t, lErr)

		_, resp, err := client2.GetPageComments(context.Background(), privateWiki.Id, privatePage.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("fail for non-existent page", func(t *testing.T) {
		_, resp, err := th.Client.GetPageComments(context.Background(), wiki.Id, model.NewId())
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})
}
