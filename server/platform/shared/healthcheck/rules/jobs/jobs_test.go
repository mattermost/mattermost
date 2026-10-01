// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package jobs

import (
	"errors"
	"maps"
	"slices"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var collectedAt = time.Date(2026, time.September, 25, 10, 0, 0, 0, time.UTC)

func ago(d time.Duration) int64 {
	return collectedAt.Add(-d).UnixMilli()
}

func jobsConfig(enabled bool) *model.Config {
	cfg := &model.Config{}
	cfg.LdapSettings.EnableSync = new(enabled)
	cfg.MessageExportSettings.EnableExport = new(enabled)
	cfg.ElasticsearchSettings.EnableIndexing = new(enabled)
	return cfg
}

// jobsSnapshot returns a snapshot with every gate open and the given runs, newest first, for every job type.
func jobsSnapshot(runs ...*model.Job) *healthcheck.Snapshot {
	return &healthcheck.Snapshot{
		CollectedAt: collectedAt,
		Config:      &model.SupportPacketConfig{Config: jobsConfig(true)},
		Jobs: &model.SupportPacketJobList{
			LDAPSyncJobs:               runs,
			DataRetentionJobs:          runs,
			MessageExportJobs:          runs,
			ElasticPostIndexingJobs:    runs,
			ElasticPostAggregationJobs: runs,
		},
		Sections: map[model.WorkspaceSection]error{model.SectionConfig: nil, model.SectionJobs: nil},
	}
}

func withoutCollectedAt(s *healthcheck.Snapshot) *healthcheck.Snapshot {
	s.CollectedAt = time.Time{}
	return s
}

func resultsBySubject(t *testing.T, rule healthcheck.Rule, s *healthcheck.Snapshot) map[string]healthcheck.Result {
	t.Helper()

	results := rule.Eval(s)
	bySubject := make(map[string]healthcheck.Result, len(results))
	for _, result := range results {
		require.NotContains(t, bySubject, result.Subject, rule.Code)
		bySubject[result.Subject] = result
	}

	return bySubject
}

type jobWant struct {
	state     healthcheck.State
	messageID string
	details   map[string]string
}

func assertResult(t *testing.T, want jobWant, got healthcheck.Result, msgAndArgs ...any) {
	t.Helper()

	details := want.details
	if details != nil {
		details = maps.Clone(details)
		details["job_type"] = got.Subject
	}

	assert.Equal(t, want.state, got.State, msgAndArgs...)
	assert.Equal(t, want.messageID, got.MessageID, msgAndArgs...)
	assert.Equal(t, details, got.Details, msgAndArgs...)
}

func TestBuiltinRegistersJobRules(t *testing.T) {
	require.NoError(t, healthcheck.Builtin().Validate())

	for _, code := range []string{"JOB_STUCK", "JOB_WEDGED_AT_ZERO", "JOB_FAILED"} {
		_, ok := healthcheck.Builtin().Get(code)
		assert.True(t, ok, code)
	}
}

func TestJobRulesEmitOneResultPerSubject(t *testing.T) {
	t.Parallel()

	allTypes := []string{"ldap_sync", "data_retention", "message_export", "elasticsearch_post_indexing", "elasticsearch_post_aggregation"}
	progressTypes := []string{"ldap_sync", "message_export", "elasticsearch_post_indexing", "elasticsearch_post_aggregation"}

	testCases := []struct {
		rule     healthcheck.Rule
		subjects []string
	}{
		{rule: jobStuck, subjects: allTypes},
		{rule: jobWedgedAtZero, subjects: progressTypes},
		{rule: jobFailed, subjects: allTypes},
	}

	snapshots := map[string]*healthcheck.Snapshot{
		"no runs":        jobsSnapshot(),
		"config absent":  {CollectedAt: collectedAt},
		"gates closed":   {CollectedAt: collectedAt, Config: &model.SupportPacketConfig{Config: jobsConfig(false)}, Sections: map[model.WorkspaceSection]error{model.SectionConfig: nil}},
		"jobs absent":    {CollectedAt: collectedAt, Config: &model.SupportPacketConfig{Config: jobsConfig(true)}, Sections: map[model.WorkspaceSection]error{model.SectionConfig: nil}},
		"collected zero": withoutCollectedAt(jobsSnapshot()),
	}

	for _, tc := range testCases {
		for name, snapshot := range snapshots {
			t.Run(tc.rule.Code+"/"+name, func(t *testing.T) {
				t.Parallel()

				results := tc.rule.Eval(snapshot)
				subjects := make([]string, 0, len(results))
				for _, result := range results {
					subjects = append(subjects, result.Subject)
				}
				assert.Equal(t, tc.subjects, subjects)
			})
		}
	}
}

func TestJobRulesUnknownWithoutData(t *testing.T) {
	t.Parallel()

	stale := &model.Job{Id: "stale", Status: model.JobStatusInProgress, StartAt: ago(48 * time.Hour), LastActivityAt: ago(48 * time.Hour)}
	full := jobsSnapshot(stale)

	jobsErrored := jobsSnapshot(stale)
	jobsErrored.Sections[model.SectionJobs] = errors.New("boom")

	jobsAbsent := jobsSnapshot()
	jobsAbsent.Jobs = nil
	delete(jobsAbsent.Sections, model.SectionJobs)

	configErrored := jobsSnapshot(stale)
	configErrored.Sections[model.SectionConfig] = errors.New("boom")

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		reason   string
	}{
		{
			name:     "config section absent",
			snapshot: &healthcheck.Snapshot{CollectedAt: collectedAt, Jobs: full.Jobs, Sections: map[model.WorkspaceSection]error{model.SectionJobs: nil}},
			reason:   healthcheck.ReasonConfigUnavailable,
		},
		{
			name:     "config section failed",
			snapshot: configErrored,
			reason:   healthcheck.ReasonConfigUnavailable,
		},
		{
			name:     "jobs section absent",
			snapshot: jobsAbsent,
			reason:   healthcheck.ReasonJobsUnavailable,
		},
		{
			name:     "jobs section failed",
			snapshot: jobsErrored,
			reason:   healthcheck.ReasonJobsUnavailable,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			for _, rule := range []healthcheck.Rule{jobStuck, jobWedgedAtZero, jobFailed} {
				for subject, result := range resultsBySubject(t, rule, tc.snapshot) {
					assertResult(t, jobWant{state: healthcheck.StateUnknown, messageID: tc.reason}, result, rule.Code, subject)
				}
			}
		})
	}
}

