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

var stale = &model.Job{Id: "stale", Status: model.JobStatusInProgress, StartAt: ago(48 * time.Hour), LastActivityAt: ago(48 * time.Hour)}

// unfinished returns n runs with the given status, as when the collected window holds only queued or running rows.
func unfinished(n int, status string) []*model.Job {
	jobs := make([]*model.Job, n)
	for i := range jobs {
		jobs[i] = &model.Job{Id: model.NewId(), Status: status, CreateAt: ago(time.Duration(i) * time.Minute)}
	}
	return jobs
}

func jobsConfig(enabled bool) *model.Config {
	cfg := &model.Config{}
	cfg.LdapSettings.EnableSync = new(enabled)
	cfg.MessageExportSettings.EnableExport = new(enabled)
	cfg.ElasticsearchSettings.EnableIndexing = new(enabled)
	return cfg
}

func jobsFeatures(granted bool) *model.Features {
	return &model.Features{LDAP: new(granted), MessageExport: new(granted), Elasticsearch: new(granted), DataRetention: new(granted)}
}

func leaderWithLicense(license model.SupportPacketLicense) *healthcheck.Snapshot {
	diag := &model.SupportPacketDiagnostics{License: license}
	return healthcheck.NewSnapshot([]*healthcheck.NodeSnapshot{{
		Hostname:    "app-1",
		IsLeader:    true,
		Diagnostics: &model.NodeDiagnostics{Diagnostics: diag},
	}})
}

var fullLicense = model.SupportPacketLicense{SkuShortName: model.LicenseShortSkuEnterprise, Features: jobsFeatures(true)}

func configSnapshot(license model.SupportPacketLicense, cfg *model.Config) *healthcheck.Snapshot {
	s := leaderWithLicense(license)
	s.CollectedAt = collectedAt
	s.Config = &model.SupportPacketConfig{Config: cfg}
	s.Sections = map[model.WorkspaceSection]error{model.SectionConfig: nil}
	return s
}

// jobsSnapshot returns a snapshot with every gate open and the given runs, newest first, for every job type.
func jobsSnapshot(runs ...*model.Job) *healthcheck.Snapshot {
	return licensedJobsSnapshot(fullLicense, runs...)
}

