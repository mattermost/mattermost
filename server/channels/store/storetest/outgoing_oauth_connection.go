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

func newValidOutgoingOAuthConnection() *model.OutgoingOAuthConnection {
	return &model.OutgoingOAuthConnection{
		CreatorId:     model.NewId(),
		Name:          "Test Connection",
		ClientId:      model.NewId(),
		ClientSecret:  model.NewId(),
		OAuthTokenURL: "https://nowhere.com/oauth/token",
		GrantType:     model.OutgoingOAuthConnectionGrantTypeClientCredentials,
		Audiences:     []string{"https://nowhere.com"},
	}
}

func cleanupOutgoingOAuthConnections(t *testing.T, ss store.Store) func() {
	return func() {
		// Delete all outgoing connections
		connections, err := ss.OutgoingOAuthConnection().GetConnections(request.TestContext(t), model.OutgoingOAuthConnectionGetConnectionsFilter{
			Limit: 100,
		})
		require.NoError(t, err)
		for _, conn := range connections {
			err := ss.OutgoingOAuthConnection().DeleteConnection(request.TestContext(t), conn.Id)
			require.NoError(t, err)
		}
	}
}

func TestOutgoingOAuthConnectionStore(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("SaveConnection", func(t *testing.T) {
		t.Cleanup(cleanupOutgoingOAuthConnections(t, ss))
		testSaveOutgoingOAuthConnection(t, ss)
	})
	t.Run("UpdateConnection", func(t *testing.T) {
		t.Cleanup(cleanupOutgoingOAuthConnections(t, ss))
		testUpdateOutgoingOAuthConnection(t, ss)
	})
	t.Run("GetConnection", func(t *testing.T) {
		t.Cleanup(cleanupOutgoingOAuthConnections(t, ss))
		testGetOutgoingOAuthConnection(t, ss)
	})
	t.Run("GetConnectionsByAudience", func(t *testing.T) {
		t.Cleanup(cleanupOutgoingOAuthConnections(t, ss))
		testGetOutgoingOAuthConnectionByAudience(t, ss)
	})
	t.Run("GetConnections", func(t *testing.T) {
		t.Cleanup(cleanupOutgoingOAuthConnections(t, ss))
		testGetOutgoingOAuthConnections(t, ss)
	})
	t.Run("DeleteConnection", func(t *testing.T) {
		t.Cleanup(cleanupOutgoingOAuthConnections(t, ss))
		testDeleteOutgoingOAuthConnection(t, ss)
	})
}

func testSaveOutgoingOAuthConnection(t *testing.T, ss store.Store) {
	c := request.TestContext(t)

	t.Run("save/get", func(t *testing.T) {
		// Define test data
		connection := newValidOutgoingOAuthConnection()

		// Save the connection
		_, err := ss.OutgoingOAuthConnection().SaveConnection(c, connection)
		require.NoError(t, err)

		// Retrieve the connection
		storeConn, err := ss.OutgoingOAuthConnection().GetConnection(c, connection.Id)
		require.NoError(t, err)
		require.Equal(t, connection, storeConn)
	})

	t.Run("save without id should fail", func(t *testing.T) {
		connection := &model.OutgoingOAuthConnection{
			Id: model.NewId(),
		}

		_, err := ss.OutgoingOAuthConnection().SaveConnection(c, connection)
		require.Error(t, err)
	})

	t.Run("save with incorrect grant type should fail", func(t *testing.T) {
		connection := newValidOutgoingOAuthConnection()
		connection.GrantType = "incorrect"

		_, err := ss.OutgoingOAuthConnection().SaveConnection(c, connection)
		require.Error(t, err)
	})
}

