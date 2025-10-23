// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/stretchr/testify/require"
)

func createSessionContext(th *TestHelper) request.CTX {
	session, err := th.App.CreateSession(th.Context, &model.Session{UserId: th.BasicUser.Id, Props: model.StringMap{}})
	if err != nil {
		panic(err)
	}
	return th.Context.WithSession(session)
}

func setupPagePermissions(th *TestHelper) {
	role, err := th.App.GetRoleByName(th.Context, model.ChannelUserRoleId)
	if err != nil {
		panic(err)
	}

	permissions := append(role.Permissions,
		model.PermissionCreatePagePublicChannel.Id,
		model.PermissionReadPagePublicChannel.Id,
		model.PermissionEditPagePublicChannel.Id,
		model.PermissionDeletePagePublicChannel.Id,
		model.PermissionCreatePagePrivateChannel.Id,
		model.PermissionReadPagePrivateChannel.Id,
		model.PermissionEditPagePrivateChannel.Id,
		model.PermissionDeletePagePrivateChannel.Id,
	)

	_, err = th.App.PatchRole(role, &model.RolePatch{Permissions: &permissions})
	if err != nil {
		panic(err)
	}
}

func TestCreatePageWithContent(t *testing.T) {
	th := Setup(t).InitBasic()
	setupPagePermissions(th)
	defer th.TearDown()
	setupPagePermissions(th)

	t.Run("creates page with empty content", func(t *testing.T) {
		page, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Test Page", "", "", th.BasicUser.Id, "")
		require.Nil(t, err)
		require.NotNil(t, page)
		require.Equal(t, model.PostTypePage, page.Type)
		require.Equal(t, th.BasicChannel.Id, page.ChannelId)
		require.Equal(t, "Test Page", page.Props["title"])
		require.NotEmpty(t, page.Id)

		pageContent, contentErr := th.App.Srv().Store().PageContent().Get(page.Id)
		require.NoError(t, contentErr)
		require.NotNil(t, pageContent)
		require.Equal(t, page.Id, pageContent.PageId)
	})

	t.Run("creates page with JSON content", func(t *testing.T) {
		validContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Test content"}]}]}`
		page, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Test Page", "", validContent, th.BasicUser.Id, "")
		require.Nil(t, err)
		require.NotNil(t, page)

		pageContent, contentErr := th.App.Srv().Store().PageContent().Get(page.Id)
		require.NoError(t, contentErr)
		require.NotNil(t, pageContent)

		jsonContent, jsonErr := pageContent.GetDocumentJSON()
		require.NoError(t, jsonErr)
		require.Contains(t, jsonContent, "Test content")
	})

	t.Run("creates child page with parent", func(t *testing.T) {
		parentPage, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Parent Page", "", "", th.BasicUser.Id, "")
		require.Nil(t, err)

		childPage, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Child Page", parentPage.Id, "", th.BasicUser.Id, "")
		require.Nil(t, err)
		require.NotNil(t, childPage)
		require.Equal(t, parentPage.Id, childPage.PageParentId)
	})

	t.Run("fails with invalid JSON content", func(t *testing.T) {
		invalidContent := `{"invalid json`
		page, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Test Page", "", invalidContent, th.BasicUser.Id, "")
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

		page, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Test Page", regularPost.Id, "", th.BasicUser.Id, "")
		require.NotNil(t, err)
		require.Nil(t, page)
		require.Equal(t, "app.page.create.parent_not_page.app_error", err.Id)
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

		parentPageInOtherChannel, parentErr := th.App.CreatePage(th.Context, otherChannel.Id, "Parent in Other Channel", "", "", th.BasicUser.Id, "")
		require.Nil(t, parentErr)

		page, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Child Page", parentPageInOtherChannel.Id, "", th.BasicUser.Id, "")
		require.NotNil(t, err)
		require.Nil(t, page)
		require.Equal(t, "app.page.create.parent_different_channel.app_error", err.Id)
	})
}

