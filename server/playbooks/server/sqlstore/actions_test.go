// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/jmoiron/sqlx"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/playbooks/server/app"
	mock_sqlstore "github.com/mattermost/mattermost/server/v8/playbooks/server/sqlstore/mocks"
)

func setupChannelActionStore(t *testing.T, db *sqlx.DB) app.ChannelActionStore {
	mockCtrl := gomock.NewController(t)

	kvAPI := mock_sqlstore.NewMockKVAPI(mockCtrl)
	configAPI := mock_sqlstore.NewMockConfigurationAPI(mockCtrl)
	pluginAPIClient := PluginAPIClient{
		KV:            kvAPI,
		Configuration: configAPI,
	}

	sqlStore := setupSQLStore(t, db)

	return NewChannelActionStore(pluginAPIClient, sqlStore)
}

func TestViewedChannel(t *testing.T) {
	db := setupTestDB(t)
	_ = setupSQLStore(t, db)
	channelActionStore := setupChannelActionStore(t, db)

	t.Run("two new users get welcome messages, one old user doesn't", func(t *testing.T) {
		channelID := model.NewId()

		oldID := model.NewId()
		newID1 := model.NewId()
		newID2 := model.NewId()

		err := channelActionStore.SetViewedChannel(oldID, channelID)
		require.NoError(t, err)

		// Setting multiple times is okay
		err = channelActionStore.SetViewedChannel(oldID, channelID)
		require.NoError(t, err)
		err = channelActionStore.SetViewedChannel(oldID, channelID)
		require.NoError(t, err)

		// new users get welcome messages
		hasViewed := channelActionStore.HasViewedChannel(newID1, channelID)
		require.False(t, hasViewed)
		err = channelActionStore.SetViewedChannel(newID1, channelID)
		require.NoError(t, err)

		hasViewed = channelActionStore.HasViewedChannel(newID2, channelID)
		require.False(t, hasViewed)
		err = channelActionStore.SetViewedChannel(newID2, channelID)
		require.NoError(t, err)

		// old user does not
		hasViewed = channelActionStore.HasViewedChannel(oldID, channelID)
		require.True(t, hasViewed)

		// new users do not, now:
		hasViewed = channelActionStore.HasViewedChannel(newID1, channelID)
		require.True(t, hasViewed)
		hasViewed = channelActionStore.HasViewedChannel(newID2, channelID)
		require.True(t, hasViewed)

		var rows int64
		err = db.Get(&rows, "SELECT COUNT(*) FROM IR_ViewedChannel")
		require.NoError(t, err)
		require.Equal(t, 3, int(rows))

		// cannot add a duplicate row
		if db.DriverName() == model.DatabaseDriverPostgres {
			_, err = db.Exec("INSERT INTO IR_ViewedChannel (UserID, ChannelID) VALUES ($1, $2)", oldID, channelID)
			require.Error(t, err)
			require.Contains(t, err.Error(), "duplicate key value")
		} else {
			_, err = db.Exec("INSERT INTO IR_ViewedChannel (UserID, ChannelID) VALUES (?, ?)", oldID, channelID)
			require.Error(t, err)
			require.Contains(t, err.Error(), "Duplicate entry")
		}

		err = db.Get(&rows, "SELECT COUNT(*) FROM IR_ViewedChannel")
		require.NoError(t, err)
		require.Equal(t, 3, int(rows))
	})
}
