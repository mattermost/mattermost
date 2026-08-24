// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"strconv"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func TestPreferenceStore(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	t.Run("PreferenceSave", func(t *testing.T) { testPreferenceSave(t, rctx, ss) })
	t.Run("PreferenceGet", func(t *testing.T) { testPreferenceGet(t, rctx, ss) })
	t.Run("PreferenceGetCategory", func(t *testing.T) { testPreferenceGetCategory(t, rctx, ss) })
	t.Run("PreferenceGetCategoryAndName", func(t *testing.T) { testPreferenceGetCategoryAndName(t, rctx, ss) })
	t.Run("PreferenceGetAll", func(t *testing.T) { testPreferenceGetAll(t, rctx, ss) })
	t.Run("PreferenceDeleteByUser", func(t *testing.T) { testPreferenceDeleteByUser(t, rctx, ss) })
	t.Run("PreferenceDelete", func(t *testing.T) { testPreferenceDelete(t, rctx, ss) })
	t.Run("PreferenceDeleteCategory", func(t *testing.T) { testPreferenceDeleteCategory(t, rctx, ss) })
	t.Run("PreferenceDeleteCategoryAndName", func(t *testing.T) { testPreferenceDeleteCategoryAndName(t, rctx, ss) })
	t.Run("PreferenceDeleteOrphanedRows", func(t *testing.T) { testPreferenceDeleteOrphanedRows(t, rctx, ss) })
	t.Run("PreferenceCleanupFlagsBatch", func(t *testing.T) { testPreferenceCleanupFlagsBatch(t, rctx, ss) })
	t.Run("PreferenceDeleteInvalidVisibleDmsGms", func(t *testing.T) { testDeleteInvalidVisibleDmsGms(t, rctx, ss, s) })
	t.Run("PreferenceDeletePreferencesRecordsTombstones", func(t *testing.T) { testPreferenceDeletePreferencesRecordsTombstones(t, ss) })
	t.Run("PreferenceGetDeletedSince", func(t *testing.T) { testPreferenceGetDeletedSince(t, ss) })
	t.Run("PreferenceSaveClearsTombstones", func(t *testing.T) { testPreferenceSaveClearsTombstones(t, ss) })
	t.Run("PreferenceDeletePreferenceDeletionsBefore", func(t *testing.T) { testPreferenceDeletePreferenceDeletionsBefore(t, ss, s) })
	t.Run("PreferenceDeletePreferenceDeletionsBeforeRespectsLimit", func(t *testing.T) { testPreferenceDeletePreferenceDeletionsBeforeRespectsLimit(t, ss, s) })
	t.Run("PreferenceDeletePreferencesWithDuplicateKeys", func(t *testing.T) { testPreferenceDeletePreferencesWithDuplicateKeys(t, ss) })
}

