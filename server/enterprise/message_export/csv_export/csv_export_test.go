// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package csv_export

import (
	"archive/zip"
	"bytes"
	"errors"
	"io"
	"os"
	"path"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"
	"github.com/mattermost/mattermost/server/v8/enterprise/message_export/shared"
	"github.com/mattermost/mattermost/server/v8/platform/shared/filestore"
)

func TestMergePosts(t *testing.T) {
	chanTypeDirect := model.ChannelTypeDirect
	// these two posts were made in the same channel
	post1 := &model.MessageExport{
		ChannelId:          model.NewPointer("Test"),
		ChannelDisplayName: model.NewPointer("Test"),
		PostCreateAt:       model.NewPointer(int64(1)),
		PostMessage:        model.NewPointer("Some message"),
		UserEmail:          model.NewPointer("test@test.com"),
		UserId:             model.NewPointer("test"),
		Username:           model.NewPointer("test"),
		ChannelType:        &chanTypeDirect,
	}

	post2 := &model.MessageExport{
		ChannelId:          model.NewPointer("Test"),
		ChannelDisplayName: model.NewPointer("Test"),
		PostCreateAt:       model.NewPointer(int64(2)),
		PostMessage:        model.NewPointer("Some message"),
		UserEmail:          model.NewPointer("test@test.com"),
		UserId:             model.NewPointer("test"),
		Username:           model.NewPointer("test"),
		ChannelType:        &chanTypeDirect,
	}

	post3 := &model.MessageExport{
		ChannelId:          model.NewPointer("Test"),
		ChannelDisplayName: model.NewPointer("Test"),
		PostCreateAt:       model.NewPointer(int64(3)),
		PostMessage:        model.NewPointer("Some message"),
		UserEmail:          model.NewPointer("test@test.com"),
		UserId:             model.NewPointer("test"),
		Username:           model.NewPointer("test"),
		ChannelType:        &chanTypeDirect,
	}

	post4 := &model.MessageExport{
		ChannelId:          model.NewPointer("Test"),
		ChannelDisplayName: model.NewPointer("Test"),
		PostCreateAt:       model.NewPointer(int64(4)),
		PostMessage:        model.NewPointer("Some message"),
		UserEmail:          model.NewPointer("test@test.com"),
		UserId:             model.NewPointer("test"),
		Username:           model.NewPointer("test"),
		ChannelType:        &chanTypeDirect,
	}

	post2other := &model.MessageExport{
		ChannelId:          model.NewPointer("Test"),
		ChannelDisplayName: model.NewPointer("Test"),
		PostCreateAt:       model.NewPointer(int64(2)),
		PostMessage:        model.NewPointer("Some message"),
		UserEmail:          model.NewPointer("test@test.com"),
		UserId:             model.NewPointer("test"),
		Username:           model.NewPointer("test"),
		ChannelType:        &chanTypeDirect,
	}

	var mergetests = []struct {
		name string
		in1  []*model.MessageExport
		in2  []*model.MessageExport
		out  []*model.MessageExport
	}{
		{
			"merge all",
			[]*model.MessageExport{post1, post2, post3, post4},
			[]*model.MessageExport{post1, post2, post3, post4},
			[]*model.MessageExport{post1, post1, post2, post2, post3, post3, post4, post4},
		},
		{
			"split and merge 1",
			[]*model.MessageExport{post1, post3},
			[]*model.MessageExport{post2, post4},
			[]*model.MessageExport{post1, post2, post3, post4},
		},
		{
			"split and merge 2",
			[]*model.MessageExport{post1, post4},
			[]*model.MessageExport{post2, post3},
			[]*model.MessageExport{post1, post2, post3, post4},
		},
		{
			"ordered 1",
			[]*model.MessageExport{post1, post2},
			[]*model.MessageExport{post1, post2other},
			[]*model.MessageExport{post1, post1, post2, post2other},
		},
		{
			"ordered 2",
			[]*model.MessageExport{post1, post2other},
			[]*model.MessageExport{post1, post2},
			[]*model.MessageExport{post1, post1, post2other, post2},
		},
	}

	for _, tt := range mergetests {
		t.Run(tt.name, func(t *testing.T) {
			next := mergePosts(tt.in1, tt.in2)
			posts := []*model.MessageExport{}
			for post := next(); post != nil; post = next() {
				posts = append(posts, post)
			}
			assert.Equal(t, tt.out, posts)
		})
	}
}

