// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

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
		{"disabled with a small store", withUsers(configSnapshot(rateLimit(false, 100)), 1_000), resolved},
		{"enabled without stats", configSnapshot(rateLimit(true, 100)), statsUnknown},
		{"enabled with a store sized to the users", withUsers(configSnapshot(rateLimit(true, 300)), 300), resolved.withValue(300)},
		{"enabled with a store larger than the users", withUsers(configSnapshot(rateLimit(true, 10_000)), 200), resolved.withValue(200)},
		{"enabled with one user too many", withUsers(configSnapshot(rateLimit(true, 300)), 301), firing(storeSmallMessage, map[string]string{"size": "300", "users": "301"}).withValue(301)},
		{"enabled with the default store and more users", withUsers(configSnapshot(rateLimit(true, 10_000)), 20_000), firing(storeSmallMessage, map[string]string{"size": "10000", "users": "20000"}).withValue(20_000)},
		{"store size unset", withUsers(configSnapshot(func(cfg *model.Config) {
			cfg.RateLimitSettings.Enable = new(true)
			cfg.RateLimitSettings.MemoryStoreSize = nil
		}), 1_000), configUnknown},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResult(t, tc.want, evalRateLimitStoreSmall(tc.snapshot))
		})
	}
}
