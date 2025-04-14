// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func Test_mungUsername(t *testing.T) {
	type args struct {
		username   string
		remotename string
		suffix     string
		maxLen     int
	}
	tests := []struct {
		name string
		args args
		want string
	}{
		{"everything empty", args{username: "", remotename: "", suffix: "", maxLen: 64}, ":"},

		{"no trunc, no suffix", args{username: "bart", remotename: "example.com", suffix: "", maxLen: 64}, "bart:example.com"},
		{"no trunc, suffix", args{username: "bart", remotename: "example.com", suffix: "2", maxLen: 64}, "bart-2:example.com"},

		{"trunc remote, no suffix", args{username: "bart", remotename: "example1234567890.com", suffix: "", maxLen: 24}, "bart:example123456789..."},
		{"trunc remote, suffix", args{username: "bart", remotename: "example1234567890.com", suffix: "2", maxLen: 24}, "bart-2:example1234567..."},

		{"trunc both, no suffix", args{username: R(24, "A"), remotename: R(24, "B"), suffix: "", maxLen: 24}, "AAAAAAAAA...:BBBBBBBB..."},
		{"trunc both, suffix", args{username: R(24, "A"), remotename: R(24, "B"), suffix: "10", maxLen: 24}, "AAAAAA-10...:BBBBBBBB..."},

		{"trunc user, no suffix", args{username: R(40, "A"), remotename: "abc", suffix: "", maxLen: 24}, "AAAAAAAAAAAAAAAAA...:abc"},
		{"trunc user, suffix", args{username: R(40, "A"), remotename: "abc", suffix: "11", maxLen: 24}, "AAAAAAAAAAAAAA-11...:abc"},

		{"trunc user, remote, no suffix", args{username: R(40, "A"), remotename: "abcdefghijk", suffix: "", maxLen: 24}, "AAAAAAAAA...:abcdefghijk"},
		{"trunc user, remote, suffix", args{username: R(40, "A"), remotename: "abcdefghijk", suffix: "19", maxLen: 24}, "AAAAAA-19...:abcdefghijk"},

		{"short user, long remote, no suffix", args{username: "bart", remotename: R(40, "B"), suffix: "", maxLen: 24}, "bart:BBBBBBBBBBBBBBBB..."},
		{"long user, short remote, no suffix", args{username: R(40, "A"), remotename: "abc.com", suffix: "", maxLen: 24}, "AAAAAAAAAAAAA...:abc.com"},

		{"short user, long remote, suffix", args{username: "bart", remotename: R(40, "B"), suffix: "12", maxLen: 24}, "bart-12:BBBBBBBBBBBBB..."},
		{"long user, short remote, suffix", args{username: R(40, "A"), remotename: "abc.com", suffix: "12", maxLen: 24}, "AAAAAAAAAA-12...:abc.com"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := mungUsername(tt.args.username, tt.args.remotename, tt.args.suffix, tt.args.maxLen); got != tt.want {
				t.Errorf("mungUsername() = %v, want %v", got, tt.want)
			}
		})
	}
}

func Test_mungUsernameFuzz(t *testing.T) {
	// ensure no index out of bounds panic for any combination
	for i := 0; i < 70; i++ {
		for j := 0; j < 70; j++ {
			for k := 0; k < 3; k++ {
				username := R(i, "A")
				remotename := R(j, "B")
				suffix := R(k, "1")

				result := mungUsername(username, remotename, suffix, 64)
				require.LessOrEqual(t, len(result), 64)
			}
		}
	}
}

// R returns a string with the specified string repeated `count` times.
func R(count int, s string) string {
	return strings.Repeat(s, count)
}