func testUpdateOutgoingOAuthConnection(t *testing.T, ss store.Store) {
	c := request.TestContext(t)

	t.Run("update/get", func(t *testing.T) {
		// Define test data
		connection := newValidOutgoingOAuthConnection()

		// Save the connection
		_, err := ss.OutgoingOAuthConnection().SaveConnection(c, connection)
		require.NoError(t, err)

		// Update the connection
		connection.Name = "Updated Name"
		_, err = ss.OutgoingOAuthConnection().UpdateConnection(c, connection)
		require.NoError(t, err)

		// Retrieve the connection
		storeConn, err := ss.OutgoingOAuthConnection().GetConnection(c, connection.Id)
		require.NoError(t, err)
		require.Equal(t, connection, storeConn)
	})

	t.Run("update non-existing", func(t *testing.T) {
		connection := newValidOutgoingOAuthConnection()
		connection.Id = model.NewId()

		_, err := ss.OutgoingOAuthConnection().UpdateConnection(c, connection)
		require.Error(t, err)
	})

	t.Run("update without id should fail", func(t *testing.T) {
		connection := &model.OutgoingOAuthConnection{
			Id: model.NewId(),
		}

		_, err := ss.OutgoingOAuthConnection().UpdateConnection(c, connection)
		require.Error(t, err)
	})

	t.Run("update should update all fields", func(t *testing.T) {
		// Define test data
		connection := newValidOutgoingOAuthConnection()

		// Save the connection
		_, err := ss.OutgoingOAuthConnection().SaveConnection(c, connection)
		require.NoError(t, err)

		// Update the connection
		connection.Name = "Updated Name"
		connection.ClientId = "Updated ClientId"
		connection.ClientSecret = "Updated ClientSecret"
		connection.OAuthTokenURL = "https://nowhere.com/updated"
		// connection.GrantType = "client_credentials" // ignoring since we only allow one for now
		connection.Audiences = []string{"https://nowhere.com/updated"}
		_, err = ss.OutgoingOAuthConnection().UpdateConnection(c, connection)
		require.NoError(t, err)

		// Retrieve the connection
		storeConn, err := ss.OutgoingOAuthConnection().GetConnection(c, connection.Id)
		require.NoError(t, err)
		require.Equal(t, connection, storeConn)
	})

	t.Run("patch", func(t *testing.T) {
		t.Run("name", func(t *testing.T) {
			connection := newValidOutgoingOAuthConnection()
			_, err := ss.OutgoingOAuthConnection().SaveConnection(c, connection)
			require.NoError(t, err)

			connection.Name = "Updated Name"

			updated, err := ss.OutgoingOAuthConnection().UpdateConnection(c, connection)
			require.NoError(t, err)
			require.Equal(t, connection, updated)
		})

		t.Run("client id", func(t *testing.T) {
			connection := newValidOutgoingOAuthConnection()
			_, err := ss.OutgoingOAuthConnection().SaveConnection(c, connection)
			require.NoError(t, err)

			connection.ClientId = "Updated ClientId"

			updated, err := ss.OutgoingOAuthConnection().UpdateConnection(c, connection)
			require.NoError(t, err)
			require.Equal(t, connection, updated)
		})

		t.Run("client secret", func(t *testing.T) {
			connection := newValidOutgoingOAuthConnection()
			_, err := ss.OutgoingOAuthConnection().SaveConnection(c, connection)
			require.NoError(t, err)

			connection.ClientSecret = "Updated ClientSecret"

			updated, err := ss.OutgoingOAuthConnection().UpdateConnection(c, connection)
			require.NoError(t, err)
			require.Equal(t, connection, updated)
		})

		t.Run("oauth token url", func(t *testing.T) {
			connection := newValidOutgoingOAuthConnection()
			_, err := ss.OutgoingOAuthConnection().SaveConnection(c, connection)
			require.NoError(t, err)

			connection.OAuthTokenURL = "https://nowhere.com/updated"

			updated, err := ss.OutgoingOAuthConnection().UpdateConnection(c, connection)
			require.NoError(t, err)
			require.Equal(t, connection, updated)
		})

		t.Run("grant type", func(t *testing.T) {
			connection := newValidOutgoingOAuthConnection()
			_, err := ss.OutgoingOAuthConnection().SaveConnection(c, connection)
			require.NoError(t, err)

			connection.GrantType = model.OutgoingOAuthConnectionGrantTypeClientCredentials

			updated, err := ss.OutgoingOAuthConnection().UpdateConnection(c, connection)
			require.NoError(t, err)
			require.Equal(t, connection, updated)
		})

		t.Run("audiences", func(t *testing.T) {
			connection := newValidOutgoingOAuthConnection()
			_, err := ss.OutgoingOAuthConnection().SaveConnection(c, connection)
			require.NoError(t, err)

			connection.Audiences = model.StringArray{"https://nowhere.com/updated"}

			updated, err := ss.OutgoingOAuthConnection().UpdateConnection(c, connection)
			require.NoError(t, err)
			require.Equal(t, connection, updated)
		})

		t.Run("credentials username", func(t *testing.T) {
			connection := newValidOutgoingOAuthConnection()
			_, err := ss.OutgoingOAuthConnection().SaveConnection(c, connection)
			require.NoError(t, err)

			username := "updated username"
			connection.CredentialsUsername = &username

			updated, err := ss.OutgoingOAuthConnection().UpdateConnection(c, connection)
			require.NoError(t, err)
			require.Equal(t, connection, updated)
		})

		t.Run("credentials password", func(t *testing.T) {
			connection := newValidOutgoingOAuthConnection()
			_, err := ss.OutgoingOAuthConnection().SaveConnection(c, connection)
			require.NoError(t, err)

			password := "updated password"
			connection.CredentialsPassword = &password

			updated, err := ss.OutgoingOAuthConnection().UpdateConnection(c, connection)
			require.NoError(t, err)
			require.Equal(t, connection, updated)
		})
	})
}

