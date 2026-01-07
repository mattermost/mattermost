// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/stretchr/testify/require"
)

func TestCreatePageWithContent(t *testing.T) {
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	t.Run("creates page with empty content", func(t *testing.T) {
		page, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Test Page", "", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)
		require.NotNil(t, page)
		require.Equal(t, model.PostTypePage, page.Type)
		require.Equal(t, th.BasicChannel.Id, page.ChannelId)
		require.Equal(t, "Test Page", page.Props["title"])
		require.NotEmpty(t, page.Id)

		pageContent, contentErr := th.App.Srv().Store().Page().GetPageContent(page.Id)
		require.NoError(t, contentErr)
		require.NotNil(t, pageContent)
		require.Equal(t, page.Id, pageContent.PageId)
	})

	t.Run("creates page with JSON content", func(t *testing.T) {
		validContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Test content"}]}]}`
		page, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Test Page", "", validContent, th.BasicUser.Id, "", "")
		require.Nil(t, err)
		require.NotNil(t, page)

		pageContent, contentErr := th.App.Srv().Store().Page().GetPageContent(page.Id)
		require.NoError(t, contentErr)
		require.NotNil(t, pageContent)

		jsonContent, jsonErr := pageContent.GetDocumentJSON()
		require.NoError(t, jsonErr)
		require.Contains(t, jsonContent, "Test content")
	})

	t.Run("creates child page with parent", func(t *testing.T) {
		parentPage, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Parent Page", "", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		childPage, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Child Page", parentPage.Id, "", th.BasicUser.Id, "", "")
		require.Nil(t, err)
		require.NotNil(t, childPage)
		require.Equal(t, parentPage.Id, childPage.PageParentId)
	})

	t.Run("fails with invalid JSON content", func(t *testing.T) {
		invalidContent := `{"invalid json`
		page, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Test Page", "", invalidContent, th.BasicUser.Id, "", "")
		require.NotNil(t, err)
		require.Nil(t, page)
		require.Equal(t, "app.page.create.invalid_content.app_error", err.Id)
	})

	t.Run("fails when parent is not a page", func(t *testing.T) {
		regularPost, postErr := th.App.CreatePost(th.Context, &model.Post{
			ChannelId: th.BasicChannel.Id,
			UserId:    th.BasicUser.Id,
			Message:   "Regular post",
		}, th.BasicChannel, model.CreatePostFlags{})
		require.Nil(t, postErr)

		page, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Test Page", regularPost.Id, "", th.BasicUser.Id, "", "")
		require.NotNil(t, err)
		require.Nil(t, page)
		require.Equal(t, "app.page.create.invalid_parent.app_error", err.Id)
	})

	t.Run("fails when parent is in different channel", func(t *testing.T) {
		otherChannel, chanErr := th.App.CreateChannel(th.Context, &model.Channel{
			TeamId:      th.BasicTeam.Id,
			Name:        "other-channel",
			DisplayName: "Other Channel",
			Type:        model.ChannelTypeOpen,
		}, false)
		require.Nil(t, chanErr)

		_, addErr := th.App.AddUserToChannel(th.Context, th.BasicUser, otherChannel, false)
		require.Nil(t, addErr)

		parentPageInOtherChannel, parentErr := th.App.CreatePage(th.Context, otherChannel.Id, "Parent in Other Channel", "", "", th.BasicUser.Id, "", "")
		require.Nil(t, parentErr)

		page, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Child Page", parentPageInOtherChannel.Id, "", th.BasicUser.Id, "", "")
		require.NotNil(t, err)
		require.Nil(t, page)
		require.Equal(t, "app.page.create.parent_different_channel.app_error", err.Id)
	})

	t.Run("sanitizes unicode in page title", func(t *testing.T) {
		// Title with BIDI control characters that should be stripped
		titleWithBIDI := "Test\u202APage\u202BTitle"
		page, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, titleWithBIDI, "", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)
		require.NotNil(t, page)
		require.Equal(t, "TestPageTitle", page.Props["title"], "BIDI characters should be stripped from title")
	})

	t.Run("fails with empty title", func(t *testing.T) {
		page, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "", "", "", th.BasicUser.Id, "", "")
		require.NotNil(t, err)
		require.Nil(t, page)
		require.Equal(t, "app.page.create.missing_title.app_error", err.Id)
	})

	t.Run("fails with whitespace only title", func(t *testing.T) {
		page, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "   ", "", "", th.BasicUser.Id, "", "")
		require.NotNil(t, err)
		require.Nil(t, page)
		require.Equal(t, "app.page.create.missing_title.app_error", err.Id)
	})

	t.Run("fails with title too long", func(t *testing.T) {
		longTitle := strings.Repeat("a", model.MaxPageTitleLength+1)
		page, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, longTitle, "", "", th.BasicUser.Id, "", "")
		require.NotNil(t, err)
		require.Nil(t, page)
		require.Equal(t, "app.page.create.title_too_long.app_error", err.Id)
	})

	t.Run("fails with invalid channel", func(t *testing.T) {
		page, err := th.App.CreatePage(th.Context, model.NewId(), "Test Page", "", "", th.BasicUser.Id, "", "")
		require.NotNil(t, err)
		require.Nil(t, page)
	})

	t.Run("fails with deleted channel", func(t *testing.T) {
		deletedChannel, chanErr := th.App.CreateChannel(th.Context, &model.Channel{
			TeamId:      th.BasicTeam.Id,
			Name:        "deleted-channel-test",
			DisplayName: "Deleted Channel Test",
			Type:        model.ChannelTypeOpen,
		}, false)
		require.Nil(t, chanErr)

		deleteErr := th.App.DeleteChannel(th.Context, deletedChannel, th.BasicUser.Id)
		require.Nil(t, deleteErr)

		page, err := th.App.CreatePage(th.Context, deletedChannel.Id, "Test Page", "", "", th.BasicUser.Id, "", "")
		require.NotNil(t, err)
		require.Nil(t, page)
		require.Equal(t, "app.page.create.deleted_channel.app_error", err.Id)
	})

	t.Run("creates page with custom ID", func(t *testing.T) {
		customId := model.NewId()
		page, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Custom ID Page", "", "", th.BasicUser.Id, "", customId)
		require.Nil(t, err)
		require.NotNil(t, page)
		require.Equal(t, customId, page.Id)
	})
}

func TestGetPageWithContent(t *testing.T) {
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	sessionCtx := th.CreateSessionContext()

	t.Run("successfully retrieves page with content", func(t *testing.T) {
		validContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Test content"}]}]}`
		createdPage, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Test Page", "", validContent, th.BasicUser.Id, "", "")
		require.Nil(t, err)

		retrievedPage, err := th.App.GetPageWithContent(sessionCtx, createdPage.Id)
		require.Nil(t, err)
		require.NotNil(t, retrievedPage)
		require.Equal(t, createdPage.Id, retrievedPage.Id)
		require.Contains(t, retrievedPage.Message, "Test content")
	})

	t.Run("fails for non-existent page", func(t *testing.T) {
		page, err := th.App.GetPageWithContent(sessionCtx, model.NewId())
		require.NotNil(t, err)
		require.Nil(t, page)
	})

	t.Run("fails for regular post", func(t *testing.T) {
		regularPost, postErr := th.App.CreatePost(th.Context, &model.Post{
			ChannelId: th.BasicChannel.Id,
			UserId:    th.BasicUser.Id,
			Message:   "Regular post",
		}, th.BasicChannel, model.CreatePostFlags{})
		require.Nil(t, postErr)

		page, err := th.App.GetPageWithContent(sessionCtx, regularPost.Id)
		require.NotNil(t, err)
		require.Nil(t, page)
		require.Equal(t, "app.page.get.not_a_page.app_error", err.Id)
	})
}

func TestUpdatePage(t *testing.T) {
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	sessionCtx := th.CreateSessionContext()

	t.Run("successfully updates page title and content", func(t *testing.T) {
		createdPage, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Original Title", "", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		page, err := th.App.GetPage(sessionCtx, createdPage.Id)
		require.Nil(t, err)

		newContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Updated content"}]}]}`
		updatedPage, err := th.App.UpdatePage(sessionCtx, page, "Updated Title", newContent, "")
		require.Nil(t, err)
		require.NotNil(t, updatedPage)
		require.Equal(t, "Updated Title", updatedPage.Props["title"])

		pageContent, contentErr := th.App.Srv().Store().Page().GetPageContent(updatedPage.Id)
		require.NoError(t, contentErr)
		jsonContent, jsonErr := pageContent.GetDocumentJSON()
		require.NoError(t, jsonErr)
		require.Contains(t, jsonContent, "Updated content")
	})

	t.Run("fails with invalid JSON content", func(t *testing.T) {
		createdPage, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Test Page", "", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		page, err := th.App.GetPage(sessionCtx, createdPage.Id)
		require.Nil(t, err)

		invalidContent := `{"invalid json`
		updatedPage, err := th.App.UpdatePage(sessionCtx, page, "Test Page", invalidContent, "")
		require.NotNil(t, err)
		require.Nil(t, updatedPage)
		require.Equal(t, "app.page.update.invalid_content.app_error", err.Id)
	})

	t.Run("fails for non-existent page", func(t *testing.T) {
		page, err := th.App.GetPage(sessionCtx, model.NewId())
		require.NotNil(t, err)
		require.Nil(t, page)
	})

	t.Run("sanitizes unicode in updated page title", func(t *testing.T) {
		createdPage, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Original Title", "", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		page, err := th.App.GetPage(sessionCtx, createdPage.Id)
		require.Nil(t, err)

		// Title with BIDI control characters that should be stripped
		titleWithBIDI := "Updated\u202ATitle\u202B"
		updatedPage, err := th.App.UpdatePage(sessionCtx, page, titleWithBIDI, "", "")
		require.Nil(t, err)
		require.NotNil(t, updatedPage)
		require.Equal(t, "UpdatedTitle", updatedPage.Props["title"], "BIDI characters should be stripped from title")
	})
}

