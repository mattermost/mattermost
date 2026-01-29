// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func TestHandlePageUpdateNotification(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	wiki := &model.Wiki{
		ChannelId: th.BasicChannel.Id,
		Title:     "Test Wiki",
	}
	_, err := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, err)

	page, appErr := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Notification Test Page", "", "", th.BasicUser.Id, "", "")
	require.Nil(t, appErr)

	t.Run("handle page update notification - no panic", func(t *testing.T) {
		// This test verifies the function doesn't panic
		// The actual notification sending is tested via integration tests
		require.NotPanics(t, func() {
			th.App.handlePageUpdateNotification(th.Context, page, th.BasicUser.Id, nil, nil)
		})
	})

	t.Run("handle notification for page without wiki - no panic", func(t *testing.T) {
		// Create a page in a channel without a wiki
		otherChannel, chanErr := th.App.CreateChannel(th.Context, &model.Channel{
			TeamId:      th.BasicTeam.Id,
			Name:        "no-wiki-channel",
			DisplayName: "No Wiki Channel",
			Type:        model.ChannelTypeOpen,
		}, false)
		require.Nil(t, chanErr)

		otherPage, appErr := th.App.CreatePage(th.Context, otherChannel.Id, "No Wiki Page", "", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		require.NotPanics(t, func() {
			th.App.handlePageUpdateNotification(th.Context, otherPage, th.BasicUser.Id, nil, nil)
		})
	})
}

func TestCreateNewPageUpdateNotification(t *testing.T) {
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

	page, appErr := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Notification Page", "", "", th.BasicUser.Id, "", "")
	require.Nil(t, appErr)

	t.Run("create page update notification - no panic", func(t *testing.T) {
		require.NotPanics(t, func() {
			th.App.createNewPageUpdateNotification(th.Context, page, wiki, channel, th.BasicUser.Id, 1)
		})
	})

	t.Run("create notification with high update count - no panic", func(t *testing.T) {
		require.NotPanics(t, func() {
			th.App.createNewPageUpdateNotification(th.Context, page, wiki, channel, th.BasicUser.Id, 100)
		})
	})
}