func TestJobRulesGates(t *testing.T) {
	t.Parallel()

	stale := &model.Job{Id: "stale", Status: model.JobStatusInProgress, StartAt: ago(48 * time.Hour), LastActivityAt: ago(48 * time.Hour)}
	failed := &model.Job{Id: "failed", Status: model.JobStatusError, Data: model.StringMap{"error": "boom"}}

	t.Run("gate closed resolves a stale run and a latest error", func(t *testing.T) {
		t.Parallel()

		snapshot := jobsSnapshot(stale, failed)
		snapshot.Config = &model.SupportPacketConfig{Config: jobsConfig(false)}

		for _, rule := range []healthcheck.Rule{jobStuck, jobWedgedAtZero, jobFailed} {
			for subject, result := range resultsBySubject(t, rule, snapshot) {
				if subject == model.JobTypeDataRetention {
					assert.Equal(t, healthcheck.StateFiring, result.State, "data_retention has no config gate: %s", rule.Code)
					continue
				}
				assert.Equal(t, healthcheck.StateResolved, result.State, rule.Code, subject)
			}
		}
	})

	t.Run("each gate closes only its own job types", func(t *testing.T) {
		t.Parallel()

		testCases := []struct {
			name   string
			close  func(cfg *model.Config)
			closed []string
		}{
			{
				name:   "LdapSettings.EnableSync",
				close:  func(cfg *model.Config) { cfg.LdapSettings.EnableSync = new(false) },
				closed: []string{model.JobTypeLdapSync},
			},
			{
				name:   "MessageExportSettings.EnableExport",
				close:  func(cfg *model.Config) { cfg.MessageExportSettings.EnableExport = new(false) },
				closed: []string{model.JobTypeMessageExport},
			},
			{
				name:   "ElasticsearchSettings.EnableIndexing",
				close:  func(cfg *model.Config) { cfg.ElasticsearchSettings.EnableIndexing = new(false) },
				closed: []string{model.JobTypeElasticsearchPostIndexing, model.JobTypeElasticsearchPostAggregation},
			},
		}

		for _, tc := range testCases {
			snapshot := jobsSnapshot(stale)
			tc.close(snapshot.Config.Config)

			for subject, result := range resultsBySubject(t, jobStuck, snapshot) {
				if slices.Contains(tc.closed, subject) {
					assert.Equal(t, healthcheck.StateResolved, result.State, tc.name, subject)
				} else {
					assert.Equal(t, healthcheck.StateFiring, result.State, tc.name, subject)
				}
			}
		}
	})

	t.Run("gate setting absent is unknown for its job types only", func(t *testing.T) {
		t.Parallel()

		snapshot := jobsSnapshot(stale)
		snapshot.Config.Config.ElasticsearchSettings.EnableIndexing = nil

		results := resultsBySubject(t, jobStuck, snapshot)
		for _, subject := range []string{model.JobTypeElasticsearchPostIndexing, model.JobTypeElasticsearchPostAggregation} {
			assertResult(t, jobWant{state: healthcheck.StateUnknown, messageID: healthcheck.ReasonConfigUnavailable}, results[subject], subject)
		}
		assert.Equal(t, healthcheck.StateFiring, results[model.JobTypeLdapSync].State)
	})
}