func TestDeletePage(t *testing.T) {
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	sessionCtx := th.CreateSessionContext()

	t.Run("successfully deletes page and its content", func(t *testing.T) {
		createdPage, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Test Page", "", `{"type":"doc","content":[{"type":"paragraph"}]}`, th.BasicUser.Id, "", "")
		require.Nil(t, err)

		pageContent, getErr := th.App.Srv().Store().Page().GetPageContent(createdPage.Id)
		require.NoError(t, getErr)
		require.NotNil(t, pageContent, "PageContent should exist before deletion")

		page, err := th.App.GetPage(sessionCtx, createdPage.Id)
		require.Nil(t, err)

		err = th.App.DeletePage(sessionCtx, page, "")
		require.Nil(t, err)

		deletedPage, getErr := th.App.Srv().Store().Post().GetSingle(th.Context, createdPage.Id, true)
		require.NoError(t, getErr)
		require.NotNil(t, deletedPage)
		require.NotEqual(t, int64(0), deletedPage.DeleteAt, "Post should be soft-deleted")

		_, getContentErr := th.App.Srv().Store().Page().GetPageContent(createdPage.Id)
		require.Error(t, getContentErr, "PageContent should be deleted")
		var nfErr *store.ErrNotFound
		require.ErrorAs(t, getContentErr, &nfErr, "Should return NotFound error for deleted PageContent")
	})

	t.Run("fails for non-existent page", func(t *testing.T) {
		page, err := th.App.GetPage(sessionCtx, model.NewId())
		require.NotNil(t, err)
		require.Nil(t, page)
	})

	t.Run("deleting root page reparents children to become root pages", func(t *testing.T) {
		parent, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Parent Page", "", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		child1, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Child 1", parent.Id, "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		child2, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Child 2", parent.Id, "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		grandchild, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Grandchild", child1.Id, "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		parentPage, err := th.App.GetPage(sessionCtx, parent.Id)
		require.Nil(t, err)
		err = th.App.DeletePage(sessionCtx, parentPage, "")
		require.Nil(t, err)

		child1After, err := th.App.GetSinglePost(th.Context, child1.Id, false)
		require.Nil(t, err)
		require.Empty(t, child1After.PageParentId, "Child1 should become root page after parent deletion")

		child2After, err := th.App.GetSinglePost(th.Context, child2.Id, false)
		require.Nil(t, err)
		require.Empty(t, child2After.PageParentId, "Child2 should become root page after parent deletion")

		grandchildAfter, err := th.App.GetSinglePost(th.Context, grandchild.Id, false)
		require.Nil(t, err)
		require.Equal(t, child1.Id, grandchildAfter.PageParentId, "Grandchild should still reference child1 (unaffected)")
	})

	t.Run("deleting middle page reparents direct children to grandparent", func(t *testing.T) {
		root, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Root", "", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		middle, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Middle", root.Id, "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		leaf, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Leaf", middle.Id, "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		middlePage, err := th.App.GetPage(sessionCtx, middle.Id)
		require.Nil(t, err)
		err = th.App.DeletePage(sessionCtx, middlePage, "")
		require.Nil(t, err)

		rootAfter, err := th.App.GetSinglePost(th.Context, root.Id, false)
		require.Nil(t, err)
		require.Empty(t, rootAfter.PageParentId, "Root should remain a root page")

		leafAfter, err := th.App.GetSinglePost(th.Context, leaf.Id, false)
		require.Nil(t, err)
		require.Equal(t, root.Id, leafAfter.PageParentId, "Leaf should be reparented to root (grandparent)")
	})

	t.Run("GetPageChildren fails for deleted parent", func(t *testing.T) {
		parent, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Parent to Delete", "", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		child, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Child", parent.Id, "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		parentPage, err := th.App.GetPage(sessionCtx, parent.Id)
		require.Nil(t, err)
		err = th.App.DeletePage(sessionCtx, parentPage, "")
		require.Nil(t, err)

		_, err = th.App.GetPageChildren(sessionCtx, parent.Id, model.GetPostsOptions{})
		require.NotNil(t, err, "GetPageChildren should fail for deleted parent")

		childAfter, err := th.App.GetSinglePost(th.Context, child.Id, false)
		require.Nil(t, err)
		require.Empty(t, childAfter.PageParentId, "Child should be reparented to root after parent deletion")
	})
}

func TestRestorePage(t *testing.T) {
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	sessionCtx := th.CreateSessionContext()

	t.Run("successfully restores deleted page with content", func(t *testing.T) {
		pageContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Test content that should be preserved"}]}]}`
		createdPage, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Test Page", "", pageContent, th.BasicUser.Id, "searchable text", "")
		require.Nil(t, err)

		originalContent, getErr := th.App.Srv().Store().Page().GetPageContent(createdPage.Id)
		require.NoError(t, getErr)
		require.NotNil(t, originalContent)

		page, err := th.App.GetPage(sessionCtx, createdPage.Id)
		require.Nil(t, err)
		err = th.App.DeletePage(sessionCtx, page, "")
		require.Nil(t, err)

		deletedPage, getErr := th.App.Srv().Store().Post().GetSingle(th.Context, createdPage.Id, true)
		require.NoError(t, getErr)
		require.NotEqual(t, int64(0), deletedPage.DeleteAt, "Post should be soft-deleted")

		_, getContentErr := th.App.Srv().Store().Page().GetPageContent(createdPage.Id)
		require.Error(t, getContentErr, "Get() should not return soft-deleted PageContent")

		deletedContent, getErr := th.App.Srv().Store().Page().GetPageContentWithDeleted(createdPage.Id)
		require.NoError(t, getErr, "GetWithDeleted() should return soft-deleted PageContent")
		require.NotNil(t, deletedContent)
		require.NotEqual(t, int64(0), deletedContent.DeleteAt, "PageContent should have DeleteAt set")

		deletedPageWrapper, err := th.App.GetPageWithDeleted(sessionCtx, createdPage.Id)
		require.Nil(t, err)
		err = th.App.RestorePage(sessionCtx, deletedPageWrapper)
		require.Nil(t, err, "RestorePage should not return an error")

		restoredPost, getErr := th.App.Srv().Store().Post().GetSingle(th.Context, createdPage.Id, false)
		require.NoError(t, getErr, "Direct store GetSingle should not return an error after restoration")
		require.NotNil(t, restoredPost, "restoredPost should not be nil")
		require.Equal(t, int64(0), restoredPost.DeleteAt, "Post should be restored (DeleteAt = 0)")

		restoredContent, getErr := th.App.Srv().Store().Page().GetPageContent(createdPage.Id)
		require.NoError(t, getErr, "PageContent should be accessible after restoration")
		require.NotNil(t, restoredContent)
		require.Equal(t, int64(0), restoredContent.DeleteAt, "PageContent DeleteAt should be cleared")

		restoredJSON, jsonErr := restoredContent.GetDocumentJSON()
		require.NoError(t, jsonErr)
		require.JSONEq(t, pageContent, restoredJSON, "Page content should be preserved after restoration")
		require.NotEmpty(t, restoredContent.SearchText, "SearchText should be populated after restoration")
	})

	t.Run("cannot get non-existent page for restoration", func(t *testing.T) {
		// With the type-safe Page wrapper, you can't call RestorePage without first
		// getting a valid *Page. This test verifies the entry point fails for non-existent pages.
		_, err := th.App.GetPageWithDeleted(sessionCtx, model.NewId())
		require.NotNil(t, err, "GetPageWithDeleted should fail for non-existent page")
	})

	t.Run("fails to restore already active page", func(t *testing.T) {
		activePage, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Active Page", "", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		page, err := th.App.GetPage(sessionCtx, activePage.Id)
		require.Nil(t, err)
		err = th.App.RestorePage(sessionCtx, page)
		require.NotNil(t, err, "Should fail to restore page that is not deleted")
	})
}

func TestPermanentDeletePage(t *testing.T) {
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	sessionCtx := th.CreateSessionContext()

	t.Run("permanently deletes page and content", func(t *testing.T) {
		pageContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Content to be permanently deleted"}]}]}`
		createdPage, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Page to Purge", "", pageContent, th.BasicUser.Id, "", "")
		require.Nil(t, err)

		page, err := th.App.GetPage(sessionCtx, createdPage.Id)
		require.Nil(t, err)
		err = th.App.DeletePage(sessionCtx, page, "")
		require.Nil(t, err)

		deletedContent, getErr := th.App.Srv().Store().Page().GetPageContentWithDeleted(createdPage.Id)
		require.NoError(t, getErr, "Content should still exist after soft delete")
		require.NotNil(t, deletedContent)

		deletedPage, err := th.App.GetPageWithDeleted(sessionCtx, createdPage.Id)
		require.Nil(t, err)
		err = th.App.PermanentDeletePage(sessionCtx, deletedPage)
		require.Nil(t, err)

		_, getErr = th.App.Srv().Store().Post().GetSingle(th.Context, createdPage.Id, true)
		require.Error(t, getErr, "Post should be permanently deleted")

		_, getErr = th.App.Srv().Store().Page().GetPageContentWithDeleted(createdPage.Id)
		require.Error(t, getErr, "PageContent should be permanently deleted")
	})

	t.Run("cannot get non-existent page for permanent deletion", func(t *testing.T) {
		// With the type-safe Page wrapper, you can't call PermanentDeletePage without first
		// getting a valid *Page. This test verifies the entry point fails for non-existent pages.
		_, err := th.App.GetPageWithDeleted(sessionCtx, model.NewId())
		require.NotNil(t, err, "GetPageWithDeleted should fail for non-existent page")
	})
}

func TestGetPageChildren(t *testing.T) {
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	sessionCtx := th.CreateSessionContext()

	t.Run("retrieves all child pages", func(t *testing.T) {
		parentPage, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Parent Page", "", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		child1, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Child 1", parentPage.Id, "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		child2, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Child 2", parentPage.Id, "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		children, err := th.App.GetPageChildren(sessionCtx, parentPage.Id, model.GetPostsOptions{})
		require.Nil(t, err)
		require.NotNil(t, children)
		require.Len(t, children.Posts, 2)
		require.Contains(t, children.Posts, child1.Id)
		require.Contains(t, children.Posts, child2.Id)
	})

	t.Run("returns empty list for page with no children", func(t *testing.T) {
		page, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Page No Children", "", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		children, err := th.App.GetPageChildren(sessionCtx, page.Id, model.GetPostsOptions{})
		require.Nil(t, err)
		require.NotNil(t, children)
		require.Len(t, children.Posts, 0)
	})
}