func TestPostToRow(t *testing.T) {
	chanTypeDirect := model.ChannelTypeDirect
	// these two posts were made in the same channel
	post := &model.MessageExport{
		PostId:             model.NewPointer("post-id"),
		PostOriginalId:     model.NewPointer("post-original-id"),
		PostRootId:         model.NewPointer("post-root-id"),
		TeamId:             model.NewPointer("team-id"),
		TeamName:           model.NewPointer("team-name"),
		TeamDisplayName:    model.NewPointer("team-display-name"),
		ChannelId:          model.NewPointer("channel-id"),
		ChannelName:        model.NewPointer("channel-name"),
		ChannelDisplayName: model.NewPointer("channel-display-name"),
		PostCreateAt:       model.NewPointer(int64(1)),
		PostMessage:        model.NewPointer("message"),
		UserEmail:          model.NewPointer("test@test.com"),
		UserId:             model.NewPointer("user-id"),
		Username:           model.NewPointer("username"),
		ChannelType:        &chanTypeDirect,
	}

	post_without_team := &model.MessageExport{
		PostId:             model.NewPointer("post-id"),
		PostOriginalId:     model.NewPointer("post-original-id"),
		PostRootId:         model.NewPointer("post-root-id"),
		ChannelId:          model.NewPointer("channel-id"),
		ChannelName:        model.NewPointer("channel-name"),
		ChannelDisplayName: model.NewPointer("channel-display-name"),
		PostCreateAt:       model.NewPointer(int64(1)),
		PostMessage:        model.NewPointer("message"),
		UserEmail:          model.NewPointer("test@test.com"),
		UserId:             model.NewPointer("user-id"),
		Username:           model.NewPointer("username"),
		ChannelType:        &chanTypeDirect,
	}

	post_with_other_type := &model.MessageExport{
		PostId:             model.NewPointer("post-id"),
		PostOriginalId:     model.NewPointer("post-original-id"),
		PostRootId:         model.NewPointer("post-root-id"),
		TeamId:             model.NewPointer("team-id"),
		TeamName:           model.NewPointer("team-name"),
		TeamDisplayName:    model.NewPointer("team-display-name"),
		ChannelId:          model.NewPointer("channel-id"),
		ChannelName:        model.NewPointer("channel-name"),
		ChannelDisplayName: model.NewPointer("channel-display-name"),
		PostCreateAt:       model.NewPointer(int64(1)),
		PostMessage:        model.NewPointer("message"),
		UserEmail:          model.NewPointer("test@test.com"),
		UserId:             model.NewPointer("user-id"),
		Username:           model.NewPointer("username"),
		ChannelType:        &chanTypeDirect,
		PostType:           model.NewPointer("other"),
	}

	post_with_other_type_bot := &model.MessageExport{
		PostId:             model.NewPointer("post-id"),
		PostOriginalId:     model.NewPointer("post-original-id"),
		PostRootId:         model.NewPointer("post-root-id"),
		TeamId:             model.NewPointer("team-id"),
		TeamName:           model.NewPointer("team-name"),
		TeamDisplayName:    model.NewPointer("team-display-name"),
		ChannelId:          model.NewPointer("channel-id"),
		ChannelName:        model.NewPointer("channel-name"),
		ChannelDisplayName: model.NewPointer("channel-display-name"),
		PostCreateAt:       model.NewPointer(int64(1)),
		PostMessage:        model.NewPointer("message"),
		UserEmail:          model.NewPointer("test@test.com"),
		UserId:             model.NewPointer("user-id"),
		Username:           model.NewPointer("username"),
		ChannelType:        &chanTypeDirect,
		PostType:           model.NewPointer("other"),
		IsBot:              true,
	}

	post_with_permalink_preview := &model.MessageExport{
		PostId:             model.NewPointer("post-id"),
		PostOriginalId:     model.NewPointer("post-original-id"),
		PostRootId:         model.NewPointer("post-root-id"),
		TeamId:             model.NewPointer("team-id"),
		TeamName:           model.NewPointer("team-name"),
		TeamDisplayName:    model.NewPointer("team-display-name"),
		ChannelId:          model.NewPointer("channel-id"),
		ChannelName:        model.NewPointer("channel-name"),
		ChannelDisplayName: model.NewPointer("channel-display-name"),
		PostCreateAt:       model.NewPointer(int64(1)),
		PostMessage:        model.NewPointer("message"),
		UserEmail:          model.NewPointer("test@test.com"),
		UserId:             model.NewPointer("user-id"),
		Username:           model.NewPointer("username"),
		ChannelType:        &chanTypeDirect,
		PostProps:          model.NewPointer(`{"previewed_post":"n4w39mc1ff8y5fite4b8hacy1w"}`),
	}
	torowtests := []struct {
		name string
		in   *model.MessageExport
		out  []string
	}{
		{
			"simple row",
			post,
			[]string{"1", "team-id", "team-name", "team-display-name", "channel-id", "channel-name", "channel-display-name", "direct", "user-id", "test@test.com", "username", "post-id", "post-original-id", "post-root-id", "message", "message", "user", ""},
		},
		{
			"without team data",
			post_without_team,
			[]string{"1", "", "", "", "channel-id", "channel-name", "channel-display-name", "direct", "user-id", "test@test.com", "username", "post-id", "post-original-id", "post-root-id", "message", "message", "user", ""},
		},
		{
			"with special post type",
			post_with_other_type,
			[]string{"1", "team-id", "team-name", "team-display-name", "channel-id", "channel-name", "channel-display-name", "direct", "user-id", "test@test.com", "username", "post-id", "post-original-id", "post-root-id", "message", "other", "user", ""},
		},
		{
			"with special post type from bot",
			post_with_other_type_bot,
			[]string{"1", "team-id", "team-name", "team-display-name", "channel-id", "channel-name", "channel-display-name", "direct", "user-id", "test@test.com", "username", "post-id", "post-original-id", "post-root-id", "message", "other", "bot", ""},
		},
		{
			"with permalink preview",
			post_with_permalink_preview,
			[]string{"1", "team-id", "team-name", "team-display-name", "channel-id", "channel-name", "channel-display-name", "direct", "user-id", "test@test.com", "username", "post-id", "post-original-id", "post-root-id", "message", "message", "user", "n4w39mc1ff8y5fite4b8hacy1w"},
		},
	}

	for _, tt := range torowtests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.out, postToRow(tt.in, tt.in.PostCreateAt, *tt.in.PostMessage))
		})
	}
}

func TestAttachmentToRow(t *testing.T) {
	chanTypeDirect := model.ChannelTypeDirect
	post := &model.MessageExport{
		PostId:             model.NewPointer("post-id"),
		PostOriginalId:     model.NewPointer("post-original-id"),
		PostRootId:         model.NewPointer("post-root-id"),
		TeamId:             model.NewPointer("team-id"),
		TeamName:           model.NewPointer("team-name"),
		TeamDisplayName:    model.NewPointer("team-display-name"),
		ChannelId:          model.NewPointer("channel-id"),
		ChannelName:        model.NewPointer("channel-name"),
		ChannelDisplayName: model.NewPointer("channel-display-name"),
		PostCreateAt:       model.NewPointer(int64(1)),
		PostMessage:        model.NewPointer("message"),
		UserEmail:          model.NewPointer("test@test.com"),
		UserId:             model.NewPointer("user-id"),
		Username:           model.NewPointer("username"),
		ChannelType:        &chanTypeDirect,
	}

	post_deleted := &model.MessageExport{
		PostId:             model.NewPointer("post-id"),
		PostOriginalId:     model.NewPointer("post-original-id"),
		PostRootId:         model.NewPointer("post-root-id"),
		TeamId:             model.NewPointer("team-id"),
		TeamName:           model.NewPointer("team-name"),
		TeamDisplayName:    model.NewPointer("team-display-name"),
		ChannelId:          model.NewPointer("channel-id"),
		ChannelName:        model.NewPointer("channel-name"),
		ChannelDisplayName: model.NewPointer("channel-display-name"),
		PostCreateAt:       model.NewPointer(int64(1)),
		PostDeleteAt:       model.NewPointer(int64(10)),
		PostMessage:        model.NewPointer("message"),
		UserEmail:          model.NewPointer("test@test.com"),
		UserId:             model.NewPointer("user-id"),
		Username:           model.NewPointer("username"),
		ChannelType:        &chanTypeDirect,
	}

	file := &model.FileInfo{
		Name: "test1",
		Id:   "12345",
		Path: "filename.txt",
	}

	file_deleted := &model.FileInfo{
		Name:     "test2",
		Id:       "12346",
		Path:     "filename.txt",
		DeleteAt: 10,
	}

	torowtests := []struct {
		name       string
		post       *model.MessageExport
		attachment *model.FileInfo
		out        []string
	}{
		{
			"simple attachment",
			post,
			file,
			[]string{"1", "team-id", "team-name", "team-display-name", "channel-id", "channel-name", "channel-display-name", "direct", "user-id", "test@test.com", "username", "post-id", "post-original-id", "post-root-id", "test1 (files/post-id/12345-filename.txt)", "attachment", "user"},
		},
		{
			"simple deleted attachment",
			post_deleted,
			file_deleted,
			[]string{"10", "team-id", "team-name", "team-display-name", "channel-id", "channel-name", "channel-display-name", "direct", "user-id", "test@test.com", "username", "post-id", "post-original-id", "post-root-id", "test2 (files/post-id/12346-filename.txt)", "deleted attachment", "user"},
		},
	}

	for _, tt := range torowtests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.out, attachmentToRow(tt.post, tt.attachment))
		})
	}
}

