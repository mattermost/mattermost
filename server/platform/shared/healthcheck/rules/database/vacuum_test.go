// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package database

import (
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var vacuumCollectedAt = time.Date(2026, time.November, 5, 12, 0, 0, 0, time.UTC)

func vacuumSnapshot(dbType *string, dead, posts *int64, manual, auto *time.Time) *healthcheck.Snapshot {
	diag := &model.SupportPacketDiagnostics{}
	diag.Database.Type = dbType
	diag.Database.PostsDeadTuples = dead
	diag.Database.PostsLastVacuum = manual
	diag.Database.PostsLastAutovacuum = auto

	s := newSnapshot(nil, &model.SupportPacketStats{Posts: posts}, diag)
	s.CollectedAt = vacuumCollectedAt
	return s
}

func TestDBPostsVacuumStale(t *testing.T) {
	t.Parallel()

	postgres := model.DatabaseDriverPostgres
	mysql := "mysql"
	stale := vacuumCollectedAt.Add(-8 * 24 * time.Hour)
	exactlySevenDays := vacuumCollectedAt.Add(-7 * 24 * time.Hour)
	recent := vacuumCollectedAt.Add(-time.Hour)
	future := vacuumCollectedAt.Add(time.Hour)
	dead := int64(200_000)
	lowDead := int64(100_000)
	negativeDead := int64(-1)
	posts := int64(500_000)
	positiveRatioPosts := int64(400_000)
	exactRatioPosts := int64(1_000_000)
	zeroPosts := int64(0)

	firing := firingWant("health.rule.db_posts_vacuum_stale.message").withValue(float64(dead))
	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     want
	}{
		{"leader diagnostics absent", newSnapshot(nil, &model.SupportPacketStats{Posts: &posts}, nil), unknownDiagWant},
		{"database type absent", vacuumSnapshot(nil, &dead, &posts, &stale, nil), unknownDiagWant},
		{"identity section failed", failSection(vacuumSnapshot(&postgres, &dead, &posts, &stale, nil), model.SectionDatabaseIdentity), unknownDiagWant},
		{"non-Postgres database", vacuumSnapshot(&mysql, nil, nil, nil, nil), resolvedWant},
		{"stats section failed", failSection(vacuumSnapshot(&postgres, &dead, &posts, &stale, nil), model.SectionDatabaseStats), unknownDiagWant},
		{"dead tuples absent", vacuumSnapshot(&postgres, nil, &posts, &stale, nil), unknownDiagWant},
		{"negative dead tuples", vacuumSnapshot(&postgres, &negativeDead, &posts, &stale, nil), unknownDiagWant},
		{"post count absent", vacuumSnapshot(&postgres, &dead, nil, &stale, nil), unknownStatsWant},
		{"zero post count with high dead tuples", vacuumSnapshot(&postgres, &dead, &zeroPosts, &stale, nil), unknownStatsWant},
		{"at dead tuple threshold", vacuumSnapshot(&postgres, &lowDead, &positiveRatioPosts, &stale, nil), resolvedWant.withValue(float64(lowDead))},
		{"at dead tuple ratio", vacuumSnapshot(&postgres, &dead, &exactRatioPosts, &stale, nil), resolvedWant.withValue(float64(dead))},
		{"manual vacuum recent", vacuumSnapshot(&postgres, &dead, &posts, &recent, &stale), resolvedWant.withValue(float64(dead))},
		{"autovacuum recent", vacuumSnapshot(&postgres, &dead, &posts, &stale, &recent), resolvedWant.withValue(float64(dead))},
		{"at stale threshold", vacuumSnapshot(&postgres, &dead, &posts, &exactlySevenDays, nil), resolvedWant.withValue(float64(dead))},
		{"manual vacuum stale", vacuumSnapshot(&postgres, &dead, &posts, &stale, nil), firing},
		{"autovacuum stale", vacuumSnapshot(&postgres, &dead, &posts, nil, &stale), firing},
		{"never vacuumed", vacuumSnapshot(&postgres, &dead, &posts, nil, nil), firingWant("health.rule.db_posts_vacuum_stale.message.never").withValue(float64(dead))},
		{"never vacuumed below dead tuple ratio", vacuumSnapshot(&postgres, &dead, &exactRatioPosts, nil, nil), resolvedWant.withValue(float64(dead))},
		{"vacuum timestamp after collection", vacuumSnapshot(&postgres, &dead, &posts, &future, nil), unknownDiagWant},
		{
			"collection time absent",
			func() *healthcheck.Snapshot {
				s := vacuumSnapshot(&postgres, &dead, &posts, &stale, nil)
				s.CollectedAt = time.Time{}
				return s
			}(),
			want{state: healthcheck.StateUnknown, messageID: healthcheck.ReasonCollectedAtUnknown},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResult(t, dbPostsVacuumStale, tc.snapshot, tc.want)
		})
	}

	results := dbPostsVacuumStale.Eval(vacuumSnapshot(&postgres, &dead, &posts, &stale, nil))
	require.Len(t, results, 1)
	assert.Equal(t, map[string]string{
		"age_days":     "8",
		"dead_percent": "40.0",
		"dead_tuples":  "200000",
		"last_vacuum":  "2026-10-28T12:00:00Z",
		"posts":        "500000",
	}, results[0].Details)

	results = dbPostsVacuumStale.Eval(vacuumSnapshot(&postgres, &dead, &posts, nil, nil))
	require.Len(t, results, 1)
	assert.Equal(t, map[string]string{
		"dead_percent": "40.0",
		"dead_tuples":  "200000",
		"posts":        "500000",
	}, results[0].Details)
}
