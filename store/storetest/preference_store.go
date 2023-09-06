// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/store"
)

func TestPreferenceStore(t *testing.T, ss store.Store) {
	t.Run("PreferenceSave", func(t *testing.T) { testPreferenceSave(t, ss) })
	t.Run("PreferenceGet", func(t *testing.T) { testPreferenceGet(t, ss) })
	t.Run("PreferenceGetCategory", func(t *testing.T) { testPreferenceGetCategory(t, ss) })
	t.Run("PreferenceGetAll", func(t *testing.T) { testPreferenceGetAll(t, ss) })
	t.Run("PreferenceDeleteByUser", func(t *testing.T) { testPreferenceDeleteByUser(t, ss) })
	t.Run("PreferenceDelete", func(t *testing.T) { testPreferenceDelete(t, ss) })
	t.Run("PreferenceDeleteCategory", func(t *testing.T) { testPreferenceDeleteCategory(t, ss) })
	t.Run("PreferenceDeleteCategoryAndName", func(t *testing.T) { testPreferenceDeleteCategoryAndName(t, ss) })
	t.Run("PreferenceDeleteOrphanedRows", func(t *testing.T) { testPreferenceDeleteOrphanedRows(t, ss) })
}

func testPreferenceSave(t *testing.T, ss store.Store) {
	id := model.NewId()

	preferences := model.Preferences{
		{
			UserId:   id,
			Category: model.PreferenceCategoryDirectChannelShow,
			Name:     model.NewId(),
			Value:    "value1a",
		},
		{
			UserId:   id,
			Category: model.PreferenceCategoryDirectChannelShow,
			Name:     model.NewId(),
			Value:    "value1b",
		},
	}
	err := ss.Preference().Save(preferences)
	require.NoError(t, err, "saving preference returned error")

	for _, preference := range preferences {
		data, _ := ss.Preference().Get(preference.UserId, preference.Category, preference.Name)
		require.Equal(t, data, &preference, "got incorrect preference after first Save")
	}

	preferences[0].Value = "value2a"
	preferences[1].Value = "value2b"
	err = ss.Preference().Save(preferences)
	require.NoError(t, err, "saving preference returned error")

	for _, preference := range preferences {
		data, _ := ss.Preference().Get(preference.UserId, preference.Category, preference.Name)
		require.Equal(t, data, &preference, "got incorrect preference after second Save")
	}
}

func testPreferenceGet(t *testing.T, ss store.Store) {
	userId := model.NewId()
	category := model.PreferenceCategoryDirectChannelShow
	name := model.NewId()

	preferences := model.Preferences{
		{
			UserId:   userId,
			Category: category,
			Name:     name,
		},
		{
			UserId:   userId,
			Category: category,
			Name:     model.NewId(),
		},
		{
			UserId:   userId,
			Category: model.NewId(),
			Name:     name,
		},
		{
			UserId:   model.NewId(),
			Category: category,
			Name:     name,
		},
	}

	err := ss.Preference().Save(preferences)
	require.NoError(t, err)

	data, err := ss.Preference().Get(userId, category, name)
	require.NoError(t, err)
	require.Equal(t, &preferences[0], data, "got incorrect preference")

	// make sure getting a missing preference fails
	_, err = ss.Preference().Get(model.NewId(), model.NewId(), model.NewId())
	require.Error(t, err, "no error on getting a missing preference")
}

