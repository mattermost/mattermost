// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
package api4

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
	"github.com/mattermost/mattermost/server/v8/channels/web"
	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
	"github.com/stretchr/testify/require"
)

func newOutgoingOAuthConnection() *model.OutgoingOAuthConnection {
	return &model.OutgoingOAuthConnection{
		Name:          "test",
		ClientId:      "test",
		ClientSecret:  "test",
		OAuthTokenURL: "http://localhost:9999/oauth/token",
		GrantType:     model.OutgoingOAuthConnectionGrantTypeClientCredentials,
		Audiences:     []string{"http://example.com"},
	}
}

func outgoingOauthConnectionsCleanup(t *testing.T, th *TestHelper) {
	t.Helper()

	// Remove all connections
	conns, errCleanup := th.App.Srv().Store().OutgoingOAuthConnection().GetConnections(th.Context, model.OutgoingOAuthConnectionGetConnectionsFilter{})
	require.NoError(t, errCleanup)

	for _, c := range conns {
		require.NoError(t, th.App.Srv().Store().OutgoingOAuthConnection().DeleteConnection(th.Context, c.Id))
	}
}

// Helper tests
func TestCheckOutgoingOAuthConnectionReadPermissions(t *testing.T) {
	t.Skip("https://mattermost.atlassian.net/browse/MM-61690")

	t.Run("no permissions", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		session := model.Session{
			Id:     model.NewId(),
			UserId: model.NewId(),
			Roles:  model.SystemUserRoleId,
		}
		c := &Context{}
		c.AppContext = th.Context.WithSession(&session)
		c.App = th.App
		c.Logger = th.App.Srv().Log()

		canRead := checkOutgoingOAuthConnectionReadPermissions(c, th.BasicTeam.Id)
		require.False(t, canRead)
	})

	t.Run("with management permissions", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		session := model.Session{
			Id:     model.NewId(),
			UserId: model.NewId(),
			Roles:  model.SystemUserRoleId,
		}
		c := &Context{}
		c.AppContext = th.Context.WithSession(&session)
		c.App = th.App
		c.Logger = th.App.Srv().Log()

		th.AddPermissionToRole(model.PermissionManageOutgoingOAuthConnections.Id, model.SystemUserRoleId)

		canReadWithTeam := checkOutgoingOAuthConnectionReadPermissions(c, th.BasicTeam.Id)
		require.True(t, canReadWithTeam)

		canReadWithoutTeam := checkOutgoingOAuthConnectionReadPermissions(c, "")
		require.True(t, canReadWithoutTeam)
	})

	t.Run("with slash command management permissions", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		session := model.Session{
			Id:     model.NewId(),
			UserId: model.NewId(),
			Roles:  model.TeamAdminRoleId,
		}
		c := &Context{}
		c.AppContext = th.Context.WithSession(&session)
		c.App = th.App
		c.Logger = th.App.Srv().Log()

		th.AddPermissionToRole(model.PermissionManageSlashCommands.Id, model.TeamAdminRoleId)

		canRead := checkOutgoingOAuthConnectionReadPermissions(c, th.BasicTeam.Id)
		require.True(t, canRead)
	})

	t.Run("with outgoing webhooks management permissions", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		session := model.Session{
			Id:     model.NewId(),
			UserId: model.NewId(),
			Roles:  model.TeamAdminRoleId,
		}
		c := &Context{}
		c.AppContext = th.Context.WithSession(&session)
		c.App = th.App
		c.Logger = th.App.Srv().Log()

		th.AddPermissionToRole(model.PermissionManageOutgoingWebhooks.Id, model.TeamAdminRoleId)

		canRead := checkOutgoingOAuthConnectionReadPermissions(c, th.BasicTeam.Id)
		require.True(t, canRead)
	})
}

func TestCheckOutgoingOAuthConnectionWritePermissions(t *testing.T) {
	t.Skip("https://mattermost.atlassian.net/browse/MM-61690")

	t.Run("no permissions", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		session := model.Session{
			Id:     model.NewId(),
			UserId: model.NewId(),
			Roles:  model.SystemUserRoleId,
		}
		c := &Context{}
		c.AppContext = th.Context.WithSession(&session)
		c.App = th.App
		c.Logger = th.App.Srv().Log()

		canWrite := checkOutgoingOAuthConnectionWritePermissions(c)
		require.False(t, canWrite)
	})

	t.Run("with permissions", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		session := model.Session{
			Id:     model.NewId(),
			UserId: model.NewId(),
			Roles:  model.SystemUserRoleId,
		}
		c := &Context{}
		c.AppContext = th.Context.WithSession(&session)
		c.App = th.App
		c.Logger = th.App.Srv().Log()

		th.AddPermissionToRole(model.PermissionManageOutgoingOAuthConnections.Id, model.SystemUserRoleId)

		canWrite := checkOutgoingOAuthConnectionWritePermissions(c)
		require.True(t, canWrite)
	})
}

// Client tests

func TestClientOutgoingOAuthConnectionGet(t *testing.T) {
	t.Skip("https://mattermost.atlassian.net/browse/MM-61690")

	t.Run("No license returns 501", func(t *testing.T) {
		os.Setenv("MM_FEATUREFLAGS_OUTGOINGOAUTHCONNECTION", "true")
		defer os.Unsetenv("MM_FEATUREFLAGS_OUTGOINGOAUTHCONNECTION")
		th := Setup(t).InitBasic()
		defer th.TearDown()
		defaultRolePermissions := th.SaveDefaultRolePermissions()
		defer func() {
			th.RestoreDefaultRolePermissions(defaultRolePermissions)
		}()
		th.AddPermissionToRole(model.PermissionManageOutgoingWebhooks.Id, model.TeamAdminRoleId)
		th.AddPermissionToRole(model.PermissionManageSlashCommands.Id, model.TeamAdminRoleId)

		outgoingOauthIface := &mocks.OutgoingOAuthConnectionInterface{}
		outgoingOauthImpl := th.App.Srv().OutgoingOAuthConnection
		defer func() {
			th.App.Srv().OutgoingOAuthConnection = outgoingOauthImpl
		}()
		th.App.Srv().OutgoingOAuthConnection = outgoingOauthIface

		// th.Client.Login(context.Background(), th.BasicUser.Email, th.BasicUser.Password)
		th.LoginTeamAdmin()

		filters := model.OutgoingOAuthConnectionGetConnectionsFilter{
			Limit:  10,
			TeamId: th.BasicTeam.Id,
		}
		connections, response, err := th.Client.GetOutgoingOAuthConnections(context.Background(), filters)
		require.Error(t, err)
		require.Nil(t, connections)
		require.Equal(t, 501, response.StatusCode)
	})

	t.Run("license but no config enabled returns 501", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		defaultRolePermissions := th.SaveDefaultRolePermissions()
		defer func() {
			th.RestoreDefaultRolePermissions(defaultRolePermissions)
		}()
		th.AddPermissionToRole(model.PermissionManageOutgoingWebhooks.Id, model.TeamAdminRoleId)
		th.AddPermissionToRole(model.PermissionManageSlashCommands.Id, model.TeamAdminRoleId)

		outgoingOauthIface := &mocks.OutgoingOAuthConnectionInterface{}
		outgoingOauthImpl := th.App.Srv().OutgoingOAuthConnection
		outgoingOAuthConnectionConfig := th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections
		th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections = model.NewPointer(false)
		defer func() {
			th.App.Srv().OutgoingOAuthConnection = outgoingOauthImpl
			th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections = outgoingOAuthConnectionConfig
		}()
		th.App.Srv().OutgoingOAuthConnection = outgoingOauthIface
		license := model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise, "outgoing_oauth_connections")
		license.Id = "test-license-id"
		th.App.Srv().SetLicense(license)
		appErr := th.App.Srv().RemoveLicense()
		require.Nil(t, appErr)

		th.LoginTeamAdmin()

		filters := model.OutgoingOAuthConnectionGetConnectionsFilter{
			Limit:  10,
			TeamId: th.BasicTeam.Id,
		}
		connections, response, err := th.Client.GetOutgoingOAuthConnections(context.Background(), filters)
		require.Error(t, err)
		require.Nil(t, connections)
		require.Equal(t, 501, response.StatusCode)
	})
}

