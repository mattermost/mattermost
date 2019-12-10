// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
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

	_, err = ss.UserAccessToken().Save(uat)
	require.Nil(t, err)

	result, terr := ss.UserAccessToken().Get(uat.Id)
	require.Nil(t, terr)
	require.Equal(t, result.Token, uat.Token, "received incorrect token after save")

	received, err2 := ss.UserAccessToken().GetByToken(uat.Token)
	require.Nil(t, err2)
	require.Equal(t, received.Token, uat.Token, "received incorrect token after save")

	_, err = ss.UserAccessToken().GetByToken("notarealtoken")
	require.NotNil(t, err, "should have failed on bad token")

	received2, err2 := ss.UserAccessToken().GetByUser(uat.UserId, 0, 100)
	require.Nil(t, err2)
	require.Equal(t, 1, len(received2), "received incorrect number of tokens after save")

	result2, appError := ss.UserAccessToken().GetAll(0, 100)
	require.Nil(t, appError)
	require.Equal(t, 1, len(result2), "received incorrect number of tokens after save")

	err = ss.UserAccessToken().Delete(uat.Id)
	require.Nil(t, err)

	_, err = ss.Session().Get(s1.Token)
	require.NotNil(t, err, "should error - session should be deleted")

	_, err = ss.UserAccessToken().GetByToken(s1.Token)
	require.NotNil(t, err, "should error - access token should be deleted")

	s2 := &model.Session{}
	s2.UserId = uat.UserId
	s2.Token = uat.Token

	s2, err = ss.Session().Save(s2)
	require.Nil(t, err)

	_, err = ss.UserAccessToken().Save(uat)
	require.Nil(t, err)

	err = ss.UserAccessToken().DeleteAllForUser(uat.UserId)
	require.Nil(t, err)

	_, err = ss.Session().Get(s2.Token)
	require.NotNil(t, err, "should error - session should be deleted")

	_, err = ss.UserAccessToken().GetByToken(s2.Token)
	require.NotNil(t, err, "should error - access token should be deleted")
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

	_, err = ss.UserAccessToken().Save(uat)
	require.Nil(t, err)

	err = ss.UserAccessToken().UpdateTokenDisable(uat.Id)
	require.Nil(t, err)

	_, err = ss.Session().Get(s1.Token)
	require.NotNil(t, err, "should error - session should be deleted")

	s2 := &model.Session{}
	s2.UserId = uat.UserId
	s2.Token = uat.Token

	s2, err = ss.Session().Save(s2)
	require.Nil(t, err)

	err = ss.UserAccessToken().UpdateTokenEnable(uat.Id)
	require.Nil(t, err)
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

	_, err = ss.UserAccessToken().Save(uat)
	require.Nil(t, err)

	received, err := ss.UserAccessToken().Search(uat.Id)
	require.Nil(t, err)

	require.Equal(t, 1, len(received), "received incorrect number of tokens after search")

	received, err = ss.UserAccessToken().Search(uat.UserId)
	require.Nil(t, err)
	require.Equal(t, 1, len(received), "received incorrect number of tokens after search")

	received, err = ss.UserAccessToken().Search(u1.Username)
	require.Nil(t, err)
	require.Equal(t, 1, len(received), "received incorrect number of tokens after search")
}
