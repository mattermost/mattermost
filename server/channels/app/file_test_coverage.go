// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUploadFileX_ErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("driver not configured", func(t *testing.T) {
		oldDriverName := th.App.Config().FileSettings.DriverName
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FileSettings.DriverName = model.NewPointer("")
		})
		defer th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FileSettings.DriverName = oldDriverName
		})

		_, appErr := th.App.UploadFileX(
			th.Context,
			th.BasicChannel.Id,
			"test.txt",
			strings.NewReader("test content"),
		)
		require.NotNil(t, appErr)
		assert.Equal(t, "api.file.upload_file.storage.app_error", appErr.Id)
		assert.Equal(t, http.StatusNotImplemented, appErr.StatusCode)
	})

	t.Run("file too large via ContentLength", func(t *testing.T) {
		oldMaxSize := th.App.Config().FileSettings.MaxFileSize
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FileSettings.MaxFileSize = model.NewPointer(int64(10))
		})
		defer th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FileSettings.MaxFileSize = oldMaxSize
		})

		_, appErr := th.App.UploadFileX(
			th.Context,
			th.BasicChannel.Id,
			"test.txt",
			strings.NewReader("test content that exceeds size limit"),
			UploadFileSetContentLength(100),
		)
		require.NotNil(t, appErr)
		assert.Equal(t, "api.file.upload_file.too_large_detailed.app_error", appErr.Id)
		assert.Equal(t, http.StatusRequestEntityTooLarge, appErr.StatusCode)
	})

	t.Run("file too large detected after write", func(t *testing.T) {
		oldMaxSize := th.App.Config().FileSettings.MaxFileSize
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FileSettings.MaxFileSize = model.NewPointer(int64(10))
		})
		defer th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FileSettings.MaxFileSize = oldMaxSize
		})

		largeContent := strings.Repeat("a", 20)
		_, appErr := th.App.UploadFileX(
			th.Context,
			th.BasicChannel.Id,
			"test.txt",
			strings.NewReader(largeContent),
		)
		require.NotNil(t, appErr)
		assert.Equal(t, "api.file.upload_file.too_large_detailed.app_error", appErr.Id)
		assert.Equal(t, http.StatusRequestEntityTooLarge, appErr.StatusCode)
	})

	t.Run("image resolution limit exceeded", func(t *testing.T) {
		oldMaxRes := th.App.Config().FileSettings.MaxImageResolution
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FileSettings.MaxImageResolution = model.NewPointer(int64(10))
		})
		defer th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FileSettings.MaxImageResolution = oldMaxRes
		})

		// Create a simple 1x1 PNG
		pngData := []byte{
			0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
			0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
			0x00, 0x00, 0x00, 0x64, 0x00, 0x00, 0x00, 0x64, // 100x100 dimensions
			0x08, 0x02, 0x00, 0x00, 0x00, 0x9A, 0x20, 0x6C, 0x5C,
		}

		_, appErr := th.App.UploadFileX(
			th.Context,
			th.BasicChannel.Id,
			"large.png",
			bytes.NewReader(pngData),
		)
		require.NotNil(t, appErr)
		assert.Equal(t, "api.file.upload_file.large_image_detailed.app_error", appErr.Id)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})
}

func TestGetFileInfo_ErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("file not found", func(t *testing.T) {
		nonExistentId := model.NewId()
		_, appErr := th.App.GetFileInfo(th.Context, nonExistentId)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.file_info.get.app_error", appErr.Id)
		assert.Equal(t, http.StatusNotFound, appErr.StatusCode)
	})

	t.Run("invalid file id", func(t *testing.T) {
		_, appErr := th.App.GetFileInfo(th.Context, "invalid-id")
		require.NotNil(t, appErr)
		assert.Equal(t, "app.file_info.get.app_error", appErr.Id)
	})
}

