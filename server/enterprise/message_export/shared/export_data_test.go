// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package shared

import (
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/api4"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"
)

func postToMessageExport(t *testing.T, p *model.Post, u *model.User, c *model.Channel, team *model.Team) model.MessageExport {
	t.Helper()
	props, err := json.Marshal(p.GetProps())
	assert.NoError(t, err)

	return model.MessageExport{
		TeamId:             &team.Id,
		TeamName:           &team.Name,
		TeamDisplayName:    &team.DisplayName,
		ChannelId:          &c.Id,
		ChannelName:        &c.Name,
		ChannelDisplayName: &c.DisplayName,
		ChannelType:        &c.Type,
		UserId:             &u.Id,
		UserEmail:          model.NewPointer(u.Email),
		Username:           &u.Username,
		IsBot:              false,
		PostId:             model.NewPointer(p.Id),
		PostCreateAt:       model.NewPointer(p.CreateAt),
		PostUpdateAt:       &p.UpdateAt,
		PostDeleteAt:       &p.DeleteAt,
		PostEditAt:         &p.EditAt,
		PostMessage:        &p.Message,
		PostType:           &p.Type,
		PostRootId:         &p.RootId,
		PostProps:          model.NewPointer(string(props)),
		PostOriginalId:     &p.OriginalId,
		PostFileIds:        p.FileIds,
	}
}

func Test_getPostExport(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping test in short mode.")
	}

	jobs.DefaultWatcherPollingInterval = 100
	th := api4.SetupEnterprise(t).InitBasic()
	th.App.Srv().SetLicense(model.NewTestLicense("message_export"))
	defer th.TearDown()

	// the post exports from the db will be random (because they all have the same updateAt), so do it a few times
	for i := 0; i < 10; i++ {
		time.Sleep(time.Millisecond)
		start := model.GetMillis()

		count, err := th.App.Srv().Store().Post().AnalyticsPostCount(&model.PostCountOptions{ExcludeSystemPosts: true, SincePostID: "", SinceUpdateAt: start})
		require.NoError(t, err)
		require.Equal(t, 0, int(count))

		var posts []*model.Post

		// 0 - post edited with 3 simultaneous posts in-between - forward
		// original post with edited message
		originalPost, err := th.App.Srv().Store().Post().Save(th.Context, &model.Post{
			ChannelId: th.BasicChannel.Id,
			UserId:    th.BasicUser.Id,
			Message:   "message 0",
		})
		require.NoError(t, err)
		require.NotEqual(t, 0, originalPost.UpdateAt, "originalPost's updateAt was zero, test 1")
		posts = append(posts, originalPost)

		// If we don't sleep, the two messages might not have different CreateAt and UpdateAts
		time.Sleep(time.Millisecond)

		// 1 - edited post
		post, err := th.App.Srv().Store().Post().Update(th.Context, &model.Post{
			Id:        originalPost.Id,
			CreateAt:  originalPost.CreateAt,
			EditAt:    model.GetMillis(),
			ChannelId: th.BasicChannel.Id,
			UserId:    th.BasicUser.Id,
			Message:   "edited message 0",
		}, originalPost)
		require.NoError(t, err)
		require.NotEqual(t, 0, originalPost.UpdateAt, "originalPost's updateAt was zero, test 2")
		require.NotEqual(t, 0, post.UpdateAt, "edited post's updateAt was zero, test 2")
		posts = append(posts, post)

		simultaneous := post.UpdateAt

		// Add 8 other posts at the same updateAt
		for j := 1; j <= 8; j++ {
			// 2 - post 1 at same updateAt
			post, err = th.App.Srv().Store().Post().Save(th.Context, &model.Post{
				ChannelId: th.BasicChannel.Id,
				UserId:    th.BasicUser.Id,
				Message:   fmt.Sprintf("message %d", j),
				CreateAt:  simultaneous,
			})
			require.NoError(t, err)
			require.NotEqual(t, 0, post.UpdateAt)
			posts = append(posts, post)
		}

		// Use the config fallback for simplicity
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.MessageExportSettings.EnableExport = true
			*cfg.MessageExportSettings.ExportFromTimestamp = start
			*cfg.MessageExportSettings.BatchSize = 10
		})

		// the messages can be in any order because all have equal `updateAt`s
		expectedExports := []PostExport{
			{
				MessageExport:  postToMessageExport(t, posts[0], th.BasicUser, th.BasicChannel, th.BasicTeam),
				UserType:       "user",
				Message:        posts[0].Message,
				UpdateAt:       posts[1].UpdateAt, // the edit update at
				UpdatedType:    EditedOriginalMsg,
				EditedNewMsgId: posts[1].Id,
			},
			{
				MessageExport: postToMessageExport(t, posts[1], th.BasicUser, th.BasicChannel, th.BasicTeam),
				UserType:      "user",
				Message:       posts[1].Message,
				UpdateAt:      posts[1].UpdateAt,
				UpdatedType:   EditedNewMsg,
			},
		}

		for j := 2; j < 10; j++ {
			expectedExports = append(expectedExports, PostExport{
				MessageExport: postToMessageExport(t, posts[j], th.BasicUser, th.BasicChannel, th.BasicTeam),
				UserType:      "user",
				Message:       posts[j].Message,
			})
		}

		actualMessageExports, _, err := th.App.Srv().Store().Compliance().MessageExport(th.Context, model.MessageExportCursor{
			LastPostUpdateAt: start,
			UntilUpdateAt:    model.GetMillis(),
		}, 10)
		require.NoError(t, err)
		require.Len(t, actualMessageExports, 10)
		for _, export := range actualMessageExports {
			require.NotEqual(t, 0, *export.PostUpdateAt)
		}
		results := RunExportResults{}
		var actualExports []PostExport

		for _, m := range actualMessageExports {
			var postExport PostExport
			postExport, results = getPostExport(m, results)
			actualExports = append(actualExports, postExport)
		}

		require.ElementsMatch(t, expectedExports, actualExports, fmt.Sprintf("batch %d", i))
	}
}

