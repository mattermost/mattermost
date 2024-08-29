// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestScheduledPostStore(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	t.Run("CreateScheduledPost", func(t *testing.T) { testCreateScheduledPost(t, rctx, ss, s) })
	t.Run("GetScheduledPosts", func(t *testing.T) { testGetScheduledPosts(t, rctx, ss, s) })
	t.Run("PermanentlyDeleteScheduledPosts", func(t *testing.T) { testPermanentlyDeleteScheduledPosts(t, rctx, ss, s) })
}

func testCreateScheduledPost(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
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

		createdScheduledPost, err := ss.ScheduledPost().CreateScheduledPost(scheduledPost)
		assert.NoError(t, err)
		assert.NotEmpty(t, createdScheduledPost.Id)

		defer func() {
			_ = ss.ScheduledPost().PermanentlyDeleteScheduledPosts([]string{createdScheduledPost.Id})
		}()

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

		_, err := ss.ScheduledPost().CreateScheduledPost(scheduledPost)
		assert.Error(t, err)
	})

	t.Run("cannot save an empty post", func(t *testing.T) {
		userId := model.NewId()

		// a post with no message and no files is an empty post
		scheduledPost := &model.ScheduledPost{
			Draft: model.Draft{
				CreateAt:  model.GetMillis(),
				UserId:    userId,
				ChannelId: createdChannel.Id,
				Message:   "",
			},
			ScheduledAt: model.GetMillis() + 100000, // 100 seconds in the future
		}

		createdScheduledPost, err := ss.ScheduledPost().CreateScheduledPost(scheduledPost)
		assert.Error(t, err)
		assert.Nil(t, createdScheduledPost)
	})
}

func testGetScheduledPosts(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	t.Run("should handle no scheduled posts exist", func(t *testing.T) {
		apr2022 := time.Date(2100, time.April, 1, 1, 0, 0, 0, time.UTC)
		scheduledPosts, err := ss.ScheduledPost().GetScheduledPosts(model.GetMillisForTime(apr2022), "", 10)
		assert.NoError(t, err)
		assert.Equal(t, 0, len(scheduledPosts))
	})

	t.Run("base case", func(t *testing.T) {
		// creating some sample scheduled posts
		// Create a time object for 1 January 2100, 1 AM
		jan2100 := time.Date(2100, time.January, 1, 1, 0, 0, 0, time.UTC)
		scheduledPost1 := &model.ScheduledPost{
			Draft: model.Draft{
				CreateAt:  model.GetMillis(),
				UserId:    model.NewId(),
				ChannelId: model.NewId(),
				Message:   "this is a scheduled post",
			},
			ScheduledAt: model.GetMillisForTime(jan2100),
		}

		createdScheduledPost1, err := ss.ScheduledPost().CreateScheduledPost(scheduledPost1)
		assert.NoError(t, err)
		assert.NotEmpty(t, createdScheduledPost1.Id)

		feb2100 := time.Date(2100, time.February, 1, 1, 0, 0, 0, time.UTC)
		scheduledPost2 := &model.ScheduledPost{
			Draft: model.Draft{
				CreateAt:  model.GetMillis(),
				UserId:    model.NewId(),
				ChannelId: model.NewId(),
				Message:   "this is a scheduled post",
			},
			ScheduledAt: model.GetMillisForTime(feb2100),
		}

		createdScheduledPost2, err := ss.ScheduledPost().CreateScheduledPost(scheduledPost2)
		assert.NoError(t, err)
		assert.NotEmpty(t, createdScheduledPost2.Id)

		mar2100 := time.Date(2100, time.March, 1, 1, 0, 0, 0, time.UTC)
		scheduledPost3 := &model.ScheduledPost{
			Draft: model.Draft{
				CreateAt:  model.GetMillis(),
				UserId:    model.NewId(),
				ChannelId: model.NewId(),
				Message:   "this is a scheduled post",
			},
			ScheduledAt: model.GetMillisForTime(mar2100),
		}

		createdScheduledPost3, err := ss.ScheduledPost().CreateScheduledPost(scheduledPost3)
		assert.NoError(t, err)
		assert.NotEmpty(t, createdScheduledPost3.Id)

		defer func() {
			_ = ss.ScheduledPost().PermanentlyDeleteScheduledPosts([]string{
				createdScheduledPost1.Id,
				createdScheduledPost2.Id,
				createdScheduledPost3.Id,
			})
		}()

		apr2022 := time.Date(2100, time.April, 1, 1, 0, 0, 0, time.UTC)
		scheduledPosts, err := ss.ScheduledPost().GetScheduledPosts(model.GetMillisForTime(apr2022), "", 10)
		assert.NoError(t, err)
		assert.Equal(t, 3, len(scheduledPosts))

		mar2100midnight := time.Date(2100, time.March, 1, 0, 0, 0, 0, time.UTC)
		scheduledPosts, err = ss.ScheduledPost().GetScheduledPosts(model.GetMillisForTime(mar2100midnight), "", 10)
		assert.NoError(t, err)
		assert.Equal(t, 2, len(scheduledPosts))

		jan2100Midnight := time.Date(2100, time.January, 1, 0, 0, 0, 0, time.UTC)
		scheduledPosts, err = ss.ScheduledPost().GetScheduledPosts(model.GetMillisForTime(jan2100Midnight), "", 10)
		assert.NoError(t, err)
		assert.Equal(t, 0, len(scheduledPosts))
	})
}

