// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/utils/fileutils"
)

func TestIsPluginVisibleToUser(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	pluginID := "testplugin"
	allowedUserID := th.BasicUser.Id
	deniedUserID := th.BasicUser2.Id
	adminUserID := th.SystemAdminUser.Id

	t.Run("no access control entry means visible to everyone", func(t *testing.T) {
		assert.True(t, th.App.IsPluginVisibleToUser(th.Context, allowedUserID, pluginID))
		assert.True(t, th.App.IsPluginVisibleToUser(th.Context, deniedUserID, pluginID))
	})

	t.Run("access control disabled means visible to everyone", func(t *testing.T) {
		require.Nil(t, th.App.SetPluginAccessControl(th.Context, pluginID, &model.PluginAccessControlSettings{
			Enable:         false,
			AllowedUserIds: []string{allowedUserID},
		}))
		t.Cleanup(func() {
			th.App.UpdateConfig(func(cfg *model.Config) {
				delete(cfg.PluginSettings.PluginAccessControl, pluginID)
			})
			_ = th.App.Srv().Store().PluginAccessControl().DeleteByPlugin(th.Context, pluginID)
		})

		assert.True(t, th.App.IsPluginVisibleToUser(th.Context, deniedUserID, pluginID))
	})

	t.Run("access control enabled filters to allowed users and admins", func(t *testing.T) {
		require.Nil(t, th.App.SetPluginAccessControl(th.Context, pluginID, &model.PluginAccessControlSettings{
			Enable:         true,
			AllowedUserIds: []string{allowedUserID},
		}))
		t.Cleanup(func() {
			th.App.UpdateConfig(func(cfg *model.Config) {
				delete(cfg.PluginSettings.PluginAccessControl, pluginID)
			})
			_ = th.App.Srv().Store().PluginAccessControl().DeleteByPlugin(th.Context, pluginID)
		})

		assert.True(t, th.App.IsPluginVisibleToUser(th.Context, allowedUserID, pluginID))
		assert.False(t, th.App.IsPluginVisibleToUser(th.Context, deniedUserID, pluginID))
		assert.True(t, th.App.IsPluginVisibleToUser(th.Context, adminUserID, pluginID))
	})

	t.Run("empty user id returns true", func(t *testing.T) {
		require.Nil(t, th.App.SetPluginAccessControl(th.Context, pluginID, &model.PluginAccessControlSettings{
			Enable:         true,
			AllowedUserIds: []string{allowedUserID},
		}))
		t.Cleanup(func() {
			th.App.UpdateConfig(func(cfg *model.Config) {
				delete(cfg.PluginSettings.PluginAccessControl, pluginID)
			})
			_ = th.App.Srv().Store().PluginAccessControl().DeleteByPlugin(th.Context, pluginID)
		})

		assert.True(t, th.App.IsPluginVisibleToUser(th.Context, "", pluginID))
	})

	t.Run("opted-out plugin always visible even with access control enabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.Enable = true
		})
		require.Nil(t, th.App.SetPluginAccessControl(th.Context, pluginID, &model.PluginAccessControlSettings{
			Enable:         true,
			AllowedUserIds: []string{allowedUserID},
		}))
		t.Cleanup(func() {
			th.App.UpdateConfig(func(cfg *model.Config) {
				delete(cfg.PluginSettings.PluginAccessControl, pluginID)
			})
			_ = th.App.Srv().Store().PluginAccessControl().DeleteByPlugin(th.Context, pluginID)
		})

		path, _ := fileutils.FindDir("tests")
		fileReader, err := os.Open(filepath.Join(path, "testplugin.tar.gz"))
		require.NoError(t, err)
		defer fileReader.Close()

		_, appErr := th.App.WriteFile(fileReader, getBundleStorePath(pluginID))
		require.Nil(t, appErr)
		appErr = th.App.SyncPlugins()
		require.Nil(t, appErr)
		appErr = th.App.EnablePlugin(pluginID)
		require.Nil(t, appErr)
		t.Cleanup(func() {
			_ = th.App.ch.RemovePlugin(pluginID)
		})

		manifest := th.App.getPluginManifestByID(pluginID)
		require.NotNil(t, manifest)
		manifest.UserFiltering = model.NewPointer(false)

		assert.True(t, th.App.IsPluginVisibleToUser(th.Context, deniedUserID, pluginID))
		assert.True(t, th.App.IsPluginVisibleToUser(th.Context, allowedUserID, pluginID))
	})
}

func TestSetPluginAccessControlPreservesUsersWhenDisabled(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	pluginID := "testplugin-preserve-users"
	t.Cleanup(func() {
		th.App.UpdateConfig(func(cfg *model.Config) {
			delete(cfg.PluginSettings.PluginAccessControl, pluginID)
		})
		_ = th.App.Srv().Store().PluginAccessControl().DeleteByPlugin(th.Context, pluginID)
	})

	require.Nil(t, th.App.SetPluginAccessControl(th.Context, pluginID, &model.PluginAccessControlSettings{
		Enable:         true,
		AllowedUserIds: []string{th.BasicUser.Id},
	}))
	settings, appErr := th.App.GetPluginAccessControl(th.Context, pluginID)
	require.Nil(t, appErr)
	require.Equal(t, []string{th.BasicUser.Id}, settings.AllowedUserIds)

	// Everyone mode keeps the allow-list so re-enabling selected-users restores prior choices.
	require.Nil(t, th.App.SetPluginAccessControl(th.Context, pluginID, &model.PluginAccessControlSettings{
		Enable:         false,
		AllowedUserIds: []string{th.BasicUser.Id, th.BasicUser2.Id},
	}))
	settings, appErr = th.App.GetPluginAccessControl(th.Context, pluginID)
	require.Nil(t, appErr)
	assert.False(t, settings.Enable)
	assert.ElementsMatch(t, []string{th.BasicUser.Id, th.BasicUser2.Id}, settings.AllowedUserIds)
}
