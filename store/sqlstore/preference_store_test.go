// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/model"
"github.com/mattermost/mattermost-server/store"
)

func TestPreferenceSave(t *testing.T) {
	ss := Setup()

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
	if count := store.Must(ss.Preference().Save(&preferences)); count != 2 {
		t.Fatal("got incorrect number of rows saved")
	}

	for _, preference := range preferences {
		if data := store.Must(ss.Preference().Get(preference.UserId, preference.Category, preference.Name)).(model.Preference); preference != data {
			t.Fatal("got incorrect preference after first Save")
		}
	}

	preferences[0].Value = "value2a"
	preferences[1].Value = "value2b"
	if count := store.Must(ss.Preference().Save(&preferences)); count != 2 {
		t.Fatal("got incorrect number of rows saved")
	}

	for _, preference := range preferences {
		if data := store.Must(ss.Preference().Get(preference.UserId, preference.Category, preference.Name)).(model.Preference); preference != data {
			t.Fatal("got incorrect preference after second Save")
		}
	}
}

func TestPreferenceGet(t *testing.T) {
	ss := Setup()

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

	store.Must(ss.Preference().Save(&preferences))

	if result := <-ss.Preference().Get(userId, category, name); result.Err != nil {
		t.Fatal(result.Err)
	} else if data := result.Data.(model.Preference); data != preferences[0] {
		t.Fatal("got incorrect preference")
	}

	// make sure getting a missing preference fails
	if result := <-ss.Preference().Get(model.NewId(), model.NewId(), model.NewId()); result.Err == nil {
		t.Fatal("no error on getting a missing preference")
	}
}

func TestPreferenceGetCategory(t *testing.T) {
	ss := Setup()

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

	store.Must(ss.Preference().Save(&preferences))

	if result := <-ss.Preference().GetCategory(userId, category); result.Err != nil {
		t.Fatal(result.Err)
	} else if data := result.Data.(model.Preferences); len(data) != 2 {
		t.Fatal("got the wrong number of preferences")
	} else if !((data[0] == preferences[0] && data[1] == preferences[1]) || (data[0] == preferences[1] && data[1] == preferences[0])) {
		t.Fatal("got incorrect preferences")
	}

	// make sure getting a missing preference category doesn't fail
	if result := <-ss.Preference().GetCategory(model.NewId(), model.NewId()); result.Err != nil {
		t.Fatal(result.Err)
	} else if data := result.Data.(model.Preferences); len(data) != 0 {
		t.Fatal("shouldn't have got any preferences")
	}
}

func TestPreferenceGetAll(t *testing.T) {
	ss := Setup()

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

	store.Must(ss.Preference().Save(&preferences))

	if result := <-ss.Preference().GetAll(userId); result.Err != nil {
		t.Fatal(result.Err)
	} else if data := result.Data.(model.Preferences); len(data) != 3 {
		t.Fatal("got the wrong number of preferences")
	} else {
		for i := 0; i < 3; i++ {
			if data[0] != preferences[i] && data[1] != preferences[i] && data[2] != preferences[i] {
				t.Fatal("got incorrect preferences")
			}
		}
	}
}

func TestPreferenceDeleteByUser(t *testing.T) {
	ss := Setup()

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

	store.Must(ss.Preference().Save(&preferences))

	if result := <-ss.Preference().PermanentDeleteByUser(userId); result.Err != nil {
		t.Fatal(result.Err)
	}
}

