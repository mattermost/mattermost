// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"bytes"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/utils/fileutils"
)

func TestCreateUpload(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	us := &model.UploadSession{
		ChannelId: th.BasicChannel.Id,
		Filename:  "upload",
		FileSize:  8 * 1024 * 1024,
	}

	t.Run("file attachments disabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.EnableFileAttachments = false })
		defer th.App.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.EnableFileAttachments = true })
		u, resp := th.Client.CreateUpload(us)
		require.Nil(t, u)
		require.NotNil(t, resp.Error)
		require.Equal(t, "api.file.attachments.disabled.app_error", resp.Error.Id)
		require.Equal(t, http.StatusNotImplemented, resp.StatusCode)
	})

	t.Run("no permissions", func(t *testing.T) {
		us.ChannelId = th.BasicPrivateChannel2.Id
		u, resp := th.Client.CreateUpload(us)
		require.Nil(t, u)
		require.NotNil(t, resp.Error)
		require.Equal(t, "api.context.permissions.app_error", resp.Error.Id)
		require.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("valid", func(t *testing.T) {
		us.ChannelId = th.BasicChannel.Id
		u, resp := th.Client.CreateUpload(us)
		require.Nil(t, resp.Error)
		require.NotEmpty(t, u)
		require.Equal(t, http.StatusCreated, resp.StatusCode)
	})

	t.Run("import file", func(t *testing.T) {
		testsDir, _ := fileutils.FindDir("tests")

		importFile, err := os.Open(testsDir + "/import_test.zip")
		require.NoError(t, err)
		defer importFile.Close()

		info, err := importFile.Stat()
		require.NoError(t, err)

		t.Run("permissions error", func(t *testing.T) {
			us := &model.UploadSession{
				Filename: info.Name(),
				FileSize: info.Size(),
				Type:     model.UploadTypeImport,
			}
			u, resp := th.Client.CreateUpload(us)
			require.Nil(t, u)
			require.NotNil(t, resp.Error)
			require.Equal(t, "api.context.permissions.app_error", resp.Error.Id)
			require.Equal(t, http.StatusForbidden, resp.StatusCode)
		})

		t.Run("success", func(t *testing.T) {
			us := &model.UploadSession{
				Filename: info.Name(),
				FileSize: info.Size(),
				Type:     model.UploadTypeImport,
			}
			u, resp := th.SystemAdminClient.CreateUpload(us)
			require.Nil(t, resp.Error)
			require.NotEmpty(t, u)
		})
	})
}

func TestGetUpload(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	us := &model.UploadSession{
		Id:        model.NewId(),
		Type:      model.UploadTypeAttachment,
		CreateAt:  model.GetMillis(),
		UserId:    th.BasicUser2.Id,
		ChannelId: th.BasicChannel.Id,
		Filename:  "upload",
		FileSize:  8 * 1024 * 1024,
	}
	us, err := th.App.CreateUploadSession(us)
	require.Nil(t, err)
	require.NotNil(t, us)
	require.NotEmpty(t, us)

	t.Run("upload not found", func(t *testing.T) {
		u, resp := th.Client.GetUpload(model.NewId())
		require.Nil(t, u)
		require.NotNil(t, resp.Error)
		require.Equal(t, "app.upload.get.app_error", resp.Error.Id)
		require.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("no permissions", func(t *testing.T) {
		u, resp := th.Client.GetUpload(us.Id)
		require.Nil(t, u)
		require.NotNil(t, resp.Error)
		require.Equal(t, "api.upload.get_upload.forbidden.app_error", resp.Error.Id)
	})

	t.Run("success", func(t *testing.T) {
		expected, resp := th.Client.CreateUpload(us)
		require.Nil(t, resp.Error)
		require.NotEmpty(t, expected)
		require.Equal(t, http.StatusCreated, resp.StatusCode)

		u, resp := th.Client.GetUpload(expected.Id)
		require.Nil(t, resp.Error)
		require.NotEmpty(t, u)
		require.Equal(t, expected, u)
	})
}

func TestGetUploadsForUser(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("no permissions", func(t *testing.T) {
		uss, resp := th.Client.GetUploadsForUser(th.BasicUser2.Id)
		require.NotNil(t, resp.Error)
		require.Equal(t, "api.user.get_uploads_for_user.forbidden.app_error", resp.Error.Id)
		require.Nil(t, uss)
	})

	t.Run("empty", func(t *testing.T) {
		uss, resp := th.Client.GetUploadsForUser(th.BasicUser.Id)
		require.Nil(t, resp.Error)
		require.Empty(t, uss)
	})

	t.Run("success", func(t *testing.T) {
		uploads := make([]*model.UploadSession, 4)
		for i := 0; i < len(uploads); i++ {
			us := &model.UploadSession{
				Id:        model.NewId(),
				Type:      model.UploadTypeAttachment,
				CreateAt:  model.GetMillis(),
				UserId:    th.BasicUser.Id,
				ChannelId: th.BasicChannel.Id,
				Filename:  "upload",
				FileSize:  8 * 1024 * 1024,
			}
			us, err := th.App.CreateUploadSession(us)
			require.Nil(t, err)
			require.NotNil(t, us)
			require.NotEmpty(t, us)
			us.Path = ""
			uploads[i] = us
		}

		uss, resp := th.Client.GetUploadsForUser(th.BasicUser.Id)
		require.Nil(t, resp.Error)
		require.NotEmpty(t, uss)
		require.Len(t, uss, len(uploads))
		for i := range uploads {
			require.Contains(t, uss, uploads[i])
		}
	})
}

func TestUploadData(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	if *th.App.Config().FileSettings.DriverName == "" {
		t.Skip("skipping because no file driver is enabled")
	}

	us := &model.UploadSession{
		Id:        model.NewId(),
		Type:      model.UploadTypeAttachment,
		CreateAt:  model.GetMillis(),
		UserId:    th.BasicUser2.Id,
		ChannelId: th.BasicChannel.Id,
		Filename:  "upload",
		FileSize:  8 * 1024 * 1024,
	}
	us, err := th.App.CreateUploadSession(us)
	require.Nil(t, err)
	require.NotNil(t, us)
	require.NotEmpty(t, us)

	data := randomBytes(t, int(us.FileSize))

	t.Run("file attachments disabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.EnableFileAttachments = false })
		defer th.App.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.EnableFileAttachments = true })
		info, resp := th.Client.UploadData(model.NewId(), bytes.NewReader(data))
		require.Nil(t, info)
		require.NotNil(t, resp.Error)
		require.Equal(t, "api.file.attachments.disabled.app_error", resp.Error.Id)
	})

	t.Run("upload not found", func(t *testing.T) {
		info, resp := th.Client.UploadData(model.NewId(), bytes.NewReader(data))
		require.Nil(t, info)
		require.NotNil(t, resp.Error)
		require.Equal(t, "app.upload.get.app_error", resp.Error.Id)
		require.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("no permissions", func(t *testing.T) {
		info, resp := th.Client.UploadData(us.Id, bytes.NewReader(data))
		require.Nil(t, info)
		require.NotNil(t, resp.Error)
		require.Equal(t, "api.context.permissions.app_error", resp.Error.Id)
	})

	t.Run("bad content-length", func(t *testing.T) {
		u, resp := th.Client.CreateUpload(us)
		require.Nil(t, resp.Error)
		require.NotEmpty(t, u)
		require.Equal(t, http.StatusCreated, resp.StatusCode)

		info, resp := th.Client.UploadData(u.Id, bytes.NewReader(append(data, 0x00)))
		require.Nil(t, info)
		require.NotNil(t, resp.Error)
		require.Equal(t, "api.upload.upload_data.invalid_content_length", resp.Error.Id)
	})

	t.Run("success", func(t *testing.T) {
		u, resp := th.Client.CreateUpload(us)
		require.Nil(t, resp.Error)
		require.NotEmpty(t, u)
		require.Equal(t, http.StatusCreated, resp.StatusCode)

		info, resp := th.Client.UploadData(u.Id, bytes.NewReader(data))
		require.Nil(t, resp.Error)
		require.NotEmpty(t, info)
		require.Equal(t, u.Filename, info.Name)

		file, resp := th.Client.GetFile(info.Id)
		require.Nil(t, resp.Error)
		require.Equal(t, file, data)
	})

	t.Run("resume success", func(t *testing.T) {
		u, resp := th.Client.CreateUpload(us)
		require.Nil(t, resp.Error)
		require.NotEmpty(t, u)
		require.Equal(t, http.StatusCreated, resp.StatusCode)

		rd := &io.LimitedReader{
			R: bytes.NewReader(data),
			N: 5 * 1024 * 1024,
		}
		info, resp := th.Client.UploadData(u.Id, rd)
		require.Nil(t, resp.Error)
		require.Nil(t, info)
		require.Equal(t, http.StatusNoContent, resp.StatusCode)

		info, resp = th.Client.UploadData(u.Id, bytes.NewReader(data[5*1024*1024:]))
		require.Nil(t, resp.Error)
		require.NotEmpty(t, info)
		require.Equal(t, u.Filename, info.Name)

		file, resp := th.Client.GetFile(info.Id)
		require.Nil(t, resp.Error)
		require.Equal(t, file, data)
	})
}

func TestUploadDataMultipart(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	if *th.App.Config().FileSettings.DriverName == "" {
		t.Skip("skipping because no file driver is enabled")
	}

	us := &model.UploadSession{
		Id:        model.NewId(),
		Type:      model.UploadTypeAttachment,
		CreateAt:  model.GetMillis(),
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		Filename:  "upload",
		FileSize:  8 * 1024 * 1024,
	}
	us, resp := th.Client.CreateUpload(us)
	require.Nil(t, resp.Error)
	require.NotNil(t, us)
	require.NotEmpty(t, us)

	data := randomBytes(t, int(us.FileSize))

	genMultipartData := func(t *testing.T, data []byte) (io.Reader, string) {
		mpData := &bytes.Buffer{}
		mpWriter := multipart.NewWriter(mpData)
		part, err := mpWriter.CreateFormFile("data", us.Filename)
		require.NoError(t, err)
		n, err := part.Write(data)
		require.NoError(t, err)
		require.Equal(t, len(data), n)
		err = mpWriter.Close()
		require.NoError(t, err)
		return mpData, mpWriter.FormDataContentType()
	}

	t.Run("bad content-type", func(t *testing.T) {
		info, resp := th.Client.DoUploadFile("/uploads/"+us.Id, data, "multipart/form-data;")
		require.Nil(t, info)
		require.NotNil(t, resp.Error)
		require.Equal(t, "api.upload.upload_data.invalid_content_type", resp.Error.Id)
	})

	t.Run("success", func(t *testing.T) {
		mpData, contentType := genMultipartData(t, data)

		req, err := http.NewRequest("POST", th.Client.ApiUrl+"/uploads/"+us.Id, mpData)
		require.NoError(t, err)
		req.Header.Set("Content-Type", contentType)
		req.Header.Set(model.HEADER_AUTH, th.Client.AuthType+" "+th.Client.AuthToken)
		res, err := th.Client.HttpClient.Do(req)
		require.NoError(t, err)
		info := model.FileInfoFromJson(res.Body)
		res.Body.Close()
		require.NotEmpty(t, info)
		require.Equal(t, us.Filename, info.Name)

		file, resp := th.Client.GetFile(info.Id)
		require.Nil(t, resp.Error)
		require.Equal(t, file, data)
	})

	t.Run("resume success", func(t *testing.T) {
		mpData, contentType := genMultipartData(t, data[:5*1024*1024])

		u, resp := th.Client.CreateUpload(us)
		require.Nil(t, resp.Error)
		require.NotNil(t, u)
		require.NotEmpty(t, u)

		req, err := http.NewRequest("POST", th.Client.ApiUrl+"/uploads/"+u.Id, mpData)
		require.NoError(t, err)
		req.Header.Set("Content-Type", contentType)
		req.Header.Set(model.HEADER_AUTH, th.Client.AuthType+" "+th.Client.AuthToken)
		res, err := th.Client.HttpClient.Do(req)
		require.NoError(t, err)
		require.Equal(t, http.StatusNoContent, res.StatusCode)
		require.Equal(t, int64(0), res.ContentLength)

		mpData, contentType = genMultipartData(t, data[5*1024*1024:])

		req, err = http.NewRequest("POST", th.Client.ApiUrl+"/uploads/"+u.Id, mpData)
		require.NoError(t, err)
		req.Header.Set("Content-Type", contentType)
		req.Header.Set(model.HEADER_AUTH, th.Client.AuthType+" "+th.Client.AuthToken)
		res, err = th.Client.HttpClient.Do(req)
		require.NoError(t, err)
		info := model.FileInfoFromJson(res.Body)
		res.Body.Close()
		require.NotEmpty(t, info)
		require.Equal(t, u.Filename, info.Name)

		file, resp := th.Client.GetFile(info.Id)
		require.Nil(t, resp.Error)
		require.Equal(t, file, data)
	})
}
