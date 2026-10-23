// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"fmt"
	"math/rand/v2"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func newTestBotEventSubscription() *model.BotEventSubscription {
	return &model.BotEventSubscription{
		BotUserId:        model.NewId(),
		Mode:             model.BotEventSubscriptionModePull,
		Secret:           model.NewRandomString(model.BotEventSecretLength),
		IgnoreBotAuthors: true,
		Enabled:          true,
	}
}

func saveTestBotEventSubscription(t *testing.T, rctx request.CTX, ss store.Store) *model.BotEventSubscription {
	t.Helper()
	sub, err := ss.BotEventSubscription().Save(rctx, newTestBotEventSubscription())
	require.NoError(t, err)
	return sub
}

func TestBotEventSubscriptionStore(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	t.Run("SaveGetUpdateDelete", func(t *testing.T) { testBotEventSubscriptionCRUD(t, rctx, ss) })
	t.Run("MissingSubscription", func(t *testing.T) { testBotEventSubscriptionMissing(t, rctx, ss) })
	t.Run("GetForBots", func(t *testing.T) { testBotEventSubscriptionGetForBots(t, rctx, ss) })
	t.Run("SetEnabled", func(t *testing.T) { testBotEventSubscriptionSetEnabled(t, rctx, ss, s) })
	t.Run("Delete", func(t *testing.T) { testBotEventSubscriptionDelete(t, rctx, ss) })
	t.Run("AdvanceAckCursor", func(t *testing.T) { testBotEventSubscriptionAdvanceCursor(t, rctx, ss) })
	t.Run("AdvanceAckCursorConcurrently", func(t *testing.T) { testBotEventSubscriptionAdvanceCursorConcurrently(t, rctx, ss) })
	t.Run("UpdateResetsFailureWindow", func(t *testing.T) { testBotEventSubscriptionUpdateResetsFailures(t, rctx, ss, s) })
	t.Run("ClaimForDelivery", func(t *testing.T) { testBotEventSubscriptionClaim(t, rctx, ss, s) })
	t.Run("ClaimContention", func(t *testing.T) { testBotEventSubscriptionClaimContention(t, rctx, ss) })
	t.Run("ReleaseLease", func(t *testing.T) { testBotEventSubscriptionReleaseLease(t, rctx, ss) })
	t.Run("RecordDeliverySuccess", func(t *testing.T) { testBotEventSubscriptionRecordSuccess(t, rctx, ss, s) })
	t.Run("RecordDeliveryFailure", func(t *testing.T) { testBotEventSubscriptionRecordFailure(t, rctx, ss) })
	t.Run("GetPushDeliveryCandidates", func(t *testing.T) { testBotEventSubscriptionCandidates(t, rctx, ss, s) })
}

// savePushSubscription saves an enabled push subscription for a new active bot user.
func savePushSubscription(t *testing.T, rctx request.CTX, ss store.Store) *model.BotEventSubscription {
	t.Helper()
	id := model.NewId()
	user, err := ss.User().Save(rctx, &model.User{Email: id + "@example.com", Username: "bot" + id[:10], Password: "pass"})
	require.NoError(t, err)

	sub := newTestBotEventSubscription()
	sub.BotUserId = user.Id
	sub.Mode = model.BotEventSubscriptionModePush
	sub.CallbackURL = "https://example.com/hook"
	sub, err = ss.BotEventSubscription().Save(rctx, sub)
	require.NoError(t, err)
	return sub
}

func claimTestSubscription(t *testing.T, rctx request.CTX, ss store.Store, botID, node string, leaseMillis, now int64) *model.BotEventSubscription {
	t.Helper()
	sub, err := ss.BotEventSubscription().ClaimForDelivery(rctx, botID, node, leaseMillis, now)
	require.NoError(t, err)
	return sub
}