func TestGetPageAncestors(t *testing.T) {
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	sessionCtx := th.CreateSessionContext()

	t.Run("retrieves all ancestors in order", func(t *testing.T) {
		grandparent, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Grandparent", "", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		parent, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Parent", grandparent.Id, "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		child, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Child", parent.Id, "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		ancestors, err := th.App.GetPageAncestors(sessionCtx, child.Id)
		require.Nil(t, err)
		require.NotNil(t, ancestors)
		require.Len(t, ancestors.Posts, 2)
		require.Contains(t, ancestors.Posts, parent.Id)
		require.Contains(t, ancestors.Posts, grandparent.Id)
	})

	t.Run("returns empty list for root page", func(t *testing.T) {
		rootPage, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Root Page", "", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		ancestors, err := th.App.GetPageAncestors(sessionCtx, rootPage.Id)
		require.Nil(t, err)
		require.NotNil(t, ancestors)
		require.Len(t, ancestors.Posts, 0)
	})
}

func TestGetPageDescendants(t *testing.T) {
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	sessionCtx := th.CreateSessionContext()

	t.Run("retrieves all descendants recursively", func(t *testing.T) {
		root, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Root", "", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		child1, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Child 1", root.Id, "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		child2, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Child 2", root.Id, "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		grandchild, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Grandchild", child1.Id, "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		descendants, err := th.App.GetPageDescendants(sessionCtx, root.Id)
		require.Nil(t, err)
		require.NotNil(t, descendants)
		require.Len(t, descendants.Posts, 3)
		require.Contains(t, descendants.Posts, child1.Id)
		require.Contains(t, descendants.Posts, child2.Id)
		require.Contains(t, descendants.Posts, grandchild.Id)
	})
}

func TestGetChannelPages(t *testing.T) {
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	sessionCtx := th.CreateSessionContext()

	t.Run("retrieves all pages in channel", func(t *testing.T) {
		page1, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Page 1", "", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		page2, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Page 2", "", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		pages, err := th.App.GetChannelPages(sessionCtx, th.BasicChannel.Id)
		require.Nil(t, err)
		require.NotNil(t, pages)
		require.GreaterOrEqual(t, len(pages.Posts), 2)
		require.Contains(t, pages.Posts, page1.Id)
		require.Contains(t, pages.Posts, page2.Id)
	})

	t.Run("returns empty list for channel with no pages", func(t *testing.T) {
		emptyChannel, chanErr := th.App.CreateChannel(th.Context, &model.Channel{
			TeamId:      th.BasicTeam.Id,
			Name:        "empty-channel",
			DisplayName: "Empty Channel",
			Type:        model.ChannelTypeOpen,
		}, false)
		require.Nil(t, chanErr)

		_, addErr := th.App.AddUserToChannel(th.Context, th.BasicUser, emptyChannel, false)
		require.Nil(t, addErr)

		pages, err := th.App.GetChannelPages(sessionCtx, emptyChannel.Id)
		require.Nil(t, err)
		require.NotNil(t, pages)
		require.Len(t, pages.Posts, 0)
	})
}

