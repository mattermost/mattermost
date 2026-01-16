// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package server

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	pb "github.com/mattermost/mattermost/server/public/pluginapi/grpc/generated/go/pluginapiv1"
)

// =============================================================================
// Post API Tests
// =============================================================================

func TestCreatePost(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	expectedPost := &model.Post{
		Id:        "post_id_123",
		UserId:    "user_id_abc",
		ChannelId: "channel_id_xyz",
		Message:   "Hello, world!",
		CreateAt:  1234567890,
		UpdateAt:  1234567890,
	}

	h.mockAPI.On("CreatePost", mock.MatchedBy(func(post *model.Post) bool {
		return post.Message == "Hello, world!" && post.ChannelId == "channel_id_xyz"
	})).Return(expectedPost, nil)

	resp, err := h.client.CreatePost(context.Background(), &pb.CreatePostRequest{
		Post: &pb.Post{
			ChannelId: "channel_id_xyz",
			Message:   "Hello, world!",
		},
	})

	require.NoError(t, err)
	assert.Nil(t, resp.Error)
	assert.NotNil(t, resp.Post)
	assert.Equal(t, "post_id_123", resp.Post.Id)
	assert.Equal(t, "Hello, world!", resp.Post.Message)
	h.mockAPI.AssertExpectations(t)
}

func TestCreatePost_Error(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	h.mockAPI.On("CreatePost", mock.Anything).Return(nil, model.NewAppError("CreatePost", "app.post.create.error", nil, "database error", http.StatusInternalServerError))

	resp, err := h.client.CreatePost(context.Background(), &pb.CreatePostRequest{
		Post: &pb.Post{
			ChannelId: "channel_id_xyz",
			Message:   "Hello, world!",
		},
	})

	require.NoError(t, err)
	assert.NotNil(t, resp.Error)
	assert.Equal(t, "app.post.create.error", resp.Error.Id)
	assert.Equal(t, int32(http.StatusInternalServerError), resp.Error.StatusCode)
	h.mockAPI.AssertExpectations(t)
}

func TestGetPost(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	expectedPost := &model.Post{
		Id:        "post_id_123",
		UserId:    "user_id_abc",
		ChannelId: "channel_id_xyz",
		Message:   "Test message",
	}

	h.mockAPI.On("GetPost", "post_id_123").Return(expectedPost, nil)

	resp, err := h.client.GetPost(context.Background(), &pb.GetPostRequest{
		PostId: "post_id_123",
	})

	require.NoError(t, err)
	assert.Nil(t, resp.Error)
	assert.NotNil(t, resp.Post)
	assert.Equal(t, "post_id_123", resp.Post.Id)
	assert.Equal(t, "Test message", resp.Post.Message)
	h.mockAPI.AssertExpectations(t)
}

func TestGetPost_NotFound(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	h.mockAPI.On("GetPost", "nonexistent").Return(nil, model.NewAppError("GetPost", "app.post.get.not_found", nil, "", http.StatusNotFound))

	resp, err := h.client.GetPost(context.Background(), &pb.GetPostRequest{
		PostId: "nonexistent",
	})

	require.NoError(t, err)
	assert.NotNil(t, resp.Error)
	assert.Equal(t, int32(http.StatusNotFound), resp.Error.StatusCode)
	h.mockAPI.AssertExpectations(t)
}

func TestDeletePost(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	h.mockAPI.On("DeletePost", "post_id_123").Return(nil)

	resp, err := h.client.DeletePost(context.Background(), &pb.DeletePostRequest{
		PostId: "post_id_123",
	})

	require.NoError(t, err)
	assert.Nil(t, resp.Error)
	h.mockAPI.AssertExpectations(t)
}

func TestDeletePost_Error(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	h.mockAPI.On("DeletePost", "post_id_123").Return(model.NewAppError("DeletePost", "app.post.delete.forbidden", nil, "", http.StatusForbidden))

	resp, err := h.client.DeletePost(context.Background(), &pb.DeletePostRequest{
		PostId: "post_id_123",
	})

	require.NoError(t, err)
	assert.NotNil(t, resp.Error)
	assert.Equal(t, int32(http.StatusForbidden), resp.Error.StatusCode)
	h.mockAPI.AssertExpectations(t)
}

