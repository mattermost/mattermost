// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestTimerCommand(t *testing.T) {
	th := setup(t).initBasic(t)
	defer th.ShutdownApp()

	commandProvider := &TimerProvider{}

	t.Run("Empty arguments", func(t *testing.T) {
		resp := commandProvider.DoCommand(th.App, th.Context, &model.CommandArgs{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			T:         func(s string, args ...any) string { return s },
		}, "")
		assert.Equal(t, model.CommandResponseTypeEphemeral, resp.ResponseType)
		assert.Equal(t, "api.command_timer.empty", resp.Text)
	})

	t.Run("Invalid duration", func(t *testing.T) {
		resp := commandProvider.DoCommand(th.App, th.Context, &model.CommandArgs{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			T:         func(s string, args ...any) string { return s },
		}, "1year")
		assert.Equal(t, model.CommandResponseTypeEphemeral, resp.ResponseType)
		assert.Equal(t, "api.command_timer.invalid_format", resp.Text)
	})

	t.Run("Zero duration", func(t *testing.T) {
		resp := commandProvider.DoCommand(th.App, th.Context, &model.CommandArgs{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			T:         func(s string, args ...any) string { return s },
		}, "0s")
		assert.Equal(t, model.CommandResponseTypeEphemeral, resp.ResponseType)
		assert.Equal(t, "api.command_timer.invalid_duration", resp.Text)
	})

	t.Run("Valid duration", func(t *testing.T) {
		resp := commandProvider.DoCommand(th.App, th.Context, &model.CommandArgs{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			T:         func(s string, args ...any) string { return s },
		}, "1s test timer")

		assert.NotEqual(t, model.CommandResponseTypeEphemeral, resp.ResponseType)
		assert.Equal(t, "", resp.Text)

		// Check the channel for the created post
		posts, err := th.App.GetPosts(th.Context, th.BasicChannel.Id, 0, 100)
		require.Nil(t, err)
		require.NotNil(t, posts)

		timerType := fmt.Sprintf("%stimer", model.PostCustomTypePrefix)
		postList := posts.ToSlice()
		var timerPost *model.Post
		for _, p := range postList {
			if p.Type == timerType {
				timerPost = p
				break
			}
		}
		require.NotNil(t, timerPost)

		assert.Equal(t, "test timer", timerPost.Message)

		targetProp, ok := timerPost.GetProp(model.PostPropsExpireAt).(float64)
		require.True(t, ok)

		targetTime := time.UnixMilli(int64(targetProp))
		assert.WithinDuration(t, time.Now().Add(1*time.Second), targetTime, 1*time.Second)

		// Wait for the timer goroutine and notification processing to complete before test cleanup
		time.Sleep(3 * time.Second)
	})

	t.Run("Deleted timer does not notify", func(t *testing.T) {
		resp := commandProvider.DoCommand(th.App, th.Context, &model.CommandArgs{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			T:         func(s string, args ...any) string { return s },
		}, "1s test deleted timer")

		assert.NotEqual(t, model.CommandResponseTypeEphemeral, resp.ResponseType)

		timerType := fmt.Sprintf("%stimer", model.PostCustomTypePrefix)
		posts, err := th.App.GetPosts(th.Context, th.BasicChannel.Id, 0, 10)
		require.Nil(t, err)

		var timerPost *model.Post
		for _, p := range posts.ToSlice() {
			if p.Type == timerType {
				timerPost = p
				break
			}
		}
		require.NotNil(t, timerPost)

		_, appErr := th.App.DeletePost(th.Context, timerPost.Id, timerPost.UserId)
		require.Nil(t, appErr)

		time.Sleep(1500 * time.Millisecond)

		postsAfter, err := th.App.GetPosts(th.Context, th.BasicChannel.Id, 0, 10)
		require.Nil(t, err)

		for _, p := range postsAfter.ToSlice() {
			if p.CreateAt > timerPost.CreateAt {
				assert.NotContains(t, p.Message, "api.command_timer.expired")
			}
		}
	})
}
