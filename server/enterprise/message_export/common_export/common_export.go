// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package common_export

import (
	"fmt"
	"strconv"

	"github.com/mattermost/mattermost/server/v8/enterprise/message_export/shared"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
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
	Channels         map[string]*MetadataChannel
	MessagesCount    int
	AttachmentsCount int
	StartTime        int64
	EndTime          int64
}

func (metadata *Metadata) Update(post *model.MessageExport, attachments int) {
	channelMetadata, ok := metadata.Channels[*post.ChannelId]
	if !ok {
		channelMetadata = &MetadataChannel{
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

type ChannelExportsParams struct {
	Store                   shared.MessageExportStore
	ExportPeriodStartTime   int64
	ExportPeriodEndTime     int64
	ChannelBatchSize        int
	ChannelHistoryBatchSize int
	ReportProgressMessage   func(message string)
}

// CalculateChannelExports returns the channel info ( map[channelId]*MetadataChannel ) and the channel user
// joins/leaves ( map[channelId][]*model.ChannelMemberHistoryResult ) for any channel that has had activity
// (posts or user join/leaves) between ExportPeriodStartTime and ExportPeriodEndTime.
func CalculateChannelExports(rctx request.CTX, opt ChannelExportsParams) (map[string]*MetadataChannel, map[string][]*model.ChannelMemberHistoryResult, error) {
	// Which channels had user activity in the export period?
	activeChannelIds, err := opt.Store.ChannelMemberHistory().GetChannelsWithActivityDuring(opt.ExportPeriodStartTime, opt.ExportPeriodEndTime)
	if err != nil {
		return nil, nil, err
	}

	if len(activeChannelIds) == 0 {
		return nil, nil, nil
	}

	rctx.Logger().Debug("Started CalculateChannelExports", mlog.Int("export_period_start_time", opt.ExportPeriodStartTime), mlog.Int("export_period_end_time", opt.ExportPeriodEndTime), mlog.Int("num_active_channel_ids", len(activeChannelIds)))
	message := rctx.T("ent.message_export.actiance_export.calculate_channel_exports.channel_message", model.StringMap{"NumChannels": strconv.Itoa(len(activeChannelIds))})
	opt.ReportProgressMessage(message)

	// For each channel, get its metadata.
	channelMetadata := make(map[string]*MetadataChannel, len(activeChannelIds))

	// Use batches to reduce db load and network waste.
	for pos := 0; pos < len(activeChannelIds); pos += opt.ChannelBatchSize {
		upTo := min(pos+opt.ChannelBatchSize, len(activeChannelIds))
		batch := activeChannelIds[pos:upTo]
		channels, err := opt.Store.Channel().GetMany(batch, true)
		if err != nil {
			return nil, nil, err
		}

		for _, channel := range channels {
			channelMetadata[channel.Id] = &MetadataChannel{
				TeamId:             model.NewPointer(channel.TeamId),
				ChannelId:          channel.Id,
				ChannelName:        channel.Name,
				ChannelDisplayName: channel.DisplayName,
				ChannelType:        channel.Type,
				RoomId:             fmt.Sprintf("%v - %v", ChannelTypeDisplayName(channel.Type), channel.Id),
				StartTime:          opt.ExportPeriodStartTime,
				EndTime:            opt.ExportPeriodEndTime,
			}
		}
	}

	historiesByChannelId := make(map[string][]*model.ChannelMemberHistoryResult, len(activeChannelIds))

	// Now that we have metadata, get channelMemberHistories for each channel.
	// Use batches to reduce total db load and network waste.
	for pos := 0; pos < len(activeChannelIds); pos += opt.ChannelHistoryBatchSize {
		// This may take a while, so update the system console UI.
		message := rctx.T("ent.message_export.actiance_export.calculate_channel_exports.activity_message", model.StringMap{
			"NumChannels":  strconv.Itoa(len(activeChannelIds)),
			"NumCompleted": strconv.Itoa(pos),
		})
		opt.ReportProgressMessage(message)

		upTo := min(pos+opt.ChannelHistoryBatchSize, len(activeChannelIds))
		batch := activeChannelIds[pos:upTo]
		channelMemberHistories, err := opt.Store.ChannelMemberHistory().GetUsersInChannelDuring(opt.ExportPeriodStartTime, opt.ExportPeriodEndTime, batch)
		if err != nil {
			return nil, nil, err
		}

		// collect the channelMemberHistories by channelId
		for _, entry := range channelMemberHistories {
			historiesByChannelId[entry.ChannelId] = append(historiesByChannelId[entry.ChannelId], entry)
		}
	}

	return channelMetadata, historiesByChannelId, nil
}

func GetJoinsAndLeavesForChannel(startTime int64, endTime int64, channelMembersHistory []*model.ChannelMemberHistoryResult,
	postAuthors map[string]ChannelMember) ([]ChannelMemberJoin, []ChannelMemberLeave) {
	var joins []ChannelMemberJoin
	var leaves []ChannelMemberLeave

	alreadyJoined := make(map[string]bool)
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

	for _, member := range postAuthors {
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