func TestIsFeatureEnabled(t *testing.T) {
	ss := Setup()

	feature1 := "testFeat1"
	feature2 := "testFeat2"
	feature3 := "testFeat3"

	userId := model.NewId()
	category := model.PREFERENCE_CATEGORY_ADVANCED_SETTINGS

	features := model.Preferences{
		{
			UserId:   userId,
			Category: category,
			Name:     FEATURE_TOGGLE_PREFIX + feature1,
			Value:    "true",
		},
		{
			UserId:   userId,
			Category: category,
			Name:     model.NewId(),
			Value:    "false",
		},
		{
			UserId:   userId,
			Category: model.NewId(),
			Name:     FEATURE_TOGGLE_PREFIX + feature1,
			Value:    "false",
		},
		{
			UserId:   model.NewId(),
			Category: category,
			Name:     FEATURE_TOGGLE_PREFIX + feature2,
			Value:    "false",
		},
		{
			UserId:   model.NewId(),
			Category: category,
			Name:     FEATURE_TOGGLE_PREFIX + feature3,
			Value:    "foobar",
		},
	}

	store.Must(ss.Preference().Save(&features))

	if result := <-ss.Preference().IsFeatureEnabled(feature1, userId); result.Err != nil {
		t.Fatal(result.Err)
	} else if data := result.Data.(bool); data != true {
		t.Fatalf("got incorrect setting for feature1, %v=%v", true, data)
	}

	if result := <-ss.Preference().IsFeatureEnabled(feature2, userId); result.Err != nil {
		t.Fatal(result.Err)
	} else if data := result.Data.(bool); data != false {
		t.Fatalf("got incorrect setting for feature2, %v=%v", false, data)
	}

	// make sure we get false if something different than "true" or "false" has been saved to database
	if result := <-ss.Preference().IsFeatureEnabled(feature3, userId); result.Err != nil {
		t.Fatal(result.Err)
	} else if data := result.Data.(bool); data != false {
		t.Fatalf("got incorrect setting for feature3, %v=%v", false, data)
	}

	// make sure false is returned if a non-existent feature is queried
	if result := <-ss.Preference().IsFeatureEnabled("someOtherFeature", userId); result.Err != nil {
		t.Fatal(result.Err)
	} else if data := result.Data.(bool); data != false {
		t.Fatalf("got incorrect setting for non-existent feature 'someOtherFeature', %v=%v", false, data)
	}
}

func TestDeleteUnusedFeatures(t *testing.T) {
	ss := Setup()

	userId1 := model.NewId()
	userId2 := model.NewId()
	category := model.PREFERENCE_CATEGORY_ADVANCED_SETTINGS
	feature1 := "feature1"
	feature2 := "feature2"

	features := model.Preferences{
		{
			UserId:   userId1,
			Category: category,
			Name:     FEATURE_TOGGLE_PREFIX + feature1,
			Value:    "true",
		},
		{
			UserId:   userId2,
			Category: category,
			Name:     FEATURE_TOGGLE_PREFIX + feature1,
			Value:    "false",
		},
		{
			UserId:   userId1,
			Category: category,
			Name:     FEATURE_TOGGLE_PREFIX + feature2,
			Value:    "false",
		},
		{
			UserId:   userId2,
			Category: category,
			Name:     FEATURE_TOGGLE_PREFIX + feature2,
			Value:    "true",
		},
	}

	store.Must(ss.Preference().Save(&features))

	ss.Preference().(*SqlPreferenceStore).DeleteUnusedFeatures()

	//make sure features with value "false" have actually been deleted from the database
	if val, err := ss.Preference().(*SqlPreferenceStore).GetReplica().SelectInt(`SELECT COUNT(*)
			FROM Preferences
		WHERE Category = :Category
		AND Value = :Val
		AND Name LIKE '`+FEATURE_TOGGLE_PREFIX+`%'`, map[string]interface{}{"Category": model.PREFERENCE_CATEGORY_ADVANCED_SETTINGS, "Val": "false"}); err != nil {
		t.Fatal(err)
	} else if val != 0 {
		t.Fatalf("Found %d features with value 'false', expected all to be deleted", val)
	}
	//
	// make sure features with value "true" remain saved
	if val, err := ss.Preference().(*SqlPreferenceStore).GetReplica().SelectInt(`SELECT COUNT(*)
			FROM Preferences
		WHERE Category = :Category
		AND Value = :Val
		AND Name LIKE '`+FEATURE_TOGGLE_PREFIX+`%'`, map[string]interface{}{"Category": model.PREFERENCE_CATEGORY_ADVANCED_SETTINGS, "Val": "true"}); err != nil {
		t.Fatal(err)
	} else if val == 0 {
		t.Fatalf("Found %d features with value 'true', expected to find at least %d features", val, 2)
	}
}