func testGetOutgoingOAuthConnection(t *testing.T, ss store.Store) {
	c := request.TestContext(t)

	t.Run("get non-existing", func(t *testing.T) {
		nonExistingId := model.NewId()
		var expected *store.ErrNotFound
		_, err := ss.OutgoingOAuthConnection().GetConnection(c, nonExistingId)
		require.ErrorAs(t, err, &expected)
	})
}

func runAudienceTests(t *testing.T, ss store.Store, connection *model.OutgoingOAuthConnection) {
	c := request.TestContext(t)

	t.Run("find by host only", func(t *testing.T) {
		conn, err := ss.OutgoingOAuthConnection().GetConnections(c, model.OutgoingOAuthConnectionGetConnectionsFilter{Audience: "knowhere.com"})
		require.NoError(t, err)
		require.Len(t, conn, 1)
		require.Equal(t, []*model.OutgoingOAuthConnection{connection}, conn)
	})

	t.Run("find by host and path", func(t *testing.T) {
		conn, err := ss.OutgoingOAuthConnection().GetConnections(c, model.OutgoingOAuthConnectionGetConnectionsFilter{Audience: "knowhere.com/audience"})
		require.NoError(t, err)
		require.Len(t, conn, 1)
		require.Equal(t, []*model.OutgoingOAuthConnection{connection}, conn)
	})

	t.Run("find by full url", func(t *testing.T) {
		conn, err := ss.OutgoingOAuthConnection().GetConnections(c, model.OutgoingOAuthConnectionGetConnectionsFilter{Audience: "https://knowhere.com/audience"})
		require.NoError(t, err)
		require.Len(t, conn, 1)
		require.Equal(t, []*model.OutgoingOAuthConnection{connection}, conn)
	})

	t.Run("non-existent", func(t *testing.T) {
		conn, err := ss.OutgoingOAuthConnection().GetConnections(c, model.OutgoingOAuthConnectionGetConnectionsFilter{Audience: "https://mattermost.com"})
		require.NoError(t, err)
		require.Empty(t, conn)
	})
}