func TestGetPage(t *testing.T) {
	th := Setup(t).InitBasic()
	setupPagePermissions(th)
	defer th.TearDown()
	setupPagePermissions(th)

	sessionCtx := createSessionContext(th)

	t.Run("successfully retrieves page with content", func(t *testing.T) {
		validContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Test content"}]}]}`
		createdPage, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Test Page", "", validContent, th.BasicUser.Id, "")
		require.Nil(t, err)

		retrievedPage, err := th.App.GetPage(sessionCtx, createdPage.Id)
		require.Nil(t, err)
		require.NotNil(t, retrievedPage)
		require.Equal(t, createdPage.Id, retrievedPage.Id)
		require.Contains(t, retrievedPage.Message, "Test content")
	})

	t.Run("fails for non-existent page", func(t *testing.T) {
		page, err := th.App.GetPage(sessionCtx, model.NewId())
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

		page, err := th.App.GetPage(sessionCtx, regularPost.Id)
		require.NotNil(t, err)
		require.Nil(t, page)
		require.Equal(t, "app.page.get.not_a_page.app_error", err.Id)
	})
}

func TestUpdatePage(t *testing.T) {
	th := Setup(t).InitBasic()
	setupPagePermissions(th)
	defer th.TearDown()

	sessionCtx := createSessionContext(th)

	t.Run("successfully updates page title and content", func(t *testing.T) {
		createdPage, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Original Title", "", "", th.BasicUser.Id, "")
		require.Nil(t, err)

		newContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Updated content"}]}]}`
		updatedPage, err := th.App.UpdatePage(sessionCtx, createdPage.Id, "Updated Title", newContent, "")
		require.Nil(t, err)
		require.NotNil(t, updatedPage)
		require.Equal(t, "Updated Title", updatedPage.Props["title"])

		pageContent, contentErr := th.App.Srv().Store().PageContent().Get(updatedPage.Id)
		require.NoError(t, contentErr)
		jsonContent, jsonErr := pageContent.GetDocumentJSON()
		require.NoError(t, jsonErr)
		require.Contains(t, jsonContent, "Updated content")
	})

	t.Run("fails with invalid JSON content", func(t *testing.T) {
		createdPage, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Test Page", "", "", th.BasicUser.Id, "")
		require.Nil(t, err)

		invalidContent := `{"invalid json`
		updatedPage, err := th.App.UpdatePage(sessionCtx, createdPage.Id, "Test Page", invalidContent, "")
		require.NotNil(t, err)
		require.Nil(t, updatedPage)
		require.Equal(t, "app.page.update.invalid_content.app_error", err.Id)
	})

	t.Run("fails for non-existent page", func(t *testing.T) {
		page, err := th.App.UpdatePage(sessionCtx, model.NewId(), "New Title", "", "")
		require.NotNil(t, err)
		require.Nil(t, page)
	})
}

