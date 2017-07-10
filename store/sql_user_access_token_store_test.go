// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"testing"

	"github.com/mattermost/platform/model"
)

func TestUserAccessTokenSaveGetDelete(t *testing.T) {
	Setup()

	uat := &model.UserAccessToken{
		Token:       model.NewId(),
		UserId:      model.NewId(),
		Description: "testtoken",
	}

	s1 := model.Session{}
	s1.UserId = uat.UserId
	s1.Token = uat.Token

	Must(store.Session().Save(&s1))

	if result := <-store.UserAccessToken().Save(uat); result.Err != nil {
		t.Fatal(result.Err)
	}

	if result := <-store.UserAccessToken().Get(uat.Id); result.Err != nil {
		t.Fatal(result.Err)
	} else if received := result.Data.(*model.UserAccessToken); received.Token != uat.Token {
		t.Fatal("received incorrect token after save")
	}

	if result := <-store.UserAccessToken().GetByToken(uat.Token); result.Err != nil {
		t.Fatal(result.Err)
	} else if received := result.Data.(*model.UserAccessToken); received.Token != uat.Token {
		t.Fatal("received incorrect token after save")
	}

	if result := <-store.UserAccessToken().GetByToken("notarealtoken"); result.Err == nil {
		t.Fatal("should have failed on bad token")
	}

	if result := <-store.UserAccessToken().GetByUser(uat.UserId, 0, 100); result.Err != nil {
		t.Fatal(result.Err)
	} else if received := result.Data.([]*model.UserAccessToken); len(received) != 1 {
		t.Fatal("received incorrect number of tokens after save")
	}

	if result := <-store.UserAccessToken().Delete(uat.Id); result.Err != nil {
		t.Fatal(result.Err)
	}

	if err := (<-store.Session().Get(s1.Token)).Err; err == nil {
		t.Fatal("should error - session should be deleted")
	}

	if err := (<-store.UserAccessToken().GetByToken(s1.Token)).Err; err == nil {
		t.Fatal("should error - access token should be deleted")
	}

	s2 := model.Session{}
	s2.UserId = uat.UserId
	s2.Token = uat.Token

	Must(store.Session().Save(&s2))

	if result := <-store.UserAccessToken().Save(uat); result.Err != nil {
		t.Fatal(result.Err)
	}

	if result := <-store.UserAccessToken().DeleteAllForUser(uat.UserId); result.Err != nil {
		t.Fatal(result.Err)
	}

	if err := (<-store.Session().Get(s2.Token)).Err; err == nil {
		t.Fatal("should error - session should be deleted")
	}

	if err := (<-store.UserAccessToken().GetByToken(s2.Token)).Err; err == nil {
		t.Fatal("should error - access token should be deleted")
	}
}
