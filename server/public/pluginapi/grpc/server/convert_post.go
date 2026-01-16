// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package server

import (
	"google.golang.org/protobuf/types/known/structpb"

	"github.com/mattermost/mattermost/server/public/model"
	pb "github.com/mattermost/mattermost/server/public/pluginapi/grpc/generated/go/pluginapiv1"
)

// =============================================================================
// Post Conversions
// =============================================================================

// postToProto converts a model.Post to a protobuf Post.
func postToProto(post *model.Post) *pb.Post {
	if post == nil {
		return nil
	}

	pbPost := &pb.Post{
		Id:            post.Id,
		CreateAt:      post.CreateAt,
		UpdateAt:      post.UpdateAt,
		EditAt:        post.EditAt,
		DeleteAt:      post.DeleteAt,
		IsPinned:      post.IsPinned,
		UserId:        post.UserId,
		ChannelId:     post.ChannelId,
		RootId:        post.RootId,
		OriginalId:    post.OriginalId,
		Message:       post.Message,
		MessageSource: post.MessageSource,
		Type:          post.Type,
		Hashtags:      post.Hashtags,
		FileIds:       post.FileIds,
		PendingPostId: post.PendingPostId,
		HasReactions:  post.HasReactions,
		ReplyCount:    post.ReplyCount,
		LastReplyAt:   post.LastReplyAt,
	}

	// Handle optional remote_id
	if post.RemoteId != nil {
		pbPost.RemoteId = post.RemoteId
	}

	// Handle optional is_following
	if post.IsFollowing != nil {
		pbPost.IsFollowing = post.IsFollowing
	}

	// Convert Props (map[string]any -> Struct)
	if props := post.GetProps(); props != nil {
		if s, err := structpb.NewStruct(props); err == nil {
			pbPost.Props = s
		}
	}

	// Convert participants
	if len(post.Participants) > 0 {
		pbPost.Participants = make([]*pb.User, 0, len(post.Participants))
		for _, u := range post.Participants {
			pbPost.Participants = append(pbPost.Participants, userToProto(u))
		}
	}

	// Convert metadata
	if post.Metadata != nil {
		pbPost.Metadata = postMetadataToProto(post.Metadata)
	}

	return pbPost
}

// postFromProto converts a protobuf Post to a model.Post.
func postFromProto(pbPost *pb.Post) *model.Post {
	if pbPost == nil {
		return nil
	}

	post := &model.Post{
		Id:            pbPost.Id,
		CreateAt:      pbPost.CreateAt,
		UpdateAt:      pbPost.UpdateAt,
		EditAt:        pbPost.EditAt,
		DeleteAt:      pbPost.DeleteAt,
		IsPinned:      pbPost.IsPinned,
		UserId:        pbPost.UserId,
		ChannelId:     pbPost.ChannelId,
		RootId:        pbPost.RootId,
		OriginalId:    pbPost.OriginalId,
		Message:       pbPost.Message,
		MessageSource: pbPost.MessageSource,
		Type:          pbPost.Type,
		Hashtags:      pbPost.Hashtags,
		FileIds:       pbPost.FileIds,
		PendingPostId: pbPost.PendingPostId,
		HasReactions:  pbPost.HasReactions,
		ReplyCount:    pbPost.ReplyCount,
		LastReplyAt:   pbPost.LastReplyAt,
		RemoteId:      pbPost.RemoteId,
		IsFollowing:   pbPost.IsFollowing,
	}

	// Convert Props (Struct -> map[string]any)
	if pbPost.Props != nil {
		post.SetProps(pbPost.Props.AsMap())
	}

	// Note: Participants and Metadata are typically read-only/transient,
	// but we convert them for completeness
	if len(pbPost.Participants) > 0 {
		post.Participants = make([]*model.User, 0, len(pbPost.Participants))
		for _, u := range pbPost.Participants {
			post.Participants = append(post.Participants, userFromProto(u))
		}
	}

	if pbPost.Metadata != nil {
		post.Metadata = postMetadataFromProto(pbPost.Metadata)
	}

	return post
}