func TestDeletePage(t *testing.T) {
	th := Setup(t).InitBasic()
	setupPagePermissions(th)
	defer th.TearDown()

	sessionCtx := createSessionContext(th)

	t.Run("successfully deletes page and its content", func(t *testing.T) {
		createdPage, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Test Page", "", `{"type":"doc","content":[{"type":"paragraph"}]}`, th.BasicUser.Id, "")
		require.Nil(t, err)

		pageContent, getErr := th.App.Srv().Store().PageContent().Get(createdPage.Id)
		require.NoError(t, getErr)
		require.NotNil(t, pageContent, "PageContent should exist before deletion")

		err = th.App.DeletePage(sessionCtx, createdPage.Id)
		require.Nil(t, err)

		deletedPage, getErr := th.App.Srv().Store().Post().GetSingle(th.Context, createdPage.Id, true)
		require.NoError(t, getErr)
		require.NotNil(t, deletedPage)
		require.NotEqual(t, int64(0), deletedPage.DeleteAt, "Post should be soft-deleted")

		_, getContentErr := th.App.Srv().Store().PageContent().Get(createdPage.Id)
		require.Error(t, getContentErr, "PageContent should be deleted")
		var nfErr *store.ErrNotFound
		require.ErrorAs(t, getContentErr, &nfErr, "Should return NotFound error for deleted PageContent")
	})

	t.Run("fails for non-existent page", func(t *testing.T) {
		err := th.App.DeletePage(sessionCtx, model.NewId())
		require.NotNil(t, err)
	})

	t.Run("deleting parent page orphans children", func(t *testing.T) {
		parent, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Parent Page", "", "", th.BasicUser.Id, "")
		require.Nil(t, err)

		child1, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Child 1", parent.Id, "", th.BasicUser.Id, "")
		require.Nil(t, err)

		child2, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Child 2", parent.Id, "", th.BasicUser.Id, "")
		require.Nil(t, err)

		grandchild, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Grandchild", child1.Id, "", th.BasicUser.Id, "")
		require.Nil(t, err)

		err = th.App.DeletePage(sessionCtx, parent.Id)
		require.Nil(t, err)

		child1After, err := th.App.GetSinglePost(th.Context, child1.Id, false)
		require.Nil(t, err)
		require.Equal(t, parent.Id, child1After.PageParentId, "Child1 should still reference deleted parent (orphaned)")

		child2After, err := th.App.GetSinglePost(th.Context, child2.Id, false)
		require.Nil(t, err)
		require.Equal(t, parent.Id, child2After.PageParentId, "Child2 should still reference deleted parent (orphaned)")

		grandchildAfter, err := th.App.GetSinglePost(th.Context, grandchild.Id, false)
		require.Nil(t, err)
		require.Equal(t, child1.Id, grandchildAfter.PageParentId, "Grandchild should still reference child1 (unaffected)")
	})

	t.Run("deleting middle page in hierarchy orphans only direct children", func(t *testing.T) {
		root, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Root", "", "", th.BasicUser.Id, "")
		require.Nil(t, err)

		middle, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Middle", root.Id, "", th.BasicUser.Id, "")
		require.Nil(t, err)

		leaf, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Leaf", middle.Id, "", th.BasicUser.Id, "")
		require.Nil(t, err)

		err = th.App.DeletePage(sessionCtx, middle.Id)
		require.Nil(t, err)

		rootAfter, err := th.App.GetSinglePost(th.Context, root.Id, false)
		require.Nil(t, err)
		require.Empty(t, rootAfter.PageParentId, "Root should remain a root page")

		leafAfter, err := th.App.GetSinglePost(th.Context, leaf.Id, false)
		require.Nil(t, err)
		require.Equal(t, middle.Id, leafAfter.PageParentId, "Leaf should reference deleted middle page (orphaned)")
	})

	t.Run("GetPageChildren excludes deleted parent's children with soft delete", func(t *testing.T) {
		parent, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Parent to Delete", "", "", th.BasicUser.Id, "")
		require.Nil(t, err)

		child, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Child", parent.Id, "", th.BasicUser.Id, "")
		require.Nil(t, err)

		err = th.App.DeletePage(sessionCtx, parent.Id)
		require.Nil(t, err)

		_, err = th.App.GetPageChildren(sessionCtx, parent.Id, model.GetPostsOptions{})
		require.NotNil(t, err, "GetPageChildren should fail for deleted parent")

		childAfter, err := th.App.GetSinglePost(th.Context, child.Id, false)
		require.Nil(t, err)
		require.Equal(t, parent.Id, childAfter.PageParentId, "Child still has reference to deleted parent")
	})
}

func TestGetPageChildren(t *testing.T) {
	th := Setup(t).InitBasic()
	setupPagePermissions(th)
	defer th.TearDown()

	sessionCtx := createSessionContext(th)

	t.Run("retrieves all child pages", func(t *testing.T) {
		parentPage, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Parent Page", "", "", th.BasicUser.Id, "")
		require.Nil(t, err)

		child1, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Child 1", parentPage.Id, "", th.BasicUser.Id, "")
		require.Nil(t, err)

		child2, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Child 2", parentPage.Id, "", th.BasicUser.Id, "")
		require.Nil(t, err)

		children, err := th.App.GetPageChildren(sessionCtx, parentPage.Id, model.GetPostsOptions{})
		require.Nil(t, err)
		require.NotNil(t, children)
		require.Len(t, children.Posts, 2)
		require.Contains(t, children.Posts, child1.Id)
		require.Contains(t, children.Posts, child2.Id)
	})

	t.Run("returns empty list for page with no children", func(t *testing.T) {
		page, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Page No Children", "", "", th.BasicUser.Id, "")
		require.Nil(t, err)

		children, err := th.App.GetPageChildren(sessionCtx, page.Id, model.GetPostsOptions{})
		require.Nil(t, err)
		require.NotNil(t, children)
		require.Len(t, children.Posts, 0)
	})
}

