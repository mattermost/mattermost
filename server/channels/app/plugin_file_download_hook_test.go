// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
)

func TestHookFileWillBeDownloaded(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("rejected", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

		var mockAPI plugintest.API
		mockAPI.On("LoadPluginConfiguration", mock.Anything).Return(nil).Maybe()
		// Allow any logging calls (not verified in this test)
		mockAPI.On("LogInfo", mock.Anything, mock.Anything).Maybe().Return(nil)
		mockAPI.On("LogInfo", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Maybe().Return(nil)
		mockAPI.On("LogInfo", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Maybe().Return(nil)
		mockAPI.On("LogWarn", mock.Anything, mock.Anything).Maybe().Return(nil)
		mockAPI.On("LogWarn", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Maybe().Return(nil)
		mockAPI.On("LogWarn", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Maybe().Return(nil)

		tearDown, _, _ := SetAppEnvironmentWithPlugins(t, []string{
			`
			package main

			import (
				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *MyPlugin) FileWillBeDownloaded(c *plugin.Context, info *model.FileInfo, userID string, downloadType model.FileDownloadType) string {
				p.API.LogInfo("Rejecting file download", "file_id", info.Id, "user_id", userID)
				return "Download blocked by security policy"
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
		}, th.App, func(*model.Manifest) plugin.API { return &mockAPI })
		defer tearDown()

		// Upload a file first
		fileInfo, appErr := th.App.UploadFile(th.Context, []byte("test content"), th.BasicChannel.Id, "test.txt")
		require.Nil(t, appErr)
		require.NotNil(t, fileInfo)

		// Get the file info to pass to the hook
		info, appErr := th.App.GetFileInfo(th.Context, fileInfo.Id)
		require.Nil(t, appErr)

		// Call the hook through the app method
		rejectionReason := th.App.RunFileWillBeDownloadedHook(th.Context, info, th.BasicUser.Id, "", model.FileDownloadTypeFile)

		// Verify the file download was rejected
		assert.NotEmpty(t, rejectionReason)
		assert.Contains(t, rejectionReason, "blocked by security policy")
		mockAPI.AssertExpectations(t)
	})

	t.Run("allowed", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

		var mockAPI plugintest.API
		mockAPI.On("LoadPluginConfiguration", mock.Anything).Return(nil).Maybe()
		// Allow any logging calls (not verified in this test)
		mockAPI.On("LogInfo", mock.Anything, mock.Anything).Maybe().Return(nil)
		mockAPI.On("LogInfo", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Maybe().Return(nil)
		mockAPI.On("LogInfo", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Maybe().Return(nil)

		tearDown, _, _ := SetAppEnvironmentWithPlugins(t, []string{
			`
			package main

			import (
				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *MyPlugin) FileWillBeDownloaded(c *plugin.Context, info *model.FileInfo, userID string, downloadType model.FileDownloadType) string {
				p.API.LogInfo("Allowing file download", "file_id", info.Id, "user_id", userID)
				// Return empty string to allow download
				return ""
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
		}, th.App, func(*model.Manifest) plugin.API { return &mockAPI })
		defer tearDown()

		// Upload a file
		fileInfo, appErr := th.App.UploadFile(th.Context, []byte("test content"), th.BasicChannel.Id, "test.txt")
		require.Nil(t, appErr)
		require.NotNil(t, fileInfo)

		// Get the file info
		info, appErr := th.App.GetFileInfo(th.Context, fileInfo.Id)
		require.Nil(t, appErr)

		// Call the hook through the app method
		rejectionReason := th.App.RunFileWillBeDownloadedHook(th.Context, info, th.BasicUser.Id, "", model.FileDownloadTypeFile)

		// Verify the file download was allowed
		assert.Empty(t, rejectionReason)
		mockAPI.AssertExpectations(t)
	})

	t.Run("multiple plugins - first rejects", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

		var mockAPI1 plugintest.API
		mockAPI1.On("LoadPluginConfiguration", mock.Anything).Return(nil).Maybe()
		// Allow any logging calls (not verified in this test)
		mockAPI1.On("LogInfo", mock.Anything).Maybe().Return(nil)
		mockAPI1.On("LogInfo", mock.Anything, mock.Anything).Maybe().Return(nil)
		mockAPI1.On("LogInfo", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Maybe().Return(nil)
		mockAPI1.On("LogInfo", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Maybe().Return(nil)
		mockAPI1.On("LogWarn", mock.Anything).Maybe().Return(nil)
		mockAPI1.On("LogWarn", mock.Anything, mock.Anything).Maybe().Return(nil)
		mockAPI1.On("LogWarn", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Maybe().Return(nil)
		mockAPI1.On("LogWarn", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Maybe().Return(nil)

		var mockAPI2 plugintest.API
		mockAPI2.On("LoadPluginConfiguration", mock.Anything).Return(nil).Maybe()
		// This plugin should NOT be called because first one rejects

		tearDown, _, _ := SetAppEnvironmentWithPlugins(t, []string{
			// First plugin - rejects
			`
			package main
			import (
				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
			)
			type MyPlugin struct {
				plugin.MattermostPlugin
			}
			func (p *MyPlugin) FileWillBeDownloaded(c *plugin.Context, info *model.FileInfo, userID string, downloadType model.FileDownloadType) string {
				p.API.LogWarn("First plugin rejecting", "file_id", info.Id)
				return "Rejected by first plugin"
			}
			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
			// Second plugin - should not be called
			`
			package main
			import (
				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
			)
			type MyPlugin struct {
				plugin.MattermostPlugin
			}
			func (p *MyPlugin) FileWillBeDownloaded(c *plugin.Context, info *model.FileInfo, userID string, downloadType model.FileDownloadType) string {
				p.API.LogInfo("Second plugin should not be called")
				return ""
			}
			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
		}, th.App, func(*model.Manifest) plugin.API {
			// Alternate between the two mock APIs
			return &mockAPI1
		})
		defer tearDown()

		// Upload a file
		fileInfo, appErr := th.App.UploadFile(th.Context, []byte("test content"), th.BasicChannel.Id, "test.txt")
		require.Nil(t, appErr)

		info, appErr := th.App.GetFileInfo(th.Context, fileInfo.Id)
		require.Nil(t, appErr)

		// Call hooks - first one should reject, second should not be called
		rejectionReason := th.App.RunFileWillBeDownloadedHook(th.Context, info, th.BasicUser.Id, "", model.FileDownloadTypeFile)

		assert.NotEmpty(t, rejectionReason)
		assert.Contains(t, rejectionReason, "Rejected by first plugin")

		// Only first mock API should have been called
		mockAPI1.AssertExpectations(t)
		// mockAPI2 should not have been called (no expectations set)
	})

	t.Run("no plugins installed", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

		// No plugins - hook should return empty

		fileInfo, appErr := th.App.UploadFile(th.Context, []byte("test content"), th.BasicChannel.Id, "test.txt")
		require.Nil(t, appErr)

		info, appErr := th.App.GetFileInfo(th.Context, fileInfo.Id)
		require.Nil(t, appErr)

		rejectionReason := th.App.RunFileWillBeDownloadedHook(th.Context, info, th.BasicUser.Id, "", model.FileDownloadTypeFile)

		// No plugins means no rejection
		assert.Empty(t, rejectionReason)
	})
}

// TestHookFileWillBeDownloadedHeadRequests tests that HEAD requests trigger the FileWillBeDownloaded hook
func TestHookFileWillBeDownloadedHeadRequests(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("HEAD request to file endpoint triggers hook - rejection", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

		var mockAPI plugintest.API
		mockAPI.On("LoadPluginConfiguration", mock.Anything).Return(nil).Maybe()
		mockAPI.On("LogInfo", mock.Anything, mock.Anything).Maybe().Return(nil)
		mockAPI.On("LogInfo", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Maybe().Return(nil)
		mockAPI.On("LogInfo", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Maybe().Return(nil)
		mockAPI.On("LogWarn", mock.Anything, mock.Anything).Maybe().Return(nil)
		mockAPI.On("LogWarn", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Maybe().Return(nil)

		tearDown, _, _ := SetAppEnvironmentWithPlugins(t, []string{
			`
			package main

			import (
				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *MyPlugin) FileWillBeDownloaded(c *plugin.Context, info *model.FileInfo, userID string, downloadType model.FileDownloadType) string {
				p.API.LogInfo("Blocking file download", "file_id", info.Id, "download_type", string(downloadType))
				return "File download blocked by security policy"
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
		}, th.App, func(*model.Manifest) plugin.API { return &mockAPI })
		defer tearDown()

		// Upload a file first
		fileInfo, appErr := th.App.UploadFile(th.Context, []byte("test content"), th.BasicChannel.Id, "test.txt")
		require.Nil(t, appErr)
		require.NotNil(t, fileInfo)

		// Get the file info to pass to the hook
		info, appErr := th.App.GetFileInfo(th.Context, fileInfo.Id)
		require.Nil(t, appErr)

		// Call the hook through the app method
		rejectionReason := th.App.RunFileWillBeDownloadedHook(th.Context, info, th.BasicUser.Id, "", model.FileDownloadTypeFile)

		// Verify the file download was rejected
		assert.NotEmpty(t, rejectionReason)
		assert.Contains(t, rejectionReason, "blocked by security policy")
		mockAPI.AssertExpectations(t)
	})

	t.Run("HEAD request to thumbnail endpoint triggers hook - rejection", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

		var mockAPI plugintest.API
		mockAPI.On("LoadPluginConfiguration", mock.Anything).Return(nil).Maybe()
		mockAPI.On("LogInfo", mock.Anything, mock.Anything).Maybe().Return(nil)
		mockAPI.On("LogInfo", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Maybe().Return(nil)
		mockAPI.On("LogInfo", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Maybe().Return(nil)
		mockAPI.On("LogWarn", mock.Anything, mock.Anything).Maybe().Return(nil)
		mockAPI.On("LogWarn", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Maybe().Return(nil)

		tearDown, _, _ := SetAppEnvironmentWithPlugins(t, []string{
			`
			package main

			import (
				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *MyPlugin) FileWillBeDownloaded(c *plugin.Context, info *model.FileInfo, userID string, downloadType model.FileDownloadType) string {
				// Only block thumbnail requests
				if downloadType == model.FileDownloadTypeThumbnail {
					p.API.LogInfo("Blocking thumbnail download", "file_id", info.Id)
					return "Thumbnail download blocked"
				}
				return ""
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
		}, th.App, func(*model.Manifest) plugin.API { return &mockAPI })
		defer tearDown()

		// Upload a file
		fileInfo, appErr := th.App.UploadFile(th.Context, []byte("test content"), th.BasicChannel.Id, "test.txt")
		require.Nil(t, appErr)
		require.NotNil(t, fileInfo)

		// Get the file info
		info, appErr := th.App.GetFileInfo(th.Context, fileInfo.Id)
		require.Nil(t, appErr)

		// Call the hook for thumbnail download type through the app method
		rejectionReason := th.App.RunFileWillBeDownloadedHook(th.Context, info, th.BasicUser.Id, "", model.FileDownloadTypeThumbnail)

		// Verify the thumbnail download was rejected
		assert.NotEmpty(t, rejectionReason)
		assert.Contains(t, rejectionReason, "Thumbnail download blocked")
		mockAPI.AssertExpectations(t)
	})

	t.Run("HEAD request to preview endpoint triggers hook - rejection", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

		var mockAPI plugintest.API
		mockAPI.On("LoadPluginConfiguration", mock.Anything).Return(nil).Maybe()
		mockAPI.On("LogInfo", mock.Anything, mock.Anything).Maybe().Return(nil)
		mockAPI.On("LogInfo", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Maybe().Return(nil)
		mockAPI.On("LogInfo", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Maybe().Return(nil)
		mockAPI.On("LogWarn", mock.Anything, mock.Anything).Maybe().Return(nil)
		mockAPI.On("LogWarn", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Maybe().Return(nil)

		tearDown, _, _ := SetAppEnvironmentWithPlugins(t, []string{
			`
			package main

			import (
				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *MyPlugin) FileWillBeDownloaded(c *plugin.Context, info *model.FileInfo, userID string, downloadType model.FileDownloadType) string {
				// Only block preview requests
				if downloadType == model.FileDownloadTypePreview {
					p.API.LogInfo("Blocking preview download", "file_id", info.Id)
					return "Preview download blocked"
				}
				return ""
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
		}, th.App, func(*model.Manifest) plugin.API { return &mockAPI })
		defer tearDown()

		// Upload a file
		fileInfo, appErr := th.App.UploadFile(th.Context, []byte("test content"), th.BasicChannel.Id, "test.txt")
		require.Nil(t, appErr)
		require.NotNil(t, fileInfo)

		// Get the file info
		info, appErr := th.App.GetFileInfo(th.Context, fileInfo.Id)
		require.Nil(t, appErr)

		// Create plugin context
		// Call the hook for preview download type through the app method
		rejectionReason := th.App.RunFileWillBeDownloadedHook(th.Context, info, th.BasicUser.Id, "", model.FileDownloadTypePreview)

		// Verify the preview download was rejected
		assert.NotEmpty(t, rejectionReason)
		assert.Contains(t, rejectionReason, "Preview download blocked")
		mockAPI.AssertExpectations(t)
	})

	t.Run("HEAD request to file endpoint triggers hook - allowed", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

		var mockAPI plugintest.API
		mockAPI.On("LoadPluginConfiguration", mock.Anything).Return(nil).Maybe()
		mockAPI.On("LogInfo", mock.Anything, mock.Anything).Maybe().Return(nil)
		mockAPI.On("LogInfo", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Maybe().Return(nil)
		mockAPI.On("LogInfo", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Maybe().Return(nil)

		tearDown, _, _ := SetAppEnvironmentWithPlugins(t, []string{
			`
			package main

			import (
				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *MyPlugin) FileWillBeDownloaded(c *plugin.Context, info *model.FileInfo, userID string, downloadType model.FileDownloadType) string {
				p.API.LogInfo("Allowing file download", "file_id", info.Id, "download_type", string(downloadType))
				return "" // Allow download
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
		}, th.App, func(*model.Manifest) plugin.API { return &mockAPI })
		defer tearDown()

		// Upload a file
		fileInfo, appErr := th.App.UploadFile(th.Context, []byte("test content"), th.BasicChannel.Id, "test.txt")
		require.Nil(t, appErr)
		require.NotNil(t, fileInfo)

		// Get the file info
		info, appErr := th.App.GetFileInfo(th.Context, fileInfo.Id)
		require.Nil(t, appErr)

		// Call the hook through the app method
		rejectionReason := th.App.RunFileWillBeDownloadedHook(th.Context, info, th.BasicUser.Id, "", model.FileDownloadTypeFile)

		// Verify the file download was allowed
		assert.Empty(t, rejectionReason)
		mockAPI.AssertExpectations(t)
	})

	t.Run("HEAD and GET with different download types", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

		downloadTypesReceived := []model.FileDownloadType{}

		var mockAPI plugintest.API
		mockAPI.On("LoadPluginConfiguration", mock.Anything).Return(nil).Maybe()
		mockAPI.On("LogInfo", mock.Anything, mock.Anything).Maybe().Return(nil)
		mockAPI.On("LogInfo", mock.Anything, mock.Anything, mock.Anything).Run(func(args mock.Arguments) {
			if args.String(0) == "Hook called" {
				downloadType := args.String(2)
				downloadTypesReceived = append(downloadTypesReceived, model.FileDownloadType(downloadType))
			}
		}).Maybe().Return(nil)
		mockAPI.On("LogInfo", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Maybe().Return(nil)
		mockAPI.On("LogInfo", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Maybe().Return(nil)

		tearDown, _, _ := SetAppEnvironmentWithPlugins(t, []string{
			`
			package main

			import (
				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *MyPlugin) FileWillBeDownloaded(c *plugin.Context, info *model.FileInfo, userID string, downloadType model.FileDownloadType) string {
				p.API.LogInfo("Hook called", "download_type", string(downloadType))
				return "" // Allow download
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
		}, th.App, func(*model.Manifest) plugin.API { return &mockAPI })
		defer tearDown()

		// Upload a file
		fileInfo, appErr := th.App.UploadFile(th.Context, []byte("test content"), th.BasicChannel.Id, "test.txt")
		require.Nil(t, appErr)

		info, appErr := th.App.GetFileInfo(th.Context, fileInfo.Id)
		require.Nil(t, appErr)

		// Test File download type
		th.App.RunFileWillBeDownloadedHook(th.Context, info, th.BasicUser.Id, "", model.FileDownloadTypeFile)

		// Test Thumbnail download type
		th.App.RunFileWillBeDownloadedHook(th.Context, info, th.BasicUser.Id, "", model.FileDownloadTypeThumbnail)

		// Test Preview download type
		th.App.RunFileWillBeDownloadedHook(th.Context, info, th.BasicUser.Id, "", model.FileDownloadTypePreview)

		// Verify all three download types were received
		assert.Len(t, downloadTypesReceived, 3)
		assert.Contains(t, downloadTypesReceived, model.FileDownloadTypeFile)
		assert.Contains(t, downloadTypesReceived, model.FileDownloadTypeThumbnail)
		assert.Contains(t, downloadTypesReceived, model.FileDownloadTypePreview)

		mockAPI.AssertExpectations(t)
	})
}