func TestPreferenceDelete(t *testing.T) {
	ss := Setup()

	preference := model.Preference{
		UserId:   model.NewId(),
		Category: model.PREFERENCE_CATEGORY_DIRECT_CHANNEL_SHOW,
		Name:     model.NewId(),
		Value:    "value1a",
	}

	store.Must(ss.Preference().Save(&model.Preferences{preference}))

	if prefs := store.Must(ss.Preference().GetAll(preference.UserId)).(model.Preferences); len([]model.Preference(prefs)) != 1 {
		t.Fatal("should've returned 1 preference")
	}

	if result := <-ss.Preference().Delete(preference.UserId, preference.Category, preference.Name); result.Err != nil {
		t.Fatal(result.Err)
	}

	if prefs := store.Must(ss.Preference().GetAll(preference.UserId)).(model.Preferences); len([]model.Preference(prefs)) != 0 {
		t.Fatal("should've returned no preferences")
	}
}

func TestPreferenceDeleteCategory(t *testing.T) {
	ss := Setup()

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

	store.Must(ss.Preference().Save(&model.Preferences{preference1, preference2}))

	if prefs := store.Must(ss.Preference().GetAll(userId)).(model.Preferences); len([]model.Preference(prefs)) != 2 {
		t.Fatal("should've returned 2 preferences")
	}

	if result := <-ss.Preference().DeleteCategory(userId, category); result.Err != nil {
		t.Fatal(result.Err)
	}

	if prefs := store.Must(ss.Preference().GetAll(userId)).(model.Preferences); len([]model.Preference(prefs)) != 0 {
		t.Fatal("should've returned no preferences")
	}
}

func TestPreferenceDeleteCategoryAndName(t *testing.T) {
	ss := Setup()

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

	store.Must(ss.Preference().Save(&model.Preferences{preference1, preference2}))

	if prefs := store.Must(ss.Preference().GetAll(userId)).(model.Preferences); len([]model.Preference(prefs)) != 1 {
		t.Fatal("should've returned 1 preference")
	}

	if prefs := store.Must(ss.Preference().GetAll(userId2)).(model.Preferences); len([]model.Preference(prefs)) != 1 {
		t.Fatal("should've returned 1 preference")
	}

	if result := <-ss.Preference().DeleteCategoryAndName(category, name); result.Err != nil {
		t.Fatal(result.Err)
	}

	if prefs := store.Must(ss.Preference().GetAll(userId)).(model.Preferences); len([]model.Preference(prefs)) != 0 {
		t.Fatal("should've returned no preferences")
	}

	if prefs := store.Must(ss.Preference().GetAll(userId2)).(model.Preferences); len([]model.Preference(prefs)) != 0 {
		t.Fatal("should've returned no preferences")
	}
}

func TestPreferenceCleanupFlagsBatch(t *testing.T) {
	ss := Setup()

	category := model.PREFERENCE_CATEGORY_FLAGGED_POST
	userId := model.NewId()

	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = userId
	o1.Message = "zz" + model.NewId() + "AAAAAAAAAAA"
	o1.CreateAt = 1000
	o1 = (<-ss.Post().Save(o1)).Data.(*model.Post)

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

	store.Must(ss.Preference().Save(&model.Preferences{preference1, preference2}))

	result := <-ss.Preference().CleanupFlagsBatch(10000)
	assert.Nil(t, result.Err)

	result = <-ss.Preference().Get(userId, category, preference1.Name)
	assert.Nil(t, result.Err)

	result = <-ss.Preference().Get(userId, category, preference2.Name)
	assert.NotNil(t, result.Err)
}