func testBotEventSubscriptionUpdateResetsFailures(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	failures := func(sub *model.BotEventSubscription) (int, int64, int64) {
		got, err := ss.BotEventSubscription().Get(rctx, sub.BotUserId)
		require.NoError(t, err)
		return got.ConsecutiveFailures, got.FirstFailureAt, got.NextAttemptAt
	}
	seed := func(sub *model.BotEventSubscription) {
		_, err := s.GetMaster().Exec("UPDATE BotEventSubscriptions SET ConsecutiveFailures = 3, FirstFailureAt = 100, NextAttemptAt = 200 WHERE BotUserId = ?", sub.BotUserId)
		require.NoError(t, err)
	}

	sub := savePushSubscription(t, rctx, ss)
	seed(sub)

	sub.IgnoreBotAuthors = !sub.IgnoreBotAuthors
	_, err := ss.BotEventSubscription().Update(rctx, sub)
	require.NoError(t, err)
	n, first, next := failures(sub)
	assert.Equal(t, 3, n, "an ignore_bot_authors change keeps the failure window")
	assert.Equal(t, int64(100), first)
	assert.Equal(t, int64(200), next)

	sub.CallbackURL = "https://example.com/other"
	_, err = ss.BotEventSubscription().Update(rctx, sub)
	require.NoError(t, err)
	n, first, next = failures(sub)
	assert.Zero(t, n, "a URL change resets the failure window")
	assert.Zero(t, first)
	assert.Zero(t, next)

	seed(sub)
	sub.Mode = model.BotEventSubscriptionModePull
	sub.CallbackURL = ""
	_, err = ss.BotEventSubscription().Update(rctx, sub)
	require.NoError(t, err)
	n, _, _ = failures(sub)
	assert.Zero(t, n, "a mode change resets the failure window")
}

func testBotEventSubscriptionClaim(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	const lease = 60_000
	now := botEventDBNow(t, s)

	t.Run("claims a free row and returns the delivery state", func(t *testing.T) {
		sub := savePushSubscription(t, rctx, ss)
		claimed := claimTestSubscription(t, rctx, ss, sub.BotUserId, "node-a", lease, now)
		require.NotNil(t, claimed)
		assert.Equal(t, sub.Secret, claimed.Secret)
		assert.Equal(t, sub.CallbackURL, claimed.CallbackURL)
		assert.Equal(t, "node-a", claimed.LeaseNode)
		assert.Greater(t, claimed.LeaseExpiresAt, now)
	})

	t.Run("the owner renews and another node waits", func(t *testing.T) {
		sub := savePushSubscription(t, rctx, ss)
		first := claimTestSubscription(t, rctx, ss, sub.BotUserId, "node-a", lease, now)
		require.NotNil(t, first)

		renewed := claimTestSubscription(t, rctx, ss, sub.BotUserId, "node-a", lease, now)
		require.NotNil(t, renewed)
		assert.GreaterOrEqual(t, renewed.LeaseExpiresAt, first.LeaseExpiresAt)

		assert.Nil(t, claimTestSubscription(t, rctx, ss, sub.BotUserId, "node-b", lease, now))
	})

	t.Run("an expired lease can be taken over", func(t *testing.T) {
		sub := savePushSubscription(t, rctx, ss)
		require.NotNil(t, claimTestSubscription(t, rctx, ss, sub.BotUserId, "node-a", 1, now))
		require.Eventually(t, func() bool {
			return claimTestSubscription(t, rctx, ss, sub.BotUserId, "node-b", lease, now) != nil
		}, 5*time.Second, 10*time.Millisecond)
	})

	t.Run("does not claim what cannot be delivered", func(t *testing.T) {
		missing := claimTestSubscription(t, rctx, ss, model.NewId(), "node-a", lease, now)
		assert.Nil(t, missing)

		pull := savePushSubscription(t, rctx, ss)
		pull.Mode = model.BotEventSubscriptionModePull
		pull.CallbackURL = ""
		_, err := ss.BotEventSubscription().Update(rctx, pull)
		require.NoError(t, err)
		assert.Nil(t, claimTestSubscription(t, rctx, ss, pull.BotUserId, "node-a", lease, now), "pull mode")

		disabled := savePushSubscription(t, rctx, ss)
		require.NoError(t, ss.BotEventSubscription().SetEnabled(rctx, disabled.BotUserId, false, model.BotEventDisabledReasonManual, now))
		assert.Nil(t, claimTestSubscription(t, rctx, ss, disabled.BotUserId, "node-a", lease, now), "disabled")

		backoff := savePushSubscription(t, rctx, ss)
		_, err = s.GetMaster().Exec("UPDATE BotEventSubscriptions SET NextAttemptAt = ? WHERE BotUserId = ?", now+1, backoff.BotUserId)
		require.NoError(t, err)
		assert.Nil(t, claimTestSubscription(t, rctx, ss, backoff.BotUserId, "node-a", lease, now), "backing off")
		assert.NotNil(t, claimTestSubscription(t, rctx, ss, backoff.BotUserId, "node-a", lease, now+1), "due")

		deactivated := savePushSubscription(t, rctx, ss)
		_, err = s.GetMaster().Exec("UPDATE Users SET DeleteAt = ? WHERE Id = ?", now, deactivated.BotUserId)
		require.NoError(t, err)
		assert.Nil(t, claimTestSubscription(t, rctx, ss, deactivated.BotUserId, "node-a", lease, now), "deactivated bot")
	})
}