func TestJobStuck(t *testing.T) {
	t.Parallel()

	resolved := jobWant{state: healthcheck.StateResolved}

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     jobWant
	}{
		{
			name:     "no runs",
			snapshot: jobsSnapshot(),
			want:     resolved,
		},
		{
			name:     "no activity for more than 24h",
			snapshot: jobsSnapshot(&model.Job{Id: "job1", Status: model.JobStatusInProgress, StartAt: ago(30 * time.Hour), LastActivityAt: ago(25 * time.Hour)}),
			want: jobWant{
				state:     healthcheck.StateFiring,
				messageID: "health.rule.job_stuck.message",
				details:   map[string]string{"job_id": "job1", "hours": "25"},
			},
		},
		{
			name:     "no activity for exactly 24h",
			snapshot: jobsSnapshot(&model.Job{Id: "job1", Status: model.JobStatusInProgress, StartAt: ago(24 * time.Hour), LastActivityAt: ago(24 * time.Hour)}),
			want:     resolved,
		},
		{
			name:     "started 30h ago but active 1h ago",
			snapshot: jobsSnapshot(&model.Job{Id: "job1", Status: model.JobStatusInProgress, Progress: 40, StartAt: ago(30 * time.Hour), LastActivityAt: ago(time.Hour)}),
			want:     resolved,
		},
		{
			name: "only the latest run counts",
			snapshot: jobsSnapshot(
				&model.Job{Id: "job2", Status: model.JobStatusSuccess, StartAt: ago(2 * time.Hour), LastActivityAt: ago(time.Hour)},
				&model.Job{Id: "job1", Status: model.JobStatusInProgress, StartAt: ago(72 * time.Hour), LastActivityAt: ago(72 * time.Hour)},
			),
			want: resolved,
		},
		{
			name:     "old pending run",
			snapshot: jobsSnapshot(&model.Job{Id: "job1", Status: model.JobStatusPending, CreateAt: ago(72 * time.Hour)}),
			want:     resolved,
		},
		{
			name: "ages are measured from CollectedAt, not the wall clock",
			snapshot: func() *healthcheck.Snapshot {
				s := jobsSnapshot(&model.Job{Id: "job1", Status: model.JobStatusInProgress, StartAt: ago(8*24*time.Hour + time.Hour), LastActivityAt: ago(8*24*time.Hour + time.Hour)})
				s.CollectedAt = collectedAt.Add(-8 * 24 * time.Hour)
				return s
			}(),
			want: resolved,
		},
		{
			name:     "zero CollectedAt",
			snapshot: withoutCollectedAt(jobsSnapshot(&model.Job{Id: "job1", Status: model.JobStatusInProgress, StartAt: ago(48 * time.Hour), LastActivityAt: ago(48 * time.Hour)})),
			want:     jobWant{state: healthcheck.StateUnknown, messageID: healthcheck.ReasonCollectedAtUnknown},
		},
		{
			name:     "zero CollectedAt with no runs",
			snapshot: withoutCollectedAt(jobsSnapshot()),
			want:     jobWant{state: healthcheck.StateUnknown, messageID: healthcheck.ReasonCollectedAtUnknown},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			for subject, result := range resultsBySubject(t, jobStuck, tc.snapshot) {
				assertResult(t, tc.want, result, subject)
			}
		})
	}
}

