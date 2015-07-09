// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"github.com/mattermost/platform/model"
	"testing"
)

func TestAppStoreSave(t *testing.T) {
	Setup()

	a1 := model.App{}
	a1.CreatorId = model.NewId()
	a1.Name = "TestApp" + model.NewId()
	a1.CallbackUrl = "https://nowhere.com"
	a1.Homepage = "https://nowhere.com"

	if err := (<-store.App().Save(&a1)).Err; err != nil {
		t.Fatal(err)
	}
}

func TestAppStoreGet(t *testing.T) {
	Setup()

	a1 := model.App{}
	a1.CreatorId = model.NewId()
	a1.Name = "TestApp" + model.NewId()
	a1.CallbackUrl = "https://nowhere.com"
	a1.Homepage = "https://nowhere.com"
	Must(store.App().Save(&a1))

	if err := (<-store.App().Get(a1.Id)).Err; err != nil {
		t.Fatal(err)
	}
}

func TestAppStoreUpdate(t *testing.T) {
	Setup()

	a1 := model.App{}
	a1.CreatorId = model.NewId()
	a1.Name = "TestApp" + model.NewId()
	a1.CallbackUrl = "https://nowhere.com"
	a1.Homepage = "https://nowhere.com"
	Must(store.App().Save(&a1))

	a1.CreateAt = 1
	a1.ClientSecret = "pwd"
	a1.CreatorId = "12345678901234567890123456"
	a1.Name = "NewName"
	if result := <-store.App().Update(&a1); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		ua1 := (result.Data.([2]*model.App)[0])
		if ua1.Name != "NewName" {
			t.Fatal("name did not update")
		}
		if ua1.CreateAt == 1 {
			t.Fatal("create at should not have updated")
		}
		if ua1.ClientSecret == "pwd" {
			t.Fatal("client secret should not have updated")
		}
		if ua1.CreatorId == "12345678901234567890123456" {
			t.Fatal("creator id should not have updated")
		}
	}
}