func TestGetPostAttachments(t *testing.T) {
	chanTypeDirect := model.ChannelTypeDirect
	post := &model.MessageExport{
		PostId:             model.NewPointer("post-id"),
		PostOriginalId:     model.NewPointer("post-original-id"),
		PostRootId:         model.NewPointer("post-root-id"),
		TeamId:             model.NewPointer("team-id"),
		TeamName:           model.NewPointer("team-name"),
		TeamDisplayName:    model.NewPointer("team-display-name"),
		ChannelId:          model.NewPointer("channel-id"),
		ChannelName:        model.NewPointer("channel-name"),
		ChannelDisplayName: model.NewPointer("channel-display-name"),
		PostCreateAt:       model.NewPointer(int64(1)),
		PostMessage:        model.NewPointer("message"),
		UserEmail:          model.NewPointer("test@test.com"),
		UserId:             model.NewPointer("user-id"),
		Username:           model.NewPointer("username"),
		ChannelType:        &chanTypeDirect,
		PostFileIds:        []string{},
	}

	mockStore := &storetest.Store{}
	defer mockStore.AssertExpectations(t)

	files, err := getPostAttachments(mockStore, post)
	assert.NoError(t, err)
	assert.Empty(t, files)

	post.PostFileIds = []string{"1", "2"}

	mockStore.FileInfoStore.On("GetForPost", *post.PostId, true, true, false).Return([]*model.FileInfo{{Name: "test"}, {Name: "test2"}}, nil)

	files, err = getPostAttachments(mockStore, post)
	assert.NoError(t, err)
	assert.Len(t, files, 2)

	post.PostId = model.NewPointer("post-id-2")

	mockStore.FileInfoStore.On("GetForPost", *post.PostId, true, true, false).Return(nil, model.NewAppError("Test", "test", nil, "", 400))

	files, err = getPostAttachments(mockStore, post)
	assert.Error(t, err)
	assert.Nil(t, files)
}

