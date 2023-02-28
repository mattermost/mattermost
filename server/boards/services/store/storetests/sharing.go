package storetests

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/boards/model"
	"github.com/mattermost/mattermost-server/v6/boards/services/store"
)

func StoreTestSharingStore(t *testing.T, setup func(t *testing.T) (store.Store, func())) {
	t.Run("UpsertSharingAndGetSharing", func(t *testing.T) {
		store, tearDown := setup(t)
		defer tearDown()
		testUpsertSharingAndGetSharing(t, store)
	})
}

func testUpsertSharingAndGetSharing(t *testing.T, store store.Store) {
	t.Run("Insert first sharing and get it", func(t *testing.T) {
		sharing := model.Sharing{
			ID:         "sharing-id",
			Enabled:    true,
			Token:      "token",
			ModifiedBy: testUserID,
		}

		err := store.UpsertSharing(sharing)
		require.NoError(t, err)
		newSharing, err := store.GetSharing("sharing-id")
		require.NoError(t, err)
		newSharing.UpdateAt = 0
		require.Equal(t, sharing, *newSharing)
	})
	t.Run("Upsert the inserted sharing and get it", func(t *testing.T) {
		sharing := model.Sharing{
			ID:         "sharing-id",
			Enabled:    true,
			Token:      "token2",
			ModifiedBy: "user-id2",
		}

		newSharing, err := store.GetSharing("sharing-id")
		require.NoError(t, err)
		newSharing.UpdateAt = 0
		require.NotEqual(t, sharing, *newSharing)

		err = store.UpsertSharing(sharing)
		require.NoError(t, err)
		newSharing, err = store.GetSharing("sharing-id")
		require.NoError(t, err)
		newSharing.UpdateAt = 0
		require.Equal(t, sharing, *newSharing)
	})
	t.Run("Get not existing sharing", func(t *testing.T) {
		_, err := store.GetSharing("not-existing")
		require.Error(t, err)
		require.True(t, model.IsErrNotFound(err))
	})
}
