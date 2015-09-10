// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	"testing"
)

func TestOAuthStoreSaveApp(t *testing.T) {
	Setup()

	a1 := model.OAuthApp{}
	a1.CreatorId = model.NewId()
	a1.Name = "TestApp" + model.NewId()
	a1.CallbackUrls = []string{"https://nowhere.com"}
	a1.Homepage = "https://nowhere.com"

	if err := (<-store.OAuth().SaveApp(&a1)).Err; err != nil {
		t.Fatal(err)
	}
}

func TestOAuthStoreGetApp(t *testing.T) {
	Setup()

	a1 := model.OAuthApp{}
	a1.CreatorId = model.NewId()
	a1.Name = "TestApp" + model.NewId()
	a1.CallbackUrls = []string{"https://nowhere.com"}
	a1.Homepage = "https://nowhere.com"
	Must(store.OAuth().SaveApp(&a1))

	if err := (<-store.OAuth().GetApp(a1.Id)).Err; err != nil {
		t.Fatal(err)
	}

	if err := (<-store.OAuth().GetAppByUser(a1.CreatorId)).Err; err != nil {
		t.Fatal(err)
	}
}

func TestOAuthStoreUpdateApp(t *testing.T) {
	Setup()

	a1 := model.OAuthApp{}
	a1.CreatorId = model.NewId()
	a1.Name = "TestApp" + model.NewId()
	a1.CallbackUrls = []string{"https://nowhere.com"}
	a1.Homepage = "https://nowhere.com"
	Must(store.OAuth().SaveApp(&a1))

	a1.CreateAt = 1
	a1.ClientSecret = "pwd"
	a1.CreatorId = "12345678901234567890123456"
	a1.Name = "NewName"
	if result := <-store.OAuth().UpdateApp(&a1); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		ua1 := (result.Data.([2]*model.OAuthApp)[0])
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

func TestOAuthStoreSaveAccessData(t *testing.T) {
	Setup()

	a1 := model.AccessData{}
	a1.AuthCode = model.NewId()
	a1.UserId = model.NewId()
	a1.Token = model.NewId()
	a1.RefreshToken = model.NewId()

	if err := (<-store.OAuth().SaveAccessData(&a1)).Err; err != nil {
		t.Fatal(err)
	}
}

func TestOAuthStoreGetAccessData(t *testing.T) {
	Setup()

	a1 := model.AccessData{}
	a1.AuthCode = model.NewId()
	a1.UserId = model.NewId()
	token := model.NewId()
	a1.Token = token
	a1.RefreshToken = model.NewId()
	Must(store.OAuth().SaveAccessData(&a1))

	if result := <-store.OAuth().GetAccessData(token); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		ra1 := result.Data.(*model.AccessData)
		encToken := model.Md5Encrypt(utils.Cfg.ServiceSettings.TokenSalt, token)

		if encToken != ra1.Token {
			t.Fatal("token encryption failed")
		}
	}

	if err := (<-store.OAuth().GetAccessDataByAuthCode(a1.Token)).Err; err != nil {
		t.Fatal(err)
	}

	if err := (<-store.OAuth().GetAccessDataByAuthCode("junk")).Err; err != nil {
		t.Fatal(err)
	}
}

func TestOAuthStoreRemoveAccessData(t *testing.T) {
	Setup()

	a1 := model.AccessData{}
	a1.AuthCode = model.NewId()
	a1.UserId = model.NewId()
	token := model.NewId()
	a1.Token = token
	a1.RefreshToken = model.NewId()
	Must(store.OAuth().SaveAccessData(&a1))

	if err := (<-store.OAuth().RemoveAccessData(token)).Err; err != nil {
		t.Fatal(err)
	}

	if result := <-store.OAuth().GetAccessDataByAuthCode(a1.Token); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		if result.Data != nil {
			t.Fatal("did not delete access token")
		}
	}
}

func TestOAuthStoreSave(t *testing.T) {
	Setup()

	a1 := model.AuthData{}
	a1.ClientId = model.NewId()
	a1.UserId = model.NewId()
	a1.Code = model.NewId()

	if err := (<-store.OAuth().SaveAuthData(&a1)).Err; err != nil {
		t.Fatal(err)
	}
}

func TestOAuthStoreGet(t *testing.T) {
	Setup()

	a1 := model.AuthData{}
	a1.ClientId = model.NewId()
	a1.UserId = model.NewId()
	a1.Code = model.NewId()
	Must(store.OAuth().SaveAuthData(&a1))

	if err := (<-store.OAuth().GetAuthData(a1.Code)).Err; err != nil {
		t.Fatal(err)
	}
}

func TestOAuthStoreRemove(t *testing.T) {
	Setup()

	a1 := model.AuthData{}
	a1.ClientId = model.NewId()
	a1.UserId = model.NewId()
	a1.Code = model.NewId()
	Must(store.OAuth().SaveAuthData(&a1))

	if err := (<-store.OAuth().RemoveAuthData(a1.Code)).Err; err != nil {
		t.Fatal(err)
	}

	if err := (<-store.OAuth().GetAuthData(a1.Code)).Err; err == nil {
		t.Fatal("should have errored - auth code removed")
	}
}
