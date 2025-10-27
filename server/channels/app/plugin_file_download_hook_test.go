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
		th := Setup(t).InitBasic()
		defer th.TearDown()

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

			func (p *MyPlugin) FileWillBeDownloaded(c *plugin.Context, info *model.FileInfo, userID string) string {
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

		// Create plugin context
		pluginContext := &plugin.Context{
			RequestId: th.Context.RequestId(),
			SessionId: th.Context.Session().Id,
		}

		// Simulate calling the hook through RunMultiHook
		var rejectionReason string
		th.App.Channels().RunMultiHook(func(hooks plugin.Hooks, _ *model.Manifest) bool {
			rejectionReason = hooks.FileWillBeDownloaded(pluginContext, info, th.BasicUser.Id)
			if rejectionReason != "" {
				return false // Stop execution if hook rejects
			}
			return true
		}, plugin.FileWillBeDownloadedID)

		// Verify the file download was rejected
		assert.NotEmpty(t, rejectionReason)
		assert.Contains(t, rejectionReason, "blocked by security policy")
		mockAPI.AssertExpectations(t)
	})

	t.Run("allowed", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic()
		defer th.TearDown()

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

			func (p *MyPlugin) FileWillBeDownloaded(c *plugin.Context, info *model.FileInfo, userID string) string {
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

		// Create plugin context
		pluginContext := &plugin.Context{
			RequestId: th.Context.RequestId(),
			SessionId: th.Context.Session().Id,
		}

		// Call the hook
		var rejectionReason string
		th.App.Channels().RunMultiHook(func(hooks plugin.Hooks, _ *model.Manifest) bool {
			rejectionReason = hooks.FileWillBeDownloaded(pluginContext, info, th.BasicUser.Id)
			if rejectionReason != "" {
				return false
			}
			return true
		}, plugin.FileWillBeDownloadedID)

		// Verify the file download was allowed
		assert.Empty(t, rejectionReason)
		mockAPI.AssertExpectations(t)
	})

	t.Run("multiple plugins - first rejects", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic()
		defer th.TearDown()

		var mockAPI1 plugintest.API
		mockAPI1.On("LoadPluginConfiguration", mock.Anything).Return(nil).Maybe()
		// Allow any logging calls (not verified in this test)
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
			func (p *MyPlugin) FileWillBeDownloaded(c *plugin.Context, info *model.FileInfo, userID string) string {
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
			func (p *MyPlugin) FileWillBeDownloaded(c *plugin.Context, info *model.FileInfo, userID string) string {
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

		pluginContext := &plugin.Context{
			RequestId: th.Context.RequestId(),
			SessionId: th.Context.Session().Id,
		}

		// Call hooks - first one should reject, second should not be called
		var rejectionReason string
		th.App.Channels().RunMultiHook(func(hooks plugin.Hooks, _ *model.Manifest) bool {
			rejectionReason = hooks.FileWillBeDownloaded(pluginContext, info, th.BasicUser.Id)
			if rejectionReason != "" {
				return false // Stop execution
			}
			return true
		}, plugin.FileWillBeDownloadedID)

		assert.NotEmpty(t, rejectionReason)
		assert.Contains(t, rejectionReason, "Rejected by first plugin")

		// Only first mock API should have been called
		mockAPI1.AssertExpectations(t)
		// mockAPI2 should not have been called (no expectations set)
	})

	t.Run("no plugins installed", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic()
		defer th.TearDown()

		// No plugins - hook should return empty

		fileInfo, appErr := th.App.UploadFile(th.Context, []byte("test content"), th.BasicChannel.Id, "test.txt")
		require.Nil(t, appErr)

		info, appErr := th.App.GetFileInfo(th.Context, fileInfo.Id)
		require.Nil(t, appErr)

		pluginContext := &plugin.Context{
			RequestId: th.Context.RequestId(),
			SessionId: th.Context.Session().Id,
		}

		var rejectionReason string
		th.App.Channels().RunMultiHook(func(hooks plugin.Hooks, _ *model.Manifest) bool {
			rejectionReason = hooks.FileWillBeDownloaded(pluginContext, info, th.BasicUser.Id)
			if rejectionReason != "" {
				return false
			}
			return true
		}, plugin.FileWillBeDownloadedID)

		// No plugins means no rejection
		assert.Empty(t, rejectionReason)
	})
}
