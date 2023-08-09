package pluginapi_test

import (
	"bytes"
	"io"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/stretchr/testify/require"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
)

func TestGetFile(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("GetFile", "1").Return([]byte{2}, nil)

		content, err := client.File.Get("1")
		require.NoError(t, err)
		contentBytes, err := io.ReadAll(content)
		require.NoError(t, err)
		require.Equal(t, []byte{2}, contentBytes)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		appErr := newAppError()

		api.On("GetFile", "1").Return(nil, appErr)

		content, err := client.File.Get("1")
		require.Equal(t, appErr, err)
		require.Zero(t, content)
	})
}

func TestGetFileByPath(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("ReadFile", "1").Return([]byte{2}, nil)

		content, err := client.File.GetByPath("1")
		require.NoError(t, err)
		contentBytes, err := io.ReadAll(content)
		require.NoError(t, err)
		require.Equal(t, []byte{2}, contentBytes)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		appErr := newAppError()

		api.On("ReadFile", "1").Return(nil, appErr)

		content, err := client.File.GetByPath("1")
		require.Equal(t, appErr, err)
		require.Zero(t, content)
	})
}

func TestGetFileInfo(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("GetFileInfo", "1").Return(&model.FileInfo{Id: "2"}, nil)

		info, err := client.File.GetInfo("1")
		require.NoError(t, err)
		require.Equal(t, "2", info.Id)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		appErr := newAppError()

		api.On("GetFileInfo", "1").Return(nil, appErr)

		info, err := client.File.GetInfo("1")
		require.Equal(t, appErr, err)
		require.Zero(t, info)
	})
}

func TestGetFileLink(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("GetFileLink", "1").Return("2", nil)

		link, err := client.File.GetLink("1")
		require.NoError(t, err)
		require.Equal(t, "2", link)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		appErr := newAppError()

		api.On("GetFileLink", "1").Return("", appErr)

		link, err := client.File.GetLink("1")
		require.Equal(t, appErr, err)
		require.Zero(t, link)
	})
}

func TestUploadFile(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("UploadFile", []byte{1}, "3", "2").Return(&model.FileInfo{Id: "4"}, nil)

		info, err := client.File.Upload(bytes.NewReader([]byte{1}), "2", "3")
		require.NoError(t, err)
		require.Equal(t, "4", info.Id)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		appErr := newAppError()

		api.On("UploadFile", []byte{1}, "3", "2").Return(nil, appErr)

		info, err := client.File.Upload(bytes.NewReader([]byte{1}), "2", "3")
		require.Equal(t, appErr, err)
		require.Zero(t, info)
	})
}

func TestCopyFileInfos(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("CopyFileInfos", "3", []string{"1", "2"}).Return([]string{"4", "5"}, nil)

		newIDs, err := client.File.CopyInfos([]string{"1", "2"}, "3")
		require.NoError(t, err)
		require.Equal(t, []string{"4", "5"}, newIDs)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		appErr := newAppError()

		api.On("CopyFileInfos", "3", []string{"1", "2"}).Return(nil, appErr)

		newIDs, err := client.File.CopyInfos([]string{"1", "2"}, "3")
		require.Equal(t, appErr, err)
		require.Zero(t, newIDs)
	})
}
