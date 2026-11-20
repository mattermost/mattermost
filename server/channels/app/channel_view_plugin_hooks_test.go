// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/mattermost/mattermost/server/v8/channels/utils/testutils"
)

const viewHooksPlugin = `
	package main

	import (
		"github.com/mattermost/mattermost/server/public/plugin"
	)

	type MyPlugin struct {
		plugin.MattermostPlugin
	}

	func (p *MyPlugin) ChannelHasBeenViewed(c *plugin.Context, userID, channelID string, viewedAt int64, collapsedThreads bool) {
		p.API.LogDebug("ChannelHasBeenViewed", "user_id", userID, "channel_id", channelID, "viewed_at", viewedAt, "collapsed_threads", collapsedThreads)
	}

	func (p *MyPlugin) ThreadHasBeenViewed(c *plugin.Context, userID, channelID, threadID string, viewedAt int64) {
		p.API.LogDebug("ThreadHasBeenViewed", "user_id", userID, "channel_id", channelID, "thread_id", threadID, "viewed_at", viewedAt)
	}

	func main() {
		plugin.ClientMain(&MyPlugin{})
	}
`

// setupViewHooksPlugin loads a plugin that logs each view hook it receives. The plugin RPC layer
// passes log arguments as strings, so expectations match viewed_at and collapsed_threads as strings.
func setupViewHooksPlugin(t *testing.T, th *TestHelper) *plugintest.API {
	t.Helper()

	mockAPI := &plugintest.API{}
	tearDown, _, errs := SetAppEnvironmentWithPlugins(t, []string{viewHooksPlugin}, th.App, func(*model.Manifest) plugin.API { return mockAPI })
	t.Cleanup(tearDown)
	require.Len(t, errs, 1)
	require.NoError(t, errs[0])

	return mockAPI
}

func assertEventuallyCalled(t *testing.T, mockAPI *plugintest.API) {
	t.Helper()

	assert.EventuallyWithT(t, func(c *assert.CollectT) {
		mockAPI.AssertExpectations(&testutils.CollectTWithLogf{CollectT: c})
	}, 5*time.Second, 50*time.Millisecond)
}