func testBotEventSubscriptionClaimContention(t *testing.T, rctx request.CTX, ss store.Store) {
	sub := savePushSubscription(t, rctx, ss)

	const nodes = 20
	var winners atomic.Int32
	var wg sync.WaitGroup
	for i := range nodes {
		wg.Go(func() {
			claimed, err := ss.BotEventSubscription().ClaimForDelivery(rctx, sub.BotUserId, fmt.Sprintf("node-%d", i), 60_000, model.GetMillis())
			assert.NoError(t, err)
			if claimed != nil {
				winners.Add(1)
			}
		})
	}
	wg.Wait()
	assert.Equal(t, int32(1), winners.Load())
}

func testBotEventSubscriptionReleaseLease(t *testing.T, rctx request.CTX, ss store.Store) {
	sub := savePushSubscription(t, rctx, ss)
	require.NotNil(t, claimTestSubscription(t, rctx, ss, sub.BotUserId, "node-a", 60_000, model.GetMillis()))

	require.NoError(t, ss.BotEventSubscription().ReleaseLease(rctx, sub.BotUserId, "node-b"))
	assert.Nil(t, claimTestSubscription(t, rctx, ss, sub.BotUserId, "node-b", 60_000, model.GetMillis()), "another node cannot release the lease")

	require.NoError(t, ss.BotEventSubscription().ReleaseLease(rctx, sub.BotUserId, "node-a"))
	assert.NotNil(t, claimTestSubscription(t, rctx, ss, sub.BotUserId, "node-b", 60_000, model.GetMillis()))

	require.NoError(t, ss.BotEventSubscription().ReleaseLease(rctx, model.NewId(), "node-a"), "a missing row is not an error")
}

