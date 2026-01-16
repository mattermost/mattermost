// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package server

import (
	"context"

	"github.com/mattermost/mattermost/server/public/model"
	pb "github.com/mattermost/mattermost/server/public/pluginapi/grpc/generated/go/pluginapiv1"
)

// =============================================================================
// Post API Handlers
// =============================================================================

// CreatePost creates a new post.
func (s *APIServer) CreatePost(ctx context.Context, req *pb.CreatePostRequest) (*pb.CreatePostResponse, error) {
	post := postFromProto(req.Post)
	result, appErr := s.impl.CreatePost(post)
	return &pb.CreatePostResponse{
		Error: appErrorToProto(appErr),
		Post:  postToProto(result),
	}, nil
}

// AddReaction adds a reaction to a post.
func (s *APIServer) AddReaction(ctx context.Context, req *pb.AddReactionRequest) (*pb.AddReactionResponse, error) {
	reaction := reactionFromProto(req.Reaction)
	result, appErr := s.impl.AddReaction(reaction)
	return &pb.AddReactionResponse{
		Error:    appErrorToProto(appErr),
		Reaction: reactionToProto(result),
	}, nil
}

// RemoveReaction removes a reaction from a post.
func (s *APIServer) RemoveReaction(ctx context.Context, req *pb.RemoveReactionRequest) (*pb.RemoveReactionResponse, error) {
	reaction := reactionFromProto(req.Reaction)
	appErr := s.impl.RemoveReaction(reaction)
	return &pb.RemoveReactionResponse{
		Error: appErrorToProto(appErr),
	}, nil
}

// GetReactions gets all reactions for a post.
func (s *APIServer) GetReactions(ctx context.Context, req *pb.GetReactionsRequest) (*pb.GetReactionsResponse, error) {
	reactions, appErr := s.impl.GetReactions(req.PostId)
	var pbReactions []*pb.Reaction
	if reactions != nil {
		pbReactions = make([]*pb.Reaction, len(reactions))
		for i, r := range reactions {
			pbReactions[i] = reactionToProto(r)
		}
	}
	return &pb.GetReactionsResponse{
		Error:     appErrorToProto(appErr),
		Reactions: pbReactions,
	}, nil
}

// SendEphemeralPost creates an ephemeral post visible only to the specified user.
func (s *APIServer) SendEphemeralPost(ctx context.Context, req *pb.SendEphemeralPostRequest) (*pb.SendEphemeralPostResponse, error) {
	post := postFromProto(req.Post)
	result := s.impl.SendEphemeralPost(req.UserId, post)
	return &pb.SendEphemeralPostResponse{
		Post: postToProto(result),
	}, nil
}

// UpdateEphemeralPost updates an ephemeral post.
func (s *APIServer) UpdateEphemeralPost(ctx context.Context, req *pb.UpdateEphemeralPostRequest) (*pb.UpdateEphemeralPostResponse, error) {
	post := postFromProto(req.Post)
	result := s.impl.UpdateEphemeralPost(req.UserId, post)
	return &pb.UpdateEphemeralPostResponse{
		Post: postToProto(result),
	}, nil
}

// DeleteEphemeralPost deletes an ephemeral post.
func (s *APIServer) DeleteEphemeralPost(ctx context.Context, req *pb.DeleteEphemeralPostRequest) (*pb.DeleteEphemeralPostResponse, error) {
	s.impl.DeleteEphemeralPost(req.UserId, req.PostId)
	return &pb.DeleteEphemeralPostResponse{}, nil
}

// DeletePost deletes a post.
func (s *APIServer) DeletePost(ctx context.Context, req *pb.DeletePostRequest) (*pb.DeletePostResponse, error) {
	appErr := s.impl.DeletePost(req.PostId)
	return &pb.DeletePostResponse{
		Error: appErrorToProto(appErr),
	}, nil
}

// GetPostThread gets a post and all posts in the same thread.
func (s *APIServer) GetPostThread(ctx context.Context, req *pb.GetPostThreadRequest) (*pb.GetPostThreadResponse, error) {
	postList, appErr := s.impl.GetPostThread(req.PostId)
	return &pb.GetPostThreadResponse{
		Error:    appErrorToProto(appErr),
		PostList: postListToProto(postList),
	}, nil
}

