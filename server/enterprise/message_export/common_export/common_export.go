// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package common_export

import (
	"fmt"

	"github.com/mattermost/mattermost/server/public/model"
)

const MissingFileMessage = "File missing for post; cannot copy file to archive"

type ChannelMemberJoin struct {
	UserId   string
	IsBot    bool
	Email    string
	Username string
	Datetime int64
}

type ChannelMemberLeave struct {
	UserId   string
	IsBot    bool
	Email    string
	Username string
	Datetime int64
}

type ChannelMember struct {
	UserId   string
	IsBot    bool
	Email    string
	Username string
}
type ChannelMembers map[string]ChannelMember
type MembersByChannel map[string]ChannelMembers

type MetadataChannel struct {
	TeamId             *string
	TeamName           *string
	TeamDisplayName    *string
	ChannelId          string
	ChannelName        string
	ChannelDisplayName string
	ChannelType        model.ChannelType
	RoomId             string
	StartTime          int64
	EndTime            int64
	MessagesCount      int
	AttachmentsCount   int
}

type Metadata struct {
	Channels         map[string]MetadataChannel
	MessagesCount    int
	AttachmentsCount int
	StartTime        int64
	EndTime          int64
}

func (metadata *Metadata) Update(post *model.MessageExport, attachments int) {
	channelMetadata, ok := metadata.Channels[*post.ChannelId]
	if !ok {
		channelMetadata = MetadataChannel{
			TeamId:             post.TeamId,
			TeamName:           post.TeamName,
			TeamDisplayName:    post.TeamDisplayName,
			ChannelId:          *post.ChannelId,
			ChannelName:        *post.ChannelName,
			ChannelDisplayName: *post.ChannelDisplayName,
			ChannelType:        *post.ChannelType,
			RoomId:             fmt.Sprintf("%v - %v", ChannelTypeDisplayName(*post.ChannelType), *post.ChannelId),
			StartTime:          *post.PostCreateAt,
			MessagesCount:      0,
			AttachmentsCount:   0,
		}
	}

	channelMetadata.EndTime = *post.PostCreateAt
	channelMetadata.AttachmentsCount += attachments
	metadata.AttachmentsCount += attachments
	channelMetadata.MessagesCount += 1
	metadata.MessagesCount += 1
	if metadata.StartTime == 0 {
		metadata.StartTime = *post.PostCreateAt
	}
	metadata.EndTime = *post.PostCreateAt
	metadata.Channels[*post.ChannelId] = channelMetadata
}

func GetJoinsAndLeavesForChannel(startTime int64, endTime int64, channelMembersHistory []*model.ChannelMemberHistoryResult, channelMembers ChannelMembers) ([]ChannelMemberJoin, []ChannelMemberLeave) {
	joins := []ChannelMemberJoin{}
	leaves := []ChannelMemberLeave{}

	alreadyJoined := map[string]bool{}
	for _, cmh := range channelMembersHistory {
		if cmh.UserDeleteAt > 0 && cmh.UserDeleteAt < startTime {
			continue
		}

		if cmh.JoinTime > endTime {
			continue
		}

		if cmh.LeaveTime != nil && *cmh.LeaveTime < startTime {
			continue
		}

		if cmh.JoinTime <= endTime {
			joins = append(joins, ChannelMemberJoin{
				UserId:   cmh.UserId,
				IsBot:    cmh.IsBot,
				Email:    cmh.UserEmail,
				Username: cmh.Username,
				Datetime: cmh.JoinTime,
			})
			alreadyJoined[cmh.UserId] = true
		}

		if cmh.LeaveTime != nil && *cmh.LeaveTime <= endTime {
			leaves = append(leaves, ChannelMemberLeave{
				UserId:   cmh.UserId,
				IsBot:    cmh.IsBot,
				Email:    cmh.UserEmail,
				Username: cmh.Username,
				Datetime: *cmh.LeaveTime,
			})
		}
	}

	for _, member := range channelMembers {
		if alreadyJoined[member.UserId] {
			continue
		}

		joins = append(joins, ChannelMemberJoin{
			UserId:   member.UserId,
			IsBot:    member.IsBot,
			Email:    member.Email,
			Username: member.Username,
			Datetime: startTime,
		})
	}
	return joins, leaves
}

func ChannelTypeDisplayName(channelType model.ChannelType) string {
	return map[model.ChannelType]string{
		model.ChannelTypeOpen:    "public",
		model.ChannelTypePrivate: "private",
		model.ChannelTypeDirect:  "direct",
		model.ChannelTypeGroup:   "group",
	}[channelType]
}
