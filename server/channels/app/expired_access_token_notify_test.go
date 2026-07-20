// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

// dmPostsFromSystemBot returns the posts in the DM channel between the system
// bot and userID, or nil if no such channel exists yet. NotifyExpiredAccessTokensDeleted
// posts synchronously, so no polling is required.
func dmPostsFromSystemBot(t *testing.T, th *TestHelper, botUserID, userID string) []*model.Post {
	t.Helper()

	channel, err := th.App.Srv().Store().Channel().GetByName("", model.GetDMNameFromIds(botUserID, userID), false)
	if err != nil {
		// No DM channel means no notification was ever sent.
		return nil
	}

	postList, err := th.App.Srv().Store().Post().GetPosts(th.Context, model.GetPostsOptions{ChannelId: channel.Id, Page: 0, PerPage: 10}, false, map[string]bool{})
	require.NoError(t, err)

	posts := make([]*model.Post, 0, len(postList.Order))
	for _, id := range postList.Order {
		posts = append(posts, postList.Posts[id])
	}
	return posts
}

// notificationPostsFor returns the DM posts authored by the system bot that
// mention the given token description.
func notificationPostsFor(t *testing.T, th *TestHelper, botUserID, userID, description string) []*model.Post {
	t.Helper()

	var matching []*model.Post
	for _, post := range dmPostsFromSystemBot(t, th, botUserID, userID) {
		if post.UserId == botUserID && strings.Contains(post.Message, description) {
			matching = append(matching, post)
		}
	}
	return matching
}

func TestNotifyExpiredAccessTokensDeleted(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("empty token list is a no-op", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		require.NotPanics(t, func() {
			th.App.NotifyExpiredAccessTokensDeleted(th.Context, nil)
			th.App.NotifyExpiredAccessTokensDeleted(th.Context, []*model.UserAccessToken{})
		})
	})

	t.Run("happy path DMs the token owner", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		bot, appErr := th.App.GetSystemBot(th.Context)
		require.Nil(t, appErr)

		user := th.CreateUser(t)
		const description = "ci-integration-token"

		th.App.NotifyExpiredAccessTokensDeleted(th.Context, []*model.UserAccessToken{
			{Id: model.NewId(), UserId: user.Id, Description: description},
		})

		posts := notificationPostsFor(t, th, bot.UserId, user.Id, description)
		require.Len(t, posts, 1, "the owner should receive exactly one expiry notification")
		require.Equal(t, bot.UserId, posts[0].UserId)
	})

	t.Run("bot-owned token is skipped", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		systemBot, appErr := th.App.GetSystemBot(th.Context)
		require.Nil(t, appErr)

		bot := th.CreateBot(t)

		th.App.NotifyExpiredAccessTokensDeleted(th.Context, []*model.UserAccessToken{
			{Id: model.NewId(), UserId: bot.UserId, Description: "bot-token"},
		})

		require.Empty(t, dmPostsFromSystemBot(t, th, systemBot.UserId, bot.UserId))
	})

	t.Run("deactivated user token is skipped", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		bot, appErr := th.App.GetSystemBot(th.Context)
		require.Nil(t, appErr)

		user := th.CreateUser(t)
		_, appErr = th.App.UpdateActive(th.Context, user, false)
		require.Nil(t, appErr)

		th.App.NotifyExpiredAccessTokensDeleted(th.Context, []*model.UserAccessToken{
			{Id: model.NewId(), UserId: user.Id, Description: "deactivated-token"},
		})

		require.Empty(t, dmPostsFromSystemBot(t, th, bot.UserId, user.Id))
	})

	t.Run("unknown owner is skipped but processing continues", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		bot, appErr := th.App.GetSystemBot(th.Context)
		require.Nil(t, appErr)

		user := th.CreateUser(t)

		// First token references a user that does not exist (GetUser fails);
		// the second is a valid active user that must still be notified.
		th.App.NotifyExpiredAccessTokensDeleted(th.Context, []*model.UserAccessToken{
			{Id: model.NewId(), UserId: model.NewId(), Description: "orphan-token"},
			{Id: model.NewId(), UserId: user.Id, Description: "valid-token"},
		})

		require.Len(t, notificationPostsFor(t, th, bot.UserId, user.Id, "valid-token"), 1)
	})
}
