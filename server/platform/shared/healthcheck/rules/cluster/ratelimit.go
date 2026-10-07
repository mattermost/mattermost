// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package cluster

import (
	"strconv"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

func init() {
	healthcheck.Register(rateLimitOffLarge, rateLimitStoreSmall)
}

const (
	rateLimitConsolePath = "/admin_console/environment/rate_limiting"

	rateLimitLargeUsers   = 500
	rateLimitMinStoreSize = 10_000
)

var rateLimitOffLarge = healthcheck.Rule{
	Code:     "RATELIMIT_OFF_LARGE",
	Area:     model.AreaCluster,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.ratelimit_off_large.title"),
		RemediationID: healthcheck.TranslationId("health.rule.ratelimit_off_large.remediation"),
		ConsolePath:   rateLimitConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityThreshold,
	Subject:    "RateLimitSettings.Enable",
	Eval:       evalRateLimitOffLarge,
}

var rateLimitStoreSmall = healthcheck.Rule{
	Code:     "RATELIMIT_STORE_SMALL",
	Area:     model.AreaCluster,
	Severity: healthcheck.SeverityInfo,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.ratelimit_store_small.title"),
		RemediationID: healthcheck.TranslationId("health.rule.ratelimit_store_small.remediation"),
		ConsolePath:   rateLimitConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Subject:    "RateLimitSettings.MemoryStoreSize",
	Eval:       evalRateLimitStoreSmall,
}

func rateLimitEnabled(s *healthcheck.Snapshot) (bool, bool) {
	return s.ConfigBool(func(cfg *model.Config) *bool { return cfg.RateLimitSettings.Enable })
}

func evalRateLimitOffLarge(s *healthcheck.Snapshot) []healthcheck.Result {
	enabled, ok := rateLimitEnabled(s)
	if !ok {
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)}
	}
	if enabled {
		return []healthcheck.Result{healthcheck.Resolved()}
	}

	users, ok := registeredUsers(s)
	switch {
	case !ok:
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonStatsUnavailable)}
	case users > rateLimitLargeUsers:
		return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.ratelimit_off_large.message")).
			WithDetail("users", strconv.FormatInt(users, 10)).
			WithValue(float64(users))}
	default:
		return []healthcheck.Result{healthcheck.Resolved().WithValue(float64(users))}
	}
}

// The memory store only exists while rate limiting is on.
func evalRateLimitStoreSmall(s *healthcheck.Snapshot) []healthcheck.Result {
	enabled, ok := rateLimitEnabled(s)
	if !ok {
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)}
	}
	if !enabled {
		return []healthcheck.Result{healthcheck.Resolved()}
	}

	size, ok := s.ConfigInt(func(cfg *model.Config) *int { return cfg.RateLimitSettings.MemoryStoreSize })
	switch {
	case !ok:
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)}
	case size < rateLimitMinStoreSize:
		return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.ratelimit_store_small.message")).WithDetail("size", strconv.Itoa(size))}
	default:
		return []healthcheck.Result{healthcheck.Resolved()}
	}
}
