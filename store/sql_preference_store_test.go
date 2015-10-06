// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"github.com/mattermost/platform/model"
	"testing"
)

func TestPreferenceStoreSave(t *testing.T) {
	Setup()

	p1 := model.Preference{
		UserId:   model.NewId(),
		Category: model.PREFERENCE_CATEGORY_DIRECT_CHANNELS,
		Name:     model.PREFERENCE_NAME_SHOW,
		AltId:    model.NewId(),
	}

	if err := (<-store.Preference().Save(&p1)).Err; err != nil {
		t.Fatal("couldn't save preference", err)
	}

	if err := (<-store.Preference().Save(&p1)).Err; err == nil {
		t.Fatal("shouldn't be able to save duplicate preference")
	}

	p2 := model.Preference{
		UserId:   model.NewId(),
		Category: model.PREFERENCE_CATEGORY_DIRECT_CHANNELS,
		Name:     model.PREFERENCE_NAME_SHOW,
		AltId:    p1.AltId,
	}

	if err := (<-store.Preference().Save(&p2)).Err; err != nil {
		t.Fatal("couldn't save preference with duplicate category, name, alternate id", err)
	}

	p3 := model.Preference{
		UserId:   p1.UserId,
		Category: model.PREFERENCE_CATEGORY_TEST,
		Name:     model.PREFERENCE_NAME_SHOW,
		AltId:    p1.AltId,
	}

	if err := (<-store.Preference().Save(&p3)).Err; err != nil {
		t.Fatal("couldn't save preference with duplicate user id, name, alternate id", err)
	}

	p4 := model.Preference{
		UserId:   p1.UserId,
		Category: model.PREFERENCE_CATEGORY_DIRECT_CHANNELS,
		Name:     model.PREFERENCE_NAME_TEST,
		AltId:    p1.AltId,
	}

	if err := (<-store.Preference().Save(&p4)).Err; err != nil {
		t.Fatal("couldn't save preference with duplicate user id, category, alternate id", err)
	}

	p5 := model.Preference{
		UserId:   p1.UserId,
		Category: model.PREFERENCE_CATEGORY_DIRECT_CHANNELS,
		Name:     model.PREFERENCE_NAME_SHOW,
		AltId:    model.NewId(),
	}

	if err := (<-store.Preference().Save(&p5)).Err; err != nil {
		t.Fatal("couldn't save preference with duplicate user id, category, name", err)
	}
}

func TestPreferenceStoreUpdate(t *testing.T) {
	Setup()

	id := model.NewId()

	p1 := model.Preference{
		UserId:   id,
		Category: model.PREFERENCE_CATEGORY_DIRECT_CHANNELS,
		Name:     model.PREFERENCE_NAME_SHOW,
	}
	Must(store.Preference().Save(&p1))

	p1.Value = "1234garbage"
	if err := (<-store.Preference().Update(&p1)).Err; err != nil {
		t.Fatal(err)
	}

	p1.UserId = model.NewId()
	if err := (<-store.Preference().Update(&p1)).Err; err == nil {
		t.Fatal("update should have failed because of changed user id")
	}

	p1.UserId = id
	p1.Category = model.PREFERENCE_CATEGORY_TEST
	if err := (<-store.Preference().Update(&p1)).Err; err == nil {
		t.Fatal("update should have failed because of changed category")
	}

	p1.Category = model.PREFERENCE_CATEGORY_DIRECT_CHANNELS
	p1.Name = model.PREFERENCE_NAME_TEST
	if err := (<-store.Preference().Update(&p1)).Err; err == nil {
		t.Fatal("update should have failed because of changed name")
	}

	p1.Name = model.PREFERENCE_NAME_SHOW
	p1.AltId = model.NewId()
	if err := (<-store.Preference().Update(&p1)).Err; err == nil {
		t.Fatal("update should have failed because of changed alternate id")
	}
}

func TestPreferenceGetByName(t *testing.T) {
	Setup()

	p1 := model.Preference{
		UserId:   model.NewId(),
		Category: model.PREFERENCE_CATEGORY_DIRECT_CHANNELS,
		Name:     model.PREFERENCE_NAME_SHOW,
		AltId:    model.NewId(),
	}

	// same user/category/name, different alt id
	p2 := model.Preference{
		UserId:   p1.UserId,
		Category: p1.Category,
		Name:     p1.Name,
		AltId:    model.NewId(),
	}

	// same user/category/alt id, different name
	p3 := model.Preference{
		UserId:   p1.UserId,
		Category: p1.Category,
		Name:     model.PREFERENCE_NAME_TEST,
		AltId:    p1.AltId,
	}

	// same user/name/alt id, different category
	p4 := model.Preference{
		UserId:   p1.UserId,
		Category: model.PREFERENCE_CATEGORY_TEST,
		Name:     p1.Name,
		AltId:    p1.AltId,
	}

	// same name/category/alt id, different user
	p5 := model.Preference{
		UserId:   model.NewId(),
		Category: p1.Category,
		Name:     p1.Name,
		AltId:    p1.AltId,
	}

	Must(store.Preference().Save(&p1))
	Must(store.Preference().Save(&p2))
	Must(store.Preference().Save(&p3))
	Must(store.Preference().Save(&p4))
	Must(store.Preference().Save(&p5))

	if result := <-store.Preference().GetByName(p1.UserId, p1.Category, p1.Name); result.Err != nil {
		t.Fatal(result.Err)
	} else if data := result.Data.([]*model.Preference); len(data) != 2 {
		t.Fatal("got the wrong number of preferences")
	} else if !((*data[0] == p1 && *data[1] == p2) || (*data[0] == p2 && *data[1] == p1)) {
		t.Fatal("got incorrect preferences")
	}
}
