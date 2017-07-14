// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"github.com/mattermost/platform/model"
	"testing"
)

func TestOAuthStoreSaveApp(t *testing.T) {
	Setup()

	a1 := model.OAuthApp{}
	a1.CreatorId = model.NewId()
	a1.CallbackUrls = []string{"https://nowhere.com"}
	a1.Homepage = "https://nowhere.com"

	// Try to save an app that already has an Id
	a1.Id = model.NewId()
	if err := (<-store.OAuth().SaveApp(&a1)).Err; err == nil {
		t.Fatal("Should have failed, cannot add an OAuth app cannot be save with an Id, it has to be updated")
	}

	// Try to save an Invalid App
	a1.Id = ""
	if err := (<-store.OAuth().SaveApp(&a1)).Err; err == nil {
		t.Fatal("Should have failed, app should be invalid cause it doesn' have a name set")
	}

	// Save the app
	a1.Id = ""
	a1.Name = "TestApp" + model.NewId()
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

	// Lets try to get and app that does not exists
	if err := (<-store.OAuth().GetApp("fake0123456789abcderfgret1")).Err; err == nil {
		t.Fatal("Should have failed. App does not exists")
	}

	if err := (<-store.OAuth().GetApp(a1.Id)).Err; err != nil {
		t.Fatal(err)
	}

	// Lets try and get the app from a user that hasn't created any apps
	if result := (<-store.OAuth().GetAppByUser("fake0123456789abcderfgret1", 0, 1000)); result.Err == nil {
		if len(result.Data.([]*model.OAuthApp)) > 0 {
			t.Fatal("Should have failed. Fake user hasn't created any apps")
		}
	} else {
		t.Fatal(result.Err)
	}

	if err := (<-store.OAuth().GetAppByUser(a1.CreatorId, 0, 1000)).Err; err != nil {
		t.Fatal(err)
	}

	if err := (<-store.OAuth().GetApps(0, 1000)).Err; err != nil {
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

	// temporarily save the created app id
	id := a1.Id

	a1.CreateAt = 1
	a1.ClientSecret = "pwd"
	a1.CreatorId = "12345678901234567890123456"

	// Lets update the app by removing the name
	a1.Name = ""
	if result := <-store.OAuth().UpdateApp(&a1); result.Err == nil {
		t.Fatal("Should have failed. App name is not set")
	}

	// Lets not find the app that we are trying to update
	a1.Id = "fake0123456789abcderfgret1"
	a1.Name = "NewName"
	if result := <-store.OAuth().UpdateApp(&a1); result.Err == nil {
		t.Fatal("Should have failed. Not able to find the app")
	}

	a1.Id = id
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
		if ua1.CreatorId == "12345678901234567890123456" {
			t.Fatal("creator id should not have updated")
		}
	}
}

func TestOAuthStoreSaveAccessData(t *testing.T) {
	Setup()

	a1 := model.AccessData{}
	a1.ClientId = model.NewId()
	a1.UserId = model.NewId()

	// Lets try and save an incomplete access data
	if err := (<-store.OAuth().SaveAccessData(&a1)).Err; err == nil {
		t.Fatal("Should have failed. Access data needs the token")
	}

	a1.Token = model.NewId()
	a1.RefreshToken = model.NewId()
	a1.RedirectUri = "http://example.com"

	if err := (<-store.OAuth().SaveAccessData(&a1)).Err; err != nil {
		t.Fatal(err)
	}
}

func TestOAuthUpdateAccessData(t *testing.T) {
	Setup()

	a1 := model.AccessData{}
	a1.ClientId = model.NewId()
	a1.UserId = model.NewId()
	a1.Token = model.NewId()
	a1.RefreshToken = model.NewId()
	a1.ExpiresAt = model.GetMillis()
	a1.RedirectUri = "http://example.com"
	Must(store.OAuth().SaveAccessData(&a1))

	//Try to update to invalid Refresh Token
	refreshToken := a1.RefreshToken
	a1.RefreshToken = model.NewId() + "123"
	if err := (<-store.OAuth().UpdateAccessData(&a1)).Err; err == nil {
		t.Fatal("Should have failed with invalid token")
	}

	//Try to update to invalid RedirectUri
	a1.RefreshToken = model.NewId()
	a1.RedirectUri = ""
	if err := (<-store.OAuth().UpdateAccessData(&a1)).Err; err == nil {
		t.Fatal("Should have failed with invalid Redirect URI")
	}

	// Should update fine
	a1.RedirectUri = "http://example.com"
	if result := <-store.OAuth().UpdateAccessData(&a1); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		ra1 := result.Data.(*model.AccessData)
		if ra1.RefreshToken == refreshToken {
			t.Fatal("refresh tokens didn't match")
		}
	}
}

