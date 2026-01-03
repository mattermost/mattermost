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

	wiki := &model.Wiki{
		ChannelId: th.BasicChannel.Id,
		Title:     "Test Wiki",
	}
	wiki, err := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, err)

	channel, err := th.App.GetChannel(th.Context, th.BasicChannel.Id)
	require.Nil(t, err)

	// Create hierarchy: grandparent -> parent -> child
	grandparent, appErr := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Grandparent", "", "", th.BasicUser.Id, "", "")
	require.Nil(t, appErr)

	parent, appErr := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Parent", grandparent.Id, "", th.BasicUser.Id, "", "")
	require.Nil(t, appErr)

	child, appErr := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Child", parent.Id, "", th.BasicUser.Id, "", "")
	require.Nil(t, appErr)

	t.Run("build breadcrumb for deeply nested page", func(t *testing.T) {
		breadcrumb, appErr := th.App.BuildBreadcrumbPath(th.Context, child, wiki, channel)
		require.Nil(t, appErr)
		require.NotNil(t, breadcrumb)
		require.NotNil(t, breadcrumb.Items)
		require.NotNil(t, breadcrumb.CurrentPage)
		// Items should include wiki, channel, and ancestors
		require.GreaterOrEqual(t, len(breadcrumb.Items), 2)
	})

	t.Run("build breadcrumb for root page", func(t *testing.T) {
		breadcrumb, appErr := th.App.BuildBreadcrumbPath(th.Context, grandparent, wiki, channel)
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
	root, appErr := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Root", "", "", th.BasicUser.Id, "", "")
	require.Nil(t, appErr)

	child, appErr := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Child", root.Id, "", th.BasicUser.Id, "", "")
	require.Nil(t, appErr)

	_, appErr = th.App.CreatePage(th.Context, th.BasicChannel.Id, "Grandchild", child.Id, "", th.BasicUser.Id, "", "")
	require.Nil(t, appErr)

	t.Run("calculate max depth", func(t *testing.T) {
		postList, appErr := th.App.GetChannelPages(rctx, th.BasicChannel.Id)
		require.Nil(t, appErr)

		maxDepth := th.App.calculateMaxDepthFromPostList(postList)
		// Should have at least depth 2 (root=0, child=1, grandchild=2)
		require.GreaterOrEqual(t, maxDepth, 2)
	})
}