func testPreferenceGetCategory(t *testing.T, ss store.Store) {
	userId := model.NewId()
	category := model.PreferenceCategoryDirectChannelShow
	name := model.NewId()

	preferences := model.Preferences{
		{
			UserId:   userId,
			Category: category,
			Name:     name,
		},
		// same user/category, different name
		{
			UserId:   userId,
			Category: category,
			Name:     model.NewId(),
		},
		// same user/name, different category
		{
			UserId:   userId,
			Category: model.NewId(),
			Name:     name,
		},
		// same name/category, different user
		{
			UserId:   model.NewId(),
			Category: category,
			Name:     name,
		},
	}

	err := ss.Preference().Save(preferences)
	require.NoError(t, err)

	preferencesByCategory, err := ss.Preference().GetCategory(userId, category)
	require.NoError(t, err)
	require.Equal(t, 2, len(preferencesByCategory), "got the wrong number of preferences")
	require.True(
		t,
		((preferencesByCategory[0] == preferences[0] && preferencesByCategory[1] == preferences[1]) || (preferencesByCategory[0] == preferences[1] && preferencesByCategory[1] == preferences[0])),
		"got incorrect preferences",
	)

	// make sure getting a missing preference category doesn't fail
	preferencesByCategory, err = ss.Preference().GetCategory(model.NewId(), model.NewId())
	require.NoError(t, err)
	require.Equal(t, 0, len(preferencesByCategory), "shouldn't have got any preferences")
}

func testPreferenceGetAll(t *testing.T, ss store.Store) {
	userId := model.NewId()
	category := model.PreferenceCategoryDirectChannelShow
	name := model.NewId()

	preferences := model.Preferences{
		{
			UserId:   userId,
			Category: category,
			Name:     name,
		},
		// same user/category, different name
		{
			UserId:   userId,
			Category: category,
			Name:     model.NewId(),
		},
		// same user/name, different category
		{
			UserId:   userId,
			Category: model.NewId(),
			Name:     name,
		},
		// same name/category, different user
		{
			UserId:   model.NewId(),
			Category: category,
			Name:     name,
		},
	}

	err := ss.Preference().Save(preferences)
	require.NoError(t, err)

	result, err := ss.Preference().GetAll(userId)
	require.NoError(t, err)
	require.Equal(t, 3, len(result), "got the wrong number of preferences")

	for i := 0; i < 3; i++ {
		assert.Falsef(t, result[0] != preferences[i] && result[1] != preferences[i] && result[2] != preferences[i], "got incorrect preferences")
	}

}

func testPreferenceDeleteByUser(t *testing.T, ss store.Store) {
	userId := model.NewId()
	category := model.PreferenceCategoryDirectChannelShow
	name := model.NewId()

	preferences := model.Preferences{
		{
			UserId:   userId,
			Category: category,
			Name:     name,
		},
		// same user/category, different name
		{
			UserId:   userId,
			Category: category,
			Name:     model.NewId(),
		},
		// same user/name, different category
		{
			UserId:   userId,
			Category: model.NewId(),
			Name:     name,
		},
		// same name/category, different user
		{
			UserId:   model.NewId(),
			Category: category,
			Name:     name,
		},
	}

	err := ss.Preference().Save(preferences)
	require.NoError(t, err)

	err = ss.Preference().PermanentDeleteByUser(userId)
	require.NoError(t, err)
}

func testPreferenceDelete(t *testing.T, ss store.Store) {
	preference := model.Preference{
		UserId:   model.NewId(),
		Category: model.PreferenceCategoryDirectChannelShow,
		Name:     model.NewId(),
		Value:    "value1a",
	}

	err := ss.Preference().Save(model.Preferences{preference})
	require.NoError(t, err)

	preferences, err := ss.Preference().GetAll(preference.UserId)
	require.NoError(t, err)
	assert.Len(t, preferences, 1, "should've returned 1 preference")

	err = ss.Preference().Delete(preference.UserId, preference.Category, preference.Name)
	require.NoError(t, err)
	preferences, err = ss.Preference().GetAll(preference.UserId)
	require.NoError(t, err)
	assert.Empty(t, preferences, "should've returned no preferences")
}

func testPreferenceDeleteCategory(t *testing.T, ss store.Store) {
	category := model.NewId()
	userId := model.NewId()

	preference1 := model.Preference{
		UserId:   userId,
		Category: category,
		Name:     model.NewId(),
		Value:    "value1a",
	}

	preference2 := model.Preference{
		UserId:   userId,
		Category: category,
		Name:     model.NewId(),
		Value:    "value1a",
	}

	err := ss.Preference().Save(model.Preferences{preference1, preference2})
	require.NoError(t, err)

	preferences, err := ss.Preference().GetAll(userId)
	require.NoError(t, err)
	assert.Len(t, preferences, 2, "should've returned 2 preferences")

	err = ss.Preference().DeleteCategory(userId, category)
	require.NoError(t, err)

	preferences, err = ss.Preference().GetAll(userId)
	require.NoError(t, err)
	assert.Empty(t, preferences, "should've returned no preferences")
}

