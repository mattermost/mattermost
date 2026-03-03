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
	wiki, err := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, err)

	page, appErr := th.App.CreatePage(th.Context, th.BasicChannel.Id, "Notification Test Page", "", "", th.BasicUser.Id, "", "")
	require.Nil(t, appErr)

	t.Run("creates new notification on first call", func(t *testing.T) {
		th.App.handlePageUpdateNotification(th.Context, page, th.BasicUser.Id, wiki, nil)

		// Verify a PostTypePageUpdated post was created in the channel
		postList, postErr := th.App.GetPostsPage(th.Context, model.GetPostsOptions{ChannelId: th.BasicChannel.Id, Page: 0, PerPage: 50})
		require.Nil(t, postErr)

		var found *model.Post
		for _, p := range postList.Posts {
			if p.Type == model.PostTypePageUpdated {
				if propPageID, ok := p.Props[model.PagePropsPageID].(string); ok && propPageID == page.Id {
					found = p
					break
				}
			}
		}
		require.NotNil(t, found, "should have created a page_updated notification post")
		require.Equal(t, page.Id, found.Props[model.PagePropsPageID])
		require.Equal(t, "Notification Test Page", found.Props["page_title"])
	})

	t.Run("updates existing notification on second call", func(t *testing.T) {
		// Call again - should update the existing notification instead of creating a new one
		th.App.handlePageUpdateNotification(th.Context, page, th.BasicUser.Id, wiki, nil)

		postList, postErr := th.App.GetPostsPage(th.Context, model.GetPostsOptions{ChannelId: th.BasicChannel.Id, Page: 0, PerPage: 50})
		require.Nil(t, postErr)

		var notifPosts []*model.Post
		for _, p := range postList.Posts {
			if p.Type == model.PostTypePageUpdated {
				if propPageID, ok := p.Props[model.PagePropsPageID].(string); ok && propPageID == page.Id {
					notifPosts = append(notifPosts, p)
				}
			}
		}
		// Should still be exactly 1 notification post (updated, not duplicated)
		// Note: if this assertion fails, it means a second notification was created instead of updating
		require.Len(t, notifPosts, 1, "should update existing notification, not create a second one")

		count, ok := notifPosts[0].Props["update_count"]
		require.True(t, ok, "notification should have update_count prop")
		// update_count could be float64 (from JSON) or int
		switch c := count.(type) {
		case float64:
			require.GreaterOrEqual(t, c, float64(2))
		case int:
			require.GreaterOrEqual(t, c, 2)
		}
	})

	t.Run("handle notification for page without wiki - no panic", func(t *testing.T) {
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
