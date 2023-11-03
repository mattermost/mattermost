// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"sort"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/stretchr/testify/require"
)

func newValidOAuthOutgoingConnection() *model.OAuthOutgoingConnection {
	return &model.OAuthOutgoingConnection{
		CreatorId:     model.NewId(),
		Name:          "Test Connection",
		ClientId:      model.NewId(),
		ClientSecret:  model.NewId(),
		OAuthTokenURL: "https://nowhere.com/oauth/token",
		GrantType:     "client_credentials",
		Audiences:     []string{"https://nowhere.com"},
	}
}

func cleanupOAuthOutgoingConnections(t *testing.T, ss store.Store) func() {
	return func() {
		// Delete all outgoing connections
		connections, err := ss.OAuthOutgoingConnection().GetConnections(request.TestContext(t), model.OAuthOutgoingConnectionGetConnectionsFilter{
			Limit: 100,
		})
		require.NoError(t, err)
		for _, conn := range connections {
			err := ss.OAuthOutgoingConnection().DeleteConnection(request.TestContext(t), conn.Id)
			require.NoError(t, err)
		}
	}
}

func TestOAuthOutgoingConnectionStore(t *testing.T, ss store.Store) {
	t.Run("SaveConnection", func(t *testing.T) {
		t.Cleanup(cleanupOAuthOutgoingConnections(t, ss))
		testSaveOauthOutgoingConnection(t, ss)
	})
	t.Run("UpdateConnection", func(t *testing.T) {
		t.Cleanup(cleanupOAuthOutgoingConnections(t, ss))
		testUpdateOauthOutgoingConnection(t, ss)
	})
	t.Run("GetConnection", func(t *testing.T) {
		t.Cleanup(cleanupOAuthOutgoingConnections(t, ss))
		testGetOauthOutgoingConnection(t, ss)
	})
	t.Run("GetConnections", func(t *testing.T) {
		t.Cleanup(cleanupOAuthOutgoingConnections(t, ss))
		testGetOauthOutgoingConnections(t, ss)
	})
	t.Run("DeleteConnection", func(t *testing.T) {
		t.Cleanup(cleanupOAuthOutgoingConnections(t, ss))
		testDeleteOauthOutgoingConnection(t, ss)
	})
}

func testSaveOauthOutgoingConnection(t *testing.T, ss store.Store) {
	c := request.TestContext(t)

	t.Run("save/get", func(t *testing.T) {
		// Define test data
		connection := newValidOAuthOutgoingConnection()

		// Save the connection
		_, err := ss.OAuthOutgoingConnection().SaveConnection(c, connection)
		require.NoError(t, err)

		// Retrieve the connection
		_, err = ss.OAuthOutgoingConnection().GetConnection(c, connection.Id)
		require.NoError(t, err)
	})

	t.Run("save without id should fail", func(t *testing.T) {
		connection := &model.OAuthOutgoingConnection{
			Id: model.NewId(),
		}

		_, err := ss.OAuthOutgoingConnection().SaveConnection(c, connection)
		require.Error(t, err)
	})
}

