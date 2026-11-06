// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package database

import (
	"strconv"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

const (
	postsVacuumDeadTuples = 100_000
	postsVacuumDeadRatio  = 0.2
	postsVacuumStaleAfter = 7 * 24 * time.Hour
)

var dbPostsVacuumStale = healthcheck.Rule{
	Code:     "DB_POSTS_VACUUM_STALE",
	Area:     model.AreaDatabase,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.db_posts_vacuum_stale.title"),
		RemediationID: healthcheck.TranslationId("health.rule.db_posts_vacuum_stale.remediation"),
		DocsURL:       "https://www.postgresql.org/docs/current/routine-vacuuming.html",
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityThreshold,
	Subject:    "Database.PostsDeadTuples",
	Eval:       healthcheck.Single(evalDBPostsVacuumStale),
}

func evalDBPostsVacuumStale(s *healthcheck.Snapshot) healthcheck.Result {
	identity, ok := s.LeaderDiag(model.SectionDatabaseIdentity)
	if !ok || identity.Database.Type == nil {
		return unknownDiagnostics()
	}
	if *identity.Database.Type != model.DatabaseDriverPostgres {
		return healthcheck.Resolved()
	}

	diag, ok := s.LeaderDiag(model.SectionDatabaseStats)
	if !ok || diag.Database.PostsDeadTuples == nil {
		return unknownDiagnostics()
	}
	dead := *diag.Database.PostsDeadTuples
	if dead < 0 {
		return unknownDiagnostics()
	}
	if dead <= postsVacuumDeadTuples {
		return healthcheck.Resolved().WithValue(float64(dead))
	}

	posts, ok := s.Stat(func(stats *model.SupportPacketStats) *int64 { return stats.Posts })
	if !ok || posts <= 0 {
		return unknownStats()
	}

	deadRatio := float64(dead) / float64(posts)
	if deadRatio <= postsVacuumDeadRatio {
		return healthcheck.Resolved().WithValue(float64(dead))
	}

	if diag.Database.PostsVacuumInProgress == nil {
		return unknownDiagnostics()
	}
	if *diag.Database.PostsVacuumInProgress {
		return healthcheck.Unknown(healthcheck.TranslationId("health.rule.db_posts_vacuum_stale.in_progress"))
	}

	lastVacuum, vacuumed := postsLastVacuum(diag)
	if !vacuumed {
		return healthcheck.Firing(healthcheck.TranslationId("health.rule.db_posts_vacuum_stale.message.never")).
			WithDetail("dead_percent", strconv.FormatFloat(100*deadRatio, 'f', 1, 64)).
			WithDetail("dead_tuples", strconv.FormatInt(dead, 10)).
			WithDetail("posts", strconv.FormatInt(posts, 10)).
			WithValue(float64(dead))
	}
	age, ok := s.Since(lastVacuum)
	if !ok {
		return healthcheck.Unknown(healthcheck.ReasonCollectedAtUnknown)
	}
	if age < 0 {
		return unknownDiagnostics()
	}
	if age <= postsVacuumStaleAfter {
		return healthcheck.Resolved().WithValue(float64(dead))
	}

	return healthcheck.Firing(healthcheck.TranslationId("health.rule.db_posts_vacuum_stale.message")).
		WithDetail("age_days", strconv.Itoa(int(age.Hours()/24))).
		WithDetail("dead_percent", strconv.FormatFloat(100*deadRatio, 'f', 1, 64)).
		WithDetail("dead_tuples", strconv.FormatInt(dead, 10)).
		WithDetail("last_vacuum", lastVacuum.Format(time.RFC3339)).
		WithDetail("posts", strconv.FormatInt(posts, 10)).
		WithValue(float64(dead))
}

func postsLastVacuum(diag *model.SupportPacketDiagnostics) (time.Time, bool) {
	manual := diag.Database.PostsLastVacuum
	auto := diag.Database.PostsLastAutovacuum
	switch {
	case manual == nil && auto == nil:
		return time.Time{}, false
	case manual == nil:
		return *auto, true
	case auto == nil || manual.After(*auto):
		return *manual, true
	default:
		return *auto, true
	}
}
