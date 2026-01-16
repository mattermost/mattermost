// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package server

import (
	"github.com/mattermost/mattermost/server/public/model"
	pb "github.com/mattermost/mattermost/server/public/pluginapi/grpc/generated/go/pluginapiv1"
	"google.golang.org/protobuf/types/known/structpb"
)

// =============================================================================
// Channel Conversions (pb <-> model)
// =============================================================================

// channelTypeToProto converts a model.ChannelType to pb.ChannelType.
func channelTypeToProto(ct model.ChannelType) pb.ChannelType {
	switch ct {
	case model.ChannelTypeOpen:
		return pb.ChannelType_CHANNEL_TYPE_OPEN
	case model.ChannelTypePrivate:
		return pb.ChannelType_CHANNEL_TYPE_PRIVATE
	case model.ChannelTypeDirect:
		return pb.ChannelType_CHANNEL_TYPE_DIRECT
	case model.ChannelTypeGroup:
		return pb.ChannelType_CHANNEL_TYPE_GROUP
	default:
		return pb.ChannelType_CHANNEL_TYPE_UNSPECIFIED
	}
}

// channelTypeFromProto converts a pb.ChannelType to model.ChannelType.
func channelTypeFromProto(ct pb.ChannelType) model.ChannelType {
	switch ct {
	case pb.ChannelType_CHANNEL_TYPE_OPEN:
		return model.ChannelTypeOpen
	case pb.ChannelType_CHANNEL_TYPE_PRIVATE:
		return model.ChannelTypePrivate
	case pb.ChannelType_CHANNEL_TYPE_DIRECT:
		return model.ChannelTypeDirect
	case pb.ChannelType_CHANNEL_TYPE_GROUP:
		return model.ChannelTypeGroup
	default:
		return ""
	}
}

// channelToProto converts a model.Channel to a pb.Channel.
// Returns nil if the input is nil.
func channelToProto(c *model.Channel) *pb.Channel {
	if c == nil {
		return nil
	}

	pbChannel := &pb.Channel{
		Id:                  c.Id,
		CreateAt:            c.CreateAt,
		UpdateAt:            c.UpdateAt,
		DeleteAt:            c.DeleteAt,
		TeamId:              c.TeamId,
		Type:                channelTypeToProto(c.Type),
		DisplayName:         c.DisplayName,
		Name:                c.Name,
		Header:              c.Header,
		Purpose:             c.Purpose,
		LastPostAt:          c.LastPostAt,
		TotalMsgCount:       c.TotalMsgCount,
		ExtraUpdateAt:       c.ExtraUpdateAt,
		CreatorId:           c.CreatorId,
		AutoTranslation:     c.AutoTranslation,
		TotalMsgCountRoot:   c.TotalMsgCountRoot,
		LastRootPostAt:      c.LastRootPostAt,
		PolicyEnforced:      c.PolicyEnforced,
		PolicyIsActive:      c.PolicyIsActive,
		DefaultCategoryName: c.DefaultCategoryName,
	}

	// Handle optional pointer fields
	if c.SchemeId != nil {
		pbChannel.SchemeId = c.SchemeId
	}
	if c.GroupConstrained != nil {
		pbChannel.GroupConstrained = c.GroupConstrained
	}
	if c.Shared != nil {
		pbChannel.Shared = c.Shared
	}
	if c.PolicyID != nil {
		pbChannel.PolicyId = c.PolicyID
	}

	// Convert props map[string]any to Struct
	if c.Props != nil {
		propsStruct, err := structpb.NewStruct(c.Props)
		if err == nil {
			pbChannel.Props = propsStruct
		}
	}

	// Convert banner info
	if c.BannerInfo != nil {
		pbChannel.BannerInfo = &pb.ChannelBannerInfo{
			Enabled:         c.BannerInfo.Enabled,
			Text:            c.BannerInfo.Text,
			BackgroundColor: c.BannerInfo.BackgroundColor,
		}
	}

	return pbChannel
}