func testBotEventSubscriptionRecordSuccess(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	sub := savePushSubscription(t, rctx, ss)
	_, err := s.GetMaster().Exec("UPDATE BotEventSubscriptions SET ConsecutiveFailures = 2, FirstFailureAt = 100, NextAttemptAt = 200 WHERE BotUserId = ?", sub.BotUserId)
	require.NoError(t, err)

	cursor := model.BotEventCursor{CreateAt: 500, Id: model.NewId()}
	require.NoError(t, ss.BotEventSubscription().RecordDeliverySuccess(rctx, sub.BotUserId, cursor, 999))
	got, err := ss.BotEventSubscription().Get(rctx, sub.BotUserId)
	require.NoError(t, err)
	assert.Equal(t, cursor, got.AckCursor())
	assert.Equal(t, int64(999), got.LastDeliveredAt)
	assert.Zero(t, got.ConsecutiveFailures)
	assert.Zero(t, got.FirstFailureAt)
	assert.Zero(t, got.NextAttemptAt)

	_, err = s.GetMaster().Exec("UPDATE BotEventSubscriptions SET ConsecutiveFailures = 2 WHERE BotUserId = ?", sub.BotUserId)
	require.NoError(t, err)
	for _, older := range []model.BotEventCursor{cursor, {CreateAt: 499, Id: cursor.Id}} {
		require.NoError(t, ss.BotEventSubscription().RecordDeliverySuccess(rctx, sub.BotUserId, older, 1000))
	}
	got, err = ss.BotEventSubscription().Get(rctx, sub.BotUserId)
	require.NoError(t, err)
	assert.Equal(t, cursor, got.AckCursor(), "an older or equal cursor is a no-op")
	assert.Equal(t, 2, got.ConsecutiveFailures, "a no-op does not reset failures")
	assert.Equal(t, int64(999), got.LastDeliveredAt)
}

func testBotEventSubscriptionRecordFailure(t *testing.T, rctx request.CTX, ss store.Store) {
	failure := model.BotEventDeliveryFailure{ConsecutiveFailures: 2, FirstFailureAt: 100, NextAttemptAt: 300, UpdateAt: 400}

	t.Run("applies under the callers lease and releases it", func(t *testing.T) {
		sub := savePushSubscription(t, rctx, ss)
		require.NotNil(t, claimTestSubscription(t, rctx, ss, sub.BotUserId, "node-a", 60_000, 0))

		applied, err := ss.BotEventSubscription().RecordDeliveryFailure(rctx, sub.BotUserId, "node-a", failure)
		require.NoError(t, err)
		assert.True(t, applied)

		got, err := ss.BotEventSubscription().Get(rctx, sub.BotUserId)
		require.NoError(t, err)
		assert.Equal(t, 2, got.ConsecutiveFailures)
		assert.Equal(t, int64(100), got.FirstFailureAt)
		assert.Equal(t, int64(300), got.NextAttemptAt)
		assert.Empty(t, got.LeaseNode)
		assert.Zero(t, got.LeaseExpiresAt)
		assert.True(t, got.Enabled)
	})

	t.Run("is not applied without the lease", func(t *testing.T) {
		sub := savePushSubscription(t, rctx, ss)
		require.NotNil(t, claimTestSubscription(t, rctx, ss, sub.BotUserId, "node-a", 60_000, 0))

		applied, err := ss.BotEventSubscription().RecordDeliveryFailure(rctx, sub.BotUserId, "node-b", failure)
		require.NoError(t, err)
		assert.False(t, applied)

		got, err := ss.BotEventSubscription().Get(rctx, sub.BotUserId)
		require.NoError(t, err)
		assert.Zero(t, got.ConsecutiveFailures)
		assert.Equal(t, "node-a", got.LeaseNode)
	})

	t.Run("disables with a reason", func(t *testing.T) {
		sub := savePushSubscription(t, rctx, ss)
		require.NotNil(t, claimTestSubscription(t, rctx, ss, sub.BotUserId, "node-a", 60_000, 0))

		failure.DisabledReason = model.BotEventDisabledReasonCallbackGone
		applied, err := ss.BotEventSubscription().RecordDeliveryFailure(rctx, sub.BotUserId, "node-a", failure)
		require.NoError(t, err)
		assert.True(t, applied)

		got, err := ss.BotEventSubscription().Get(rctx, sub.BotUserId)
		require.NoError(t, err)
		assert.False(t, got.Enabled)
		assert.Equal(t, model.BotEventDisabledReasonCallbackGone, got.DisabledReason)
		assert.Equal(t, int64(400), got.UpdateAt)

		applied, err = ss.BotEventSubscription().RecordDeliveryFailure(rctx, sub.BotUserId, "node-a", failure)
		require.NoError(t, err)
		assert.False(t, applied, "a disabled subscription is not written again")
	})
}

