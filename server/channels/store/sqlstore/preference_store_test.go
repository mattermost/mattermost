// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"
)

func TestPreferenceStore(t *testing.T) {
	StoreTestWithSqlStore(t, storetest.TestPreferenceStore)
}

func TestDeletePreferencesRollsBackOnFailure(t *testing.T) {
	StoreTest(t, func(t *testing.T, rctx request.CTX, ss store.Store) {
		userId := model.NewId()
		good := model.Preference{UserId: userId, Category: model.PreferenceCategoryDirectChannelShow, Name: model.NewId(), Value: "v"}
		require.NoError(t, ss.Preference().Save(model.Preferences{good}))

		// deleteTx/recordDeletionsTx skip Preference.IsValid(), so this over-length
		// Category (the Preferences/PreferenceDeletions Category column is varchar(32))
		// reaches Postgres unvalidated and fails only when the delete for this
		// preference executes — i.e. partway through the transaction, after `good`
		// has already been deleted in the same tx.
		tooLong := model.Preference{
			UserId:   userId,
			Category: strings.Repeat("x", 40),
			Name:     model.NewId(),
			Value:    "v",
		}

		err := ss.Preference().DeletePreferences(model.Preferences{good, tooLong})
		require.Error(t, err)

		// If the batch had not rolled back atomically, `good` would be gone.
		data, getErr := ss.Preference().Get(good.UserId, good.Category, good.Name)
		require.NoError(t, getErr, "good preference should still exist: batch must roll back atomically")
		require.Equal(t, good.Value, data.Value)

		// No tombstone should have been recorded for the failed batch either.
		tombstones, tsErr := ss.Preference().GetDeletedSince(userId, 0)
		require.NoError(t, tsErr)
		require.Empty(t, tombstones)
	})
}

func TestDeleteUnusedFeatures(t *testing.T) {
	StoreTest(t, func(t *testing.T, rctx request.CTX, ss store.Store) {
		userId1 := model.NewId()
		userId2 := model.NewId()
		category := model.PreferenceCategoryAdvancedSettings
		feature1 := "feature1"
		feature2 := "feature2"

		features := model.Preferences{
			{
				UserId:   userId1,
				Category: category,
				Name:     store.FeatureTogglePrefix + feature1,
				Value:    "true",
			},
			{
				UserId:   userId2,
				Category: category,
				Name:     store.FeatureTogglePrefix + feature1,
				Value:    "false",
			},
			{
				UserId:   userId1,
				Category: category,
				Name:     store.FeatureTogglePrefix + feature2,
				Value:    "false",
			},
			{
				UserId:   userId2,
				Category: category,
				Name:     store.FeatureTogglePrefix + feature2,
				Value:    "true",
			},
		}

		err := ss.Preference().Save(features)
		require.NoError(t, err)

		ss.Preference().(*SqlPreferenceStore).deleteUnusedFeatures()

		//make sure features with value "false" have actually been deleted from the database
		var val int64
		if err := ss.Preference().(*SqlPreferenceStore).GetReplica().Get(&val, `SELECT COUNT(*)
                            FROM Preferences
                    WHERE Category = ?
                    AND Value = ?
                    AND Name LIKE '`+store.FeatureTogglePrefix+`%'`, model.PreferenceCategoryAdvancedSettings, "false"); err != nil {
			require.NoError(t, err)
		} else if val != 0 {
			require.Fail(t, "Found %d features with value 'false', expected all to be deleted", val)
		}
		//
		// make sure features with value "true" remain saved
		if err := ss.Preference().(*SqlPreferenceStore).GetReplica().Get(&val, `SELECT COUNT(*)
                            FROM Preferences
                    WHERE Category = ?
                    AND Value = ?
                    AND Name LIKE '`+store.FeatureTogglePrefix+`%'`, model.PreferenceCategoryAdvancedSettings, "true"); err != nil {
			require.NoError(t, err)
		} else if val == 0 {
			require.Fail(t, "Found %d features with value 'true', expected to find at least %d features", val, 2)
		}
	})
}
