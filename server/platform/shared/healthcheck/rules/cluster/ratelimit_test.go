// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package cluster

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

const (
	offLargeMessage   = "health.rule.ratelimit_off_large.message"
	storeSmallMessage = "health.rule.ratelimit_store_small.message"
)

func rateLimit(enabled bool, storeSize int) func(*model.Config) {
	return func(cfg *model.Config) {
		cfg.RateLimitSettings.Enable = new(enabled)
		cfg.RateLimitSettings.MemoryStoreSize = new(storeSize)
	}
}

func TestRateLimitConfigAbsent(t *testing.T) {
	t.Parallel()

	assertRules(t, []healthcheck.Rule{rateLimitOffLarge, rateLimitStoreSmall}, &healthcheck.Snapshot{}, map[string]want{
		"RATELIMIT_OFF_LARGE":   configUnknown,
		"RATELIMIT_STORE_SMALL": configUnknown,
	})
}

func TestRateLimitOffLarge(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     want
	}{
		{"enabled without stats", configSnapshot(rateLimit(true, 10_000)), resolved},
		{"disabled without stats", configSnapshot(rateLimit(false, 10_000)), statsUnknown},
		{"disabled at the threshold", withUsers(configSnapshot(rateLimit(false, 10_000)), 500), resolved.withValue(500)},
		{"disabled above the threshold", withUsers(configSnapshot(rateLimit(false, 10_000)), 501), firing(offLargeMessage, map[string]string{"users": "501"}).withValue(501)},
		{"enable unset", withUsers(configSnapshot(func(cfg *model.Config) { cfg.RateLimitSettings.Enable = nil }), 501), configUnknown},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResult(t, tc.want, evalRateLimitOffLarge(tc.snapshot))
		})
	}
}

func TestRateLimitStoreSmall(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     want
	}{
		{"disabled with a small store", configSnapshot(rateLimit(false, 100)), resolved},
		{"enabled with the default store", configSnapshot(rateLimit(true, 10_000)), resolved},
		{"enabled just below the default", configSnapshot(rateLimit(true, 9_999)), firing(storeSmallMessage, map[string]string{"size": "9999"})},
		{"enabled with a small store", configSnapshot(rateLimit(true, 100)), firing(storeSmallMessage, map[string]string{"size": "100"})},
		{"store size unset", configSnapshot(func(cfg *model.Config) {
			cfg.RateLimitSettings.Enable = new(true)
			cfg.RateLimitSettings.MemoryStoreSize = nil
		}), configUnknown},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResult(t, tc.want, evalRateLimitStoreSmall(tc.snapshot))
		})
	}
}
