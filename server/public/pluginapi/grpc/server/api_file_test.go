// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package server

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	pb "github.com/mattermost/mattermost/server/public/pluginapi/grpc/generated/go/pluginapiv1"
)

// =============================================================================
// File API Tests
// =============================================================================

func TestGetFileInfo(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	expectedFileInfo := &model.FileInfo{
		Id:        "file_id_123",
		CreatorId: "user_id_abc",
		PostId:    "post_id_xyz",
		ChannelId: "channel_id_xyz",
		Name:      "test.txt",
		Extension: "txt",
		Size:      1024,
		MimeType:  "text/plain",
	}

	h.mockAPI.On("GetFileInfo", "file_id_123").Return(expectedFileInfo, nil)

	resp, err := h.client.GetFileInfo(context.Background(), &pb.GetFileInfoRequest{
		FileId: "file_id_123",
	})

	require.NoError(t, err)
	assert.Nil(t, resp.Error)
	assert.NotNil(t, resp.FileInfo)
	assert.Equal(t, "file_id_123", resp.FileInfo.Id)
	assert.Equal(t, "test.txt", resp.FileInfo.Name)
	assert.Equal(t, "txt", resp.FileInfo.Extension)
	assert.Equal(t, int64(1024), resp.FileInfo.Size)
	h.mockAPI.AssertExpectations(t)
}

func TestGetFileInfo_NotFound(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	h.mockAPI.On("GetFileInfo", "nonexistent").Return(nil, model.NewAppError("GetFileInfo", "app.file.get.not_found", nil, "", http.StatusNotFound))

	resp, err := h.client.GetFileInfo(context.Background(), &pb.GetFileInfoRequest{
		FileId: "nonexistent",
	})

	require.NoError(t, err)
	assert.NotNil(t, resp.Error)
	assert.Equal(t, int32(http.StatusNotFound), resp.Error.StatusCode)
	h.mockAPI.AssertExpectations(t)
}

func TestGetFile(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	expectedData := []byte("file content here")

	h.mockAPI.On("GetFile", "file_id_123").Return(expectedData, nil)

	resp, err := h.client.GetFile(context.Background(), &pb.GetFileRequest{
		FileId: "file_id_123",
	})

	require.NoError(t, err)
	assert.Nil(t, resp.Error)
	assert.Equal(t, expectedData, resp.Data)
	h.mockAPI.AssertExpectations(t)
}

func TestGetFile_Error(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	h.mockAPI.On("GetFile", "file_id_123").Return(nil, model.NewAppError("GetFile", "app.file.get.error", nil, "", http.StatusInternalServerError))

	resp, err := h.client.GetFile(context.Background(), &pb.GetFileRequest{
		FileId: "file_id_123",
	})

	require.NoError(t, err)
	assert.NotNil(t, resp.Error)
	assert.Equal(t, int32(http.StatusInternalServerError), resp.Error.StatusCode)
	h.mockAPI.AssertExpectations(t)
}

func TestGetFileLink(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	expectedLink := "https://example.com/files/file_id_123"

	h.mockAPI.On("GetFileLink", "file_id_123").Return(expectedLink, nil)

	resp, err := h.client.GetFileLink(context.Background(), &pb.GetFileLinkRequest{
		FileId: "file_id_123",
	})

	require.NoError(t, err)
	assert.Nil(t, resp.Error)
	assert.Equal(t, expectedLink, resp.Link)
	h.mockAPI.AssertExpectations(t)
}

func TestReadFile(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	expectedData := []byte("file content from path")

	h.mockAPI.On("ReadFile", "/plugins/my-plugin/data/test.txt").Return(expectedData, nil)

	resp, err := h.client.ReadFile(context.Background(), &pb.ReadFileRequest{
		Path: "/plugins/my-plugin/data/test.txt",
	})

	require.NoError(t, err)
	assert.Nil(t, resp.Error)
	assert.Equal(t, expectedData, resp.Data)
	h.mockAPI.AssertExpectations(t)
}

func TestReadFile_NotFound(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	h.mockAPI.On("ReadFile", "/nonexistent/path").Return(nil, model.NewAppError("ReadFile", "app.file.read.not_found", nil, "", http.StatusNotFound))

	resp, err := h.client.ReadFile(context.Background(), &pb.ReadFileRequest{
		Path: "/nonexistent/path",
	})

	require.NoError(t, err)
	assert.NotNil(t, resp.Error)
	assert.Equal(t, int32(http.StatusNotFound), resp.Error.StatusCode)
	h.mockAPI.AssertExpectations(t)
}