func testPreferenceSave(t *testing.T, _ request.CTX, ss store.Store) {
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

func testPreferenceGet(t *testing.T, _ request.CTX, ss store.Store) {
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

func testPreferenceGetCategoryAndName(t *testing.T, _ request.CTX, ss store.Store) {
	userId := model.NewId()
	category := model.PreferenceCategoryGroupChannelShow
	name := model.NewId()

	preferences := model.Preferences{
		{
			UserId:   userId,
			Category: category,
			Name:     name,
			Value:    "user1",
		},
		// same category/name, different user
		{
			UserId:   model.NewId(),
			Category: category,
			Name:     name,
			Value:    "otherUser",
		},
		// same user/name, different category
		{
			UserId:   userId,
			Category: model.NewId(),
			Name:     name,
			Value:    "",
		},
		// same user/category, different name
		{
			UserId:   userId,
			Category: category,
			Name:     model.NewId(),
			Value:    "",
		},
	}

	err := ss.Preference().Save(preferences)
	require.NoError(t, err)

	actualPreferences, err := ss.Preference().GetCategoryAndName(category, name)
	require.NoError(t, err)
	assert.Equal(t, 2, len(actualPreferences), "got the wrong number of preferences")

	for _, preference := range preferences {
		// Preferences with empty values aren't expected.
		if preference.Value == "" {
			continue
		}

		found := false
		for _, actualPreference := range actualPreferences {
			if actualPreference == preference {
				found = true
			}
		}

		assert.True(t, found, "didnt find preference with value %s", preference.Value)
	}

	// make sure getting a missing preference category and name doesn't fail
	actualPreferences, err = ss.Preference().GetCategoryAndName(model.NewId(), model.NewId())
	require.NoError(t, err)
	require.Equal(t, 0, len(actualPreferences), "shouldn't have got any preferences")
}

func testPreferenceGetCategory(t *testing.T, _ request.CTX, ss store.Store) {
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

func testPreferenceGetAll(t *testing.T, _ request.CTX, ss store.Store) {
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

	for i := range 3 {
		assert.Falsef(t, result[0] != preferences[i] && result[1] != preferences[i] && result[2] != preferences[i], "got incorrect preferences")
	}
}

func testPreferenceDeleteByUser(t *testing.T, _ request.CTX, ss store.Store) {
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

func testPreferenceDelete(t *testing.T, _ request.CTX, ss store.Store) {
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

func testPreferenceDeleteCategory(t *testing.T, _ request.CTX, ss store.Store) {
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

func testPreferenceDeleteCategoryAndName(t *testing.T, _ request.CTX, ss store.Store) {
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

func testPreferenceDeleteOrphanedRows(t *testing.T, rctx request.CTX, ss store.Store) {
	const limit = 1000
	team, err := ss.Team().Save(&model.Team{
		DisplayName: "DisplayName",
		Name:        "team" + model.NewId(),
		Email:       MakeEmail(),
		Type:        model.TeamOpen,
	})
	require.NoError(t, err)
	channel, err := ss.Channel().Save(rctx, &model.Channel{
		TeamId:      team.Id,
		DisplayName: "DisplayName",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)
	category := model.PreferenceCategoryFlaggedPost
	userId := model.NewId()

	olderPost, err := ss.Post().Save(rctx, &model.Post{
		ChannelId: channel.Id,
		UserId:    userId,
		Message:   "message",
		CreateAt:  1000,
	})
	require.NoError(t, err)
	newerPost, err := ss.Post().Save(rctx, &model.Post{
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

	_, _, nErr = ss.Post().PermanentDeleteBatchForRetentionPolicies(model.RetentionPolicyBatchConfigs{
		Now:                 0,
		GlobalPolicyEndTime: 2000,
		Limit:               limit,
	}, model.RetentionPolicyCursor{})
	assert.NoError(t, nErr)

	rows, err := ss.RetentionPolicy().GetIdsForDeletionByTableName("Posts", 1000)
	require.NoError(t, err)
	require.Equal(t, 1, len(rows))

	// Clean up retention ids table
	deleted, err := ss.Reaction().DeleteOrphanedRowsByIds(rows[0])
	require.NoError(t, err)
	require.Equal(t, int64(0), deleted)

	_, nErr = ss.Preference().DeleteOrphanedRows(limit)
	assert.NoError(t, nErr)

	_, nErr = ss.Preference().Get(userId, category, preference1.Name)
	assert.Error(t, nErr, "older preference should have been deleted")

	_, nErr = ss.Preference().Get(userId, category, preference2.Name)
	assert.NoError(t, nErr, "newer preference should not have been deleted")
}

func testPreferenceCleanupFlagsBatch(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("Normal cleanup case", func(t *testing.T) {
		const limit = 100
		team, err := ss.Team().Save(&model.Team{
			DisplayName: "DisplayName",
			Name:        "team" + model.NewId(),
			Email:       MakeEmail(),
			Type:        model.TeamOpen,
		})
		require.NoError(t, err)
		channel, err := ss.Channel().Save(rctx, &model.Channel{
			TeamId:      team.Id,
			DisplayName: "DisplayName",
			Name:        "channel" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, err)
		category := model.PreferenceCategoryFlaggedPost
		userId := model.NewId()

		// Create two posts: one to delete, one to keep
		olderPost, err := ss.Post().Save(rctx, &model.Post{
			ChannelId: channel.Id,
			UserId:    userId,
			Message:   "message",
			CreateAt:  1000,
		})
		require.NoError(t, err)
		newerPost, err := ss.Post().Save(rctx, &model.Post{
			ChannelId: channel.Id,
			UserId:    userId,
			Message:   "message",
			CreateAt:  3000,
		})
		require.NoError(t, err)

		// Create a third post ID that doesn't exist in the Posts table
		nonExistentPostId := model.NewId()

		// Create preferences flagging all three posts
		preferences := model.Preferences{
			{
				UserId:   userId,
				Category: category,
				Name:     olderPost.Id,
				Value:    "true",
			},
			{
				UserId:   userId,
				Category: category,
				Name:     newerPost.Id,
				Value:    "true",
			},
			{
				UserId:   userId,
				Category: category,
				Name:     nonExistentPostId,
				Value:    "true",
			},
		}

		err = ss.Preference().Save(preferences)
		require.NoError(t, err)

		// Instead of just deleting (soft delete), we'll permanently delete the post
		// to create a truly orphaned preference
		err = ss.Post().PermanentDelete(rctx, olderPost.Id)
		require.NoError(t, err)

		// Verify we have 3 preferences before cleanup
		prefs, err := ss.Preference().GetCategory(userId, category)
		require.NoError(t, err)
		require.Equal(t, 3, len(prefs))

		// Run CleanupFlagsBatch to remove orphaned preferences
		rowsDeleted, err := ss.Preference().CleanupFlagsBatch(limit)
		require.NoError(t, err)
		require.Equal(t, int64(2), rowsDeleted, "should have deleted 2 preferences (one with permanently deleted post and one with non-existent post)")

		// Check that only the preference for the existing post remains
		prefs, err = ss.Preference().GetCategory(userId, category)
		require.NoError(t, err)
		require.Equal(t, 1, len(prefs), "should only have 1 preference left")
		require.Equal(t, newerPost.Id, prefs[0].Name, "remaining preference should be for the undeleted post")
	})

	t.Run("Invalid limit case", func(t *testing.T) {
		// Test with a negative limit which should return an error
		rowsDeleted, err := ss.Preference().CleanupFlagsBatch(-1)
		require.Error(t, err, "Expected error for negative limit")
		require.Equal(t, int64(0), rowsDeleted, "Should not delete any rows when limit is negative")
		require.Contains(t, err.Error(), "negative limit", "Error message should mention negative limit")
	})
}

func testDeleteInvalidVisibleDmsGms(t *testing.T, _ request.CTX, ss store.Store, s SqlStore) {
	userId1 := model.NewId()
	userId2 := model.NewId()
	userId3 := model.NewId()
	userId4 := model.NewId()
	category := model.PreferenceCategorySidebarSettings
	name := model.PreferenceLimitVisibleDmsGms

	preferences := model.Preferences{
		{
			UserId:   userId1,
			Category: category,
			Name:     name,
			Value:    "10000",
		},
		{
			UserId:   userId2,
			Category: category,
			Name:     name,
			Value:    "40",
		},
		{
			UserId:   userId3,
			Category: category,
			Name:     name,
			Value:    "invalid",
		},
		{
			UserId:   model.NewId(),
			Category: category,
			Name:     name,
			Value:    "-10",
		},
		{
			UserId:   model.NewId(),
			Category: category,
			Name:     name,
			Value:    "0",
		},
		{
			UserId:   model.NewId(),
			Category: category,
			Name:     name,
			Value:    "00000",
		},
		{
			UserId:   userId4,
			Category: category,
			Name:     name,
			Value:    "20",
		},
	}

	// Can't insert with Save methods because the values are invalid
	_, execerr := s.GetMaster().NamedExec(`
		INSERT INTO
		    Preferences(UserId, Category, Name, Value)
		VALUES
		    (:UserId, :Category, :Name, :Value);
	`, preferences)
	require.NoError(t, execerr)

	count, err := ss.Preference().DeleteInvalidVisibleDmsGms()
	require.NoError(t, err)
	assert.Equal(t, int64(5), count)

	preference, err := ss.Preference().Get(userId2, category, name)
	require.NoError(t, err)
	require.Equal(t, &preferences[1], preference)

	preference, err = ss.Preference().Get(userId4, category, name)
	require.NoError(t, err)
	require.Equal(t, &preferences[6], preference)
}

func testPreferenceDeletePreferencesRecordsTombstones(t *testing.T, ss store.Store) {
	userID := model.NewId()
	prefs := model.Preferences{
		{UserId: userID, Category: "test_tombstone", Name: "key1", Value: "v"},
		{UserId: userID, Category: "test_tombstone", Name: "key2", Value: "v"},
	}

	require.NoError(t, ss.Preference().Save(prefs))

	before := model.GetMillis()
	require.NoError(t, ss.Preference().DeletePreferences(prefs))

	tombstones, err := ss.Preference().GetDeletedSince(userID, before-1)
	require.NoError(t, err)
	require.Len(t, tombstones, 2)

	names := make([]string, 0, len(tombstones))
	for _, ts := range tombstones {
		names = append(names, ts.Name)
		assert.Equal(t, userID, ts.UserId)
		assert.Equal(t, "test_tombstone", ts.Category)
		assert.GreaterOrEqual(t, ts.DeleteAt, before)
	}
	assert.ElementsMatch(t, []string{"key1", "key2"}, names)

	// The underlying preferences should also be gone.
	remaining, err := ss.Preference().GetCategory(userID, "test_tombstone")
	require.NoError(t, err)
	assert.Empty(t, remaining)
}

// Reproduces a Postgres duplicate-key failure in recordDeletionsTx: passing the same
// (UserId, Category, Name) twice in one DeletePreferences call used to build a multi-row
// INSERT ... ON CONFLICT DO UPDATE with a repeated conflict key, which Postgres rejects
// ("ON CONFLICT DO UPDATE command cannot affect row a second time").
func testPreferenceDeletePreferencesWithDuplicateKeys(t *testing.T, ss store.Store) {
	userID := model.NewId()
	pref := model.Preference{UserId: userID, Category: "test_tombstone", Name: "dup_key", Value: "v"}

	require.NoError(t, ss.Preference().Save(model.Preferences{pref}))

	before := model.GetMillis()
	require.NoError(t, ss.Preference().DeletePreferences(model.Preferences{pref, pref}))

	tombstones, err := ss.Preference().GetDeletedSince(userID, before-1)
	require.NoError(t, err)
	require.Len(t, tombstones, 1, "duplicate keys in the same batch should collapse to a single tombstone")
	assert.Equal(t, "dup_key", tombstones[0].Name)
}

func testPreferenceGetDeletedSince(t *testing.T, ss store.Store) {
	userID := model.NewId()
	prefs := model.Preferences{
		{UserId: userID, Category: "test_tombstone", Name: "a", Value: "v"},
		{UserId: userID, Category: "test_tombstone", Name: "b", Value: "v"},
	}
	require.NoError(t, ss.Preference().Save(prefs))

	before := model.GetMillis()
	require.NoError(t, ss.Preference().DeletePreferences(prefs))

	// Should return tombstones deleted after before-1
	tombstones, err := ss.Preference().GetDeletedSince(userID, before-1)
	require.NoError(t, err)
	require.Len(t, tombstones, 2, "should return both tombstones deleted after cursor")

	// Nothing deleted before the preference was created
	tombstonesNone, err := ss.Preference().GetDeletedSince(userID, model.GetMillis()+1000)
	require.NoError(t, err)
	assert.Empty(t, tombstonesNone, "should return no tombstones when cursor is in the future")

	// Different user returns empty
	tombstonesOther, err := ss.Preference().GetDeletedSince(model.NewId(), before-1)
	require.NoError(t, err)
	assert.Empty(t, tombstonesOther, "should not return tombstones for a different user")
}

func testPreferenceSaveClearsTombstones(t *testing.T, ss store.Store) {
	userID := model.NewId()
	pref := model.Preference{UserId: userID, Category: "test_tombstone", Name: "revive_key", Value: "v1"}

	// Save, delete (recording a tombstone), then re-save — tombstone must be cleared.
	require.NoError(t, ss.Preference().Save(model.Preferences{pref}))

	before := model.GetMillis()
	require.NoError(t, ss.Preference().DeletePreferences(model.Preferences{pref}))

	// Confirm tombstone exists
	tombstones, err := ss.Preference().GetDeletedSince(userID, before-1)
	require.NoError(t, err)
	require.Len(t, tombstones, 1, "tombstone should exist before re-save")

	// Re-save the preference — should atomically remove the tombstone
	pref.Value = "v2"
	require.NoError(t, ss.Preference().Save(model.Preferences{pref}))

	tombstonesAfter, err := ss.Preference().GetDeletedSince(userID, before-1)
	require.NoError(t, err)
	assert.Empty(t, tombstonesAfter, "tombstone should be cleared after re-saving the preference")
}

func testPreferenceDeletePreferenceDeletionsBefore(t *testing.T, ss store.Store, s SqlStore) {
	userID := model.NewId()
	// DeletePreferenceDeletionsBefore has no UserId filter (it's a global
	// retention sweep), so cutoff must sit far in the past to avoid also
	// matching other tests' tombstones, which are stamped near "now".
	cutoff := int64(1000000)

	tombstones := []model.PreferenceTombstone{
		{UserId: userID, Category: "test_tombstone", Name: "expired", DeleteAt: cutoff - 1000},
		{UserId: userID, Category: "test_tombstone", Name: "at_cutoff", DeleteAt: cutoff},
		{UserId: userID, Category: "test_tombstone", Name: "still_fresh", DeleteAt: cutoff + 1000},
	}

	_, execErr := s.GetMaster().NamedExec(`
		INSERT INTO
		    PreferenceDeletions(UserId, Category, Name, DeleteAt)
		VALUES
		    (:UserId, :Category, :Name, :DeleteAt);
	`, tombstones)
	require.NoError(t, execErr)

	deleted, err := ss.Preference().DeletePreferenceDeletionsBefore(cutoff, 1000)
	require.NoError(t, err)
	assert.Equal(t, int64(1), deleted)

	remaining, err := ss.Preference().GetDeletedSince(userID, 0)
	require.NoError(t, err)

	names := make([]string, 0, len(remaining))
	for _, ts := range remaining {
		names = append(names, ts.Name)
	}
	assert.ElementsMatch(t, []string{"at_cutoff", "still_fresh"}, names, "only tombstones strictly older than the cutoff should be removed")
}

func testPreferenceDeletePreferenceDeletionsBeforeRespectsLimit(t *testing.T, ss store.Store, s SqlStore) {
	userID := model.NewId()
	// See comment in testPreferenceDeletePreferenceDeletionsBefore: cutoff must
	// stay far in the past since the delete has no UserId filter.
	cutoff := int64(1000000)

	tombstones := make([]model.PreferenceTombstone, 0, 5)
	for i := range 5 {
		tombstones = append(tombstones, model.PreferenceTombstone{
			UserId:   userID,
			Category: "test_tombstone",
			Name:     "expired_" + strconv.Itoa(i),
			DeleteAt: cutoff - 1000,
		})
	}

	_, execErr := s.GetMaster().NamedExec(`
		INSERT INTO
		    PreferenceDeletions(UserId, Category, Name, DeleteAt)
		VALUES
		    (:UserId, :Category, :Name, :DeleteAt);
	`, tombstones)
	require.NoError(t, execErr)

	deleted, err := ss.Preference().DeletePreferenceDeletionsBefore(cutoff, 2)
	require.NoError(t, err)
	assert.Equal(t, int64(2), deleted, "a single call must not delete more than the given limit")

	remaining, err := ss.Preference().GetDeletedSince(userID, 0)
	require.NoError(t, err)
	assert.Len(t, remaining, 3, "rows beyond the limit must survive a single call")
}
