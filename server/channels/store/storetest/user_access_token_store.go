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
	t.Run("UserAccessTokenNonCompliant", func(t *testing.T) { testUserAccessTokenNonCompliant(t, rctx, ss) })
	t.Run("UserAccessTokenExpiry", func(t *testing.T) { testUserAccessTokenExpiry(t, rctx, ss) })
	t.Run("UserAccessTokenRotate", func(t *testing.T) { testUserAccessTokenRotate(t, rctx, ss) })
	t.Run("UserAccessTokenGetExpiring", func(t *testing.T) { testUserAccessTokenGetExpiring(t, rctx, ss) })
	t.Run("UserAccessTokenUpdateLastNotifiedAt", func(t *testing.T) { testUserAccessTokenUpdateLastNotifiedAt(t, rctx, ss) })
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

func testUserAccessTokenRotate(t *testing.T, rctx request.CTX, ss store.Store) {
	oldSecret := model.NewId()
	uat := &model.UserAccessToken{
		Token:       oldSecret,
		UserId:      model.NewId(),
		Description: "rotate-test",
		ExpiresAt:   model.GetMillis() + 24*60*60*1000, // 1 day from now
	}

	session := &model.Session{UserId: uat.UserId, Token: uat.Token}
	_, err := ss.Session().Save(rctx, session)
	require.NoError(t, err)

	_, nErr := ss.UserAccessToken().Save(uat)
	require.NoError(t, nErr)

	newSecret := model.NewId()
	newExpiry := model.GetMillis() + 48*60*60*1000
	nErr = ss.UserAccessToken().UpdateTokenRotate(uat.Id, newSecret, newExpiry)
	require.NoError(t, nErr)

	// Token row should reflect the new secret and expiry.
	updated, nErr := ss.UserAccessToken().Get(uat.Id)
	require.NoError(t, nErr)
	require.Equal(t, newSecret, updated.Token, "token secret should be updated")
	require.Equal(t, newExpiry, updated.ExpiresAt, "token expiry should be updated")
	require.NotEqual(t, oldSecret, updated.Token, "old secret must be replaced")

	// Session keyed to the old secret must be deleted.
	_, err = ss.Session().Get(rctx, session.Token)
	require.Error(t, err, "session for old secret should be deleted after rotate")

	// Clean up.
	_ = ss.UserAccessToken().Delete(uat.Id)
}

