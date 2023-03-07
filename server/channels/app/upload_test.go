// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"io"
	"math/rand"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/server/v7/channels/utils/fileutils"
	"github.com/mattermost/mattermost-server/server/v7/channels/utils/imgutils"
	"github.com/mattermost/mattermost-server/server/v7/model"
)

func TestCreateUploadSession(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	us := &model.UploadSession{
		Type:      model.UploadTypeAttachment,
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		Filename:  "upload",
		FileSize:  8 * 1024 * 1024,
	}

	t.Run("invalid Id", func(t *testing.T) {
		u, err := th.App.CreateUploadSession(th.Context, us)
		require.NotNil(t, err)
		require.Equal(t, "model.upload_session.is_valid.id.app_error", err.Id)
		require.Nil(t, u)
	})

	t.Run("invalid UserId", func(t *testing.T) {
		us.Id = model.NewId()
		us.UserId = ""
		u, err := th.App.CreateUploadSession(th.Context, us)
		require.NotNil(t, err)
		require.Equal(t, "model.upload_session.is_valid.user_id.app_error", err.Id)
		require.Nil(t, u)
	})

	t.Run("invalid ChannelId", func(t *testing.T) {
		us.UserId = th.BasicUser.Id
		us.ChannelId = ""
		u, err := th.App.CreateUploadSession(th.Context, us)
		require.NotNil(t, err)
		require.Equal(t, "model.upload_session.is_valid.channel_id.app_error", err.Id)
		require.Nil(t, u)
	})

	t.Run("non-existing channel", func(t *testing.T) {
		us.ChannelId = model.NewId()
		u, err := th.App.CreateUploadSession(th.Context, us)
		require.NotNil(t, err)
		require.Equal(t, "app.upload.create.incorrect_channel_id.app_error", err.Id)
		require.Nil(t, u)
	})

	t.Run("deleted channel", func(t *testing.T) {
		ch := th.CreateChannel(th.Context, th.BasicTeam)
		th.App.DeleteChannel(th.Context, ch, th.BasicUser.Id)
		us.ChannelId = ch.Id
		u, err := th.App.CreateUploadSession(th.Context, us)
		require.NotNil(t, err)
		require.Equal(t, "app.upload.create.cannot_upload_to_deleted_channel.app_error", err.Id)
		require.Nil(t, u)
	})

	t.Run("success", func(t *testing.T) {
		us.ChannelId = th.BasicChannel.Id
		u, err := th.App.CreateUploadSession(th.Context, us)
		require.Nil(t, err)
		require.NotEmpty(t, u)
	})
}