func TestJobWedgedAtZero(t *testing.T) {
	t.Parallel()

	resolved := jobWant{state: healthcheck.StateResolved}

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     jobWant
	}{
		{
			name:     "no runs",
			snapshot: jobsSnapshot(),
			want:     resolved,
		},
		{
			name:     "at zero for more than 6h",
			snapshot: jobsSnapshot(&model.Job{Id: "job1", Status: model.JobStatusInProgress, StartAt: ago(7 * time.Hour), LastActivityAt: ago(time.Hour)}),
			want: jobWant{
				state:     healthcheck.StateFiring,
				messageID: "health.rule.job_wedged_at_zero.message",
				details:   map[string]string{"job_id": "job1", "hours": "7"},
			},
		},
		{
			name:     "at zero for exactly 6h",
			snapshot: jobsSnapshot(&model.Job{Id: "job1", Status: model.JobStatusInProgress, StartAt: ago(6 * time.Hour), LastActivityAt: ago(6 * time.Hour)}),
			want:     resolved,
		},
		{
			name:     "progress above zero",
			snapshot: jobsSnapshot(&model.Job{Id: "job1", Status: model.JobStatusInProgress, Progress: 1, StartAt: ago(30 * time.Hour), LastActivityAt: ago(30 * time.Hour)}),
			want:     resolved,
		},
		{
			name:     "finished run at zero",
			snapshot: jobsSnapshot(&model.Job{Id: "job1", Status: model.JobStatusSuccess, StartAt: ago(30 * time.Hour), LastActivityAt: ago(29 * time.Hour)}),
			want:     resolved,
		},
		{
			name:     "zero CollectedAt",
			snapshot: withoutCollectedAt(jobsSnapshot(&model.Job{Id: "job1", Status: model.JobStatusInProgress, StartAt: ago(30 * time.Hour), LastActivityAt: ago(30 * time.Hour)})),
			want:     jobWant{state: healthcheck.StateUnknown, messageID: healthcheck.ReasonCollectedAtUnknown},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			results := resultsBySubject(t, jobWedgedAtZero, tc.snapshot)
			require.Len(t, results, 4)
			assert.NotContains(t, results, model.JobTypeDataRetention)
			for subject, result := range results {
				assertResult(t, tc.want, result, subject)
			}
		})
	}
}