func TestGetJoinLeavePosts(t *testing.T) {
	mockStore := &storetest.Store{}
	defer mockStore.AssertExpectations(t)

	channels := map[string]*shared.MetadataChannel{"bad-request": {StartTime: 1, EndTime: 2, ChannelId: "bad-request"}}

	mockStore.ChannelMemberHistoryStore.On("GetUsersInChannelDuring", int64(1), int64(2), []string{"bad-request"}).Return(nil, errors.New("test"))

	_, err := getJoinLeavePosts(channels, nil, mockStore)
	assert.Error(t, err)

	channels = map[string]*shared.MetadataChannel{
		"good-request-1": {StartTime: 1, EndTime: 7, ChannelId: "good-request-1", TeamId: model.NewPointer("test1"), TeamName: model.NewPointer("test1"), TeamDisplayName: model.NewPointer("test1"), ChannelName: "test1", ChannelDisplayName: "test1", ChannelType: "O"},
		"good-request-2": {StartTime: 2, EndTime: 7, ChannelId: "good-request-2", TeamId: model.NewPointer("test2"), TeamName: model.NewPointer("test2"), TeamDisplayName: model.NewPointer("test2"), ChannelName: "test2", ChannelDisplayName: "test2", ChannelType: "P"},
	}

	mockStore.ChannelMemberHistoryStore.On("GetUsersInChannelDuring", channels["good-request-1"].StartTime, channels["good-request-1"].EndTime, []string{"good-request-1"}).Return(
		[]*model.ChannelMemberHistoryResult{
			{JoinTime: 1, UserId: "test1", UserEmail: "test1", Username: "test1"},
			{JoinTime: 2, LeaveTime: model.NewPointer(int64(3)), UserId: "test2", UserEmail: "test2", Username: "test2"},
			{JoinTime: 3, UserId: "test3", UserEmail: "test3", Username: "test3"},
		},
		nil,
	)

	mockStore.ChannelMemberHistoryStore.On("GetUsersInChannelDuring", channels["good-request-2"].StartTime, channels["good-request-2"].EndTime, []string{"good-request-2"}).Return(
		[]*model.ChannelMemberHistoryResult{
			{JoinTime: 4, UserId: "test4", UserEmail: "test4", Username: "test4"},
			{JoinTime: 5, LeaveTime: model.NewPointer(int64(6)), UserId: "test5", UserEmail: "test5", Username: "test5"},
			{JoinTime: 6, UserId: "test6", UserEmail: "test6", Username: "test6"},
		},
		nil,
	)

	messages, err := getJoinLeavePosts(channels, nil, mockStore)
	assert.NoError(t, err)
	assert.Len(t, messages, 8)
	chanTypeOpen := model.ChannelTypeOpen
	chanTypePr := model.ChannelTypePrivate
	assert.Equal(t, &model.MessageExport{
		TeamId:             model.NewPointer("test1"),
		TeamName:           model.NewPointer("test1"),
		TeamDisplayName:    model.NewPointer("test1"),
		ChannelId:          model.NewPointer("good-request-1"),
		ChannelName:        model.NewPointer("test1"),
		ChannelDisplayName: model.NewPointer("test1"),
		ChannelType:        &chanTypeOpen,
		UserId:             model.NewPointer("test1"),
		UserEmail:          model.NewPointer("test1"),
		Username:           model.NewPointer("test1"),
		IsBot:              false,
		PostId:             model.NewPointer(""),
		PostCreateAt:       model.NewPointer(int64(1)),
		PostMessage:        model.NewPointer("User test1 (test1) was already in the channel"),
		PostType:           model.NewPointer("previously-joined"),
		PostRootId:         nil,
		PostProps:          nil,
		PostOriginalId:     model.NewPointer(""),
		PostFileIds:        model.StringArray{},
	}, messages[0])
	assert.Equal(t, &model.MessageExport{
		TeamId:             model.NewPointer("test1"),
		TeamName:           model.NewPointer("test1"),
		TeamDisplayName:    model.NewPointer("test1"),
		ChannelId:          model.NewPointer("good-request-1"),
		ChannelName:        model.NewPointer("test1"),
		ChannelDisplayName: model.NewPointer("test1"),
		ChannelType:        &chanTypeOpen,
		UserId:             model.NewPointer("test2"),
		UserEmail:          model.NewPointer("test2"),
		Username:           model.NewPointer("test2"),
		IsBot:              false,
		PostId:             model.NewPointer(""),
		PostCreateAt:       model.NewPointer(int64(2)),
		PostMessage:        model.NewPointer("User test2 (test2) joined the channel"),
		PostType:           model.NewPointer("enter"),
		PostRootId:         nil,
		PostProps:          nil,
		PostOriginalId:     model.NewPointer(""),
		PostFileIds:        model.StringArray{},
	}, messages[1])
	assert.Equal(t, &model.MessageExport{
		TeamId:             model.NewPointer("test1"),
		TeamName:           model.NewPointer("test1"),
		TeamDisplayName:    model.NewPointer("test1"),
		ChannelId:          model.NewPointer("good-request-1"),
		ChannelName:        model.NewPointer("test1"),
		ChannelDisplayName: model.NewPointer("test1"),
		ChannelType:        &chanTypeOpen,
		UserId:             model.NewPointer("test3"),
		UserEmail:          model.NewPointer("test3"),
		Username:           model.NewPointer("test3"),
		IsBot:              false,
		PostId:             model.NewPointer(""),
		PostCreateAt:       model.NewPointer(int64(3)),
		PostMessage:        model.NewPointer("User test3 (test3) joined the channel"),
		PostType:           model.NewPointer("enter"),
		PostRootId:         nil,
		PostProps:          nil,
		PostOriginalId:     model.NewPointer(""),
		PostFileIds:        model.StringArray{},
	}, messages[2])
	assert.Equal(t, &model.MessageExport{
		TeamId:             model.NewPointer("test1"),
		TeamName:           model.NewPointer("test1"),
		TeamDisplayName:    model.NewPointer("test1"),
		ChannelId:          model.NewPointer("good-request-1"),
		ChannelName:        model.NewPointer("test1"),
		ChannelDisplayName: model.NewPointer("test1"),
		ChannelType:        &chanTypeOpen,
		UserId:             model.NewPointer("test2"),
		UserEmail:          model.NewPointer("test2"),
		Username:           model.NewPointer("test2"),
		IsBot:              false,
		PostId:             model.NewPointer(""),
		PostCreateAt:       model.NewPointer(int64(3)),
		PostMessage:        model.NewPointer("User test2 (test2) leaved the channel"),
		PostType:           model.NewPointer("leave"),
		PostRootId:         nil,
		PostProps:          nil,
		PostOriginalId:     model.NewPointer(""),
		PostFileIds:        model.StringArray{},
	}, messages[3])
	assert.Equal(t, &model.MessageExport{
		TeamId:             model.NewPointer("test2"),
		TeamName:           model.NewPointer("test2"),
		TeamDisplayName:    model.NewPointer("test2"),
		ChannelId:          model.NewPointer("good-request-2"),
		ChannelName:        model.NewPointer("test2"),
		ChannelDisplayName: model.NewPointer("test2"),
		ChannelType:        &chanTypePr,
		UserId:             model.NewPointer("test4"),
		UserEmail:          model.NewPointer("test4"),
		Username:           model.NewPointer("test4"),
		IsBot:              false,
		PostId:             model.NewPointer(""),
		PostCreateAt:       model.NewPointer(int64(4)),
		PostMessage:        model.NewPointer("User test4 (test4) joined the channel"),
		PostType:           model.NewPointer("enter"),
		PostRootId:         nil,
		PostProps:          nil,
		PostOriginalId:     model.NewPointer(""),
		PostFileIds:        model.StringArray{},
	}, messages[4])
	assert.Equal(t, &model.MessageExport{
		TeamId:             model.NewPointer("test2"),
		TeamName:           model.NewPointer("test2"),
		TeamDisplayName:    model.NewPointer("test2"),
		ChannelId:          model.NewPointer("good-request-2"),
		ChannelName:        model.NewPointer("test2"),
		ChannelDisplayName: model.NewPointer("test2"),
		ChannelType:        &chanTypePr,
		UserId:             model.NewPointer("test5"),
		UserEmail:          model.NewPointer("test5"),
		Username:           model.NewPointer("test5"),
		IsBot:              false,
		PostId:             model.NewPointer(""),
		PostCreateAt:       model.NewPointer(int64(5)),
		PostMessage:        model.NewPointer("User test5 (test5) joined the channel"),
		PostType:           model.NewPointer("enter"),
		PostRootId:         nil,
		PostProps:          nil,
		PostOriginalId:     model.NewPointer(""),
		PostFileIds:        model.StringArray{},
	}, messages[5])
	assert.Equal(t, &model.MessageExport{
		TeamId:             model.NewPointer("test2"),
		TeamName:           model.NewPointer("test2"),
		TeamDisplayName:    model.NewPointer("test2"),
		ChannelId:          model.NewPointer("good-request-2"),
		ChannelName:        model.NewPointer("test2"),
		ChannelDisplayName: model.NewPointer("test2"),
		ChannelType:        &chanTypePr,
		UserId:             model.NewPointer("test6"),
		UserEmail:          model.NewPointer("test6"),
		Username:           model.NewPointer("test6"),
		IsBot:              false,
		PostId:             model.NewPointer(""),
		PostCreateAt:       model.NewPointer(int64(6)),
		PostMessage:        model.NewPointer("User test6 (test6) joined the channel"),
		PostType:           model.NewPointer("enter"),
		PostRootId:         nil,
		PostProps:          nil,
		PostOriginalId:     model.NewPointer(""),
		PostFileIds:        model.StringArray{},
	}, messages[6])
	assert.Equal(t, &model.MessageExport{
		TeamId:             model.NewPointer("test2"),
		TeamName:           model.NewPointer("test2"),
		TeamDisplayName:    model.NewPointer("test2"),
		ChannelId:          model.NewPointer("good-request-2"),
		ChannelName:        model.NewPointer("test2"),
		ChannelDisplayName: model.NewPointer("test2"),
		ChannelType:        &chanTypePr,
		UserId:             model.NewPointer("test5"),
		UserEmail:          model.NewPointer("test5"),
		Username:           model.NewPointer("test5"),
		IsBot:              false,
		PostId:             model.NewPointer(""),
		PostCreateAt:       model.NewPointer(int64(6)),
		PostMessage:        model.NewPointer("User test5 (test5) leaved the channel"),
		PostType:           model.NewPointer("leave"),
		PostRootId:         nil,
		PostProps:          nil,
		PostOriginalId:     model.NewPointer(""),
		PostFileIds:        model.StringArray{},
	}, messages[7])
}

