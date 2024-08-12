// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestScheduledPostStore(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	t.Run("SaveScheduledPost", func(t *testing.T) { testSaveScheduledPost(t, rctx, ss, s) })
}

func testSaveScheduledPost(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	channel := &model.Channel{
		TeamId:      "team_id_1",
		Type:        model.ChannelTypeOpen,
		Name:        "channel_name",
		DisplayName: "Channel Name",
	}

	createdChannel, err := ss.Channel().Save(rctx, channel, 1000)
	assert.NoError(t, err)

	t.Run("base case", func(t *testing.T) {
		userId := model.NewId()
		scheduledPost := &model.ScheduledPost{
			Draft: model.Draft{
				CreateAt:  model.GetMillis(),
				UserId:    userId,
				ChannelId: createdChannel.Id,
				Message:   "this is a scheduled post",
			},
			ScheduledAt: model.GetMillis() + 100000, // 100 seconds in the future
		}

		createdScheduledPost, err := ss.ScheduledPost().Save(scheduledPost)
		assert.NoError(t, err)
		assert.NotEmpty(t, createdScheduledPost.Id)

		scheduledPostsFromDatabase, err := ss.ScheduledPost().GetScheduledPostsForUser(userId, "team_id_1")
		assert.NoError(t, err)
		require.Equal(t, 1, len(scheduledPostsFromDatabase))
		assert.Equal(t, scheduledPost.Id, scheduledPostsFromDatabase[0].Id)
	})

	t.Run("scheduling in past should not be allowed", func(t *testing.T) {
		userId := model.NewId()
		scheduledPost := &model.ScheduledPost{
			Draft: model.Draft{
				CreateAt:  model.GetMillis(),
				UserId:    userId,
				ChannelId: createdChannel.Id,
				Message:   "this is a scheduled post",
			},
			ScheduledAt: model.GetMillis() - 100000, // 100 seconds in the past
		}

		_, err := ss.ScheduledPost().Save(scheduledPost)
		assert.Error(t, err)
	})
}