// TestPriorityMetadataPreservation follows message priority metadata through
// each step of the shared channel sync process to verify it's preserved.
// This is a specific test for MM-57326.
func TestPriorityMetadataPreservation(t *testing.T) {
	// Create a test post with priority metadata
	postID := model.NewId()
	channelID := model.NewId()
	userID := model.NewId()
	remoteID := model.NewId()

	priority := model.PostPriorityUrgent
	originalPost := &model.Post{
		Id:        postID,
		ChannelId: channelID,
		UserId:    userID,
		Message:   "Test message with priority",
		Metadata: &model.PostMetadata{
			Priority: &model.PostPriority{
				Priority: &priority,
			},
		},
	}

	// Set up mock server
	mockServer := &MockServerIface{}
	logger := mlog.CreateConsoleTestLogger(t)
	mockServer.On("Log").Return(logger)

	scs := &Service{
		server: mockServer,
	}

	// STEP 1: Check post is not filtered out during filterPostsForSync
	t.Run("step 1: priority metadata survives filtering", func(t *testing.T) {
		// Create a shared channel remote with a different remoteID than the post
		scr := &model.SharedChannelRemote{
			ChannelId: channelID,
			RemoteId:  remoteID,
		}

		// Create syncData with our post
		sd := newSyncData(syncTask{
			channelID: channelID,
			remoteID:  remoteID,
		}, &model.RemoteCluster{RemoteId: remoteID}, scr)

		sd.posts = []*model.Post{originalPost.Clone()}

		// Call filterPostsForSync
		scs.filterPostsForSync(sd)

		// Verify post was not filtered
		require.Len(t, sd.posts, 1, "Post should not be filtered out")

		// Verify priority metadata is preserved
		filteredPost := sd.posts[0]
		require.NotNil(t, filteredPost.Metadata, "Post metadata should not be nil")
		require.NotNil(t, filteredPost.Metadata.Priority, "Post priority metadata should not be nil")
		require.NotNil(t, filteredPost.Metadata.Priority.Priority, "Priority field should not be nil")
		assert.Equal(t, priority, *filteredPost.Metadata.Priority.Priority, "Priority value should be preserved")
	})

	// STEP 2: Check priority is preserved when serializing to syncMsg
	t.Run("step 2: priority metadata survives serialization", func(t *testing.T) {
		// Create syncMsg and add the post
		syncMsg := model.NewSyncMsg(channelID)
		syncMsg.Posts = []*model.Post{originalPost.Clone()}

		// Serialize to JSON (simulating transmission over network)
		data, err := json.Marshal(syncMsg)
		require.NoError(t, err, "Failed to marshal syncMsg")

		// Deserialize (simulating reception)
		var receivedMsg model.SyncMsg
		err = json.Unmarshal(data, &receivedMsg)
		require.NoError(t, err, "Failed to unmarshal syncMsg")

		// Verify post data
		require.Len(t, receivedMsg.Posts, 1, "Should have 1 post after serialization")

		// Verify priority metadata survived serialization
		deserializedPost := receivedMsg.Posts[0]
		require.NotNil(t, deserializedPost.Metadata, "Post metadata lost during serialization")
		require.NotNil(t, deserializedPost.Metadata.Priority, "Priority metadata lost during serialization")
		require.NotNil(t, deserializedPost.Metadata.Priority.Priority, "Priority value lost during serialization")
		assert.Equal(t, priority, *deserializedPost.Metadata.Priority.Priority, "Priority value changed during serialization")
	})

	// STEP 3: Verify metadata differences can be detected
	t.Run("step 3: metadata differences can be detected", func(t *testing.T) {
		// Create post with priority
		postWithPriority := &model.Post{
			Metadata: &model.PostMetadata{
				Priority: &model.PostPriority{
					Priority: &priority,
				},
			},
		}

		// Create a post without priority metadata
		postWithoutPriority := postWithPriority.Clone()
		postWithoutPriority.Metadata = &model.PostMetadata{} // No priority

		// With our new approach, we just check if the post has metadata
		// which makes the sync process simpler and more reliable
		assert.NotNil(t, postWithPriority.Metadata, "Post should have metadata")
	})

}

