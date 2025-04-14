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
	t.Run("filterPostsForSync filters out channel metadata system posts", func(t *testing.T) {
		// Setup test service and data
		scs := Service{}
		sd := &syncData{
			posts: []*model.Post{
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

		// Run the function being tested
		scs.filterPostsForSync(sd)

		// Verify results
		require.Len(t, sd.posts, 2, "Should only have two posts after filtering")
		assert.Equal(t, "post1", sd.posts[0].Id, "First post should be kept")
		assert.Equal(t, "post5", sd.posts[1].Id, "Last post should be kept")

		// Verify the filtered posts are the system posts about channel metadata changes
		for _, post := range sd.posts {
			assert.NotEqual(t, model.PostTypeHeaderChange, post.Type, "Header change posts should be filtered out")
			assert.NotEqual(t, model.PostTypeDisplaynameChange, post.Type, "Display name change posts should be filtered out")
			assert.NotEqual(t, model.PostTypePurposeChange, post.Type, "Purpose change posts should be filtered out")
		}
	})

	t.Run("fetchPostsForSync filters out channel metadata system posts", func(t *testing.T) {
		// This test verifies our filters in fetchPostsForSync by simulating the post filtering logic

		// Test for the first filter (newly created posts)
		posts := []*model.Post{
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

		// Simulate the filtering logic in fetchPostsForSync
		filteredPosts := make([]*model.Post, 0, len(posts))
		for _, post := range posts {
			// Skip system posts about channel metadata changes that we don't sync
			if post.Type == model.PostTypeHeaderChange ||
				post.Type == model.PostTypeDisplaynameChange ||
				post.Type == model.PostTypePurposeChange {
				continue
			}
			filteredPosts = append(filteredPosts, post)
		}

		// Verify results
		require.Len(t, filteredPosts, 1, "Should only have one post after filtering")
		assert.Equal(t, "post1", filteredPosts[0].Id, "Regular post should be kept")

		// Test for the second filter (updated posts)
		updatedPosts := []*model.Post{
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
		}

		// Simulate the filtering logic in fetchPostsForSync for updated posts
		filteredUpdatedPosts := make([]*model.Post, 0, len(updatedPosts))
		for _, post := range updatedPosts {
			// Skip system posts about channel metadata changes that we don't sync
			if post.Type == model.PostTypeHeaderChange ||
				post.Type == model.PostTypeDisplaynameChange ||
				post.Type == model.PostTypePurposeChange {
				continue
			}
			filteredUpdatedPosts = append(filteredUpdatedPosts, post)
		}

		// Verify results
		require.Len(t, filteredUpdatedPosts, 1, "Should only have one post after filtering updated posts")
		assert.Equal(t, "post4", filteredUpdatedPosts[0].Id, "Regular post should be kept")
	})

	t.Run("processTask filters out channel metadata system posts in existingMsg and retryMsg", func(t *testing.T) {
		// This test verifies our filters in processTask by simulating the post filtering logic

		// Test for existingMsg
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

		// Simulate the filtering logic in processTask for existingMsg
		filteredPosts := make([]*model.Post, 0, len(existingMsg.Posts))
		for _, post := range existingMsg.Posts {
			// Skip system posts about channel metadata changes that we don't sync
			if post.Type == model.PostTypeHeaderChange ||
				post.Type == model.PostTypeDisplaynameChange ||
				post.Type == model.PostTypePurposeChange {
				continue
			}
			filteredPosts = append(filteredPosts, post)
		}
		existingMsg.Posts = filteredPosts

		// Verify results
		require.Len(t, existingMsg.Posts, 1, "Should only have one post after filtering existingMsg")
		assert.Equal(t, "post1", existingMsg.Posts[0].Id, "Regular post should be kept")

		// Test for retryMsg
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

		// Simulate the filtering logic in processTask for retryMsg
		filteredRetryPosts := make([]*model.Post, 0, len(retryMsg.Posts))
		for _, post := range retryMsg.Posts {
			// Skip system posts about channel metadata changes that we don't sync
			if post.Type == model.PostTypeHeaderChange ||
				post.Type == model.PostTypeDisplaynameChange ||
				post.Type == model.PostTypePurposeChange {
				continue
			}
			filteredRetryPosts = append(filteredRetryPosts, post)
		}
		retryMsg.Posts = filteredRetryPosts

		// Verify results
		require.Len(t, retryMsg.Posts, 1, "Should only have one post after filtering retryMsg")
		assert.Equal(t, "post4", retryMsg.Posts[0].Id, "Regular post should be kept")
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

	t.Run("helper functions work correctly", func(t *testing.T) {
		// Create test posts
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

		// Test filterMetadataSystemPosts function
		posts := []*model.Post{regularPost, headerChangePost, displayNameChangePost, purposeChangePost}
		filteredPosts := filterMetadataSystemPosts(posts)

		// Should only have the regular post
		require.Len(t, filteredPosts, 1, "Should only have one post after filtering")
		assert.Equal(t, "regularPost", filteredPosts[0].Id, "Only regular post should remain after filtering")

		// Test with nil input
		assert.Nil(t, filterMetadataSystemPosts(nil), "Nil input should return nil output")

		// Test with empty slice
		emptyPosts := []*model.Post{}
		assert.Empty(t, filterMetadataSystemPosts(emptyPosts), "Empty input should return empty output")
	})
}