func TestClientListOutgoingOAuthConnection(t *testing.T) {
	t.Skip("https://mattermost.atlassian.net/browse/MM-61690")

	os.Setenv("MM_FEATUREFLAGS_OUTGOINGOAUTHCONNECTIONS", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_OUTGOINGOAUTHCONNECTIONS")
	th := Setup(t).InitBasic()
	defer th.TearDown()

	license := model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise, "outgoing_oauth_connections")
	license.Id = "test-license-id"
	th.App.Srv().SetLicense(license)

	t.Run("no permissions", func(t *testing.T) {
		defer outgoingOauthConnectionsCleanup(t, th)

		outgoingOauthIface := &mocks.OutgoingOAuthConnectionInterface{}
		outgoingOauthImpl := th.App.Srv().OutgoingOAuthConnection
		outgoingOAuthConnectionConfig := th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections
		th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections = model.NewPointer(true)
		t.Cleanup(func() {
			th.App.Srv().OutgoingOAuthConnection = outgoingOauthImpl
			th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections = outgoingOAuthConnectionConfig
		})
		th.App.Srv().OutgoingOAuthConnection = outgoingOauthIface

		_, _, err := th.Client.Login(context.Background(), th.BasicUser.Email, th.BasicUser.Password)
		require.NoError(t, err)

		filters := model.OutgoingOAuthConnectionGetConnectionsFilter{
			Limit:  10,
			TeamId: th.BasicTeam.Id,
		}
		connection, response, err := th.Client.GetOutgoingOAuthConnections(context.Background(), filters)
		require.Error(t, err)
		require.Nil(t, connection)
		require.Equal(t, http.StatusForbidden, response.StatusCode)
	})

	t.Run("manager do not require team id", func(t *testing.T) {
		defer outgoingOauthConnectionsCleanup(t, th)

		defaultRolePermissions := th.SaveDefaultRolePermissions()
		defer func() {
			th.RestoreDefaultRolePermissions(defaultRolePermissions)
		}()
		th.AddPermissionToRole(model.PermissionManageOutgoingOAuthConnections.Id, model.SystemUserRoleId)

		outgoingOauthIface := &mocks.OutgoingOAuthConnectionInterface{}
		th.App.Srv().OutgoingOAuthConnection = outgoingOauthIface
		outgoingOauthIface.Mock.On("GetConnections", mock.Anything, mock.Anything).Return([]*model.OutgoingOAuthConnection{}, nil)
		outgoingOauthIface.Mock.On("SanitizeConnections", mock.Anything)

		outgoingOauthImpl := th.App.Srv().OutgoingOAuthConnection
		outgoingOAuthConnectionConfig := th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections
		th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections = model.NewPointer(true)
		t.Cleanup(func() {
			th.App.Srv().OutgoingOAuthConnection = outgoingOauthImpl
			th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections = outgoingOAuthConnectionConfig
		})
		th.App.Srv().OutgoingOAuthConnection = outgoingOauthIface

		_, _, err := th.Client.Login(context.Background(), th.BasicUser.Email, th.BasicUser.Password)
		require.NoError(t, err)

		filters := model.OutgoingOAuthConnectionGetConnectionsFilter{
			Limit: 10,
		}
		connections, response, err := th.Client.GetOutgoingOAuthConnections(context.Background(), filters)
		require.NoError(t, err)

		require.Equal(t, 200, response.StatusCode)
		require.Equal(t, 0, len(connections))
	})

	t.Run("empty", func(t *testing.T) {
		defer outgoingOauthConnectionsCleanup(t, th)

		defaultRolePermissions := th.SaveDefaultRolePermissions()
		defer func() {
			th.RestoreDefaultRolePermissions(defaultRolePermissions)
		}()
		th.AddPermissionToRole(model.PermissionManageOutgoingWebhooks.Id, model.SystemUserRoleId)
		th.AddPermissionToRole(model.PermissionManageSlashCommands.Id, model.SystemUserRoleId)

		outgoingOauthIface := &mocks.OutgoingOAuthConnectionInterface{}
		th.App.Srv().OutgoingOAuthConnection = outgoingOauthIface
		outgoingOauthIface.Mock.On("GetConnections", mock.Anything, mock.Anything).Return([]*model.OutgoingOAuthConnection{}, nil)
		outgoingOauthIface.Mock.On("SanitizeConnections", mock.Anything)

		outgoingOauthImpl := th.App.Srv().OutgoingOAuthConnection
		outgoingOAuthConnectionConfig := th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections
		th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections = model.NewPointer(true)
		t.Cleanup(func() {
			th.App.Srv().OutgoingOAuthConnection = outgoingOauthImpl
			th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections = outgoingOAuthConnectionConfig
		})
		th.App.Srv().OutgoingOAuthConnection = outgoingOauthIface

		_, _, err := th.Client.Login(context.Background(), th.BasicUser.Email, th.BasicUser.Password)
		require.NoError(t, err)

		filters := model.OutgoingOAuthConnectionGetConnectionsFilter{
			Limit:  10,
			TeamId: th.BasicTeam.Id,
		}
		connections, response, err := th.Client.GetOutgoingOAuthConnections(context.Background(), filters)
		require.NoError(t, err)

		require.Equal(t, 200, response.StatusCode)
		require.Equal(t, 0, len(connections))
	})

	t.Run("filter by audience", func(t *testing.T) {
		defer outgoingOauthConnectionsCleanup(t, th)

		defaultRolePermissions := th.SaveDefaultRolePermissions()
		defer func() {
			th.RestoreDefaultRolePermissions(defaultRolePermissions)
		}()
		th.AddPermissionToRole(model.PermissionManageOutgoingWebhooks.Id, model.SystemUserRoleId)
		th.AddPermissionToRole(model.PermissionManageSlashCommands.Id, model.SystemUserRoleId)

		conn := newOutgoingOAuthConnection()
		conn.Audiences = []string{"http://knowhere.com"}
		conn.CreatorId = model.NewId()

		conn, err := th.App.Srv().Store().OutgoingOAuthConnection().SaveConnection(th.Context, conn)
		require.NoError(t, err)

		outgoingOauthIface := &mocks.OutgoingOAuthConnectionInterface{}
		th.App.Srv().OutgoingOAuthConnection = outgoingOauthIface
		outgoingOauthIface.Mock.On("GetConnectionForAudience", mock.Anything, "knowhere.com").Return(conn, nil)
		outgoingOauthIface.Mock.On("SanitizeConnections", mock.Anything)
		outgoingOauthImpl := th.App.Srv().OutgoingOAuthConnection
		outgoingOAuthConnectionConfig := th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections
		th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections = model.NewPointer(true)
		t.Cleanup(func() {
			th.App.Srv().OutgoingOAuthConnection = outgoingOauthImpl
			th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections = outgoingOAuthConnectionConfig
		})
		th.App.Srv().OutgoingOAuthConnection = outgoingOauthIface

		_, _, err = th.Client.Login(context.Background(), th.BasicUser.Email, th.BasicUser.Password)
		require.NoError(t, err)

		filters := model.OutgoingOAuthConnectionGetConnectionsFilter{
			Limit:    1,
			Audience: "knowhere.com",
			TeamId:   th.BasicTeam.Id,
		}
		connections, response, err := th.Client.GetOutgoingOAuthConnections(context.Background(), filters)
		require.NoError(t, err)

		require.Equal(t, 200, response.StatusCode)
		require.Equal(t, 1, len(connections))
		require.Equal(t, conn, connections[0])
	})

	t.Run("return result", func(t *testing.T) {
		defer outgoingOauthConnectionsCleanup(t, th)

		defaultRolePermissions := th.SaveDefaultRolePermissions()
		defer func() {
			th.RestoreDefaultRolePermissions(defaultRolePermissions)
		}()
		th.AddPermissionToRole(model.PermissionManageOutgoingWebhooks.Id, model.SystemUserRoleId)
		th.AddPermissionToRole(model.PermissionManageSlashCommands.Id, model.SystemUserRoleId)

		conn := newOutgoingOAuthConnection()
		conn.CreatorId = model.NewId()

		conn, err := th.App.Srv().Store().OutgoingOAuthConnection().SaveConnection(th.Context, conn)
		require.NoError(t, err)

		outgoingOauthIface := &mocks.OutgoingOAuthConnectionInterface{}
		th.App.Srv().OutgoingOAuthConnection = outgoingOauthIface
		outgoingOauthIface.Mock.On("GetConnections", mock.Anything, mock.Anything).Return([]*model.OutgoingOAuthConnection{conn}, nil)
		outgoingOauthIface.Mock.On("SanitizeConnections", mock.Anything)

		outgoingOauthImpl := th.App.Srv().OutgoingOAuthConnection
		outgoingOAuthConnectionConfig := th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections
		th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections = model.NewPointer(true)
		t.Cleanup(func() {
			th.App.Srv().OutgoingOAuthConnection = outgoingOauthImpl
			th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections = outgoingOAuthConnectionConfig
		})
		th.App.Srv().OutgoingOAuthConnection = outgoingOauthIface

		_, _, err = th.Client.Login(context.Background(), th.BasicUser.Email, th.BasicUser.Password)
		require.NoError(t, err)

		filters := model.OutgoingOAuthConnectionGetConnectionsFilter{
			Limit:  10,
			TeamId: th.BasicTeam.Id,
		}
		connections, response, err := th.Client.GetOutgoingOAuthConnections(context.Background(), filters)
		require.NoError(t, err)

		require.Equal(t, 200, response.StatusCode)
		require.Equal(t, 1, len(connections))
		require.Equal(t, conn, connections[0])
	})
}

