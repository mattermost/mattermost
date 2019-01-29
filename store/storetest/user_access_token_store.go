// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package storetest

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

func TestUserAccessTokenStore(t *testing.T, ss store.Store) {
	t.Run("UserAccessTokenSaveGetDelete", func(t *testing.T) { testUserAccessTokenSaveGetDelete(t, ss) })
	t.Run("UserAccessTokenDisableEnable", func(t *testing.T) { testUserAccessTokenDisableEnable(t, ss) })
	t.Run("UserAccessTokenSearch", func(t *testing.T) { testUserAccessTokenSearch(t, ss) })
}

func testUserAccessTokenSaveGetDelete(t *testing.T, ss store.Store) {
	uat := &model.UserAccessToken{
		Token:       model.NewId(),
		UserId:      model.NewId(),
		Description: "testtoken",
	}

	s1 := model.Session{}
	s1.UserId = uat.UserId
	s1.Token = uat.Token

	store.Must(ss.Session().Save(&s1))

	if result := <-ss.UserAccessToken().Save(uat); result.Err != nil {
		t.Fatal(result.Err)
	}

	if result := <-ss.UserAccessToken().Get(uat.Id); result.Err != nil {
		t.Fatal(result.Err)
	} else if received := result.Data.(*model.UserAccessToken); received.Token != uat.Token {
		t.Fatal("received incorrect token after save")
	}

	if result := <-ss.UserAccessToken().GetByToken(uat.Token); result.Err != nil {
		t.Fatal(result.Err)
	} else if received := result.Data.(*model.UserAccessToken); received.Token != uat.Token {
		t.Fatal("received incorrect token after save")
	}

	if result := <-ss.UserAccessToken().GetByToken("notarealtoken"); result.Err == nil {
		t.Fatal("should have failed on bad token")
	}

	if result := <-ss.UserAccessToken().GetByUser(uat.UserId, 0, 100); result.Err != nil {
		t.Fatal(result.Err)
	} else if received := result.Data.([]*model.UserAccessToken); len(received) != 1 {
		t.Fatal("received incorrect number of tokens after save")
	}

	if result := <-ss.UserAccessToken().GetAll(0, 100); result.Err != nil {
		t.Fatal(result.Err)
	} else if received := result.Data.([]*model.UserAccessToken); len(received) != 1 {
		t.Fatal("received incorrect number of tokens after save")
	}

	if result := <-ss.UserAccessToken().Delete(uat.Id); result.Err != nil {
		t.Fatal(result.Err)
	}

	if err := (<-ss.Session().Get(s1.Token)).Err; err == nil {
		t.Fatal("should error - session should be deleted")
	}

	if err := (<-ss.UserAccessToken().GetByToken(s1.Token)).Err; err == nil {
		t.Fatal("should error - access token should be deleted")
	}

	s2 := model.Session{}
	s2.UserId = uat.UserId
	s2.Token = uat.Token

	store.Must(ss.Session().Save(&s2))

	if result := <-ss.UserAccessToken().Save(uat); result.Err != nil {
		t.Fatal(result.Err)
	}

	if result := <-ss.UserAccessToken().DeleteAllForUser(uat.UserId); result.Err != nil {
		t.Fatal(result.Err)
	}

	if err := (<-ss.Session().Get(s2.Token)).Err; err == nil {
		t.Fatal("should error - session should be deleted")
	}

	if err := (<-ss.UserAccessToken().GetByToken(s2.Token)).Err; err == nil {
		t.Fatal("should error - access token should be deleted")
	}
}

func testUserAccessTokenDisableEnable(t *testing.T, ss store.Store) {
	uat := &model.UserAccessToken{
		Token:       model.NewId(),
		UserId:      model.NewId(),
		Description: "testtoken",
	}

	s1 := model.Session{}
	s1.UserId = uat.UserId
	s1.Token = uat.Token

	store.Must(ss.Session().Save(&s1))

	if result := <-ss.UserAccessToken().Save(uat); result.Err != nil {
		t.Fatal(result.Err)
	}

	if err := (<-ss.UserAccessToken().UpdateTokenDisable(uat.Id)).Err; err != nil {
		t.Fatal(err)
	}

	if err := (<-ss.Session().Get(s1.Token)).Err; err == nil {
		t.Fatal("should error - session should be deleted")
	}

	s2 := model.Session{}
	s2.UserId = uat.UserId
	s2.Token = uat.Token

	store.Must(ss.Session().Save(&s2))

	if err := (<-ss.UserAccessToken().UpdateTokenEnable(uat.Id)).Err; err != nil {
		t.Fatal(err)
	}
}

func testUserAccessTokenSearch(t *testing.T, ss store.Store) {
	u1 := model.User{}
	u1.Email = MakeEmail()
	u1.Username = model.NewId()

	store.Must(ss.User().Save(&u1))

	uat := &model.UserAccessToken{
		Token:       model.NewId(),
		UserId:      u1.Id,
		Description: "testtoken",
	}

	s1 := model.Session{}
	s1.UserId = uat.UserId
	s1.Token = uat.Token

	store.Must(ss.Session().Save(&s1))

	if result := <-ss.UserAccessToken().Save(uat); result.Err != nil {
		t.Fatal(result.Err)
	}

	if result := <-ss.UserAccessToken().Search(uat.Id); result.Err != nil {
		t.Fatal(result.Err)
	} else if received := result.Data.([]*model.UserAccessToken); len(received) != 1 {
		t.Fatal("received incorrect number of tokens after search")
	}

	if result := <-ss.UserAccessToken().Search(uat.UserId); result.Err != nil {
		t.Fatal(result.Err)
	} else if received := result.Data.([]*model.UserAccessToken); len(received) != 1 {
		t.Fatal("received incorrect number of tokens after search")
	}

	if result := <-ss.UserAccessToken().Search(u1.Username); result.Err != nil {
		t.Fatal(result.Err)
	} else if received := result.Data.([]*model.UserAccessToken); len(received) != 1 {
		t.Fatal("received incorrect number of tokens after search")
	}
}