func TestUpdatePost(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	expectedPost := &model.Post{
		Id:        "post_id_123",
		UserId:    "user_id_abc",
		ChannelId: "channel_id_xyz",
		Message:   "Updated message",
	}

	h.mockAPI.On("UpdatePost", mock.MatchedBy(func(post *model.Post) bool {
		return post.Id == "post_id_123" && post.Message == "Updated message"
	})).Return(expectedPost, nil)

	resp, err := h.client.UpdatePost(context.Background(), &pb.UpdatePostRequest{
		Post: &pb.Post{
			Id:        "post_id_123",
			ChannelId: "channel_id_xyz",
			Message:   "Updated message",
		},
	})

	require.NoError(t, err)
	assert.Nil(t, resp.Error)
	assert.NotNil(t, resp.Post)
	assert.Equal(t, "Updated message", resp.Post.Message)
	h.mockAPI.AssertExpectations(t)
}

func TestAddReaction(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	expectedReaction := &model.Reaction{
		UserId:    "user_id_abc",
		PostId:    "post_id_123",
		EmojiName: "thumbsup",
		CreateAt:  1234567890,
	}

	h.mockAPI.On("AddReaction", mock.MatchedBy(func(reaction *model.Reaction) bool {
		return reaction.UserId == "user_id_abc" && reaction.EmojiName == "thumbsup"
	})).Return(expectedReaction, nil)

	resp, err := h.client.AddReaction(context.Background(), &pb.AddReactionRequest{
		Reaction: &pb.Reaction{
			UserId:    "user_id_abc",
			PostId:    "post_id_123",
			EmojiName: "thumbsup",
		},
	})

	require.NoError(t, err)
	assert.Nil(t, resp.Error)
	assert.NotNil(t, resp.Reaction)
	assert.Equal(t, "thumbsup", resp.Reaction.EmojiName)
	h.mockAPI.AssertExpectations(t)
}

func TestRemoveReaction(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	h.mockAPI.On("RemoveReaction", mock.MatchedBy(func(reaction *model.Reaction) bool {
		return reaction.UserId == "user_id_abc" && reaction.EmojiName == "thumbsup"
	})).Return(nil)

	resp, err := h.client.RemoveReaction(context.Background(), &pb.RemoveReactionRequest{
		Reaction: &pb.Reaction{
			UserId:    "user_id_abc",
			PostId:    "post_id_123",
			EmojiName: "thumbsup",
		},
	})

	require.NoError(t, err)
	assert.Nil(t, resp.Error)
	h.mockAPI.AssertExpectations(t)
}

func TestGetReactions(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	expectedReactions := []*model.Reaction{
		{
			UserId:    "user_id_1",
			PostId:    "post_id_123",
			EmojiName: "thumbsup",
			CreateAt:  1234567890,
		},
		{
			UserId:    "user_id_2",
			PostId:    "post_id_123",
			EmojiName: "smile",
			CreateAt:  1234567891,
		},
	}

	h.mockAPI.On("GetReactions", "post_id_123").Return(expectedReactions, nil)

	resp, err := h.client.GetReactions(context.Background(), &pb.GetReactionsRequest{
		PostId: "post_id_123",
	})

	require.NoError(t, err)
	assert.Nil(t, resp.Error)
	assert.Len(t, resp.Reactions, 2)
	assert.Equal(t, "thumbsup", resp.Reactions[0].EmojiName)
	assert.Equal(t, "smile", resp.Reactions[1].EmojiName)
	h.mockAPI.AssertExpectations(t)
}

func TestSendEphemeralPost(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	expectedPost := &model.Post{
		Id:        "ephemeral_post_id",
		UserId:    "user_id_abc",
		ChannelId: "channel_id_xyz",
		Message:   "This is ephemeral",
	}

	h.mockAPI.On("SendEphemeralPost", "target_user_id", mock.MatchedBy(func(post *model.Post) bool {
		return post.Message == "This is ephemeral"
	})).Return(expectedPost)

	resp, err := h.client.SendEphemeralPost(context.Background(), &pb.SendEphemeralPostRequest{
		UserId: "target_user_id",
		Post: &pb.Post{
			ChannelId: "channel_id_xyz",
			Message:   "This is ephemeral",
		},
	})

	require.NoError(t, err)
	assert.NotNil(t, resp.Post)
	assert.Equal(t, "This is ephemeral", resp.Post.Message)
	h.mockAPI.AssertExpectations(t)
}