// postMetadataToProto converts model.PostMetadata to protobuf PostMetadata.
func postMetadataToProto(meta *model.PostMetadata) *pb.PostMetadata {
	if meta == nil {
		return nil
	}

	pbMeta := &pb.PostMetadata{}

	// Convert embeds
	if len(meta.Embeds) > 0 {
		pbMeta.Embeds = make([]*pb.PostEmbed, 0, len(meta.Embeds))
		for _, embed := range meta.Embeds {
			if embed != nil {
				pbMeta.Embeds = append(pbMeta.Embeds, postEmbedToProto(embed))
			}
		}
	}

	// Convert reactions
	if len(meta.Reactions) > 0 {
		pbMeta.Reactions = make([]*pb.Reaction, 0, len(meta.Reactions))
		for _, r := range meta.Reactions {
			pbMeta.Reactions = append(pbMeta.Reactions, reactionToProto(r))
		}
	}

	// Convert files
	if len(meta.Files) > 0 {
		pbMeta.Files = make([]*pb.FileInfo, 0, len(meta.Files))
		for _, f := range meta.Files {
			pbMeta.Files = append(pbMeta.Files, fileInfoToProto(f))
		}
	}

	// Convert images
	if len(meta.Images) > 0 {
		pbMeta.Images = make(map[string]*pb.PostImage)
		for url, img := range meta.Images {
			if img != nil {
				pbMeta.Images[url] = &pb.PostImage{
					Width:      int32(img.Width),
					Height:     int32(img.Height),
					Format:     img.Format,
					FrameCount: int64(img.FrameCount),
				}
			}
		}
	}

	// Convert priority
	if meta.Priority != nil {
		pbMeta.Priority = &pb.PostPriority{
			Priority:                meta.Priority.Priority,
			RequestedAck:            meta.Priority.RequestedAck,
			PersistentNotifications: meta.Priority.PersistentNotifications,
		}
	}

	// Convert acknowledgements
	if len(meta.Acknowledgements) > 0 {
		pbMeta.Acknowledgements = make([]*pb.PostAcknowledgement, 0, len(meta.Acknowledgements))
		for _, ack := range meta.Acknowledgements {
			if ack != nil {
				pbMeta.Acknowledgements = append(pbMeta.Acknowledgements, &pb.PostAcknowledgement{
					UserId:         ack.UserId,
					PostId:         ack.PostId,
					AcknowledgedAt: ack.AcknowledgedAt,
				})
			}
		}
	}

	return pbMeta
}

// postMetadataFromProto converts protobuf PostMetadata to model.PostMetadata.
func postMetadataFromProto(pbMeta *pb.PostMetadata) *model.PostMetadata {
	if pbMeta == nil {
		return nil
	}

	meta := &model.PostMetadata{}

	// Convert embeds
	if len(pbMeta.Embeds) > 0 {
		meta.Embeds = make([]*model.PostEmbed, 0, len(pbMeta.Embeds))
		for _, embed := range pbMeta.Embeds {
			if embed != nil {
				meta.Embeds = append(meta.Embeds, postEmbedFromProto(embed))
			}
		}
	}

	// Convert reactions
	if len(pbMeta.Reactions) > 0 {
		meta.Reactions = make([]*model.Reaction, 0, len(pbMeta.Reactions))
		for _, r := range pbMeta.Reactions {
			meta.Reactions = append(meta.Reactions, reactionFromProto(r))
		}
	}

	// Convert files
	if len(pbMeta.Files) > 0 {
		meta.Files = make([]*model.FileInfo, 0, len(pbMeta.Files))
		for _, f := range pbMeta.Files {
			meta.Files = append(meta.Files, fileInfoFromProto(f))
		}
	}

	// Convert images
	if len(pbMeta.Images) > 0 {
		meta.Images = make(map[string]*model.PostImage)
		for url, img := range pbMeta.Images {
			if img != nil {
				meta.Images[url] = &model.PostImage{
					Width:      int(img.Width),
					Height:     int(img.Height),
					Format:     img.Format,
					FrameCount: int(img.FrameCount),
				}
			}
		}
	}

	// Convert priority
	if pbMeta.Priority != nil {
		meta.Priority = &model.PostPriority{
			Priority:                pbMeta.Priority.Priority,
			RequestedAck:            pbMeta.Priority.RequestedAck,
			PersistentNotifications: pbMeta.Priority.PersistentNotifications,
		}
	}

	// Convert acknowledgements
	if len(pbMeta.Acknowledgements) > 0 {
		meta.Acknowledgements = make([]*model.PostAcknowledgement, 0, len(pbMeta.Acknowledgements))
		for _, ack := range pbMeta.Acknowledgements {
			if ack != nil {
				meta.Acknowledgements = append(meta.Acknowledgements, &model.PostAcknowledgement{
					UserId:         ack.UserId,
					PostId:         ack.PostId,
					AcknowledgedAt: ack.AcknowledgedAt,
				})
			}
		}
	}

	return meta
}

// postEmbedToProto converts model.PostEmbed to protobuf PostEmbed.
func postEmbedToProto(embed *model.PostEmbed) *pb.PostEmbed {
	if embed == nil {
		return nil
	}

	pbEmbed := &pb.PostEmbed{
		Type: string(embed.Type),
		Url:  embed.URL,
	}

	// Convert Data (any -> Struct)
	if embed.Data != nil {
		if dataMap, ok := embed.Data.(map[string]any); ok {
			if s, err := structpb.NewStruct(dataMap); err == nil {
				pbEmbed.Data = s
			}
		}
	}

	return pbEmbed
}

// postEmbedFromProto converts protobuf PostEmbed to model.PostEmbed.
func postEmbedFromProto(pbEmbed *pb.PostEmbed) *model.PostEmbed {
	if pbEmbed == nil {
		return nil
	}

	embed := &model.PostEmbed{
		Type: model.PostEmbedType(pbEmbed.Type),
		URL:  pbEmbed.Url,
	}

	if pbEmbed.Data != nil {
		embed.Data = pbEmbed.Data.AsMap()
	}

	return embed
}

// =============================================================================
// Reaction Conversions
// =============================================================================

