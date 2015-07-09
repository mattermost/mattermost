// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"github.com/mattermost/platform/model"
	"testing"
)

func TestAuthStoreSave(t *testing.T) {
	Setup()

	a1 := model.AuthData{}
	a1.ClientId = model.NewId()
	a1.UserId = model.NewId()
	a1.Code = model.NewId()

	if err := (<-store.AuthData().Save(&a1)).Err; err != nil {
		t.Fatal(err)
	}
}

func TestAuthStoreGet(t *testing.T) {
	Setup()

	a1 := model.AuthData{}
	a1.ClientId = model.NewId()
	a1.UserId = model.NewId()
	a1.Code = model.NewId()
	Must(store.AuthData().Save(&a1))

	if err := (<-store.AuthData().Get(a1.Code)).Err; err != nil {
		t.Fatal(err)
	}
}

func TestAuthStoreRemove(t *testing.T) {
	Setup()

	a1 := model.AuthData{}
	a1.ClientId = model.NewId()
	a1.UserId = model.NewId()
	a1.Code = model.NewId()
	Must(store.AuthData().Save(&a1))

	if err := (<-store.AuthData().Remove(a1.Code)).Err; err != nil {
		t.Fatal(err)
	}

	if err := (<-store.AuthData().Get(a1.Code)).Err; err == nil {
		t.Fatal("should have errored - auth code removed")
	}
}
