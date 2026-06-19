// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func TestBuildBreadcrumbPath(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	sessionCtx := th.CreateSessionContext()

	wiki := &model.Wiki{
		Title: "Test Wiki",
	}
	wiki, err := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, err)

	// Create hierarchy: grandparent -> parent -> child
	grandparent, appErr := th.App.CreatePage(th.Context, th.BasicWiki.ChannelId, "Grandparent", "", "", th.BasicUser.Id, "", "")
	require.Nil(t, appErr)

	parent, appErr := th.App.CreatePage(th.Context, th.BasicWiki.ChannelId, "Parent", grandparent.Id, "", th.BasicUser.Id, "", "")
	require.Nil(t, appErr)

	child, appErr := th.App.CreatePage(th.Context, th.BasicWiki.ChannelId, "Child", parent.Id, "", th.BasicUser.Id, "", "")
	require.Nil(t, appErr)

	t.Run("build breadcrumb for deeply nested page", func(t *testing.T) {
		breadcrumb, appErr := th.App.BuildBreadcrumbPath(sessionCtx, child, wiki)
		require.Nil(t, appErr)
		require.NotNil(t, breadcrumb)
		require.NotNil(t, breadcrumb.Items)
		require.NotNil(t, breadcrumb.CurrentPage)
		// Items should include wiki, channel, and ancestors
		require.GreaterOrEqual(t, len(breadcrumb.Items), 2)
	})

	t.Run("build breadcrumb for root page", func(t *testing.T) {
		breadcrumb, appErr := th.App.BuildBreadcrumbPath(sessionCtx, grandparent, wiki)
		require.Nil(t, appErr)
		require.NotNil(t, breadcrumb)
		require.NotNil(t, breadcrumb.Items)
	})
}

func TestCalculateMaxDepthFromPostList(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	rctx := th.CreateSessionContext()

	// Create a hierarchy for testing
	root, appErr := th.App.CreatePage(th.Context, th.BasicWiki.ChannelId, "Root", "", "", th.BasicUser.Id, "", "")
	require.Nil(t, appErr)

	child, appErr := th.App.CreatePage(th.Context, th.BasicWiki.ChannelId, "Child", root.Id, "", th.BasicUser.Id, "", "")
	require.Nil(t, appErr)

	_, appErr = th.App.CreatePage(th.Context, th.BasicWiki.ChannelId, "Grandchild", child.Id, "", th.BasicUser.Id, "", "")
	require.Nil(t, appErr)

	t.Run("calculate max depth", func(t *testing.T) {
		postList, appErr := th.App.GetChannelPages(rctx, th.BasicWiki.ChannelId, 0, 0)
		require.Nil(t, appErr)

		maxDepth := th.App.calculateMaxDepthFromPages(postList)
		// Should have at least depth 2 (root=0, child=1, grandchild=2)
		require.GreaterOrEqual(t, maxDepth, 2)
	})
}

func TestCalculatePageDepth(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	rctx := th.CreateSessionContext()

	// Create hierarchy: root -> child -> grandchild
	root, appErr := th.App.CreatePage(th.Context, th.BasicWiki.ChannelId, "Root Depth", "", "", th.BasicUser.Id, "", "")
	require.Nil(t, appErr)

	child, appErr := th.App.CreatePage(th.Context, th.BasicWiki.ChannelId, "Child Depth", root.Id, "", th.BasicUser.Id, "", "")
	require.Nil(t, appErr)

	grandchild, appErr := th.App.CreatePage(th.Context, th.BasicWiki.ChannelId, "Grandchild Depth", child.Id, "", th.BasicUser.Id, "", "")
	require.Nil(t, appErr)

	t.Run("root page has depth 0", func(t *testing.T) {
		depth, appErr := th.App.calculatePageDepth(rctx, root.Id, nil)
		require.Nil(t, appErr)
		require.Equal(t, 0, depth)
	})

	t.Run("child page has depth 1", func(t *testing.T) {
		depth, appErr := th.App.calculatePageDepth(rctx, child.Id, nil)
		require.Nil(t, appErr)
		require.Equal(t, 1, depth)
	})

	t.Run("grandchild page has depth 2", func(t *testing.T) {
		depth, appErr := th.App.calculatePageDepth(rctx, grandchild.Id, nil)
		require.Nil(t, appErr)
		require.Equal(t, 2, depth)
	})
}

func TestCalculateSubtreeMaxDepth(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	rctx := th.CreateSessionContext()

	// Create hierarchy: root -> child -> grandchild
	root, appErr := th.App.CreatePage(th.Context, th.BasicWiki.ChannelId, "Root Subtree", "", "", th.BasicUser.Id, "", "")
	require.Nil(t, appErr)

	child, appErr := th.App.CreatePage(th.Context, th.BasicWiki.ChannelId, "Child Subtree", root.Id, "", th.BasicUser.Id, "", "")
	require.Nil(t, appErr)

	_, appErr = th.App.CreatePage(th.Context, th.BasicWiki.ChannelId, "Grandchild Subtree", child.Id, "", th.BasicUser.Id, "", "")
	require.Nil(t, appErr)

	t.Run("root subtree has max depth 2", func(t *testing.T) {
		depth, appErr := th.App.calculateSubtreeMaxDepth(rctx, root.Id)
		require.Nil(t, appErr)
		require.Equal(t, 2, depth)
	})

	t.Run("child subtree has max depth 1", func(t *testing.T) {
		depth, appErr := th.App.calculateSubtreeMaxDepth(rctx, child.Id)
		require.Nil(t, appErr)
		require.Equal(t, 1, depth)
	})

	t.Run("leaf page has subtree depth 0", func(t *testing.T) {
		leaf, appErr := th.App.CreatePage(th.Context, th.BasicWiki.ChannelId, "Leaf", "", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		depth, appErr := th.App.calculateSubtreeMaxDepth(rctx, leaf.Id)
		require.Nil(t, appErr)
		require.Equal(t, 0, depth)
	})
}

// pageIDsContain reports whether any page in pages has the given id.
func pageIDsContain(pages []*model.Page, id string) bool {
	for _, p := range pages {
		if p.Id == id {
			return true
		}
	}
	return false
}
