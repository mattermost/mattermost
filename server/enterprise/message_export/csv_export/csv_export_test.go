// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package csv_export

import (
	"archive/zip"
	"bytes"
	"fmt"
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

func TestPostToRow(t *testing.T) {
	chanTypeDirect := model.ChannelTypeDirect
	// these two posts were made in the same channel
	post := model.MessageExport{
		PostId:             model.NewPointer("post-id"),
		PostOriginalId:     model.NewPointer(""),
		PostRootId:         model.NewPointer("post-root-id"),
		TeamId:             model.NewPointer("team-id"),
		TeamName:           model.NewPointer("team-name"),
		TeamDisplayName:    model.NewPointer("team-display-name"),
		ChannelId:          model.NewPointer("channel-id"),
		ChannelName:        model.NewPointer("channel-name"),
		ChannelDisplayName: model.NewPointer("channel-display-name"),
		PostCreateAt:       model.NewPointer(int64(1)),
		PostUpdateAt:       model.NewPointer(int64(1)),
		PostMessage:        model.NewPointer("message"),
		UserEmail:          model.NewPointer("test@test.com"),
		UserId:             model.NewPointer("user-id"),
		Username:           model.NewPointer("username"),
		ChannelType:        &chanTypeDirect,
	}

	post_without_team := model.MessageExport{
		PostId:             model.NewPointer("post-id"),
		PostOriginalId:     model.NewPointer(""),
		PostRootId:         model.NewPointer("post-root-id"),
		ChannelId:          model.NewPointer("channel-id"),
		ChannelName:        model.NewPointer("channel-name"),
		ChannelDisplayName: model.NewPointer("channel-display-name"),
		PostCreateAt:       model.NewPointer(int64(1)),
		PostUpdateAt:       model.NewPointer(int64(1)),
		PostMessage:        model.NewPointer("message"),
		UserEmail:          model.NewPointer("test@test.com"),
		UserId:             model.NewPointer("user-id"),
		Username:           model.NewPointer("username"),
		ChannelType:        &chanTypeDirect,
	}

	post_with_other_type := model.MessageExport{
		PostId:             model.NewPointer("post-id"),
		PostOriginalId:     model.NewPointer(""),
		PostRootId:         model.NewPointer("post-root-id"),
		TeamId:             model.NewPointer("team-id"),
		TeamName:           model.NewPointer("team-name"),
		TeamDisplayName:    model.NewPointer("team-display-name"),
		ChannelId:          model.NewPointer("channel-id"),
		ChannelName:        model.NewPointer("channel-name"),
		ChannelDisplayName: model.NewPointer("channel-display-name"),
		PostCreateAt:       model.NewPointer(int64(1)),
		PostUpdateAt:       model.NewPointer(int64(1)),
		PostMessage:        model.NewPointer("message"),
		UserEmail:          model.NewPointer("test@test.com"),
		UserId:             model.NewPointer("user-id"),
		Username:           model.NewPointer("username"),
		ChannelType:        &chanTypeDirect,
		PostType:           model.NewPointer("other"),
	}

	post_with_other_type_bot := model.MessageExport{
		PostId:             model.NewPointer("post-id"),
		PostOriginalId:     model.NewPointer(""),
		PostRootId:         model.NewPointer("post-root-id"),
		TeamId:             model.NewPointer("team-id"),
		TeamName:           model.NewPointer("team-name"),
		TeamDisplayName:    model.NewPointer("team-display-name"),
		ChannelId:          model.NewPointer("channel-id"),
		ChannelName:        model.NewPointer("channel-name"),
		ChannelDisplayName: model.NewPointer("channel-display-name"),
		PostCreateAt:       model.NewPointer(int64(1)),
		PostUpdateAt:       model.NewPointer(int64(1)),
		PostMessage:        model.NewPointer("message"),
		UserEmail:          model.NewPointer("test@test.com"),
		UserId:             model.NewPointer("user-id"),
		Username:           model.NewPointer("username"),
		ChannelType:        &chanTypeDirect,
		PostType:           model.NewPointer("other"),
		IsBot:              true,
	}

	post_with_permalink_preview := model.MessageExport{
		PostId:             model.NewPointer("post-id"),
		PostOriginalId:     model.NewPointer(""),
		PostRootId:         model.NewPointer("post-root-id"),
		TeamId:             model.NewPointer("team-id"),
		TeamName:           model.NewPointer("team-name"),
		TeamDisplayName:    model.NewPointer("team-display-name"),
		ChannelId:          model.NewPointer("channel-id"),
		ChannelName:        model.NewPointer("channel-name"),
		ChannelDisplayName: model.NewPointer("channel-display-name"),
		PostCreateAt:       model.NewPointer(int64(1)),
		PostUpdateAt:       model.NewPointer(int64(1)),
		PostMessage:        model.NewPointer("message"),
		UserEmail:          model.NewPointer("test@test.com"),
		UserId:             model.NewPointer("user-id"),
		Username:           model.NewPointer("username"),
		ChannelType:        &chanTypeDirect,
		PostProps:          model.NewPointer(`{"previewed_post":"n4w39mc1ff8y5fite4b8hacy1w"}`),
	}
	torowtests := []struct {
		name string
		in   model.MessageExport
		out  Row
	}{
		{
			"simple row",
			post,
			Row{1, 1, "", "team-id", "team-name", "team-display-name", "channel-id", "channel-name", "channel-display-name", "direct", "user-id", "test@test.com", "username", "post-id", "", "post-root-id", "message", "message", "user", ""},
		},
		{
			"without team data",
			post_without_team,
			Row{1, 1, "", "", "", "", "channel-id", "channel-name", "channel-display-name", "direct", "user-id", "test@test.com", "username", "post-id", "", "post-root-id", "message", "message", "user", ""},
		},
		{
			"with special post type",
			post_with_other_type,
			Row{1, 1, "", "team-id", "team-name", "team-display-name", "channel-id", "channel-name", "channel-display-name", "direct", "user-id", "test@test.com", "username", "post-id", "", "post-root-id", "message", "other", "user", ""},
		},
		{
			"with special post type from bot",
			post_with_other_type_bot,
			Row{1, 1, "", "team-id", "team-name", "team-display-name", "channel-id", "channel-name", "channel-display-name", "direct", "user-id", "test@test.com", "username", "post-id", "", "post-root-id", "message", "other", "bot", ""},
		},
		{
			"with permalink preview",
			post_with_permalink_preview,
			Row{1, 1, "", "team-id", "team-name", "team-display-name", "channel-id", "channel-name", "channel-display-name", "direct", "user-id", "test@test.com", "username", "post-id", "", "post-root-id", "message", "message", "user", "n4w39mc1ff8y5fite4b8hacy1w"},
		},
	}

	for _, tt := range torowtests {
		t.Run(tt.name, func(t *testing.T) {
			postType := model.SafeDereference(tt.in.PostType)
			if postType == "" {
				postType = "message"
			}
			in := shared.PostExport{
				MessageExport: tt.in,
			}
			assert.Equal(t, tt.out, postToRow(in, postType, tt.in.PostCreateAt, *tt.in.PostMessage))
		})
	}
}

func TestAttachmentToRow(t *testing.T) {
	chanTypeDirect := model.ChannelTypeDirect
	post := shared.PostExport{
		MessageExport: model.MessageExport{
			PostId:             model.NewPointer("post-id"),
			PostOriginalId:     model.NewPointer(""),
			PostRootId:         model.NewPointer("post-root-id"),
			TeamId:             model.NewPointer("team-id"),
			TeamName:           model.NewPointer("team-name"),
			TeamDisplayName:    model.NewPointer("team-display-name"),
			ChannelId:          model.NewPointer("channel-id"),
			ChannelName:        model.NewPointer("channel-name"),
			ChannelDisplayName: model.NewPointer("channel-display-name"),
			PostCreateAt:       model.NewPointer(int64(1)),
			PostUpdateAt:       model.NewPointer(int64(1)),
			PostMessage:        model.NewPointer("message"),
			UserEmail:          model.NewPointer("test@test.com"),
			UserId:             model.NewPointer("user-id"),
			Username:           model.NewPointer("username"),
			ChannelType:        &chanTypeDirect,
		},
		FileInfo: &model.FileInfo{
			Name: "test1",
			Id:   "12345",
			Path: "filename.txt",
		},
	}

	postDeleted := shared.PostExport{
		MessageExport: model.MessageExport{
			PostId:             model.NewPointer("post-id"),
			PostOriginalId:     model.NewPointer(""),
			PostRootId:         model.NewPointer("post-root-id"),
			TeamId:             model.NewPointer("team-id"),
			TeamName:           model.NewPointer("team-name"),
			TeamDisplayName:    model.NewPointer("team-display-name"),
			ChannelId:          model.NewPointer("channel-id"),
			ChannelName:        model.NewPointer("channel-name"),
			ChannelDisplayName: model.NewPointer("channel-display-name"),
			PostCreateAt:       model.NewPointer(int64(1)),
			PostUpdateAt:       model.NewPointer(int64(10)),
			PostDeleteAt:       model.NewPointer(int64(10)),
			PostMessage:        model.NewPointer("message"),
			UserEmail:          model.NewPointer("test@test.com"),
			UserId:             model.NewPointer("user-id"),
			Username:           model.NewPointer("username"),
			ChannelType:        &chanTypeDirect,
			PostProps:          model.NewPointer(`{"deleteBy":"user-id"}`),
		},
		UpdatedType: shared.FileDeleted,
		FileInfo: &model.FileInfo{
			Name:     "test2",
			Id:       "12346",
			Path:     "filename.txt",
			DeleteAt: 10,
		},
	}

	toRowTests := []struct {
		name string
		post shared.PostExport
		out  Row
	}{
		{
			"simple attachment",
			post,
			Row{1, 1, "", "team-id", "team-name", "team-display-name", "channel-id", "channel-name", "channel-display-name", "direct", "user-id", "test@test.com", "username", "post-id", "", "post-root-id", "test1 (files/post-id/12345-filename.txt)", "attachment", "user", ""},
		},
		{
			"simple deleted attachment",
			postDeleted,
			Row{1, 10, "FileDeleted", "team-id", "team-name", "team-display-name", "channel-id", "channel-name", "channel-display-name", "direct", "user-id", "test@test.com", "username", "post-id", "", "post-root-id", "test2 (files/post-id/12346-filename.txt)", "deleted attachment", "user", ""},
		},
	}

	for _, tt := range toRowTests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.out, attachmentToRow(tt.post))
		})
	}
}