func TestChangePageParent(t *testing.T) {
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()
	th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)

	sessionCtx := th.CreateSessionContext()

	// Create a wiki for the basic channel
	wiki, wikiErr := th.App.CreateWiki(th.Context, &model.Wiki{
		ChannelId: th.BasicChannel.Id,
		Title:     "Test Wiki",
	}, th.BasicUser.Id)
	require.Nil(t, wikiErr)

	t.Run("successfully changes page parent", func(t *testing.T) {
		newParent, err := th.App.CreateWikiPage(th.Context, wiki.Id, "", "New Parent", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		child, err := th.App.CreateWikiPage(th.Context, wiki.Id, "", "Child", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		err = th.App.ChangePageParent(sessionCtx, child.Id, newParent.Id)
		require.Nil(t, err)

		updatedChild, getErr := th.App.Srv().Store().Post().GetSingle(th.Context, child.Id, false)
		require.NoError(t, getErr)
		require.Equal(t, newParent.Id, updatedChild.PageParentId)
	})

	t.Run("successfully makes page a root page", func(t *testing.T) {
		parent, err := th.App.CreateWikiPage(th.Context, wiki.Id, "", "Parent", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		child, err := th.App.CreateWikiPage(th.Context, wiki.Id, parent.Id, "Child", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		err = th.App.ChangePageParent(sessionCtx, child.Id, "")
		require.Nil(t, err)

		updatedChild, getErr := th.App.Srv().Store().Post().GetSingle(th.Context, child.Id, false)
		require.NoError(t, getErr)
		require.Empty(t, updatedChild.PageParentId)
	})

	t.Run("fails when creating circular reference", func(t *testing.T) {
		parent, err := th.App.CreateWikiPage(th.Context, wiki.Id, "", "Parent", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		child, err := th.App.CreateWikiPage(th.Context, wiki.Id, parent.Id, "Child", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		err = th.App.ChangePageParent(sessionCtx, parent.Id, child.Id)
		require.NotNil(t, err)
		require.Equal(t, "app.page.change_parent.circular_reference.app_error", err.Id)
	})

	t.Run("fails when setting page as its own parent (direct cycle)", func(t *testing.T) {
		page, err := th.App.CreateWikiPage(th.Context, wiki.Id, "", "Page", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		err = th.App.ChangePageParent(sessionCtx, page.Id, page.Id)
		require.NotNil(t, err)
		require.Equal(t, "app.page.change_parent.circular_reference.app_error", err.Id)
	})

	t.Run("fails when creating multi-level circular reference (A→B→C→A)", func(t *testing.T) {
		pageA, err := th.App.CreateWikiPage(th.Context, wiki.Id, "", "Page A", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		pageB, err := th.App.CreateWikiPage(th.Context, wiki.Id, pageA.Id, "Page B", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		pageC, err := th.App.CreateWikiPage(th.Context, wiki.Id, pageB.Id, "Page C", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		err = th.App.ChangePageParent(sessionCtx, pageA.Id, pageC.Id)
		require.NotNil(t, err)
		require.Equal(t, "app.page.change_parent.circular_reference.app_error", err.Id)
	})

	t.Run("fails when new parent is not a page", func(t *testing.T) {
		child, err := th.App.CreateWikiPage(th.Context, wiki.Id, "", "Child", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		regularPost, postErr := th.App.CreatePost(th.Context, &model.Post{
			ChannelId: th.BasicChannel.Id,
			UserId:    th.BasicUser.Id,
			Message:   "Regular post",
		}, th.BasicChannel, model.CreatePostFlags{})
		require.Nil(t, postErr)

		err = th.App.ChangePageParent(sessionCtx, child.Id, regularPost.Id)
		require.NotNil(t, err)
		require.Equal(t, "app.page.change_parent.invalid_parent.app_error", err.Id)
	})

	t.Run("fails when new parent is in different channel", func(t *testing.T) {
		otherChannel, chanErr := th.App.CreateChannel(th.Context, &model.Channel{
			TeamId:      th.BasicTeam.Id,
			Name:        "other-channel-2",
			DisplayName: "Other Channel 2",
			Type:        model.ChannelTypeOpen,
		}, false)
		require.Nil(t, chanErr)

		_, addErr := th.App.AddUserToChannel(th.Context, th.BasicUser, otherChannel, false)
		require.Nil(t, addErr)

		// Create a wiki for the other channel
		otherWiki, otherWikiErr := th.App.CreateWiki(th.Context, &model.Wiki{
			ChannelId: otherChannel.Id,
			Title:     "Other Wiki",
		}, th.BasicUser.Id)
		require.Nil(t, otherWikiErr)

		parentInOtherChannel, err := th.App.CreateWikiPage(th.Context, otherWiki.Id, "", "Parent in Other Channel", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		child, err := th.App.CreateWikiPage(th.Context, wiki.Id, "", "Child", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		err = th.App.ChangePageParent(sessionCtx, child.Id, parentInOtherChannel.Id)
		require.NotNil(t, err)
		require.Equal(t, "app.page.change_parent.parent_different_channel.app_error", err.Id)
	})
}

func TestPageDepthLimit(t *testing.T) {
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()
	th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)

	sessionCtx := th.CreateSessionContext()

	// Create a wiki for the basic channel
	wiki, wikiErr := th.App.CreateWiki(th.Context, &model.Wiki{
		ChannelId: th.BasicChannel.Id,
		Title:     "Test Wiki",
	}, th.BasicUser.Id)
	require.Nil(t, wikiErr)

	t.Run("allows creating pages up to max depth", func(t *testing.T) {
		var parentID string
		var lastPage *model.Post

		// Create PostPageMaxDepth + 1 pages (to reach depth PostPageMaxDepth)
		// This creates depths 0, 1, 2, ..., PostPageMaxDepth
		for i := 0; i <= model.PostPageMaxDepth; i++ {
			page, err := th.App.CreateWikiPage(th.Context, wiki.Id, parentID, "Page Level "+string(rune('0'+i)), "", th.BasicUser.Id, "", "")
			require.Nil(t, err, "Failed to create page at depth %d", i)
			require.NotNil(t, page)
			parentID = page.Id
			lastPage = page
		}

		require.NotNil(t, lastPage)
		depth, err := th.App.calculatePageDepth(th.Context, lastPage.Id)
		require.Nil(t, err)
		require.Equal(t, model.PostPageMaxDepth, depth, "Last page should be at max depth")
	})

	t.Run("prevents creating page beyond max depth", func(t *testing.T) {
		var parentID string

		// Create pages up to depth PostPageMaxDepth (which is the maximum allowed)
		// This creates PostPageMaxDepth + 1 pages: depths 0, 1, 2, ..., PostPageMaxDepth
		for i := 0; i <= model.PostPageMaxDepth; i++ {
			page, err := th.App.CreateWikiPage(th.Context, wiki.Id, parentID, "Depth Page "+string(rune('A'+i)), "", th.BasicUser.Id, "", "")
			require.Nil(t, err)
			parentID = page.Id
		}

		// Verify the last page is at depth PostPageMaxDepth (the maximum)
		depth, err := th.App.calculatePageDepth(th.Context, parentID)
		require.Nil(t, err)
		require.Equal(t, model.PostPageMaxDepth, depth, "Last created page should be at max depth")

		// Now try to create one more level - this should fail because it would be at depth PostPageMaxDepth + 1
		tooDeepPage, err := th.App.CreateWikiPage(th.Context, wiki.Id, parentID, "Too Deep Page", "", th.BasicUser.Id, "", "")
		require.NotNil(t, err, "Should not allow creating page at depth > PostPageMaxDepth")
		require.Nil(t, tooDeepPage)
		require.Equal(t, "app.page.create.max_depth_exceeded.app_error", err.Id)
	})

	t.Run("prevents moving page to exceed max depth", func(t *testing.T) {
		var deepParentID string
		// Create a chain at maximum depth: depths 0, 1, 2, ..., PostPageMaxDepth
		for i := 0; i <= model.PostPageMaxDepth; i++ {
			page, err := th.App.CreateWikiPage(th.Context, wiki.Id, deepParentID, "Deep Chain "+string(rune('0'+i)), "", th.BasicUser.Id, "", "")
			require.Nil(t, err)
			deepParentID = page.Id
		}

		// Verify the last page in chain is at max depth
		depth, err := th.App.calculatePageDepth(th.Context, deepParentID)
		require.Nil(t, err)
		require.Equal(t, model.PostPageMaxDepth, depth, "Last page in chain should be at max depth")

		// Create a separate page (depth 0)
		separatePage, err := th.App.CreateWikiPage(th.Context, wiki.Id, "", "Separate Page", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		// Try to move it under the deepest page - this would make it depth PostPageMaxDepth + 1, which should fail
		err = th.App.ChangePageParent(sessionCtx, separatePage.Id, deepParentID)
		require.NotNil(t, err, "Should not allow moving page to depth > PostPageMaxDepth")
		require.Equal(t, "app.page.change_parent.max_depth_exceeded.app_error", err.Id)
	})

	t.Run("allows moving page within depth limit", func(t *testing.T) {
		parent2, err := th.App.CreateWikiPage(th.Context, wiki.Id, "", "Parent 2", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		child, err := th.App.CreateWikiPage(th.Context, wiki.Id, "", "Child", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		err = th.App.ChangePageParent(sessionCtx, child.Id, parent2.Id)
		require.Nil(t, err)

		updatedChild, err := th.App.GetSinglePost(th.Context, child.Id, false)
		require.Nil(t, err)
		require.Equal(t, parent2.Id, updatedChild.PageParentId)
	})

	t.Run("calculatePageDepth returns correct depth", func(t *testing.T) {
		level1, err := th.App.CreateWikiPage(th.Context, wiki.Id, "", "Level 1", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		depth, err := th.App.calculatePageDepth(th.Context, level1.Id)
		require.Nil(t, err)
		require.Equal(t, 0, depth, "Level 1 page (root) should have depth 0")

		level2, err := th.App.CreateWikiPage(th.Context, wiki.Id, level1.Id, "Level 2", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		depth, err = th.App.calculatePageDepth(th.Context, level2.Id)
		require.Nil(t, err)
		require.Equal(t, 1, depth, "Level 2 page should have depth 1")

		level3, err := th.App.CreateWikiPage(th.Context, wiki.Id, level2.Id, "Level 3", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		depth, err = th.App.calculatePageDepth(th.Context, level3.Id)
		require.Nil(t, err)
		require.Equal(t, 2, depth, "Level 3 page should have depth 2")
	})
}

func TestExtractMentionsFromTipTapContent(t *testing.T) {
	th := Setup(t)

	t.Run("extracts single mention from simple paragraph", func(t *testing.T) {
		content := `{
			"type": "doc",
			"content": [
				{
					"type": "paragraph",
					"content": [
						{"type": "text", "text": "Hey "},
						{"type": "mention", "attrs": {"id": "user123", "label": "@john"}},
						{"type": "text", "text": " check this"}
					]
				}
			]
		}`

		mentions, err := th.App.ExtractMentionsFromTipTapContent(th.Context, content)
		require.NoError(t, err)
		require.Len(t, mentions, 1)
		require.Contains(t, mentions, "user123")
	})

	t.Run("extracts multiple mentions from same paragraph", func(t *testing.T) {
		content := `{
			"type": "doc",
			"content": [
				{
					"type": "paragraph",
					"content": [
						{"type": "mention", "attrs": {"id": "user1", "label": "@alice"}},
						{"type": "text", "text": " and "},
						{"type": "mention", "attrs": {"id": "user2", "label": "@bob"}},
						{"type": "text", "text": " please review"}
					]
				}
			]
		}`

		mentions, err := th.App.ExtractMentionsFromTipTapContent(th.Context, content)
		require.NoError(t, err)
		require.Len(t, mentions, 2)
		require.Contains(t, mentions, "user1")
		require.Contains(t, mentions, "user2")
	})

	t.Run("extracts mentions from multiple paragraphs", func(t *testing.T) {
		content := `{
			"type": "doc",
			"content": [
				{
					"type": "paragraph",
					"content": [
						{"type": "mention", "attrs": {"id": "user1", "label": "@alice"}},
						{"type": "text", "text": " started this"}
					]
				},
				{
					"type": "paragraph",
					"content": [
						{"type": "text", "text": "Then "},
						{"type": "mention", "attrs": {"id": "user2", "label": "@bob"}},
						{"type": "text", "text": " continued"}
					]
				}
			]
		}`

		mentions, err := th.App.ExtractMentionsFromTipTapContent(th.Context, content)
		require.NoError(t, err)
		require.Len(t, mentions, 2)
		require.Contains(t, mentions, "user1")
		require.Contains(t, mentions, "user2")
	})

	t.Run("extracts mentions from nested structures (lists)", func(t *testing.T) {
		content := `{
			"type": "doc",
			"content": [
				{
					"type": "bulletList",
					"content": [
						{
							"type": "listItem",
							"content": [
								{
									"type": "paragraph",
									"content": [
										{"type": "mention", "attrs": {"id": "user1", "label": "@alice"}},
										{"type": "text", "text": " handles frontend"}
									]
								}
							]
						},
						{
							"type": "listItem",
							"content": [
								{
									"type": "paragraph",
									"content": [
										{"type": "mention", "attrs": {"id": "user2", "label": "@bob"}},
										{"type": "text", "text": " handles backend"}
									]
								}
							]
						}
					]
				}
			]
		}`

		mentions, err := th.App.ExtractMentionsFromTipTapContent(th.Context, content)
		require.NoError(t, err)
		require.Len(t, mentions, 2)
		require.Contains(t, mentions, "user1")
		require.Contains(t, mentions, "user2")
	})

	t.Run("extracts mentions from headings", func(t *testing.T) {
		content := `{
			"type": "doc",
			"content": [
				{
					"type": "heading",
					"attrs": {"level": 2},
					"content": [
						{"type": "text", "text": "Task for "},
						{"type": "mention", "attrs": {"id": "user123", "label": "@john"}}
					]
				}
			]
		}`

		mentions, err := th.App.ExtractMentionsFromTipTapContent(th.Context, content)
		require.NoError(t, err)
		require.Len(t, mentions, 1)
		require.Contains(t, mentions, "user123")
	})

	t.Run("deduplicates same user mentioned multiple times", func(t *testing.T) {
		content := `{
			"type": "doc",
			"content": [
				{
					"type": "paragraph",
					"content": [
						{"type": "mention", "attrs": {"id": "user123", "label": "@john"}},
						{"type": "text", "text": " and "},
						{"type": "mention", "attrs": {"id": "user123", "label": "@john"}},
						{"type": "text", "text": " again"}
					]
				}
			]
		}`

		mentions, err := th.App.ExtractMentionsFromTipTapContent(th.Context, content)
		require.NoError(t, err)
		require.Len(t, mentions, 1)
		require.Contains(t, mentions, "user123")
	})

	t.Run("returns empty array for content with no mentions", func(t *testing.T) {
		content := `{
			"type": "doc",
			"content": [
				{
					"type": "paragraph",
					"content": [
						{"type": "text", "text": "Just plain text with no mentions"}
					]
				}
			]
		}`

		mentions, err := th.App.ExtractMentionsFromTipTapContent(th.Context, content)
		require.NoError(t, err)
		require.Len(t, mentions, 0)
	})

	t.Run("returns empty array for empty document", func(t *testing.T) {
		content := `{
			"type": "doc",
			"content": []
		}`

		mentions, err := th.App.ExtractMentionsFromTipTapContent(th.Context, content)
		require.NoError(t, err)
		require.Len(t, mentions, 0)
	})

	t.Run("handles malformed JSON gracefully", func(t *testing.T) {
		content := `{"invalid json`

		mentions, err := th.App.ExtractMentionsFromTipTapContent(th.Context, content)
		require.Error(t, err)
		require.Nil(t, mentions)
	})

	t.Run("ignores mention nodes without id attribute", func(t *testing.T) {
		content := `{
			"type": "doc",
			"content": [
				{
					"type": "paragraph",
					"content": [
						{"type": "mention", "attrs": {"label": "@someone"}},
						{"type": "text", "text": " has no id"}
					]
				}
			]
		}`

		mentions, err := th.App.ExtractMentionsFromTipTapContent(th.Context, content)
		require.NoError(t, err)
		require.Len(t, mentions, 0)
	})

	t.Run("ignores mention nodes with empty id", func(t *testing.T) {
		content := `{
			"type": "doc",
			"content": [
				{
					"type": "paragraph",
					"content": [
						{"type": "mention", "attrs": {"id": "", "label": "@someone"}},
						{"type": "text", "text": " has empty id"}
					]
				}
			]
		}`

		mentions, err := th.App.ExtractMentionsFromTipTapContent(th.Context, content)
		require.NoError(t, err)
		require.Len(t, mentions, 0)
	})

	t.Run("handles deeply nested structures", func(t *testing.T) {
		content := `{
			"type": "doc",
			"content": [
				{
					"type": "bulletList",
					"content": [
						{
							"type": "listItem",
							"content": [
								{
									"type": "paragraph",
									"content": [
										{"type": "text", "text": "Level 1: "},
										{"type": "mention", "attrs": {"id": "user1", "label": "@alice"}}
									]
								},
								{
									"type": "bulletList",
									"content": [
										{
											"type": "listItem",
											"content": [
												{
													"type": "paragraph",
													"content": [
														{"type": "text", "text": "Level 2: "},
														{"type": "mention", "attrs": {"id": "user2", "label": "@bob"}}
													]
												}
											]
										}
									]
								}
							]
						}
					]
				}
			]
		}`

		mentions, err := th.App.ExtractMentionsFromTipTapContent(th.Context, content)
		require.NoError(t, err)
		require.Len(t, mentions, 2)
		require.Contains(t, mentions, "user1")
		require.Contains(t, mentions, "user2")
	})

	t.Run("handles mixed content with mentions and other nodes", func(t *testing.T) {
		content := `{
			"type": "doc",
			"content": [
				{
					"type": "heading",
					"attrs": {"level": 1},
					"content": [
						{"type": "text", "text": "Project Plan"}
					]
				},
				{
					"type": "paragraph",
					"content": [
						{"type": "text", "text": "Assigned to "},
						{"type": "mention", "attrs": {"id": "user1", "label": "@alice"}}
					]
				},
				{
					"type": "codeBlock",
					"content": [
						{"type": "text", "text": "function test() { return true; }"}
					]
				},
				{
					"type": "paragraph",
					"content": [
						{"type": "text", "text": "Reviewed by "},
						{"type": "mention", "attrs": {"id": "user2", "label": "@bob"}}
					]
				}
			]
		}`

		mentions, err := th.App.ExtractMentionsFromTipTapContent(th.Context, content)
		require.NoError(t, err)
		require.Len(t, mentions, 2)
		require.Contains(t, mentions, "user1")
		require.Contains(t, mentions, "user2")
	})
}

func TestCreatePageComment(t *testing.T) {
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	rctx := th.CreateSessionContext()

	page, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Test Page", "", "", th.BasicUser.Id, "", "")
	require.Nil(t, err)
	require.NotNil(t, page)

	t.Run("successfully creates top-level page comment", func(t *testing.T) {
		comment, appErr := th.App.CreatePageComment(rctx, page.Id, "This is a comment on the page", nil)
		require.Nil(t, appErr)
		require.NotNil(t, comment)

		require.Equal(t, model.PostTypePageComment, comment.Type)
		require.Equal(t, page.ChannelId, comment.ChannelId)
		require.Equal(t, page.Id, comment.RootId)
		require.Equal(t, th.BasicUser.Id, comment.UserId)
		require.Equal(t, "This is a comment on the page", comment.Message)

		require.NotNil(t, comment.Props)
		require.Equal(t, page.Id, comment.Props["page_id"])
		require.Nil(t, comment.Props["parent_comment_id"])
	})

	t.Run("fails when page does not exist", func(t *testing.T) {
		comment, appErr := th.App.CreatePageComment(rctx, "invalid_page_id", "Comment on non-existent page", nil)
		require.NotNil(t, appErr)
		require.Nil(t, comment)
		require.Equal(t, "app.page.create_comment.page_not_found.app_error", appErr.Id)
	})

	t.Run("fails when root post is not a page", func(t *testing.T) {
		regularPost, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "Regular post",
		}, th.BasicChannel, model.CreatePostFlags{})
		require.Nil(t, err)

		comment, appErr := th.App.CreatePageComment(rctx, regularPost.Id, "Comment on regular post", nil)
		require.NotNil(t, appErr)
		require.Nil(t, comment)
		require.Equal(t, "app.page.create_comment.not_a_page.app_error", appErr.Id)
	})

	t.Run("creates multiple comments on same page", func(t *testing.T) {
		comment1, appErr := th.App.CreatePageComment(rctx, page.Id, "First comment", nil)
		require.Nil(t, appErr)
		require.NotNil(t, comment1)

		comment2, appErr := th.App.CreatePageComment(rctx, page.Id, "Second comment", nil)
		require.Nil(t, appErr)
		require.NotNil(t, comment2)

		require.NotEqual(t, comment1.Id, comment2.Id)
		require.Equal(t, page.Id, comment1.RootId)
		require.Equal(t, page.Id, comment2.RootId)
	})

	t.Run("creates comment with inline anchor", func(t *testing.T) {
		inlineAnchor := map[string]any{
			"start": 10,
			"end":   20,
		}
		comment, appErr := th.App.CreatePageComment(rctx, page.Id, "Inline comment", inlineAnchor)
		require.Nil(t, appErr)
		require.NotNil(t, comment)
		require.NotNil(t, comment.GetProp("inline_anchor"))
	})

	t.Run("fails with empty message", func(t *testing.T) {
		comment, appErr := th.App.CreatePageComment(rctx, page.Id, "", nil)
		require.NotNil(t, appErr)
		require.Nil(t, comment)
	})

	t.Run("fails with whitespace-only message", func(t *testing.T) {
		comment, appErr := th.App.CreatePageComment(rctx, page.Id, "   ", nil)
		require.NotNil(t, appErr)
		require.Nil(t, comment)
		require.Equal(t, "app.page.create_comment.empty_message.app_error", appErr.Id)
	})
}

func TestCreatePageCommentReply(t *testing.T) {
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	rctx := th.CreateSessionContext()

	page, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Test Page", "", "", th.BasicUser.Id, "", "")
	require.Nil(t, err)

	topLevelComment, appErr := th.App.CreatePageComment(rctx, page.Id, "Top-level comment", nil)
	require.Nil(t, appErr)

	t.Run("successfully creates reply to top-level comment", func(t *testing.T) {
		reply, appErr := th.App.CreatePageCommentReply(rctx, page.Id, topLevelComment.Id, "This is a reply")
		require.Nil(t, appErr)
		require.NotNil(t, reply)

		require.Equal(t, model.PostTypePageComment, reply.Type)
		require.Equal(t, page.ChannelId, reply.ChannelId)
		require.Equal(t, page.Id, reply.RootId)
		require.Equal(t, th.BasicUser.Id, reply.UserId)
		require.Equal(t, "This is a reply", reply.Message)

		require.NotNil(t, reply.Props)
		require.Equal(t, page.Id, reply.Props["page_id"])
		require.Equal(t, topLevelComment.Id, reply.Props["parent_comment_id"])
	})

	t.Run("fails when page does not exist", func(t *testing.T) {
		reply, appErr := th.App.CreatePageCommentReply(rctx, "invalid_page_id", topLevelComment.Id, "Reply to non-existent page")
		require.NotNil(t, appErr)
		require.Nil(t, reply)
		require.Equal(t, "app.page.create_comment_reply.page_not_found.app_error", appErr.Id)
	})

	t.Run("fails when parent comment does not exist", func(t *testing.T) {
		reply, appErr := th.App.CreatePageCommentReply(rctx, page.Id, "invalid_comment_id", "Reply to non-existent comment")
		require.NotNil(t, appErr)
		require.Nil(t, reply)
		require.Equal(t, "app.page.create_comment_reply.parent_not_found.app_error", appErr.Id)
	})

	t.Run("fails when parent is not a page comment", func(t *testing.T) {
		regularPost, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "Regular post",
		}, th.BasicChannel, model.CreatePostFlags{})
		require.Nil(t, err)

		reply, appErr := th.App.CreatePageCommentReply(rctx, page.Id, regularPost.Id, "Reply to regular post")
		require.NotNil(t, appErr)
		require.Nil(t, reply)
		require.Equal(t, "app.page.create_comment_reply.parent_not_comment.app_error", appErr.Id)
	})

	t.Run("enforces one-level nesting - cannot reply to a reply", func(t *testing.T) {
		reply1, appErr := th.App.CreatePageCommentReply(rctx, page.Id, topLevelComment.Id, "First reply")
		require.Nil(t, appErr)

		reply2, appErr := th.App.CreatePageCommentReply(rctx, page.Id, reply1.Id, "Reply to reply (should fail)")
		require.NotNil(t, appErr)
		require.Nil(t, reply2)
		require.Equal(t, "app.page.create_comment_reply.reply_to_reply_not_allowed.app_error", appErr.Id)
	})

	t.Run("creates multiple replies to same comment", func(t *testing.T) {
		reply1, appErr := th.App.CreatePageCommentReply(rctx, page.Id, topLevelComment.Id, "Reply 1")
		require.Nil(t, appErr)

		reply2, appErr := th.App.CreatePageCommentReply(rctx, page.Id, topLevelComment.Id, "Reply 2")
		require.Nil(t, appErr)

		require.NotEqual(t, reply1.Id, reply2.Id)
		require.Equal(t, page.Id, reply1.RootId)
		require.Equal(t, page.Id, reply2.RootId)
		require.Equal(t, topLevelComment.Id, reply1.Props["parent_comment_id"])
		require.Equal(t, topLevelComment.Id, reply2.Props["parent_comment_id"])
	})

	t.Run("fails with empty message", func(t *testing.T) {
		reply, appErr := th.App.CreatePageCommentReply(rctx, page.Id, topLevelComment.Id, "")
		require.NotNil(t, appErr)
		require.Nil(t, reply)
	})

	t.Run("fails with whitespace-only message", func(t *testing.T) {
		reply, appErr := th.App.CreatePageCommentReply(rctx, page.Id, topLevelComment.Id, "   ")
		require.NotNil(t, appErr)
		require.Nil(t, reply)
		require.Equal(t, "app.page.create_comment_reply.empty_message.app_error", appErr.Id)
	})

	t.Run("fails when parent comment belongs to different page", func(t *testing.T) {
		otherPage, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Other Page", "", "", th.BasicUser.Id, "", "")
		require.Nil(t, err)

		reply, appErr := th.App.CreatePageCommentReply(rctx, otherPage.Id, topLevelComment.Id, "Reply with wrong page")
		require.NotNil(t, appErr)
		require.Nil(t, reply)
		require.Equal(t, "app.page.create_comment_reply.parent_wrong_page.app_error", appErr.Id)
	})
}

func TestGetPageStatus(t *testing.T) {
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	rctx := th.CreateSessionContext()

	createdPage, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Test Page", "", "", th.BasicUser.Id, "", "")
	require.Nil(t, err)
	require.NotNil(t, createdPage)

	t.Run("returns default status when page has no status property", func(t *testing.T) {
		page, appErr := th.App.GetPage(rctx, createdPage.Id)
		require.Nil(t, appErr)
		status, appErr := th.App.GetPageStatus(rctx, page)
		require.Nil(t, appErr)
		require.Equal(t, model.PageStatusInProgress, status)
	})

	t.Run("returns actual status after setting", func(t *testing.T) {
		page, appErr := th.App.GetPage(rctx, createdPage.Id)
		require.Nil(t, appErr)
		appErr = th.App.SetPageStatus(rctx, page, model.PageStatusDone)
		require.Nil(t, appErr)

		page, appErr = th.App.GetPage(rctx, createdPage.Id)
		require.Nil(t, appErr)
		status, appErr := th.App.GetPageStatus(rctx, page)
		require.Nil(t, appErr)
		require.Equal(t, model.PageStatusDone, status)
	})

	t.Run("cannot get status for non-existent page", func(t *testing.T) {
		// With type-safe Page wrapper, invalid pages are caught at GetPage
		_, appErr := th.App.GetPage(rctx, "invalid_page_id")
		require.NotNil(t, appErr)
		require.Contains(t, appErr.Id, "app.page.get.not_found")
	})

	t.Run("cannot get status for non-page post", func(t *testing.T) {
		regularPost, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "Regular post",
		}, th.BasicChannel, model.CreatePostFlags{})
		require.Nil(t, err)

		// With type-safe Page wrapper, non-page posts are caught at GetPage
		_, appErr := th.App.GetPage(rctx, regularPost.Id)
		require.NotNil(t, appErr)
		require.Contains(t, appErr.Id, "not_a_page")
	})
}

func TestSetPageStatus(t *testing.T) {
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	rctx := th.CreateSessionContext()

	createdPage, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Test Page", "", "", th.BasicUser.Id, "", "")
	require.Nil(t, err)

	t.Run("successfully sets page status", func(t *testing.T) {
		page, appErr := th.App.GetPage(rctx, createdPage.Id)
		require.Nil(t, appErr)
		appErr = th.App.SetPageStatus(rctx, page, model.PageStatusInReview)
		require.Nil(t, appErr)

		page, appErr = th.App.GetPage(rctx, createdPage.Id)
		require.Nil(t, appErr)
		status, appErr := th.App.GetPageStatus(rctx, page)
		require.Nil(t, appErr)
		require.Equal(t, model.PageStatusInReview, status)
	})

	t.Run("updates existing status", func(t *testing.T) {
		page, appErr := th.App.GetPage(rctx, createdPage.Id)
		require.Nil(t, appErr)
		appErr = th.App.SetPageStatus(rctx, page, model.PageStatusRoughDraft)
		require.Nil(t, appErr)

		page, appErr = th.App.GetPage(rctx, createdPage.Id)
		require.Nil(t, appErr)
		status, appErr := th.App.GetPageStatus(rctx, page)
		require.Nil(t, appErr)
		require.Equal(t, model.PageStatusRoughDraft, status)

		page, appErr = th.App.GetPage(rctx, createdPage.Id)
		require.Nil(t, appErr)
		appErr = th.App.SetPageStatus(rctx, page, model.PageStatusDone)
		require.Nil(t, appErr)

		page, appErr = th.App.GetPage(rctx, createdPage.Id)
		require.Nil(t, appErr)
		status, appErr = th.App.GetPageStatus(rctx, page)
		require.Nil(t, appErr)
		require.Equal(t, model.PageStatusDone, status)
	})

	t.Run("accepts all valid status values", func(t *testing.T) {
		validStatuses := []string{model.PageStatusRoughDraft, model.PageStatusInProgress, model.PageStatusInReview, model.PageStatusDone}
		for _, status := range validStatuses {
			page, appErr := th.App.GetPage(rctx, createdPage.Id)
			require.Nil(t, appErr)
			appErr = th.App.SetPageStatus(rctx, page, status)
			require.Nil(t, appErr, "Should accept status: %s", status)

			page, appErr = th.App.GetPage(rctx, createdPage.Id)
			require.Nil(t, appErr)
			retrievedStatus, appErr := th.App.GetPageStatus(rctx, page)
			require.Nil(t, appErr)
			require.Equal(t, status, retrievedStatus)
		}
	})

	t.Run("cannot set status for non-existent page", func(t *testing.T) {
		// With type-safe Page wrapper, invalid pages are caught at GetPage
		_, appErr := th.App.GetPage(rctx, "invalid_page_id")
		require.NotNil(t, appErr)
		require.Contains(t, appErr.Id, "app.page.get.not_found")
	})

	t.Run("cannot set status for non-page post", func(t *testing.T) {
		regularPost, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "Regular post",
		}, th.BasicChannel, model.CreatePostFlags{})
		require.Nil(t, err)

		// With type-safe Page wrapper, non-page posts are caught at GetPage
		_, appErr := th.App.GetPage(rctx, regularPost.Id)
		require.NotNil(t, appErr)
		require.Contains(t, appErr.Id, "not_a_page")
	})
}

func TestGetPageStatusField(t *testing.T) {
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	t.Run("successfully retrieves page status field definition", func(t *testing.T) {
		field, appErr := th.App.GetPageStatusField()
		require.Nil(t, appErr)
		require.NotNil(t, field)

		require.Equal(t, "status", field.Name)
		require.Equal(t, model.PropertyFieldType("select"), field.Type)
		require.NotNil(t, field.Attrs)

		optionsRaw, exists := field.Attrs["options"]
		require.True(t, exists, "field.Attrs should have 'options' key")

		// After JSON unmarshaling, options is []any where each element is map[string]any
		options, ok := optionsRaw.([]any)
		require.True(t, ok, "field.Attrs[\"options\"] should be []any")
		require.Len(t, options, 4)

		expectedStatuses := map[string]bool{
			model.PageStatusRoughDraft: false,
			model.PageStatusInProgress: false,
			model.PageStatusInReview:   false,
			model.PageStatusDone:       false,
		}

		for _, optionRaw := range options {
			option, ok := optionRaw.(map[string]any)
			require.True(t, ok, "Each option should be map[string]any")
			nameVal, ok := option["name"]
			require.True(t, ok, "Option should have 'name' field")
			name, ok := nameVal.(string)
			require.True(t, ok, "Option name should be string")
			_, exists := expectedStatuses[name]
			require.True(t, exists, "Unexpected status option: %s", name)
			expectedStatuses[name] = true
		}

		for status, found := range expectedStatuses {
			require.True(t, found, "Missing expected status: %s", status)
		}
	})
}

func TestPageMentionSystemMessages(t *testing.T) {
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	rctx := th.CreateSessionContext()

	user2 := th.CreateUser(t)
	th.LinkUserToTeam(t, user2, th.BasicTeam)
	th.AddUserToChannel(t, user2, th.BasicChannel)

	user3 := th.CreateUser(t)
	th.LinkUserToTeam(t, user3, th.BasicTeam)
	th.AddUserToChannel(t, user3, th.BasicChannel)

	wiki := &model.Wiki{
		ChannelId:   th.BasicChannel.Id,
		Title:       "Test Wiki",
		Description: "Test wiki for mentions",
	}
	createdWiki, wikiErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, wikiErr)
	require.NotNil(t, createdWiki)

	t.Run("system messages created when wiki setting enabled", func(t *testing.T) {
		createdWiki.SetShowMentionsInChannelFeed(true)
		_, updateErr := th.App.UpdateWiki(rctx, createdWiki)
		require.Nil(t, updateErr)

		pageContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"mention","attrs":{"id":"` + user2.Id + `","label":"@` + user2.Username + `"}},{"type":"text","text":" please review"}]}]}`
		page, err := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Test Page", pageContent, th.BasicUser.Id, "", "")
		require.Nil(t, err)
		require.NotNil(t, page)

		allPosts, searchErr := th.App.Srv().Store().Post().GetPostsSince(th.Context, model.GetPostsSinceOptions{ChannelId: th.BasicChannel.Id, Time: 0}, true, map[string]bool{})
		require.NoError(t, searchErr)

		var mentionMessage *model.Post
		for _, post := range allPosts.Posts {
			if post.Type == model.PostTypePageMention && post.GetProp("page_id") == page.Id {
				mentionMessage = post
				break
			}
		}

		require.NotNil(t, mentionMessage, "System message should be created")
		require.Equal(t, model.PostTypePageMention, mentionMessage.Type)
		require.Equal(t, th.BasicChannel.Id, mentionMessage.ChannelId)
		require.Equal(t, th.BasicUser.Id, mentionMessage.UserId)
		require.Contains(t, mentionMessage.Message, user2.Username)
		require.Contains(t, mentionMessage.Message, "Test Page")

		require.Equal(t, page.Id, mentionMessage.GetProp("page_id"))
		require.Equal(t, user2.Id, mentionMessage.GetProp("mentioned_user_id"))
		require.Equal(t, createdWiki.Id, mentionMessage.GetProp("wiki_id"))
		require.Equal(t, "Test Page", mentionMessage.GetProp("page_title"))
		require.Equal(t, user2.Username, mentionMessage.GetProp("username"), "username property should be set for frontend rendering")
	})

	t.Run("no system messages when wiki setting disabled", func(t *testing.T) {
		createdWiki.SetShowMentionsInChannelFeed(false)
		_, updateErr := th.App.UpdateWiki(rctx, createdWiki)
		require.Nil(t, updateErr)

		pageContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"mention","attrs":{"id":"` + user3.Id + `","label":"@` + user3.Username + `"}},{"type":"text","text":" check this"}]}]}`
		page, err := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Another Page", pageContent, th.BasicUser.Id, "", "")
		require.Nil(t, err)
		require.NotNil(t, page)

		systemMessages, searchErr := th.App.Srv().Store().Post().Search(th.BasicTeam.Id, user3.Id, &model.SearchParams{Terms: user3.Username})
		require.NoError(t, searchErr)

		var mentionMessage *model.Post
		for _, post := range systemMessages.Posts {
			if post.Type == model.PostTypePageMention && post.GetProp("page_id") == page.Id {
				mentionMessage = post
				break
			}
		}

		require.Nil(t, mentionMessage, "System message should NOT be created when setting is disabled")
	})

	t.Run("system messages created for multiple mentions", func(t *testing.T) {
		createdWiki.SetShowMentionsInChannelFeed(true)
		_, updateErr := th.App.UpdateWiki(rctx, createdWiki)
		require.Nil(t, updateErr)

		pageContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"mention","attrs":{"id":"` + user2.Id + `","label":"@` + user2.Username + `"}},{"type":"text","text":" and "},{"type":"mention","attrs":{"id":"` + user3.Id + `","label":"@` + user3.Username + `"}},{"type":"text","text":" both review"}]}]}`
		page, err := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Multi Mention Page", pageContent, th.BasicUser.Id, "", "")
		require.Nil(t, err)
		require.NotNil(t, page)

		allPosts, searchErr := th.App.Srv().Store().Post().GetPostsSince(th.Context, model.GetPostsSinceOptions{ChannelId: th.BasicChannel.Id, Time: 0}, true, map[string]bool{})
		require.NoError(t, searchErr)

		systemMessagesForPage := []*model.Post{}
		for _, post := range allPosts.Posts {
			if post.Type == model.PostTypePageMention && post.GetProp("page_id") == page.Id {
				systemMessagesForPage = append(systemMessagesForPage, post)
			}
		}

		require.Len(t, systemMessagesForPage, 2, "Should create system message for each mentioned user")

		mentionedUsers := make(map[string]bool)
		for _, msg := range systemMessagesForPage {
			mentionedUserId := msg.GetProp("mentioned_user_id").(string)
			mentionedUsers[mentionedUserId] = true

			// Verify username property is set correctly for each mention
			username := msg.GetProp("username").(string)
			if mentionedUserId == user2.Id {
				require.Equal(t, user2.Username, username, "username should match mentioned user")
			} else if mentionedUserId == user3.Id {
				require.Equal(t, user3.Username, username, "username should match mentioned user")
			}
		}

		require.True(t, mentionedUsers[user2.Id], "Should have system message for user2")
		require.True(t, mentionedUsers[user3.Id], "Should have system message for user3")
	})

	t.Run("system messages work with page updates", func(t *testing.T) {
		createdWiki.SetShowMentionsInChannelFeed(true)
		_, updateErr := th.App.UpdateWiki(rctx, createdWiki)
		require.Nil(t, updateErr)

		initialContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"No mentions yet"}]}]}`
		createdPage, err := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Update Test Page", initialContent, th.BasicUser.Id, "", "")
		require.Nil(t, err)

		page, appErr := th.App.GetPage(rctx, createdPage.Id)
		require.Nil(t, appErr)
		updatedContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"mention","attrs":{"id":"` + user2.Id + `","label":"@` + user2.Username + `"}},{"type":"text","text":" added in update"}]}]}`
		_, updatePageErr := th.App.UpdatePage(rctx, page, "Update Test Page", updatedContent, "")
		require.Nil(t, updatePageErr)

		allPosts, searchErr := th.App.Srv().Store().Post().GetPostsSince(th.Context, model.GetPostsSinceOptions{ChannelId: th.BasicChannel.Id, Time: 0}, true, map[string]bool{})
		require.NoError(t, searchErr)

		var mentionMessage *model.Post
		for _, post := range allPosts.Posts {
			if post.Type == model.PostTypePageMention && post.GetProp("page_id") == page.Id() {
				mentionMessage = post
				break
			}
		}

		require.NotNil(t, mentionMessage, "System message should be created when mention added via update")
		require.Equal(t, user2.Id, mentionMessage.GetProp("mentioned_user_id"))
		require.Equal(t, user2.Username, mentionMessage.GetProp("username"), "username property should be set for frontend rendering")
	})
}

func TestPageVersionHistory(t *testing.T) {
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	sessionCtx := th.CreateSessionContext()

	t.Run("PageContents versioned on edit", func(t *testing.T) {
		// Create page
		createdPage, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Version Test", "", `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Version 1"}]}]}`, th.BasicUser.Id, "", "")
		require.Nil(t, err)
		require.NotNil(t, createdPage)

		// First edit
		page, appErr := th.App.GetPage(sessionCtx, createdPage.Id)
		require.Nil(t, appErr)
		_, err = th.App.UpdatePage(sessionCtx, page, "Version Test Updated", `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Version 2"}]}]}`, "")
		require.Nil(t, err)

		// Get edit history
		historyList, histErr := th.App.GetEditHistoryForPost(createdPage.Id)
		require.Nil(t, histErr)
		require.NotNil(t, historyList)
		require.Len(t, historyList, 1, "Should have 1 historical version")

		// Verify historical Post metadata exists
		var historicalPost *model.Post
		for _, p := range historyList {
			if p.OriginalId == createdPage.Id && p.DeleteAt > 0 {
				historicalPost = p
				break
			}
		}
		require.NotNil(t, historicalPost, "Historical post should exist")

		// Verify historical PageContents exists
		historicalContent, contentErr := th.App.Srv().Store().Page().GetPageContentWithDeleted(historicalPost.Id)
		require.NoError(t, contentErr, "Historical PageContents should exist")
		require.NotNil(t, historicalContent)
		require.Greater(t, historicalContent.DeleteAt, int64(0), "Historical content should be marked as deleted")

		// Verify historical content is correct
		contentJSON, _ := historicalContent.GetDocumentJSON()
		require.Contains(t, contentJSON, "Version 1", "Historical content should contain original text")
	})

	t.Run("Non-author can view page history", func(t *testing.T) {
		// Create page as BasicUser
		createdPage, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Shared Page", "", `{"type":"doc","content":[]}`, th.BasicUser.Id, "", "")
		require.Nil(t, err)

		// Edit as BasicUser
		page, appErr := th.App.GetPage(sessionCtx, createdPage.Id)
		require.Nil(t, appErr)
		_, err = th.App.UpdatePage(sessionCtx, page, "Shared Page Updated", `{"type":"doc","content":[]}`, "")
		require.Nil(t, err)

		// BasicUser2 (not author) should be able to view history
		// This is tested at API level in post_test.go
	})

	t.Run("Restore page version restores both content and title", func(t *testing.T) {
		// Create page
		createdPage, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Original Title", "", `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Original Content"}]}]}`, th.BasicUser.Id, "", "")
		require.Nil(t, err)

		// Edit page (change both title and content)
		page, appErr := th.App.GetPage(sessionCtx, createdPage.Id)
		require.Nil(t, appErr)
		_, err = th.App.UpdatePage(sessionCtx, page, "Updated Title", `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Updated Content"}]}]}`, "")
		require.Nil(t, err)

		// Get historical version
		historyList, histErr := th.App.GetEditHistoryForPost(createdPage.Id)
		require.Nil(t, histErr)
		require.Len(t, historyList, 1)

		var historicalPostID string
		for _, p := range historyList {
			if p.OriginalId == createdPage.Id && p.DeleteAt > 0 {
				historicalPostID = p.Id
				break
			}
		}
		require.NotEmpty(t, historicalPostID)

		// Restore to original version
		restoredPost, restoreErr := th.App.RestorePostVersion(sessionCtx, th.BasicUser.Id, createdPage.Id, historicalPostID)
		require.Nil(t, restoreErr)
		require.NotNil(t, restoredPost)

		// Verify title restored
		require.Equal(t, "Original Title", restoredPost.Props["title"], "Title should be restored")

		// Verify content restored
		restoredContent, contentErr := th.App.Srv().Store().Page().GetPageContent(createdPage.Id)
		require.NoError(t, contentErr)
		contentJSON, _ := restoredContent.GetDocumentJSON()
		require.Contains(t, contentJSON, "Original Content", "Content should be restored")
	})
}