func TestPostToAttachmentsEntries(t *testing.T) {
	chanTypeDirect := model.ChannelTypeDirect
	tt := []struct {
		name                       string
		post                       model.MessageExport
		attachments                []*model.FileInfo
		expectedStarts             []*FileUploadStartExport
		expectedStops              []*FileUploadStopExport
		expectedFileInfos          []*model.FileInfo
		expectedDeleteFileMessages []PostExport
		ignoreDeleted              bool
		expectError                bool
	}{
		{
			name: "no-attachments",
			post: model.MessageExport{
				ChannelId:          model.NewPointer("Test"),
				ChannelDisplayName: model.NewPointer("Test"),
				PostCreateAt:       model.NewPointer(int64(1)),
				PostMessage:        model.NewPointer("Some message"),
				UserEmail:          model.NewPointer("test@test.com"),
				UserId:             model.NewPointer("test"),
				Username:           model.NewPointer("test"),
				ChannelType:        &chanTypeDirect,
			},
			attachments:                nil,
			expectedStarts:             nil,
			expectedStops:              nil,
			expectedFileInfos:          nil,
			expectedDeleteFileMessages: nil,
			expectError:                false,
		},
		{
			name: "one-attachment",
			post: model.MessageExport{
				PostId:             model.NewPointer("test"),
				ChannelId:          model.NewPointer("Test"),
				ChannelDisplayName: model.NewPointer("Test"),
				PostCreateAt:       model.NewPointer(int64(1)),
				PostMessage:        model.NewPointer("Some message"),
				UserEmail:          model.NewPointer("test@test.com"),
				UserId:             model.NewPointer("test"),
				Username:           model.NewPointer("test"),
				ChannelType:        &chanTypeDirect,
				PostFileIds:        []string{"12345"},
			},
			attachments: []*model.FileInfo{
				{Name: "test", Id: "12345", Path: "filename.txt"},
			},
			expectedStarts: []*FileUploadStartExport{
				{UserEmail: "test@test.com", UploadStartTime: 1,
					FileInfo: &model.FileInfo{Id: "12345", Name: "test", Path: "filename.txt"}},
			},
			expectedStops: []*FileUploadStopExport{
				{UserEmail: "test@test.com", UploadStopTime: 1,
					FileInfo: &model.FileInfo{Id: "12345", Name: "test", Path: "filename.txt"}, Status: "Completed"},
			},
			expectedFileInfos: []*model.FileInfo{
				{Name: "test", Id: "12345", Path: "filename.txt"},
			},
			expectedDeleteFileMessages: nil,
			expectError:                false,
		},
		{
			name: "two-attachment",
			post: model.MessageExport{
				PostId:             model.NewPointer("test"),
				ChannelId:          model.NewPointer("Test"),
				ChannelDisplayName: model.NewPointer("Test"),
				PostCreateAt:       model.NewPointer(int64(1)),
				PostMessage:        model.NewPointer("Some message"),
				UserEmail:          model.NewPointer("test@test.com"),
				UserId:             model.NewPointer("test"),
				Username:           model.NewPointer("test"),
				ChannelType:        &chanTypeDirect,
				PostFileIds:        []string{"12345", "54321"},
			},
			attachments: []*model.FileInfo{
				{Name: "test", Id: "12345", Path: "filename.txt"},
				{Name: "test2", Id: "54321", Path: "filename2.txt"},
			},
			expectedStarts: []*FileUploadStartExport{
				{UserEmail: "test@test.com", UploadStartTime: 1,
					FileInfo: &model.FileInfo{Id: "12345", Name: "test", Path: "filename.txt"}},
				{UserEmail: "test@test.com", UploadStartTime: 1,
					FileInfo: &model.FileInfo{Id: "54321", Name: "test2", Path: "filename2.txt"}},
			},
			expectedStops: []*FileUploadStopExport{
				{UserEmail: "test@test.com", UploadStopTime: 1,
					FileInfo: &model.FileInfo{Id: "12345", Name: "test", Path: "filename.txt"}, Status: "Completed"},
				{UserEmail: "test@test.com", UploadStopTime: 1,
					FileInfo: &model.FileInfo{Id: "54321", Name: "test2", Path: "filename2.txt"}, Status: "Completed"},
			},
			expectedFileInfos: []*model.FileInfo{
				{Name: "test", Id: "12345", Path: "filename.txt"},
				{Name: "test2", Id: "54321", Path: "filename2.txt"},
			},
			expectedDeleteFileMessages: nil,
			expectError:                false,
		},
		{
			name: "one-attachment-deleted",
			post: model.MessageExport{
				PostId:             model.NewPointer("test"),
				ChannelId:          model.NewPointer("Test"),
				ChannelDisplayName: model.NewPointer("Test"),
				PostCreateAt:       model.NewPointer(int64(1)),
				PostDeleteAt:       model.NewPointer(int64(2)),
				PostMessage:        model.NewPointer("Some message"),
				UserEmail:          model.NewPointer("test@test.com"),
				UserId:             model.NewPointer("test"),
				Username:           model.NewPointer("test"),
				ChannelType:        &chanTypeDirect,
				PostFileIds:        []string{"12345", "54321"},
			},
			attachments: []*model.FileInfo{
				{Name: "test", Id: "12345", Path: "filename.txt", DeleteAt: 2},
			},
			expectedStarts: []*FileUploadStartExport{
				{UserEmail: "test@test.com", UploadStartTime: 1,
					FileInfo: &model.FileInfo{Id: "12345", Name: "test", Path: "filename.txt", DeleteAt: 2}},
			},
			expectedStops: []*FileUploadStopExport{
				{UserEmail: "test@test.com", UploadStopTime: 1,
					FileInfo: &model.FileInfo{Id: "12345", Name: "test", Path: "filename.txt", DeleteAt: 2}, Status: "Completed"},
			},
			expectedFileInfos: []*model.FileInfo{
				{Name: "test", Id: "12345", Path: "filename.txt", DeleteAt: 2},
			},
			expectedDeleteFileMessages: []PostExport{
				{
					UserType:    "user",
					UpdatedType: FileDeleted,
					UpdateAt:    2,
					Message:     "delete " + "filename.txt",
					FileInfo:    &model.FileInfo{Id: "12345", Name: "test", Path: "filename.txt", DeleteAt: 2},
				},
			},
			expectError: false,
		},
		{
			name: "one-attachment-deleted, ignore it (only record the creation)",
			post: model.MessageExport{
				PostId:             model.NewPointer("test"),
				ChannelId:          model.NewPointer("Test"),
				ChannelDisplayName: model.NewPointer("Test"),
				PostCreateAt:       model.NewPointer(int64(1)),
				PostDeleteAt:       model.NewPointer(int64(2)),
				PostMessage:        model.NewPointer("Some message"),
				UserEmail:          model.NewPointer("test@test.com"),
				UserId:             model.NewPointer("test"),
				Username:           model.NewPointer("test"),
				ChannelType:        &chanTypeDirect,
				PostFileIds:        []string{"12345", "54321"},
			},
			attachments: []*model.FileInfo{
				{Name: "test", Id: "12345", Path: "filename.txt", DeleteAt: 2},
			},
			expectedStarts: []*FileUploadStartExport{
				{UserEmail: "test@test.com", UploadStartTime: 1,
					FileInfo: &model.FileInfo{Name: "test", Id: "12345", Path: "filename.txt", DeleteAt: 2}},
			},
			expectedStops: []*FileUploadStopExport{
				{UserEmail: "test@test.com", UploadStopTime: 1,
					FileInfo: &model.FileInfo{Name: "test", Id: "12345", Path: "filename.txt", DeleteAt: 2}, Status: "Completed"},
			},
			expectedFileInfos: []*model.FileInfo{
				{Name: "test", Id: "12345", Path: "filename.txt", DeleteAt: 2},
			},
			expectedDeleteFileMessages: nil,
			ignoreDeleted:              true,
			expectError:                false,
		},
	}

	for _, tc := range tt {
		t.Run(tc.name, func(t *testing.T) {
			mockStore := &storetest.Store{}
			defer mockStore.AssertExpectations(t)

			if len(tc.attachments) > 0 {
				call := mockStore.FileInfoStore.On("GetForPost", *tc.post.PostId, true, true, false)
				call.Run(func(args mock.Arguments) {
					call.Return(tc.attachments, nil)
				})
			}
			files, uploadStarts, uploadStops, deleteFileMessages, err := postToAttachmentsEntries(&tc.post, NewMessageExportStore(mockStore), tc.ignoreDeleted)
			if tc.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}

			// Need to add the post to the expected starts (to save from copy pasting in the test cases above)
			for _, s := range tc.expectedStarts {
				s.MessageExport = tc.post
			}

			// Need to add the post to the expected stops
			for _, s := range tc.expectedStops {
				s.MessageExport = tc.post
			}

			// Need to add the post to the expected deleted
			var expectedDeleted []PostExport
			for _, s := range tc.expectedDeleteFileMessages {
				s.MessageExport = tc.post
				expectedDeleted = append(expectedDeleted, s)
			}

			assert.Equal(t, tc.expectedStarts, uploadStarts)
			assert.Equal(t, tc.expectedStops, uploadStops)
			assert.Equal(t, tc.expectedFileInfos, files)
			assert.Equal(t, expectedDeleted, deleteFileMessages)
		})
	}
}