func TestGetPageAncestors(t *testing.T) {
	th := Setup(t).InitBasic()
	setupPagePermissions(th)
	defer th.TearDown()

	sessionCtx := createSessionContext(th)

	t.Run("retrieves all ancestors in order", func(t *testing.T) {
		grandparent, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Grandparent", "", "", th.BasicUser.Id, "")
		require.Nil(t, err)

		parent, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Parent", grandparent.Id, "", th.BasicUser.Id, "")
		require.Nil(t, err)

		child, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Child", parent.Id, "", th.BasicUser.Id, "")
		require.Nil(t, err)

		ancestors, err := th.App.GetPageAncestors(sessionCtx, child.Id)
		require.Nil(t, err)
		require.NotNil(t, ancestors)
		require.Len(t, ancestors.Posts, 2)
		require.Contains(t, ancestors.Posts, parent.Id)
		require.Contains(t, ancestors.Posts, grandparent.Id)
	})

	t.Run("returns empty list for root page", func(t *testing.T) {
		rootPage, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Root Page", "", "", th.BasicUser.Id, "")
		require.Nil(t, err)

		ancestors, err := th.App.GetPageAncestors(sessionCtx, rootPage.Id)
		require.Nil(t, err)
		require.NotNil(t, ancestors)
		require.Len(t, ancestors.Posts, 0)
	})
}

