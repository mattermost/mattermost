// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
	"testing"
)

func TestProcessPostFileChanges(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("no files", func(t *testing.T) {
		oldPost := &model.Post{FileIds: []string{}}
		newPost := &model.Post{FileIds: []string{}}

		appErr := th.App.processPostFileChanges(th.Context, newPost, oldPost)
		require.Nil(t, appErr)
		require.Equal(t, 0, len(newPost.FileIds))
	})

	t.Run("have files but nothing changed", func(t *testing.T) {
		oldPost := &model.Post{FileIds: []string{"file_id_1", "file_id_2"}}
		newPost := &model.Post{FileIds: []string{"file_id_1", "file_id_2"}}

		appErr := th.App.processPostFileChanges(th.Context, newPost, oldPost)
		require.Nil(t, appErr)
		require.Equal(t, 2, len(newPost.FileIds))
	})

	t.Run("one file deleted", func(t *testing.T) {
		postId := model.NewId()
		fileInfo1 := th.CreateFileInfo(th.BasicUser.Id, postId, th.BasicChannel.Id)
		fileInfo2 := th.CreateFileInfo(th.BasicUser.Id, postId, th.BasicChannel.Id)

		oldPost := &model.Post{
			Id:        postId,
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "Message",
			CreateAt:  model.GetMillis() - 10000,
			FileIds:   []string{fileInfo1.Id, fileInfo2.Id},
		}

		newPost := &model.Post{
			Id:        postId,
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "Message",
			CreateAt:  model.GetMillis() - 10000,
			FileIds:   []string{fileInfo1.Id},
		}

		appErr := th.App.processPostFileChanges(th.Context, newPost, oldPost)
		require.Nil(t, appErr)

		// verify file2 was soft deleted
		updatedFileInfos, err := th.App.Srv().Store().FileInfo().GetForPost(postId, true, true, false)
		require.NoError(t, err)
		require.Equal(t, 2, len(updatedFileInfos))

		for _, fileInfo := range updatedFileInfos {
			if fileInfo.Id == fileInfo1.Id {
				require.Equal(t, int64(0), fileInfo.DeleteAt)
			} else if fileInfo.Id == fileInfo2.Id {
				require.Greater(t, fileInfo.DeleteAt, int64(0))
			} else {
				require.Fail(t, "unexpected file info")
			}
		}
	})

	t.Run("one file added", func(t *testing.T) {
		postId := model.NewId()
		fileInfo1 := th.CreateFileInfo(th.BasicUser.Id, postId, th.BasicChannel.Id)
		fileInfo2 := th.CreateFileInfo(th.BasicUser.Id, "", th.BasicChannel.Id)

		oldPost := &model.Post{
			Id:        postId,
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "Message",
			CreateAt:  model.GetMillis() - 10000,
			FileIds:   []string{fileInfo1.Id},
		}

		newPost := &model.Post{
			Id:        postId,
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "Message",
			CreateAt:  model.GetMillis() - 10000,
			FileIds:   []string{fileInfo1.Id, fileInfo2.Id},
		}

		appErr := th.App.processPostFileChanges(th.Context, newPost, oldPost)
		require.Nil(t, appErr)

		// verify file2 is attached to the post
		updatedFileInfo2, err := th.App.Srv().Store().FileInfo().Get(fileInfo2.Id)
		require.NoError(t, err)
		require.Equal(t, postId, updatedFileInfo2.PostId)
	})

	t.Run("all files removed", func(t *testing.T) {
		postId := model.NewId()
		fileInfo1 := th.CreateFileInfo(th.BasicUser.Id, postId, th.BasicChannel.Id)
		fileInfo2 := th.CreateFileInfo(th.BasicUser.Id, postId, th.BasicChannel.Id)

		oldPost := &model.Post{
			Id:        postId,
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "Message",
			CreateAt:  model.GetMillis() - 10000,
			FileIds:   []string{fileInfo1.Id, fileInfo2.Id},
		}

		newPost := &model.Post{
			Id:        postId,
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "Message",
			CreateAt:  model.GetMillis() - 10000,
			FileIds:   []string{},
		}

		appErr := th.App.processPostFileChanges(th.Context, newPost, oldPost)
		require.Nil(t, appErr)

		// verify file2 was soft deleted
		updatedFileInfos, err := th.App.Srv().Store().FileInfo().GetForPost(postId, true, true, false)
		require.NoError(t, err)
		require.Equal(t, 2, len(updatedFileInfos))

		for _, fileInfo := range updatedFileInfos {
			if fileInfo.Id == fileInfo1.Id || fileInfo.Id == fileInfo2.Id {
				require.Greater(t, fileInfo.DeleteAt, int64(0))
			} else {
				require.Fail(t, "unexpected file info")
			}
		}
	})

	t.Run("files added when no files existed", func(t *testing.T) {
		fileInfo1 := th.CreateFileInfo(th.BasicUser.Id, "", th.BasicChannel.Id)
		fileInfo2 := th.CreateFileInfo(th.BasicUser.Id, "", th.BasicChannel.Id)

		postId := model.NewId()
		oldPost := &model.Post{
			Id:        postId,
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "Message",
			CreateAt:  model.GetMillis() - 10000,
			FileIds:   []string{},
		}

		newPost := &model.Post{
			Id:        postId,
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "Message",
			CreateAt:  model.GetMillis() - 10000,
			FileIds:   []string{fileInfo1.Id, fileInfo2.Id},
		}

		appErr := th.App.processPostFileChanges(th.Context, newPost, oldPost)
		require.Nil(t, appErr)

		updatedFileInfo1, err := th.App.Srv().Store().FileInfo().Get(fileInfo2.Id)
		require.NoError(t, err)
		require.Equal(t, postId, updatedFileInfo1.PostId)

		updatedFileInfo2, err := th.App.Srv().Store().FileInfo().Get(fileInfo2.Id)
		require.NoError(t, err)
		require.Equal(t, postId, updatedFileInfo2.PostId)
	})

	t.Run("other post's attached file added", func(t *testing.T) {
		postId := model.NewId()
		fileInfo1 := th.CreateFileInfo(th.BasicUser.Id, postId, th.BasicChannel.Id)
		fileInfo2 := th.CreateFileInfo(th.BasicUser.Id, model.NewId(), th.BasicChannel.Id)

		oldPost := &model.Post{
			Id:        postId,
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "Message",
			CreateAt:  model.GetMillis() - 10000,
			FileIds:   []string{fileInfo1.Id},
		}

		newPost := &model.Post{
			Id:        postId,
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "Message",
			CreateAt:  model.GetMillis() - 10000,
			FileIds:   []string{fileInfo1.Id, fileInfo2.Id},
		}

		appErr := th.App.processPostFileChanges(th.Context, newPost, oldPost)
		require.Nil(t, appErr)

		// verify file2 is attached to the post
		updatedFileInfo2, err := th.App.Srv().Store().FileInfo().Get(fileInfo2.Id)
		require.NoError(t, err)
		require.NotEqual(t, postId, updatedFileInfo2.PostId)
	})
}
