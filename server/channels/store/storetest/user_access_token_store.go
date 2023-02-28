// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/channels/store"
	"github.com/mattermost/mattermost-server/v6/model"
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
	require.NoError(t, err)

	_, nErr := ss.UserAccessToken().Save(uat)
	require.NoError(t, nErr)

	result, terr := ss.UserAccessToken().Get(uat.Id)
	require.NoError(t, terr)
	require.Equal(t, result.Token, uat.Token, "received incorrect token after save")

	received, err2 := ss.UserAccessToken().GetByToken(uat.Token)
	require.NoError(t, err2)
	require.Equal(t, received.Token, uat.Token, "received incorrect token after save")

	_, nErr = ss.UserAccessToken().GetByToken("notarealtoken")
	require.Error(t, nErr, "should have failed on bad token")

	received2, err2 := ss.UserAccessToken().GetByUser(uat.UserId, 0, 100)
	require.NoError(t, err2)
	require.Equal(t, 1, len(received2), "received incorrect number of tokens after save")

	result2, err := ss.UserAccessToken().GetAll(0, 100)
	require.NoError(t, err)
	require.Equal(t, 1, len(result2), "received incorrect number of tokens after save")

	nErr = ss.UserAccessToken().Delete(uat.Id)
	require.NoError(t, nErr)

	_, err = ss.Session().Get(context.Background(), s1.Token)
	require.Error(t, err, "should error - session should be deleted")

	_, nErr = ss.UserAccessToken().GetByToken(s1.Token)
	require.Error(t, nErr, "should error - access token should be deleted")

	s2 := &model.Session{}
	s2.UserId = uat.UserId
	s2.Token = uat.Token

	s2, err = ss.Session().Save(s2)
	require.NoError(t, err)

	_, nErr = ss.UserAccessToken().Save(uat)
	require.NoError(t, nErr)

	nErr = ss.UserAccessToken().DeleteAllForUser(uat.UserId)
	require.NoError(t, nErr)

	_, err = ss.Session().Get(context.Background(), s2.Token)
	require.Error(t, err, "should error - session should be deleted")

	_, nErr = ss.UserAccessToken().GetByToken(s2.Token)
	require.Error(t, nErr, "should error - access token should be deleted")
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
	require.NoError(t, err)

	_, nErr := ss.UserAccessToken().Save(uat)
	require.NoError(t, nErr)

	nErr = ss.UserAccessToken().UpdateTokenDisable(uat.Id)
	require.NoError(t, nErr)

	_, err = ss.Session().Get(context.Background(), s1.Token)
	require.Error(t, err, "should error - session should be deleted")

	s2 := &model.Session{}
	s2.UserId = uat.UserId
	s2.Token = uat.Token

	_, err = ss.Session().Save(s2)
	require.NoError(t, err)

	nErr = ss.UserAccessToken().UpdateTokenEnable(uat.Id)
	require.NoError(t, nErr)
}

func testUserAccessTokenSearch(t *testing.T, ss store.Store) {
	u1 := model.User{}
	u1.Email = MakeEmail()
	u1.Username = model.NewId()

	_, err := ss.User().Save(&u1)
	require.NoError(t, err)

	uat := &model.UserAccessToken{
		Token:       model.NewId(),
		UserId:      u1.Id,
		Description: "testtoken",
	}

	s1 := &model.Session{}
	s1.UserId = uat.UserId
	s1.Token = uat.Token

	_, nErr := ss.Session().Save(s1)
	require.NoError(t, nErr)

	_, nErr = ss.UserAccessToken().Save(uat)
	require.NoError(t, nErr)

	received, nErr := ss.UserAccessToken().Search(uat.Id)
	require.NoError(t, nErr)

	require.Equal(t, 1, len(received), "received incorrect number of tokens after search")

	received, nErr = ss.UserAccessToken().Search(uat.UserId)
	require.NoError(t, nErr)
	require.Equal(t, 1, len(received), "received incorrect number of tokens after search")

	received, nErr = ss.UserAccessToken().Search(u1.Username)
	require.NoError(t, nErr)
	require.Equal(t, 1, len(received), "received incorrect number of tokens after search")
}