func TestGetPageDescendants(t *testing.T) {
	th := Setup(t).InitBasic()
	setupPagePermissions(th)
	defer th.TearDown()

	sessionCtx := createSessionContext(th)

	t.Run("retrieves all descendants recursively", func(t *testing.T) {
		root, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Root", "", "", th.BasicUser.Id, "")
		require.Nil(t, err)

		child1, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Child 1", root.Id, "", th.BasicUser.Id, "")
		require.Nil(t, err)

		child2, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Child 2", root.Id, "", th.BasicUser.Id, "")
		require.Nil(t, err)

		grandchild, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Grandchild", child1.Id, "", th.BasicUser.Id, "")
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
	th := Setup(t).InitBasic()
	setupPagePermissions(th)
	defer th.TearDown()

	sessionCtx := createSessionContext(th)

	t.Run("retrieves all pages in channel", func(t *testing.T) {
		page1, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Page 1", "", "", th.BasicUser.Id, "")
		require.Nil(t, err)

		page2, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Page 2", "", "", th.BasicUser.Id, "")
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
	th := Setup(t).InitBasic()
	setupPagePermissions(th)
	defer th.TearDown()

	sessionCtx := createSessionContext(th)

	t.Run("successfully changes page parent", func(t *testing.T) {
		newParent, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "New Parent", "", "", th.BasicUser.Id, "")
		require.Nil(t, err)

		child, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Child", "", "", th.BasicUser.Id, "")
		require.Nil(t, err)

		err = th.App.ChangePageParent(sessionCtx, child.Id, newParent.Id)
		require.Nil(t, err)

		updatedChild, getErr := th.App.Srv().Store().Post().GetSingle(th.Context, child.Id, false)
		require.NoError(t, getErr)
		require.Equal(t, newParent.Id, updatedChild.PageParentId)
	})

	t.Run("successfully makes page a root page", func(t *testing.T) {
		parent, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Parent", "", "", th.BasicUser.Id, "")
		require.Nil(t, err)

		child, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Child", parent.Id, "", th.BasicUser.Id, "")
		require.Nil(t, err)

		err = th.App.ChangePageParent(sessionCtx, child.Id, "")
		require.Nil(t, err)

		updatedChild, getErr := th.App.Srv().Store().Post().GetSingle(th.Context, child.Id, false)
		require.NoError(t, getErr)
		require.Empty(t, updatedChild.PageParentId)
	})

	t.Run("fails when creating circular reference", func(t *testing.T) {
		parent, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Parent", "", "", th.BasicUser.Id, "")
		require.Nil(t, err)

		child, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Child", parent.Id, "", th.BasicUser.Id, "")
		require.Nil(t, err)

		err = th.App.ChangePageParent(sessionCtx, parent.Id, child.Id)
		require.NotNil(t, err)
		require.Equal(t, "app.page.change_parent.circular_reference.app_error", err.Id)
	})

	t.Run("fails when setting page as its own parent (direct cycle)", func(t *testing.T) {
		page, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Page", "", "", th.BasicUser.Id, "")
		require.Nil(t, err)

		err = th.App.ChangePageParent(sessionCtx, page.Id, page.Id)
		require.NotNil(t, err)
		require.Equal(t, "app.page.change_parent.circular_reference.app_error", err.Id)
	})

	t.Run("fails when creating multi-level circular reference (A→B→C→A)", func(t *testing.T) {
		pageA, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Page A", "", "", th.BasicUser.Id, "")
		require.Nil(t, err)

		pageB, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Page B", pageA.Id, "", th.BasicUser.Id, "")
		require.Nil(t, err)

		pageC, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Page C", pageB.Id, "", th.BasicUser.Id, "")
		require.Nil(t, err)

		err = th.App.ChangePageParent(sessionCtx, pageA.Id, pageC.Id)
		require.NotNil(t, err)
		require.Equal(t, "app.page.change_parent.circular_reference.app_error", err.Id)
	})

	t.Run("fails when new parent is not a page", func(t *testing.T) {
		child, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Child", "", "", th.BasicUser.Id, "")
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

		parentInOtherChannel, err := th.App.CreatePage(th.Context, otherChannel.Id, "Parent in Other Channel", "", "", th.BasicUser.Id, "")
		require.Nil(t, err)

		child, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Child", "", "", th.BasicUser.Id, "")
		require.Nil(t, err)

		err = th.App.ChangePageParent(sessionCtx, child.Id, parentInOtherChannel.Id)
		require.NotNil(t, err)
		require.Equal(t, "app.page.change_parent.invalid_parent.app_error", err.Id)
	})
}

func TestPageDepthLimit(t *testing.T) {
	th := Setup(t).InitBasic()
	setupPagePermissions(th)
	defer th.TearDown()

	sessionCtx := createSessionContext(th)

	t.Run("allows creating pages up to max depth", func(t *testing.T) {
		var parentID string
		var lastPage *model.Post

		for i := range model.PostPageMaxDepth {
			page, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Page Level "+string(rune('0'+i)), parentID, "", th.BasicUser.Id, "")
			require.Nil(t, err, "Failed to create page at depth %d", i)
			require.NotNil(t, page)
			parentID = page.Id
			lastPage = page
		}

		require.NotNil(t, lastPage)
		depth, err := th.App.calculatePageDepth(th.Context, lastPage.Id)
		require.Nil(t, err)
		require.Equal(t, model.PostPageMaxDepth-1, depth, "Last page should be at max depth-1")
	})

	t.Run("prevents creating page beyond max depth", func(t *testing.T) {
		var parentID string

		for i := range model.PostPageMaxDepth {
			page, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Depth Page "+string(rune('A'+i)), parentID, "", th.BasicUser.Id, "")
			require.Nil(t, err)
			parentID = page.Id
		}

		tooDeepPage, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Too Deep Page", parentID, "", th.BasicUser.Id, "")
		require.NotNil(t, err)
		require.Nil(t, tooDeepPage)
		require.Equal(t, "app.page.create.max_depth_exceeded.app_error", err.Id)
	})

	t.Run("prevents moving page to exceed max depth", func(t *testing.T) {
		var deepParentID string
		for i := range model.PostPageMaxDepth {
			page, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Deep Chain "+string(rune('0'+i)), deepParentID, "", th.BasicUser.Id, "")
			require.Nil(t, err)
			deepParentID = page.Id
		}

		separatePage, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Separate Page", "", "", th.BasicUser.Id, "")
		require.Nil(t, err)

		err = th.App.ChangePageParent(sessionCtx, separatePage.Id, deepParentID)
		require.NotNil(t, err)
		require.Equal(t, "app.page.change_parent.max_depth_exceeded.app_error", err.Id)
	})

	t.Run("allows moving page within depth limit", func(t *testing.T) {
		parent2, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Parent 2", "", "", th.BasicUser.Id, "")
		require.Nil(t, err)

		child, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Child", "", "", th.BasicUser.Id, "")
		require.Nil(t, err)

		err = th.App.ChangePageParent(sessionCtx, child.Id, parent2.Id)
		require.Nil(t, err)

		updatedChild, err := th.App.GetSinglePost(th.Context, child.Id, false)
		require.Nil(t, err)
		require.Equal(t, parent2.Id, updatedChild.PageParentId)
	})

	t.Run("calculatePageDepth returns correct depth", func(t *testing.T) {
		level1, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Level 1", "", "", th.BasicUser.Id, "")
		require.Nil(t, err)

		depth, err := th.App.calculatePageDepth(th.Context, level1.Id)
		require.Nil(t, err)
		require.Equal(t, 0, depth, "Level 1 page (root) should have depth 0")

		level2, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Level 2", level1.Id, "", th.BasicUser.Id, "")
		require.Nil(t, err)

		depth, err = th.App.calculatePageDepth(th.Context, level2.Id)
		require.Nil(t, err)
		require.Equal(t, 1, depth, "Level 2 page should have depth 1")

		level3, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Level 3", level2.Id, "", th.BasicUser.Id, "")
		require.Nil(t, err)

		depth, err = th.App.calculatePageDepth(th.Context, level3.Id)
		require.Nil(t, err)
		require.Equal(t, 2, depth, "Level 3 page should have depth 2")
	})
}

func TestHasPermissionToModifyPage(t *testing.T) {
	th := Setup(t).InitBasic()
	setupPagePermissions(th)
	defer th.TearDown()

	th.SetupPagePermissions()

	t.Run("Create operation - public channel", func(t *testing.T) {
		t.Run("user with create_page_public_channel permission succeeds", func(t *testing.T) {
			page, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Test Page", "", "", th.BasicUser.Id, "")
			require.Nil(t, err)

			session, _ := th.App.CreateSession(th.Context, &model.Session{UserId: th.BasicUser.Id})
			err = th.App.HasPermissionToModifyPage(th.Context, session, page, PageOperationCreate, "test")
			require.Nil(t, err)
		})

		t.Run("user without create_page_public_channel permission fails", func(t *testing.T) {
			page, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Test Page", "", "", th.BasicUser.Id, "")
			require.Nil(t, err)

			guestRole, _ := th.App.GetRoleByName(th.Context, "channel_guest")
			originalPerms := guestRole.Permissions
			guestRole.Permissions = []string{model.PermissionReadPagePublicChannel.Id}
			_, _ = th.App.UpdateRole(guestRole)
			defer func() {
				guestRole.Permissions = originalPerms
				_, _ = th.App.UpdateRole(guestRole)
			}()

			guest := th.CreateGuest()
			th.LinkUserToTeam(guest, th.BasicTeam)
			th.AddUserToChannel(guest, th.BasicChannel)

			session, _ := th.App.CreateSession(th.Context, &model.Session{UserId: guest.Id})
			err = th.App.HasPermissionToModifyPage(th.Context, session, page, PageOperationCreate, "test")
			require.NotNil(t, err)
			require.Equal(t, "api.context.permissions.app_error", err.Id)
		})
	})

	t.Run("Read operation - public channel", func(t *testing.T) {
		t.Run("user with read_page_public_channel permission succeeds", func(t *testing.T) {
			page, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Test Page", "", "", th.BasicUser.Id, "")
			require.Nil(t, err)

			session, _ := th.App.CreateSession(th.Context, &model.Session{UserId: th.BasicUser.Id})
			err = th.App.HasPermissionToModifyPage(th.Context, session, page, PageOperationRead, "test")
			require.Nil(t, err)
		})
	})

	t.Run("Edit operation - public channel", func(t *testing.T) {
		t.Run("author with edit_page_public_channel permission succeeds", func(t *testing.T) {
			page, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Test Page", "", "", th.BasicUser.Id, "")
			require.Nil(t, err)

			session, _ := th.App.CreateSession(th.Context, &model.Session{UserId: th.BasicUser.Id})
			err = th.App.HasPermissionToModifyPage(th.Context, session, page, PageOperationEdit, "test")
			require.Nil(t, err)
		})

		t.Run("non-author with edit_page_public_channel but not channel admin fails", func(t *testing.T) {
			// Ensure channel_user role doesn't have admin permission
			th.RemovePermissionFromRole(model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
			defer th.AddPermissionToRole(model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)

			page, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Test Page", "", "", th.BasicUser.Id, "")
			require.Nil(t, err)

			otherUser := th.CreateUser()
			th.LinkUserToTeam(otherUser, th.BasicTeam)
			th.AddUserToChannel(otherUser, th.BasicChannel)

			session, _ := th.App.CreateSession(th.Context, &model.Session{UserId: otherUser.Id})
			err = th.App.HasPermissionToModifyPage(th.Context, session, page, PageOperationEdit, "test")
			require.NotNil(t, err)
			require.Equal(t, "api.context.permissions.app_error", err.Id)
		})

		t.Run("channel admin can edit others pages", func(t *testing.T) {
			page, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Test Page", "", "", th.BasicUser.Id, "")
			require.Nil(t, err)

			admin := th.CreateUser()
			th.LinkUserToTeam(admin, th.BasicTeam)
			th.AddUserToChannel(admin, th.BasicChannel)
			_, appErr := th.App.UpdateChannelMemberRoles(th.Context, th.BasicChannel.Id, admin.Id, "channel_user channel_admin")
			require.Nil(t, appErr)

			session, _ := th.App.CreateSession(th.Context, &model.Session{UserId: admin.Id})
			err = th.App.HasPermissionToModifyPage(th.Context, session, page, PageOperationEdit, "test")
			require.Nil(t, err)
		})
	})

	t.Run("Delete operation - public channel", func(t *testing.T) {
		t.Run("author with delete_page_public_channel permission succeeds", func(t *testing.T) {
			page, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Test Page", "", "", th.BasicUser.Id, "")
			require.Nil(t, err)

			session, _ := th.App.CreateSession(th.Context, &model.Session{UserId: th.BasicUser.Id})
			err = th.App.HasPermissionToModifyPage(th.Context, session, page, PageOperationDelete, "test")
			require.Nil(t, err)
		})

		t.Run("non-author with delete_page_public_channel but not channel admin fails", func(t *testing.T) {
			// Ensure channel_user role doesn't have admin permission
			th.RemovePermissionFromRole(model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
			defer th.AddPermissionToRole(model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)

			page, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Test Page", "", "", th.BasicUser.Id, "")
			require.Nil(t, err)

			otherUser := th.CreateUser()
			th.LinkUserToTeam(otherUser, th.BasicTeam)
			th.AddUserToChannel(otherUser, th.BasicChannel)

			session, _ := th.App.CreateSession(th.Context, &model.Session{UserId: otherUser.Id})
			err = th.App.HasPermissionToModifyPage(th.Context, session, page, PageOperationDelete, "test")
			require.NotNil(t, err)
			require.Equal(t, "api.context.permissions.app_error", err.Id)
		})

		t.Run("channel admin can delete others pages", func(t *testing.T) {
			page, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Test Page", "", "", th.BasicUser.Id, "")
			require.Nil(t, err)

			admin := th.CreateUser()
			th.LinkUserToTeam(admin, th.BasicTeam)
			th.AddUserToChannel(admin, th.BasicChannel)
			_, appErr := th.App.UpdateChannelMemberRoles(th.Context, th.BasicChannel.Id, admin.Id, "channel_user channel_admin")
			require.Nil(t, appErr)

			session, _ := th.App.CreateSession(th.Context, &model.Session{UserId: admin.Id})
			err = th.App.HasPermissionToModifyPage(th.Context, session, page, PageOperationDelete, "test")
			require.Nil(t, err)
		})
	})

	t.Run("Private channel permissions", func(t *testing.T) {
		privateChannel, err := th.App.CreateChannel(th.Context, &model.Channel{
			TeamId:      th.BasicTeam.Id,
			Name:        "private-channel",
			DisplayName: "Private Channel",
			Type:        model.ChannelTypePrivate,
		}, false)
		require.Nil(t, err)

		_, err = th.App.AddUserToChannel(th.Context, th.BasicUser, privateChannel, false)
		require.Nil(t, err)

		t.Run("user with private channel permissions succeeds", func(t *testing.T) {
			page, err := th.App.CreatePage(th.Context, privateChannel.Id, "Private Page", "", "", th.BasicUser.Id, "")
			require.Nil(t, err)

			session, _ := th.App.CreateSession(th.Context, &model.Session{UserId: th.BasicUser.Id})
			err = th.App.HasPermissionToModifyPage(th.Context, session, page, PageOperationCreate, "test")
			require.Nil(t, err)
		})
	})

	t.Run("DM and GM channels allow all operations for non-guests", func(t *testing.T) {
		otherUser := th.CreateUser()
		dmChannel, err := th.App.GetOrCreateDirectChannel(th.Context, th.BasicUser.Id, otherUser.Id)
		require.Nil(t, err)

		page, err := th.App.CreatePage(th.Context, dmChannel.Id, "DM Page", "", "", th.BasicUser.Id, "")
		require.Nil(t, err)

		session, _ := th.App.CreateSession(th.Context, &model.Session{UserId: otherUser.Id})

		err = th.App.HasPermissionToModifyPage(th.Context, session, page, PageOperationCreate, "test")
		require.Nil(t, err)

		err = th.App.HasPermissionToModifyPage(th.Context, session, page, PageOperationRead, "test")
		require.Nil(t, err)
	})
}

func TestExtractMentionsFromTipTapContent(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

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

		mentions, err := th.App.ExtractMentionsFromTipTapContent(content)
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

		mentions, err := th.App.ExtractMentionsFromTipTapContent(content)
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

		mentions, err := th.App.ExtractMentionsFromTipTapContent(content)
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

		mentions, err := th.App.ExtractMentionsFromTipTapContent(content)
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

		mentions, err := th.App.ExtractMentionsFromTipTapContent(content)
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

		mentions, err := th.App.ExtractMentionsFromTipTapContent(content)
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

		mentions, err := th.App.ExtractMentionsFromTipTapContent(content)
		require.NoError(t, err)
		require.Len(t, mentions, 0)
	})

	t.Run("returns empty array for empty document", func(t *testing.T) {
		content := `{
			"type": "doc",
			"content": []
		}`

		mentions, err := th.App.ExtractMentionsFromTipTapContent(content)
		require.NoError(t, err)
		require.Len(t, mentions, 0)
	})

	t.Run("handles malformed JSON gracefully", func(t *testing.T) {
		content := `{"invalid json`

		mentions, err := th.App.ExtractMentionsFromTipTapContent(content)
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

		mentions, err := th.App.ExtractMentionsFromTipTapContent(content)
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

		mentions, err := th.App.ExtractMentionsFromTipTapContent(content)
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

		mentions, err := th.App.ExtractMentionsFromTipTapContent(content)
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

		mentions, err := th.App.ExtractMentionsFromTipTapContent(content)
		require.NoError(t, err)
		require.Len(t, mentions, 2)
		require.Contains(t, mentions, "user1")
		require.Contains(t, mentions, "user2")
	})
}

func TestCreatePageComment(t *testing.T) {
	th := Setup(t).InitBasic()
	setupPagePermissions(th)
	defer th.TearDown()

	rctx := createSessionContext(th)

	page, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Test Page", "", "", th.BasicUser.Id, "")
	require.Nil(t, err)
	require.NotNil(t, page)

	t.Run("successfully creates top-level page comment", func(t *testing.T) {
		comment, appErr := th.App.CreatePageComment(rctx, page.Id, "This is a comment on the page")
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
		comment, appErr := th.App.CreatePageComment(rctx, "invalid_page_id", "Comment on non-existent page")
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

		comment, appErr := th.App.CreatePageComment(rctx, regularPost.Id, "Comment on regular post")
		require.NotNil(t, appErr)
		require.Nil(t, comment)
		require.Equal(t, "app.page.create_comment.not_a_page.app_error", appErr.Id)
	})

	t.Run("creates multiple comments on same page", func(t *testing.T) {
		comment1, appErr := th.App.CreatePageComment(rctx, page.Id, "First comment")
		require.Nil(t, appErr)
		require.NotNil(t, comment1)

		comment2, appErr := th.App.CreatePageComment(rctx, page.Id, "Second comment")
		require.Nil(t, appErr)
		require.NotNil(t, comment2)

		require.NotEqual(t, comment1.Id, comment2.Id)
		require.Equal(t, page.Id, comment1.RootId)
		require.Equal(t, page.Id, comment2.RootId)
	})
}

func TestCreatePageCommentReply(t *testing.T) {
	th := Setup(t).InitBasic()
	setupPagePermissions(th)
	defer th.TearDown()

	rctx := createSessionContext(th)

	page, err := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Test Page", "", "", th.BasicUser.Id, "")
	require.Nil(t, err)

	topLevelComment, appErr := th.App.CreatePageComment(rctx, page.Id, "Top-level comment")
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
}
