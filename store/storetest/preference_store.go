// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package storetest

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
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
	t.Run("PreferenceCleanupFlagsBatch", func(t *testing.T) { testPreferenceCleanupFlagsBatch(t, ss) })
}

func testPreferenceSave(t *testing.T, ss store.Store) {
	id := model.NewId()

	preferences := model.Preferences{
		{
			UserId:   id,
			Category: model.PREFERENCE_CATEGORY_DIRECT_CHANNEL_SHOW,
			Name:     model.NewId(),
			Value:    "value1a",
		},
		{
			UserId:   id,
			Category: model.PREFERENCE_CATEGORY_DIRECT_CHANNEL_SHOW,
			Name:     model.NewId(),
			Value:    "value1b",
		},
	}
	if err := ss.Preference().Save(&preferences); err != nil {
		t.Fatal("saving preference returned error")
	}

	for _, preference := range preferences {
		if data, _ := ss.Preference().Get(preference.UserId, preference.Category, preference.Name); preference.ToJson() != data.ToJson() {
			t.Fatal("got incorrect preference after first Save")
		}
	}

	preferences[0].Value = "value2a"
	preferences[1].Value = "value2b"
	if err := ss.Preference().Save(&preferences); err != nil {
		t.Fatal("saving preference returned error")
	}

	for _, preference := range preferences {
		if data, _ := ss.Preference().Get(preference.UserId, preference.Category, preference.Name); preference.ToJson() != data.ToJson() {
			t.Fatal("got incorrect preference after second Save")
		}
	}
}

func testPreferenceGet(t *testing.T, ss store.Store) {
	userId := model.NewId()
	category := model.PREFERENCE_CATEGORY_DIRECT_CHANNEL_SHOW
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

	err := ss.Preference().Save(&preferences)
	require.Nil(t, err)

	if data, err := ss.Preference().Get(userId, category, name); err != nil {
		t.Fatal(err)
	} else if data.ToJson() != preferences[0].ToJson() {
		t.Fatal("got incorrect preference")
	}

	// make sure getting a missing preference fails
	if _, err := ss.Preference().Get(model.NewId(), model.NewId(), model.NewId()); err == nil {
		t.Fatal("no error on getting a missing preference")
	}
}

func testPreferenceGetCategory(t *testing.T, ss store.Store) {
	userId := model.NewId()
	category := model.PREFERENCE_CATEGORY_DIRECT_CHANNEL_SHOW
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

	err := ss.Preference().Save(&preferences)
	require.Nil(t, err)

	if preferencesByCategory, err := ss.Preference().GetCategory(userId, category); err != nil {
		t.Fatal(err)
	} else if len(preferencesByCategory) != 2 {
		t.Fatal("got the wrong number of preferences")
	} else if !((preferencesByCategory[0] == preferences[0] && preferencesByCategory[1] == preferences[1]) || (preferencesByCategory[0] == preferences[1] && preferencesByCategory[1] == preferences[0])) {
		t.Fatal("got incorrect preferences")
	}

	// make sure getting a missing preference category doesn't fail
	if preferencesByCategory, err := ss.Preference().GetCategory(model.NewId(), model.NewId()); err != nil {
		t.Fatal(err)
	} else if len(preferencesByCategory) != 0 {
		t.Fatal("shouldn't have got any preferences")
	}
}

func testPreferenceGetAll(t *testing.T, ss store.Store) {
	userId := model.NewId()
	category := model.PREFERENCE_CATEGORY_DIRECT_CHANNEL_SHOW
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

	err := ss.Preference().Save(&preferences)
	require.Nil(t, err)

	if result, err := ss.Preference().GetAll(userId); err != nil {
		t.Fatal(err)
	} else if len(result) != 3 {
		t.Fatal("got the wrong number of preferences")
	} else {
		for i := 0; i < 3; i++ {
			if result[0] != preferences[i] && result[1] != preferences[i] && result[2] != preferences[i] {
				t.Fatal("got incorrect preferences")
			}
		}
	}
}

