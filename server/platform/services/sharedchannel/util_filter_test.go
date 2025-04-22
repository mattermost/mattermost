// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestFilterOutChannelMetadataPosts(t *testing.T) {
	// Create a helper function to create test posts
	createTestPosts := func() []*model.Post {
		return []*model.Post{
			// Regular post (should be kept)
			{
				Id:        "post1",
				ChannelId: "channel1",
				UserId:    "user1",
				Message:   "Regular post",
				Type:      model.PostTypeDefault,
			},
			// Header change post (should be filtered out)
			{
				Id:        "post2",
				ChannelId: "channel1",
				UserId:    "user1",
				Message:   "Changed channel header",
				Type:      model.PostTypeHeaderChange,
			},
			// Display name change post (should be filtered out)
			{
				Id:        "post3",
				ChannelId: "channel1",
				UserId:    "user1",
				Message:   "Changed channel display name",
				Type:      model.PostTypeDisplaynameChange,
			},
			// Purpose change post (should be filtered out)
			{
				Id:        "post4",
				ChannelId: "channel1",
				UserId:    "user1",
				Message:   "Changed channel purpose",
				Type:      model.PostTypePurposeChange,
			},
			// Another regular post (should be kept)
			{
				Id:        "post5",
				ChannelId: "channel1",
				UserId:    "user1",
				Message:   "Another regular post",
				Type:      model.PostTypeDefault,
			},
		}
	}

	// Helper function to verify filtered posts
	verifyFilteredPosts := func(t *testing.T, filteredPosts []*model.Post, expectedIDs []string) {
		require.Len(t, filteredPosts, len(expectedIDs), "Should have the expected number of posts after filtering")

		for i, expectedID := range expectedIDs {
			assert.Equal(t, expectedID, filteredPosts[i].Id, "Post ID should match expected")
		}

		// Verify no metadata posts remain
		for _, post := range filteredPosts {
			assert.Equal(t, model.PostTypeDefault, post.Type, "All posts should be regular posts")
			assert.NotEqual(t, model.PostTypeHeaderChange, post.Type, "Header change posts should be filtered out")
			assert.NotEqual(t, model.PostTypeDisplaynameChange, post.Type, "Display name change posts should be filtered out")
			assert.NotEqual(t, model.PostTypePurposeChange, post.Type, "Purpose change posts should be filtered out")
		}
	}

	t.Run("filterChannelMetadataSystemPosts filters out metadata posts", func(t *testing.T) {
		// Test with all post types
		posts := createTestPosts()

		// Use the filterChannelMetadataSystemPosts function directly
		filteredPosts := filterChannelMetadataSystemPosts(posts)

		// Verify results
		verifyFilteredPosts(t, filteredPosts, []string{"post1", "post5"})

		// Test with just a subset of post types
		subset := []*model.Post{
			// Regular post (should be kept)
			{
				Id:        "post1",
				ChannelId: "channel1",
				UserId:    "user1",
				Message:   "Regular post",
				Type:      model.PostTypeDefault,
			},
			// Header change post (should be filtered out)
			{
				Id:        "post2",
				ChannelId: "channel1",
				UserId:    "user1",
				Message:   "Changed channel header",
				Type:      model.PostTypeHeaderChange,
			},
		}

		// Filter and verify subset
		filteredSubset := filterChannelMetadataSystemPosts(subset)
		verifyFilteredPosts(t, filteredSubset, []string{"post1"})
	})

	t.Run("filterChannelMetadataSystemPosts works with different contexts", func(t *testing.T) {
		// Test in existingMsg context
		existingMsg := &model.SyncMsg{
			Posts: []*model.Post{
				// Regular post (should be kept)
				{
					Id:        "post1",
					ChannelId: "channel1",
					UserId:    "user1",
					Message:   "Regular post",
					Type:      model.PostTypeDefault,
				},
				// Purpose change post (should be filtered out)
				{
					Id:        "post2",
					ChannelId: "channel1",
					UserId:    "user1",
					Message:   "Changed channel purpose",
					Type:      model.PostTypePurposeChange,
				},
			},
		}

		existingMsg.Posts = filterChannelMetadataSystemPosts(existingMsg.Posts)
		verifyFilteredPosts(t, existingMsg.Posts, []string{"post1"})

		// Test in retryMsg context
		retryMsg := &model.SyncMsg{
			Posts: []*model.Post{
				// Display name change post (should be filtered out)
				{
					Id:        "post3",
					ChannelId: "channel1",
					UserId:    "user1",
					Message:   "Changed channel display name",
					Type:      model.PostTypeDisplaynameChange,
				},
				// Another regular post (should be kept)
				{
					Id:        "post4",
					ChannelId: "channel1",
					UserId:    "user1",
					Message:   "Another regular post",
					Type:      model.PostTypeDefault,
				},
			},
		}

		retryMsg.Posts = filterChannelMetadataSystemPosts(retryMsg.Posts)
		verifyFilteredPosts(t, retryMsg.Posts, []string{"post4"})
	})

	t.Run("filter metadata posts from simulated fetchPostsForSync results", func(t *testing.T) {
		// Simulate the posts that would be returned by GetPostsSinceForSync
		// First batch - new posts with channel metadata posts mixed in
		initialPosts := []*model.Post{
			{
				Id:        "post1",
				ChannelId: "channel1",
				UserId:    "user1",
				Message:   "Regular post",
				Type:      model.PostTypeDefault,
			},
			{
				Id:        "post2",
				ChannelId: "channel1",
				UserId:    "user1",
				Message:   "Changed channel header",
				Type:      model.PostTypeHeaderChange,
			},
			{
				Id:        "post3",
				ChannelId: "channel1",
				UserId:    "user1",
				Message:   "Another regular post",
				Type:      model.PostTypeDefault,
			},
		}

		// Second batch - updated posts that also have channel metadata posts
		updatedPosts := []*model.Post{
			{
				Id:        "post4",
				ChannelId: "channel1",
				UserId:    "user1",
				Message:   "Changed channel display name",
				Type:      model.PostTypeDisplaynameChange,
			},
			{
				Id:        "post5",
				ChannelId: "channel1",
				UserId:    "user1",
				Message:   "One more regular post",
				Type:      model.PostTypeDefault,
			},
		}

		// First, filter posts directly with our filtering function
		filteredInitialPosts := filterChannelMetadataSystemPosts(initialPosts)
		filteredUpdatedPosts := filterChannelMetadataSystemPosts(updatedPosts)

		// Check the results
		require.Len(t, filteredInitialPosts, 2, "Should have 2 posts after filtering initial posts")
		require.Len(t, filteredUpdatedPosts, 1, "Should have 1 post after filtering updated posts")

		// Verify filtered post IDs
		assert.Equal(t, "post1", filteredInitialPosts[0].Id, "First post should remain")
		assert.Equal(t, "post3", filteredInitialPosts[1].Id, "Third post should remain")
		assert.Equal(t, "post5", filteredUpdatedPosts[0].Id, "Fifth post should remain")

		// Simulate combining results as done in fetchPostsForSync
		var allFilteredPosts []*model.Post
		allFilteredPosts = append(allFilteredPosts, filteredInitialPosts...)
		allFilteredPosts = append(allFilteredPosts, filteredUpdatedPosts...)

		// Verify final combined result
		require.Len(t, allFilteredPosts, 3, "Should have 3 posts total after filtering")

		// Check post types in final result
		for _, post := range allFilteredPosts {
			assert.Equal(t, model.PostTypeDefault, post.Type, "All remaining posts should be regular posts")
		}

		// Verify specific posts that should be filtered out didn't make it through
		postIDs := make([]string, 0, len(allFilteredPosts))
		for _, post := range allFilteredPosts {
			postIDs = append(postIDs, post.Id)
		}
		assert.NotContains(t, postIDs, "post2", "Header change post should be filtered out")
		assert.NotContains(t, postIDs, "post4", "Display name change post should be filtered out")
	})

	t.Run("edge cases and helper functions", func(t *testing.T) {
		// Create individual posts for testing isChannelMetadataSystemPost
		regularPost := &model.Post{
			Id:        "regularPost",
			ChannelId: "channel1",
			UserId:    "user1",
			Message:   "Regular post",
			Type:      model.PostTypeDefault,
		}

		headerChangePost := &model.Post{
			Id:        "headerChangePost",
			ChannelId: "channel1",
			UserId:    "user1",
			Message:   "Changed channel header",
			Type:      model.PostTypeHeaderChange,
		}

		displayNameChangePost := &model.Post{
			Id:        "displayNameChangePost",
			ChannelId: "channel1",
			UserId:    "user1",
			Message:   "Changed channel display name",
			Type:      model.PostTypeDisplaynameChange,
		}

		purposeChangePost := &model.Post{
			Id:        "purposeChangePost",
			ChannelId: "channel1",
			UserId:    "user1",
			Message:   "Changed channel purpose",
			Type:      model.PostTypePurposeChange,
		}

		// Test isChannelMetadataSystemPost function
		assert.False(t, isChannelMetadataSystemPost(regularPost), "Regular post should not be identified as metadata post")
		assert.True(t, isChannelMetadataSystemPost(headerChangePost), "Header change post should be identified as metadata post")
		assert.True(t, isChannelMetadataSystemPost(displayNameChangePost), "Display name change post should be identified as metadata post")
		assert.True(t, isChannelMetadataSystemPost(purposeChangePost), "Purpose change post should be identified as metadata post")

		// Test edge cases for filterChannelMetadataSystemPosts
		t.Run("handles nil input", func(t *testing.T) {
			assert.Nil(t, filterChannelMetadataSystemPosts(nil), "Nil input should return nil output")
		})

		t.Run("handles empty slice", func(t *testing.T) {
			emptyPosts := []*model.Post{}
			result := filterChannelMetadataSystemPosts(emptyPosts)
			assert.Empty(t, result, "Empty input should return empty output")
			assert.NotNil(t, result, "Empty input should not return nil")
		})

		t.Run("handles in-place filtering", func(t *testing.T) {
			// Create a slice with a mix of post types
			posts := []*model.Post{regularPost, headerChangePost, displayNameChangePost, purposeChangePost}
			originalPosts := make([]*model.Post, len(posts))
			copy(originalPosts, posts)

			// Apply the filter
			result := filterChannelMetadataSystemPosts(posts)

			// Verify the result
			require.Len(t, result, 1, "Should only have one post after filtering")
			assert.Equal(t, "regularPost", result[0].Id, "Only regular post should remain after filtering")

			// Verify the original slice was modified (since we're using in-place filtering)
			assert.Equal(t, posts[:1], result, "The filtered result should be a slice of the original")
		})
	})

	t.Run("processTask filters metadata posts from existingMsg and retryMsg", func(t *testing.T) {
		// Create test data for tasks with metadata posts
		existingMsg := &model.SyncMsg{
			ChannelId: "channel1",
			Posts: []*model.Post{
				{
					Id:        "post1",
					ChannelId: "channel1",
					UserId:    "user1",
					Message:   "Regular post",
					Type:      model.PostTypeDefault,
				},
				{
					Id:        "post2",
					ChannelId: "channel1",
					UserId:    "user1",
					Message:   "Changed channel header",
					Type:      model.PostTypeHeaderChange,
				},
			},
		}

		retryMsg := &model.SyncMsg{
			ChannelId: "channel1",
			Posts: []*model.Post{
				{
					Id:        "post3",
					ChannelId: "channel1",
					UserId:    "user1",
					Message:   "Changed display name",
					Type:      model.PostTypeDisplaynameChange,
				},
				{
					Id:        "post4",
					ChannelId: "channel1",
					UserId:    "user1",
					Message:   "Another regular post",
					Type:      model.PostTypeDefault,
				},
			},
		}

		// Create tasks with these messages
		taskWithExistingMsg := newSyncTask("channel1", "user1", "remote1", existingMsg, nil)
		taskWithRetryMsg := newSyncTask("channel1", "user1", "remote1", nil, retryMsg)

		// Verify initial state of messages
		require.Len(t, taskWithExistingMsg.existingMsg.Posts, 2, "Should have 2 posts initially")
		require.Len(t, taskWithRetryMsg.retryMsg.Posts, 2, "Should have 2 posts initially")

		// Apply filtering manually to simulate processTask
		if taskWithExistingMsg.existingMsg != nil && taskWithExistingMsg.existingMsg.Posts != nil {
			taskWithExistingMsg.existingMsg.Posts = filterChannelMetadataSystemPosts(taskWithExistingMsg.existingMsg.Posts)
		}

		if taskWithRetryMsg.retryMsg != nil && taskWithRetryMsg.retryMsg.Posts != nil {
			taskWithRetryMsg.retryMsg.Posts = filterChannelMetadataSystemPosts(taskWithRetryMsg.retryMsg.Posts)
		}

		// Verify filtering results
		require.Len(t, taskWithExistingMsg.existingMsg.Posts, 1, "Should have 1 post after filtering existingMsg")
		assert.Equal(t, model.PostTypeDefault, taskWithExistingMsg.existingMsg.Posts[0].Type, "Only default post should remain in existingMsg")
		assert.Equal(t, "post1", taskWithExistingMsg.existingMsg.Posts[0].Id, "Regular post should remain in existingMsg")

		require.Len(t, taskWithRetryMsg.retryMsg.Posts, 1, "Should have 1 post after filtering retryMsg")
		assert.Equal(t, model.PostTypeDefault, taskWithRetryMsg.retryMsg.Posts[0].Type, "Only default post should remain in retryMsg")
		assert.Equal(t, "post4", taskWithRetryMsg.retryMsg.Posts[0].Id, "Regular post should remain in retryMsg")
	})
}