func testGetOutgoingOAuthConnectionByAudience(t *testing.T, ss store.Store) {
	t.Run("get non-existing", func(t *testing.T) {
		c := request.TestContext(t)

		nonExistingId := model.NewId()
		var expected *store.ErrNotFound
		_, err := ss.OutgoingOAuthConnection().GetConnection(c, nonExistingId)
		require.ErrorAs(t, err, &expected)
	})

	t.Run("get existing (single audience)", func(t *testing.T) {
		t.Cleanup(cleanupOutgoingOAuthConnections(t, ss))
		c := request.TestContext(t)

		connection := newValidOutgoingOAuthConnection()
		connection.Audiences = []string{"https://knowhere.com/audience"}
		var err error
		connection, err = ss.OutgoingOAuthConnection().SaveConnection(c, connection)
		require.NoError(t, err)

		runAudienceTests(t, ss, connection)
	})

	t.Run("get existing (multiple audiences)", func(t *testing.T) {
		t.Cleanup(cleanupOutgoingOAuthConnections(t, ss))
		c := request.TestContext(t)

		connection := newValidOutgoingOAuthConnection()
		connection.Audiences = []string{"https://knowhere.com/audience", "https://example.com"}
		var err error
		connection, err = ss.OutgoingOAuthConnection().SaveConnection(c, connection)
		require.NoError(t, err)

		runAudienceTests(t, ss, connection)
	})
}

func testGetOutgoingOAuthConnections(t *testing.T, ss store.Store) {
	c := request.TestContext(t)

	// Define test data
	connection1 := newValidOutgoingOAuthConnection()
	connection2 := newValidOutgoingOAuthConnection()
	connection3 := newValidOutgoingOAuthConnection()

	// Save the connections
	connection1, err := ss.OutgoingOAuthConnection().SaveConnection(c, connection1)
	require.NoError(t, err)
	connection2, err = ss.OutgoingOAuthConnection().SaveConnection(c, connection2)
	require.NoError(t, err)
	connection3, err = ss.OutgoingOAuthConnection().SaveConnection(c, connection3)
	require.NoError(t, err)

	connections := []*model.OutgoingOAuthConnection{connection1, connection2, connection3}
	sort.Slice(connections, func(i, j int) bool {
		return connections[i].Id < connections[j].Id
	})

	t.Run("get all", func(t *testing.T) {
		// Retrieve the connections
		conns, err := ss.OutgoingOAuthConnection().GetConnections(c, model.OutgoingOAuthConnectionGetConnectionsFilter{Limit: 3})
		require.NoError(t, err)
		require.Len(t, conns, 3)
	})

	t.Run("get connections using pagination", func(t *testing.T) {
		// Retrieve the first page
		conns, err := ss.OutgoingOAuthConnection().GetConnections(c, model.OutgoingOAuthConnectionGetConnectionsFilter{Limit: 1})
		require.NoError(t, err)
		require.Len(t, conns, 1)
		require.Equal(t, connections[0].Id, conns[0].Id, "should return the first connection")

		// Retrieve the second page
		conns, err = ss.OutgoingOAuthConnection().GetConnections(c, model.OutgoingOAuthConnectionGetConnectionsFilter{OffsetId: connections[0].Id})
		require.NoError(t, err)
		require.Len(t, conns, 2)
		require.Equal(t, connections[1].Id, conns[0].Id, "should return the second connection")
		require.Equal(t, connections[2].Id, conns[1].Id, "should return the third connection")
	})
}

func testDeleteOutgoingOAuthConnection(t *testing.T, ss store.Store) {
	c := request.TestContext(t)

	t.Run("delete", func(t *testing.T) {
		// Define test data
		connection := newValidOutgoingOAuthConnection()

		// Save the connection
		_, err := ss.OutgoingOAuthConnection().SaveConnection(c, connection)
		require.NoError(t, err)

		// Delete the connection
		err = ss.OutgoingOAuthConnection().DeleteConnection(c, connection.Id)
		require.NoError(t, err)

		// Retrieve the connection
		_, err = ss.OutgoingOAuthConnection().GetConnection(c, connection.Id)
		var expected *store.ErrNotFound
		require.ErrorAs(t, err, &expected)
	})
}