func TestCsvExport(t *testing.T) {
	t.Run("no dedicated export filestore", func(t *testing.T) {
		exportTempDir, err := os.MkdirTemp("", "")
		require.NoError(t, err)
		t.Cleanup(func() {
			err = os.RemoveAll(exportTempDir)
			assert.NoError(t, err)
		})

		fileBackend, err := filestore.NewFileBackend(filestore.FileBackendSettings{
			DriverName: model.ImageDriverLocal,
			Directory:  exportTempDir,
		})
		assert.NoError(t, err)

		runTestCsvExportDedicatedExportFilestore(t, fileBackend, fileBackend)
	})

	t.Run("using dedicated export filestore", func(t *testing.T) {
		exportTempDir, err := os.MkdirTemp("", "")
		require.NoError(t, err)
		t.Cleanup(func() {
			err = os.RemoveAll(exportTempDir)
			assert.NoError(t, err)
		})

		exportBackend, err := filestore.NewFileBackend(filestore.FileBackendSettings{
			DriverName: model.ImageDriverLocal,
			Directory:  exportTempDir,
		})
		assert.NoError(t, err)

		attachmentTempDir, err := os.MkdirTemp("", "")
		require.NoError(t, err)
		t.Cleanup(func() {
			err = os.RemoveAll(attachmentTempDir)
			assert.NoError(t, err)
		})

		attachmentBackend, err := filestore.NewFileBackend(filestore.FileBackendSettings{
			DriverName: model.ImageDriverLocal,
			Directory:  attachmentTempDir,
		})

		runTestCsvExportDedicatedExportFilestore(t, exportBackend, attachmentBackend)
	})
}