func testBotEventSubscriptionCandidates(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	now := botEventDBNow(t, s)
	old := now - 10_000

	// withEvent saves a push subscription with one event created at the given time.
	withEvent := func(createAt int64) *model.BotEventSubscription {
		sub := savePushSubscription(t, rctx, ss)
		saveTestBotEvents(t, rctx, ss, newTestBotEvent(sub.BotUserId, createAt))
		return sub
	}
	candidates := func(limit int) []string {
		ids, err := ss.BotEventSubscription().GetPushDeliveryCandidates(rctx, now, model.BotEventSettleWindowMillis, limit)
		require.NoError(t, err)
		return ids
	}
	exec := func(query string, args ...any) {
		_, err := s.GetMaster().Exec(query, args...)
		require.NoError(t, err)
	}

	ready := withEvent(old)
	unsettled := withEvent(now + 60_000)
	acked := withEvent(old)
	exec("UPDATE BotEventSubscriptions SET AckCursorCreateAt = ?, AckCursorId = ? WHERE BotUserId = ?", old, "zzzzzzzzzzzzzzzzzzzzzzzzzz", acked.BotUserId)
	noEvents := savePushSubscription(t, rctx, ss)
	disabled := withEvent(old)
	require.NoError(t, ss.BotEventSubscription().SetEnabled(rctx, disabled.BotUserId, false, model.BotEventDisabledReasonManual, now))
	backoff := withEvent(old)
	exec("UPDATE BotEventSubscriptions SET NextAttemptAt = ? WHERE BotUserId = ?", now+60_000, backoff.BotUserId)
	leased := withEvent(old)
	require.NotNil(t, claimTestSubscription(t, rctx, ss, leased.BotUserId, "node-a", 60_000, now))
	deactivated := withEvent(old)
	exec("UPDATE Users SET DeleteAt = ? WHERE Id = ?", now, deactivated.BotUserId)
	pull := withEvent(old)
	exec("UPDATE BotEventSubscriptions SET Mode = 'pull', CallbackURL = '' WHERE BotUserId = ?", pull.BotUserId)

	got := candidates(1000)
	assert.Contains(t, got, ready.BotUserId)
	for name, excluded := range map[string]*model.BotEventSubscription{
		"unsettled event": unsettled, "fully acknowledged": acked, "no events": noEvents, "disabled": disabled,
		"backing off": backoff, "leased": leased, "deactivated bot": deactivated, "pull mode": pull,
	} {
		assert.NotContains(t, got, excluded.BotUserId, name)
	}

	t.Run("an expired lease is a candidate again", func(t *testing.T) {
		exec("UPDATE BotEventSubscriptions SET LeaseExpiresAt = 1 WHERE BotUserId = ?", leased.BotUserId)
		assert.Contains(t, candidates(1000), leased.BotUserId)
	})

	t.Run("respects the limit", func(t *testing.T) {
		assert.Len(t, candidates(1), 1)
	})
}