// channelFromProto converts a pb.Channel to a model.Channel.
// Returns nil if the input is nil.
func channelFromProto(c *pb.Channel) *model.Channel {
	if c == nil {
		return nil
	}

	modelChannel := &model.Channel{
		Id:                  c.Id,
		CreateAt:            c.CreateAt,
		UpdateAt:            c.UpdateAt,
		DeleteAt:            c.DeleteAt,
		TeamId:              c.TeamId,
		Type:                channelTypeFromProto(c.Type),
		DisplayName:         c.DisplayName,
		Name:                c.Name,
		Header:              c.Header,
		Purpose:             c.Purpose,
		LastPostAt:          c.LastPostAt,
		TotalMsgCount:       c.TotalMsgCount,
		ExtraUpdateAt:       c.ExtraUpdateAt,
		CreatorId:           c.CreatorId,
		AutoTranslation:     c.AutoTranslation,
		TotalMsgCountRoot:   c.TotalMsgCountRoot,
		LastRootPostAt:      c.LastRootPostAt,
		PolicyEnforced:      c.PolicyEnforced,
		PolicyIsActive:      c.PolicyIsActive,
		DefaultCategoryName: c.DefaultCategoryName,
	}

	// Handle optional pointer fields
	if c.SchemeId != nil {
		modelChannel.SchemeId = c.SchemeId
	}
	if c.GroupConstrained != nil {
		modelChannel.GroupConstrained = c.GroupConstrained
	}
	if c.Shared != nil {
		modelChannel.Shared = c.Shared
	}
	if c.PolicyId != nil {
		modelChannel.PolicyID = c.PolicyId
	}

	// Convert Struct to props map[string]any
	if c.Props != nil {
		modelChannel.Props = c.Props.AsMap()
	}

	// Convert banner info
	if c.BannerInfo != nil {
		modelChannel.BannerInfo = &model.ChannelBannerInfo{
			Enabled:         c.BannerInfo.Enabled,
			Text:            c.BannerInfo.Text,
			BackgroundColor: c.BannerInfo.BackgroundColor,
		}
	}

	return modelChannel
}

// channelsToProto converts a slice of model.Channel to a slice of pb.Channel.
func channelsToProto(channels []*model.Channel) []*pb.Channel {
	if channels == nil {
		return nil
	}
	result := make([]*pb.Channel, len(channels))
	for i, c := range channels {
		result[i] = channelToProto(c)
	}
	return result
}

// =============================================================================
// ChannelMember Conversions
// =============================================================================

// channelMemberToProto converts a model.ChannelMember to a pb.ChannelMember.
func channelMemberToProto(cm *model.ChannelMember) *pb.ChannelMember {
	if cm == nil {
		return nil
	}
	return &pb.ChannelMember{
		ChannelId:          cm.ChannelId,
		UserId:             cm.UserId,
		Roles:              cm.Roles,
		LastViewedAt:       cm.LastViewedAt,
		MsgCount:           cm.MsgCount,
		MentionCount:       cm.MentionCount,
		MentionCountRoot:   cm.MentionCountRoot,
		MsgCountRoot:       cm.MsgCountRoot,
		NotifyProps:        cm.NotifyProps,
		LastUpdateAt:       cm.LastUpdateAt,
		SchemeGuest:        cm.SchemeGuest,
		SchemeUser:         cm.SchemeUser,
		SchemeAdmin:        cm.SchemeAdmin,
		UrgentMentionCount: cm.UrgentMentionCount,
	}
}

// channelMemberFromProto converts a pb.ChannelMember to a model.ChannelMember.
func channelMemberFromProto(cm *pb.ChannelMember) *model.ChannelMember {
	if cm == nil {
		return nil
	}
	return &model.ChannelMember{
		ChannelId:          cm.ChannelId,
		UserId:             cm.UserId,
		Roles:              cm.Roles,
		LastViewedAt:       cm.LastViewedAt,
		MsgCount:           cm.MsgCount,
		MentionCount:       cm.MentionCount,
		MentionCountRoot:   cm.MentionCountRoot,
		MsgCountRoot:       cm.MsgCountRoot,
		NotifyProps:        cm.NotifyProps,
		LastUpdateAt:       cm.LastUpdateAt,
		SchemeGuest:        cm.SchemeGuest,
		SchemeUser:         cm.SchemeUser,
		SchemeAdmin:        cm.SchemeAdmin,
		UrgentMentionCount: cm.UrgentMentionCount,
	}
}

// channelMembersToProto converts a slice of model.ChannelMember to a slice of pb.ChannelMember.
func channelMembersToProto(members model.ChannelMembers) []*pb.ChannelMember {
	if members == nil {
		return nil
	}
	result := make([]*pb.ChannelMember, len(members))
	for i := range members {
		result[i] = channelMemberToProto(&members[i])
	}
	return result
}

// channelMemberPtrsToProto converts a slice of *model.ChannelMember to a slice of pb.ChannelMember.
func channelMemberPtrsToProto(members []*model.ChannelMember) []*pb.ChannelMember {
	if members == nil {
		return nil
	}
	result := make([]*pb.ChannelMember, len(members))
	for i, cm := range members {
		result[i] = channelMemberToProto(cm)
	}
	return result
}

// =============================================================================
// ChannelStats Conversions
// =============================================================================

// channelStatsToProto converts a model.ChannelStats to a pb.ChannelStats.
func channelStatsToProto(cs *model.ChannelStats) *pb.ChannelStats {
	if cs == nil {
		return nil
	}
	return &pb.ChannelStats{
		ChannelId:       cs.ChannelId,
		MemberCount:     cs.MemberCount,
		GuestCount:      cs.GuestCount,
		PinnedpostCount: cs.PinnedPostCount,
		FilesCount:      cs.FilesCount,
	}
}

// =============================================================================
// ChannelMemberIdentifier Conversions
// =============================================================================