func TestHookChannelHasBeenViewed(t *testing.T) {
	mainHelper.Parallel(t)

	lastPostAt := func(t *testing.T, th *TestHelper, channelID string) int64 {
		t.Helper()
		channel, appErr := th.App.GetChannel(th.Context, channelID)
		require.Nil(t, appErr)
		return channel.LastPostAt
	}

	t.Run("invoked when the read position moves forward, and not when it doesn't", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.AddUserToChannel(t, th.BasicUser2, th.BasicChannel)
		mockAPI := setupViewHooksPlugin(t, th)

		th.CreatePost(t, th.BasicChannel)
		firstViewedAt := lastPostAt(t, th, th.BasicChannel.Id)
		mockAPI.On("LogDebug", "ChannelHasBeenViewed", "user_id", th.BasicUser2.Id, "channel_id", th.BasicChannel.Id, "viewed_at", fmt.Sprint(firstViewedAt), "collapsed_threads", "false").Return().Once()

		_, appErr := th.App.MarkChannelsAsViewed(th.Context, []string{th.BasicChannel.Id}, th.BasicUser2.Id, "", false, false)
		require.Nil(t, appErr)
		assertEventuallyCalled(t, mockAPI)

		// Nothing new to read, so the read position doesn't move.
		_, appErr = th.App.MarkChannelsAsViewed(th.Context, []string{th.BasicChannel.Id}, th.BasicUser2.Id, "", false, false)
		require.Nil(t, appErr)

		th.CreatePost(t, th.BasicChannel, func(post *model.Post) { post.CreateAt = model.GetMillis() })
		secondViewedAt := lastPostAt(t, th, th.BasicChannel.Id)
		require.Greater(t, secondViewedAt, firstViewedAt)
		mockAPI.On("LogDebug", "ChannelHasBeenViewed", "user_id", th.BasicUser2.Id, "channel_id", th.BasicChannel.Id, "viewed_at", fmt.Sprint(secondViewedAt), "collapsed_threads", "false").Return().Once()

		_, appErr = th.App.MarkChannelsAsViewed(th.Context, []string{th.BasicChannel.Id}, th.BasicUser2.Id, "", false, false)
		require.Nil(t, appErr)
		assertEventuallyCalled(t, mockAPI)
		mockAPI.AssertNumberOfCalls(t, "LogDebug", 2)
	})

	t.Run("invoked for each channel viewed", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.AddUserToChannel(t, th.BasicUser2, th.BasicChannel)
		mockAPI := setupViewHooksPlugin(t, th)

		otherChannel := th.CreateChannel(t, th.BasicTeam)
		th.AddUserToChannel(t, th.BasicUser2, otherChannel)
		th.CreatePost(t, th.BasicChannel)
		th.CreatePost(t, otherChannel)

		for _, channelID := range []string{th.BasicChannel.Id, otherChannel.Id} {
			mockAPI.On("LogDebug", "ChannelHasBeenViewed", "user_id", th.BasicUser2.Id, "channel_id", channelID, "viewed_at", fmt.Sprint(lastPostAt(t, th, channelID)), "collapsed_threads", "false").Return().Once()
		}

		_, appErr := th.App.ViewChannel(th.Context, &model.ChannelView{ChannelId: th.BasicChannel.Id, PrevChannelId: otherChannel.Id}, th.BasicUser2.Id, "", false)
		require.Nil(t, appErr)
		assertEventuallyCalled(t, mockAPI)
	})

	t.Run("reports collapsed reply threads", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.AddUserToChannel(t, th.BasicUser2, th.BasicChannel)
		mockAPI := setupViewHooksPlugin(t, th)

		th.CreatePost(t, th.BasicChannel)
		mockAPI.On("LogDebug", "ChannelHasBeenViewed", "user_id", th.BasicUser2.Id, "channel_id", th.BasicChannel.Id, "viewed_at", fmt.Sprint(lastPostAt(t, th, th.BasicChannel.Id)), "collapsed_threads", "true").Return().Once()

		_, appErr := th.App.MarkChannelsAsViewed(th.Context, []string{th.BasicChannel.Id}, th.BasicUser2.Id, "", true, true)
		require.Nil(t, appErr)
		assertEventuallyCalled(t, mockAPI)
	})

	t.Run("not invoked when marking a post as unread", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.AddUserToChannel(t, th.BasicUser2, th.BasicChannel)

		post := th.CreatePost(t, th.BasicChannel)
		_, appErr := th.App.MarkChannelsAsViewed(th.Context, []string{th.BasicChannel.Id}, th.BasicUser2.Id, "", false, false)
		require.Nil(t, appErr)

		mockAPI := setupViewHooksPlugin(t, th)
		_, appErr = th.App.MarkChannelAsUnreadFromPost(th.Context, post.Id, th.BasicUser2.Id, false)
		require.Nil(t, appErr)

		// Viewing afterwards moves the read position forward again.
		mockAPI.On("LogDebug", "ChannelHasBeenViewed", "user_id", th.BasicUser2.Id, "channel_id", th.BasicChannel.Id, "viewed_at", fmt.Sprint(lastPostAt(t, th, th.BasicChannel.Id)), "collapsed_threads", "false").Return().Once()
		_, appErr = th.App.MarkChannelsAsViewed(th.Context, []string{th.BasicChannel.Id}, th.BasicUser2.Id, "", false, false)
		require.Nil(t, appErr)
		assertEventuallyCalled(t, mockAPI)
		mockAPI.AssertNumberOfCalls(t, "LogDebug", 1)
	})
}