func TestUpdatePageWithOptimisticLocking_Success(t *testing.T) {
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	sessionCtx := th.CreateSessionContext()

	validContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Original content"}]}]}`
	createdPage, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Original Title", "", validContent, th.BasicUser.Id, "", "")
	require.Nil(t, err)
	require.NotNil(t, createdPage)

	baseEditAt := createdPage.EditAt

	page, appErr := th.App.GetPage(sessionCtx, createdPage.Id)
	require.Nil(t, appErr)
	newContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Updated content"}]}]}`
	updatedPage, err := th.App.UpdatePageWithOptimisticLocking(sessionCtx, page, "Updated Title", newContent, "updated search text", baseEditAt, false)

	require.Nil(t, err)
	require.NotNil(t, updatedPage)
	require.Equal(t, "Updated Title", updatedPage.Props["title"])
	require.JSONEq(t, newContent, updatedPage.Message)
	require.Greater(t, updatedPage.EditAt, baseEditAt)

	pageContent, contentErr := th.App.Srv().Store().Page().GetPageContent(updatedPage.Id)
	require.NoError(t, contentErr)
	jsonContent, jsonErr := pageContent.GetDocumentJSON()
	require.NoError(t, jsonErr)
	require.Contains(t, jsonContent, "Updated content")
}

