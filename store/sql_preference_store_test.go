// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"github.com/mattermost/platform/model"
	"testing"
)

func TestPreferenceSave(t *testing.T) {
	Setup()

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
	if count := Must(store.Preference().Save(&preferences)); count != 2 {
		t.Fatal("got incorrect number of rows saved")
	}

	for _, preference := range preferences {
		if data := Must(store.Preference().Get(preference.UserId, preference.Category, preference.Name)).(model.Preference); preference != data {
			t.Fatal("got incorrect preference after first Save")
		}
	}

	preferences[0].Value = "value2a"
	preferences[1].Value = "value2b"
	if count := Must(store.Preference().Save(&preferences)); count != 2 {
		t.Fatal("got incorrect number of rows saved")
	}

	for _, preference := range preferences {
		if data := Must(store.Preference().Get(preference.UserId, preference.Category, preference.Name)).(model.Preference); preference != data {
			t.Fatal("got incorrect preference after second Save")
		}
	}
}

func TestPreferenceGet(t *testing.T) {
	Setup()

	userId := model.NewId()
	category := model.PREFERENCE_CATEGORY_DIRECT_CHANNEL_SHOW
	name := model.PREFERENCE_NAME_TEST

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
			Category: model.PREFERENCE_CATEGORY_TEST,
			Name:     name,
		},
		{
			UserId:   model.NewId(),
			Category: category,
			Name:     name,
		},
	}

	Must(store.Preference().Save(&preferences))

	if result := <-store.Preference().Get(userId, category, name); result.Err != nil {
		t.Fatal(result.Err)
	} else if data := result.Data.(model.Preference); data != preferences[0] {
		t.Fatal("got incorrect preference")
	}
}

func TestPreferenceGetCategory(t *testing.T) {
	Setup()

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
			Category: model.PREFERENCE_CATEGORY_TEST,
			Name:     name,
		},
		// same name/category, different user
		{
			UserId:   model.NewId(),
			Category: category,
			Name:     name,
		},
	}

	Must(store.Preference().Save(&preferences))

	if result := <-store.Preference().GetCategory(userId, category); result.Err != nil {
		t.Fatal(result.Err)
	} else if data := result.Data.(model.Preferences); len(data) != 2 {
		t.Fatal("got the wrong number of preferences")
	} else if !((data[0] == preferences[0] && data[1] == preferences[1]) || (data[0] == preferences[1] && data[1] == preferences[0])) {
		t.Fatal("got incorrect preferences")
	}
}