func TestHookThreadHasBeenViewed(t *testing.T) {
	mainHelper.Parallel(t)

	// setupThread returns a thread rooted in BasicChannel that BasicUser2 follows, with a reply
	// from BasicUser that BasicUser2 hasn't read.
	setupThread := func(t *testing.T, th *TestHelper) (*model.Post, *model.Post) {
		t.Helper()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.ThreadAutoFollow = true
			*cfg.ServiceSettings.CollapsedThreads = model.CollapsedThreadsDefaultOn
		})

		root := th.CreatePost(t, th.BasicChannel)
		th.CreatePost(t, th.BasicChannel, func(post *model.Post) {
			post.UserId = th.BasicUser2.Id
			post.RootId = root.Id
		})
		reply := th.CreatePostReply(t, root)

		return root, reply
	}

	viewedAtBetween := func(from, to int64) any {
		return mock.MatchedBy(func(arg string) bool {
			viewedAt, err := strconv.ParseInt(arg, 10, 64)
			return err == nil && viewedAt >= from && viewedAt <= to
		})
	}

	t.Run("invoked when the read position moves forward", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.AddUserToChannel(t, th.BasicUser2, th.BasicChannel)
		root, reply := setupThread(t, th)
		mockAPI := setupViewHooksPlugin(t, th)

		viewedAt := model.GetMillis()
		mockAPI.On("LogDebug", "ThreadHasBeenViewed", "user_id", th.BasicUser2.Id, "channel_id", th.BasicChannel.Id, "thread_id", root.Id, "viewed_at", fmt.Sprint(viewedAt)).Return().Once()
		require.GreaterOrEqual(t, viewedAt, reply.CreateAt)

		_, appErr := th.App.UpdateThreadReadForUser(th.Context, "", th.BasicUser2.Id, th.BasicTeam.Id, root.Id, viewedAt)
		require.Nil(t, appErr)
		assertEventuallyCalled(t, mockAPI)

		// Reading up to an earlier point leaves the read position behind where it was.
		_, appErr = th.App.UpdateThreadReadForUser(th.Context, "", th.BasicUser2.Id, th.BasicTeam.Id, root.Id, reply.CreateAt)
		require.Nil(t, appErr)

		laterViewedAt := viewedAt + 1
		mockAPI.On("LogDebug", "ThreadHasBeenViewed", "user_id", th.BasicUser2.Id, "channel_id", th.BasicChannel.Id, "thread_id", root.Id, "viewed_at", fmt.Sprint(laterViewedAt)).Return().Once()
		_, appErr = th.App.UpdateThreadReadForUser(th.Context, "", th.BasicUser2.Id, th.BasicTeam.Id, root.Id, laterViewedAt)
		require.Nil(t, appErr)
		assertEventuallyCalled(t, mockAPI)
		mockAPI.AssertNumberOfCalls(t, "LogDebug", 2)
	})

	t.Run("never reports a read position in the future", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.AddUserToChannel(t, th.BasicUser2, th.BasicChannel)
		root, _ := setupThread(t, th)
		mockAPI := setupViewHooksPlugin(t, th)

		before := model.GetMillis()
		future := before + time.Hour.Milliseconds()
		mockAPI.On("LogDebug", "ThreadHasBeenViewed", "user_id", th.BasicUser2.Id, "channel_id", th.BasicChannel.Id, "thread_id", root.Id, "viewed_at", viewedAtBetween(before, before+time.Minute.Milliseconds())).Return().Once()

		_, appErr := th.App.UpdateThreadReadForUser(th.Context, "", th.BasicUser2.Id, th.BasicTeam.Id, root.Id, future)
		require.Nil(t, appErr)
		assertEventuallyCalled(t, mockAPI)
	})

	t.Run("not invoked when marking a reply as unread", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.AddUserToChannel(t, th.BasicUser2, th.BasicChannel)
		root, reply := setupThread(t, th)

		// Leave the read position before the reply, so that marking it as unread would move the
		// read position forward.
		_, appErr := th.App.UpdateThreadReadForUser(th.Context, "", th.BasicUser2.Id, th.BasicTeam.Id, root.Id, root.CreateAt)
		require.Nil(t, appErr)

		mockAPI := setupViewHooksPlugin(t, th)
		_, appErr = th.App.UpdateThreadReadForUserByPost(th.Context, "", th.BasicUser2.Id, th.BasicTeam.Id, root.Id, reply.Id)
		require.Nil(t, appErr)

		// A later view is still reported, proving the plugin was listening.
		viewedAt := model.GetMillis()
		mockAPI.On("LogDebug", "ThreadHasBeenViewed", "user_id", th.BasicUser2.Id, "channel_id", th.BasicChannel.Id, "thread_id", root.Id, "viewed_at", fmt.Sprint(viewedAt)).Return().Once()
		_, appErr = th.App.UpdateThreadReadForUser(th.Context, "", th.BasicUser2.Id, th.BasicTeam.Id, root.Id, viewedAt)
		require.Nil(t, appErr)
		assertEventuallyCalled(t, mockAPI)
		mockAPI.AssertNumberOfCalls(t, "LogDebug", 1)
	})
}
