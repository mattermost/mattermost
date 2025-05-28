// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package common_export

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestUpdateMetadata(t *testing.T) {
	metadata := Metadata{
		Channels:         map[string]*MetadataChannel{},
		MessagesCount:    0,
		AttachmentsCount: 0,
		StartTime:        0,
		EndTime:          0,
	}

	testString := "test"
	chanTypeDirect := model.ChannelTypeDirect
	createdAt := int64(12345)

	post := model.MessageExport{
		TeamId:          &testString,
		TeamName:        &testString,
		TeamDisplayName: &testString,

		ChannelId:          &testString,
		ChannelName:        &testString,
		ChannelDisplayName: &testString,
		ChannelType:        &chanTypeDirect,

		UserId:    &testString,
		UserEmail: &testString,
		Username:  &testString,

		PostId:         &testString,
		PostCreateAt:   &createdAt,
		PostMessage:    &testString,
		PostType:       &testString,
		PostOriginalId: &testString,
		PostFileIds:    []string{},
	}
	metadata.Update(&post, 2)

	assert.Len(t, metadata.Channels, 1)
	assert.Equal(t, 1, metadata.Channels["test"].MessagesCount)
	assert.Equal(t, 2, metadata.Channels["test"].AttachmentsCount)
	assert.Equal(t, 1, metadata.MessagesCount)
	assert.Equal(t, 2, metadata.AttachmentsCount)

	metadata.Update(&post, 2)

	assert.Len(t, metadata.Channels, 1)
	assert.Equal(t, 2, metadata.Channels["test"].MessagesCount)
	assert.Equal(t, 4, metadata.Channels["test"].AttachmentsCount)
	assert.Equal(t, 2, metadata.MessagesCount)
	assert.Equal(t, 4, metadata.AttachmentsCount)

	testString2 := "test2"
	post.ChannelId = &testString2

	metadata.Update(&post, 2)

	assert.Len(t, metadata.Channels, 2)
	assert.Equal(t, 2, metadata.Channels["test"].MessagesCount)
	assert.Equal(t, 4, metadata.Channels["test"].AttachmentsCount)
	assert.Equal(t, 1, metadata.Channels["test2"].MessagesCount)
	assert.Equal(t, 2, metadata.Channels["test2"].AttachmentsCount)
	assert.Equal(t, 3, metadata.MessagesCount)
	assert.Equal(t, 6, metadata.AttachmentsCount)
}