func testBotEventSubscriptionCRUD(t *testing.T, rctx request.CTX, ss store.Store) {
	saved := saveTestBotEventSubscription(t, rctx, ss)
	assert.NotZero(t, saved.CreateAt)
	assert.NotZero(t, saved.UpdateAt)

	got, err := ss.BotEventSubscription().Get(rctx, saved.BotUserId)
	require.NoError(t, err)
	assert.Equal(t, saved.Secret, got.Secret)
	assert.Equal(t, model.BotEventSubscriptionModePull, got.Mode)
	assert.True(t, got.IgnoreBotAuthors)
	assert.True(t, got.Enabled)
	assert.Equal(t, saved.CreateAt, got.CreateAt)
	assert.Equal(t, model.BotEventCursor{}, got.AckCursor())
	assert.Nil(t, got.BacklogSize)

	t.Run("duplicate save conflicts", func(t *testing.T) {
		dup := newTestBotEventSubscription()
		dup.BotUserId = saved.BotUserId
		_, err := ss.BotEventSubscription().Save(rctx, dup)
		var conflictErr *store.ErrConflict
		require.ErrorAs(t, err, &conflictErr)
	})

	t.Run("invalid subscription is rejected", func(t *testing.T) {
		invalid := newTestBotEventSubscription()
		invalid.Secret = "short"
		_, err := ss.BotEventSubscription().Save(rctx, invalid)
		require.Error(t, err)
	})

	t.Run("update changes mutable fields only", func(t *testing.T) {
		got.Mode = model.BotEventSubscriptionModePush
		got.CallbackURL = "https://example.com/hook"
		got.IgnoreBotAuthors = false
		got.Secret = model.NewRandomString(model.BotEventSecretLength)
		got.Enabled = false

		_, err := ss.BotEventSubscription().Update(rctx, got)
		require.NoError(t, err)

		after, err := ss.BotEventSubscription().Get(rctx, saved.BotUserId)
		require.NoError(t, err)
		assert.Equal(t, model.BotEventSubscriptionModePush, after.Mode)
		assert.Equal(t, "https://example.com/hook", after.CallbackURL)
		assert.False(t, after.IgnoreBotAuthors)
		assert.Equal(t, saved.Secret, after.Secret, "update must not touch the secret")
		assert.True(t, after.Enabled, "update must not touch enabled")
		assert.GreaterOrEqual(t, after.UpdateAt, saved.UpdateAt)
		assert.Equal(t, saved.CreateAt, after.CreateAt)
	})

	t.Run("update secret", func(t *testing.T) {
		secret := model.NewRandomString(model.BotEventSecretLength)
		require.NoError(t, ss.BotEventSubscription().UpdateSecret(rctx, saved.BotUserId, secret, model.GetMillis()))

		after, err := ss.BotEventSubscription().Get(rctx, saved.BotUserId)
		require.NoError(t, err)
		assert.Equal(t, secret, after.Secret)
	})

	t.Run("delete", func(t *testing.T) {
		require.NoError(t, ss.BotEventSubscription().Delete(rctx, saved.BotUserId))
		_, err := ss.BotEventSubscription().Get(rctx, saved.BotUserId)
		var nfErr *store.ErrNotFound
		require.ErrorAs(t, err, &nfErr)
	})
}

func testBotEventSubscriptionMissing(t *testing.T, rctx request.CTX, ss store.Store) {
	id := model.NewId()
	var nfErr *store.ErrNotFound

	_, err := ss.BotEventSubscription().Get(rctx, id)
	require.ErrorAs(t, err, &nfErr)

	sub := newTestBotEventSubscription()
	sub.PreSave()
	_, err = ss.BotEventSubscription().Update(rctx, sub)
	require.ErrorAs(t, err, &nfErr)

	err = ss.BotEventSubscription().UpdateSecret(rctx, id, model.NewRandomString(model.BotEventSecretLength), model.GetMillis())
	require.ErrorAs(t, err, &nfErr)

	err = ss.BotEventSubscription().SetEnabled(rctx, id, true, "", model.GetMillis())
	require.ErrorAs(t, err, &nfErr)

	require.NoError(t, ss.BotEventSubscription().Delete(rctx, id), "deleting a missing subscription is a no-op")

	advanced, err := ss.BotEventSubscription().AdvanceAckCursor(rctx, id, model.BotEventCursor{CreateAt: 5, Id: model.NewId()}, 1)
	require.NoError(t, err)
	assert.False(t, advanced)
}