func TestGetFileInfos_ErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("invalid page parameters", func(t *testing.T) {
		_, appErr := th.App.GetFileInfos(th.Context, -1, 10, nil)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.file_info.get_with_options.app_error", appErr.Id)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})

	t.Run("per page limit exceeded", func(t *testing.T) {
		_, appErr := th.App.GetFileInfos(th.Context, 0, 1001, nil)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.file_info.get_with_options.app_error", appErr.Id)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})
}

func TestGetFile_ErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("file info not found", func(t *testing.T) {
		_, appErr := th.App.GetFile(th.Context, model.NewId())
		require.NotNil(t, appErr)
		assert.Equal(t, "app.file_info.get.app_error", appErr.Id)
		assert.Equal(t, http.StatusNotFound, appErr.StatusCode)
	})

	t.Run("file exists in db but not in storage", func(t *testing.T) {
		// Upload a file
		data := []byte("test content")
		info, appErr := th.App.UploadFile(
			th.Context,
			data,
			th.BasicChannel.Id,
			"test.txt",
		)
		require.Nil(t, appErr)
		defer th.App.Srv().Store().FileInfo().PermanentDelete(th.Context, info.Id)

		// Remove from storage but keep in db
		appErr = th.App.RemoveFile(info.Path)
		require.Nil(t, appErr)

		// Try to get the file
		_, appErr = th.App.GetFile(th.Context, info.Id)
		require.NotNil(t, appErr)
		assert.Equal(t, "api.file.file_reader.app_error", appErr.Id)
		assert.Equal(t, http.StatusInternalServerError, appErr.StatusCode)
	})
}

func TestFileReader_ErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("file not exists", func(t *testing.T) {
		_, appErr := th.App.FileReader("nonexistent/path/file.txt")
		require.NotNil(t, appErr)
		assert.Equal(t, "api.file.file_reader.app_error", appErr.Id)
		assert.Equal(t, http.StatusInternalServerError, appErr.StatusCode)
	})

	t.Run("invalid path", func(t *testing.T) {
		_, appErr := th.App.FileReader("")
		require.NotNil(t, appErr)
		assert.Equal(t, "api.file.file_reader.app_error", appErr.Id)
	})
}

func TestWriteFile_ErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("write to invalid path", func(t *testing.T) {
		reader := strings.NewReader("test content")
		written, appErr := th.App.WriteFile(reader, "")
		assert.Equal(t, int64(0), written)
		require.NotNil(t, appErr)
		assert.Equal(t, "api.file.write_file.app_error", appErr.Id)
		assert.Equal(t, http.StatusInternalServerError, appErr.StatusCode)
	})
}

func TestCopyFileInfos_ErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("copy non-existent file", func(t *testing.T) {
		nonExistentId := model.NewId()
		_, appErr := th.App.CopyFileInfos(th.Context, th.BasicUser.Id, []string{nonExistentId})
		require.NotNil(t, appErr)
		assert.Equal(t, "app.file_info.get.app_error", appErr.Id)
		assert.Equal(t, http.StatusNotFound, appErr.StatusCode)
	})

	t.Run("copy with invalid file id", func(t *testing.T) {
		_, appErr := th.App.CopyFileInfos(th.Context, th.BasicUser.Id, []string{"invalid-id"})
		require.NotNil(t, appErr)
		assert.Equal(t, "app.file_info.get.app_error", appErr.Id)
	})
}

func TestFileExists_ErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("check empty path", func(t *testing.T) {
		exists, appErr := th.App.FileExists("")
		assert.False(t, exists)
		require.NotNil(t, appErr)
		assert.Equal(t, "api.file.file_exists.app_error", appErr.Id)
		assert.Equal(t, http.StatusInternalServerError, appErr.StatusCode)
	})
}

func TestFileSize_ErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("get size of non-existent file", func(t *testing.T) {
		size, appErr := th.App.FileSize("nonexistent/file.txt")
		assert.Equal(t, int64(0), size)
		require.NotNil(t, appErr)
		assert.Equal(t, "api.file.file_size.app_error", appErr.Id)
		assert.Equal(t, http.StatusInternalServerError, appErr.StatusCode)
	})
}

func TestRemoveFile_ErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("remove non-existent file", func(t *testing.T) {
		appErr := th.App.RemoveFile("nonexistent/file.txt")
		require.NotNil(t, appErr)
		assert.Equal(t, "api.file.remove_file.app_error", appErr.Id)
		assert.Equal(t, http.StatusInternalServerError, appErr.StatusCode)
	})

	t.Run("remove empty path", func(t *testing.T) {
		appErr := th.App.RemoveFile("")
		require.NotNil(t, appErr)
		assert.Equal(t, "api.file.remove_file.app_error", appErr.Id)
	})
}