func TestUpdatePageWithOptimisticLocking_Conflict(t *testing.T) {
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	sessionCtx := th.CreateSessionContext()

	validContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Original content"}]}]}`
	createdPage, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Original Title", "", validContent, th.BasicUser.Id, "", "")
	require.Nil(t, err)
	require.NotNil(t, createdPage)

	// First update to establish a non-zero EditAt (newly created pages have EditAt=0)
	page, appErr := th.App.GetPage(sessionCtx, createdPage.Id)
	require.Nil(t, appErr)
	firstUpdateContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"First update content"}]}]}`
	firstUpdate, err := th.App.UpdatePageWithOptimisticLocking(sessionCtx, page, "First Update Title", firstUpdateContent, "first update search", 0, false)
	require.Nil(t, err)
	require.NotNil(t, firstUpdate)
	require.Greater(t, firstUpdate.EditAt, int64(0), "After first update, EditAt should be non-zero")

	// Both users start editing with the same baseline EditAt
	baseEditAt := firstUpdate.EditAt

	page, appErr = th.App.GetPage(sessionCtx, createdPage.Id)
	require.Nil(t, appErr)
	content1 := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"User 1 content"}]}]}`
	updated1, err1 := th.App.UpdatePageWithOptimisticLocking(sessionCtx, page, "User 1 Title", content1, "user 1 search", baseEditAt, false)
	require.Nil(t, err1)
	require.NotNil(t, updated1)
	require.Greater(t, updated1.EditAt, baseEditAt)

	// User 2 tries to update with the stale baseline - should get conflict
	page, appErr = th.App.GetPage(sessionCtx, createdPage.Id)
	require.Nil(t, appErr)
	content2 := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"User 2 content"}]}]}`
	_, err2 := th.App.UpdatePageWithOptimisticLocking(sessionCtx, page, "User 2 Title", content2, "user 2 search", baseEditAt, false)

	require.NotNil(t, err2)
	require.Equal(t, "app.page.update.conflict.app_error", err2.Id)
	require.Equal(t, 409, err2.StatusCode)
	require.Contains(t, err2.DetailedError, "modified_by=")
	require.Contains(t, err2.DetailedError, "edit_at=")
}

func TestUpdatePageWithOptimisticLocking_DeletedPage(t *testing.T) {
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	sessionCtx := th.CreateSessionContext()

	validContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Original content"}]}]}`
	createdPage, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Original Title", "", validContent, th.BasicUser.Id, "", "")
	require.Nil(t, err)
	require.NotNil(t, createdPage)

	baseEditAt := createdPage.EditAt

	// Get page before deleting (we need to pass *Page to UpdatePageWithOptimisticLocking)
	page, appErr := th.App.GetPage(sessionCtx, createdPage.Id)
	require.Nil(t, appErr)

	_, deleteErr := th.App.DeletePost(th.Context, createdPage.Id, th.BasicUser.Id)
	require.Nil(t, deleteErr)

	// Try to update with the page reference from before deletion
	// UpdatePageWithOptimisticLocking internally fetches fresh from master for conflict detection
	newContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Updated content"}]}]}`
	_, updateErr := th.App.UpdatePageWithOptimisticLocking(sessionCtx, page, "Updated Title", newContent, "updated search", baseEditAt, false)

	require.NotNil(t, updateErr)
	require.Equal(t, 404, updateErr.StatusCode)
	require.Equal(t, "app.page.update.not_found.app_error", updateErr.Id)
}