func TestUploadFile(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	expectedFileInfo := &model.FileInfo{
		Id:        "new_file_id",
		CreatorId: "plugin_id",
		PostId:    "",
		ChannelId: "channel_id_xyz",
		Name:      "uploaded.txt",
		Extension: "txt",
		Size:      42,
		MimeType:  "text/plain",
	}

	fileData := []byte("uploaded file content")

	h.mockAPI.On("UploadFile", fileData, "channel_id_xyz", "uploaded.txt").Return(expectedFileInfo, nil)

	resp, err := h.client.UploadFile(context.Background(), &pb.UploadFileRequest{
		Data:      fileData,
		ChannelId: "channel_id_xyz",
		Filename:  "uploaded.txt",
	})

	require.NoError(t, err)
	assert.Nil(t, resp.Error)
	assert.NotNil(t, resp.FileInfo)
	assert.Equal(t, "new_file_id", resp.FileInfo.Id)
	assert.Equal(t, "uploaded.txt", resp.FileInfo.Name)
	h.mockAPI.AssertExpectations(t)
}

func TestUploadFile_Error(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	fileData := []byte("uploaded file content")

	h.mockAPI.On("UploadFile", fileData, "channel_id_xyz", "uploaded.txt").Return(nil, model.NewAppError("UploadFile", "app.file.upload.error", nil, "", http.StatusForbidden))

	resp, err := h.client.UploadFile(context.Background(), &pb.UploadFileRequest{
		Data:      fileData,
		ChannelId: "channel_id_xyz",
		Filename:  "uploaded.txt",
	})

	require.NoError(t, err)
	assert.NotNil(t, resp.Error)
	assert.Equal(t, int32(http.StatusForbidden), resp.Error.StatusCode)
	h.mockAPI.AssertExpectations(t)
}

func TestCopyFileInfos(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	expectedFileIds := []string{"copied_file_id_1", "copied_file_id_2"}

	h.mockAPI.On("CopyFileInfos", "user_id_123", []string{"file_id_1", "file_id_2"}).Return(expectedFileIds, nil)

	resp, err := h.client.CopyFileInfos(context.Background(), &pb.CopyFileInfosRequest{
		UserId:  "user_id_123",
		FileIds: []string{"file_id_1", "file_id_2"},
	})

	require.NoError(t, err)
	assert.Nil(t, resp.Error)
	assert.Equal(t, expectedFileIds, resp.FileIds)
	h.mockAPI.AssertExpectations(t)
}

func TestSetFileSearchableContent(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	h.mockAPI.On("SetFileSearchableContent", "file_id_123", "searchable text content").Return(nil)

	resp, err := h.client.SetFileSearchableContent(context.Background(), &pb.SetFileSearchableContentRequest{
		FileId:  "file_id_123",
		Content: "searchable text content",
	})

	require.NoError(t, err)
	assert.Nil(t, resp.Error)
	h.mockAPI.AssertExpectations(t)
}

func TestGetFileInfos(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	expectedFileInfos := []*model.FileInfo{
		{Id: "file_id_1", Name: "file1.txt"},
		{Id: "file_id_2", Name: "file2.txt"},
	}

	h.mockAPI.On("GetFileInfos", 0, 20, &model.GetFileInfosOptions{
		UserIds:        []string{"user_id_123"},
		IncludeDeleted: false,
		SortBy:         "CreateAt",
		SortDescending: true,
	}).Return(expectedFileInfos, nil)

	resp, err := h.client.GetFileInfos(context.Background(), &pb.GetFileInfosRequest{
		Page:    0,
		PerPage: 20,
		Options: &pb.GetFileInfosOptions{
			UserId:         "user_id_123",
			IncludeDeleted: false,
			SortBy:         "CreateAt",
			SortOrder:      "desc",
		},
	})

	require.NoError(t, err)
	assert.Nil(t, resp.Error)
	assert.Len(t, resp.FileInfos, 2)
	assert.Equal(t, "file_id_1", resp.FileInfos[0].Id)
	assert.Equal(t, "file_id_2", resp.FileInfos[1].Id)
	h.mockAPI.AssertExpectations(t)
}