func TestClientGetOutgoingOAuthConnection(t *testing.T) {
	t.Skip("https://mattermost.atlassian.net/browse/MM-61690")

	os.Setenv("MM_FEATUREFLAGS_OUTGOINGOAUTHCONNECTIONS", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_OUTGOINGOAUTHCONNECTIONS")
	th := Setup(t).InitBasic()
	defer th.TearDown()
	defer func() {
		appErr := th.App.Srv().RemoveLicense()
		require.Nil(t, appErr)
	}()

	license := model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise, "outgoing_oauth_connections")
	license.Id = "test-license-id"
	th.App.Srv().SetLicense(license)

	t.Run("no permissions", func(t *testing.T) {
		defer outgoingOauthConnectionsCleanup(t, th)

		outgoingOauthIface := &mocks.OutgoingOAuthConnectionInterface{}
		outgoingOauthImpl := th.App.Srv().OutgoingOAuthConnection
		outgoingOAuthConnectionConfig := th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections
		th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections = model.NewPointer(true)
		t.Cleanup(func() {
			th.App.Srv().OutgoingOAuthConnection = outgoingOauthImpl
			th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections = outgoingOAuthConnectionConfig
		})
		th.App.Srv().OutgoingOAuthConnection = outgoingOauthIface

		_, _, err := th.Client.Login(context.Background(), th.BasicUser.Email, th.BasicUser.Password)
		require.NoError(t, err)

		connection, response, err := th.Client.GetOutgoingOAuthConnection(context.Background(), "test")
		require.Error(t, err)
		require.Nil(t, connection)
		require.Equal(t, http.StatusForbidden, response.StatusCode)
	})

	t.Run("return result (management permissions)", func(t *testing.T) {
		defer outgoingOauthConnectionsCleanup(t, th)

		defaultRolePermissions := th.SaveDefaultRolePermissions()
		defer func() {
			th.RestoreDefaultRolePermissions(defaultRolePermissions)
		}()
		th.AddPermissionToRole(model.PermissionManageOutgoingOAuthConnections.Id, model.SystemUserRoleId)

		conn := newOutgoingOAuthConnection()
		conn.CreatorId = model.NewId()

		conn, err := th.App.Srv().Store().OutgoingOAuthConnection().SaveConnection(th.Context, conn)
		require.NoError(t, err)

		outgoingOauthIface := &mocks.OutgoingOAuthConnectionInterface{}
		outgoingOauthIface.Mock.On("GetConnection", mock.Anything, mock.Anything).Return(conn, nil)
		outgoingOauthIface.Mock.On("SanitizeConnection", mock.Anything)

		outgoingOauthImpl := th.App.Srv().OutgoingOAuthConnection
		outgoingOAuthConnectionConfig := th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections
		th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections = model.NewPointer(true)
		t.Cleanup(func() {
			th.App.Srv().OutgoingOAuthConnection = outgoingOauthImpl
			th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections = outgoingOAuthConnectionConfig
		})
		th.App.Srv().OutgoingOAuthConnection = outgoingOauthIface

		th.LoginSystemAdmin()
		connection, response, err := th.Client.GetOutgoingOAuthConnection(context.Background(), conn.Id)
		require.NoError(t, err)

		require.Equal(t, 200, response.StatusCode)
		require.NotNil(t, connection)
		require.Equal(t, conn.Id, connection.Id)
		require.Equal(t, conn, connection)
	})
}

func TestClientCreateOutgoingOAuthConnection(t *testing.T) {
	t.Skip("https://mattermost.atlassian.net/browse/MM-61690")

	os.Setenv("MM_FEATUREFLAGS_OUTGOINGOAUTHCONNECTIONS", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_OUTGOINGOAUTHCONNECTIONS")
	th := Setup(t).InitBasic()
	defer th.TearDown()
	defer func() {
		appErr := th.App.Srv().RemoveLicense()
		require.Nil(t, appErr)
	}()

	license := model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise, "outgoing_oauth_connections")
	license.Id = "test-license-id"
	th.App.Srv().SetLicense(license)

	t.Run("no permissions", func(t *testing.T) {
		defer outgoingOauthConnectionsCleanup(t, th)

		conn := newOutgoingOAuthConnection()
		conn.CreatorId = model.NewId()

		outgoingOauthIface := &mocks.OutgoingOAuthConnectionInterface{}
		outgoingOauthIface.Mock.On("SaveConnection", mock.Anything, mock.Anything).Return(conn, nil)
		outgoingOauthIface.Mock.On("SanitizeConnection", mock.Anything)

		outgoingOauthImpl := th.App.Srv().OutgoingOAuthConnection
		outgoingOAuthConnectionConfig := th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections
		th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections = model.NewPointer(true)
		t.Cleanup(func() {
			th.App.Srv().OutgoingOAuthConnection = outgoingOauthImpl
			th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections = outgoingOAuthConnectionConfig
		})
		th.App.Srv().OutgoingOAuthConnection = outgoingOauthIface

		th.LoginSystemAdmin()

		connection, response, err := th.Client.CreateOutgoingOAuthConnection(context.Background(), conn)
		require.Error(t, err)
		require.Nil(t, connection)
		require.Equal(t, http.StatusForbidden, response.StatusCode)
	})

	t.Run("ok", func(t *testing.T) {
		defer outgoingOauthConnectionsCleanup(t, th)

		defaultRolePermissions := th.SaveDefaultRolePermissions()
		defer func() {
			th.RestoreDefaultRolePermissions(defaultRolePermissions)
		}()
		th.AddPermissionToRole(model.PermissionManageOutgoingOAuthConnections.Id, model.SystemUserRoleId)

		conn := newOutgoingOAuthConnection()
		conn.CreatorId = model.NewId()

		outgoingOauthIface := &mocks.OutgoingOAuthConnectionInterface{}
		outgoingOauthIface.Mock.On("SaveConnection", mock.Anything, mock.Anything).Return(conn, nil)
		outgoingOauthIface.Mock.On("SanitizeConnection", mock.Anything)

		outgoingOauthImpl := th.App.Srv().OutgoingOAuthConnection
		outgoingOAuthConnectionConfig := th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections
		th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections = model.NewPointer(true)
		t.Cleanup(func() {
			th.App.Srv().OutgoingOAuthConnection = outgoingOauthImpl
			th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections = outgoingOAuthConnectionConfig
		})
		th.App.Srv().OutgoingOAuthConnection = outgoingOauthIface

		th.LoginSystemAdmin()

		connection, response, err := th.Client.CreateOutgoingOAuthConnection(context.Background(), conn)
		require.NoError(t, err)
		require.NotNil(t, connection)
		require.Equal(t, http.StatusCreated, response.StatusCode)
		require.Equal(t, conn, connection)
	})
}

