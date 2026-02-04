// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

// ============================================================================
// MATTERMOST EXTENDED - Post Priority Tests
// These tests verify the extended behavior for post priority in threads
// ============================================================================

// TestPostPriorityExtended tests Mattermost Extended modifications to post priority
func TestPostPriorityExtended(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("should allow priority labels on thread replies", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		client := th.Client

		// Enable post priority feature
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuProfessional))
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.PostPriority = true
		})

		// Create a root post
		rootPost := &model.Post{ChannelId: th.BasicChannel.Id, Message: "root post"}
		createdRoot, resp, err := client.CreatePost(context.Background(), rootPost)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		// Create a reply with priority - this should succeed (Mattermost Extended behavior)
		replyPost := &model.Post{
			RootId:    createdRoot.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "reply with priority",
			Metadata: &model.PostMetadata{
				Priority: &model.PostPriority{
					Priority: model.NewPointer("urgent"),
				},
			},
		}
		createdReply, resp, err := client.CreatePost(context.Background(), replyPost)
		require.NoError(t, err, "Thread replies should be allowed to have priority labels")
		CheckCreatedStatus(t, resp)
		assert.Equal(t, createdRoot.Id, createdReply.RootId)
	})

	t.Run("should allow discord_reply priority on thread replies", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		client := th.Client

		// Enable post priority feature
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.PostPriority = true
		})

		// Create a root post
		rootPost := &model.Post{ChannelId: th.BasicChannel.Id, Message: "root post"}
		createdRoot, resp, err := client.CreatePost(context.Background(), rootPost)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		// Create a reply with discord_reply priority (used for Discord-style inline replies)
		replyPost := &model.Post{
			RootId:    createdRoot.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "discord-style reply",
			Metadata: &model.PostMetadata{
				Priority: &model.PostPriority{
					Priority: model.NewPointer("discord_reply"),
				},
			},
		}
		_, resp, err = client.CreatePost(context.Background(), replyPost)
		require.NoError(t, err, "discord_reply priority should be allowed on thread replies")
		CheckCreatedStatus(t, resp)
	})

	t.Run("should allow encrypted priority on thread replies", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		client := th.Client

		// Enable post priority feature
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.PostPriority = true
		})

		// Create a root post
		rootPost := &model.Post{ChannelId: th.BasicChannel.Id, Message: "root post"}
		createdRoot, resp, err := client.CreatePost(context.Background(), rootPost)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		// Create a reply with encrypted priority (used for E2E encryption)
		replyPost := &model.Post{
			RootId:    createdRoot.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "encrypted reply",
			Metadata: &model.PostMetadata{
				Priority: &model.PostPriority{
					Priority: model.NewPointer("encrypted"),
				},
			},
		}
		_, resp, err = client.CreatePost(context.Background(), replyPost)
		require.NoError(t, err, "encrypted priority should be allowed on thread replies")
		CheckCreatedStatus(t, resp)
	})

	t.Run("should allow important priority on thread replies", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		client := th.Client

		// Enable post priority feature
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.PostPriority = true
		})

		// Create a root post
		rootPost := &model.Post{ChannelId: th.BasicChannel.Id, Message: "root post"}
		createdRoot, resp, err := client.CreatePost(context.Background(), rootPost)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		// Create a reply with important priority
		replyPost := &model.Post{
			RootId:    createdRoot.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "important reply",
			Metadata: &model.PostMetadata{
				Priority: &model.PostPriority{
					Priority: model.NewPointer("important"),
				},
			},
		}
		_, resp, err = client.CreatePost(context.Background(), replyPost)
		require.NoError(t, err, "important priority should be allowed on thread replies")
		CheckCreatedStatus(t, resp)
	})

	t.Run("should still reject priority when post-priority feature is disabled", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		client := th.Client

		// Disable post priority feature
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.PostPriority = false
		})

		// Create a root post first (without priority)
		rootPost := &model.Post{ChannelId: th.BasicChannel.Id, Message: "root post"}
		createdRoot, resp, err := client.CreatePost(context.Background(), rootPost)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		// Try to create a reply with priority - should fail because feature is disabled
		replyPost := &model.Post{
			RootId:    createdRoot.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "reply with priority",
			Metadata: &model.PostMetadata{
				Priority: &model.PostPriority{
					Priority: model.NewPointer("urgent"),
				},
			},
		}
		_, resp, err = client.CreatePost(context.Background(), replyPost)
		require.Error(t, err, "Priority should be rejected when feature is disabled")
		CheckForbiddenStatus(t, resp)
	})
}