func TestUpdatePageWithOptimisticLocking_ErrorDetailsIncludeModifier(t *testing.T) {
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	user1Session := th.CreateSessionContext()

	user2 := th.CreateUser(t)
	th.LinkUserToTeam(t, user2, th.BasicTeam)
	th.AddUserToChannel(t, user2, th.BasicChannel)

	_ = th.App.Srv().InvalidateAllCaches()

	session2, sessErr := th.App.CreateSession(th.Context, &model.Session{UserId: user2.Id, Props: model.StringMap{}})
	require.Nil(t, sessErr)
	user2Session := th.Context.WithSession(session2)

	validContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Original content"}]}]}`
	createdPage, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Original Title", "", validContent, th.BasicUser.Id, "", "")
	require.Nil(t, err)
	require.NotNil(t, createdPage)

	// First update to establish a non-zero EditAt (newly created pages have EditAt=0)
	page, appErr := th.App.GetPage(user1Session, createdPage.Id)
	require.Nil(t, appErr)
	firstUpdateContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"First update content"}]}]}`
	firstUpdate, err := th.App.UpdatePageWithOptimisticLocking(user1Session, page, "First Update Title", firstUpdateContent, "first update search", 0, false)
	require.Nil(t, err)
	require.NotNil(t, firstUpdate)
	require.Greater(t, firstUpdate.EditAt, int64(0), "After first update, EditAt should be non-zero")

	// Both users start editing with the same baseline EditAt
	baseEditAt := firstUpdate.EditAt

	// User 2 edits and publishes first
	page, appErr = th.App.GetPage(user2Session, createdPage.Id)
	require.Nil(t, appErr)
	content2 := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"User 2 content"}]}]}`
	updated2, err2 := th.App.UpdatePageWithOptimisticLocking(user2Session, page, "User 2 Title", content2, "user 2 search", baseEditAt, false)
	require.Nil(t, err2)
	require.NotNil(t, updated2)

	// User 1 tries to update with the stale baseline - should get conflict with User 2's info
	page, appErr = th.App.GetPage(user1Session, createdPage.Id)
	require.Nil(t, appErr)
	content1 := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"User 1 content"}]}]}`
	_, err1 := th.App.UpdatePageWithOptimisticLocking(user1Session, page, "User 1 Title", content1, "user 1 search", baseEditAt, false)

	require.NotNil(t, err1)
	require.Equal(t, 409, err1.StatusCode)
	require.Contains(t, err1.DetailedError, user2.Id, "Error should include ID of user who made the conflicting change")
	require.Contains(t, err1.DetailedError, "edit_at=")
}

func TestConvertPlainTextToTipTapJSON(t *testing.T) {
	t.Run("converts simple text to valid TipTap JSON", func(t *testing.T) {
		plainText := "Hello World"
		result := convertPlainTextToTipTapJSON(plainText)

		require.NotEmpty(t, result)
		require.True(t, isValidTipTapJSON(result), "converted text should be valid TipTap JSON")

		var doc map[string]any
		err := json.Unmarshal([]byte(result), &doc)
		require.NoError(t, err)
		require.Equal(t, "doc", doc["type"])
	})

	t.Run("converts multiline text to paragraphs", func(t *testing.T) {
		plainText := "Line 1\nLine 2\nLine 3"
		result := convertPlainTextToTipTapJSON(plainText)

		require.True(t, isValidTipTapJSON(result))

		var doc map[string]any
		err := json.Unmarshal([]byte(result), &doc)
		require.NoError(t, err)
		content := doc["content"].([]any)
		require.Equal(t, 3, len(content), "should have 3 paragraphs")
	})

	t.Run("handles empty text", func(t *testing.T) {
		plainText := ""
		result := convertPlainTextToTipTapJSON(plainText)

		require.True(t, isValidTipTapJSON(result))

		var doc map[string]any
		err := json.Unmarshal([]byte(result), &doc)
		require.NoError(t, err)
		require.Equal(t, "doc", doc["type"])
	})

	t.Run("converts AI-style multiline summary", func(t *testing.T) {
		aiSummary := `Summary of Discussion