func licensedJobsSnapshot(license model.SupportPacketLicense, runs ...*model.Job) *healthcheck.Snapshot {
	s := configSnapshot(license, jobsConfig(true))
	s.Jobs = &model.SupportPacketJobList{
		LDAPSyncJobs:               runs,
		DataRetentionJobs:          runs,
		MessageExportJobs:          runs,
		ElasticPostIndexingJobs:    runs,
		ElasticPostAggregationJobs: runs,
	}
	s.Sections[model.SectionJobs] = nil
	return s
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

func TestJobRulesEmitOneResultPerSubject(t *testing.T) {
	t.Parallel()

	allTypes := []string{model.JobTypeLdapSync, model.JobTypeDataRetention, model.JobTypeMessageExport, model.JobTypeElasticsearchPostIndexing, model.JobTypeElasticsearchPostAggregation}
	progressTypes := []string{model.JobTypeLdapSync, model.JobTypeMessageExport, model.JobTypeElasticsearchPostIndexing, model.JobTypeElasticsearchPostAggregation}

	testCases := []struct {
		rule     healthcheck.Rule
		subjects []string
	}{
		{rule: jobStuck, subjects: allTypes},
		{rule: jobWedgedAtZero, subjects: progressTypes},
		{rule: jobFailed, subjects: allTypes},
	}

	configAbsent := leaderWithLicense(fullLicense)
	configAbsent.CollectedAt = collectedAt

	snapshots := map[string]*healthcheck.Snapshot{
		"no runs":         jobsSnapshot(),
		"config absent":   configAbsent,
		"gates closed":    configSnapshot(fullLicense, jobsConfig(false)),
		"jobs absent":     configSnapshot(fullLicense, jobsConfig(true)),
		"collected zero":  withoutCollectedAt(jobsSnapshot()),
		"license absent":  {CollectedAt: collectedAt},
		"features denied": licensedJobsSnapshot(model.SupportPacketLicense{SkuShortName: model.LicenseShortSkuProfessional, Features: jobsFeatures(false)}),
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

	full := jobsSnapshot(stale)

	jobsErrored := jobsSnapshot(stale)
	jobsErrored.Sections[model.SectionJobs] = errors.New("boom")

	jobsAbsent := jobsSnapshot()
	jobsAbsent.Jobs = nil
	delete(jobsAbsent.Sections, model.SectionJobs)

	configErrored := jobsSnapshot(stale)
	configErrored.Sections[model.SectionConfig] = errors.New("boom")

	configAbsent := jobsSnapshot(stale)
	delete(configAbsent.Sections, model.SectionConfig)

	licenseAbsent := &healthcheck.Snapshot{CollectedAt: collectedAt, Config: full.Config, Jobs: full.Jobs, Sections: full.Sections}

	licensedWithoutFeatures := licensedJobsSnapshot(model.SupportPacketLicense{SkuShortName: model.LicenseShortSkuEnterprise}, stale)

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		reason   string
	}{
		{
			name:     "config section absent",
			snapshot: configAbsent,
			reason:   healthcheck.ReasonConfigUnavailable,
		},
		{
			name:     "license absent",
			snapshot: licenseAbsent,
			reason:   healthcheck.ReasonLicenseUnavailable,
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

	t.Run("licensed packet predating features runs the rules", func(t *testing.T) {
		t.Parallel()

		for _, rule := range []healthcheck.Rule{jobStuck, jobWedgedAtZero, jobFailed} {
			assert.Equal(t, rule.Eval(full), rule.Eval(licensedWithoutFeatures), rule.Code)
		}
	})
}

func TestJobRulesGates(t *testing.T) {
	t.Parallel()

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

	t.Run("unlicensed resolves a stale run and a latest error", func(t *testing.T) {
		t.Parallel()

		snapshot := licensedJobsSnapshot(model.SupportPacketLicense{}, stale, failed)

		for _, rule := range []healthcheck.Rule{jobStuck, jobWedgedAtZero, jobFailed} {
			for subject, result := range resultsBySubject(t, rule, snapshot) {
				assert.Equal(t, healthcheck.StateResolved, result.State, rule.Code, subject)
			}
		}
	})

	t.Run("each license feature closes only its own job types", func(t *testing.T) {
		t.Parallel()

		testCases := []struct {
			name   string
			deny   func(f *model.Features)
			closed []string
		}{
			{name: "LDAP", deny: func(f *model.Features) { f.LDAP = new(false) }, closed: []string{model.JobTypeLdapSync}},
			{name: "MessageExport", deny: func(f *model.Features) { f.MessageExport = new(false) }, closed: []string{model.JobTypeMessageExport}},
			{name: "Elasticsearch", deny: func(f *model.Features) { f.Elasticsearch = new(false) }, closed: []string{model.JobTypeElasticsearchPostIndexing, model.JobTypeElasticsearchPostAggregation}},
			{name: "DataRetention", deny: func(f *model.Features) { f.DataRetention = new(false) }, closed: []string{model.JobTypeDataRetention}},
		}

		for _, tc := range testCases {
			features := jobsFeatures(true)
			tc.deny(features)
			snapshot := licensedJobsSnapshot(model.SupportPacketLicense{SkuShortName: model.LicenseShortSkuEnterprise, Features: features}, stale)

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
			name: "pending run queued behind a stuck run",
			snapshot: jobsSnapshot(
				&model.Job{Id: "job2", Status: model.JobStatusPending, CreateAt: ago(time.Hour)},
				&model.Job{Id: "job1", Status: model.JobStatusInProgress, StartAt: ago(30 * time.Hour), LastActivityAt: ago(25 * time.Hour)},
			),
			want: jobWant{
				state:     healthcheck.StateFiring,
				messageID: "health.rule.job_stuck.message",
				details:   map[string]string{"job_id": "job1", "hours": "25"},
			},
		},
		{
			name:     "a full window of pending runs",
			snapshot: jobsSnapshot(unfinished(collectedRunsPerType, model.JobStatusPending)...),
			want:     jobWant{state: healthcheck.StateUnknown, messageID: "health.reason.job_runs_unfinished"},
		},
		{
			name:     "pending runs short of a full window",
			snapshot: jobsSnapshot(unfinished(collectedRunsPerType-1, model.JobStatusPending)...),
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
	wedged := jobWant{
		state:     healthcheck.StateFiring,
		messageID: "health.rule.job_wedged_at_zero.message",
		details:   map[string]string{"job_id": "job1"},
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
			name:     "at zero and idle for more than 1h",
			snapshot: jobsSnapshot(&model.Job{Id: "job1", Status: model.JobStatusInProgress, StartAt: ago(2 * time.Hour), LastActivityAt: ago(2 * time.Hour)}),
			want:     wedged,
		},
		{
			name:     "at zero and idle for exactly 1h",
			snapshot: jobsSnapshot(&model.Job{Id: "job1", Status: model.JobStatusInProgress, StartAt: ago(time.Hour), LastActivityAt: ago(time.Hour)}),
			want:     resolved,
		},
		{
			name:     "at zero for hours but still recording activity",
			snapshot: jobsSnapshot(&model.Job{Id: "job1", Status: model.JobStatusInProgress, StartAt: ago(30 * time.Hour), LastActivityAt: ago(10 * time.Minute)}),
			want:     resolved,
		},
		{
			name:     "progress above zero",
			snapshot: jobsSnapshot(&model.Job{Id: "job1", Status: model.JobStatusInProgress, Progress: 1, StartAt: ago(30 * time.Hour), LastActivityAt: ago(30 * time.Hour)}),
			want:     resolved,
		},
		{
			name: "pending run queued behind a wedged run",
			snapshot: jobsSnapshot(
				&model.Job{Id: "job2", Status: model.JobStatusPending, CreateAt: ago(time.Hour)},
				&model.Job{Id: "job1", Status: model.JobStatusInProgress, StartAt: ago(7 * time.Hour), LastActivityAt: ago(2 * time.Hour)},
			),
			want: wedged,
		},
		{
			name:     "a full window of pending runs",
			snapshot: jobsSnapshot(unfinished(collectedRunsPerType, model.JobStatusPending)...),
			want:     jobWant{state: healthcheck.StateUnknown, messageID: "health.reason.job_runs_unfinished"},
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

			for subject, result := range resultsBySubject(t, jobWedgedAtZero, tc.snapshot) {
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

	snapshot = jobsSnapshot(&model.Job{Id: "job1", Status: model.JobStatusInProgress, StartAt: ago(30 * time.Hour), LastActivityAt: ago(2 * time.Hour)})
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
			name:     "only canceled runs",
			snapshot: jobsSnapshot(&model.Job{Id: "canceled", Status: model.JobStatusCanceled}),
			want:     resolved,
		},
		{
			name:     "error followed by a newer canceled",
			snapshot: jobsSnapshot(&model.Job{Id: "canceled", Status: model.JobStatusCanceled}, failed),
			want:     firing,
		},
		{
			name:     "success followed by a newer canceled",
			snapshot: jobsSnapshot(&model.Job{Id: "canceled", Status: model.JobStatusCanceled}, &model.Job{Id: "ok", Status: model.JobStatusSuccess}),
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
			name:     "a full window of unfinished runs",
			snapshot: jobsSnapshot(append(unfinished(collectedRunsPerType-1, model.JobStatusPending), &model.Job{Id: "running", Status: model.JobStatusInProgress})...),
			want:     jobWant{state: healthcheck.StateUnknown, messageID: "health.reason.job_runs_unfinished"},
		},
		{
			name:     "a full window of canceled runs",
			snapshot: jobsSnapshot(unfinished(collectedRunsPerType, model.JobStatusCanceled)...),
			want:     jobWant{state: healthcheck.StateUnknown, messageID: "health.reason.job_runs_unfinished"},
		},
		{
			name:     "unfinished runs short of a full window",
			snapshot: jobsSnapshot(unfinished(collectedRunsPerType-1, model.JobStatusInProgress)...),
			want:     resolved,
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

			for subject, result := range resultsBySubject(t, jobFailed, tc.snapshot) {
				assertResult(t, tc.want, result, subject)
			}
		})
	}
}

func TestJobFailedAfterRetentionTurnedOff(t *testing.T) {
	t.Parallel()

	failedAgo := func(d time.Duration) *model.Job {
		return &model.Job{Id: "failed", Status: model.JobStatusError, LastActivityAt: ago(d), Data: model.StringMap{"error": "driver: bad connection"}}
	}
	withRetention := func(snapshot *healthcheck.Snapshot, messages, files bool) *healthcheck.Snapshot {
		snapshot.Config.Config.DataRetentionSettings.EnableMessageDeletion = new(messages)
		snapshot.Config.Config.DataRetentionSettings.EnableFileDeletion = new(files)
		return snapshot
	}

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     healthcheck.State
	}{
		{
			name:     "retention off and the failure is older than a week",
			snapshot: withRetention(jobsSnapshot(failedAgo(8*24*time.Hour)), false, false),
			want:     healthcheck.StateResolved,
		},
		{
			name:     "retention off and the failure is recent",
			snapshot: withRetention(jobsSnapshot(failedAgo(2*24*time.Hour)), false, false),
			want:     healthcheck.StateFiring,
		},
		{
			name:     "message deletion on",
			snapshot: withRetention(jobsSnapshot(failedAgo(8*24*time.Hour)), true, false),
			want:     healthcheck.StateFiring,
		},
		{
			name:     "file deletion on",
			snapshot: withRetention(jobsSnapshot(failedAgo(8*24*time.Hour)), false, true),
			want:     healthcheck.StateFiring,
		},
		{
			name:     "retention settings absent",
			snapshot: jobsSnapshot(failedAgo(8 * 24 * time.Hour)),
			want:     healthcheck.StateFiring,
		},
		{
			name:     "zero CollectedAt",
			snapshot: withoutCollectedAt(withRetention(jobsSnapshot(failedAgo(8*24*time.Hour)), false, false)),
			want:     healthcheck.StateFiring,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			results := resultsBySubject(t, jobFailed, tc.snapshot)
			assert.Equal(t, tc.want, results[model.JobTypeDataRetention].State)
			assert.Equal(t, healthcheck.StateFiring, results[model.JobTypeLdapSync].State, "other job types ignore the retention settings")
		})
	}
}