func testPreferenceDeleteCategoryAndName(t *testing.T, ss store.Store) {
	category := model.NewId()
	name := model.NewId()
	userId := model.NewId()
	userId2 := model.NewId()

	preference1 := model.Preference{
		UserId:   userId,
		Category: category,
		Name:     name,
		Value:    "value1a",
	}

	preference2 := model.Preference{
		UserId:   userId2,
		Category: category,
		Name:     name,
		Value:    "value1a",
	}

	err := ss.Preference().Save(model.Preferences{preference1, preference2})
	require.NoError(t, err)

	preferences, err := ss.Preference().GetAll(userId)
	require.NoError(t, err)
	assert.Len(t, preferences, 1, "should've returned 1 preference")

	preferences, err = ss.Preference().GetAll(userId2)
	require.NoError(t, err)
	assert.Len(t, preferences, 1, "should've returned 1 preference")

	err = ss.Preference().DeleteCategoryAndName(category, name)
	require.NoError(t, err)

	preferences, err = ss.Preference().GetAll(userId)
	require.NoError(t, err)
	assert.Empty(t, preferences, "should've returned no preference")

	preferences, err = ss.Preference().GetAll(userId2)
	require.NoError(t, err)
	assert.Empty(t, preferences, "should've returned no preference")
}

func testPreferenceDeleteOrphanedRows(t *testing.T, ss store.Store) {
	const limit = 1000
	team, err := ss.Team().Save(&model.Team{
		DisplayName: "DisplayName",
		Name:        "team" + model.NewId(),
		Email:       MakeEmail(),
		Type:        model.TeamOpen,
	})
	require.NoError(t, err)
	channel, err := ss.Channel().Save(&model.Channel{
		TeamId:      team.Id,
		DisplayName: "DisplayName",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)
	category := model.PreferenceCategoryFlaggedPost
	userId := model.NewId()

	olderPost, err := ss.Post().Save(&model.Post{
		ChannelId: channel.Id,
		UserId:    userId,
		Message:   "message",
		CreateAt:  1000,
	})
	require.NoError(t, err)
	newerPost, err := ss.Post().Save(&model.Post{
		ChannelId: channel.Id,
		UserId:    userId,
		Message:   "message",
		CreateAt:  3000,
	})
	require.NoError(t, err)

	preference1 := model.Preference{
		UserId:   userId,
		Category: category,
		Name:     olderPost.Id,
		Value:    "true",
	}

	preference2 := model.Preference{
		UserId:   userId,
		Category: category,
		Name:     newerPost.Id,
		Value:    "true",
	}

	nErr := ss.Preference().Save(model.Preferences{preference1, preference2})
	require.NoError(t, nErr)

	_, _, nErr = ss.Post().PermanentDeleteBatchForRetentionPolicies(0, 2000, limit, model.RetentionPolicyCursor{})
	assert.NoError(t, nErr)

	rows, err := ss.RetentionPolicy().GetIdsForDeletionByTableName("Posts", 1000)
	require.NoError(t, err)
	require.Equal(t, 1, len(rows))

	// Clean up retention ids table
	err = ss.Reaction().DeleteOrphanedRowsByIds(rows[0])
	require.NoError(t, err)

	_, nErr = ss.Preference().DeleteOrphanedRows(limit)
	assert.NoError(t, nErr)

	_, nErr = ss.Preference().Get(userId, category, preference1.Name)
	assert.Error(t, nErr, "older preference should have been deleted")

	_, nErr = ss.Preference().Get(userId, category, preference2.Name)
	assert.NoError(t, nErr, "newer preference should not have been deleted")
}
