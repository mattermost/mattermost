// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func TestUserAccessTokenStore(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("UserAccessTokenSaveGetDelete", func(t *testing.T) { testUserAccessTokenSaveGetDelete(t, rctx, ss) })
	t.Run("UserAccessTokenDisableEnable", func(t *testing.T) { testUserAccessTokenDisableEnable(t, rctx, ss) })
	t.Run("UserAccessTokenSearch", func(t *testing.T) { testUserAccessTokenSearch(t, rctx, ss) })
	t.Run("UserAccessTokenPagination", func(t *testing.T) { testUserAccessTokenPagination(t, rctx, ss) })
}

func testUserAccessTokenSaveGetDelete(t *testing.T, rctx request.CTX, ss store.Store) {
	uat := &model.UserAccessToken{
		Token:       model.NewId(),
		UserId:      model.NewId(),
		Description: "testtoken",
	}

	s1 := &model.Session{}
	s1.UserId = uat.UserId
	s1.Token = uat.Token

	s1, err := ss.Session().Save(rctx, s1)
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

	_, err = ss.Session().Get(rctx, s1.Token)
	require.Error(t, err, "should error - session should be deleted")

	_, nErr = ss.UserAccessToken().GetByToken(s1.Token)
	require.Error(t, nErr, "should error - access token should be deleted")

	s2 := &model.Session{}
	s2.UserId = uat.UserId
	s2.Token = uat.Token

	s2, err = ss.Session().Save(rctx, s2)
	require.NoError(t, err)

	_, nErr = ss.UserAccessToken().Save(uat)
	require.NoError(t, nErr)

	nErr = ss.UserAccessToken().DeleteAllForUser(uat.UserId)
	require.NoError(t, nErr)

	_, err = ss.Session().Get(rctx, s2.Token)
	require.Error(t, err, "should error - session should be deleted")

	_, nErr = ss.UserAccessToken().GetByToken(s2.Token)
	require.Error(t, nErr, "should error - access token should be deleted")
}

func testUserAccessTokenDisableEnable(t *testing.T, rctx request.CTX, ss store.Store) {
	uat := &model.UserAccessToken{
		Token:       model.NewId(),
		UserId:      model.NewId(),
		Description: "testtoken",
	}

	s1 := &model.Session{}
	s1.UserId = uat.UserId
	s1.Token = uat.Token

	s1, err := ss.Session().Save(rctx, s1)
	require.NoError(t, err)

	_, nErr := ss.UserAccessToken().Save(uat)
	require.NoError(t, nErr)

	nErr = ss.UserAccessToken().UpdateTokenDisable(uat.Id)
	require.NoError(t, nErr)

	_, err = ss.Session().Get(rctx, s1.Token)
	require.Error(t, err, "should error - session should be deleted")

	s2 := &model.Session{}
	s2.UserId = uat.UserId
	s2.Token = uat.Token

	_, err = ss.Session().Save(rctx, s2)
	require.NoError(t, err)

	nErr = ss.UserAccessToken().UpdateTokenEnable(uat.Id)
	require.NoError(t, nErr)
}

func testUserAccessTokenSearch(t *testing.T, rctx request.CTX, ss store.Store) {
	u1 := model.User{}
	u1.Email = MakeEmail()
	u1.Username = model.NewUsername()

	_, err := ss.User().Save(rctx, &u1)
	require.NoError(t, err)

	uat := &model.UserAccessToken{
		Token:       model.NewId(),
		UserId:      u1.Id,
		Description: "testtoken",
	}

	s1 := &model.Session{}
	s1.UserId = uat.UserId
	s1.Token = uat.Token

	_, nErr := ss.Session().Save(rctx, s1)
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

func testUserAccessTokenPagination(t *testing.T, rctx request.CTX, ss store.Store) {
	// Create a user
	u1 := model.User{}
	u1.Email = MakeEmail()
	u1.Username = model.NewUsername()

	_, err := ss.User().Save(rctx, &u1)
	require.NoError(t, err)

	// Create 10 tokens for the user
	tokens := make([]*model.UserAccessToken, 10)
	for i := 0; i < 10; i++ {
		tokens[i] = &model.UserAccessToken{
			Token:       model.NewId(),
			UserId:      u1.Id,
			Description: "testtoken" + model.NewId(),
		}

		// Create a session for each token
		s := &model.Session{}
		s.UserId = tokens[i].UserId
		s.Token = tokens[i].Token

		_, err = ss.Session().Save(rctx, s)
		require.NoError(t, err)

		// Save the token
		_, nErr := ss.UserAccessToken().Save(tokens[i])
		require.NoError(t, nErr)
	}

	// Set up cleanup to run even if the test fails
	t.Cleanup(func() {
		for _, token := range tokens {
			// Cleanup shouldn't fail the test, but we still log errors
			if err := ss.UserAccessToken().Delete(token.Id); err != nil {
				t.Logf("Failed to cleanup token %s: %v", token.Id, err)
			}
		}
	})

	// Test GetAll with pagination
	// First page (3 tokens)
	result, nErr := ss.UserAccessToken().GetAll(0, 3)
	require.NoError(t, nErr)
	require.Len(t, result, 3, "Should return 3 tokens for the first page")

	// Second page (3 tokens)
	result, nErr = ss.UserAccessToken().GetAll(3, 3)
	require.NoError(t, nErr)
	require.Len(t, result, 3, "Should return 3 tokens for the second page")

	// Beyond the total number of tokens
	result, nErr = ss.UserAccessToken().GetAll(30, 3)
	require.NoError(t, nErr)
	require.Len(t, result, 0, "Should return 0 tokens when offset is beyond total")

	// All tokens
	result, nErr = ss.UserAccessToken().GetAll(0, 100)
	require.NoError(t, nErr)
	require.GreaterOrEqual(t, len(result), 10, "Should return at least 10 tokens")

	// Test GetByUser with pagination
	// First page (3 tokens)
	result, nErr = ss.UserAccessToken().GetByUser(u1.Id, 0, 3)
	require.NoError(t, nErr)
	require.Len(t, result, 3, "Should return 3 tokens for the first page")

	// Second page (3 tokens)
	result, nErr = ss.UserAccessToken().GetByUser(u1.Id, 3, 3)
	require.NoError(t, nErr)
	require.Len(t, result, 3, "Should return 3 tokens for the second page")

	// Beyond the total number of tokens
	result, nErr = ss.UserAccessToken().GetByUser(u1.Id, 30, 3)
	require.NoError(t, nErr)
	require.Len(t, result, 0, "Should return 0 tokens when offset is beyond total")

	// All tokens for the user
	result, nErr = ss.UserAccessToken().GetByUser(u1.Id, 0, 100)
	require.NoError(t, nErr)
	require.Len(t, result, 10, "Should return 10 tokens for the user")

	// Test for a non-existent user
	result, nErr = ss.UserAccessToken().GetByUser(model.NewId(), 0, 100)
	require.NoError(t, nErr)
	require.Len(t, result, 0, "Should return 0 tokens for non-existent user")
}