func TestOAuthStoreGetAccessData(t *testing.T) {
	Setup()

	a1 := model.AccessData{}
	a1.ClientId = model.NewId()
	a1.UserId = model.NewId()
	a1.Token = model.NewId()
	a1.RefreshToken = model.NewId()
	a1.ExpiresAt = model.GetMillis()
	a1.RedirectUri = "http://example.com"
	Must(store.OAuth().SaveAccessData(&a1))

	if err := (<-store.OAuth().GetAccessData("invalidToken")).Err; err == nil {
		t.Fatal("Should have failed. There is no data with an invalid token")
	}

	if result := <-store.OAuth().GetAccessData(a1.Token); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		ra1 := result.Data.(*model.AccessData)
		if a1.Token != ra1.Token {
			t.Fatal("tokens didn't match")
		}
	}

	if err := (<-store.OAuth().GetPreviousAccessData(a1.UserId, a1.ClientId)).Err; err != nil {
		t.Fatal(err)
	}

	if err := (<-store.OAuth().GetPreviousAccessData("user", "junk")).Err; err != nil {
		t.Fatal(err)
	}

	// Try to get the Access data using an invalid refresh token
	if err := (<-store.OAuth().GetAccessDataByRefreshToken(a1.Token)).Err; err == nil {
		t.Fatal("Should have failed. There is no data with an invalid token")
	}

	// Get the Access Data using the refresh token
	if result := <-store.OAuth().GetAccessDataByRefreshToken(a1.RefreshToken); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		ra1 := result.Data.(*model.AccessData)
		if a1.RefreshToken != ra1.RefreshToken {
			t.Fatal("tokens didn't match")
		}
	}
}

func TestOAuthStoreRemoveAccessData(t *testing.T) {
	Setup()

	a1 := model.AccessData{}
	a1.ClientId = model.NewId()
	a1.UserId = model.NewId()
	a1.Token = model.NewId()
	a1.RefreshToken = model.NewId()
	a1.RedirectUri = "http://example.com"
	Must(store.OAuth().SaveAccessData(&a1))

	if err := (<-store.OAuth().RemoveAccessData(a1.Token)).Err; err != nil {
		t.Fatal(err)
	}

	if result := (<-store.OAuth().GetPreviousAccessData(a1.UserId, a1.ClientId)); result.Err != nil {
	} else {
		if result.Data != nil {
			t.Fatal("did not delete access token")
		}
	}
}

func TestOAuthStoreSaveAuthData(t *testing.T) {
	Setup()

	a1 := model.AuthData{}
	a1.ClientId = model.NewId()
	a1.UserId = model.NewId()
	a1.Code = model.NewId()
	a1.RedirectUri = "http://example.com"
	if err := (<-store.OAuth().SaveAuthData(&a1)).Err; err != nil {
		t.Fatal(err)
	}
}

func TestOAuthStoreGetAuthData(t *testing.T) {
	Setup()

	a1 := model.AuthData{}
	a1.ClientId = model.NewId()
	a1.UserId = model.NewId()
	a1.Code = model.NewId()
	a1.RedirectUri = "http://example.com"
	Must(store.OAuth().SaveAuthData(&a1))

	if err := (<-store.OAuth().GetAuthData(a1.Code)).Err; err != nil {
		t.Fatal(err)
	}
}

func TestOAuthStoreRemoveAuthData(t *testing.T) {
	Setup()

	a1 := model.AuthData{}
	a1.ClientId = model.NewId()
	a1.UserId = model.NewId()
	a1.Code = model.NewId()
	a1.RedirectUri = "http://example.com"
	Must(store.OAuth().SaveAuthData(&a1))

	if err := (<-store.OAuth().RemoveAuthData(a1.Code)).Err; err != nil {
		t.Fatal(err)
	}

	if err := (<-store.OAuth().GetAuthData(a1.Code)).Err; err == nil {
		t.Fatal("should have errored - auth code removed")
	}
}

func TestOAuthStoreRemoveAuthDataByUser(t *testing.T) {
	Setup()

	a1 := model.AuthData{}
	a1.ClientId = model.NewId()
	a1.UserId = model.NewId()
	a1.Code = model.NewId()
	a1.RedirectUri = "http://example.com"
	Must(store.OAuth().SaveAuthData(&a1))

	if err := (<-store.OAuth().PermanentDeleteAuthDataByUser(a1.UserId)).Err; err != nil {
		t.Fatal(err)
	}
}