func runTestCsvExportDedicatedExportFilestore(t *testing.T, exportBackend filestore.FileBackend, attachmentBackend filestore.FileBackend) {
	rctx := request.TestContext(t)

	header := "Post Creation Time,Team Id,Team Name,Team Display Name,Channel Id,Channel Name,Channel Display Name,Channel Type,User Id,User Email,Username,Post Id,Edited By Post Id,Replied to Post Id,Post Message,Post Type,User Type,Previews Post Id\n"

	chanTypeDirect := model.ChannelTypeDirect
	csvExportTests := []struct {
		name             string
		cmhs             map[string][]*model.ChannelMemberHistoryResult
		posts            []*model.MessageExport
		attachments      map[string][]*model.FileInfo
		expectedPosts    string
		expectedMetadata string
		expectedFiles    int
	}{
		{
			name:             "empty",
			cmhs:             map[string][]*model.ChannelMemberHistoryResult{},
			posts:            []*model.MessageExport{},
			attachments:      map[string][]*model.FileInfo{},
			expectedPosts:    header,
			expectedMetadata: "{\n  \"Channels\": {},\n  \"MessagesCount\": 0,\n  \"AttachmentsCount\": 0,\n  \"StartTime\": 0,\n  \"EndTime\": 0\n}",
			expectedFiles:    2,
		},
		{
			name: "posts",
			cmhs: map[string][]*model.ChannelMemberHistoryResult{
				"channel-id": {
					{
						JoinTime: 0, UserId: "test", UserEmail: "test", Username: "test", LeaveTime: model.NewPointer(int64(400)),
					},
					{
						JoinTime: 8, UserId: "test2", UserEmail: "test2", Username: "test2", LeaveTime: model.NewPointer(int64(80)),
					},
					{
						JoinTime: 400, UserId: "test3", UserEmail: "test3", Username: "test3",
					},
				},
			},
			posts: []*model.MessageExport{
				{
					PostId:             model.NewPointer("post-id"),
					PostOriginalId:     model.NewPointer("post-original-id"),
					TeamId:             model.NewPointer("team-id"),
					TeamName:           model.NewPointer("team-name"),
					TeamDisplayName:    model.NewPointer("team-display-name"),
					ChannelId:          model.NewPointer("channel-id"),
					ChannelName:        model.NewPointer("channel-name"),
					ChannelDisplayName: model.NewPointer("channel-display-name"),
					PostCreateAt:       model.NewPointer(int64(1)),
					PostMessage:        model.NewPointer("message"),
					UserEmail:          model.NewPointer("test@test.com"),
					UserId:             model.NewPointer("user-id"),
					Username:           model.NewPointer("username"),
					ChannelType:        &chanTypeDirect,
					PostFileIds:        []string{},
				},
				{
					PostId:             model.NewPointer("post-id"),
					PostOriginalId:     model.NewPointer("post-original-id"),
					PostRootId:         model.NewPointer("post-root-id"),
					TeamId:             model.NewPointer("team-id"),
					TeamName:           model.NewPointer("team-name"),
					TeamDisplayName:    model.NewPointer("team-display-name"),
					ChannelId:          model.NewPointer("channel-id"),
					ChannelName:        model.NewPointer("channel-name"),
					ChannelDisplayName: model.NewPointer("channel-display-name"),
					PostCreateAt:       model.NewPointer(int64(100)),
					PostMessage:        model.NewPointer("message"),
					UserEmail:          model.NewPointer("test@test.com"),
					UserId:             model.NewPointer("user-id"),
					Username:           model.NewPointer("username"),
					ChannelType:        &chanTypeDirect,
					PostFileIds:        []string{},
				},
				{
					PostId:             model.NewPointer("post-id"),
					PostOriginalId:     model.NewPointer("post-original-id"),
					PostRootId:         model.NewPointer("post-root-id"),
					TeamId:             model.NewPointer("team-id"),
					TeamName:           model.NewPointer("team-name"),
					TeamDisplayName:    model.NewPointer("team-display-name"),
					ChannelId:          model.NewPointer("channel-id"),
					ChannelName:        model.NewPointer("channel-name"),
					ChannelDisplayName: model.NewPointer("channel-display-name"),
					PostCreateAt:       model.NewPointer(int64(100)),
					PostMessage:        model.NewPointer("message"),
					UserEmail:          model.NewPointer("test@test.com"),
					UserId:             model.NewPointer("user-id"),
					Username:           model.NewPointer("username"),
					ChannelType:        &chanTypeDirect,
					PostFileIds:        []string{},
					PostProps:          model.NewPointer(`{"previewed_post":"o4w39mc1ff8y5fite4b8hacy1x"}`),
				},
			},
			attachments: map[string][]*model.FileInfo{},
			expectedPosts: strings.Join([]string{
				header,
				"1,team-id,team-name,team-display-name,channel-id,channel-name,channel-display-name,direct,test,test,test,,,,User test (test) was already in the channel,previously-joined,user,\n",
				"1,team-id,team-name,team-display-name,channel-id,channel-name,channel-display-name,direct,user-id,test@test.com,username,,,,User username (test@test.com) was already in the channel,previously-joined,user,\n",
				"1,team-id,team-name,team-display-name,channel-id,channel-name,channel-display-name,direct,user-id,test@test.com,username,post-id,post-original-id,,message,message,user,\n",
				"8,team-id,team-name,team-display-name,channel-id,channel-name,channel-display-name,direct,test2,test2,test2,,,,User test2 (test2) joined the channel,enter,user,\n",
				"80,team-id,team-name,team-display-name,channel-id,channel-name,channel-display-name,direct,test2,test2,test2,,,,User test2 (test2) leaved the channel,leave,user,\n",
				"100,team-id,team-name,team-display-name,channel-id,channel-name,channel-display-name,direct,user-id,test@test.com,username,post-id,post-original-id,post-root-id,message,message,user,\n",
				"100,team-id,team-name,team-display-name,channel-id,channel-name,channel-display-name,direct,user-id,test@test.com,username,post-id,post-original-id,post-root-id,message,message,user,o4w39mc1ff8y5fite4b8hacy1x\n",
			}, ""),
			expectedMetadata: "{\n  \"Channels\": {\n    \"channel-id\": {\n      \"TeamId\": \"team-id\",\n      \"TeamName\": \"team-name\",\n      \"TeamDisplayName\": \"team-display-name\",\n      \"ChannelId\": \"channel-id\",\n      \"ChannelName\": \"channel-name\",\n      \"ChannelDisplayName\": \"channel-display-name\",\n      \"ChannelType\": \"D\",\n      \"RoomId\": \"direct - channel-id\",\n      \"StartTime\": 1,\n      \"EndTime\": 100,\n      \"MessagesCount\": 3,\n      \"AttachmentsCount\": 0\n    }\n  },\n  \"MessagesCount\": 3,\n  \"AttachmentsCount\": 0,\n  \"StartTime\": 1,\n  \"EndTime\": 100\n}",
			expectedFiles:    2,
		},
		{
			name: "deleted post",
			cmhs: map[string][]*model.ChannelMemberHistoryResult{
				"channel-id": {
					{
						JoinTime: 0, UserId: "test", UserEmail: "test", Username: "test", LeaveTime: model.NewPointer(int64(400)),
					},
				},
			},
			posts: []*model.MessageExport{
				{
					PostId:             model.NewPointer("post-id"),
					PostOriginalId:     model.NewPointer("post-original-id"),
					TeamId:             model.NewPointer("team-id"),
					TeamName:           model.NewPointer("team-name"),
					TeamDisplayName:    model.NewPointer("team-display-name"),
					ChannelId:          model.NewPointer("channel-id"),
					ChannelName:        model.NewPointer("channel-name"),
					ChannelDisplayName: model.NewPointer("channel-display-name"),
					PostCreateAt:       model.NewPointer(int64(1)),
					PostMessage:        model.NewPointer("message"),
					UserEmail:          model.NewPointer("test@test.com"),
					UserId:             model.NewPointer("user-id"),
					Username:           model.NewPointer("username"),
					ChannelType:        &chanTypeDirect,
					PostFileIds:        []string{},
				},
				{
					PostId:             model.NewPointer("post-id"),
					PostOriginalId:     model.NewPointer("post-original-id"),
					TeamId:             model.NewPointer("team-id"),
					TeamName:           model.NewPointer("team-name"),
					TeamDisplayName:    model.NewPointer("team-display-name"),
					ChannelId:          model.NewPointer("channel-id"),
					ChannelName:        model.NewPointer("channel-name"),
					ChannelDisplayName: model.NewPointer("channel-display-name"),
					PostCreateAt:       model.NewPointer(int64(100)),
					PostDeleteAt:       model.NewPointer(int64(101)),
					PostMessage:        model.NewPointer("message"),
					UserEmail:          model.NewPointer("test@test.com"),
					UserId:             model.NewPointer("user-id"),
					Username:           model.NewPointer("username"),
					ChannelType:        &chanTypeDirect,
					PostFileIds:        []string{},
					PostProps:          model.NewPointer("{\"deleteBy\":\"fy8j97gwii84bk4zxprbpc9d9w\"}"),
				},
			},
			attachments: map[string][]*model.FileInfo{},
			expectedPosts: strings.Join([]string{
				header,
				"1,team-id,team-name,team-display-name,channel-id,channel-name,channel-display-name,direct,test,test,test,,,,User test (test) was already in the channel,previously-joined,user,\n",
				"1,team-id,team-name,team-display-name,channel-id,channel-name,channel-display-name,direct,user-id,test@test.com,username,,,,User username (test@test.com) was already in the channel,previously-joined,user,\n",
				"1,team-id,team-name,team-display-name,channel-id,channel-name,channel-display-name,direct,user-id,test@test.com,username,post-id,post-original-id,,message,message,user,\n",
				"100,team-id,team-name,team-display-name,channel-id,channel-name,channel-display-name,direct,user-id,test@test.com,username,post-id,post-original-id,,message,message,user,\n",
				"101,team-id,team-name,team-display-name,channel-id,channel-name,channel-display-name,direct,user-id,test@test.com,username,post-id,post-original-id,,delete message,message,user,\n",
			}, ""),
			expectedMetadata: "{\n  \"Channels\": {\n    \"channel-id\": {\n      \"TeamId\": \"team-id\",\n      \"TeamName\": \"team-name\",\n      \"TeamDisplayName\": \"team-display-name\",\n      \"ChannelId\": \"channel-id\",\n      \"ChannelName\": \"channel-name\",\n      \"ChannelDisplayName\": \"channel-display-name\",\n      \"ChannelType\": \"D\",\n      \"RoomId\": \"direct - channel-id\",\n      \"StartTime\": 1,\n      \"EndTime\": 100,\n      \"MessagesCount\": 2,\n      \"AttachmentsCount\": 0\n    }\n  },\n  \"MessagesCount\": 2,\n  \"AttachmentsCount\": 0,\n  \"StartTime\": 1,\n  \"EndTime\": 100\n}",
			expectedFiles:    2,
		},
		{
			name: "posts with attachments",
			cmhs: map[string][]*model.ChannelMemberHistoryResult{
				"channel-id": {
					{
						JoinTime: 0, UserId: "test", UserEmail: "test", Username: "test", LeaveTime: model.NewPointer(int64(400)),
					},
					{
						JoinTime: 8, UserId: "test2", UserEmail: "test2", Username: "test2", LeaveTime: model.NewPointer(int64(80)),
					},
					{
						JoinTime: 400, UserId: "test3", UserEmail: "test3", Username: "test3",
					},
				},
			},
			posts: []*model.MessageExport{
				{
					PostId:             model.NewPointer("post-id-1"),
					PostOriginalId:     model.NewPointer("post-original-id"),
					TeamId:             model.NewPointer("team-id"),
					TeamName:           model.NewPointer("team-name"),
					TeamDisplayName:    model.NewPointer("team-display-name"),
					ChannelId:          model.NewPointer("channel-id"),
					ChannelName:        model.NewPointer("channel-name"),
					ChannelDisplayName: model.NewPointer("channel-display-name"),
					PostCreateAt:       model.NewPointer(int64(1)),
					PostMessage:        model.NewPointer("message"),
					UserEmail:          model.NewPointer("test@test.com"),
					UserId:             model.NewPointer("user-id"),
					Username:           model.NewPointer("username"),
					ChannelType:        &chanTypeDirect,
					PostFileIds:        []string{"test1"},
				},
				{
					PostId:             model.NewPointer("post-id-3"),
					PostOriginalId:     model.NewPointer("post-original-id"),
					TeamId:             model.NewPointer("team-id"),
					TeamName:           model.NewPointer("team-name"),
					TeamDisplayName:    model.NewPointer("team-display-name"),
					ChannelId:          model.NewPointer("channel-id"),
					ChannelName:        model.NewPointer("channel-name"),
					ChannelDisplayName: model.NewPointer("channel-display-name"),
					PostCreateAt:       model.NewPointer(int64(2)),
					PostDeleteAt:       model.NewPointer(int64(3)),
					PostMessage:        model.NewPointer("message"),
					UserEmail:          model.NewPointer("test@test.com"),
					UserId:             model.NewPointer("user-id"),
					Username:           model.NewPointer("username"),
					ChannelType:        &chanTypeDirect,
					PostFileIds:        []string{"test2"},
				},
				{
					PostId:             model.NewPointer("post-id-2"),
					PostOriginalId:     model.NewPointer("post-original-id"),
					PostRootId:         model.NewPointer("post-id-1"),
					TeamId:             model.NewPointer("team-id"),
					TeamName:           model.NewPointer("team-name"),
					TeamDisplayName:    model.NewPointer("team-display-name"),
					ChannelId:          model.NewPointer("channel-id"),
					ChannelName:        model.NewPointer("channel-name"),
					ChannelDisplayName: model.NewPointer("channel-display-name"),
					PostCreateAt:       model.NewPointer(int64(100)),
					PostMessage:        model.NewPointer("message"),
					UserEmail:          model.NewPointer("test@test.com"),
					UserId:             model.NewPointer("user-id"),
					Username:           model.NewPointer("username"),
					ChannelType:        &chanTypeDirect,
					PostFileIds:        []string{},
				},
			},
			attachments: map[string][]*model.FileInfo{
				"post-id-1": {
					{
						Name: "test1",
						Id:   "test1",
						Path: "test1",
					},
				},
				"post-id-3": {
					{
						Name:     "test2",
						Id:       "test2",
						Path:     "test2",
						DeleteAt: 3,
					},
				},
			},
			expectedPosts: strings.Join([]string{
				header,
				"1,team-id,team-name,team-display-name,channel-id,channel-name,channel-display-name,direct,test,test,test,,,,User test (test) was already in the channel,previously-joined,user,\n",
				"1,team-id,team-name,team-display-name,channel-id,channel-name,channel-display-name,direct,user-id,test@test.com,username,,,,User username (test@test.com) was already in the channel,previously-joined,user,\n",
				"1,team-id,team-name,team-display-name,channel-id,channel-name,channel-display-name,direct,user-id,test@test.com,username,post-id-1,post-original-id,,message,message,user,\n",
				"1,team-id,team-name,team-display-name,channel-id,channel-name,channel-display-name,direct,user-id,test@test.com,username,post-id-1,post-original-id,,test1 (files/post-id-1/test1-test1),attachment,user\n",
				"2,team-id,team-name,team-display-name,channel-id,channel-name,channel-display-name,direct,user-id,test@test.com,username,post-id-3,post-original-id,,message,message,user,\n",
				"3,team-id,team-name,team-display-name,channel-id,channel-name,channel-display-name,direct,user-id,test@test.com,username,post-id-3,post-original-id,,test2 (files/post-id-3/test2-test2),deleted attachment,user\n",
				"8,team-id,team-name,team-display-name,channel-id,channel-name,channel-display-name,direct,test2,test2,test2,,,,User test2 (test2) joined the channel,enter,user,\n",
				"80,team-id,team-name,team-display-name,channel-id,channel-name,channel-display-name,direct,test2,test2,test2,,,,User test2 (test2) leaved the channel,leave,user,\n",
				"100,team-id,team-name,team-display-name,channel-id,channel-name,channel-display-name,direct,user-id,test@test.com,username,post-id-2,post-original-id,post-id-1,message,message,user,\n",
			}, ""),
			expectedMetadata: "{\n  \"Channels\": {\n    \"channel-id\": {\n      \"TeamId\": \"team-id\",\n      \"TeamName\": \"team-name\",\n      \"TeamDisplayName\": \"team-display-name\",\n      \"ChannelId\": \"channel-id\",\n      \"ChannelName\": \"channel-name\",\n      \"ChannelDisplayName\": \"channel-display-name\",\n      \"ChannelType\": \"D\",\n      \"RoomId\": \"direct - channel-id\",\n      \"StartTime\": 1,\n      \"EndTime\": 100,\n      \"MessagesCount\": 3,\n      \"AttachmentsCount\": 2\n    }\n  },\n  \"MessagesCount\": 3,\n  \"AttachmentsCount\": 2,\n  \"StartTime\": 1,\n  \"EndTime\": 100\n}",
			expectedFiles:    4,
		},
	}

	for _, tt := range csvExportTests {
		t.Run(tt.name, func(t *testing.T) {
			mockStore := &storetest.Store{}
			defer mockStore.AssertExpectations(t)

			if len(tt.attachments) > 0 {
				for post_id, attachments := range tt.attachments {
					call := mockStore.FileInfoStore.On("GetForPost", post_id, true, true, false).Times(3)
					call.Run(func(args mock.Arguments) {
						call.Return(tt.attachments[args.Get(0).(string)], nil)
					})
					_, err := attachmentBackend.WriteFile(bytes.NewReader([]byte{}), attachments[0].Path)
					require.NoError(t, err)
					t.Cleanup(func() {
						err = attachmentBackend.RemoveFile(attachments[0].Path)
						require.NoError(t, err)
					})
				}
			}

			if len(tt.cmhs) > 0 {
				for channelId, cmhs := range tt.cmhs {
					mockStore.ChannelMemberHistoryStore.On("GetUsersInChannelDuring", int64(1), int64(100), []string{channelId}).Return(cmhs, nil)
				}
			}

			exportFileName := path.Join("export", "jobName", "jobName-batch001-csv.zip")
			warningCount, err := CsvExport(rctx, tt.posts, mockStore, exportBackend, attachmentBackend, exportFileName)
			assert.NoError(t, err)
			assert.Equal(t, 0, warningCount)

			zipBytes, err := exportBackend.ReadFile(exportFileName)
			assert.NoError(t, err)
			t.Cleanup(func() {
				err = exportBackend.RemoveFile(exportFileName)
				require.NoError(t, err)
			})

			zipReader, err := zip.NewReader(bytes.NewReader(zipBytes), int64(len(zipBytes)))
			assert.NoError(t, err)
			assert.Len(t, zipReader.File, tt.expectedFiles)

			postsFile, err := zipReader.File[0].Open()
			require.NoError(t, err)
			defer postsFile.Close()
			postsFileData, err := io.ReadAll(postsFile)
			assert.NoError(t, err)
			postsFile.Close()

			metadataFile, err := zipReader.File[len(zipReader.File)-1].Open()
			require.NoError(t, err)
			defer metadataFile.Close()
			metadataFileData, err := io.ReadAll(metadataFile)
			require.NoError(t, err)
			err = metadataFile.Close()
			require.NoError(t, err)

			assert.Equal(t, tt.expectedPosts, string(postsFileData))
			assert.Equal(t, tt.expectedMetadata, string(metadataFileData))
		})
	}
}

