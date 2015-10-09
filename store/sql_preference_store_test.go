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
			Category: model.PREFERENCE_CATEGORY_DIRECT_CHANNELS,
			Name:     model.PREFERENCE_NAME_SHOW,
			Value:    "value1a",
		},
		{
			UserId:   id,
			Category: model.PREFERENCE_CATEGORY_DIRECT_CHANNELS,
			Name:     model.PREFERENCE_NAME_TEST,
			Value:    "value1b",
		},
	}
	if count := Must(store.Preference().Save(&preferences)); count != 2 {
		t.Fatal("got incorrect number of rows saved")
	}

	for _, preference := range preferences {
		if data := Must(store.Preference().GetByName(preference.UserId, preference.Category, preference.Name)).(model.Preferences); len(data) != 1 {
			t.Fatal("got incorrect number of preferences after first Save")
		} else if *preference != *data[0] {
			t.Fatal("got incorrect preference after first Save")
		}
	}

	preferences[0].Value = "value2a"
	preferences[1].Value = "value2b"
	if count := Must(store.Preference().Save(&preferences)); count != 2 {
		t.Fatal("got incorrect number of rows saved")
	}

	for _, preference := range preferences {
		if data := Must(store.Preference().GetByName(preference.UserId, preference.Category, preference.Name)).(model.Preferences); len(data) != 1 {
			t.Fatal("got incorrect number of preferences after second Save")
		} else if *preference != *data[0] {
			t.Fatal("got incorrect preference after second Save")
		}
	}
}

func TestPreferenceGetByName(t *testing.T) {
	Setup()

	userId := model.NewId()
	category := model.PREFERENCE_CATEGORY_DIRECT_CHANNELS
	name := model.PREFERENCE_NAME_SHOW
	altId := model.NewId()

	preferences := model.Preferences{
		{
			UserId:   userId,
			Category: category,
			Name:     name,
			AltId:    altId,
		},
		// same user/category/name, different alt id
		{
			UserId:   userId,
			Category: category,
			Name:     name,
			AltId:    model.NewId(),
		},
		// same user/category/alt id, different name
		{
			UserId:   userId,
			Category: category,
			Name:     model.PREFERENCE_NAME_TEST,
			AltId:    altId,
		},
		// same user/name/alt id, different category
		{
			UserId:   userId,
			Category: model.PREFERENCE_CATEGORY_TEST,
			Name:     name,
			AltId:    altId,
		},
		// same name/category/alt id, different user
		{
			UserId:   model.NewId(),
			Category: category,
			Name:     name,
			AltId:    altId,
		},
	}

	Must(store.Preference().Save(&preferences))

	if result := <-store.Preference().GetByName(userId, category, name); result.Err != nil {
		t.Fatal(result.Err)
	} else if data := result.Data.(model.Preferences); len(data) != 2 {
		t.Fatal("got the wrong number of preferences")
	} else if !((*data[0] == *preferences[0] && *data[1] == *preferences[1]) || (*data[0] == *preferences[1] && *data[1] == *preferences[0])) {
		t.Fatal("got incorrect preferences")
	}
}