// GetPost gets a post by ID.
func (s *APIServer) GetPost(ctx context.Context, req *pb.GetPostRequest) (*pb.GetPostResponse, error) {
	post, appErr := s.impl.GetPost(req.PostId)
	return &pb.GetPostResponse{
		Error: appErrorToProto(appErr),
		Post:  postToProto(post),
	}, nil
}

// GetPostsSince gets posts created after a specified time.
func (s *APIServer) GetPostsSince(ctx context.Context, req *pb.GetPostsSinceRequest) (*pb.GetPostsSinceResponse, error) {
	postList, appErr := s.impl.GetPostsSince(req.ChannelId, req.Time)
	return &pb.GetPostsSinceResponse{
		Error:    appErrorToProto(appErr),
		PostList: postListToProto(postList),
	}, nil
}

// GetPostsAfter gets a page of posts after a specified post.
func (s *APIServer) GetPostsAfter(ctx context.Context, req *pb.GetPostsAfterRequest) (*pb.GetPostsAfterResponse, error) {
	postList, appErr := s.impl.GetPostsAfter(req.ChannelId, req.PostId, int(req.Page), int(req.PerPage))
	return &pb.GetPostsAfterResponse{
		Error:    appErrorToProto(appErr),
		PostList: postListToProto(postList),
	}, nil
}

// GetPostsBefore gets a page of posts before a specified post.
func (s *APIServer) GetPostsBefore(ctx context.Context, req *pb.GetPostsBeforeRequest) (*pb.GetPostsBeforeResponse, error) {
	postList, appErr := s.impl.GetPostsBefore(req.ChannelId, req.PostId, int(req.Page), int(req.PerPage))
	return &pb.GetPostsBeforeResponse{
		Error:    appErrorToProto(appErr),
		PostList: postListToProto(postList),
	}, nil
}

// GetPostsForChannel gets posts for a channel with pagination.
func (s *APIServer) GetPostsForChannel(ctx context.Context, req *pb.GetPostsForChannelRequest) (*pb.GetPostsForChannelResponse, error) {
	postList, appErr := s.impl.GetPostsForChannel(req.ChannelId, int(req.Page), int(req.PerPage))
	return &pb.GetPostsForChannelResponse{
		Error:    appErrorToProto(appErr),
		PostList: postListToProto(postList),
	}, nil
}

// UpdatePost updates a post.
func (s *APIServer) UpdatePost(ctx context.Context, req *pb.UpdatePostRequest) (*pb.UpdatePostResponse, error) {
	post := postFromProto(req.Post)
	result, appErr := s.impl.UpdatePost(post)
	return &pb.UpdatePostResponse{
		Error: appErrorToProto(appErr),
		Post:  postToProto(result),
	}, nil
}

// SearchPostsInTeam searches for posts in a team.
func (s *APIServer) SearchPostsInTeam(ctx context.Context, req *pb.SearchPostsInTeamRequest) (*pb.SearchPostsInTeamResponse, error) {
	// Convert proto SearchParams to model.SearchParams
	var paramsList []*model.SearchParams
	if req.ParamsList != nil {
		paramsList = make([]*model.SearchParams, len(req.ParamsList))
		for i, p := range req.ParamsList {
			paramsList[i] = searchParamsFromProto(p)
		}
	}

	posts, appErr := s.impl.SearchPostsInTeam(req.TeamId, paramsList)
	var pbPosts []*pb.Post
	if posts != nil {
		pbPosts = make([]*pb.Post, len(posts))
		for i, p := range posts {
			pbPosts[i] = postToProto(p)
		}
	}
	return &pb.SearchPostsInTeamResponse{
		Error: appErrorToProto(appErr),
		Posts: pbPosts,
	}, nil
}

// SearchPostsInTeamForUser searches for posts in a team for a specific user.
func (s *APIServer) SearchPostsInTeamForUser(ctx context.Context, req *pb.SearchPostsInTeamForUserRequest) (*pb.SearchPostsInTeamForUserResponse, error) {
	searchParams := searchParameterFromProto(req.SearchParams)
	results, appErr := s.impl.SearchPostsInTeamForUser(req.TeamId, req.UserId, searchParams)
	return &pb.SearchPostsInTeamForUserResponse{
		Error:   appErrorToProto(appErr),
		Results: postSearchResultsToProto(results),
	}, nil
}