func TestMoveFile_ErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("move non-existent file", func(t *testing.T) {
		appErr := th.App.MoveFile("old/path.txt", "new/path.txt")
		require.NotNil(t, appErr)
		assert.Equal(t, "api.file.move_file.app_error", appErr.Id)
		assert.Equal(t, http.StatusInternalServerError, appErr.StatusCode)
	})

	t.Run("move to invalid destination", func(t *testing.T) {
		// First create a file
		data := []byte("test content")
		info, appErr := th.App.UploadFile(th.Context, data, th.BasicChannel.Id, "test.txt")
		require.Nil(t, appErr)
		defer th.App.RemoveFile(info.Path)
		defer th.App.Srv().Store().FileInfo().PermanentDelete(th.Context, info.Id)

		// Try to move to empty destination
		appErr = th.App.MoveFile(info.Path, "")
		require.NotNil(t, appErr)
		assert.Equal(t, "api.file.move_file.app_error", appErr.Id)
	})
}

func TestAppendFile_ErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("append to non-existent file", func(t *testing.T) {
		reader := strings.NewReader("append content")
		written, appErr := th.App.AppendFile(reader, "nonexistent/file.txt")
		assert.Equal(t, int64(0), written)
		require.NotNil(t, appErr)
		assert.Equal(t, "api.file.append_file.app_error", appErr.Id)
		assert.Equal(t, http.StatusInternalServerError, appErr.StatusCode)
	})
}

func TestListDirectory_ErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("list non-existent directory", func(t *testing.T) {
		paths, appErr := th.App.ListDirectory("nonexistent/directory")
		assert.Empty(t, paths)
		require.NotNil(t, appErr)
		assert.Equal(t, "api.file.list_directory.app_error", appErr.Id)
		assert.Equal(t, http.StatusInternalServerError, appErr.StatusCode)
	})
}

func TestRemoveDirectory_ErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("remove non-existent directory", func(t *testing.T) {
		appErr := th.App.RemoveDirectory("nonexistent/directory")
		require.NotNil(t, appErr)
		assert.Equal(t, "api.file.remove_directory.app_error", appErr.Id)
		assert.Equal(t, http.StatusInternalServerError, appErr.StatusCode)
	})
}

func TestSetFileSearchableContent_ErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("set content for non-existent file", func(t *testing.T) {
		appErr := th.App.SetFileSearchableContent(th.Context, model.NewId(), "searchable content")
		require.NotNil(t, appErr)
		assert.Equal(t, "app.file_info.set_searchable_content.app_error", appErr.Id)
		assert.Equal(t, http.StatusNotFound, appErr.StatusCode)
	})
}

func TestCheckMandatoryS3Fields_ErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("missing S3 bucket", func(t *testing.T) {
		settings := &model.FileSettings{
			DriverName:                         model.NewPointer(model.ImageDriverS3),
			AmazonS3AccessKeyId:                model.NewPointer("test-key"),
			AmazonS3SecretAccessKey:            model.NewPointer("test-secret"),
			AmazonS3Bucket:                     model.NewPointer(""),
			AmazonS3PathPrefix:                 model.NewPointer(""),
			AmazonS3Region:                     model.NewPointer("us-east-1"),
			AmazonS3Endpoint:                   model.NewPointer(""),
			AmazonS3SSL:                        model.NewPointer(true),
			AmazonS3SignV2:                     model.NewPointer(false),
			AmazonS3SSE:                        model.NewPointer(false),
			AmazonS3Trace:                      model.NewPointer(false),
			AmazonS3RequestTimeoutMilliseconds: model.NewPointer(int64(5000)),
		}

		appErr := th.App.CheckMandatoryS3Fields(settings)
		require.NotNil(t, appErr)
		assert.Equal(t, "api.admin.test_s3.missing_s3_bucket", appErr.Id)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})
}

