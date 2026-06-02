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
	t.Run("UserAccessTokenExpiry", func(t *testing.T) { testUserAccessTokenExpiry(t, rctx, ss) })
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
	for i := range 10 {
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

func testUserAccessTokenExpiry(t *testing.T, rctx request.CTX, ss store.Store) {
	now := model.GetMillis()

	// Non-expiring token (ExpiresAt == 0)
	nonExpiring := &model.UserAccessToken{
		Token:       model.NewId(),
		UserId:      model.NewId(),
		Description: "non-expiring",
	}
	_, err := ss.UserAccessToken().Save(nonExpiring)
	require.NoError(t, err)

	// Token already expired
	expired := &model.UserAccessToken{
		Token:       model.NewId(),
		UserId:      model.NewId(),
		Description: "expired",
		ExpiresAt:   now - 60*1000,
	}
	expiredSession := &model.Session{UserId: expired.UserId, Token: expired.Token}
	_, sErr := ss.Session().Save(rctx, expiredSession)
	require.NoError(t, sErr)
	_, err = ss.UserAccessToken().Save(expired)
	require.NoError(t, err)

	// Token expiring in the future
	future := &model.UserAccessToken{
		Token:       model.NewId(),
		UserId:      model.NewId(),
		Description: "future",
		ExpiresAt:   now + 60*60*1000,
	}
	_, err = ss.UserAccessToken().Save(future)
	require.NoError(t, err)

	t.Cleanup(func() {
		// Delete all three fixtures (expired included) so the test stays
		// isolated even on early exit before DeleteByIds runs.
		_ = ss.UserAccessToken().Delete(nonExpiring.Id)
		_ = ss.UserAccessToken().Delete(future.Id)
		_ = ss.UserAccessToken().Delete(expired.Id)
	})

	// The stored value should be persisted and returned
	stored, err := ss.UserAccessToken().Get(expired.Id)
	require.NoError(t, err)
	require.Equal(t, expired.ExpiresAt, stored.ExpiresAt)

	storedNonExpiring, err := ss.UserAccessToken().Get(nonExpiring.Id)
	require.NoError(t, err)
	require.Equal(t, int64(0), storedNonExpiring.ExpiresAt)

	// GetExpiredBefore should only return the expired token and must not leak
	// the secret token value (the Token column is intentionally not selected).
	expiredRows, err := ss.UserAccessToken().GetExpiredBefore(now, 100)
	require.NoError(t, err)
	found := false
	for _, row := range expiredRows {
		// The Token column is never selected by GetExpiredBefore, so no row —
		// not just the matched expired one — should ever carry the secret.
		require.Empty(t, row.Token, "GetExpiredBefore must never return the secret Token value")
		if row.Id == expired.Id {
			require.Equal(t, expired.ExpiresAt, row.ExpiresAt)
			found = true
		}
		require.NotEqual(t, nonExpiring.Id, row.Id, "non-expiring token must not be returned")
		require.NotEqual(t, future.Id, row.Id, "future token must not be returned")
	}
	require.True(t, found, "expired token should be present in GetExpiredBefore results")

	// Negative or zero limits short-circuit and return an empty slice without
	// hitting the DB; verify the contract holds.
	zeroLimit, err := ss.UserAccessToken().GetExpiredBefore(now, 0)
	require.NoError(t, err)
	require.Empty(t, zeroLimit)
	negativeLimit, err := ss.UserAccessToken().GetExpiredBefore(now, -5)
	require.NoError(t, err)
	require.Empty(t, negativeLimit)

	// DeleteByIds on the expired token removes it and its session but leaves
	// the other two tokens alone.
	deleted, err := ss.UserAccessToken().DeleteByIds([]string{expired.Id})
	require.NoError(t, err)
	require.Equal(t, int64(1), deleted)

	_, err = ss.UserAccessToken().Get(expired.Id)
	require.Error(t, err, "expired token should be deleted")

	_, err = ss.Session().Get(rctx, expiredSession.Token)
	require.Error(t, err, "session for expired token should be deleted")

	stillThere, err := ss.UserAccessToken().Get(nonExpiring.Id)
	require.NoError(t, err)
	require.Equal(t, nonExpiring.Id, stillThere.Id)

	stillThere, err = ss.UserAccessToken().Get(future.Id)
	require.NoError(t, err)
	require.Equal(t, future.Id, stillThere.Id)

	// DeleteByIds with an empty slice is a no-op, and with a non-matching id
	// returns 0 without error.
	deleted, err = ss.UserAccessToken().DeleteByIds(nil)
	require.NoError(t, err)
	require.Equal(t, int64(0), deleted)

	deleted, err = ss.UserAccessToken().DeleteByIds([]string{model.NewId()})
	require.NoError(t, err)
	require.Equal(t, int64(0), deleted)
}