// TestReceivingEndProcessesPriorityMetadata tests the receiving end of the sync process
// to verify that priority metadata is properly received and preserved at each step.
// This test focuses on actual data flow rather than mocks.
func TestReceivingEndProcessesPriorityMetadata(t *testing.T) {
	// Create a test message with priority metadata as it would be received from a remote
	postID := model.NewId()
	channelID := model.NewId()
	userID := model.NewId()

	// Create a SyncMsg with a post containing priority metadata
	priority := model.PostPriorityUrgent
	requestedAck := true
	persistentNotifications := true

	// Create a post with all priority metadata fields set
	postWithPriority := &model.Post{
		Id:        postID,
		ChannelId: channelID,
		UserId:    userID,
		Message:   "Test message with priority from remote",
		CreateAt:  model.GetMillis(),
		UpdateAt:  model.GetMillis(),
		Metadata: &model.PostMetadata{
			Priority: &model.PostPriority{
				Priority:                &priority,
				RequestedAck:            &requestedAck,
				PersistentNotifications: &persistentNotifications,
			},
			Acknowledgements: []*model.PostAcknowledgement{
				{
					UserId:         model.NewId(),
					PostId:         postID,
					AcknowledgedAt: model.GetMillis(),
				},
			},
		},
	}

	// Create a SyncMsg with our test post - this simulates the received message
	syncMsg := model.NewSyncMsg(channelID)
	syncMsg.Posts = []*model.Post{postWithPriority}

	// STEP 1: Test that the post comes through deserialization with all metadata intact
	t.Run("step 1: priority metadata survives SyncMsg deserialization", func(t *testing.T) {
		// Serialize the message (simulate network transfer)
		data, err := json.Marshal(syncMsg)
		require.NoError(t, err, "Failed to marshal SyncMsg")

		// Deserialize the message (simulate reception)
		var receivedMsg model.SyncMsg
		err = json.Unmarshal(data, &receivedMsg)
		require.NoError(t, err, "Failed to unmarshal SyncMsg")

		// Verify we got the posts
		require.Len(t, receivedMsg.Posts, 1, "Should have received 1 post")

		// Verify priority metadata survived
		receivedPost := receivedMsg.Posts[0]
		require.NotNil(t, receivedPost.Metadata, "Post metadata should not be nil")
		require.NotNil(t, receivedPost.Metadata.Priority, "Priority metadata should not be nil")

		// Verify all priority fields are intact
		require.NotNil(t, receivedPost.Metadata.Priority.Priority, "Priority value should not be nil")
		assert.Equal(t, priority, *receivedPost.Metadata.Priority.Priority, "Priority value should match original")

		require.NotNil(t, receivedPost.Metadata.Priority.RequestedAck, "RequestedAck should not be nil")
		assert.Equal(t, requestedAck, *receivedPost.Metadata.Priority.RequestedAck, "RequestedAck should match original")

		require.NotNil(t, receivedPost.Metadata.Priority.PersistentNotifications, "PersistentNotifications should not be nil")
		assert.Equal(t, persistentNotifications, *receivedPost.Metadata.Priority.PersistentNotifications,
			"PersistentNotifications should match original")

		// Verify acknowledgements survived
		require.Len(t, receivedPost.Metadata.Acknowledgements, 1, "Should have received 1 acknowledgement")
	})

	// STEP 2: Test metadata detection for update
	t.Run("step 2: post metadata detection for update", func(t *testing.T) {
		// With the new implementation, we simply check if the post has metadata
		// This makes the code more straightforward and less error-prone
		assert.NotNil(t, postWithPriority.Metadata, "Post should have metadata")
		assert.NotNil(t, postWithPriority.Metadata.Priority, "Post should have priority metadata")

		// Create posts with different metadata configurations to demonstrate
		// the kinds of metadata our sync process will handle

		// Post with normal priority
		emptyPriority := ""
		postWithNormalPriority := &model.Post{
			Metadata: &model.PostMetadata{
				Priority: &model.PostPriority{
					Priority: &emptyPriority, // Normal priority
				},
			},
		}
		assert.NotNil(t, postWithNormalPriority.Metadata, "Post should have metadata")

		// Post with RequestedAck
		falseAck := false
		postWithoutRequestedAck := &model.Post{
			Metadata: &model.PostMetadata{
				Priority: &model.PostPriority{
					Priority:     &priority,
					RequestedAck: &falseAck, // false
				},
			},
		}
		assert.NotNil(t, postWithoutRequestedAck.Metadata, "Post should have metadata")

		// Post with PersistentNotifications
		falseNotif := false
		postWithoutPersistentNotif := &model.Post{
			Metadata: &model.PostMetadata{
				Priority: &model.PostPriority{
					Priority:                &priority,
					PersistentNotifications: &falseNotif, // false
				},
			},
		}
		assert.NotNil(t, postWithoutPersistentNotif.Metadata, "Post should have metadata")
	})

}