func TestTestFileStoreConnectionWithConfig_ErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("invalid S3 credentials", func(t *testing.T) {
		settings := &model.FileSettings{
			DriverName:                         model.NewPointer(model.ImageDriverS3),
			AmazonS3AccessKeyId:                model.NewPointer("invalid-key"),
			AmazonS3SecretAccessKey:            model.NewPointer("invalid-secret"),
			AmazonS3Bucket:                     model.NewPointer("test-bucket"),
			AmazonS3PathPrefix:                 model.NewPointer(""),
			AmazonS3Region:                     model.NewPointer("us-east-1"),
			AmazonS3Endpoint:                   model.NewPointer("s3.amazonaws.com"),
			AmazonS3SSL:                        model.NewPointer(true),
			AmazonS3SignV2:                     model.NewPointer(false),
			AmazonS3SSE:                        model.NewPointer(false),
			AmazonS3Trace:                      model.NewPointer(false),
			AmazonS3RequestTimeoutMilliseconds: model.NewPointer(int64(5000)),
		}

		appErr := th.App.TestFileStoreConnectionWithConfig(settings)
		require.NotNil(t, appErr)
		// Could be auth error or connection error depending on network
		assert.Contains(t, []string{"api.file.test_connection_s3_auth.app_error", "api.file.test_connection.app_error"}, appErr.Id)
		assert.Equal(t, http.StatusInternalServerError, appErr.StatusCode)
	})
}

func TestPermanentDeleteFilesByPost_ErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("delete files for non-existent post", func(t *testing.T) {
		// This should not error, just return gracefully
		appErr := th.App.PermanentDeleteFilesByPost(th.Context, model.NewId())
		require.Nil(t, appErr)
	})

	t.Run("delete files when file in storage missing", func(t *testing.T) {
		// Create a post with a file
		data := []byte("test content")
		info, appErr := th.App.UploadFile(th.Context, data, th.BasicChannel.Id, "test.txt")
		require.Nil(t, appErr)

		// Create a post
		post, _, appErr := th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "test post",
			FileIds:   []string{info.Id},
		}, th.BasicChannel, model.CreatePostFlags{})
		require.Nil(t, appErr)

		// Remove file from storage but keep in db
		appErr = th.App.RemoveFile(info.Path)
		require.Nil(t, appErr)

		// Delete files by post - should handle missing file gracefully
		appErr = th.App.PermanentDeleteFilesByPost(th.Context, post.Id)
		require.Nil(t, appErr)
	})
}

func TestUploadFileX_ImageProcessingErrors(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("corrupted image data", func(t *testing.T) {
		// Create corrupted PNG data
		corruptedPNG := []byte{
			0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
			0x00, 0x00, 0x00, 0x0D, 0xFF, 0xFF, 0xFF, 0xFF, // Corrupted IHDR
		}

		info, appErr := th.App.UploadFileX(
			th.Context,
			th.BasicChannel.Id,
			"corrupted.png",
			bytes.NewReader(corruptedPNG),
		)
		// Should still upload but without preview generation
		require.Nil(t, appErr)
		require.NotNil(t, info)
		defer th.App.RemoveFile(info.Path)
		defer th.App.Srv().Store().FileInfo().PermanentDelete(th.Context, info.Id)
	})

	t.Run("SVG with invalid content", func(t *testing.T) {
		invalidSVG := []byte(`<svg xmlns="http://www.w3.org/2000/svg" width="invalid" height="invalid"></svg>`)

		info, appErr := th.App.UploadFileX(
			th.Context,
			th.BasicChannel.Id,
			"invalid.svg",
			bytes.NewReader(invalidSVG),
			UploadFileSetRaw(),
		)
		require.Nil(t, appErr)
		require.NotNil(t, info)
		assert.False(t, info.HasPreviewImage)
		defer th.App.RemoveFile(info.Path)
		defer th.App.Srv().Store().FileInfo().PermanentDelete(th.Context, info.Id)
	})
}

func TestWriteZipFile_ErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("write to failing writer", func(t *testing.T) {
		fileDatas := []model.FileData{
			{
				Filename: "test.txt",
				Body:     []byte("test content"),
			},
		}

		// Use a writer that fails
		failWriter := &failingWriter{failAfter: 10}
		err := th.App.WriteZipFile(failWriter, fileDatas)
		require.NotNil(t, err)
		assert.Contains(t, err.Error(), "write failed")
	})
}