// channelMemberIdentifiersFromProto converts a slice of pb.ChannelMemberIdentifier to a slice of model.ChannelMemberIdentifier.
func channelMemberIdentifiersFromProto(identifiers []*pb.ChannelMemberIdentifier) []*model.ChannelMemberIdentifier {
	if identifiers == nil {
		return nil
	}
	result := make([]*model.ChannelMemberIdentifier, len(identifiers))
	for i, id := range identifiers {
		result[i] = &model.ChannelMemberIdentifier{
			ChannelId: id.ChannelId,
			UserId:    id.UserId,
		}
	}
	return result
}

// =============================================================================
// SidebarCategory Conversions
// =============================================================================

// sidebarCategorySortingToProto converts a model.SidebarCategorySorting to int32.
// Note: The proto uses int32 but model uses string. We use an index mapping.
func sidebarCategorySortingToProto(sorting model.SidebarCategorySorting) int32 {
	switch sorting {
	case model.SidebarCategorySortDefault:
		return 0
	case model.SidebarCategorySortManual:
		return 1
	case model.SidebarCategorySortRecent:
		return 2
	case model.SidebarCategorySortAlphabetical:
		return 3
	default:
		return 0
	}
}

// sidebarCategorySortingFromProto converts an int32 to model.SidebarCategorySorting.
func sidebarCategorySortingFromProto(sorting int32) model.SidebarCategorySorting {
	switch sorting {
	case 0:
		return model.SidebarCategorySortDefault
	case 1:
		return model.SidebarCategorySortManual
	case 2:
		return model.SidebarCategorySortRecent
	case 3:
		return model.SidebarCategorySortAlphabetical
	default:
		return model.SidebarCategorySortDefault
	}
}

// sidebarCategoryWithChannelsToProto converts a model.SidebarCategoryWithChannels to pb.SidebarCategoryWithChannels.
func sidebarCategoryWithChannelsToProto(cat *model.SidebarCategoryWithChannels) *pb.SidebarCategoryWithChannels {
	if cat == nil {
		return nil
	}
	return &pb.SidebarCategoryWithChannels{
		Id:          cat.Id,
		UserId:      cat.UserId,
		TeamId:      cat.TeamId,
		DisplayName: cat.DisplayName,
		Type:        string(cat.Type),
		Sorting:     sidebarCategorySortingToProto(cat.Sorting),
		Muted:       cat.Muted,
		Collapsed:   cat.Collapsed,
		ChannelIds:  cat.Channels,
	}
}

// sidebarCategoryWithChannelsFromProto converts a pb.SidebarCategoryWithChannels to model.SidebarCategoryWithChannels.
func sidebarCategoryWithChannelsFromProto(cat *pb.SidebarCategoryWithChannels) *model.SidebarCategoryWithChannels {
	if cat == nil {
		return nil
	}
	return &model.SidebarCategoryWithChannels{
		SidebarCategory: model.SidebarCategory{
			Id:          cat.Id,
			UserId:      cat.UserId,
			TeamId:      cat.TeamId,
			DisplayName: cat.DisplayName,
			Type:        model.SidebarCategoryType(cat.Type),
			Sorting:     sidebarCategorySortingFromProto(cat.Sorting),
			Muted:       cat.Muted,
			Collapsed:   cat.Collapsed,
		},
		Channels: cat.ChannelIds,
	}
}

// sidebarCategoriesWithChannelsToProto converts a slice of model.SidebarCategoryWithChannels to a slice of pb.SidebarCategoryWithChannels.
func sidebarCategoriesWithChannelsToProto(cats []*model.SidebarCategoryWithChannels) []*pb.SidebarCategoryWithChannels {
	if cats == nil {
		return nil
	}
	result := make([]*pb.SidebarCategoryWithChannels, len(cats))
	for i, cat := range cats {
		result[i] = sidebarCategoryWithChannelsToProto(cat)
	}
	return result
}

// sidebarCategoriesWithChannelsFromProto converts a slice of pb.SidebarCategoryWithChannels to a slice of model.SidebarCategoryWithChannels.
func sidebarCategoriesWithChannelsFromProto(cats []*pb.SidebarCategoryWithChannels) []*model.SidebarCategoryWithChannels {
	if cats == nil {
		return nil
	}
	result := make([]*model.SidebarCategoryWithChannels, len(cats))
	for i, cat := range cats {
		result[i] = sidebarCategoryWithChannelsFromProto(cat)
	}
	return result
}

// orderedSidebarCategoriesToProto converts a model.OrderedSidebarCategories to pb.OrderedSidebarCategories.
func orderedSidebarCategoriesToProto(osc *model.OrderedSidebarCategories) *pb.OrderedSidebarCategories {
	if osc == nil {
		return nil
	}
	return &pb.OrderedSidebarCategories{
		Categories: sidebarCategoriesWithChannelsToProto(osc.Categories),
		Order:      osc.Order,
	}
}