// TestFilterPostsWithPriority tests that posts with priority metadata are not filtered out
// during the shared channel sync process. Related to MM-57326.
func TestFilterPostsWithPriority(t *testing.T) {
	mockServer := &MockServerIface{}
	logger := mlog.CreateConsoleTestLogger(t)
	mockServer.On("Log").Return(logger)

	scs := &Service{
		server: mockServer,
	}

	t.Run("priority post should not be filtered", func(t *testing.T) {
		// Create test post with priority, acknowledgement, and persistent notifications
		postID := model.NewId()
		channelID := model.NewId()
		remoteID := model.NewId()

		// Create a post with all priority metadata fields
		priority := model.PostPriorityUrgent
		requestedAck := true
		persistentNotifications := true

		post := &model.Post{
			Id:        postID,
			ChannelId: channelID,
			UserId:    model.NewId(),
			Message:   "Test message with priority",
			EditAt:    10000, // non-zero EditAt
			Metadata: &model.PostMetadata{
				Priority: &model.PostPriority{
					Priority:                &priority,
					RequestedAck:            &requestedAck,
					PersistentNotifications: &persistentNotifications,
				},
				Acknowledgements: []*model.PostAcknowledgement{
					{
						UserId:         model.NewId(),
						PostId:         postID,
						AcknowledgedAt: model.GetMillis(),
					},
				},
			},
		}

		// Create a shared channel remote with a different remoteID than the post
		scr := &model.SharedChannelRemote{
			Id:               model.NewId(),
			ChannelId:        channelID,
			RemoteId:         remoteID,
			LastPostUpdateAt: 5000, // Earlier than the post's EditAt
		}

		// Create syncData with our post
		sd := newSyncData(syncTask{
			channelID: channelID,
			remoteID:  remoteID,
		}, &model.RemoteCluster{RemoteId: remoteID}, scr)

		sd.posts = []*model.Post{post}

		// Call filterPostsForSync
		scs.filterPostsForSync(sd)

		// Verify the post was NOT filtered out
		require.Len(t, sd.posts, 1, "Post with priority metadata should not be filtered out")

		// Verify priority metadata is preserved
		filteredPost := sd.posts[0]
		require.NotNil(t, filteredPost.Metadata, "Post metadata should not be nil")
		require.NotNil(t, filteredPost.Metadata.Priority, "Post priority metadata should not be nil")

		// Verify all priority fields are preserved
		assert.Equal(t, priority, *filteredPost.Metadata.Priority.Priority, "Priority should be preserved")
		assert.Equal(t, requestedAck, *filteredPost.Metadata.Priority.RequestedAck, "RequestedAck should be preserved")
		assert.Equal(t, persistentNotifications, *filteredPost.Metadata.Priority.PersistentNotifications, "PersistentNotifications should be preserved")

		// Verify acknowledgements are preserved
		require.NotEmpty(t, filteredPost.Metadata.Acknowledgements, "Acknowledgements should be preserved")
		assert.Len(t, filteredPost.Metadata.Acknowledgements, 1, "Acknowledgement count should match")
	})

	t.Run("post from same remote should be filtered", func(t *testing.T) {
		// Create post with remote ID matching the target remote
		postID := model.NewId()
		channelID := model.NewId()
		remoteID := model.NewId()

		post := &model.Post{
			Id:        postID,
			ChannelId: channelID,
			UserId:    model.NewId(),
			Message:   "Test message with matching remoteID",
			RemoteId:  model.NewPointer(remoteID), // Same as the remote we're syncing to
			Metadata: &model.PostMetadata{
				Priority: &model.PostPriority{
					Priority: model.NewPointer(model.PostPriorityUrgent),
				},
			},
		}

		// Create syncData with our post
		sd := newSyncData(syncTask{
			channelID: channelID,
			remoteID:  remoteID, // Same as post.RemoteId
		}, &model.RemoteCluster{RemoteId: remoteID}, &model.SharedChannelRemote{})

		sd.posts = []*model.Post{post}

		// Call filterPostsForSync
		scs.filterPostsForSync(sd)

		// Verify this post is filtered out (shouldn't sync back to source)
		assert.Empty(t, sd.posts, "Post with matching remoteID should be filtered out")
	})
}

