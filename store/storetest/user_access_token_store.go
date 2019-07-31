// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package storetest

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/stretchr/testify/require"
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

	s1 := &model.Session{}
	s1.UserId = uat.UserId
	s1.Token = uat.Token

	s1, err := ss.Session().Save(s1)
	require.Nil(t, err)

	if _, err = ss.UserAccessToken().Save(uat); err != nil {
		t.Fatal(err)
	}

	if result, terr := ss.UserAccessToken().Get(uat.Id); terr != nil {
		t.Fatal(terr)
	} else if result.Token != uat.Token {
		t.Fatal("received incorrect token after save")
	}

	if received, err2 := ss.UserAccessToken().GetByToken(uat.Token); err2 != nil {
		t.Fatal(err2)
	} else if received.Token != uat.Token {
		t.Fatal("received incorrect token after save")
	}

	if _, err = ss.UserAccessToken().GetByToken("notarealtoken"); err == nil {
		t.Fatal("should have failed on bad token")
	}

	if received, err2 := ss.UserAccessToken().GetByUser(uat.UserId, 0, 100); err2 != nil {
		t.Fatal(err2)
	} else if len(received) != 1 {
		t.Fatal("received incorrect number of tokens after save")
	}

	if result, appError := ss.UserAccessToken().GetAll(0, 100); appError != nil {
		t.Fatal(appError)
	} else if len(result) != 1 {
		t.Fatal("received incorrect number of tokens after save")
	}

	if err = ss.UserAccessToken().Delete(uat.Id); err != nil {
		t.Fatal(err)
	}

	if _, err = ss.Session().Get(s1.Token); err == nil {
		t.Fatal("should error - session should be deleted")
	}

	if _, err = ss.UserAccessToken().GetByToken(s1.Token); err == nil {
		t.Fatal("should error - access token should be deleted")
	}

	s2 := &model.Session{}
	s2.UserId = uat.UserId
	s2.Token = uat.Token

	s2, err = ss.Session().Save(s2)
	require.Nil(t, err)

	if _, err = ss.UserAccessToken().Save(uat); err != nil {
		t.Fatal(err)
	}

	if err := ss.UserAccessToken().DeleteAllForUser(uat.UserId); err != nil {
		t.Fatal(err)
	}

	if _, err := ss.Session().Get(s2.Token); err == nil {
		t.Fatal("should error - session should be deleted")
	}

	if _, err := ss.UserAccessToken().GetByToken(s2.Token); err == nil {
		t.Fatal("should error - access token should be deleted")
	}
}

func testUserAccessTokenDisableEnable(t *testing.T, ss store.Store) {
	uat := &model.UserAccessToken{
		Token:       model.NewId(),
		UserId:      model.NewId(),
		Description: "testtoken",
	}

	s1 := &model.Session{}
	s1.UserId = uat.UserId
	s1.Token = uat.Token

	s1, err := ss.Session().Save(s1)
	require.Nil(t, err)

	if _, err = ss.UserAccessToken().Save(uat); err != nil {
		t.Fatal(err)
	}

	if err = ss.UserAccessToken().UpdateTokenDisable(uat.Id); err != nil {
		t.Fatal(err)
	}

	if _, err = ss.Session().Get(s1.Token); err == nil {
		t.Fatal("should error - session should be deleted")
	}

	s2 := &model.Session{}
	s2.UserId = uat.UserId
	s2.Token = uat.Token

	s2, err = ss.Session().Save(s2)
	require.Nil(t, err)

	if err = ss.UserAccessToken().UpdateTokenEnable(uat.Id); err != nil {
		t.Fatal(err)
	}
}

func testUserAccessTokenSearch(t *testing.T, ss store.Store) {
	u1 := model.User{}
	u1.Email = MakeEmail()
	u1.Username = model.NewId()

	_, err := ss.User().Save(&u1)
	require.Nil(t, err)

	uat := &model.UserAccessToken{
		Token:       model.NewId(),
		UserId:      u1.Id,
		Description: "testtoken",
	}

	s1 := &model.Session{}
	s1.UserId = uat.UserId
	s1.Token = uat.Token

	s1, err = ss.Session().Save(s1)
	require.Nil(t, err)

	if _, err = ss.UserAccessToken().Save(uat); err != nil {
		t.Fatal(err)
	}

	if received, err := ss.UserAccessToken().Search(uat.Id); err != nil {
		t.Fatal(err)
	} else if len(received) != 1 {
		t.Fatal("received incorrect number of tokens after search")
	}

	if received, err := ss.UserAccessToken().Search(uat.UserId); err != nil {
		t.Fatal(err)
	} else if len(received) != 1 {
		t.Fatal("received incorrect number of tokens after search")
	}

	if received, err := ss.UserAccessToken().Search(u1.Username); err != nil {
		t.Fatal(err)
	} else if len(received) != 1 {
		t.Fatal("received incorrect number of tokens after search")
	}
}
