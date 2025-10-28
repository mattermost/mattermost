// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/store/searchtest"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"
	"github.com/stretchr/testify/require"
)

func TestPostStore(t *testing.T) {
	StoreTestWithSqlStore(t, storetest.TestPostStore)
}

func TestSearchPostStore(t *testing.T) {
	StoreTestWithSearchTestEngine(t, searchtest.TestSearchPostStore)
}

func TestGetPostsByTimeRange(t *testing.T) {
	StoreTest(t, func(t *testing.T, rctx request.CTX, ss store.Store) {
		sqlStore := ss.(*SqlStore)
		postStore := sqlStore.Post().(*SqlPostStore)

		// Setup: Create a team and channel for testing
		teamID := model.NewId()
		channel, err := sqlStore.Channel().Save(rctx, &model.Channel{
			TeamId:      teamID,
			DisplayName: "Test Channel",
			Name:        "test-channel-" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, err)

		// Create test posts with known timestamps
		baseTime := int64(1704067200000) // Fixed timestamp for reproducibility
		posts := make([]*model.Post, 10)
		for i := range 10 {
			post, saveErr := sqlStore.Post().Save(rctx, &model.Post{
				ChannelId: channel.Id,
				UserId:    model.NewId(),
				Message:   "Test message " + string(rune('A'+i)),
				CreateAt:  baseTime + int64(i*1000), // 1 second apart
				UpdateAt:  baseTime + int64(i*1000),
			})
			require.NoError(t, saveErr)
			posts[i] = post
		}

		t.Run("cursor pagination with CreateAt - multiple pages", func(t *testing.T) {
			// Initial request
			opts := model.GetPostsOptions{
				ChannelId:    channel.Id,
				FromCreateAt: baseTime,
				PerPage:      3,
			}

			result1, err := postStore.getPostsByTimeRange(rctx, opts, map[string]bool{})
			require.NoError(t, err)
			require.NotNil(t, result1)
			require.Len(t, result1.Posts, 3)
			require.NotNil(t, result1.HasNext)
			require.True(t, *result1.HasNext)
			require.NotEmpty(t, result1.NextCursor)

			// Second page using cursor
			opts2 := model.GetPostsOptions{
				ChannelId: channel.Id,
				Cursor:    result1.NextCursor,
				PerPage:   3,
			}

			result2, err := postStore.getPostsByTimeRange(rctx, opts2, map[string]bool{})
			require.NoError(t, err)
			require.NotNil(t, result2)
			require.Len(t, result2.Posts, 3)
			require.NotNil(t, result2.HasNext)
			require.True(t, *result2.HasNext)
			require.NotEmpty(t, result2.NextCursor)

			// Verify no duplicate posts between pages
			for id1 := range result1.Posts {
				_, found := result2.Posts[id1]
				require.False(t, found, "Found duplicate post %s between pages", id1)
			}
		})

		t.Run("cursor pagination with UpdateAt - multiple pages", func(t *testing.T) {
			// Initial request
			opts := model.GetPostsOptions{
				ChannelId:    channel.Id,
				FromUpdateAt: baseTime,
				PerPage:      3,
			}

			result1, err := postStore.getPostsByTimeRange(rctx, opts, map[string]bool{})
			require.NoError(t, err)
			require.NotNil(t, result1)
			require.Len(t, result1.Posts, 3)
			require.NotNil(t, result1.HasNext)
			require.True(t, *result1.HasNext)
			require.NotEmpty(t, result1.NextCursor)

			// Verify cursor encodes UpdateAt
			require.Contains(t, result1.NextCursor, "update_at:")

			// Second page using cursor
			opts2 := model.GetPostsOptions{
				ChannelId: channel.Id,
				Cursor:    result1.NextCursor,
				PerPage:   3,
			}

			result2, err := postStore.getPostsByTimeRange(rctx, opts2, map[string]bool{})
			require.NoError(t, err)
			require.NotNil(t, result2)
			require.Len(t, result2.Posts, 3)
		})

		t.Run("initial query with FromCreateAt", func(t *testing.T) {
			opts := model.GetPostsOptions{
				ChannelId:    channel.Id,
				FromCreateAt: baseTime + 5000, // Start from 6th post
				PerPage:      10,
			}

			result, err := postStore.getPostsByTimeRange(rctx, opts, map[string]bool{})
			require.NoError(t, err)
			require.NotNil(t, result)
			require.Len(t, result.Posts, 5) // Should get posts 5-9
			require.NotNil(t, result.HasNext)
			require.False(t, *result.HasNext) // No more pages
		})

		t.Run("initial query with FromUpdateAt", func(t *testing.T) {
			opts := model.GetPostsOptions{
				ChannelId:    channel.Id,
				FromUpdateAt: baseTime + 7000, // Start from 8th post
				PerPage:      10,
			}

			result, err := postStore.getPostsByTimeRange(rctx, opts, map[string]bool{})
			require.NoError(t, err)
			require.NotNil(t, result)
			require.Len(t, result.Posts, 3) // Should get posts 7-9
			require.NotNil(t, result.HasNext)
			require.False(t, *result.HasNext)
		})

		t.Run("time range with UntilCreateAt", func(t *testing.T) {
			opts := model.GetPostsOptions{
				ChannelId:     channel.Id,
				FromCreateAt:  baseTime,
				UntilCreateAt: baseTime + 5000, // Exclusive upper bound
				PerPage:       10,
			}

			result, err := postStore.getPostsByTimeRange(rctx, opts, map[string]bool{})
			require.NoError(t, err)
			require.NotNil(t, result)
			require.Len(t, result.Posts, 5) // Should get posts 0-4
			require.NotNil(t, result.HasNext)
			require.False(t, *result.HasNext)
		})

		t.Run("time range with UntilUpdateAt", func(t *testing.T) {
			opts := model.GetPostsOptions{
				ChannelId:     channel.Id,
				FromUpdateAt:  baseTime + 3000, // Start from 4th post
				UntilUpdateAt: baseTime + 7000, // Until 7th post (exclusive)
				PerPage:       10,
			}

			result, err := postStore.getPostsByTimeRange(rctx, opts, map[string]bool{})
			require.NoError(t, err)
			require.NotNil(t, result)
			require.Len(t, result.Posts, 4) // Should get posts 3-6
			require.NotNil(t, result.HasNext)
			require.False(t, *result.HasNext)
		})

		// Error handling tests
		t.Run("error when no time parameters provided", func(t *testing.T) {
			opts := model.GetPostsOptions{
				ChannelId: channel.Id,
				// No Cursor, FromCreateAt, or FromUpdateAt
				PerPage: 10,
			}

			result, err := postStore.getPostsByTimeRange(rctx, opts, map[string]bool{})
			require.Error(t, err)
			require.Nil(t, result)
			require.Contains(t, err.Error(), "must provide Cursor, FromCreateAt, or FromUpdateAt")
		})

		t.Run("error when PerPage exceeds 1000", func(t *testing.T) {
			opts := model.GetPostsOptions{
				ChannelId:    channel.Id,
				FromCreateAt: baseTime,
				PerPage:      1001, // Exceeds maximum
			}

			result, err := postStore.getPostsByTimeRange(rctx, opts, map[string]bool{})
			require.Error(t, err)
			require.Nil(t, result)
		})

		t.Run("error when cursor is invalid", func(t *testing.T) {
			opts := model.GetPostsOptions{
				ChannelId: channel.Id,
				Cursor:    "invalid:cursor:format:extra",
				PerPage:   10,
			}

			result, err := postStore.getPostsByTimeRange(rctx, opts, map[string]bool{})
			require.Error(t, err)
			require.Nil(t, result)
		})

		// Edge case tests
		t.Run("empty results when time range has no posts", func(t *testing.T) {
			opts := model.GetPostsOptions{
				ChannelId:    channel.Id,
				FromCreateAt: baseTime + 100000, // Far in the future, no posts
				PerPage:      10,
			}

			result, err := postStore.getPostsByTimeRange(rctx, opts, map[string]bool{})
			require.NoError(t, err)
			require.NotNil(t, result)
			require.Len(t, result.Posts, 0)
			require.NotNil(t, result.HasNext)
			require.False(t, *result.HasNext)
			require.Empty(t, result.NextCursor)
		})

		t.Run("single page when results fit exactly", func(t *testing.T) {
			opts := model.GetPostsOptions{
				ChannelId:    channel.Id,
				FromCreateAt: baseTime,
				PerPage:      10, // Exactly the number of posts we have
			}

			result, err := postStore.getPostsByTimeRange(rctx, opts, map[string]bool{})
			require.NoError(t, err)
			require.NotNil(t, result)
			require.Len(t, result.Posts, 10)
			require.NotNil(t, result.HasNext)
			require.False(t, *result.HasNext)
			require.Empty(t, result.NextCursor)
		})

		t.Run("exact page boundary with HasNext", func(t *testing.T) {
			opts := model.GetPostsOptions{
				ChannelId:    channel.Id,
				FromCreateAt: baseTime,
				PerPage:      5, // Exactly half
			}

			result, err := postStore.getPostsByTimeRange(rctx, opts, map[string]bool{})
			require.NoError(t, err)
			require.NotNil(t, result)
			require.Len(t, result.Posts, 5)
			require.NotNil(t, result.HasNext)
			require.True(t, *result.HasNext)
			require.NotEmpty(t, result.NextCursor)
		})

		t.Run("timestamp collision with multiple posts", func(t *testing.T) {
			// Create additional posts with identical timestamps
			collisionTime := baseTime + 50000
			collisionPosts := make([]*model.Post, 5)
			for i := range 5 {
				post, saveErr := sqlStore.Post().Save(rctx, &model.Post{
					ChannelId: channel.Id,
					UserId:    model.NewId(),
					Message:   "Collision post " + string(rune('A'+i)),
					CreateAt:  collisionTime, // Same timestamp
					UpdateAt:  collisionTime,
				})
				require.NoError(t, saveErr)
				collisionPosts[i] = post
			}

			// Query with pagination to ensure cursor handles timestamp collisions
			opts := model.GetPostsOptions{
				ChannelId:    channel.Id,
				FromCreateAt: collisionTime,
				PerPage:      2,
			}

			// Collect all posts across pages
			allPostIds := make(map[string]bool)
			cursor := ""
			pageCount := 0
			maxPages := 5 // Safety limit

			for pageCount < maxPages {
				if cursor != "" {
					opts.Cursor = cursor
					opts.FromCreateAt = 0 // Clear FromCreateAt when using cursor
				}

				result, err := postStore.getPostsByTimeRange(rctx, opts, map[string]bool{})
				require.NoError(t, err)
				require.NotNil(t, result)

				// Collect post IDs and verify no duplicates
				for id := range result.Posts {
					require.False(t, allPostIds[id], "Found duplicate post %s on page %d", id, pageCount+1)
					allPostIds[id] = true
				}

				pageCount++

				// Check if there are more pages
				if result.HasNext == nil || !*result.HasNext {
					break
				}

				cursor = result.NextCursor
				require.NotEmpty(t, cursor, "HasNext=true but NextCursor is empty")
			}

			// Verify we got all 5 posts with no duplicates
			require.Len(t, allPostIds, 5, "Should have exactly 5 unique posts across all pages")
		})

		t.Run("boundary condition at exact FromCreateAt time", func(t *testing.T) {
			// Query starting exactly at a post's CreateAt time
			exactTime := baseTime + 4000 // 5th post
			opts := model.GetPostsOptions{
				ChannelId:    channel.Id,
				FromCreateAt: exactTime,
				PerPage:      10,
			}

			result, err := postStore.getPostsByTimeRange(rctx, opts, map[string]bool{})
			require.NoError(t, err)
			require.NotNil(t, result)
			// Should include the post AT exactTime (inclusive lower bound)
			require.GreaterOrEqual(t, len(result.Posts), 1)

			// Verify at least one post has CreateAt >= exactTime
			foundAtBoundary := false
			for _, post := range result.Posts {
				if post.CreateAt == exactTime {
					foundAtBoundary = true
					break
				}
			}
			require.True(t, foundAtBoundary, "Should include post at exact FromCreateAt boundary")
		})
	})
}
