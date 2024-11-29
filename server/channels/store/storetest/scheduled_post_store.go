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
	t.Run("GetPendingScheduledPosts", func(t *testing.T) { testGetScheduledPosts(t, rctx, ss, s) })
	t.Run("PermanentlyDeleteScheduledPosts", func(t *testing.T) { testPermanentlyDeleteScheduledPosts(t, rctx, ss, s) })
	t.Run("UpdatedScheduledPost", func(t *testing.T) { testUpdatedScheduledPost(t, rctx, ss, s) })
	t.Run("UpdateOldScheduledPosts", func(t *testing.T) { testUpdateOldScheduledPosts(t, rctx, ss, s) })
	t.Run("PermanentDeleteByUser", func(t *testing.T) { testPermanentDeleteScheduledPostsByUser(t, rctx, ss, s) })
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

	defer func() {
		_ = ss.Channel().PermanentDelete(rctx, createdChannel.Id)
	}()

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

	t.Run("scheduling in past SHOULD BE allowed", func(t *testing.T) {
		// this is only allowed in store layer and user won't be able to do so as the checks
		// in app layer would stop them.
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
		assert.NoError(t, err)

		defer func() {
			_ = ss.ScheduledPost().PermanentlyDeleteScheduledPosts([]string{scheduledPost.Id})
		}()
	})
}

