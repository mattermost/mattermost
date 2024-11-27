// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package shared

import (
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
				MessageId:      posts[0].Id,
				UserEmail:      th.BasicUser.Email,
				UserType:       "user",
				CreateAt:       posts[0].CreateAt,
				Message:        posts[0].Message,
				UpdateAt:       posts[1].UpdateAt, // the edit update at
				UpdatedType:    EditedOriginalMsg,
				EditedNewMsgId: posts[1].Id,
			},
			{
				MessageId:   posts[1].Id,
				UserEmail:   th.BasicUser.Email,
				UserType:    "user",
				CreateAt:    posts[1].CreateAt,
				Message:     posts[1].Message,
				UpdateAt:    posts[1].UpdateAt,
				UpdatedType: EditedNewMsg,
			},
		}

		for j := 2; j < 10; j++ {
			expectedExports = append(expectedExports, PostExport{
				MessageId: posts[j].Id,
				UserEmail: th.BasicUser.Email,
				UserType:  "user",
				CreateAt:  posts[j].CreateAt,
				Message:   posts[j].Message,
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

		for i := range actualMessageExports {
			var postExport PostExport
			postExport, results = getPostExport(actualMessageExports, i, results)
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
				{UserEmail: "test@test.com", UploadStartTime: 1, Filename: "test", FilePath: "filename.txt"},
			},
			expectedStops: []*FileUploadStopExport{
				{UserEmail: "test@test.com", UploadStopTime: 1, Filename: "test", FilePath: "filename.txt", Status: "Completed"},
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
				{UserEmail: "test@test.com", UploadStartTime: 1, Filename: "test", FilePath: "filename.txt"},
				{UserEmail: "test@test.com", UploadStartTime: 1, Filename: "test2", FilePath: "filename2.txt"},
			},
			expectedStops: []*FileUploadStopExport{
				{UserEmail: "test@test.com", UploadStopTime: 1, Filename: "test", FilePath: "filename.txt", Status: "Completed"},
				{UserEmail: "test@test.com", UploadStopTime: 1, Filename: "test2", FilePath: "filename2.txt", Status: "Completed"},
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
				{UserEmail: "test@test.com", UploadStartTime: 1, Filename: "test", FilePath: "filename.txt"},
			},
			expectedStops: []*FileUploadStopExport{
				{UserEmail: "test@test.com", UploadStopTime: 1, Filename: "test", FilePath: "filename.txt", Status: "Completed"},
			},
			expectedFileInfos: []*model.FileInfo{
				{Name: "test", Id: "12345", Path: "filename.txt", DeleteAt: 2},
			},
			expectedDeleteFileMessages: []PostExport{
				{MessageId: "test", UserEmail: "test@test.com", UserType: "user", CreateAt: 1, UpdatedType: FileDeleted, UpdateAt: 2, Message: "delete " + "filename.txt"},
			},
			expectError: false,
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
			files, uploadStarts, uploadStops, deleteFileMessages, err := postToAttachmentsEntries(&tc.post, NewMessageExportStore(mockStore))
			if tc.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
			assert.Equal(t, tc.expectedStarts, uploadStarts)
			assert.Equal(t, tc.expectedStops, uploadStops)
			assert.Equal(t, tc.expectedFileInfos, files)
			assert.Equal(t, tc.expectedDeleteFileMessages, deleteFileMessages)
		})
	}
}
