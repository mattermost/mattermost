// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestPluginAPICreateScopedSession(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	f := newScopeFixture(t, th)
	api := th.SetupPluginAPI()

	session, appErr := api.CreateScopedSession(f.bot.Id, f.scope(), model.GetMillis()+30*60*1000)
	require.Nil(t, appErr)
	scope, scoped := session.Scope()
	require.True(t, scoped)
	assert.Equal(t, "pluginid", scope.CreatedByPluginID)

	_, appErr = api.CreateScopedSession(f.bot.Id, f.scope(), model.GetMillis()+model.SessionScopeMaxLifetimeMillis+60*1000)
	require.NotNil(t, appErr, "TTL is capped at 24h")

	t.Run("extending past 24h is rejected", func(t *testing.T) {
		appErr := api.ExtendSessionExpiry(session.Id, model.GetMillis()+model.SessionScopeMaxLifetimeMillis+60*1000)
		require.NotNil(t, appErr)
		require.Nil(t, api.ExtendSessionExpiry(session.Id, model.GetMillis()+60*60*1000))
	})

	t.Run("extensions can't pass 24h after creation", func(t *testing.T) {
		aging, appErr := api.CreateScopedSession(f.bot.Id, f.scope(), model.GetMillis()+30*60*1000)
		require.Nil(t, appErr)
		createdAt := model.GetMillis() - 23*60*60*1000
		_, err := th.SQLStore.GetMaster().Exec("UPDATE Sessions SET CreateAt = $1 WHERE Id = $2", createdAt, aging.Id)
		require.NoError(t, err)

		require.NotNil(t, api.ExtendSessionExpiry(aging.Id, model.GetMillis()+2*60*60*1000))
		require.Nil(t, api.ExtendSessionExpiry(aging.Id, createdAt+model.SessionScopeMaxLifetimeMillis))
	})

	t.Run("plain CreateSession with a scope prop is rejected", func(t *testing.T) {
		_, appErr := api.CreateSession(&model.Session{UserId: f.bot.Id, Props: model.StringMap{model.SessionPropScope: session.Props[model.SessionPropScope]}})
		require.NotNil(t, appErr)
	})

	t.Run("file action check applies the scope", func(t *testing.T) {
		inScope := th.CreateFileInfo(t, th.BasicUser.Id, "", f.triggering.Id)
		inDM := th.CreateFileInfo(t, f.bot.Id, "", f.botDM.Id)
		download := model.AccessControlPolicyActionDownloadFileAttachment
		assert.True(t, api.HasPermissionToFileAction(session.Id, inScope.Id, download))
		assert.False(t, api.HasPermissionToFileAction(session.Id, inDM.Id, download))
		assert.False(t, api.HasPermissionToFileAction(session.Id, inScope.Id, model.AccessControlPolicyActionUploadFileAttachment))
	})
}

func TestScopedSessionsRevokedOnPluginDisable(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	f := newScopeFixture(t, th)

	pluginID := "com.example.scopedmint"
	pluginCode := fmt.Sprintf(`
	package main

	import (
		"errors"

		"github.com/mattermost/mattermost/server/public/model"
		"github.com/mattermost/mattermost/server/public/plugin"
	)

	type MyPlugin struct {
		plugin.MattermostPlugin
	}

	func (p *MyPlugin) OnActivate() error {
		scope := &model.SessionScope{
			Permissions: model.ScopeReadPermissions,
			Resources:   model.SessionScopeResources{ChannelIDs: []string{%q}, OpenTeamPublicChannels: true},
			OnBehalfOfUserID: %q,
		}
		session, appErr := p.API.CreateScopedSession(%q, scope, model.GetMillis()+30*60*1000)
		if appErr != nil {
			return appErr
		}
		if _, appErr := p.API.CreateSession(&model.Session{UserId: %q, Props: model.StringMap{model.SessionPropScope: session.Props[model.SessionPropScope]}}); appErr == nil {
			return errors.New("CreateSession accepted a scope prop")
		}
		if appErr := p.API.KVSet("session_id", []byte(session.Id)); appErr != nil {
			return appErr
		}
		return nil
	}

	func main() {
		plugin.ClientMain(&MyPlugin{})
	}
	`, f.triggering.Id, th.BasicUser.Id, f.bot.Id, f.bot.Id)
	pluginManifest := fmt.Sprintf(`{"id": %q, "server": {"executable": "backend.exe"}}`, pluginID)

	setupPluginAPITest(t, pluginCode, pluginManifest, pluginID, th.App, th.Context)

	sessionID, appErr := th.App.GetPluginKey(pluginID, "session_id")
	require.Nil(t, appErr)
	require.NotEmpty(t, sessionID)

	session, appErr := th.App.GetSessionById(th.Context, string(sessionID))
	require.Nil(t, appErr)
	scope, scoped := session.Scope()
	require.True(t, scoped)
	assert.Equal(t, pluginID, scope.CreatedByPluginID)
	assert.Equal(t, th.BasicUser.Id, scope.OnBehalfOfUserID)

	require.Nil(t, th.App.DisablePlugin(pluginID))

	require.Eventually(t, func() bool {
		_, appErr := th.App.GetSession(session.Token)
		return appErr != nil
	}, 10*time.Second, 100*time.Millisecond, "scoped session must be revoked when its plugin is disabled")

	t.Run("sync revokes sessions minted after deactivation", func(t *testing.T) {
		late, appErr := th.App.CreateScopedSession(th.Context, pluginID, f.bot.Id, f.scope(), model.GetMillis()+30*60*1000)
		require.Nil(t, appErr)

		th.App.ch.syncPluginsActiveState()

		_, appErr = th.App.GetSession(late.Token)
		require.NotNil(t, appErr)
	})
}