func TestClientUpdateOutgoingOAuthConnection(t *testing.T) {
	t.Skip("https://mattermost.atlassian.net/browse/MM-61690")

	os.Setenv("MM_FEATUREFLAGS_OUTGOINGOAUTHCONNECTIONS", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_OUTGOINGOAUTHCONNECTIONS")
	th := Setup(t).InitBasic()
	defer th.TearDown()
	defer func() {
		appErr := th.App.Srv().RemoveLicense()
		require.Nil(t, appErr)
	}()

	license := model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise, "outgoing_oauth_connections")
	license.Id = "test-license-id"
	th.App.Srv().SetLicense(license)

	t.Run("no permissions", func(t *testing.T) {
		defer outgoingOauthConnectionsCleanup(t, th)

		conn := newOutgoingOAuthConnection()
		conn.CreatorId = model.NewId()
		conn, err := th.App.Srv().Store().OutgoingOAuthConnection().SaveConnection(th.Context, conn)
		require.NoError(t, err)

		outgoingOauthIface := &mocks.OutgoingOAuthConnectionInterface{}
		outgoingOauthImpl := th.App.Srv().OutgoingOAuthConnection
		outgoingOAuthConnectionConfig := th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections
		th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections = model.NewPointer(true)
		t.Cleanup(func() {
			th.App.Srv().OutgoingOAuthConnection = outgoingOauthImpl
			th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections = outgoingOAuthConnectionConfig
		})
		th.App.Srv().OutgoingOAuthConnection = outgoingOauthIface

		th.LoginSystemAdmin()

		connection, response, err := th.Client.UpdateOutgoingOAuthConnection(context.Background(), conn)
		require.Error(t, err)
		require.Nil(t, connection)
		require.Equal(t, http.StatusForbidden, response.StatusCode)
	})

	t.Run("ok", func(t *testing.T) {
		defer outgoingOauthConnectionsCleanup(t, th)

		defaultRolePermissions := th.SaveDefaultRolePermissions()
		defer func() {
			th.RestoreDefaultRolePermissions(defaultRolePermissions)
		}()
		th.AddPermissionToRole(model.PermissionManageOutgoingOAuthConnections.Id, model.SystemUserRoleId)

		conn := newOutgoingOAuthConnection()
		conn.CreatorId = model.NewId()
		conn, err := th.App.Srv().Store().OutgoingOAuthConnection().SaveConnection(th.Context, conn)
		require.NoError(t, err)

		outgoingOauthIface := &mocks.OutgoingOAuthConnectionInterface{}
		outgoingOauthIface.Mock.On("GetConnection", mock.Anything, conn.Id).Return(conn, nil)
		outgoingOauthIface.Mock.On("UpdateConnection", mock.Anything, conn).Return(conn, nil)
		outgoingOauthIface.Mock.On("SanitizeConnection", mock.Anything)

		outgoingOauthImpl := th.App.Srv().OutgoingOAuthConnection
		outgoingOAuthConnectionConfig := th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections
		th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections = model.NewPointer(true)
		t.Cleanup(func() {
			th.App.Srv().OutgoingOAuthConnection = outgoingOauthImpl
			th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections = outgoingOAuthConnectionConfig
		})
		th.App.Srv().OutgoingOAuthConnection = outgoingOauthIface

		th.LoginSystemAdmin()

		updatedConn := conn
		updatedConn.Name = "updated name"

		connection, response, err := th.Client.UpdateOutgoingOAuthConnection(context.Background(), conn)

		require.NoError(t, err)
		require.NotNil(t, connection)
		require.Equal(t, http.StatusOK, response.StatusCode)
		require.Equal(t, updatedConn, connection)
	})
}

func TestClientDeleteOutgoingOAuthConnection(t *testing.T) {
	t.Skip("https://mattermost.atlassian.net/browse/MM-61690")

	os.Setenv("MM_FEATUREFLAGS_OUTGOINGOAUTHCONNECTIONS", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_OUTGOINGOAUTHCONNECTIONS")
	th := Setup(t).InitBasic()
	defer th.TearDown()
	defer func() {
		appErr := th.App.Srv().RemoveLicense()
		require.Nil(t, appErr)
	}()

	license := model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise, "outgoing_oauth_connections")
	license.Id = "test-license-id"
	th.App.Srv().SetLicense(license)

	t.Run("no permissions", func(t *testing.T) {
		defer outgoingOauthConnectionsCleanup(t, th)

		conn := newOutgoingOAuthConnection()
		conn.CreatorId = model.NewId()
		conn, err := th.App.Srv().Store().OutgoingOAuthConnection().SaveConnection(th.Context, conn)
		require.NoError(t, err)

		outgoingOauthIface := &mocks.OutgoingOAuthConnectionInterface{}
		outgoingOauthImpl := th.App.Srv().OutgoingOAuthConnection
		outgoingOAuthConnectionConfig := th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections
		th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections = model.NewPointer(true)
		t.Cleanup(func() {
			th.App.Srv().OutgoingOAuthConnection = outgoingOauthImpl
			th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections = outgoingOAuthConnectionConfig
		})
		th.App.Srv().OutgoingOAuthConnection = outgoingOauthIface

		th.LoginSystemAdmin()

		response, err := th.Client.DeleteOutgoingOAuthConnection(context.Background(), conn.Id)
		require.Error(t, err)
		require.Equal(t, http.StatusForbidden, response.StatusCode)
	})

	t.Run("ok", func(t *testing.T) {
		defer outgoingOauthConnectionsCleanup(t, th)

		defaultRolePermissions := th.SaveDefaultRolePermissions()
		defer func() {
			th.RestoreDefaultRolePermissions(defaultRolePermissions)
		}()
		th.AddPermissionToRole(model.PermissionManageOutgoingOAuthConnections.Id, model.SystemUserRoleId)

		conn := newOutgoingOAuthConnection()
		conn.CreatorId = model.NewId()
		conn, err := th.App.Srv().Store().OutgoingOAuthConnection().SaveConnection(th.Context, conn)
		require.NoError(t, err)

		outgoingOauthIface := &mocks.OutgoingOAuthConnectionInterface{}
		outgoingOauthIface.Mock.On("GetConnection", mock.Anything, conn.Id).Return(conn, nil)
		outgoingOauthIface.Mock.On("DeleteConnection", mock.Anything, conn.Id).Return(nil)

		outgoingOauthImpl := th.App.Srv().OutgoingOAuthConnection
		outgoingOAuthConnectionConfig := th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections
		th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections = model.NewPointer(true)
		t.Cleanup(func() {
			th.App.Srv().OutgoingOAuthConnection = outgoingOauthImpl
			th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections = outgoingOAuthConnectionConfig
		})
		th.App.Srv().OutgoingOAuthConnection = outgoingOauthIface

		th.LoginSystemAdmin()

		response, err := th.Client.DeleteOutgoingOAuthConnection(context.Background(), conn.Id)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, response.StatusCode)
	})
}

// Handler tests

func TestEnsureOutgoingOAuthConnectionInterface(t *testing.T) {
	t.Skip("https://mattermost.atlassian.net/browse/MM-61690")

	t.Run("no feature flag, no interface, no license", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		c := &Context{}
		c.AppContext = th.Context
		c.App = th.App
		c.Logger = th.App.Srv().Log()

		th.App.Srv().OutgoingOAuthConnection = nil

		_, valid := ensureOutgoingOAuthConnectionInterface(c, "api")
		require.False(t, valid)
	})

	t.Run("config, no interface, no license", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		outgoingOAuthConnectionConfig := th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections
		th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections = model.NewPointer(true)
		t.Cleanup(func() {
			th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections = outgoingOAuthConnectionConfig
		})

		c := &Context{}
		c.AppContext = th.Context
		c.App = th.App
		c.Logger = th.App.Srv().Log()

		th.App.Srv().OutgoingOAuthConnection = nil

		_, valid := ensureOutgoingOAuthConnectionInterface(c, "api")
		require.False(t, valid)
	})

	t.Run("feature flag, interface defined, no license", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		outgoingOauthIface := &mocks.OutgoingOAuthConnectionInterface{}
		outgoingOauthImpl := th.App.Srv().OutgoingOAuthConnection
		outgoingOAuthConnectionConfig := th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections
		th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections = model.NewPointer(true)
		t.Cleanup(func() {
			th.App.Srv().OutgoingOAuthConnection = outgoingOauthImpl
			th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections = outgoingOAuthConnectionConfig
		})
		th.App.Srv().OutgoingOAuthConnection = outgoingOauthIface

		c := &Context{}
		c.AppContext = th.Context
		c.App = th.App
		c.Logger = th.App.Srv().Log()

		_, valid := ensureOutgoingOAuthConnectionInterface(c, "api")
		require.False(t, valid)
	})

	t.Run("feature flag, interface defined, valid license", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		outgoingOauthIface := &mocks.OutgoingOAuthConnectionInterface{}
		outgoingOauthImpl := th.App.Srv().OutgoingOAuthConnection
		outgoingOAuthConnectionConfig := th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections
		th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections = model.NewPointer(true)
		t.Cleanup(func() {
			th.App.Srv().OutgoingOAuthConnection = outgoingOauthImpl
			th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections = outgoingOAuthConnectionConfig
		})
		th.App.Srv().OutgoingOAuthConnection = outgoingOauthIface

		license := model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise, "outgoing_oauth_connections")
		license.Id = "test-license-id"
		th.App.Srv().SetLicense(license)
		defer func() {
			appErr := th.App.Srv().RemoveLicense()
			require.Nil(t, appErr)
		}()

		c := &Context{}
		c.AppContext = th.Context
		c.App = th.App
		c.Logger = th.App.Srv().Log()

		svc, valid := ensureOutgoingOAuthConnectionInterface(c, "api")
		require.True(t, valid)
		require.NotNil(t, svc)
	})
}

