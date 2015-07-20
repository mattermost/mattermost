// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	"testing"
)

func TestAccessStoreSave(t *testing.T) {
	Setup()

	a1 := model.AccessData{}
	a1.AuthCode = model.NewId()
	a1.UserId = model.NewId()
	a1.Token = model.NewId()
	a1.RefreshToken = model.NewId()

	if err := (<-store.AccessData().Save(&a1)).Err; err != nil {
		t.Fatal(err)
	}
}

func TestAccessStoreGet(t *testing.T) {
	Setup()

	a1 := model.AccessData{}
	a1.AuthCode = model.NewId()
	a1.UserId = model.NewId()
	token := model.NewId()
	a1.Token = token
	a1.RefreshToken = model.NewId()
	Must(store.AccessData().Save(&a1))

	if result := <-store.AccessData().Get(token); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		ra1 := result.Data.(*model.AccessData)
		encToken := model.Md5Encrypt(utils.Cfg.ServiceSettings.TokenSalt, token)

		if encToken != ra1.Token {
			t.Fatal("token encryption failed")
		}
	}

	if err := (<-store.AccessData().GetByAuthCode(a1.Token)).Err; err != nil {
		t.Fatal(err)
	}

	if err := (<-store.AccessData().GetByAuthCode("junk")).Err; err != nil {
		t.Fatal(err)
	}
}

func TestAccessStoreRemove(t *testing.T) {
	Setup()

	a1 := model.AccessData{}
	a1.AuthCode = model.NewId()
	a1.UserId = model.NewId()
	token := model.NewId()
	a1.Token = token
	a1.RefreshToken = model.NewId()
	Must(store.AccessData().Save(&a1))

	if err := (<-store.AccessData().Remove(token)).Err; err != nil {
		t.Fatal(err)
	}

	if result := <-store.AccessData().GetByAuthCode(a1.Token); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		if result.Data != nil {
			t.Fatal("did not delete access token")
		}
	}
}