func testUserAccessTokenGetExpiring(t *testing.T, rctx request.CTX, ss store.Store) {
	now := model.GetMillis()
	thresholds := []int{1, 3, 7}

	activeUser, err := ss.User().Save(rctx, &model.User{Email: MakeEmail(), Username: model.NewUsername()})
	require.NoError(t, err)

	// Token expiring inside the 7-day window, never notified.
	inWindow := &model.UserAccessToken{Token: model.NewId(), UserId: activeUser.Id, Description: "in-window", ExpiresAt: now + 5*dayMillisTest}
	_, err = ss.UserAccessToken().Save(inWindow)
	require.NoError(t, err)

	// Token expiring beyond the horizon.
	beyond := &model.UserAccessToken{Token: model.NewId(), UserId: activeUser.Id, Description: "beyond", ExpiresAt: now + 30*dayMillisTest}
	_, err = ss.UserAccessToken().Save(beyond)
	require.NoError(t, err)

	// Already-expired token.
	past := &model.UserAccessToken{Token: model.NewId(), UserId: activeUser.Id, Description: "past", ExpiresAt: now - 60*1000}
	_, err = ss.UserAccessToken().Save(past)
	require.NoError(t, err)

	// Non-expiring token.
	nonExpiring := &model.UserAccessToken{Token: model.NewId(), UserId: activeUser.Id, Description: "non-expiring"}
	_, err = ss.UserAccessToken().Save(nonExpiring)
	require.NoError(t, err)

	// Token with 12h left that was already warned within the last day (i.e. at the
	// terminal 1-day bucket): excluded.
	terminal := &model.UserAccessToken{Token: model.NewId(), UserId: activeUser.Id, Description: "terminal", ExpiresAt: now + 12*60*60*1000}
	_, err = ss.UserAccessToken().Save(terminal)
	require.NoError(t, err)
	require.NoError(t, ss.UserAccessToken().UpdateLastNotifiedAt(terminal.Id, now))

	// Token warned at the 7-day mark (when 7 days remained) but now inside the
	// 3-day window: still returned, because the 3-day bucket hasn't been covered.
	stillNotify := &model.UserAccessToken{Token: model.NewId(), UserId: activeUser.Id, Description: "still-notify", ExpiresAt: now + 2*dayMillisTest}
	_, err = ss.UserAccessToken().Save(stillNotify)
	require.NoError(t, err)
	stillNotifyAt := stillNotify.ExpiresAt - 7*dayMillisTest
	require.NoError(t, ss.UserAccessToken().UpdateLastNotifiedAt(stillNotify.Id, stillNotifyAt))

	// Deactivated user with an in-window token: excluded.
	deletedUser := &model.User{Email: MakeEmail(), Username: model.NewUsername()}
	_, err = ss.User().Save(rctx, deletedUser)
	require.NoError(t, err)
	deletedUser.DeleteAt = model.GetMillis()
	_, err = ss.User().Update(rctx, deletedUser, true)
	require.NoError(t, err)
	deactivatedToken := &model.UserAccessToken{Token: model.NewId(), UserId: deletedUser.Id, Description: "deactivated", ExpiresAt: now + 5*dayMillisTest}
	_, err = ss.UserAccessToken().Save(deactivatedToken)
	require.NoError(t, err)

	// Bot with an in-window token: excluded.
	botUser, err := ss.User().Save(rctx, model.UserFromBot(&model.Bot{Username: model.NewUsername(), OwnerId: activeUser.Id}))
	require.NoError(t, err)
	_, nErr := ss.Bot().Save(&model.Bot{UserId: botUser.Id, Username: botUser.Username, OwnerId: activeUser.Id})
	require.NoError(t, nErr)
	botToken := &model.UserAccessToken{Token: model.NewId(), UserId: botUser.Id, Description: "bot", ExpiresAt: now + 5*dayMillisTest}
	_, err = ss.UserAccessToken().Save(botToken)
	require.NoError(t, err)

	t.Cleanup(func() {
		for _, id := range []string{inWindow.Id, beyond.Id, past.Id, nonExpiring.Id, terminal.Id, stillNotify.Id, deactivatedToken.Id, botToken.Id} {
			_ = ss.UserAccessToken().Delete(id)
		}
		_ = ss.Bot().PermanentDelete(botUser.Id)
		_ = ss.User().PermanentDelete(rctx, botUser.Id)
		_ = ss.User().PermanentDelete(rctx, activeUser.Id)
		_ = ss.User().PermanentDelete(rctx, deletedUser.Id)
	})

	rows, err := ss.UserAccessToken().GetExpiringTokens(now, thresholds, 100)
	require.NoError(t, err)

	got := make(map[string]*model.UserAccessToken)
	for _, row := range rows {
		got[row.Id] = row
		require.Empty(t, row.Token, "GetExpiringTokens must never return the secret Token value")
	}

	require.Contains(t, got, inWindow.Id, "in-window token should be returned")
	require.Contains(t, got, stillNotify.Id, "token warned at 7 days but now inside the 3-day window should still be returned")
	require.NotContains(t, got, beyond.Id, "token beyond the horizon must not be returned")
	require.NotContains(t, got, past.Id, "already-expired token must not be returned")
	require.NotContains(t, got, nonExpiring.Id, "non-expiring token must not be returned")
	require.NotContains(t, got, terminal.Id, "token already warned within the terminal bucket must not be returned")
	require.NotContains(t, got, deactivatedToken.Id, "token owned by a deactivated user must not be returned")
	require.NotContains(t, got, botToken.Id, "bot token must not be returned")

	require.Nil(t, got[inWindow.Id].LastNotifiedAt)
	require.NotNil(t, got[stillNotify.Id].LastNotifiedAt)
	require.Equal(t, stillNotifyAt, *got[stillNotify.Id].LastNotifiedAt)

	// Results must be ordered by ExpiresAt ascending (most urgent first); the
	// worker relies on this to drain a batch in expiry order. stillNotify (2d)
	// must come before inWindow (5d), and the slice must be non-decreasing.
	var prev int64
	for i, row := range rows {
		if i > 0 {
			require.GreaterOrEqual(t, row.ExpiresAt, prev, "GetExpiringTokens must return rows in ExpiresAt ascending order")
		}
		prev = row.ExpiresAt
	}
	require.Less(t, indexOfToken(rows, stillNotify.Id), indexOfToken(rows, inWindow.Id), "sooner-expiring token must be returned first")

	// Non-positive limit and empty thresholds short-circuit.
	zero, err := ss.UserAccessToken().GetExpiringTokens(now, thresholds, 0)
	require.NoError(t, err)
	require.Empty(t, zero)
	neg, err := ss.UserAccessToken().GetExpiringTokens(now, thresholds, -3)
	require.NoError(t, err)
	require.Empty(t, neg)
	none, err := ss.UserAccessToken().GetExpiringTokens(now, nil, 100)
	require.NoError(t, err)
	require.Empty(t, none)
}

