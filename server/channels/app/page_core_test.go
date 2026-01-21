// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func TestGetPage(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	page, appErr := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Test Page", "", "", th.BasicUser.Id, "", "")
	require.Nil(t, appErr)

	t.Run("get existing page", func(t *testing.T) {
		retrievedPage, appErr := th.App.GetPage(th.Context, page.Id)
		require.Nil(t, appErr)
		require.NotNil(t, retrievedPage)
		require.Equal(t, page.Id, retrievedPage.Id())
	})

	t.Run("fail for non-existent page", func(t *testing.T) {
		retrievedPage, appErr := th.App.GetPage(th.Context, model.NewId())
		require.NotNil(t, appErr)
		require.Nil(t, retrievedPage)
		require.Equal(t, "app.page.get.not_found.app_error", appErr.Id)
	})

	t.Run("fail for non-page post", func(t *testing.T) {
		// Create a regular post
		regularPost, _, err := th.App.CreatePost(th.Context, &model.Post{
			ChannelId: th.BasicChannel.Id,
			UserId:    th.BasicUser.Id,
			Message:   "Regular message",
		}, th.BasicChannel, model.CreatePostFlags{})
		require.Nil(t, err)

		retrievedPage, appErr := th.App.GetPage(th.Context, regularPost.Id)
		require.NotNil(t, appErr)
		require.Nil(t, retrievedPage)
		require.Equal(t, "app.page.get.not_a_page.app_error", appErr.Id)
	})
}

func TestGetPageWithDeleted(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	wiki := &model.Wiki{
		ChannelId: th.BasicChannel.Id,
		Title:     "Test Wiki",
	}
	wiki, err := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, err)

	page, appErr := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Test Page", "", "", th.BasicUser.Id, "", "")
	require.Nil(t, appErr)

	// Delete the page
	pageObj, _ := th.App.GetPage(th.Context, page.Id)
	appErr = th.App.DeletePage(th.Context, pageObj, wiki.Id)
	require.Nil(t, appErr)

	t.Run("get deleted page with GetPageWithDeleted", func(t *testing.T) {
		retrievedPage, appErr := th.App.GetPageWithDeleted(th.Context, page.Id)
		require.Nil(t, appErr)
		require.NotNil(t, retrievedPage)
		require.NotZero(t, retrievedPage.DeleteAt())
	})

	t.Run("fail to get deleted page with GetPage", func(t *testing.T) {
		retrievedPage, appErr := th.App.GetPage(th.Context, page.Id)
		require.NotNil(t, appErr)
		require.Nil(t, retrievedPage)
	})
}

func TestGetParentPage(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	t.Run("get parent for root page (empty parent)", func(t *testing.T) {
		parentPage, appErr := th.App.GetParentPage(th.Context, "")
		require.Nil(t, appErr)
		require.Nil(t, parentPage)
	})

	t.Run("get parent for child page", func(t *testing.T) {
		parent, appErr := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Parent", "", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		parentPage, appErr := th.App.GetParentPage(th.Context, parent.Id)
		require.Nil(t, appErr)
		require.NotNil(t, parentPage)
		require.Equal(t, parent.Id, parentPage.Id())
	})

	t.Run("fail for non-existent parent", func(t *testing.T) {
		parentPage, appErr := th.App.GetParentPage(th.Context, model.NewId())
		require.NotNil(t, appErr)
		require.Nil(t, parentPage)
	})
}

func TestGetParentPageRequired(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	t.Run("fail with empty parent id", func(t *testing.T) {
		parentPage, appErr := th.App.GetParentPageRequired(th.Context, "")
		require.NotNil(t, appErr)
		require.Nil(t, parentPage)
		require.Equal(t, "app.page.parent_required.app_error", appErr.Id)
	})

	t.Run("get parent successfully", func(t *testing.T) {
		parent, appErr := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Parent", "", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		parentPage, appErr := th.App.GetParentPageRequired(th.Context, parent.Id)
		require.Nil(t, appErr)
		require.NotNil(t, parentPage)
	})
}

func TestPlainTextConversion(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	rctx := th.CreateSessionContext()

	t.Run("plain text content is converted to TipTap JSON", func(t *testing.T) {
		plainTextContent := "This is plain text content"
		page, appErr := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Plain Text Page", "", plainTextContent, th.BasicUser.Id, "", "")
		require.Nil(t, appErr)
		require.NotNil(t, page)

		pageWithContent, appErr := th.App.GetPageWithContent(rctx, page.Id)
		require.Nil(t, appErr)
		require.Contains(t, pageWithContent.Message, "type")
		require.Contains(t, pageWithContent.Message, "doc")
	})
}