func TestHandlerOutgoingOAuthConnectionListGet(t *testing.T) {
	t.Skip("https://mattermost.atlassian.net/browse/MM-61690")

	os.Setenv("MM_FEATUREFLAGS_OUTGOINGOAUTHCONNECTIONS", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_OUTGOINGOAUTHCONNECTIONS")
	th := Setup(t).InitBasic()
	defer th.TearDown()

	license := model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise, "outgoing_oauth_connections")
	license.Id = "test-license-id"
	th.App.Srv().SetLicense(license)
	defer func() {
		appErr := th.App.Srv().RemoveLicense()
		require.Nil(t, appErr)
	}()

	c := &Context{}
	c.AppContext = th.Context
	c.App = th.App
	c.Logger = th.App.Srv().Log()

	conn := newOutgoingOAuthConnection()

	session := model.Session{
		Id:     model.NewId(),
		UserId: model.NewId(),
		Roles:  model.SystemUserRoleId,
	}
	c.AppContext = th.Context.WithSession(&session)

	outgoingOauthIface := &mocks.OutgoingOAuthConnectionInterface{}
	outgoingOauthImpl := th.App.Srv().OutgoingOAuthConnection
	outgoingOAuthConnectionConfig := th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections
	th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections = model.NewPointer(true)
	th.App.Srv().OutgoingOAuthConnection = outgoingOauthIface

	defaultRolePermissions := th.SaveDefaultRolePermissions()
	defer func() {
		th.App.Srv().OutgoingOAuthConnection = outgoingOauthImpl
		th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections = outgoingOAuthConnectionConfig
		th.RestoreDefaultRolePermissions(defaultRolePermissions)
	}()
	th.AddPermissionToRole(model.PermissionManageOutgoingOAuthConnections.Id, model.SystemUserRoleId)

	t.Run("getOutgoingOAuthConnection", func(t *testing.T) {
		req, err := http.NewRequest("GET", "/", nil)
		if err != nil {
			t.Error(err)
		}

		c.Params = &web.Params{
			OutgoingOAuthConnectionID: conn.Id,
		}

		outgoingOauthIface := &mocks.OutgoingOAuthConnectionInterface{}
		th.App.Srv().OutgoingOAuthConnection = outgoingOauthIface
		outgoingOauthIface.Mock.On("GetConnection", c.AppContext, c.Params.OutgoingOAuthConnectionID).Return(conn, nil)
		outgoingOauthIface.Mock.On("SanitizeConnection", mock.Anything)

		httpRecorder := httptest.NewRecorder()
		handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			getOutgoingOAuthConnection(c, w, r)
		})

		handler.ServeHTTP(httpRecorder, req)

		require.Equal(t, http.StatusOK, httpRecorder.Code)
		require.NotEmpty(t, httpRecorder.Body.String())

		var buf bytes.Buffer
		require.NoError(t, json.NewEncoder(&buf).Encode(conn))
	})

	t.Run("listOutgoingOAuthConnections", func(t *testing.T) {
		req, err := http.NewRequest("GET", "/", nil)
		if err != nil {
			t.Error(err)
		}

		conns := []*model.OutgoingOAuthConnection{conn}

		outgoingOauthIface := &mocks.OutgoingOAuthConnectionInterface{}
		th.App.Srv().OutgoingOAuthConnection = outgoingOauthIface
		outgoingOauthIface.Mock.On("GetConnections", c.AppContext, mock.Anything).Return(conns, nil)
		outgoingOauthIface.Mock.On("SanitizeConnections", mock.Anything)

		httpRecorder := httptest.NewRecorder()
		handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			listOutgoingOAuthConnections(c, w, r)
		})

		handler.ServeHTTP(httpRecorder, req)

		require.Equal(t, http.StatusOK, httpRecorder.Code)
		require.NotEmpty(t, httpRecorder.Body.String())

		var buf bytes.Buffer
		require.NoError(t, json.NewEncoder(&buf).Encode(conn))
	})

	t.Run("listOutgoingOAuthConnections with limit", func(t *testing.T) {
		req, err := http.NewRequest("GET", "/?limit=2", nil)
		if err != nil {
			t.Error(err)
		}

		conns := []*model.OutgoingOAuthConnection{conn}

		outgoingOauthIface := &mocks.OutgoingOAuthConnectionInterface{}
		th.App.Srv().OutgoingOAuthConnection = outgoingOauthIface
		outgoingOauthIface.Mock.On("GetConnections", c.AppContext, model.OutgoingOAuthConnectionGetConnectionsFilter{Limit: 2}).Return(conns, nil)
		outgoingOauthIface.Mock.On("SanitizeConnections", mock.Anything)

		httpRecorder := httptest.NewRecorder()
		handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			listOutgoingOAuthConnections(c, w, r)
		})

		handler.ServeHTTP(httpRecorder, req)

		require.Equal(t, http.StatusOK, httpRecorder.Code)
		require.NotEmpty(t, httpRecorder.Body.String())

		var buf bytes.Buffer
		require.NoError(t, json.NewEncoder(&buf).Encode(conn))
	})
}