func TestWriteExportWarnings(t *testing.T) {
	rctx := request.TestContext(t)

	chanTypeDirect := model.ChannelTypeDirect
	cmhs := map[string][]*model.ChannelMemberHistoryResult{
		"channel-id": {
			{
				JoinTime: 0, UserId: "test", UserEmail: "test", Username: "test", LeaveTime: model.NewPointer(int64(400)),
			},
			{
				JoinTime: 8, UserId: "test2", UserEmail: "test2", Username: "test2", LeaveTime: model.NewPointer(int64(80)),
			},
			{
				JoinTime: 400, UserId: "test3", UserEmail: "test3", Username: "test3",
			},
		},
	}

	posts := []*model.MessageExport{
		{
			PostId:             model.NewPointer("post-id-1"),
			PostOriginalId:     model.NewPointer("post-original-id"),
			TeamId:             model.NewPointer("team-id"),
			TeamName:           model.NewPointer("team-name"),
			TeamDisplayName:    model.NewPointer("team-display-name"),
			ChannelId:          model.NewPointer("channel-id"),
			ChannelName:        model.NewPointer("channel-name"),
			ChannelDisplayName: model.NewPointer("channel-display-name"),
			PostCreateAt:       model.NewPointer(int64(1)),
			PostMessage:        model.NewPointer("message"),
			UserEmail:          model.NewPointer("test@test.com"),
			UserId:             model.NewPointer("user-id"),
			Username:           model.NewPointer("username"),
			ChannelType:        &chanTypeDirect,
			PostFileIds:        []string{"post-id-1"},
		},
		{
			PostId:             model.NewPointer("post-id-3"),
			PostOriginalId:     model.NewPointer("post-original-id"),
			TeamId:             model.NewPointer("team-id"),
			TeamName:           model.NewPointer("team-name"),
			TeamDisplayName:    model.NewPointer("team-display-name"),
			ChannelId:          model.NewPointer("channel-id"),
			ChannelName:        model.NewPointer("channel-name"),
			ChannelDisplayName: model.NewPointer("channel-display-name"),
			PostCreateAt:       model.NewPointer(int64(2)),
			PostDeleteAt:       model.NewPointer(int64(3)),
			PostMessage:        model.NewPointer("message"),
			UserEmail:          model.NewPointer("test@test.com"),
			UserId:             model.NewPointer("user-id"),
			Username:           model.NewPointer("username"),
			ChannelType:        &chanTypeDirect,
			PostFileIds:        []string{"post-id-2"},
		},
	}

	attachments := map[string][]*model.FileInfo{
		"post-id-1": {
			{
				Name: "test1",
				Id:   "test1",
				Path: "test1",
			},
		},
		"post-id-3": {
			{
				Name: "test2",
				Id:   "test2",
				Path: "test2",
			},
		},
	}

	tempDir, err := os.MkdirTemp("", "")
	require.NoError(t, err)
	t.Cleanup(func() {
		err = os.RemoveAll(tempDir)
		assert.NoError(t, err)
	})

	config := filestore.FileBackendSettings{
		DriverName: model.ImageDriverLocal,
		Directory:  tempDir,
	}

	fileBackend, err := filestore.NewFileBackend(config)
	assert.NoError(t, err)

	mockStore := &storetest.Store{}
	defer mockStore.AssertExpectations(t)

	for post_id := range attachments {
		call := mockStore.FileInfoStore.On("GetForPost", post_id, true, true, false).Times(3)
		call.Run(func(args mock.Arguments) {
			call.Return(attachments[args.Get(0).(string)], nil)
		})
	}

	for channelId, cmhs := range cmhs {
		mockStore.ChannelMemberHistoryStore.On("GetUsersInChannelDuring", int64(1), int64(2), []string{channelId}).Return(cmhs, nil)
	}

	exportFileName := path.Join("export", "jobName", "jobName-batch001-csv.zip")
	warningCount, err := CsvExport(rctx, posts, mockStore, fileBackend, fileBackend, exportFileName)
	assert.NoError(t, err)
	assert.Equal(t, 2, warningCount)

	zipBytes, err := fileBackend.ReadFile(exportFileName)
	assert.NoError(t, err)

	t.Cleanup(func() {
		err = fileBackend.RemoveFile(exportFileName)
		assert.NoError(t, err)
	})

	zipReader, err := zip.NewReader(bytes.NewReader(zipBytes), int64(len(zipBytes)))
	assert.NoError(t, err)
	assert.Len(t, zipReader.File, 3)
}