func TestGetPostAttachments(t *testing.T) {
	chanTypeDirect := model.ChannelTypeDirect
	post := &model.MessageExport{
		PostId:             model.NewPointer("post-id"),
		PostOriginalId:     model.NewPointer(""),
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

	files, err := shared.GetPostAttachments(shared.NewMessageExportStore(mockStore), post)
	assert.NoError(t, err)
	assert.Empty(t, files)

	post.PostFileIds = []string{"1", "2"}

	mockStore.FileInfoStore.On("GetForPost", *post.PostId, true, true, false).Return([]*model.FileInfo{{Name: "test"}, {Name: "test2"}}, nil)

	files, err = shared.GetPostAttachments(shared.NewMessageExportStore(mockStore), post)
	assert.NoError(t, err)
	assert.Len(t, files, 2)

	post.PostId = model.NewPointer("post-id-2")

	mockStore.FileInfoStore.On("GetForPost", *post.PostId, true, true, false).Return(nil, model.NewAppError("Test", "test", nil, "", 400))

	files, err = shared.GetPostAttachments(shared.NewMessageExportStore(mockStore), post)
	assert.Error(t, err)
	assert.Nil(t, files)
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

	header := "Post Creation Time,Post Update Time,Post Update Type,Team Id,Team Name,Team Display Name,Channel Id,Channel Name,Channel Display Name,Channel Type,User Id,User Email,Username,Post Id,Edited By Post Id,Replied to Post Id,Post Message,Post Type,User Type,Previews Post Id\n"

	chanTypeDirect := model.ChannelTypeDirect
	csvExportTests := []struct {
		name             string
		cmhs             map[string][]*model.ChannelMemberHistoryResult
		metadata         map[string]*shared.MetadataChannel
		startTime        int64
		endTime          int64
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
			expectedMetadata: "{\n  \"Channels\": null,\n  \"MessagesCount\": 0,\n  \"AttachmentsCount\": 0,\n  \"StartTime\": 0,\n  \"EndTime\": 0\n}",
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
			metadata: map[string]*shared.MetadataChannel{
				"channel-id": {
					TeamId:             model.NewPointer("team-id"),
					TeamName:           model.NewPointer("team-name"),
					TeamDisplayName:    model.NewPointer("team-display-name"),
					ChannelId:          "channel-id",
					ChannelName:        "channel-name",
					ChannelDisplayName: "channel-display-name",
					ChannelType:        chanTypeDirect,
					RoomId:             "direct - channel-id",
					StartTime:          1,
					EndTime:            100,
				},
			},
			startTime: 1,
			endTime:   100,
			posts: []*model.MessageExport{
				{
					PostId:             model.NewPointer("post-id"),
					PostOriginalId:     model.NewPointer(""),
					TeamId:             model.NewPointer("team-id"),
					TeamName:           model.NewPointer("team-name"),
					TeamDisplayName:    model.NewPointer("team-display-name"),
					ChannelId:          model.NewPointer("channel-id"),
					ChannelName:        model.NewPointer("channel-name"),
					ChannelDisplayName: model.NewPointer("channel-display-name"),
					PostCreateAt:       model.NewPointer(int64(1)),
					PostUpdateAt:       model.NewPointer(int64(1)),
					PostMessage:        model.NewPointer("message"),
					UserEmail:          model.NewPointer("test@test.com"),
					UserId:             model.NewPointer("user-id"),
					Username:           model.NewPointer("username"),
					ChannelType:        &chanTypeDirect,
					PostFileIds:        []string{},
				},
				{
					PostId:             model.NewPointer("post-id"),
					PostOriginalId:     model.NewPointer(""),
					PostRootId:         model.NewPointer("post-root-id"),
					TeamId:             model.NewPointer("team-id"),
					TeamName:           model.NewPointer("team-name"),
					TeamDisplayName:    model.NewPointer("team-display-name"),
					ChannelId:          model.NewPointer("channel-id"),
					ChannelName:        model.NewPointer("channel-name"),
					ChannelDisplayName: model.NewPointer("channel-display-name"),
					PostCreateAt:       model.NewPointer(int64(100)),
					PostUpdateAt:       model.NewPointer(int64(100)),
					PostMessage:        model.NewPointer("message"),
					UserEmail:          model.NewPointer("test@test.com"),
					UserId:             model.NewPointer("user-id"),
					Username:           model.NewPointer("username"),
					ChannelType:        &chanTypeDirect,
					PostFileIds:        []string{},
				},
				{
					PostId:             model.NewPointer("post-id"),
					PostOriginalId:     model.NewPointer(""),
					PostRootId:         model.NewPointer("post-root-id"),
					TeamId:             model.NewPointer("team-id"),
					TeamName:           model.NewPointer("team-name"),
					TeamDisplayName:    model.NewPointer("team-display-name"),
					ChannelId:          model.NewPointer("channel-id"),
					ChannelName:        model.NewPointer("channel-name"),
					ChannelDisplayName: model.NewPointer("channel-display-name"),
					PostCreateAt:       model.NewPointer(int64(100)),
					PostUpdateAt:       model.NewPointer(int64(100)),
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
				"0,0,,team-id,team-name,team-display-name,channel-id,channel-name,channel-display-name,direct,test,test,test,,,,User test (test) was already in the channel,previously-joined,user,\n",
				"1,0,,team-id,team-name,team-display-name,channel-id,channel-name,channel-display-name,direct,user-id,test@test.com,username,,,,User username (test@test.com) was already in the channel,previously-joined,user,\n",
				"1,1,,team-id,team-name,team-display-name,channel-id,channel-name,channel-display-name,direct,user-id,test@test.com,username,post-id,,,message,message,user,\n",
				"8,0,,team-id,team-name,team-display-name,channel-id,channel-name,channel-display-name,direct,test2,test2,test2,,,,User test2 (test2) joined the channel,enter,user,\n",
				"80,0,,team-id,team-name,team-display-name,channel-id,channel-name,channel-display-name,direct,test2,test2,test2,,,,User test2 (test2) left the channel,leave,user,\n",
				"100,100,,team-id,team-name,team-display-name,channel-id,channel-name,channel-display-name,direct,user-id,test@test.com,username,post-id,,post-root-id,message,message,user,\n",
				"100,100,,team-id,team-name,team-display-name,channel-id,channel-name,channel-display-name,direct,user-id,test@test.com,username,post-id,,post-root-id,message,message,user,o4w39mc1ff8y5fite4b8hacy1x\n",
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
			metadata: map[string]*shared.MetadataChannel{
				"channel-id": {
					TeamId:             model.NewPointer("team-id"),
					TeamName:           model.NewPointer("team-name"),
					TeamDisplayName:    model.NewPointer("team-display-name"),
					ChannelId:          "channel-id",
					ChannelName:        "channel-name",
					ChannelDisplayName: "channel-display-name",
					ChannelType:        chanTypeDirect,
					RoomId:             "direct - channel-id",
					StartTime:          1,
					EndTime:            100,
				},
			},
			startTime: 1,
			endTime:   100,
			posts: []*model.MessageExport{
				{
					PostId:             model.NewPointer("post-id"),
					PostOriginalId:     model.NewPointer(""),
					TeamId:             model.NewPointer("team-id"),
					TeamName:           model.NewPointer("team-name"),
					TeamDisplayName:    model.NewPointer("team-display-name"),
					ChannelId:          model.NewPointer("channel-id"),
					ChannelName:        model.NewPointer("channel-name"),
					ChannelDisplayName: model.NewPointer("channel-display-name"),
					PostUpdateAt:       model.NewPointer(int64(1)),
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
					PostOriginalId:     model.NewPointer(""),
					TeamId:             model.NewPointer("team-id"),
					TeamName:           model.NewPointer("team-name"),
					TeamDisplayName:    model.NewPointer("team-display-name"),
					ChannelId:          model.NewPointer("channel-id"),
					ChannelName:        model.NewPointer("channel-name"),
					ChannelDisplayName: model.NewPointer("channel-display-name"),
					PostCreateAt:       model.NewPointer(int64(100)),
					PostUpdateAt:       model.NewPointer(int64(101)),
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
				"0,0,,team-id,team-name,team-display-name,channel-id,channel-name,channel-display-name,direct,test,test,test,,,,User test (test) was already in the channel,previously-joined,user,\n",
				"1,0,,team-id,team-name,team-display-name,channel-id,channel-name,channel-display-name,direct,user-id,test@test.com,username,,,,User username (test@test.com) was already in the channel,previously-joined,user,\n",
				"1,1,,team-id,team-name,team-display-name,channel-id,channel-name,channel-display-name,direct,user-id,test@test.com,username,post-id,,,message,message,user,\n",
				"100,101,,team-id,team-name,team-display-name,channel-id,channel-name,channel-display-name,direct,user-id,test@test.com,username,post-id,,,message,message,user,\n",
				"100,101,Deleted,team-id,team-name,team-display-name,channel-id,channel-name,channel-display-name,direct,user-id,test@test.com,username,post-id,,,delete message,message,user,\n",
			}, ""),
			expectedMetadata: "{\n  \"Channels\": {\n    \"channel-id\": {\n      \"TeamId\": \"team-id\",\n      \"TeamName\": \"team-name\",\n      \"TeamDisplayName\": \"team-display-name\",\n      \"ChannelId\": \"channel-id\",\n      \"ChannelName\": \"channel-name\",\n      \"ChannelDisplayName\": \"channel-display-name\",\n      \"ChannelType\": \"D\",\n      \"RoomId\": \"direct - channel-id\",\n      \"StartTime\": 1,\n      \"EndTime\": 100,\n      \"MessagesCount\": 3,\n      \"AttachmentsCount\": 0\n    }\n  },\n  \"MessagesCount\": 3,\n  \"AttachmentsCount\": 0,\n  \"StartTime\": 1,\n  \"EndTime\": 100\n}",
			expectedFiles:    2,
		},

		{
			name: "posts with deleted attachment and deleted post, and at different time from non-deleted original post",
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
			metadata: map[string]*shared.MetadataChannel{
				"channel-id": {
					TeamId:             model.NewPointer("team-id"),
					TeamName:           model.NewPointer("team-name"),
					TeamDisplayName:    model.NewPointer("team-display-name"),
					ChannelId:          "channel-id",
					ChannelName:        "channel-name",
					ChannelDisplayName: "channel-display-name",
					ChannelType:        chanTypeDirect,
					RoomId:             "direct - channel-id",
					StartTime:          1,
					EndTime:            100,
				},
			},
			startTime: 1,
			endTime:   100,
			posts: []*model.MessageExport{
				{
					PostId:             model.NewPointer("post-id-1"),
					PostOriginalId:     model.NewPointer(""),
					TeamId:             model.NewPointer("team-id"),
					TeamName:           model.NewPointer("team-name"),
					TeamDisplayName:    model.NewPointer("team-display-name"),
					ChannelId:          model.NewPointer("channel-id"),
					ChannelName:        model.NewPointer("channel-name"),
					ChannelDisplayName: model.NewPointer("channel-display-name"),
					PostUpdateAt:       model.NewPointer(int64(1)),
					PostCreateAt:       model.NewPointer(int64(1)),
					PostMessage:        model.NewPointer("message 1"),
					UserEmail:          model.NewPointer("test@test.com"),
					UserId:             model.NewPointer("user-id"),
					Username:           model.NewPointer("username"),
					ChannelType:        &chanTypeDirect,
					PostFileIds:        []string{"test1"},
				},
				{
					PostId:             model.NewPointer("post-id-3"),
					PostOriginalId:     model.NewPointer(""),
					TeamId:             model.NewPointer("team-id"),
					TeamName:           model.NewPointer("team-name"),
					TeamDisplayName:    model.NewPointer("team-display-name"),
					ChannelId:          model.NewPointer("channel-id"),
					ChannelName:        model.NewPointer("channel-name"),
					ChannelDisplayName: model.NewPointer("channel-display-name"),
					PostCreateAt:       model.NewPointer(int64(2)),
					PostUpdateAt:       model.NewPointer(int64(3)),
					PostDeleteAt:       model.NewPointer(int64(3)),
					PostMessage:        model.NewPointer("message 3"),
					UserEmail:          model.NewPointer("test@test.com"),
					UserId:             model.NewPointer("user-id"),
					Username:           model.NewPointer("username"),
					ChannelType:        &chanTypeDirect,
					PostFileIds:        []string{"test2"},
					PostProps:          model.NewPointer("{\"deleteBy\":\"user-id\"}"),
				},
				{
					PostId:             model.NewPointer("post-id-2"),
					PostOriginalId:     model.NewPointer(""),
					PostRootId:         model.NewPointer("post-id-1"),
					TeamId:             model.NewPointer("team-id"),
					TeamName:           model.NewPointer("team-name"),
					TeamDisplayName:    model.NewPointer("team-display-name"),
					ChannelId:          model.NewPointer("channel-id"),
					ChannelName:        model.NewPointer("channel-name"),
					ChannelDisplayName: model.NewPointer("channel-display-name"),
					PostUpdateAt:       model.NewPointer(int64(100)),
					PostCreateAt:       model.NewPointer(int64(100)),
					PostMessage:        model.NewPointer("message 2"),
					UserEmail:          model.NewPointer("test@test.com"),
					UserId:             model.NewPointer("user-id"),
					Username:           model.NewPointer("username"),
					ChannelType:        &chanTypeDirect,
					// NOTE: this post will be deleted, but the post-id-2 is not deleted.
					PostFileIds: []string{"test3"},
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
				"post-id-2": {
					{
						Name:     "test3",
						Id:       "test3",
						Path:     "test3",
						DeleteAt: 102,
					},
				},
			},
			expectedPosts: strings.Join([]string{
				header,
				"0,0,,team-id,team-name,team-display-name,channel-id,channel-name,channel-display-name,direct,test,test,test,,,,User test (test) was already in the channel,previously-joined,user,\n",
				"1,0,,team-id,team-name,team-display-name,channel-id,channel-name,channel-display-name,direct,user-id,test@test.com,username,,,,User username (test@test.com) was already in the channel,previously-joined,user,\n",
				"1,1,,team-id,team-name,team-display-name,channel-id,channel-name,channel-display-name,direct,user-id,test@test.com,username,post-id-1,,,message 1,message,user,\n",
				"1,1,,team-id,team-name,team-display-name,channel-id,channel-name,channel-display-name,direct,user-id,test@test.com,username,post-id-1,,,test1 (files/post-id-1/test1-test1),attachment,user,\n",
				"2,3,,team-id,team-name,team-display-name,channel-id,channel-name,channel-display-name,direct,user-id,test@test.com,username,post-id-3,,,message 3,message,user,\n",
				"2,3,Deleted,team-id,team-name,team-display-name,channel-id,channel-name,channel-display-name,direct,user-id,test@test.com,username,post-id-3,,,delete message 3,message,user,\n",
				"2,3,,team-id,team-name,team-display-name,channel-id,channel-name,channel-display-name,direct,user-id,test@test.com,username,post-id-3,,,test2 (files/post-id-3/test2-test2),attachment,user,\n",
				"2,3,FileDeleted,team-id,team-name,team-display-name,channel-id,channel-name,channel-display-name,direct,user-id,test@test.com,username,post-id-3,,,test2 (files/post-id-3/test2-test2),deleted attachment,user,\n",
				"8,0,,team-id,team-name,team-display-name,channel-id,channel-name,channel-display-name,direct,test2,test2,test2,,,,User test2 (test2) joined the channel,enter,user,\n",
				"80,0,,team-id,team-name,team-display-name,channel-id,channel-name,channel-display-name,direct,test2,test2,test2,,,,User test2 (test2) left the channel,leave,user,\n",
				"100,100,,team-id,team-name,team-display-name,channel-id,channel-name,channel-display-name,direct,user-id,test@test.com,username,post-id-2,,post-id-1,message 2,message,user,\n",
				"100,100,,team-id,team-name,team-display-name,channel-id,channel-name,channel-display-name,direct,user-id,test@test.com,username,post-id-2,,post-id-1,test3 (files/post-id-2/test3-test3),attachment,user,\n",
				"100,102,FileDeleted,team-id,team-name,team-display-name,channel-id,channel-name,channel-display-name,direct,user-id,test@test.com,username,post-id-2,,post-id-1,test3 (files/post-id-2/test3-test3),deleted attachment,user,\n",
			}, ""),
			expectedMetadata: "{\n  \"Channels\": {\n    \"channel-id\": {\n      \"TeamId\": \"team-id\",\n      \"TeamName\": \"team-name\",\n      \"TeamDisplayName\": \"team-display-name\",\n      \"ChannelId\": \"channel-id\",\n      \"ChannelName\": \"channel-name\",\n      \"ChannelDisplayName\": \"channel-display-name\",\n      \"ChannelType\": \"D\",\n      \"RoomId\": \"direct - channel-id\",\n      \"StartTime\": 1,\n      \"EndTime\": 100,\n      \"MessagesCount\": 4,\n      \"AttachmentsCount\": 3\n    }\n  },\n  \"MessagesCount\": 4,\n  \"AttachmentsCount\": 3,\n  \"StartTime\": 1,\n  \"EndTime\": 100\n}",
			expectedFiles:    5,
		},
	}

	for _, tt := range csvExportTests {
		t.Run(tt.name, func(t *testing.T) {
			mockStore := &storetest.Store{}
			defer mockStore.AssertExpectations(t)

			if len(tt.attachments) > 0 {
				for postId, attachments := range tt.attachments {
					call := mockStore.FileInfoStore.On("GetForPost", postId, true, true, false)
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

			exportFileName := path.Join("export", "jobName", "jobName-batch001-csv.zip")
			results, err := CsvExport(rctx, shared.ExportParams{
				ChannelMetadata:        tt.metadata,
				Posts:                  tt.posts,
				ChannelMemberHistories: tt.cmhs,
				BatchPath:              exportFileName,
				BatchStartTime:         tt.startTime,
				BatchEndTime:           tt.endTime,
				Config:                 nil,
				Db:                     shared.NewMessageExportStore(mockStore),
				FileAttachmentBackend:  attachmentBackend,
				ExportBackend:          exportBackend,
			})
			assert.NoError(t, err)
			assert.Equal(t, 0, results.NumWarnings)

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
	metadata := map[string]*shared.MetadataChannel{
		"channel-id": {
			TeamId:             model.NewPointer("team-id"),
			TeamName:           model.NewPointer("team-name"),
			TeamDisplayName:    model.NewPointer("team-display-name"),
			ChannelId:          "channel-id",
			ChannelName:        "channel-name",
			ChannelDisplayName: "channel-display-name",
			ChannelType:        chanTypeDirect,
			RoomId:             "direct - channel-id",
			StartTime:          1,
			EndTime:            100,
		},
	}

	posts := []*model.MessageExport{
		{
			PostId:             model.NewPointer("post-id-1"),
			PostOriginalId:     model.NewPointer(""),
			TeamId:             model.NewPointer("team-id"),
			TeamName:           model.NewPointer("team-name"),
			TeamDisplayName:    model.NewPointer("team-display-name"),
			ChannelId:          model.NewPointer("channel-id"),
			ChannelName:        model.NewPointer("channel-name"),
			ChannelDisplayName: model.NewPointer("channel-display-name"),
			PostUpdateAt:       model.NewPointer(int64(1)),
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
			PostOriginalId:     model.NewPointer(""),
			TeamId:             model.NewPointer("team-id"),
			TeamName:           model.NewPointer("team-name"),
			TeamDisplayName:    model.NewPointer("team-display-name"),
			ChannelId:          model.NewPointer("channel-id"),
			ChannelName:        model.NewPointer("channel-name"),
			ChannelDisplayName: model.NewPointer("channel-display-name"),
			PostCreateAt:       model.NewPointer(int64(2)),
			PostUpdateAt:       model.NewPointer(int64(3)),
			PostDeleteAt:       model.NewPointer(int64(3)),
			PostMessage:        model.NewPointer("message"),
			UserEmail:          model.NewPointer("test@test.com"),
			UserId:             model.NewPointer("user-id"),
			Username:           model.NewPointer("username"),
			ChannelType:        &chanTypeDirect,
			PostFileIds:        []string{"post-id-3"},
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

	for postId := range attachments {
		call := mockStore.FileInfoStore.On("GetForPost", postId, true, true, false).Times(2)
		call.Run(func(args mock.Arguments) {
			call.Return(attachments[args.Get(0).(string)], nil)
		})
	}

	exportFileName := path.Join("export", "jobName", "jobName-batch001-csv.zip")
	results, err := CsvExport(rctx, shared.ExportParams{
		ExportType:             "",
		ChannelMetadata:        metadata,
		Posts:                  posts,
		ChannelMemberHistories: cmhs,
		BatchPath:              exportFileName,
		BatchStartTime:         1,
		BatchEndTime:           100,
		Config:                 nil,
		Db:                     shared.NewMessageExportStore(mockStore),
		FileAttachmentBackend:  fileBackend,
		ExportBackend:          fileBackend,
	})
	assert.NoError(t, err)
	assert.Equal(t, 2, results.NumWarnings)

	zipBytes, err := fileBackend.ReadFile(exportFileName)
	assert.NoError(t, err)

	t.Cleanup(func() {
		err = fileBackend.RemoveFile(exportFileName)
		assert.NoError(t, err)
	})

	zipReader, err := zip.NewReader(bytes.NewReader(zipBytes), int64(len(zipBytes)))
	assert.NoError(t, err)
	assert.Len(t, zipReader.File, 3)
	warningsTxt, err := zipReader.Open("warning.txt")
	assert.NoError(t, err)
	data, err := io.ReadAll(warningsTxt)
	assert.NoError(t, err)
	warnings := string(data)

	expectedWarnings := fmt.Sprintf("Warning:%[1]s - Post: post-id-1 - test1\nWarning:%[1]s - Post: post-id-3 - test2\n",
		shared.MissingFileMessageDuringBackendRead)

	assert.Equal(t, expectedWarnings, warnings)
}