func TestHandlerOutgoingOAuthConnectionListReadOnly(t *testing.T) {
	t.Skip("https://mattermost.atlassian.net/browse/MM-61690")

	os.Setenv("MM_FEATUREFLAGS_OUTGOINGOAUTHCONNECTIONS", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_OUTGOINGOAUTHCONNECTIONS")
	th := Setup(t).InitBasic()
	defer th.TearDown()

	license := model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise, "outgoing_oauth_connections")
	license.Id = "test-license-id"
	th.App.Srv().SetLicense(license)
	defer func() {
		appErr := th.App.Srv().RemoveLicense()
		require.Nil(t, appErr)
	}()

	c := &Context{}
	c.AppContext = th.Context
	c.App = th.App
	c.Logger = th.App.Srv().Log()

	conn := newOutgoingOAuthConnection()

	session := model.Session{
		Id:     model.NewId(),
		UserId: model.NewId(),
		Roles:  model.TeamAdminRoleId,
	}
	c.AppContext = th.Context.WithSession(&session)

	outgoingOauthIface := &mocks.OutgoingOAuthConnectionInterface{}
	outgoingOauthImpl := th.App.Srv().OutgoingOAuthConnection
	outgoingOAuthConnectionConfig := th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections
	th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections = model.NewPointer(true)
	th.App.Srv().OutgoingOAuthConnection = outgoingOauthIface

	defaultRolePermissions := th.SaveDefaultRolePermissions()
	defer func() {
		th.App.Srv().OutgoingOAuthConnection = outgoingOauthImpl
		th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections = outgoingOAuthConnectionConfig
		th.RestoreDefaultRolePermissions(defaultRolePermissions)
	}()
	th.AddPermissionToRole(model.PermissionManageOthersOutgoingWebhooks.Id, model.TeamAdminRoleId)

	t.Run("listOutgoingOAuthConnections", func(t *testing.T) {
		req, err := http.NewRequest("GET", "/?team_id="+th.BasicTeam.Id, nil)
		if err != nil {
			t.Error(err)
		}

		conns := []*model.OutgoingOAuthConnection{conn}

		outgoingOauthIface := &mocks.OutgoingOAuthConnectionInterface{}
		th.App.Srv().OutgoingOAuthConnection = outgoingOauthIface
		outgoingOauthIface.Mock.On("GetConnections", c.AppContext, mock.Anything).Return(conns, nil)
		outgoingOauthIface.Mock.On("SanitizeConnections", mock.Anything)

		httpRecorder := httptest.NewRecorder()
		handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			listOutgoingOAuthConnections(c, w, r)
		})

		handler.ServeHTTP(httpRecorder, req)

		require.Equal(t, http.StatusOK, httpRecorder.Code)
		require.NotEmpty(t, httpRecorder.Body.String())

		var buf bytes.Buffer
		require.NoError(t, json.NewEncoder(&buf).Encode(conn))
	})

	t.Run("listOutgoingOAuthConnections with limit", func(t *testing.T) {
		req, err := http.NewRequest("GET", "/?limit=2&team_id="+th.BasicTeam.Id, nil)
		if err != nil {
			t.Error(err)
		}

		conns := []*model.OutgoingOAuthConnection{conn}

		outgoingOauthIface := &mocks.OutgoingOAuthConnectionInterface{}
		th.App.Srv().OutgoingOAuthConnection = outgoingOauthIface
		outgoingOauthIface.Mock.On("GetConnections", c.AppContext, model.OutgoingOAuthConnectionGetConnectionsFilter{Limit: 2}).Return(conns, nil)
		outgoingOauthIface.Mock.On("SanitizeConnections", mock.Anything)

		httpRecorder := httptest.NewRecorder()
		handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			listOutgoingOAuthConnections(c, w, r)
		})

		handler.ServeHTTP(httpRecorder, req)

		require.Equal(t, http.StatusOK, httpRecorder.Code)
		require.NotEmpty(t, httpRecorder.Body.String())

		var buf bytes.Buffer
		require.NoError(t, json.NewEncoder(&buf).Encode(conn))
	})
}

func TestHandlerOutgoingOAuthConnectionUpdate(t *testing.T) {
	t.Skip("https://mattermost.atlassian.net/browse/MM-61690")

	os.Setenv("MM_FEATUREFLAGS_OUTGOINGOAUTHCONNECTIONS", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_OUTGOINGOAUTHCONNECTIONS")
	th := Setup(t).InitBasic()
	defer th.TearDown()

	license := model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise, "outgoing_oauth_connections")
	license.Id = "test-license-id"
	th.App.Srv().SetLicense(license)
	defer func() {
		appErr := th.App.Srv().RemoveLicense()
		require.Nil(t, appErr)
	}()

	t.Run("no permissions", func(t *testing.T) {
		c := &Context{}
		c.AppContext = th.Context
		c.App = th.App
		c.Logger = th.App.Srv().Log()

		req, err := http.NewRequest("PUT", "/", nil)
		if err != nil {
			t.Error(err)
		}

		outgoingOauthIface := &mocks.OutgoingOAuthConnectionInterface{}
		th.App.Srv().OutgoingOAuthConnection = outgoingOauthIface

		c.Params = &web.Params{
			OutgoingOAuthConnectionID: model.NewId(),
		}

		httpRecorder := httptest.NewRecorder()
		handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			updateOutgoingOAuthConnection(c, w, r)
		})

		handler.ServeHTTP(httpRecorder, req)

		require.Equal(t, http.StatusForbidden, c.Err.StatusCode)
	})

	t.Run("bad json", func(t *testing.T) {
		c := &Context{}
		c.AppContext = th.Context
		c.App = th.App
		c.Logger = th.App.Srv().Log()

		session := model.Session{
			Id:     model.NewId(),
			UserId: model.NewId(),
			Roles:  model.SystemUserRoleId,
		}
		c.AppContext = th.Context.WithSession(&session)

		defaultRolePermissions := th.SaveDefaultRolePermissions()
		defer func() {
			th.RestoreDefaultRolePermissions(defaultRolePermissions)
		}()

		th.AddPermissionToRole(model.PermissionManageOutgoingOAuthConnections.Id, model.SystemUserRoleId)

		body := &bytes.Buffer{}
		body.Write([]byte(`{/}`))

		req, err := http.NewRequest("PUT", "/", body)
		if err != nil {
			t.Error(err)
		}

		outgoingOauthIface := &mocks.OutgoingOAuthConnectionInterface{}
		outgoingOauthImpl := th.App.Srv().OutgoingOAuthConnection
		outgoingOAuthConnectionConfig := th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections
		th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections = model.NewPointer(true)
		t.Cleanup(func() {
			th.App.Srv().OutgoingOAuthConnection = outgoingOauthImpl
			th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections = outgoingOAuthConnectionConfig
		})
		th.App.Srv().OutgoingOAuthConnection = outgoingOauthIface

		c.Params = &web.Params{
			OutgoingOAuthConnectionID: model.NewId(),
		}

		httpRecorder := httptest.NewRecorder()
		handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			updateOutgoingOAuthConnection(c, w, r)
		})

		handler.ServeHTTP(httpRecorder, req)

		require.Equal(t, http.StatusBadRequest, c.Err.StatusCode)
	})

	t.Run("wrong id", func(t *testing.T) {
		c := &Context{}
		c.AppContext = th.Context
		c.App = th.App
		c.Logger = th.App.Srv().Log()

		session := model.Session{
			Id:     model.NewId(),
			UserId: model.NewId(),
			Roles:  model.SystemUserRoleId,
		}
		c.AppContext = th.Context.WithSession(&session)

		defaultRolePermissions := th.SaveDefaultRolePermissions()
		defer func() {
			th.RestoreDefaultRolePermissions(defaultRolePermissions)
		}()

		th.AddPermissionToRole(model.PermissionManageOutgoingOAuthConnections.Id, model.SystemUserRoleId)

		body := &bytes.Buffer{}
		body.Write([]byte(`{"Id": "` + model.NewId() + `", "name": "changed name"}`))

		req, err := http.NewRequest("PUT", "/", body)
		if err != nil {
			t.Error(err)
		}

		outgoingOauthIface := &mocks.OutgoingOAuthConnectionInterface{}
		outgoingOauthImpl := th.App.Srv().OutgoingOAuthConnection
		outgoingOAuthConnectionConfig := th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections
		th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections = model.NewPointer(true)
		t.Cleanup(func() {
			th.App.Srv().OutgoingOAuthConnection = outgoingOauthImpl
			th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections = outgoingOAuthConnectionConfig
		})
		th.App.Srv().OutgoingOAuthConnection = outgoingOauthIface

		c.Params = &web.Params{
			OutgoingOAuthConnectionID: model.NewId(),
		}

		httpRecorder := httptest.NewRecorder()
		handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			updateOutgoingOAuthConnection(c, w, r)
		})

		handler.ServeHTTP(httpRecorder, req)

		require.Equal(t, http.StatusBadRequest, c.Err.StatusCode)
	})

	t.Run("ok", func(t *testing.T) {
		c := &Context{}
		c.AppContext = th.Context
		c.App = th.App
		c.Logger = th.App.Srv().Log()

		conn := newOutgoingOAuthConnection()

		session := model.Session{
			Id:     model.NewId(),
			UserId: model.NewId(),
			Roles:  model.SystemUserRoleId,
		}
		c.AppContext = th.Context.WithSession(&session)

		defaultRolePermissions := th.SaveDefaultRolePermissions()
		defer func() {
			th.RestoreDefaultRolePermissions(defaultRolePermissions)
		}()
		th.AddPermissionToRole(model.PermissionManageOutgoingOAuthConnections.Id, model.SystemUserRoleId)

		conn.Id = model.NewId() // Faking an ID for the connection
		t.Cleanup(func() {
			conn.Id = ""
		})

		body := &bytes.Buffer{}

		inputConnection := conn
		inputConnection.Name = "changed name"

		require.NoError(t, json.NewEncoder(body).Encode(inputConnection))

		req, err := http.NewRequest("PUT", "/"+conn.Id, body)
		if err != nil {
			t.Error(err)
		}

		c.Params = &web.Params{
			OutgoingOAuthConnectionID: conn.Id,
		}

		outgoingOauthIface := &mocks.OutgoingOAuthConnectionInterface{}
		outgoingOauthImpl := th.App.Srv().OutgoingOAuthConnection
		outgoingOAuthConnectionConfig := th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections
		th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections = model.NewPointer(true)
		t.Cleanup(func() {
			th.App.Srv().OutgoingOAuthConnection = outgoingOauthImpl
			th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections = outgoingOAuthConnectionConfig
		})
		th.App.Srv().OutgoingOAuthConnection = outgoingOauthIface
		outgoingOauthIface.Mock.On("GetConnection", c.AppContext, c.Params.OutgoingOAuthConnectionID).Return(conn, nil)
		outgoingOauthIface.Mock.On("UpdateConnection", c.AppContext, inputConnection).Return(inputConnection, nil)
		outgoingOauthIface.Mock.On("SanitizeConnection", mock.Anything)

		httpRecorder := httptest.NewRecorder()
		handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			updateOutgoingOAuthConnection(c, w, r)
		})

		handler.ServeHTTP(httpRecorder, req)

		require.Equal(t, http.StatusOK, httpRecorder.Code)
		require.NotEmpty(t, httpRecorder.Body.String())
	})
}