func testBotEventSubscriptionGetForBots(t *testing.T, rctx request.CTX, ss store.Store) {
	a := saveTestBotEventSubscription(t, rctx, ss)
	b := newTestBotEventSubscription()
	b.IgnoreBotAuthors = false
	b.Enabled = false
	b.DisabledReason = model.BotEventDisabledReasonManual
	b, err := ss.BotEventSubscription().Save(rctx, b)
	require.NoError(t, err)
	missing := model.NewId()

	t.Run("empty input", func(t *testing.T) {
		subs, err := ss.BotEventSubscription().GetForBots(rctx, nil)
		require.NoError(t, err)
		assert.Empty(t, subs)
	})

	t.Run("omits missing ids", func(t *testing.T) {
		subs, err := ss.BotEventSubscription().GetForBots(rctx, []string{a.BotUserId, b.BotUserId, a.BotUserId, missing})
		require.NoError(t, err)
		require.Len(t, subs, 2)

		byID := map[string]*model.BotEventSubscription{}
		for _, sub := range subs {
			byID[sub.BotUserId] = sub
		}
		require.Contains(t, byID, a.BotUserId)
		require.Contains(t, byID, b.BotUserId)

		assert.True(t, byID[a.BotUserId].IgnoreBotAuthors)
		assert.True(t, byID[a.BotUserId].Enabled)
		assert.False(t, byID[b.BotUserId].IgnoreBotAuthors)
		assert.False(t, byID[b.BotUserId].Enabled)
		assert.Equal(t, model.BotEventDisabledReasonManual, byID[b.BotUserId].DisabledReason)
		assert.Equal(t, model.BotEventSubscriptionModePull, byID[a.BotUserId].Mode)
	})

	t.Run("never returns the secret", func(t *testing.T) {
		subs, err := ss.BotEventSubscription().GetForBots(rctx, []string{a.BotUserId})
		require.NoError(t, err)
		require.Len(t, subs, 1)
		assert.Empty(t, subs[0].Secret)
	})
}

func testBotEventSubscriptionSetEnabled(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	saved := saveTestBotEventSubscription(t, rctx, ss)

	// Seed the push backoff state that re-enabling must reset.
	_, err := s.GetMaster().Exec("UPDATE BotEventSubscriptions SET ConsecutiveFailures = 4, FirstFailureAt = 100, NextAttemptAt = 200 WHERE BotUserId = ?", saved.BotUserId)
	require.NoError(t, err)

	require.NoError(t, ss.BotEventSubscription().SetEnabled(rctx, saved.BotUserId, false, model.BotEventDisabledReasonDeliveryFailures, model.GetMillis()))
	got, err := ss.BotEventSubscription().Get(rctx, saved.BotUserId)
	require.NoError(t, err)
	assert.False(t, got.Enabled)
	assert.Equal(t, model.BotEventDisabledReasonDeliveryFailures, got.DisabledReason)
	assert.Equal(t, 4, got.ConsecutiveFailures, "disabling keeps the failure state")

	require.NoError(t, ss.BotEventSubscription().SetEnabled(rctx, saved.BotUserId, true, "", model.GetMillis()))
	got, err = ss.BotEventSubscription().Get(rctx, saved.BotUserId)
	require.NoError(t, err)
	assert.True(t, got.Enabled)
	assert.Empty(t, got.DisabledReason)
	assert.Zero(t, got.ConsecutiveFailures)
	assert.Zero(t, got.FirstFailureAt)
	assert.Zero(t, got.NextAttemptAt)
}

func testBotEventSubscriptionDelete(t *testing.T, rctx request.CTX, ss store.Store) {
	a := saveTestBotEventSubscription(t, rctx, ss)
	b := saveTestBotEventSubscription(t, rctx, ss)

	for _, botID := range []string{a.BotUserId, b.BotUserId} {
		require.NoError(t, ss.BotEvent().Save(rctx, []*model.BotEvent{
			{Id: model.NewId(), BotUserId: botID, Type: model.BotEventTypePostDM, Payload: []byte(`{}`)},
			{Id: model.NewId(), BotUserId: botID, Type: model.BotEventTypePostDM, Payload: []byte(`{}`)},
		}))
	}

	require.NoError(t, ss.BotEventSubscription().Delete(rctx, a.BotUserId))

	count, err := ss.BotEvent().CountAfterCursor(rctx, a.BotUserId, model.BotEventCursor{})
	require.NoError(t, err)
	assert.Zero(t, count)

	count, err = ss.BotEvent().CountAfterCursor(rctx, b.BotUserId, model.BotEventCursor{})
	require.NoError(t, err)
	assert.Equal(t, int64(2), count)

	_, err = ss.BotEventSubscription().Get(rctx, b.BotUserId)
	require.NoError(t, err)
}

