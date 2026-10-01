// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package jobs

import (
	"strconv"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

func init() {
	healthcheck.Register(jobStuck, jobWedgedAtZero, jobFailed)
}

const (
	stuckAfter  = 24 * time.Hour
	wedgedAfter = 6 * time.Hour
)

var monitoredJobTypes = []string{
	model.JobTypeLdapSync,
	model.JobTypeDataRetention,
	model.JobTypeMessageExport,
	model.JobTypeElasticsearchPostIndexing,
	model.JobTypeElasticsearchPostAggregation,
}

// The data retention worker never reports progress, so it is always at zero while running.
var progressJobTypes = []string{
	model.JobTypeLdapSync,
	model.JobTypeMessageExport,
	model.JobTypeElasticsearchPostIndexing,
	model.JobTypeElasticsearchPostAggregation,
}

var jobStuck = healthcheck.Rule{
	Code:     "JOB_STUCK",
	Area:     model.AreaJobs,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.job_stuck.title"),
		RemediationID: healthcheck.TranslationId("health.rule.job_stuck.remediation"),
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Eval:       evalJobStuck,
}

var jobWedgedAtZero = healthcheck.Rule{
	Code:     "JOB_WEDGED_AT_ZERO",
	Area:     model.AreaJobs,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.job_wedged_at_zero.title"),
		RemediationID: healthcheck.TranslationId("health.rule.job_wedged_at_zero.remediation"),
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Eval:       evalJobWedgedAtZero,
}

var jobFailed = healthcheck.Rule{
	Code:     "JOB_FAILED",
	Area:     model.AreaJobs,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.job_failed.title"),
		RemediationID: healthcheck.TranslationId("health.rule.job_failed.remediation"),
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Eval:       evalJobFailed,
}

// gate reports whether the feature behind jobType is enabled; ok is false when Config is absent.
func gate(s *healthcheck.Snapshot, jobType string) (enabled, ok bool) {
	switch jobType {
	case model.JobTypeLdapSync:
		return s.ConfigBool(func(cfg *model.Config) *bool { return cfg.LdapSettings.EnableSync })
	case model.JobTypeMessageExport:
		return s.ConfigBool(func(cfg *model.Config) *bool { return cfg.MessageExportSettings.EnableExport })
	case model.JobTypeElasticsearchPostIndexing, model.JobTypeElasticsearchPostAggregation:
		return s.ConfigBool(func(cfg *model.Config) *bool { return cfg.ElasticsearchSettings.EnableIndexing })
	default:
		return true, s.Has(model.SectionConfig) && s.Config != nil && s.Config.Config != nil
	}
}

// evalJobTypes returns one result per job type, calling check only for enabled types with collected runs.
func evalJobTypes(s *healthcheck.Snapshot, jobTypes []string, jobsUnavailableID string, check func(jobType string, jobs []*model.Job) healthcheck.Result) []healthcheck.Result {
	results := make([]healthcheck.Result, 0, len(jobTypes))
	for _, jobType := range jobTypes {
		enabled, ok := gate(s, jobType)
		if !ok {
			results = append(results, healthcheck.UnknownSubject(jobType, healthcheck.ReasonConfigUnavailable))
			continue
		}
		if !enabled {
			results = append(results, healthcheck.ResolvedSubject(jobType))
			continue
		}

		jobs, ok := s.JobsFor(jobType)
		if !ok {
			results = append(results, healthcheck.UnknownSubject(jobType, jobsUnavailableID))
			continue
		}

		results = append(results, check(jobType, jobs))
	}

	return results
}

func latestJob(jobs []*model.Job) *model.Job {
	if len(jobs) == 0 {
		return nil
	}

	return jobs[0]
}

func latestTerminalJob(jobs []*model.Job) *model.Job {
	for _, job := range jobs {
		if job == nil {
			continue
		}

		switch job.Status {
		case model.JobStatusPending, model.JobStatusInProgress, model.JobStatusCancelRequested:
			continue
		}

		return job
	}

	return nil
}

func hours(d time.Duration) string {
	return strconv.Itoa(int(d.Hours()))
}

func evalJobStuck(s *healthcheck.Snapshot) []healthcheck.Result {
	return evalJobTypes(s, monitoredJobTypes, healthcheck.TranslationId("health.rule.job_stuck.message.jobs_unavailable"), func(jobType string, jobs []*model.Job) healthcheck.Result {
		if s.CollectedAt.IsZero() {
			return healthcheck.UnknownSubject(jobType, healthcheck.TranslationId("health.rule.job_stuck.message.collected_at_unknown"))
		}

		job := latestJob(jobs)
		if job == nil || job.Status != model.JobStatusInProgress {
			return healthcheck.ResolvedSubject(jobType)
		}

		idle := s.CollectedAt.Sub(time.UnixMilli(job.LastActivityAt))
		if idle <= stuckAfter {
			return healthcheck.ResolvedSubject(jobType)
		}

		return healthcheck.FiringSubject(jobType, healthcheck.TranslationId("health.rule.job_stuck.message")).
			WithDetail("job_type", jobType).
			WithDetail("job_id", job.Id).
			WithDetail("hours", hours(idle))
	})
}

func evalJobWedgedAtZero(s *healthcheck.Snapshot) []healthcheck.Result {
	return evalJobTypes(s, progressJobTypes, healthcheck.TranslationId("health.rule.job_wedged_at_zero.message.jobs_unavailable"), func(jobType string, jobs []*model.Job) healthcheck.Result {
		if s.CollectedAt.IsZero() {
			return healthcheck.UnknownSubject(jobType, healthcheck.TranslationId("health.rule.job_wedged_at_zero.message.collected_at_unknown"))
		}

		job := latestJob(jobs)
		if job == nil || job.Status != model.JobStatusInProgress || job.Progress != 0 {
			return healthcheck.ResolvedSubject(jobType)
		}

		running := s.CollectedAt.Sub(time.UnixMilli(job.StartAt))
		if running <= wedgedAfter {
			return healthcheck.ResolvedSubject(jobType)
		}

		return healthcheck.FiringSubject(jobType, healthcheck.TranslationId("health.rule.job_wedged_at_zero.message")).
			WithDetail("job_type", jobType).
			WithDetail("job_id", job.Id).
			WithDetail("hours", hours(running))
	})
}

func evalJobFailed(s *healthcheck.Snapshot) []healthcheck.Result {
	return evalJobTypes(s, monitoredJobTypes, healthcheck.TranslationId("health.rule.job_failed.message.jobs_unavailable"), func(jobType string, jobs []*model.Job) healthcheck.Result {
		job := latestTerminalJob(jobs)
		if job == nil || job.Status != model.JobStatusError {
			return healthcheck.ResolvedSubject(jobType)
		}

		jobError := job.Data["error"]
		if jobError == "" {
			return healthcheck.FiringSubject(jobType, healthcheck.TranslationId("health.rule.job_failed.message.no_error")).
				WithDetail("job_type", jobType).
				WithDetail("job_id", job.Id)
		}

		return healthcheck.FiringSubject(jobType, healthcheck.TranslationId("health.rule.job_failed.message")).
			WithDetail("job_type", jobType).
			WithDetail("job_id", job.Id).
			WithDetail("error", jobError)
	})
}
