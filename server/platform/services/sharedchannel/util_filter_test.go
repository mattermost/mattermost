// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
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

	t.Run("filterPostsForSync applies other filtering criteria", func(t *testing.T) {
		// Setup test service and data
		scs := Service{}
		
		// Create test posts that are already filtered for metadata
		// (since filtering now happens in fetchPostsForSync)
		posts := []*model.Post{
			// Regular post (should be kept)
			{
				Id:        "post1",
				ChannelId: "channel1",
				UserId:    "user1",
				Message:   "Regular post",
				Type:      model.PostTypeDefault,
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
		
		sd := &syncData{
			posts: posts,
			scr: &model.SharedChannelRemote{
				Id:               "remote1",
				ChannelId:        "channel1",
				RemoteId:         "remoteCluster1",
				LastPostUpdateAt: 0,
				LastPostCreateAt: 0,
			},
			rc: &model.RemoteCluster{
				RemoteId: "remoteCluster1",
			},
		}

		// Run the function being tested
		scs.filterPostsForSync(sd)

		// Verify results - both posts should remain since they're not metadata posts
		require.Len(t, sd.posts, 2, "Both posts should be kept")
		assert.Equal(t, "post1", sd.posts[0].Id, "First post should be kept")
		assert.Equal(t, "post5", sd.posts[1].Id, "Second post should be kept")
	})

	t.Run("filterMetadataSystemPosts filters out metadata posts", func(t *testing.T) {
		// Test with all post types
		posts := createTestPosts()
		
		// Use the filterMetadataSystemPosts function directly
		filteredPosts := filterMetadataSystemPosts(posts)

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
		filteredSubset := filterMetadataSystemPosts(subset)
		verifyFilteredPosts(t, filteredSubset, []string{"post1"})
	})

	t.Run("filterMetadataSystemPosts works with different contexts", func(t *testing.T) {
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

		existingMsg.Posts = filterMetadataSystemPosts(existingMsg.Posts)
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

		retryMsg.Posts = filterMetadataSystemPosts(retryMsg.Posts)
		verifyFilteredPosts(t, retryMsg.Posts, []string{"post4"})
	})

	t.Run("fetchPostsForSync with mock store", func(t *testing.T) {
		// Create mocks
		mockStore := &mocks.Store{}
		mockPostStore := &mocks.PostStore{}
		mockServer := &MockServerIface{}

		// Setup the mocked responses
		mockStore.On("Post").Return(mockPostStore)
		mockServer.On("GetStore").Return(mockStore)
		mockServer.On("Log").Return(mlog.NewLogger())
		mockServer.On("GetMetrics").Return(nil)

		// Create config
		cfg := &model.Config{}
		cfg.SetDefaults()
		maxPostsPerSync := 100
		cfg.ConnectedWorkspacesSettings = model.ConnectedWorkspacesSettings{
			MaxPostsPerSync: &maxPostsPerSync,
		}
		cfg.ConnectedWorkspacesSettings.SetDefaults(false, model.ExperimentalSettings{})
		mockServer.On("Config").Return(cfg)

		// Mock the database responses for GetPostsSinceForSync
		// First response - new posts with channel metadata posts mixed in
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

		// Second response - updated posts that also have channel metadata posts
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

		// Setup the mock PostStore expectations for both calls
		mockPostStore.On("GetPostsSinceForSync",
			mock.AnythingOfType("model.GetPostsSinceForSyncOptions"),
			mock.AnythingOfType("model.GetPostsSinceForSyncCursor"),
			mock.AnythingOfType("int"),
		).Return(initialPosts, model.GetPostsSinceForSyncCursor{}, nil).Once()

		mockPostStore.On("GetPostsSinceForSync",
			mock.AnythingOfType("model.GetPostsSinceForSyncOptions"),
			mock.AnythingOfType("model.GetPostsSinceForSyncCursor"),
			mock.AnythingOfType("int"),
		).Return(updatedPosts, model.GetPostsSinceForSyncCursor{}, nil).Once()

		// Create the service
		scs := Service{
			server: mockServer,
		}

		// Setup syncData
		sd := &syncData{
			task: syncTask{
				channelID: "channel1",
			},
			scr: &model.SharedChannelRemote{
				Id:               "remote1",
				ChannelId:        "channel1",
				RemoteId:         "remoteCluster1",
				LastPostUpdateAt: 0,
				LastPostCreateAt: 0,
			},
			rc: &model.RemoteCluster{
				RemoteId: "remoteCluster1",
			},
		}

		// Call fetchPostsForSync
		err := scs.fetchPostsForSync(sd)
		require.NoError(t, err)

		// Verify results - we should only have the regular posts, not the channel metadata posts
		require.Len(t, sd.posts, 3, "Should have 3 posts after filtering out channel metadata posts")

		// Check that all posts have the correct type
		postTypes := make([]string, 0, len(sd.posts))
		for _, post := range sd.posts {
			postTypes = append(postTypes, post.Type)
		}

		// All posts should be regular posts
		for _, postType := range postTypes {
			assert.Equal(t, model.PostTypeDefault, postType, "All posts should be regular posts")
		}

		// Verify that no metadata posts made it through
		for _, post := range sd.posts {
			assert.NotEqual(t, model.PostTypeHeaderChange, post.Type, "Header change posts should be filtered out")
			assert.NotEqual(t, model.PostTypeDisplaynameChange, post.Type, "Display name change posts should be filtered out")
			assert.NotEqual(t, model.PostTypePurposeChange, post.Type, "Purpose change posts should be filtered out")
		}

		// Verify mock expectations were met
		mockPostStore.AssertExpectations(t)
	})

	t.Run("edge cases and helper functions", func(t *testing.T) {
		// Create individual posts for testing isMetadataSystemPost
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

		// Test isMetadataSystemPost function
		assert.False(t, isMetadataSystemPost(regularPost), "Regular post should not be identified as metadata post")
		assert.True(t, isMetadataSystemPost(headerChangePost), "Header change post should be identified as metadata post")
		assert.True(t, isMetadataSystemPost(displayNameChangePost), "Display name change post should be identified as metadata post")
		assert.True(t, isMetadataSystemPost(purposeChangePost), "Purpose change post should be identified as metadata post")

		// Test edge cases for filterMetadataSystemPosts
		t.Run("handles nil input", func(t *testing.T) {
			assert.Nil(t, filterMetadataSystemPosts(nil), "Nil input should return nil output")
		})

		t.Run("handles empty slice", func(t *testing.T) {
			emptyPosts := []*model.Post{}
			result := filterMetadataSystemPosts(emptyPosts)
			assert.Empty(t, result, "Empty input should return empty output")
			assert.NotNil(t, result, "Empty input should not return nil")
		})

		t.Run("handles in-place filtering", func(t *testing.T) {
			// Create a slice with a mix of post types
			posts := []*model.Post{regularPost, headerChangePost, displayNameChangePost, purposeChangePost}
			originalPosts := make([]*model.Post, len(posts))
			copy(originalPosts, posts)
			
			// Apply the filter
			result := filterMetadataSystemPosts(posts)
			
			// Verify the result
			require.Len(t, result, 1, "Should only have one post after filtering")
			assert.Equal(t, "regularPost", result[0].Id, "Only regular post should remain after filtering")
			
			// Verify the original slice was modified (since we're using in-place filtering)
			assert.Equal(t, posts[:1], result, "The filtered result should be a slice of the original")
		})
	})
}