func testPermanentlyDeleteScheduledPosts(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	scheduledPostIDs := []string{}

	scheduledPost := &model.ScheduledPost{
		Draft: model.Draft{
			CreateAt:  model.GetMillis(),
			UserId:    model.NewId(),
			ChannelId: model.NewId(),
			Message:   "this is a scheduled post",
		},
		ScheduledAt: model.GetMillis() + 100000,
	}

	createdScheduledPost, err := ss.ScheduledPost().CreateScheduledPost(scheduledPost)
	assert.NoError(t, err)
	assert.NotEmpty(t, createdScheduledPost.Id)
	scheduledPostIDs = append(scheduledPostIDs, createdScheduledPost.Id)

	scheduledPost = &model.ScheduledPost{
		Draft: model.Draft{
			CreateAt:  model.GetMillis(),
			UserId:    model.NewId(),
			ChannelId: model.NewId(),
			Message:   "this is a scheduled post 2",
		},
		ScheduledAt: model.GetMillis() + 100000,
	}

	createdScheduledPost, err = ss.ScheduledPost().CreateScheduledPost(scheduledPost)
	assert.NoError(t, err)
	assert.NotEmpty(t, createdScheduledPost.Id)
	scheduledPostIDs = append(scheduledPostIDs, createdScheduledPost.Id)

	scheduledPost = &model.ScheduledPost{
		Draft: model.Draft{
			CreateAt:  model.GetMillis(),
			UserId:    model.NewId(),
			ChannelId: model.NewId(),
			Message:   "this is a scheduled post 3",
		},
		ScheduledAt: model.GetMillis() + 100000,
	}

	createdScheduledPost, err = ss.ScheduledPost().CreateScheduledPost(scheduledPost)
	assert.NoError(t, err)
	assert.NotEmpty(t, createdScheduledPost.Id)
	scheduledPostIDs = append(scheduledPostIDs, createdScheduledPost.Id)

	scheduledPost = &model.ScheduledPost{
		Draft: model.Draft{
			CreateAt:  model.GetMillis(),
			UserId:    model.NewId(),
			ChannelId: model.NewId(),
			Message:   "this is a scheduled post 4",
		},
		ScheduledAt: model.GetMillis() + 100000,
	}

	createdScheduledPost, err = ss.ScheduledPost().CreateScheduledPost(scheduledPost)
	assert.NoError(t, err)
	assert.NotEmpty(t, createdScheduledPost.Id)
	scheduledPostIDs = append(scheduledPostIDs, createdScheduledPost.Id)

	// verify 4 scheduled posts exist
	scheduledPosts, err := ss.ScheduledPost().GetScheduledPosts(model.GetMillis()+50000000, "", 10)
	assert.NoError(t, err)
	assert.Equal(t, 4, len(scheduledPosts))

	// now we'll delete all scheduled posts
	err = ss.ScheduledPost().PermanentlyDeleteScheduledPosts(scheduledPostIDs)
	assert.NoError(t, err)

	// now there should be no posts
	scheduledPosts, err = ss.ScheduledPost().GetScheduledPosts(model.GetMillis()+50000000, "", 10)
	assert.NoError(t, err)
	assert.Equal(t, 0, len(scheduledPosts))
}