func TestHandlerOutgoingOAuthConnectionHandlerCreate(t *testing.T) {
	t.Skip("https://mattermost.atlassian.net/browse/MM-61690")

	os.Setenv("MM_FEATUREFLAGS_OUTGOINGOAUTHCONNECTIONS", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_OUTGOINGOAUTHCONNECTIONS")
	th := Setup(t).InitBasic()
	defer th.TearDown()

	license := model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise, "outgoing_oauth_connections")
	license.Id = "test-license-id"
	th.App.Srv().SetLicense(license)
	defer func() {
		appErr := th.App.Srv().RemoveLicense()
		require.Nil(t, appErr)
	}()

	outgoingOAuthConnectionConfig := th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections
	th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections = model.NewPointer(true)
	t.Cleanup(func() {
		th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections = outgoingOAuthConnectionConfig
	})

	t.Run("no permissions", func(t *testing.T) {
		c := &Context{}
		c.AppContext = th.Context
		c.App = th.App
		c.Logger = th.App.Srv().Log()

		req, err := http.NewRequest("POST", "/", nil)
		if err != nil {
			t.Error(err)
		}

		outgoingOauthIface := &mocks.OutgoingOAuthConnectionInterface{}
		th.App.Srv().OutgoingOAuthConnection = outgoingOauthIface

		httpRecorder := httptest.NewRecorder()
		handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			createOutgoingOAuthConnection(c, w, r)
		})

		handler.ServeHTTP(httpRecorder, req)

		require.Equal(t, http.StatusForbidden, c.Err.StatusCode)
	})

	t.Run("bad json", func(t *testing.T) {
		c := &Context{}
		c.AppContext = th.Context
		c.App = th.App
		c.Logger = th.App.Srv().Log()

		session := model.Session{
			Id:     model.NewId(),
			UserId: model.NewId(),
			Roles:  model.SystemUserRoleId,
		}
		c.AppContext = th.Context.WithSession(&session)

		defaultRolePermissions := th.SaveDefaultRolePermissions()
		defer func() {
			th.RestoreDefaultRolePermissions(defaultRolePermissions)
		}()

		th.AddPermissionToRole(model.PermissionManageOutgoingOAuthConnections.Id, model.SystemUserRoleId)

		body := &bytes.Buffer{}
		body.Write([]byte(`{/}`))

		req, err := http.NewRequest("POST", "/", body)
		if err != nil {
			t.Error(err)
		}
		outgoingOauthIface := &mocks.OutgoingOAuthConnectionInterface{}
		outgoingOauthImpl := th.App.Srv().OutgoingOAuthConnection
		outgoingOAuthConnectionConfig := th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections
		th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections = model.NewPointer(true)
		t.Cleanup(func() {
			th.App.Srv().OutgoingOAuthConnection = outgoingOauthImpl
			th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections = outgoingOAuthConnectionConfig
		})
		th.App.Srv().OutgoingOAuthConnection = outgoingOauthIface

		httpRecorder := httptest.NewRecorder()

		handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			createOutgoingOAuthConnection(c, w, r)
		})

		handler.ServeHTTP(httpRecorder, req)

		require.Equal(t, http.StatusBadRequest, c.Err.StatusCode)
	})

	t.Run("ok", func(t *testing.T) {
		c := &Context{}
		c.AppContext = th.Context
		c.App = th.App
		c.Logger = th.App.Srv().Log()

		conn := newOutgoingOAuthConnection()

		session := model.Session{
			Id:     model.NewId(),
			UserId: model.NewId(),
			Roles:  model.SystemUserRoleId,
		}
		c.AppContext = th.Context.WithSession(&session)

		defaultRolePermissions := th.SaveDefaultRolePermissions()
		defer func() {
			th.RestoreDefaultRolePermissions(defaultRolePermissions)
		}()
		th.AddPermissionToRole(model.PermissionManageOutgoingOAuthConnections.Id, model.SystemUserRoleId)

		body := &bytes.Buffer{}
		require.NoError(t, json.NewEncoder(body).Encode(conn))

		req, err := http.NewRequest("POST", "/", body)
		if err != nil {
			t.Error(err)
		}

		// Handler sets the connection creator ID to the session user ID
		handlerConn := conn
		handlerConn.CreatorId = session.UserId

		outgoingOauthIface := &mocks.OutgoingOAuthConnectionInterface{}
		outgoingOauthImpl := th.App.Srv().OutgoingOAuthConnection
		outgoingOAuthConnectionConfig := th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections
		th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections = model.NewPointer(true)
		t.Cleanup(func() {
			th.App.Srv().OutgoingOAuthConnection = outgoingOauthImpl
			th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections = outgoingOAuthConnectionConfig
		})
		th.App.Srv().OutgoingOAuthConnection = outgoingOauthIface
		outgoingOauthIface.Mock.On("SaveConnection", c.AppContext, handlerConn).Return(handlerConn, nil)
		outgoingOauthIface.Mock.On("SanitizeConnection", mock.Anything)

		httpRecorder := httptest.NewRecorder()
		handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			createOutgoingOAuthConnection(c, w, r)
		})

		handler.ServeHTTP(httpRecorder, req)

		require.Equal(t, http.StatusCreated, httpRecorder.Code)
		require.NotEmpty(t, httpRecorder.Body.String())
	})
}