func TestJobStuckAndWedgedAreSeparateClaims(t *testing.T) {
	t.Parallel()

	snapshot := jobsSnapshot(&model.Job{Id: "job1", Status: model.JobStatusInProgress, StartAt: ago(30 * time.Hour), LastActivityAt: ago(30 * time.Hour)})
	assert.Equal(t, healthcheck.StateFiring, resultsBySubject(t, jobStuck, snapshot)[model.JobTypeLdapSync].State)
	assert.Equal(t, healthcheck.StateFiring, resultsBySubject(t, jobWedgedAtZero, snapshot)[model.JobTypeLdapSync].State)

	snapshot = jobsSnapshot(&model.Job{Id: "job1", Status: model.JobStatusInProgress, StartAt: ago(30 * time.Hour), LastActivityAt: ago(time.Hour)})
	assert.Equal(t, healthcheck.StateResolved, resultsBySubject(t, jobStuck, snapshot)[model.JobTypeLdapSync].State)
	assert.Equal(t, healthcheck.StateFiring, resultsBySubject(t, jobWedgedAtZero, snapshot)[model.JobTypeLdapSync].State)
}

func TestJobFailed(t *testing.T) {
	t.Parallel()

	resolved := jobWant{state: healthcheck.StateResolved}
	failed := &model.Job{Id: "failed", Status: model.JobStatusError, Progress: -1, Data: model.StringMap{"error": "driver: bad connection"}}
	firing := jobWant{
		state:     healthcheck.StateFiring,
		messageID: "health.rule.job_failed.message",
		details:   map[string]string{"job_id": "failed", "error": "driver: bad connection"},
	}

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     jobWant
	}{
		{
			name:     "no runs",
			snapshot: jobsSnapshot(),
			want:     resolved,
		},
		{
			name:     "latest run failed",
			snapshot: jobsSnapshot(failed),
			want:     firing,
		},
		{
			name:     "latest run failed without an error message",
			snapshot: jobsSnapshot(&model.Job{Id: "failed", Status: model.JobStatusError}),
			want: jobWant{
				state:     healthcheck.StateFiring,
				messageID: "health.rule.job_failed.message.no_error",
				details:   map[string]string{"job_id": "failed"},
			},
		},
		{
			name:     "latest terminal run canceled",
			snapshot: jobsSnapshot(&model.Job{Id: "canceled", Status: model.JobStatusCanceled}, failed),
			want:     resolved,
		},
		{
			name:     "error followed by a newer success",
			snapshot: jobsSnapshot(&model.Job{Id: "ok", Status: model.JobStatusSuccess}, failed),
			want:     resolved,
		},
		{
			name:     "error followed by a newer warning",
			snapshot: jobsSnapshot(&model.Job{Id: "warn", Status: model.JobStatusWarning}, failed),
			want:     resolved,
		},
		{
			name:     "error followed by a newer in_progress",
			snapshot: jobsSnapshot(&model.Job{Id: "running", Status: model.JobStatusInProgress}, failed),
			want:     firing,
		},
		{
			name: "error followed by newer pending and cancel_requested",
			snapshot: jobsSnapshot(
				&model.Job{Id: "pending", Status: model.JobStatusPending},
				&model.Job{Id: "canceling", Status: model.JobStatusCancelRequested},
				failed,
			),
			want: firing,
		},
		{
			name:     "older error behind a success",
			snapshot: jobsSnapshot(&model.Job{Id: "ok", Status: model.JobStatusSuccess}, &model.Job{Id: "ok2", Status: model.JobStatusSuccess}, failed),
			want:     resolved,
		},
		{
			name:     "zero CollectedAt still evaluates",
			snapshot: withoutCollectedAt(jobsSnapshot(failed)),
			want:     firing,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			results := resultsBySubject(t, jobFailed, tc.snapshot)
			require.Len(t, results, 5)
			for subject, result := range results {
				assertResult(t, tc.want, result, subject)
			}
		})
	}
}