func TestGetJoinLeavePosts(t *testing.T) {
	mockStore := &storetest.Store{}
	defer mockStore.AssertExpectations(t)

	// This would have been retrieved during CalculateChannelExports
	channelMemberHistories := map[string][]*model.ChannelMemberHistoryResult{
		"good-request-1": {
			{JoinTime: 1, UserId: "test1", UserEmail: "test1", Username: "test1"},
			{JoinTime: 2, LeaveTime: model.NewPointer(int64(3)), UserId: "test2", UserEmail: "test2", Username: "test2"},
			{JoinTime: 3, UserId: "test3", UserEmail: "test3", Username: "test3"},
		},
		"good-request-2": {
			{JoinTime: 4, UserId: "test4", UserEmail: "test4", Username: "test4"},
			{JoinTime: 5, LeaveTime: model.NewPointer(int64(6)), UserId: "test5", UserEmail: "test5", Username: "test5"},
			{JoinTime: 6, UserId: "test6", UserEmail: "test6", Username: "test6"},
		},
	}

	var joins []JoinExport
	var leaves []LeaveExport
	for _, id := range []string{"good-request-1", "good-request-2"} {
		newJoins, newLeaves := getJoinsAndLeaves(
			1,
			7,
			channelMemberHistories[id],
			nil,
		)
		joins = append(joins, newJoins...)
		leaves = append(leaves, newLeaves...)
	}

	assert.Len(t, joins, 6)
	assert.Equal(t, JoinExport{
		UserId:    "test1",
		Username:  "test1",
		UserEmail: "test1",
		UserType:  User,
		JoinTime:  1,
		LeaveTime: 7,
	}, joins[0])
	assert.Equal(t, JoinExport{
		UserId:    "test2",
		Username:  "test2",
		UserEmail: "test2",
		UserType:  User,
		JoinTime:  2,
		LeaveTime: 3,
	}, joins[1])
	assert.Equal(t, JoinExport{
		UserId:    "test3",
		Username:  "test3",
		UserEmail: "test3",
		UserType:  User,
		JoinTime:  3,
		LeaveTime: 7,
	}, joins[2])
	assert.Equal(t, JoinExport{
		UserId:    "test4",
		Username:  "test4",
		UserEmail: "test4",
		UserType:  User,
		JoinTime:  4,
		LeaveTime: 7,
	}, joins[3])
	assert.Equal(t, JoinExport{
		UserId:    "test5",
		Username:  "test5",
		UserEmail: "test5",
		UserType:  User,
		JoinTime:  5,
		LeaveTime: 6,
	}, joins[4])
	assert.Equal(t, JoinExport{
		UserId:    "test6",
		Username:  "test6",
		UserEmail: "test6",
		UserType:  User,
		JoinTime:  6,
		LeaveTime: 7,
	}, joins[5])

	// remember that getJoinsAndLeaves sorts _for each channel_
	assert.Len(t, leaves, 6)
	// 1st channel:
	assert.Equal(t, LeaveExport{
		UserId:    "test2",
		Username:  "test2",
		UserEmail: "test2",
		UserType:  User,
		LeaveTime: 3,
	}, leaves[0])
	assert.Equal(t, LeaveExport{
		UserId:    "test1",
		Username:  "test1",
		UserEmail: "test1",
		UserType:  User,
		LeaveTime: 7,
		ClosedOut: true,
	}, leaves[1])
	assert.Equal(t, LeaveExport{
		UserId:    "test3",
		Username:  "test3",
		UserEmail: "test3",
		UserType:  User,
		LeaveTime: 7,
		ClosedOut: true,
	}, leaves[2])
	// 2nd channel:
	assert.Equal(t, LeaveExport{
		UserId:    "test5",
		Username:  "test5",
		UserEmail: "test5",
		UserType:  User,
		LeaveTime: 6,
	}, leaves[3])
	assert.Equal(t, LeaveExport{
		UserId:    "test4",
		Username:  "test4",
		UserEmail: "test4",
		UserType:  User,
		LeaveTime: 7,
		ClosedOut: true,
	}, leaves[4])
	assert.Equal(t, LeaveExport{
		UserId:    "test6",
		Username:  "test6",
		UserEmail: "test6",
		UserType:  User,
		LeaveTime: 7,
		ClosedOut: true,
	}, leaves[5])
}
