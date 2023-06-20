// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"
)

func TestPreferenceStore(t *testing.T) {
	StoreTest(t, storetest.TestPreferenceStore)
}

func TestDeleteUnusedFeatures(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
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
		if err := ss.Preference().(*SqlPreferenceStore).GetReplicaX().Get(&val, `SELECT COUNT(*)
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
		if err := ss.Preference().(*SqlPreferenceStore).GetReplicaX().Get(&val, `SELECT COUNT(*)
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