func testBotEventSubscriptionAdvanceCursor(t *testing.T, rctx request.CTX, ss store.Store) {
	saved := saveTestBotEventSubscription(t, rctx, ss)
	idLow, idHigh := model.NewId(), model.NewId()
	if idHigh < idLow {
		idLow, idHigh = idHigh, idLow
	}

	advance := func(c model.BotEventCursor) bool {
		ok, err := ss.BotEventSubscription().AdvanceAckCursor(rctx, saved.BotUserId, c, 12345)
		require.NoError(t, err)
		return ok
	}
	current := func() *model.BotEventSubscription {
		sub, err := ss.BotEventSubscription().Get(rctx, saved.BotUserId)
		require.NoError(t, err)
		return sub
	}

	base := model.BotEventCursor{CreateAt: 100, Id: idLow}
	assert.True(t, advance(base))
	assert.Equal(t, base, current().AckCursor())

	assert.False(t, advance(base), "equal cursor")
	assert.False(t, advance(model.BotEventCursor{CreateAt: 99, Id: idHigh}), "older create_at")
	assert.False(t, advance(model.BotEventCursor{}), "zero cursor")
	assert.Equal(t, base, current().AckCursor())

	if idLow != idHigh {
		assert.True(t, advance(model.BotEventCursor{CreateAt: 100, Id: idHigh}), "same create_at, larger id")
		assert.False(t, advance(base), "same create_at, smaller id")
	}

	newer := model.BotEventCursor{CreateAt: 101}
	assert.True(t, advance(newer))
	sub := current()
	assert.Equal(t, newer, sub.AckCursor())
	assert.Equal(t, int64(12345), sub.LastDeliveredAt)
	assert.Equal(t, saved.UpdateAt, sub.UpdateAt, "ack must not touch UpdateAt")
}

func testBotEventSubscriptionAdvanceCursorConcurrently(t *testing.T, rctx request.CTX, ss store.Store) {
	saved := saveTestBotEventSubscription(t, rctx, ss)

	const workers = 20
	const perWorker = 15

	cursors := make([]model.BotEventCursor, 0, workers*perWorker)
	for range workers * perWorker {
		cursors = append(cursors, model.BotEventCursor{CreateAt: rand.Int64N(1000) + 1, Id: model.NewId()})
	}
	maxCursor := cursors[0]
	for _, c := range cursors {
		if maxCursor.Less(c) {
			maxCursor = c
		}
	}

	done := make(chan struct{})
	var readerErr error
	var readerWG sync.WaitGroup
	readerWG.Go(func() {
		var last model.BotEventCursor
		for {
			select {
			case <-done:
				return
			default:
			}
			sub, err := ss.BotEventSubscription().Get(rctx, saved.BotUserId)
			if err != nil {
				readerErr = err
				return
			}
			cur := sub.AckCursor()
			if cur.Less(last) {
				readerErr = fmt.Errorf("cursor moved backwards from %v to %v", last, cur)
				return
			}
			last = cur
		}
	})

	var wg sync.WaitGroup
	for w := range workers {
		wg.Go(func() {
			for _, c := range cursors[w*perWorker : (w+1)*perWorker] {
				_, err := ss.BotEventSubscription().AdvanceAckCursor(rctx, saved.BotUserId, c, 1)
				assert.NoError(t, err)
			}
		})
	}
	wg.Wait()
	close(done)
	readerWG.Wait()

	require.NoError(t, readerErr)
	sub, err := ss.BotEventSubscription().Get(rctx, saved.BotUserId)
	require.NoError(t, err)
	assert.Equal(t, maxCursor, sub.AckCursor())
}