func TestGetJoinsAndLeavesForChannel(t *testing.T) {
	channel := MetadataChannel{
		StartTime:          100,
		EndTime:            200,
		ChannelId:          "good-request-1",
		TeamId:             model.NewPointer("test"),
		TeamName:           model.NewPointer("test"),
		TeamDisplayName:    model.NewPointer("test"),
		ChannelName:        "test",
		ChannelDisplayName: "test",
		ChannelType:        "O",
	}

	tt := []struct {
		name           string
		channel        MetadataChannel
		membersHistory []*model.ChannelMemberHistoryResult
		usersInPosts   map[string]ChannelMember
		expectedJoins  int
		expectedLeaves int
	}{
		{
			name:           "no-joins-no-leaves",
			channel:        channel,
			membersHistory: nil,
			usersInPosts:   nil,
			expectedJoins:  0,
			expectedLeaves: 0,
		},
		{
			name:    "joins-and-leaves-outside-the-range",
			channel: channel,
			membersHistory: []*model.ChannelMemberHistoryResult{
				{JoinTime: 1, LeaveTime: model.NewPointer(int64(10)), UserId: "test", UserEmail: "test", Username: "test"},
				{JoinTime: 250, LeaveTime: model.NewPointer(int64(260)), UserId: "test", UserEmail: "test", Username: "test"},
				{JoinTime: 300, UserId: "test", UserEmail: "test", Username: "test"},
			},
			usersInPosts:   nil,
			expectedJoins:  0,
			expectedLeaves: 0,
		},
		{
			name:    "join-and-leave-during-the-range",
			channel: channel,
			membersHistory: []*model.ChannelMemberHistoryResult{
				{JoinTime: 100, LeaveTime: model.NewPointer(int64(150)), UserId: "test", UserEmail: "test", Username: "test"},
			},
			usersInPosts:   nil,
			expectedJoins:  1,
			expectedLeaves: 1,
		},
		{
			name:    "join-during-and-leave-after-the-range",
			channel: channel,
			membersHistory: []*model.ChannelMemberHistoryResult{
				{JoinTime: 150, LeaveTime: model.NewPointer(int64(300)), UserId: "test", UserEmail: "test", Username: "test"},
			},
			usersInPosts:   nil,
			expectedJoins:  1,
			expectedLeaves: 0,
		},
		{
			name:    "join-before-and-leave-during-the-range",
			channel: channel,
			membersHistory: []*model.ChannelMemberHistoryResult{
				{JoinTime: 99, LeaveTime: model.NewPointer(int64(150)), UserId: "test", UserEmail: "test", Username: "test"},
			},
			usersInPosts:   nil,
			expectedJoins:  1,
			expectedLeaves: 1,
		},
		{
			name:    "join-before-and-leave-after-the-range",
			channel: channel,
			membersHistory: []*model.ChannelMemberHistoryResult{
				{JoinTime: 99, LeaveTime: model.NewPointer(int64(350)), UserId: "test", UserEmail: "test", Username: "test"},
			},
			usersInPosts:   nil,
			expectedJoins:  1,
			expectedLeaves: 0,
		},
		{
			name:           "implicit-joins",
			channel:        channel,
			membersHistory: nil,
			usersInPosts: map[string]ChannelMember{
				"test1": {UserId: "test1", Email: "test1", Username: "test1"},
				"test2": {UserId: "test2", Email: "test2", Username: "test2"},
			},
			expectedJoins:  2,
			expectedLeaves: 0,
		},
		{
			name:    "implicit-joins-with-explicit-joins",
			channel: channel,
			membersHistory: []*model.ChannelMemberHistoryResult{
				{JoinTime: 130, LeaveTime: model.NewPointer(int64(150)), UserId: "test1", UserEmail: "test1", Username: "test1"},
				{JoinTime: 130, LeaveTime: model.NewPointer(int64(150)), UserId: "test3", UserEmail: "test3", Username: "test3"},
			},
			usersInPosts: map[string]ChannelMember{
				"test1": {UserId: "test1", Email: "test1", Username: "test1"},
				"test2": {UserId: "test2", Email: "test2", Username: "test2"},
			},
			expectedJoins:  3,
			expectedLeaves: 2,
		},
		{
			name:    "join-leave-and-join-again",
			channel: channel,
			membersHistory: []*model.ChannelMemberHistoryResult{
				{JoinTime: 130, LeaveTime: model.NewPointer(int64(150)), UserId: "test1", UserEmail: "test1", Username: "test1"},
				{JoinTime: 160, LeaveTime: model.NewPointer(int64(180)), UserId: "test1", UserEmail: "test1", Username: "test1"},
			},
			usersInPosts:   nil,
			expectedJoins:  2,
			expectedLeaves: 2,
		},
		{
			name:    "deactivated-members-dont-show",
			channel: channel,
			membersHistory: []*model.ChannelMemberHistoryResult{
				{JoinTime: 130, LeaveTime: model.NewPointer(int64(150)), UserId: "test1", UserEmail: "test1", Username: "test1", UserDeleteAt: 50},
				{JoinTime: 160, LeaveTime: model.NewPointer(int64(180)), UserId: "test1", UserEmail: "test1", Username: "test1", UserDeleteAt: 50},
			},
			usersInPosts:   nil,
			expectedJoins:  0,
			expectedLeaves: 0,
		},
		{
			name:    "deactivated-members-show-if-deleted-after-latest-export",
			channel: channel,
			membersHistory: []*model.ChannelMemberHistoryResult{
				{JoinTime: 130, LeaveTime: model.NewPointer(int64(150)), UserId: "test1", UserEmail: "test1", Username: "test1", UserDeleteAt: 150},
				{JoinTime: 160, LeaveTime: model.NewPointer(int64(180)), UserId: "test1", UserEmail: "test1", Username: "test1", UserDeleteAt: 150},
			},
			usersInPosts:   nil,
			expectedJoins:  2,
			expectedLeaves: 2,
		},
		{
			name:    "deactivated-members-show-and-dont-show",
			channel: channel,
			membersHistory: []*model.ChannelMemberHistoryResult{
				{JoinTime: 130, LeaveTime: model.NewPointer(int64(150)), UserId: "test1", UserEmail: "test1", Username: "test1", UserDeleteAt: 50},
				{JoinTime: 160, LeaveTime: model.NewPointer(int64(180)), UserId: "test1", UserEmail: "test1", Username: "test1", UserDeleteAt: 150},
			},
			usersInPosts:   nil,
			expectedJoins:  1,
			expectedLeaves: 1,
		},
	}

	for _, tc := range tt {
		t.Run(tc.name, func(t *testing.T) {
			joins, leaves := GetJoinsAndLeavesForChannel(tc.channel.StartTime, tc.channel.EndTime, tc.membersHistory, tc.usersInPosts)
			assert.Len(t, joins, tc.expectedJoins)
			assert.Len(t, leaves, tc.expectedLeaves)
		})
	}
}