func testGetScheduledPosts(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	t.Run("should handle no scheduled posts exist", func(t *testing.T) {
		apr2022 := time.Date(2100, time.April, 1, 1, 0, 0, 0, time.UTC)
		afterTime := time.Date(2100, time.March, 1, 1, 0, 0, 0, time.UTC)
		scheduledPosts, err := ss.ScheduledPost().GetPendingScheduledPosts(model.GetMillisForTime(apr2022), model.GetMillisForTime(afterTime), "", 10)
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
		afterTime := time.Date(2100, time.January, 1, 0, 0, 0, 0, time.UTC)
		scheduledPosts, err := ss.ScheduledPost().GetPendingScheduledPosts(model.GetMillisForTime(apr2022), model.GetMillisForTime(afterTime), "", 10)
		assert.NoError(t, err)
		assert.Equal(t, 3, len(scheduledPosts))

		mar2100midnight := time.Date(2100, time.March, 1, 0, 0, 0, 0, time.UTC)
		afterTime = time.Date(2100, time.January, 1, 0, 0, 0, 0, time.UTC)
		scheduledPosts, err = ss.ScheduledPost().GetPendingScheduledPosts(model.GetMillisForTime(mar2100midnight), model.GetMillisForTime(afterTime), "", 10)
		assert.NoError(t, err)
		assert.Equal(t, 2, len(scheduledPosts))

		jan2100Midnight := time.Date(2100, time.January, 1, 0, 0, 0, 0, time.UTC)
		afterTime = time.Date(2099, time.December, 31, 0, 0, 0, 0, time.UTC)
		scheduledPosts, err = ss.ScheduledPost().GetPendingScheduledPosts(model.GetMillisForTime(jan2100Midnight), model.GetMillisForTime(afterTime), "", 10)
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
	scheduledPosts, err := ss.ScheduledPost().GetPendingScheduledPosts(model.GetMillis()+50000000, model.GetMillis()-100000000, "", 10)
	assert.NoError(t, err)
	assert.Equal(t, 4, len(scheduledPosts))

	// now we'll delete all scheduled posts
	err = ss.ScheduledPost().PermanentlyDeleteScheduledPosts(scheduledPostIDs)
	assert.NoError(t, err)

	// now there should be no posts
	scheduledPosts, err = ss.ScheduledPost().GetPendingScheduledPosts(model.GetMillis()+50000000, model.GetMillis()-100000000, "", 10)
	assert.NoError(t, err)
	assert.Equal(t, 0, len(scheduledPosts))
}

func testUpdatedScheduledPost(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	channel := &model.Channel{
		TeamId:      "team_id_1",
		Type:        model.ChannelTypeOpen,
		Name:        "channel_name",
		DisplayName: "Channel Name",
	}

	createdChannel, err := ss.Channel().Save(rctx, channel, 1000)
	assert.NoError(t, err)

	defer func() {
		_ = ss.Channel().PermanentDelete(rctx, createdChannel.Id)
	}()

	t.Run("it should update only limited fields", func(t *testing.T) {
		userId := model.NewId()
		scheduledPost := &model.ScheduledPost{
			Draft: model.Draft{
				CreateAt:  model.GetMillis(),
				UserId:    userId,
				ChannelId: createdChannel.Id,
				Message:   "this is a scheduled post",
			},
			ScheduledAt: model.GetMillis(),
		}

		createdScheduledPost, err := ss.ScheduledPost().CreateScheduledPost(scheduledPost)
		assert.NoError(t, err)
		assert.NotEmpty(t, createdScheduledPost.Id)

		// now we'll update the scheduled post
		updateTimestamp := model.GetMillis()

		fileID1 := model.NewId()
		fileID2 := model.NewId()

		newScheduledAt := model.GetMillis()
		newUserId := model.NewId()

		updateSchedulePost := &model.ScheduledPost{
			Id:          createdScheduledPost.Id,
			ScheduledAt: newScheduledAt,
			ErrorCode:   "test_error_code",
			Draft: model.Draft{
				CreateAt:  model.GetMillis(),
				Message:   "updated message",
				UpdateAt:  updateTimestamp,
				UserId:    newUserId,     // this should not update
				ChannelId: model.NewId(), // this should not update
				FileIds:   []string{fileID1, fileID2},
				Priority: model.StringInterface{
					"priority":                 "urgent",
					"requested_ack":            false,
					"persistent_notifications": false,
				},
			},
		}

		err = ss.ScheduledPost().UpdatedScheduledPost(updateSchedulePost)
		assert.NoError(t, err)

		// now we'll get it and verify that intended fields updated and other fields did not
		userScheduledPosts, err := ss.ScheduledPost().GetScheduledPostsForUser(userId, channel.TeamId)
		assert.NoError(t, err)
		assert.Equal(t, 1, len(userScheduledPosts))

		// fields that should have changed
		assert.Equal(t, newScheduledAt, userScheduledPosts[0].ScheduledAt)
		assert.Equal(t, "test_error_code", userScheduledPosts[0].ErrorCode)
		assert.Equal(t, "updated message", userScheduledPosts[0].Message)
		assert.Equal(t, 2, len(userScheduledPosts[0].FileIds))
		assert.Equal(t, "urgent", userScheduledPosts[0].Priority["priority"])
		assert.Equal(t, false, userScheduledPosts[0].Priority["requested_ack"])
		assert.Equal(t, false, userScheduledPosts[0].Priority["persistent_notifications"])

		// fields that should not have changed. Checking them against the original value
		assert.Equal(t, createdScheduledPost.Id, userScheduledPosts[0].Id)
		assert.Equal(t, userId, userScheduledPosts[0].UserId)
		assert.Equal(t, channel.Id, userScheduledPosts[0].ChannelId)
	})

	t.Run("it should update old scheduled post", func(t *testing.T) {
		userId := model.NewId()
		scheduledPost := &model.ScheduledPost{
			Draft: model.Draft{
				CreateAt:  model.GetMillis(),
				UserId:    userId,
				ChannelId: createdChannel.Id,
				Message:   "this is a scheduled post",
			},
			ScheduledAt: model.GetMillis() - (24 * 60 * 60 * 1000), // 1 day in the past
		}

		createdScheduledPost, err := ss.ScheduledPost().CreateScheduledPost(scheduledPost)
		assert.NoError(t, err)
		assert.NotEmpty(t, createdScheduledPost.Id)

		// now we'll update the scheduled post
		now := model.GetMillis()
		scheduledPost.ErrorCode = model.ScheduledPostErrorUnknownError

		err = ss.ScheduledPost().UpdatedScheduledPost(scheduledPost)
		assert.NoError(t, err)

		updatedScheduledPost, err := ss.ScheduledPost().Get(scheduledPost.Id)
		assert.NoError(t, err)
		assert.LessOrEqual(t, now, updatedScheduledPost.ProcessedAt)
		assert.Equal(t, model.ScheduledPostErrorUnknownError, updatedScheduledPost.ErrorCode)
	})
}

func testUpdateOldScheduledPosts(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	setupScheduledPosts := func(baseTime int64, userId, teamId string) func() {
		channel := &model.Channel{
			TeamId:      teamId,
			Type:        model.ChannelTypeOpen,
			Name:        "channel_name",
			DisplayName: "Channel Name",
		}
		createdChannel, err := ss.Channel().Save(rctx, channel, 1000)
		assert.NoError(t, err)

		// Scheduled post 1
		scheduledPost1 := &model.ScheduledPost{
			Draft: model.Draft{
				CreateAt:  model.GetMillis(),
				UserId:    userId,
				ChannelId: createdChannel.Id,
				Message:   "this is a scheduled post",
			},
			ScheduledAt: baseTime + 86400000, // 1 day in the future
		}

		createdScheduledPost1, err := ss.ScheduledPost().CreateScheduledPost(scheduledPost1)
		assert.NoError(t, err)
		assert.NotEmpty(t, createdScheduledPost1.Id)

		time.Sleep(100 * time.Millisecond)

		// Scheduled post 2
		scheduledPost2 := &model.ScheduledPost{
			Draft: model.Draft{
				CreateAt:  model.GetMillis(),
				UserId:    userId,
				ChannelId: createdChannel.Id,
				Message:   "this is second scheduled post",
			},
			ScheduledAt: baseTime + (2 * 86400000), // 2 days in the future
		}

		createdScheduledPost2, err := ss.ScheduledPost().CreateScheduledPost(scheduledPost2)
		assert.NoError(t, err)
		assert.NotEmpty(t, createdScheduledPost2.Id)

		time.Sleep(100 * time.Millisecond)

		// Scheduled post 3
		scheduledPost3 := &model.ScheduledPost{
			Draft: model.Draft{
				CreateAt:  model.GetMillis(),
				UserId:    userId,
				ChannelId: createdChannel.Id,
				Message:   "this is third scheduled post",
			},
			ScheduledAt: baseTime + (3 * 86400000), // 3 days in the future
		}

		createdScheduledPost3, err := ss.ScheduledPost().CreateScheduledPost(scheduledPost3)
		assert.NoError(t, err)
		assert.NotEmpty(t, createdScheduledPost3.Id)

		time.Sleep(100 * time.Millisecond)

		// Scheduled post 4
		scheduledPost4 := &model.ScheduledPost{
			Draft: model.Draft{
				CreateAt:  model.GetMillis(),
				UserId:    userId,
				ChannelId: createdChannel.Id,
				Message:   "this is fourth scheduled post",
			},
			ScheduledAt: baseTime + (4 * 86400000), // 4 days in the future
		}

		createdScheduledPost4, err := ss.ScheduledPost().CreateScheduledPost(scheduledPost4)
		assert.NoError(t, err)
		assert.NotEmpty(t, createdScheduledPost4.Id)

		return func() {
			_ = ss.ScheduledPost().PermanentlyDeleteScheduledPosts([]string{
				createdScheduledPost1.Id,
				createdScheduledPost2.Id,
				createdScheduledPost3.Id,
				createdScheduledPost4.Id,
			})

			_ = ss.Channel().PermanentDelete(rctx, createdChannel.Id)
		}
	}

	t.Run("should update only old scheduled posts", func(t *testing.T) {
		now := model.GetMillis()
		userId := model.NewId()
		teamId := model.NewId()
		cleanup := setupScheduledPosts(now, userId, teamId)
		defer cleanup()

		err := ss.ScheduledPost().UpdateOldScheduledPosts(now + 2.5*86400000) // marking all posts older than 2 days from now
		assert.NoError(t, err)

		scheduledPosts, err := ss.ScheduledPost().GetScheduledPostsForUser(userId, teamId)
		assert.NoError(t, err)
		assert.Equal(t, 4, len(scheduledPosts))
		assert.Equal(t, model.ScheduledPostErrorUnableToSend, scheduledPosts[0].ErrorCode)
		assert.Equal(t, model.ScheduledPostErrorUnableToSend, scheduledPosts[1].ErrorCode)
		assert.Equal(t, "", scheduledPosts[2].ErrorCode)
		assert.Equal(t, "", scheduledPosts[3].ErrorCode)
	})
}

func testPermanentDeleteScheduledPostsByUser(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	t.Run("should delete all scheduled posts for a given user", func(t *testing.T) {
		userId := model.NewId()
		teamId := model.NewId()

		// Create a scheduled post for the user
		scheduledPost := &model.ScheduledPost{
			Draft: model.Draft{
				CreateAt:  model.GetMillis(),
				UserId:    userId,
				ChannelId: model.NewId(),
				Message:   "this is a scheduled post",
			},
			ScheduledAt: model.GetMillis() + 100000,
		}

		createdScheduledPost, err := ss.ScheduledPost().CreateScheduledPost(scheduledPost)
		assert.NoError(t, err)
		assert.NotEmpty(t, createdScheduledPost.Id)

		// Delete scheduled posts for the user
		err = ss.ScheduledPost().PermanentDeleteByUser(userId)
		assert.NoError(t, err)

		// Verify that no scheduled posts exist for the user
		scheduledPosts, err := ss.ScheduledPost().GetScheduledPostsForUser(userId, teamId)
		assert.NoError(t, err)
		assert.Empty(t, scheduledPosts)
	})

	t.Run("should not fail if no scheduled posts exist for the user", func(t *testing.T) {
		userId := model.NewId()

		// Attempt to delete scheduled posts for a user with no scheduled posts
		err := ss.ScheduledPost().PermanentDeleteByUser(userId)
		assert.NoError(t, err)
	})

	t.Run("should handle multiple scheduled posts for the same user", func(t *testing.T) {
		userId := model.NewId()
		teamId := model.NewId()

		// Create multiple scheduled posts for the user
		for i := 0; i < 3; i++ {
			scheduledPost := &model.ScheduledPost{
				Draft: model.Draft{
					CreateAt:  model.GetMillis(),
					UserId:    userId,
					ChannelId: model.NewId(),
					Message:   "this is a scheduled post",
				},
				ScheduledAt: model.GetMillis() + 100000,
			}

			createdScheduledPost, err := ss.ScheduledPost().CreateScheduledPost(scheduledPost)
			assert.NoError(t, err)
			assert.NotEmpty(t, createdScheduledPost.Id)
		}

		// Delete scheduled posts for the user
		err := ss.ScheduledPost().PermanentDeleteByUser(userId)
		assert.NoError(t, err)

		// Verify that no scheduled posts exist for the user
		scheduledPosts, err := ss.ScheduledPost().GetScheduledPostsForUser(userId, teamId)
		assert.NoError(t, err)
		assert.Empty(t, scheduledPosts)
	})

	t.Run("should handle empty user id", func(t *testing.T) {
		err := ss.ScheduledPost().PermanentDeleteByUser("")
		assert.NoError(t, err)
	})

	t.Run("should handle non-existing user id", func(t *testing.T) {
		nonExistingUserId := model.NewId()
		err := ss.ScheduledPost().PermanentDeleteByUser(nonExistingUserId)
		assert.NoError(t, err)
	})
}