The team discussed implementing OAuth 2.0 with JWT tokens.
Key points:
- Better security
- Refresh tokens for UX`

		result := convertPlainTextToTipTapJSON(aiSummary)
		require.True(t, isValidTipTapJSON(result), "AI summary should convert to valid TipTap JSON")
	})
}

func TestIsValidTipTapJSON(t *testing.T) {
	t.Run("validates correct TipTap JSON", func(t *testing.T) {
		validJSON := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Hello"}]}]}`
		require.True(t, isValidTipTapJSON(validJSON))
	})

	t.Run("rejects invalid JSON", func(t *testing.T) {
		invalidJSON := `{"invalid json`
		require.False(t, isValidTipTapJSON(invalidJSON))
	})

	t.Run("rejects JSON without type doc", func(t *testing.T) {
		wrongType := `{"type":"paragraph","content":[]}`
		require.False(t, isValidTipTapJSON(wrongType))
	})

	t.Run("rejects plain text", func(t *testing.T) {
		plainText := "This is plain text"
		require.False(t, isValidTipTapJSON(plainText))
	})

	t.Run("validates empty TipTap document", func(t *testing.T) {
		emptyDoc := `{"type":"doc","content":[]}`
		require.True(t, isValidTipTapJSON(emptyDoc))
	})
}

func TestCreatePageContentValidation(t *testing.T) {
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	t.Run("accepts valid TipTap JSON", func(t *testing.T) {
		validContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Valid content"}]}]}`
		page, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Test", "", validContent, th.BasicUser.Id, "", "")
		require.Nil(t, err)
		require.NotNil(t, page)
	})

	t.Run("rejects malformed JSON starting with {", func(t *testing.T) {
		invalidJSON := `{"invalid json without closing`
		page, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Test", "", invalidJSON, th.BasicUser.Id, "", "")
		require.NotNil(t, err)
		require.Nil(t, page)
		require.Equal(t, "app.page.create.invalid_content.app_error", err.Id)
	})

	t.Run("rejects valid JSON without type doc", func(t *testing.T) {
		wrongTypeJSON := `{"type":"paragraph","content":[]}`
		page, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Test", "", wrongTypeJSON, th.BasicUser.Id, "", "")
		require.NotNil(t, err)
		require.Nil(t, page)
		require.Equal(t, "app.page.create.invalid_content.app_error", err.Id)
	})

	t.Run("auto-converts plain text to TipTap JSON", func(t *testing.T) {
		plainText := "This is plain text that should be converted"
		page, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Test", "", plainText, th.BasicUser.Id, "", "")
		require.Nil(t, err)
		require.NotNil(t, page)

		pageContent, contentErr := th.App.Srv().Store().Page().GetPageContent(page.Id)
		require.NoError(t, contentErr)
		require.NotNil(t, pageContent)

		jsonContent, jsonErr := pageContent.GetDocumentJSON()
		require.NoError(t, jsonErr)
		require.True(t, isValidTipTapJSON(jsonContent), "auto-converted content should be valid TipTap JSON")
	})
}