// reactionToProto converts a model.Reaction to a protobuf Reaction.
func reactionToProto(reaction *model.Reaction) *pb.Reaction {
	if reaction == nil {
		return nil
	}

	pbReaction := &pb.Reaction{
		UserId:    reaction.UserId,
		PostId:    reaction.PostId,
		EmojiName: reaction.EmojiName,
		CreateAt:  reaction.CreateAt,
		UpdateAt:  reaction.UpdateAt,
		DeleteAt:  reaction.DeleteAt,
		RemoteId:  reaction.RemoteId,
	}

	if reaction.ChannelId != "" {
		pbReaction.ChannelId = &reaction.ChannelId
	}

	return pbReaction
}

// reactionFromProto converts a protobuf Reaction to a model.Reaction.
func reactionFromProto(pbReaction *pb.Reaction) *model.Reaction {
	if pbReaction == nil {
		return nil
	}

	reaction := &model.Reaction{
		UserId:    pbReaction.UserId,
		PostId:    pbReaction.PostId,
		EmojiName: pbReaction.EmojiName,
		CreateAt:  pbReaction.CreateAt,
		UpdateAt:  pbReaction.UpdateAt,
		DeleteAt:  pbReaction.DeleteAt,
		RemoteId:  pbReaction.RemoteId,
	}

	if pbReaction.ChannelId != nil {
		reaction.ChannelId = *pbReaction.ChannelId
	}

	return reaction
}

// =============================================================================
// PostList Conversions
// =============================================================================

// postListToProto converts a model.PostList to a protobuf PostList.
func postListToProto(list *model.PostList) *pb.PostList {
	if list == nil {
		return nil
	}

	pbList := &pb.PostList{
		Order:      list.Order,
		NextPostId: list.NextPostId,
		PrevPostId: list.PrevPostId,
	}

	// Convert HasNext
	if list.HasNext != nil {
		pbList.HasNext = *list.HasNext
	}

	// FirstInaccessiblePostTime maps to first_inaccessible_post_time in proto
	// Note: proto field is bool, but model uses int64. We use non-zero as true.
	pbList.FirstInaccessiblePostTime = list.FirstInaccessiblePostTime != 0

	// Convert posts map
	if len(list.Posts) > 0 {
		pbList.Posts = make(map[string]*pb.Post)
		for id, post := range list.Posts {
			pbList.Posts[id] = postToProto(post)
		}
	}

	return pbList
}

// =============================================================================
// SearchParams Conversions
// =============================================================================

// searchParamsFromProto converts a protobuf SearchParams to model.SearchParams.
func searchParamsFromProto(pbParams *pb.SearchParams) *model.SearchParams {
	if pbParams == nil {
		return nil
	}

	return &model.SearchParams{
		Terms:                  pbParams.Terms,
		OrTerms:                pbParams.IsOrSearch,
		TimeZoneOffset:         int(pbParams.TimeZoneOffset),
		IncludeDeletedChannels: pbParams.IncludeDeletedChannels,
		InChannels:             pbParams.InChannels,
		ExcludedChannels:       pbParams.ExcludedChannels,
		FromUsers:              pbParams.FromUsers,
		ExcludedUsers:          pbParams.ExcludedUsers,
		Extensions:             pbParams.Extensions,
	}
}

// searchParameterFromProto converts a protobuf SearchParameter to model.SearchParameter.
func searchParameterFromProto(pbParams *pb.SearchParameter) model.SearchParameter {
	if pbParams == nil {
		return model.SearchParameter{}
	}

	sp := model.SearchParameter{}
	if pbParams.Terms != "" {
		sp.Terms = &pbParams.Terms
	}
	if pbParams.IsOrSearch {
		sp.IsOrSearch = &pbParams.IsOrSearch
	}
	if pbParams.TimeZoneOffset != 0 {
		offset := int(pbParams.TimeZoneOffset)
		sp.TimeZoneOffset = &offset
	}
	if pbParams.Page != 0 {
		page := int(pbParams.Page)
		sp.Page = &page
	}
	if pbParams.PerPage != 0 {
		perPage := int(pbParams.PerPage)
		sp.PerPage = &perPage
	}
	if pbParams.IncludeDeletedChannels {
		sp.IncludeDeletedChannels = &pbParams.IncludeDeletedChannels
	}

	return sp
}

// postSearchResultsToProto converts model.PostSearchResults to protobuf PostSearchResults.
func postSearchResultsToProto(results *model.PostSearchResults) *pb.PostSearchResults {
	if results == nil {
		return nil
	}

	pbResults := &pb.PostSearchResults{
		Order: results.Order,
	}

	// Convert posts map
	if len(results.Posts) > 0 {
		pbResults.Posts = make(map[string]*pb.Post)
		for id, post := range results.Posts {
			pbResults.Posts[id] = postToProto(post)
		}
	}

	// Convert matches map
	if len(results.Matches) > 0 {
		pbResults.Matches = make(map[string]*pb.StringList)
		for id, matches := range results.Matches {
			pbResults.Matches[id] = &pb.StringList{Values: matches}
		}
	}

	return pbResults
}