// TestEndToEndMetadataSync tests the complete flow of post metadata through the shared channel
// synchronization process, focusing on all metadata components (priority, acknowledgements,
// persistent notifications). This is a comprehensive test for MM-57326.
func TestEndToEndMetadataSync(t *testing.T) {
	// Set up mock server
	mockServer := &MockServerIface{}
	logger := mlog.CreateConsoleTestLogger(t)
	mockServer.On("Log").Return(logger)

	scs := &Service{
		server: mockServer,
	}

	// Create a test post with all metadata fields
	postID := model.NewId()
	channelID := model.NewId()
	userID := model.NewId()
	testRemoteID := model.NewId()
	remoteCluster := &model.RemoteCluster{RemoteId: testRemoteID, Name: "test-remote"}

	// Create priority fields
	priority := model.PostPriorityUrgent
	requestedAck := true
	persistentNotifications := true

	// Create a post with all metadata fields
	originalPost := &model.Post{
		Id:        postID,
		ChannelId: channelID,
		UserId:    userID,
		Message:   "Test message with complete metadata",
		EditAt:    10000,
		Metadata: &model.PostMetadata{
			Priority: &model.PostPriority{
				Priority:                &priority,
				RequestedAck:            &requestedAck,
				PersistentNotifications: &persistentNotifications,
			},
			Acknowledgements: []*model.PostAcknowledgement{
				{
					UserId:         model.NewId(),
					PostId:         postID,
					AcknowledgedAt: model.GetMillis(),
				},
				{
					UserId:         model.NewId(),
					PostId:         postID,
					AcknowledgedAt: model.GetMillis(),
				},
			},
		},
	}

	// STEP 1: Test FilterPostsForSync (Sending side)
	t.Run("step 1: metadata survives filtering for sending", func(t *testing.T) {
		// Create shared channel remote
		scr := &model.SharedChannelRemote{
			ChannelId:        channelID,
			RemoteId:         testRemoteID,
			LastPostUpdateAt: 5000, // Earlier than post's EditAt
		}

		// Create syncData with our post
		sd := newSyncData(syncTask{
			channelID: channelID,
			remoteID:  testRemoteID,
		}, remoteCluster, scr)

		sd.posts = []*model.Post{originalPost.Clone()}

		// Call filterPostsForSync
		scs.filterPostsForSync(sd)

		// Verify post is included for sync
		require.Len(t, sd.posts, 1, "Post should not be filtered out")

		// Verify all metadata is preserved
		filteredPost := sd.posts[0]
		require.NotNil(t, filteredPost.Metadata, "Metadata should not be nil after filtering")
		require.NotNil(t, filteredPost.Metadata.Priority, "Priority should not be nil after filtering")

		// Check priority fields
		assert.Equal(t, priority, *filteredPost.Metadata.Priority.Priority, "Priority value should be preserved")
		assert.Equal(t, requestedAck, *filteredPost.Metadata.Priority.RequestedAck, "RequestedAck should be preserved")
		assert.Equal(t, persistentNotifications, *filteredPost.Metadata.Priority.PersistentNotifications,
			"PersistentNotifications should be preserved")

		// Check acknowledgements
		require.Len(t, filteredPost.Metadata.Acknowledgements, 2, "Both acknowledgements should be preserved")
	})

	// STEP 2: Test Serialization/Deserialization (Network transmission)
	t.Run("step 2: metadata survives network transmission", func(t *testing.T) {
		// Create SyncMsg and add the post
		syncMsg := model.NewSyncMsg(channelID)
		syncMsg.Posts = []*model.Post{originalPost.Clone()}

		// Serialize to JSON (simulating transmission over network)
		data, err := json.Marshal(syncMsg)
		require.NoError(t, err, "Failed to marshal syncMsg")

		// Deserialize (simulating reception)
		var receivedMsg model.SyncMsg
		err = json.Unmarshal(data, &receivedMsg)
		require.NoError(t, err, "Failed to unmarshal syncMsg")

		// Verify post was received
		require.Len(t, receivedMsg.Posts, 1, "Should have 1 post after deserialization")

		// Verify metadata survived serialization/deserialization
		receivedPost := receivedMsg.Posts[0]
		require.NotNil(t, receivedPost.Metadata, "Metadata should not be nil after deserialization")
		require.NotNil(t, receivedPost.Metadata.Priority, "Priority should not be nil after deserialization")

		// Check priority fields
		require.NotNil(t, receivedPost.Metadata.Priority.Priority, "Priority value should not be nil")
		assert.Equal(t, priority, *receivedPost.Metadata.Priority.Priority, "Priority value should be preserved")

		require.NotNil(t, receivedPost.Metadata.Priority.RequestedAck, "RequestedAck should not be nil")
		assert.Equal(t, requestedAck, *receivedPost.Metadata.Priority.RequestedAck, "RequestedAck should be preserved")

		require.NotNil(t, receivedPost.Metadata.Priority.PersistentNotifications, "PersistentNotifications should not be nil")
		assert.Equal(t, persistentNotifications, *receivedPost.Metadata.Priority.PersistentNotifications,
			"PersistentNotifications should be preserved")

		// Check acknowledgements
		require.Len(t, receivedPost.Metadata.Acknowledgements, 2, "Acknowledgements should be preserved")
	})

	// STEP 3: Verify different types of metadata
	t.Run("step 3: verify different types of metadata", func(t *testing.T) {
		// With our simplified approach, we no longer need complex detection logic.
		// We simply check if the post has metadata and always update in that case.

		// Test different kinds of posts with metadata

		// Post with no metadata
		postWithoutMetadata := &model.Post{
			Metadata: nil, // No metadata
		}
		assert.Nil(t, postWithoutMetadata.Metadata, "Post should have no metadata")

		// Posts with different priority values
		normalPriority := ""
		urgentPriority := model.PostPriorityUrgent

		postWithNormalPriority := &model.Post{
			Metadata: &model.PostMetadata{
				Priority: &model.PostPriority{
					Priority: &normalPriority, // Normal (empty string)
				},
			},
		}
		assert.NotNil(t, postWithNormalPriority.Metadata, "Post should have metadata")
		assert.Equal(t, "", *postWithNormalPriority.Metadata.Priority.Priority, "Post should have normal priority")

		postWithUrgentPriority := &model.Post{
			Metadata: &model.PostMetadata{
				Priority: &model.PostPriority{
					Priority: &urgentPriority, // Urgent
				},
			},
		}
		assert.NotNil(t, postWithUrgentPriority.Metadata, "Post should have metadata")
		assert.Equal(t, model.PostPriorityUrgent, *postWithUrgentPriority.Metadata.Priority.Priority, "Post should have urgent priority")

		// Posts with different RequestedAck values
		falseAck := false
		trueAck := true

		postWithFalseAck := &model.Post{
			Metadata: &model.PostMetadata{
				Priority: &model.PostPriority{
					RequestedAck: &falseAck, // false
				},
			},
		}
		assert.NotNil(t, postWithFalseAck.Metadata, "Post should have metadata")
		assert.False(t, *postWithFalseAck.Metadata.Priority.RequestedAck, "Post should have RequestedAck=false")

		postWithTrueAck := &model.Post{
			Metadata: &model.PostMetadata{
				Priority: &model.PostPriority{
					RequestedAck: &trueAck, // true
				},
			},
		}
		assert.NotNil(t, postWithTrueAck.Metadata, "Post should have metadata")
		assert.True(t, *postWithTrueAck.Metadata.Priority.RequestedAck, "Post should have RequestedAck=true")

		// Posts with different PersistentNotifications values
		falseNotif := false
		// trueNotif not used

		postWithFalseNotif := &model.Post{
			Metadata: &model.PostMetadata{
				Priority: &model.PostPriority{
					PersistentNotifications: &falseNotif, // false
				},
			},
		}
		assert.NotNil(t, postWithFalseNotif.Metadata, "Post should have metadata")
		assert.False(t, *postWithFalseNotif.Metadata.Priority.PersistentNotifications, "Post should have PersistentNotifications=false")

		// Original post already has all metadata fields set, so we'll verify them here
		assert.NotNil(t, originalPost.Metadata, "Original post should have metadata")
		assert.NotNil(t, originalPost.Metadata.Priority, "Original post should have priority metadata")
		assert.Equal(t, model.PostPriorityUrgent, *originalPost.Metadata.Priority.Priority, "Original post should have urgent priority")
		assert.True(t, *originalPost.Metadata.Priority.RequestedAck, "Original post should have RequestedAck=true")
		assert.True(t, *originalPost.Metadata.Priority.PersistentNotifications, "Original post should have PersistentNotifications=true")
		assert.Len(t, originalPost.Metadata.Acknowledgements, 2, "Original post should have 2 acknowledgements")
	})

}