func TestDeleteEphemeralPost(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	h.mockAPI.On("DeleteEphemeralPost", "user_id_abc", "post_id_123").Return()

	resp, err := h.client.DeleteEphemeralPost(context.Background(), &pb.DeleteEphemeralPostRequest{
		UserId: "user_id_abc",
		PostId: "post_id_123",
	})

	require.NoError(t, err)
	assert.NotNil(t, resp)
	h.mockAPI.AssertExpectations(t)
}

func TestGetPostThread(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	expectedPostList := &model.PostList{
		Order: []string{"post_id_123", "post_id_456"},
		Posts: map[string]*model.Post{
			"post_id_123": {Id: "post_id_123", Message: "Root post"},
			"post_id_456": {Id: "post_id_456", Message: "Reply", RootId: "post_id_123"},
		},
	}

	h.mockAPI.On("GetPostThread", "post_id_123").Return(expectedPostList, nil)

	resp, err := h.client.GetPostThread(context.Background(), &pb.GetPostThreadRequest{
		PostId: "post_id_123",
	})

	require.NoError(t, err)
	assert.Nil(t, resp.Error)
	assert.NotNil(t, resp.PostList)
	assert.Len(t, resp.PostList.Order, 2)
	assert.Len(t, resp.PostList.Posts, 2)
	h.mockAPI.AssertExpectations(t)
}

func TestGetPostsSince(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	expectedPostList := &model.PostList{
		Order: []string{"post_id_123"},
		Posts: map[string]*model.Post{
			"post_id_123": {Id: "post_id_123", Message: "Recent post"},
		},
	}

	h.mockAPI.On("GetPostsSince", "channel_id_xyz", int64(1234567890)).Return(expectedPostList, nil)

	resp, err := h.client.GetPostsSince(context.Background(), &pb.GetPostsSinceRequest{
		ChannelId: "channel_id_xyz",
		Time:      1234567890,
	})

	require.NoError(t, err)
	assert.Nil(t, resp.Error)
	assert.NotNil(t, resp.PostList)
	assert.Len(t, resp.PostList.Order, 1)
	h.mockAPI.AssertExpectations(t)
}

func TestGetPostsForChannel(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	expectedPostList := &model.PostList{
		Order: []string{"post_id_123", "post_id_456"},
		Posts: map[string]*model.Post{
			"post_id_123": {Id: "post_id_123", Message: "Post 1"},
			"post_id_456": {Id: "post_id_456", Message: "Post 2"},
		},
	}

	h.mockAPI.On("GetPostsForChannel", "channel_id_xyz", 0, 60).Return(expectedPostList, nil)

	resp, err := h.client.GetPostsForChannel(context.Background(), &pb.GetPostsForChannelRequest{
		ChannelId: "channel_id_xyz",
		Page:      0,
		PerPage:   60,
	})

	require.NoError(t, err)
	assert.Nil(t, resp.Error)
	assert.NotNil(t, resp.PostList)
	assert.Len(t, resp.PostList.Order, 2)
	h.mockAPI.AssertExpectations(t)
}

// Test that verifies gRPC call succeeds but returns error in response
func TestCreatePost_GRPCErrorHandling(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	h.mockAPI.On("CreatePost", mock.Anything).Return(nil, model.NewAppError("CreatePost", "test.error", nil, "", http.StatusBadRequest))

	resp, err := h.client.CreatePost(context.Background(), &pb.CreatePostRequest{
		Post: &pb.Post{Message: "test"},
	})

	// The gRPC call should succeed
	require.NoError(t, err)
	// But the response should contain the error
	require.NotNil(t, resp.Error)
	assert.Equal(t, "test.error", resp.Error.Id)
}
