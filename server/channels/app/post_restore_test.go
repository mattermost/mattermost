// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func TestRestorePostVersion(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("is able to restore a post version", func(t *testing.T) {
		post := th.CreatePost(th.BasicChannel, func(p *model.Post) {
			p.Message = "original message"
		})
		th.UpdatePost(post, "new message 2")
		th.UpdatePost(post, "new message 3")

		// verify post's state
		fetchedPost, err := th.App.Srv().Store().Post().GetSingle(th.Context, post.Id, true)
		require.NoError(t, err)
		require.Equal(t, "new message 3", fetchedPost.Message)

		editHistory, appErr := th.App.GetEditHistoryForPost(post.Id)
		require.Nil(t, appErr)
		require.Equal(t, 2, len(editHistory))
		require.Equal(t, "new message 2", editHistory[0].Message)

		// now we'll restore a post version
		restoredPost, appErr := th.App.RestorePostVersion(th.Context, th.BasicUser.Id, post.Id, editHistory[0].Id)
		require.Nil(t, appErr)
		require.Equal(t, "new message 2", restoredPost.Message)

		// verify from database
		fetchedPost, err = th.App.Srv().Store().Post().GetSingle(th.Context, post.Id, true)
		require.NoError(t, err)
		require.Equal(t, "new message 2", fetchedPost.Message)

		// verify that we now have 3 items in post's edit history
		editHistory, appErr = th.App.GetEditHistoryForPost(post.Id)
		require.Nil(t, appErr)
		require.Equal(t, 3, len(editHistory))
		require.Equal(t, "new message 3", editHistory[0].Message)
		require.Equal(t, "new message 2", editHistory[1].Message)
		require.Equal(t, "original message", editHistory[2].Message)
	})

	t.Run("is able to restore a post version including its files", func(t *testing.T) {
		fileBytes := []byte("file contents")
		fileInfo, appErr := th.App.UploadFile(th.Context, fileBytes, th.BasicChannel.Id, "file.txt")
		require.Nil(t, appErr)

		post := th.CreatePost(th.BasicChannel, func(p *model.Post) {
			p.FileIds = []string{fileInfo.Id}
			p.Message = "original message"
		})

		// this update removes all files
		th.UpdatePost(post, "new message 2", func(p *model.PostPatch) {
			p.FileIds = &model.StringArray{}
		})
		// this update only changes the message
		th.UpdatePost(post, "new message 3")

		// verify post's state
		fetchedPost, err := th.App.Srv().Store().Post().GetSingle(th.Context, post.Id, true)
		require.NoError(t, err)
		require.Equal(t, "new message 3", fetchedPost.Message)
		require.Empty(t, fetchedPost.FileIds)

		editHistory, appErr := th.App.GetEditHistoryForPost(post.Id)
		require.Nil(t, appErr)
		require.Equal(t, 2, len(editHistory))
		require.Equal(t, "new message 2", editHistory[0].Message)
		require.Equal(t, 0, len(editHistory[0].FileIds))

		require.Equal(t, "original message", editHistory[1].Message)
		require.Equal(t, 1, len(editHistory[1].FileIds))

		// now we'll restore a post version
		restoredPost, appErr := th.App.RestorePostVersion(th.Context, th.BasicUser.Id, post.Id, editHistory[1].Id)
		require.Nil(t, appErr)
		require.Equal(t, "original message", restoredPost.Message)
		require.Equal(t, 1, len(restoredPost.FileIds))

		// verify from database
		fetchedPost, err = th.App.Srv().Store().Post().GetSingle(th.Context, post.Id, true)
		require.NoError(t, err)
		require.Equal(t, "original message", fetchedPost.Message)
		require.Equal(t, 1, len(fetchedPost.FileIds))

		// verify edit history\
		editHistory, appErr = th.App.GetEditHistoryForPost(post.Id)
		require.Nil(t, appErr)
		require.Equal(t, 3, len(editHistory))

		require.Equal(t, "new message 3", editHistory[0].Message)
		require.Equal(t, 0, len(editHistory[0].FileIds))

		require.Equal(t, "new message 2", editHistory[1].Message)
		require.Equal(t, 0, len(editHistory[1].FileIds))

		require.Equal(t, "original message", editHistory[2].Message)
		require.Equal(t, 1, len(editHistory[2].FileIds))
	})
}