func TestOAuthGetAuthorizedApps(t *testing.T) {
	Setup()

	a1 := model.OAuthApp{}
	a1.CreatorId = model.NewId()
	a1.Name = "TestApp" + model.NewId()
	a1.CallbackUrls = []string{"https://nowhere.com"}
	a1.Homepage = "https://nowhere.com"
	Must(store.OAuth().SaveApp(&a1))

	// Lets try and get an Authorized app for a user who hasn't authorized it
	if result := <-store.OAuth().GetAuthorizedApps("fake0123456789abcderfgret1", 0, 1000); result.Err == nil {
		if len(result.Data.([]*model.OAuthApp)) > 0 {
			t.Fatal("Should have failed. Fake user hasn't authorized the app")
		}
	} else {
		t.Fatal(result.Err)
	}

	// allow the app
	p := model.Preference{}
	p.UserId = a1.CreatorId
	p.Category = model.PREFERENCE_CATEGORY_AUTHORIZED_OAUTH_APP
	p.Name = a1.Id
	p.Value = "true"
	Must(store.Preference().Save(&model.Preferences{p}))

	if result := <-store.OAuth().GetAuthorizedApps(a1.CreatorId, 0, 1000); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		apps := result.Data.([]*model.OAuthApp)
		if len(apps) == 0 {
			t.Fatal("It should have return apps")
		}
	}
}

func TestOAuthGetAccessDataByUserForApp(t *testing.T) {
	Setup()

	a1 := model.OAuthApp{}
	a1.CreatorId = model.NewId()
	a1.Name = "TestApp" + model.NewId()
	a1.CallbackUrls = []string{"https://nowhere.com"}
	a1.Homepage = "https://nowhere.com"
	Must(store.OAuth().SaveApp(&a1))

	// allow the app
	p := model.Preference{}
	p.UserId = a1.CreatorId
	p.Category = model.PREFERENCE_CATEGORY_AUTHORIZED_OAUTH_APP
	p.Name = a1.Id
	p.Value = "true"
	Must(store.Preference().Save(&model.Preferences{p}))

	if result := <-store.OAuth().GetAuthorizedApps(a1.CreatorId, 0, 1000); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		apps := result.Data.([]*model.OAuthApp)
		if len(apps) == 0 {
			t.Fatal("It should have return apps")
		}
	}

	// save the token
	ad1 := model.AccessData{}
	ad1.ClientId = a1.Id
	ad1.UserId = a1.CreatorId
	ad1.Token = model.NewId()
	ad1.RefreshToken = model.NewId()
	ad1.RedirectUri = "http://example.com"

	if err := (<-store.OAuth().SaveAccessData(&ad1)).Err; err != nil {
		t.Fatal(err)
	}

	if result := <-store.OAuth().GetAccessDataByUserForApp(a1.CreatorId, a1.Id); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		accessData := result.Data.([]*model.AccessData)
		if len(accessData) == 0 {
			t.Fatal("It should have return access data")
		}
	}
}

func TestOAuthStoreDeleteApp(t *testing.T) {
	Setup()

	a1 := model.OAuthApp{}
	a1.CreatorId = model.NewId()
	a1.Name = "TestApp" + model.NewId()
	a1.CallbackUrls = []string{"https://nowhere.com"}
	a1.Homepage = "https://nowhere.com"
	Must(store.OAuth().SaveApp(&a1))

	// delete a non-existent app
	if err := (<-store.OAuth().DeleteApp("fakeclientId")).Err; err != nil {
		t.Fatal(err)
	}

	s1 := model.Session{}
	s1.UserId = model.NewId()
	s1.Token = model.NewId()
	s1.IsOAuth = true

	Must(store.Session().Save(&s1))

	ad1 := model.AccessData{}
	ad1.ClientId = a1.Id
	ad1.UserId = a1.CreatorId
	ad1.Token = s1.Token
	ad1.RefreshToken = model.NewId()
	ad1.RedirectUri = "http://example.com"

	Must(store.OAuth().SaveAccessData(&ad1))

	if err := (<-store.OAuth().DeleteApp(a1.Id)).Err; err != nil {
		t.Fatal(err)
	}

	if err := (<-store.Session().Get(s1.Token)).Err; err == nil {
		t.Fatal("should error - session should be deleted")
	}

	if err := (<-store.OAuth().GetAccessData(s1.Token)).Err; err == nil {
		t.Fatal("should error - access data should be deleted")
	}
}