func TestUploadData(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	us := &model.UploadSession{
		Id:        model.NewId(),
		Type:      model.UploadTypeAttachment,
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		Filename:  "upload",
		FileSize:  8 * 1024 * 1024,
	}

	us, uploadSessionAppErr := th.App.CreateUploadSession(th.Context, us)
	require.Nil(t, uploadSessionAppErr)
	require.NotEmpty(t, us)

	data := make([]byte, us.FileSize)
	_, err2 := rand.Read(data)
	require.NoError(t, err2)

	t.Run("write error", func(t *testing.T) {
		rd := &io.LimitedReader{
			R: bytes.NewReader(data),
			N: 1024 * 1024,
		}

		ok, appErr := th.App.FileExists(us.Path)
		require.False(t, ok)
		require.Nil(t, appErr)

		u := *us
		u.Path = ""
		info, appErr := th.App.UploadData(th.Context, &u, rd)
		require.Nil(t, info)
		require.NotNil(t, appErr)
		require.NotEqual(t, "app.upload.upload_data.first_part_too_small.app_error", appErr.Id)
	})

	t.Run("first part too small", func(t *testing.T) {
		rd := &io.LimitedReader{
			R: bytes.NewReader(data),
			N: 1024 * 1024,
		}

		ok, appErr := th.App.FileExists(us.Path)
		require.False(t, ok)
		require.Nil(t, appErr)

		info, appErr := th.App.UploadData(th.Context, us, rd)
		require.Nil(t, info)
		require.NotNil(t, appErr)
		require.Equal(t, "app.upload.upload_data.first_part_too_small.app_error", appErr.Id)

		ok, appErr = th.App.FileExists(us.Path)
		require.False(t, ok)
		require.Nil(t, appErr)
	})

	t.Run("resume success", func(t *testing.T) {
		rd := &io.LimitedReader{
			R: bytes.NewReader(data),
			N: 5 * 1024 * 1024,
		}
		info, appErr := th.App.UploadData(th.Context, us, rd)
		require.Nil(t, info)
		require.Nil(t, appErr)

		rd = &io.LimitedReader{
			R: bytes.NewReader(data[5*1024*1024:]),
			N: 3 * 1024 * 1024,
		}
		info, appErr = th.App.UploadData(th.Context, us, rd)
		require.Nil(t, appErr)
		require.NotEmpty(t, info)

		d, appErr := th.App.ReadFile(us.Path)
		require.Nil(t, appErr)
		require.Equal(t, data, d)
	})

	t.Run("all at once success", func(t *testing.T) {
		us.Id = model.NewId()
		var appErr *model.AppError
		us, appErr = th.App.CreateUploadSession(th.Context, us)
		require.Nil(t, appErr)
		require.NotEmpty(t, us)

		info, appErr := th.App.UploadData(th.Context, us, bytes.NewReader(data))
		require.Nil(t, appErr)
		require.NotEmpty(t, info)

		d, appErr := th.App.ReadFile(us.Path)
		require.Nil(t, appErr)
		require.Equal(t, data, d)
	})

	t.Run("small file success", func(t *testing.T) {
		us.Id = model.NewId()
		us.FileSize = 1024 * 1024
		var appErr *model.AppError
		us, appErr = th.App.CreateUploadSession(th.Context, us)
		require.Nil(t, appErr)
		require.NotEmpty(t, us)

		rd := &io.LimitedReader{
			R: bytes.NewReader(data),
			N: 1024 * 1024,
		}
		info, appErr := th.App.UploadData(th.Context, us, rd)
		require.Nil(t, appErr)
		require.NotEmpty(t, info)

		d, appErr := th.App.ReadFile(us.Path)
		require.Nil(t, appErr)
		require.Equal(t, data[:1024*1024], d)
	})

	t.Run("image processing", func(t *testing.T) {
		testDir, _ := fileutils.FindDir("tests")
		data, err := os.ReadFile(filepath.Join(testDir, "test.png"))
		require.NoError(t, err)
		require.NotEmpty(t, data)

		us.Id = model.NewId()
		us.Filename = "test.png"
		us.FileSize = int64(len(data))
		var appErr *model.AppError
		us, appErr = th.App.CreateUploadSession(th.Context, us)
		require.Nil(t, appErr)
		require.NotEmpty(t, us)

		info, appErr := th.App.UploadData(th.Context, us, bytes.NewReader(data))
		require.Nil(t, appErr)
		require.NotEmpty(t, info)
		require.NotZero(t, info.Width)
		require.NotZero(t, info.Height)
		require.NotEmpty(t, info.ThumbnailPath)
		require.NotEmpty(t, info.PreviewPath)
	})

	t.Run("huge GIF", func(t *testing.T) {
		gifData := imgutils.GenGIFData(65535, 65535, 10)

		us.Id = model.NewId()
		us.Filename = "test.gif"
		us.FileSize = int64(len(gifData))
		var appErr *model.AppError
		us, appErr = th.App.CreateUploadSession(th.Context, us)
		require.Nil(t, appErr)
		require.NotEmpty(t, us)

		info, appErr := th.App.UploadData(th.Context, us, bytes.NewReader(gifData))
		require.NotNil(t, appErr)
		require.Equal(t, "app.upload.upload_data.large_image.app_error", appErr.Id)
		require.Empty(t, info)
	})
}

func TestUploadDataConcurrent(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	us := &model.UploadSession{
		Id:        model.NewId(),
		Type:      model.UploadTypeAttachment,
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		Filename:  "upload",
		FileSize:  8 * 1024 * 1024,
	}

	var appErr *model.AppError
	us, appErr = th.App.CreateUploadSession(th.Context, us)
	require.Nil(t, appErr)
	require.NotEmpty(t, us)

	data := make([]byte, us.FileSize)
	_, err2 := rand.Read(data)
	require.NoError(t, err2)

	var nErrs int32
	var wg sync.WaitGroup
	n := 8
	wg.Add(n)

	for i := 0; i < n; i++ {
		go func() {
			defer wg.Done()
			rd := &io.LimitedReader{
				R: bytes.NewReader(data),
				N: 5 * 1024 * 1024,
			}
			u := *us
			_, err := th.App.UploadData(th.Context, &u, rd)
			if err != nil {
				atomic.AddInt32(&nErrs, 1)
			}
		}()
	}

	wg.Wait()

	// Verify that only 1 request was able to perform the upload.
	require.Equal(t, int32(n-1), nErrs)
	nErrs = 0

	wg.Add(n)

	for i := 0; i < n; i++ {
		go func() {
			defer wg.Done()
			rd := &io.LimitedReader{
				R: bytes.NewReader(data[5*1024*1024:]),
				N: 3 * 1024 * 1024,
			}
			u := *us
			u.FileOffset = 5 * 1024 * 1024
			_, err := th.App.UploadData(th.Context, &u, rd)
			if err != nil {
				atomic.AddInt32(&nErrs, 1)
			}
		}()
	}

	wg.Wait()

	// Verify that only 1 request was able to finish the upload.
	require.Equal(t, int32(n-1), nErrs)

	d, appErr := th.App.ReadFile(us.Path)
	require.Nil(t, appErr)
	require.Equal(t, data, d)
}