// failingWriter is a writer that fails after writing a certain number of bytes
type failingWriter struct {
	written   int
	failAfter int
}

func (w *failingWriter) Write(p []byte) (n int, err error) {
	if w.written+len(p) > w.failAfter {
		return 0, fmt.Errorf("write failed")
	}
	w.written += len(p)
	return len(p), nil
}

func TestFilterFilesByChannelPermissions_EdgeCases(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("empty file list", func(t *testing.T) {
		fileList := &model.FileInfoList{
			FileInfos: map[string]*model.FileInfo{},
			Order:     []string{},
		}
		allHaveMembership, appErr := th.App.FilterFilesByChannelPermissions(th.Context, fileList, th.BasicUser.Id)
		require.Nil(t, appErr)
		assert.True(t, allHaveMembership)
	})

	t.Run("nil file list", func(t *testing.T) {
		allHaveMembership, appErr := th.App.FilterFilesByChannelPermissions(th.Context, nil, th.BasicUser.Id)
		require.Nil(t, appErr)
		assert.True(t, allHaveMembership)
	})

	t.Run("files from deleted channel", func(t *testing.T) {
		// Create a channel
		channel, appErr := th.App.CreateChannel(th.Context, &model.Channel{
			TeamId:      th.BasicTeam.Id,
			Type:        model.ChannelTypeOpen,
			Name:        "test-channel",
			DisplayName: "Test Channel",
		}, false)
		require.Nil(t, appErr)

		// Upload a file
		data := []byte("test content")
		info, appErr := th.App.UploadFile(th.Context, data, channel.Id, "test.txt")
		require.Nil(t, appErr)
		defer th.App.RemoveFile(info.Path)
		defer th.App.Srv().Store().FileInfo().PermanentDelete(th.Context, info.Id)

		// Delete the channel
		appErr = th.App.DeleteChannel(th.Context, channel, th.BasicUser.Id)
		require.Nil(t, appErr)

		// Try to filter files
		fileList := &model.FileInfoList{
			FileInfos: map[string]*model.FileInfo{
				info.Id: info,
			},
			Order: []string{info.Id},
		}
		allHaveMembership, appErr := th.App.FilterFilesByChannelPermissions(th.Context, fileList, th.BasicUser.Id)
		require.Nil(t, appErr)
		assert.False(t, allHaveMembership)
		assert.Empty(t, fileList.FileInfos)
	})
}

func TestFileModTime_ErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("get mod time of non-existent file", func(t *testing.T) {
		modTime, appErr := th.App.FileModTime("nonexistent/file.txt")
		require.NotNil(t, appErr)
		assert.True(t, modTime.IsZero())
		assert.Equal(t, "api.file.file_mod_time.app_error", appErr.Id)
		assert.Equal(t, http.StatusInternalServerError, appErr.StatusCode)
	})
}

func TestZipReader_ErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("zip reader for non-existent file", func(t *testing.T) {
		_, appErr := th.App.ZipReader("nonexistent/file.zip", true)
		require.NotNil(t, appErr)
		assert.Equal(t, "api.file.zip_file_reader.app_error", appErr.Id)
		assert.Equal(t, http.StatusInternalServerError, appErr.StatusCode)
	})
}

func TestExtractContentFromFileInfo_EdgeCases(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("extract from image file", func(t *testing.T) {
		// Create a simple PNG file info
		info := &model.FileInfo{
			Id:       model.NewId(),
			Name:     "test.png",
			MimeType: "image/png",
			Path:     "test/path.png",
		}

		// Should return nil for images
		err := th.App.ExtractContentFromFileInfo(th.Context, info)
		require.Nil(t, err)
	})

	t.Run("extract from file not in storage", func(t *testing.T) {
		info := &model.FileInfo{
			Id:       model.NewId(),
			Name:     "test.txt",
			MimeType: "text/plain",
			Path:     "nonexistent/path.txt",
		}

		err := th.App.ExtractContentFromFileInfo(th.Context, info)
		require.NotNil(t, err)
		assert.Contains(t, err.Error(), "failed to open file")
	})
}