func indexOfToken(tokens []*model.UserAccessToken, id string) int {
	for i, token := range tokens {
		if token.Id == id {
			return i
		}
	}
	return -1
}

func testUserAccessTokenUpdateLastNotifiedAt(t *testing.T, rctx request.CTX, ss store.Store) {
	token := &model.UserAccessToken{
		Token:       model.NewId(),
		UserId:      model.NewId(),
		Description: "notified-at",
		ExpiresAt:   model.GetMillis() + dayMillisTest,
	}
	_, err := ss.UserAccessToken().Save(token)
	require.NoError(t, err)
	t.Cleanup(func() { _ = ss.UserAccessToken().Delete(token.Id) })

	// A freshly saved token has no last-notified time set (NULL -> nil).
	stored, err := ss.UserAccessToken().Get(token.Id)
	require.NoError(t, err)
	require.Nil(t, stored.LastNotifiedAt)

	first := model.GetMillis()
	require.NoError(t, ss.UserAccessToken().UpdateLastNotifiedAt(token.Id, first))
	stored, err = ss.UserAccessToken().Get(token.Id)
	require.NoError(t, err)
	require.NotNil(t, stored.LastNotifiedAt)
	require.Equal(t, first, *stored.LastNotifiedAt)

	// A later warning advances the timestamp.
	second := first + dayMillisTest
	require.NoError(t, ss.UserAccessToken().UpdateLastNotifiedAt(token.Id, second))
	stored, err = ss.UserAccessToken().Get(token.Id)
	require.NoError(t, err)
	require.NotNil(t, stored.LastNotifiedAt)
	require.Equal(t, second, *stored.LastNotifiedAt)
}

const dayMillisTest = int64(24 * 60 * 60 * 1000)