func testPreferenceDeleteByUser(t *testing.T, ss store.Store) {
	userId := model.NewId()
	category := model.PREFERENCE_CATEGORY_DIRECT_CHANNEL_SHOW
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

	err := ss.Preference().Save(&preferences)
	require.Nil(t, err)

	if err := ss.Preference().PermanentDeleteByUser(userId); err != nil {
		t.Fatal(err)
	}
}

func testPreferenceDelete(t *testing.T, ss store.Store) {
	preference := model.Preference{
		UserId:   model.NewId(),
		Category: model.PREFERENCE_CATEGORY_DIRECT_CHANNEL_SHOW,
		Name:     model.NewId(),
		Value:    "value1a",
	}

	err := ss.Preference().Save(&model.Preferences{preference})
	require.Nil(t, err)

	preferences, err := ss.Preference().GetAll(preference.UserId)
	require.Nil(t, err)
	assert.Len(t, preferences, 1, "should've returned 1 preference")

	if err = ss.Preference().Delete(preference.UserId, preference.Category, preference.Name); err != nil {
		t.Fatal(err)
	}
	preferences, err = ss.Preference().GetAll(preference.UserId)
	require.Nil(t, err)
	assert.Len(t, preferences, 0, "should've returned no preferences")

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

	err := ss.Preference().Save(&model.Preferences{preference1, preference2})
	require.Nil(t, err)

	preferences, err := ss.Preference().GetAll(userId)
	require.Nil(t, err)
	assert.Len(t, preferences, 2, "should've returned 2 preferences")

	if err = ss.Preference().DeleteCategory(userId, category); err != nil {
		t.Fatal(err)
	}

	preferences, err = ss.Preference().GetAll(userId)
	require.Nil(t, err)
	assert.Len(t, preferences, 0, "should've returned no preferences")
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

	err := ss.Preference().Save(&model.Preferences{preference1, preference2})
	require.Nil(t, err)

	preferences, err := ss.Preference().GetAll(userId)
	require.Nil(t, err)
	assert.Len(t, preferences, 1, "should've returned 1 preference")

	preferences, err = ss.Preference().GetAll(userId2)
	require.Nil(t, err)
	assert.Len(t, preferences, 1, "should've returned 1 preference")

	if err = ss.Preference().DeleteCategoryAndName(category, name); err != nil {
		t.Fatal(err)
	}

	preferences, err = ss.Preference().GetAll(userId)
	require.Nil(t, err)
	assert.Len(t, preferences, 0, "should've returned no preference")

	preferences, err = ss.Preference().GetAll(userId2)
	require.Nil(t, err)
	assert.Len(t, preferences, 0, "should've returned no preference")
}

func testPreferenceCleanupFlagsBatch(t *testing.T, ss store.Store) {
	category := model.PREFERENCE_CATEGORY_FLAGGED_POST
	userId := model.NewId()

	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = userId
	o1.Message = "zz" + model.NewId() + "AAAAAAAAAAA"
	o1.CreateAt = 1000
	o1, err := ss.Post().Save(o1)
	require.Nil(t, err)

	preference1 := model.Preference{
		UserId:   userId,
		Category: category,
		Name:     o1.Id,
		Value:    "true",
	}

	preference2 := model.Preference{
		UserId:   userId,
		Category: category,
		Name:     model.NewId(),
		Value:    "true",
	}

	err = ss.Preference().Save(&model.Preferences{preference1, preference2})
	require.Nil(t, err)

	_, err = ss.Preference().CleanupFlagsBatch(10000)
	assert.Nil(t, err)

	_, err = ss.Preference().Get(userId, category, preference1.Name)
	assert.Nil(t, err)

	_, err = ss.Preference().Get(userId, category, preference2.Name)
	assert.NotNil(t, err)
}
