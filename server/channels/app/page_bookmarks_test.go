// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func TestCreateBookmarkFromPage(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	// Configure SiteURL required for bookmark URL generation
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.SiteURL = "http://localhost:8065"
	})

	// Create a context with a session for permission checks
	rctx := th.CreateSessionContext()

	// Create wiki and page with proper association
	wiki := th.CreateTestWiki(t, "Test Wiki")
	page := th.CreateTestWikiPage(t, wiki.Id, "Test Page for Bookmark")

	pageObj, _ := th.App.GetPage(th.Context, page.Id)

	t.Run("create bookmark from page successfully", func(t *testing.T) {
		bookmark, appErr := th.App.CreateBookmarkFromPage(rctx, pageObj, th.BasicChannel.Id, "Page Bookmark", "", "")
		require.Nil(t, appErr)
		require.NotNil(t, bookmark)
		require.Equal(t, "Page Bookmark", bookmark.DisplayName)
		require.Equal(t, th.BasicChannel.Id, bookmark.ChannelId)
	})

	t.Run("create bookmark with emoji", func(t *testing.T) {
		bookmark, appErr := th.App.CreateBookmarkFromPage(rctx, pageObj, th.BasicChannel.Id, "Emoji Bookmark", ":book:", "")
		require.Nil(t, appErr)
		require.NotNil(t, bookmark)
		require.Equal(t, "book", bookmark.Emoji) // colons are stripped by PreSave
	})

	t.Run("create bookmark with connection id", func(t *testing.T) {
		connectionId := model.NewId()
		bookmark, appErr := th.App.CreateBookmarkFromPage(rctx, pageObj, th.BasicChannel.Id, "Connected Bookmark", "", connectionId)
		require.Nil(t, appErr)
		require.NotNil(t, bookmark)
	})

	t.Run("fail with empty channel id", func(t *testing.T) {
		bookmark, appErr := th.App.CreateBookmarkFromPage(rctx, pageObj, "", "Empty Channel Bookmark", "", "")
		require.NotNil(t, appErr)
		require.Nil(t, bookmark)
	})
}