func TestHandlerOutgoingOAuthConnectionHandlerValidate(t *testing.T) {
	t.Skip("https://mattermost.atlassian.net/browse/MM-61690")

	os.Setenv("MM_FEATUREFLAGS_OUTGOINGOAUTHCONNECTIONS", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_OUTGOINGOAUTHCONNECTIONS")
	th := Setup(t).InitBasic()
	defer th.TearDown()

	license := model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise, "outgoing_oauth_connections")
	license.Id = "test-license-id"
	th.App.Srv().SetLicense(license)
	defer func() {
		appErr := th.App.Srv().RemoveLicense()
		require.Nil(t, appErr)
	}()

	// Run a server to fake the valid and invalid requests made to the oauth server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch strings.TrimSpace(r.URL.Path) {
		case "/valid":
			w.WriteHeader(http.StatusOK)
		case "/invalid":
			w.WriteHeader(http.StatusBadRequest)
		default:
			http.NotFoundHandler().ServeHTTP(w, r)
		}
	}))
	t.Cleanup(func() {
		server.Close()
	})

	t.Run("no permissions", func(t *testing.T) {
		c := &Context{}
		c.AppContext = th.Context
		c.App = th.App
		c.Logger = th.App.Srv().Log()

		req, err := http.NewRequest("POST", "/", nil)
		if err != nil {
			t.Error(err)
		}

		outgoingOauthIface := &mocks.OutgoingOAuthConnectionInterface{}
		outgoingOauthImpl := th.App.Srv().OutgoingOAuthConnection
		outgoingOAuthConnectionConfig := th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections
		th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections = model.NewPointer(true)
		t.Cleanup(func() {
			th.App.Srv().OutgoingOAuthConnection = outgoingOauthImpl
			th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections = outgoingOAuthConnectionConfig
		})
		th.App.Srv().OutgoingOAuthConnection = outgoingOauthIface

		httpRecorder := httptest.NewRecorder()
		handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			validateOutgoingOAuthConnectionCredentials(c, w, r)
		})

		handler.ServeHTTP(httpRecorder, req)

		require.Equal(t, http.StatusForbidden, c.Err.StatusCode)
	})

	t.Run("no interface", func(t *testing.T) {
		c := &Context{}
		c.AppContext = th.Context
		c.App = th.App
		c.Logger = th.App.Srv().Log()

		req, err := http.NewRequest("POST", "/", nil)
		if err != nil {
			t.Error(err)
		}

		session := model.Session{
			Id:     model.NewId(),
			UserId: model.NewId(),
			Roles:  model.SystemUserRoleId,
		}
		c.AppContext = th.Context.WithSession(&session)

		defaultRolePermissions := th.SaveDefaultRolePermissions()
		defer func() {
			th.RestoreDefaultRolePermissions(defaultRolePermissions)
		}()
		th.AddPermissionToRole(model.PermissionManageOutgoingOAuthConnections.Id, model.SystemUserRoleId)

		outgoingOauthImpl := th.App.Srv().OutgoingOAuthConnection
		defer func() {
			th.App.Srv().OutgoingOAuthConnection = outgoingOauthImpl
		}()
		th.App.Srv().OutgoingOAuthConnection = nil

		httpRecorder := httptest.NewRecorder()
		handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			validateOutgoingOAuthConnectionCredentials(c, w, r)
		})

		handler.ServeHTTP(httpRecorder, req)

		require.Equal(t, http.StatusNotImplemented, c.Err.StatusCode)
	})

	t.Run("invalid", func(t *testing.T) {
		conn := newOutgoingOAuthConnection()
		conn.CreatorId = model.NewId()
		conn.OAuthTokenURL = server.URL + "/invalid"

		c := &Context{}
		c.AppContext = th.Context
		c.App = th.App
		c.Logger = th.App.Srv().Log()

		session := model.Session{
			Id:     model.NewId(),
			UserId: conn.CreatorId,
			Roles:  model.SystemUserRoleId,
		}
		c.AppContext = th.Context.WithSession(&session)

		defaultRolePermissions := th.SaveDefaultRolePermissions()
		defer func() {
			th.RestoreDefaultRolePermissions(defaultRolePermissions)
		}()
		th.AddPermissionToRole(model.PermissionManageOutgoingOAuthConnections.Id, model.SystemUserRoleId)

		body := &bytes.Buffer{}
		require.NoError(t, json.NewEncoder(body).Encode(conn))
		req, err := http.NewRequest("POST", "/", body)
		if err != nil {
			t.Error(err)
		}

		outgoingOauthIface := &mocks.OutgoingOAuthConnectionInterface{}
		outgoingOauthImpl := th.App.Srv().OutgoingOAuthConnection
		outgoingOAuthConnectionConfig := th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections
		th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections = model.NewPointer(true)
		t.Cleanup(func() {
			th.App.Srv().OutgoingOAuthConnection = outgoingOauthImpl
			th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections = outgoingOAuthConnectionConfig
		})
		th.App.Srv().OutgoingOAuthConnection = outgoingOauthIface
		outgoingOauthIface.Mock.On("RetrieveTokenForConnection", c.AppContext, conn).Return(&model.OutgoingOAuthConnectionToken{}, model.NewAppError(whereOutgoingOAuthConnection, "api.context.outgoing_oauth_connection.validate_connection_credentials.input_error", nil, "error", http.StatusBadRequest))

		httpRecorder := httptest.NewRecorder()
		handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			validateOutgoingOAuthConnectionCredentials(c, w, r)
		})

		handler.ServeHTTP(httpRecorder, req)

		require.Equal(t, http.StatusBadRequest, httpRecorder.Code)
	})

	t.Run("success", func(t *testing.T) {
		conn := newOutgoingOAuthConnection()
		conn.CreatorId = model.NewId()
		conn.OAuthTokenURL = server.URL + "/valid"

		c := &Context{}
		c.AppContext = th.Context
		c.App = th.App
		c.Logger = th.App.Srv().Log()

		session := model.Session{
			Id:     model.NewId(),
			UserId: conn.CreatorId,
			Roles:  model.SystemUserRoleId,
		}
		c.AppContext = th.Context.WithSession(&session)

		defaultRolePermissions := th.SaveDefaultRolePermissions()
		defer func() {
			th.RestoreDefaultRolePermissions(defaultRolePermissions)
		}()
		th.AddPermissionToRole(model.PermissionManageOutgoingOAuthConnections.Id, model.SystemUserRoleId)

		body := &bytes.Buffer{}
		require.NoError(t, json.NewEncoder(body).Encode(conn))

		req, err := http.NewRequest("POST", "/", body)
		if err != nil {
			t.Error(err)
		}

		outgoingOauthIface := &mocks.OutgoingOAuthConnectionInterface{}
		outgoingOauthImpl := th.App.Srv().OutgoingOAuthConnection
		outgoingOAuthConnectionConfig := th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections
		th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections = model.NewPointer(true)
		t.Cleanup(func() {
			th.App.Srv().OutgoingOAuthConnection = outgoingOauthImpl
			th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections = outgoingOAuthConnectionConfig
		})
		th.App.Srv().OutgoingOAuthConnection = outgoingOauthIface
		outgoingOauthIface.Mock.On("RetrieveTokenForConnection", c.AppContext, conn).Return(&model.OutgoingOAuthConnectionToken{}, nil)

		httpRecorder := httptest.NewRecorder()
		handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			validateOutgoingOAuthConnectionCredentials(c, w, r)
		})

		handler.ServeHTTP(httpRecorder, req)

		require.Equal(t, http.StatusOK, httpRecorder.Code)
	})

	t.Run("success (stored connection)", func(t *testing.T) {
		conn := newOutgoingOAuthConnection()
		conn.CreatorId = model.NewId()
		conn.OAuthTokenURL = server.URL + "/valid"

		c := &Context{}
		c.AppContext = th.Context
		c.App = th.App
		c.Logger = th.App.Srv().Log()

		session := model.Session{
			Id:     model.NewId(),
			UserId: conn.CreatorId,
			Roles:  model.SystemUserRoleId,
		}
		c.AppContext = th.Context.WithSession(&session)
		c.Params = &web.Params{
			OutgoingOAuthConnectionID: conn.Id,
		}

		defaultRolePermissions := th.SaveDefaultRolePermissions()
		defer func() {
			th.RestoreDefaultRolePermissions(defaultRolePermissions)
		}()
		th.AddPermissionToRole(model.PermissionManageOutgoingOAuthConnections.Id, model.SystemUserRoleId)

		body := &bytes.Buffer{}
		require.NoError(t, json.NewEncoder(body).Encode(conn))

		req, err := http.NewRequest("POST", "/", body)
		if err != nil {
			t.Error(err)
		}

		outgoingOauthIface := &mocks.OutgoingOAuthConnectionInterface{}
		outgoingOauthImpl := th.App.Srv().OutgoingOAuthConnection
		outgoingOAuthConnectionConfig := th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections
		th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections = model.NewPointer(true)
		t.Cleanup(func() {
			th.App.Srv().OutgoingOAuthConnection = outgoingOauthImpl
			th.App.Config().ServiceSettings.EnableOutgoingOAuthConnections = outgoingOAuthConnectionConfig
		})
		th.App.Srv().OutgoingOAuthConnection = outgoingOauthIface
		outgoingOauthIface.Mock.On("GetConnection", c.AppContext, conn.Id).Return(conn, nil)
		outgoingOauthIface.Mock.On("RetrieveTokenForConnection", c.AppContext, conn).Return(&model.OutgoingOAuthConnectionToken{}, nil)

		httpRecorder := httptest.NewRecorder()
		handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			validateOutgoingOAuthConnectionCredentials(c, w, r)
		})

		handler.ServeHTTP(httpRecorder, req)

		require.Equal(t, http.StatusOK, httpRecorder.Code)
	})
}