func testUserAccessTokenNonCompliant(t *testing.T, rctx request.CTX, ss store.Store) {
	now := model.GetMillis()
	day := int64(24 * 60 * 60 * 1000)
	// maxExpiresAt is the latest expiry a 30-day policy permits.
	maxExpiresAt := now + 30*day
	// farCap is a much larger cap: only never-expiring tokens violate it.
	farCap := now + 1000*day

	// The store counts non-compliant tokens DB-wide and other suite fixtures may
	// linger, so assert deltas against a baseline rather than absolute totals.
	baseline30, err := ss.UserAccessToken().CountNonCompliantExpiry(maxExpiresAt)
	require.NoError(t, err)
	baselineFar, err := ss.UserAccessToken().CountNonCompliantExpiry(farCap)
	require.NoError(t, err)

	// Never-expiring active token — non-compliant.
	noExpiry := &model.UserAccessToken{Token: model.NewId(), UserId: model.NewId(), Description: "no expiry"}
	_, err = ss.UserAccessToken().Save(noExpiry)
	require.NoError(t, err)

	// Active token expiring beyond the cap — non-compliant.
	farFuture := &model.UserAccessToken{Token: model.NewId(), UserId: model.NewId(), Description: "far future", ExpiresAt: now + 60*day}
	_, err = ss.UserAccessToken().Save(farFuture)
	require.NoError(t, err)

	// Active token expiring within the cap — compliant.
	compliant := &model.UserAccessToken{Token: model.NewId(), UserId: model.NewId(), Description: "compliant", ExpiresAt: now + 10*day}
	_, err = ss.UserAccessToken().Save(compliant)
	require.NoError(t, err)

	// Disabled never-expiring token — non-compliant by expiry, but inactive
	// tokens cannot authenticate and are excluded.
	inactive := &model.UserAccessToken{Token: model.NewId(), UserId: model.NewId(), Description: "inactive"}
	_, err = ss.UserAccessToken().Save(inactive)
	require.NoError(t, err)
	require.NoError(t, ss.UserAccessToken().UpdateTokenDisable(inactive.Id))

	// Never-expiring token owned by a bot — bots are exempt and excluded.
	botUser, err := ss.User().Save(rctx, model.UserFromBot(&model.Bot{Username: "noncompliant_bot", OwnerId: model.NewId()}))
	require.NoError(t, err)
	_, nErr := ss.Bot().Save(&model.Bot{UserId: botUser.Id, Username: botUser.Username, OwnerId: model.NewId()})
	require.NoError(t, nErr)
	botToken := &model.UserAccessToken{Token: model.NewId(), UserId: botUser.Id, Description: "bot token"}
	_, err = ss.UserAccessToken().Save(botToken)
	require.NoError(t, err)

	// Two non-compliant tokens owned by the same user — verifies that the
	// returned slice has one entry per deleted token row, not one per user.
	sharedUserID := model.NewId()
	multiA := &model.UserAccessToken{Token: model.NewId(), UserId: sharedUserID, Description: "multi A"}
	_, err = ss.UserAccessToken().Save(multiA)
	require.NoError(t, err)
	multiB := &model.UserAccessToken{Token: model.NewId(), UserId: sharedUserID, Description: "multi B", ExpiresAt: now + 60*day}
	_, err = ss.UserAccessToken().Save(multiB)
	require.NoError(t, err)

	// Sessions minted from the non-compliant tokens — DeleteNonCompliantExpiry
	// must remove these along with the tokens.
	noExpirySession, nErr := ss.Session().Save(rctx, &model.Session{Token: noExpiry.Token, UserId: noExpiry.UserId})
	require.NoError(t, nErr)
	farFutureSession, nErr := ss.Session().Save(rctx, &model.Session{Token: farFuture.Token, UserId: farFuture.UserId})
	require.NoError(t, nErr)

	t.Cleanup(func() {
		// noExpiry, farFuture, multiA, multiB are deleted by DeleteNonCompliantExpiry;
		// only surviving tokens need explicit cleanup.
		_ = ss.UserAccessToken().Delete(compliant.Id)
		_ = ss.UserAccessToken().Delete(inactive.Id)
		_ = ss.UserAccessToken().Delete(botToken.Id)
		_ = ss.Bot().PermanentDelete(botUser.Id)
		_ = ss.User().PermanentDelete(rctx, botUser.Id)
	})

	// Against the 30-day cap, at least our four active non-bot violators are counted.
	// Use GreaterOrEqual to avoid flakiness from concurrent tests that may also
	// hold non-compliant tokens when this test runs.
	count, err := ss.UserAccessToken().CountNonCompliantExpiry(maxExpiresAt)
	require.NoError(t, err)
	require.GreaterOrEqual(t, count, baseline30+4)

	// A non-positive limit is a no-op.
	noop, err := ss.UserAccessToken().DeleteNonCompliantExpiry(maxExpiresAt, 0)
	require.NoError(t, err)
	require.Empty(t, noop)

	// DeleteNonCompliantExpiry deletes all violators and their sessions, returns
	// one UserId per deleted token row (not per user), and leaves
	// compliant/inactive/bot tokens untouched.
	// Use GreaterOrEqual for the same reason as the count check above.
	userIDs, err := ss.UserAccessToken().DeleteNonCompliantExpiry(maxExpiresAt, 10000)
	require.NoError(t, err)
	require.GreaterOrEqual(t, len(userIDs), 4, "should return at least our four deleted tokens")
	// Verify sharedUserID appears exactly twice — once per token, not once per user.
	// This specifically guards against a SELECT DISTINCT regression.
	sharedOccurrences := 0
	gotUserIDs := map[string]bool{}
	for _, id := range userIDs {
		gotUserIDs[id] = true
		if id == sharedUserID {
			sharedOccurrences++
		}
	}
	require.Equal(t, 2, sharedOccurrences, "sharedUserID should appear once per deleted token, not once per user")
	require.True(t, gotUserIDs[noExpiry.UserId], "user of never-expiring token should be returned")
	require.True(t, gotUserIDs[farFuture.UserId], "user of far-future token should be returned")
	require.True(t, gotUserIDs[sharedUserID], "shared user with multiple tokens should be returned")
	require.False(t, gotUserIDs[compliant.UserId], "compliant token user must not be returned")
	require.False(t, gotUserIDs[inactive.UserId], "inactive token user must not be returned")
	require.False(t, gotUserIDs[botToken.UserId], "bot token user must not be returned")

	// Token rows are gone.
	_, err = ss.UserAccessToken().Get(noExpiry.Id)
	require.Error(t, err, "never-expiring token should be deleted")
	_, err = ss.UserAccessToken().Get(farFuture.Id)
	require.Error(t, err, "far-future token should be deleted")
	_, err = ss.UserAccessToken().Get(multiA.Id)
	require.Error(t, err, "shared-user token A should be deleted")
	_, err = ss.UserAccessToken().Get(multiB.Id)
	require.Error(t, err, "shared-user token B should be deleted")

	// Sessions for deleted tokens are gone.
	_, nErr = ss.Session().Get(rctx, noExpirySession.Token)
	require.Error(t, nErr, "session for never-expiring token should be deleted")
	_, nErr = ss.Session().Get(rctx, farFutureSession.Token)
	require.Error(t, nErr, "session for far-future token should be deleted")

	// Surviving tokens are untouched.
	_, err = ss.UserAccessToken().Get(compliant.Id)
	require.NoError(t, err, "compliant token must survive")
	_, err = ss.UserAccessToken().Get(inactive.Id)
	require.NoError(t, err, "inactive token must survive")
	_, err = ss.UserAccessToken().Get(botToken.Id)
	require.NoError(t, err, "bot token must survive")

	// Count is back to at most baseline after deletion (could be lower if our
	// delete swept up tokens from other concurrent tests; could equal baseline if
	// no concurrent tests hold non-compliant tokens right now).
	count, err = ss.UserAccessToken().CountNonCompliantExpiry(maxExpiresAt)
	require.NoError(t, err)
	require.LessOrEqual(t, count, baseline30)

	// Against the much larger cap, the never-expiring tokens were the only
	// violators among our fixtures; after deletion the count should not exceed
	// the baseline measured before we created anything.
	count, err = ss.UserAccessToken().CountNonCompliantExpiry(farCap)
	require.NoError(t, err)
	require.LessOrEqual(t, count, baselineFar, "count under large cap must not exceed pre-test baseline")
}