func testUpdateOauthOutgoingConnection(t *testing.T, ss store.Store) {
	c := request.TestContext(t)

	t.Run("update/get", func(t *testing.T) {
		// Define test data
		connection := newValidOAuthOutgoingConnection()

		// Save the connection
		_, err := ss.OAuthOutgoingConnection().SaveConnection(c, connection)
		require.NoError(t, err)

		// Update the connection
		connection.Name = "Updated Name"
		_, err = ss.OAuthOutgoingConnection().UpdateConnection(c, connection)
		require.NoError(t, err)

		// Retrieve the connection
		conn, err := ss.OAuthOutgoingConnection().GetConnection(c, connection.Id)
		require.NoError(t, err)
		require.Equal(t, connection.Name, conn.Name)
	})

	t.Run("update non-existing", func(t *testing.T) {
		connection := newValidOAuthOutgoingConnection()
		connection.Id = model.NewId()

		_, err := ss.OAuthOutgoingConnection().UpdateConnection(c, connection)
		require.Error(t, err)
	})

	t.Run("update without id should fail", func(t *testing.T) {
		connection := &model.OAuthOutgoingConnection{
			Id: model.NewId(),
		}

		_, err := ss.OAuthOutgoingConnection().UpdateConnection(c, connection)
		require.Error(t, err)
	})

	t.Run("update should update all fields", func(t *testing.T) {
		// Define test data
		connection := newValidOAuthOutgoingConnection()

		// Save the connection
		_, err := ss.OAuthOutgoingConnection().SaveConnection(c, connection)
		require.NoError(t, err)

		// Update the connection
		connection.Name = "Updated Name"
		connection.ClientId = "Updated ClientId"
		connection.ClientSecret = "Updated ClientSecret"
		connection.OAuthTokenURL = "https://nowhere.com/updated"
		// connection.GrantType = "client_credentials" // ignoring since we only allow one for now
		connection.Audiences = []string{"https://nowhere.com/updated"}
		_, err = ss.OAuthOutgoingConnection().UpdateConnection(c, connection)
		require.NoError(t, err)

		// Retrieve the connection
		conn, err := ss.OAuthOutgoingConnection().GetConnection(c, connection.Id)
		require.NoError(t, err)
		require.Equal(t, connection.Name, conn.Name)
		require.Equal(t, connection.ClientId, conn.ClientId)
		require.Equal(t, connection.ClientSecret, conn.ClientSecret)
		require.Equal(t, connection.OAuthTokenURL, conn.OAuthTokenURL)
		require.Equal(t, connection.GrantType, conn.GrantType)
		require.Equal(t, connection.Audiences, conn.Audiences)
	})
}

func testGetOauthOutgoingConnection(t *testing.T, ss store.Store) {
	c := request.TestContext(t)

	t.Run("get non-existing", func(t *testing.T) {
		_, err := ss.OAuthOutgoingConnection().GetConnection(c, model.NewId())
		require.Error(t, err)
	})
}

func testGetOauthOutgoingConnections(t *testing.T, ss store.Store) {
	c := request.TestContext(t)

	// Define test data
	connection1 := newValidOAuthOutgoingConnection()
	connection2 := newValidOAuthOutgoingConnection()
	connection3 := newValidOAuthOutgoingConnection()

	// Save the connections
	connection1, err := ss.OAuthOutgoingConnection().SaveConnection(c, connection1)
	require.NoError(t, err)
	connection2, err = ss.OAuthOutgoingConnection().SaveConnection(c, connection2)
	require.NoError(t, err)
	connection3, err = ss.OAuthOutgoingConnection().SaveConnection(c, connection3)
	require.NoError(t, err)

	connections := []*model.OAuthOutgoingConnection{connection1, connection2, connection3}
	sort.Slice(connections, func(i, j int) bool {
		return connections[i].Id < connections[j].Id
	})

	t.Run("get all", func(t *testing.T) {
		// Retrieve the connections
		conns, err := ss.OAuthOutgoingConnection().GetConnections(c, model.OAuthOutgoingConnectionGetConnectionsFilter{Limit: 3})
		require.NoError(t, err)
		require.Len(t, conns, 3)
	})

	t.Run("get connections using pagination", func(t *testing.T) {
		// Retrieve the firt page
		conns, err := ss.OAuthOutgoingConnection().GetConnections(c, model.OAuthOutgoingConnectionGetConnectionsFilter{Limit: 1})
		require.NoError(t, err)
		require.Len(t, conns, 1)
		require.Equal(t, connections[0].Id, conns[0].Id, "should return the first connection")

		// Retrieve the second page
		conns, err = ss.OAuthOutgoingConnection().GetConnections(c, model.OAuthOutgoingConnectionGetConnectionsFilter{OffsetId: connections[0].Id})
		require.NoError(t, err)
		require.Len(t, conns, 2)
		require.Equal(t, connections[1].Id, conns[0].Id, "should return the second connection")
		require.Equal(t, connections[2].Id, conns[1].Id, "should return the third connection")
	})
}

func testDeleteOauthOutgoingConnection(t *testing.T, ss store.Store) {
	c := request.TestContext(t)

	t.Run("delete", func(t *testing.T) {
		// Define test data
		connection := newValidOAuthOutgoingConnection()

		// Save the connection
		_, err := ss.OAuthOutgoingConnection().SaveConnection(c, connection)
		require.NoError(t, err)

		// Delete the connection
		err = ss.OAuthOutgoingConnection().DeleteConnection(c, connection.Id)
		require.NoError(t, err)

		// Retrieve the connection
		_, err = ss.OAuthOutgoingConnection().GetConnection(c, connection.Id)
		require.Error(t, err)
	})
}
