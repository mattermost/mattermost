package pluginapi

import (
	"bytes"
	"io/ioutil"
	"net/http"
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin/plugintest"
	"github.com/stretchr/testify/require"
)

func TestGetFile(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		client := NewClient(api)

		api.On("GetFile", "1").Return([]byte{2}, nil)

		content, err := client.File.Get("1")
		require.NoError(t, err)
		contentBytes, err := ioutil.ReadAll(content)
		require.NoError(t, err)
		require.Equal(t, []byte{2}, contentBytes)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		client := NewClient(api)

		aerr := model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError)

		api.On("GetFile", "1").Return(nil, aerr)

		content, err := client.File.Get("1")
		require.Equal(t, aerr, err)
		require.Zero(t, content)
	})
}

func TestGetFileByPath(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		client := NewClient(api)

		api.On("ReadFile", "1").Return([]byte{2}, nil)

		content, err := client.File.GetByPath("1")
		require.NoError(t, err)
		contentBytes, err := ioutil.ReadAll(content)
		require.NoError(t, err)
		require.Equal(t, []byte{2}, contentBytes)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		client := NewClient(api)

		aerr := model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError)

		api.On("ReadFile", "1").Return(nil, aerr)

		content, err := client.File.GetByPath("1")
		require.Equal(t, aerr, err)
		require.Zero(t, content)
	})
}

func TestGetFileInfo(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		client := NewClient(api)

		api.On("GetFileInfo", "1").Return(&model.FileInfo{Id: "2"}, nil)

		info, err := client.File.GetInfo("1")
		require.NoError(t, err)
		require.Equal(t, "2", info.Id)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		client := NewClient(api)

		aerr := model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError)

		api.On("GetFileInfo", "1").Return(nil, aerr)

		info, err := client.File.GetInfo("1")
		require.Equal(t, aerr, err)
		require.Zero(t, info)
	})
}

func TestGetFileLink(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		client := NewClient(api)

		api.On("GetFileLink", "1").Return("2", nil)

		link, err := client.File.GetLink("1")
		require.NoError(t, err)
		require.Equal(t, "2", link)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		client := NewClient(api)

		aerr := model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError)

		api.On("GetFileLink", "1").Return("", aerr)

		link, err := client.File.GetLink("1")
		require.Equal(t, aerr, err)
		require.Zero(t, link)
	})
}

func TestUploadFile(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		client := NewClient(api)

		api.On("UploadFile", []byte{1}, "3", "2").Return(&model.FileInfo{Id: "4"}, nil)

		info, err := client.File.Upload(bytes.NewReader([]byte{1}), "2", "3")
		require.NoError(t, err)
		require.Equal(t, "4", info.Id)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		client := NewClient(api)

		aerr := model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError)

		api.On("UploadFile", []byte{1}, "3", "2").Return(nil, aerr)

		info, err := client.File.Upload(bytes.NewReader([]byte{1}), "2", "3")
		require.Equal(t, aerr, err)
		require.Zero(t, info)
	})
}

func TestCopyFileInfos(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		client := NewClient(api)

		api.On("CopyFileInfos", "3", []string{"1", "2"}).Return([]string{"4", "5"}, nil)

		newIDs, err := client.File.CopyInfos([]string{"1", "2"}, "3")
		require.NoError(t, err)
		require.Equal(t, []string{"4", "5"}, newIDs)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		client := NewClient(api)

		aerr := model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError)

		api.On("CopyFileInfos", "3", []string{"1", "2"}).Return(nil, aerr)

		newIDs, err := client.File.CopyInfos([]string{"1", "2"}, "3")
		require.Equal(t, aerr, err)
		require.Zero(t, newIDs)
	})
}
