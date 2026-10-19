// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package compliance

import (
	"strconv"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

func init() {
	healthcheck.Register(complianceNoDir, auditLogOff, retentionTightBatches, exportGRTimeoutLow)
}

const (
	minTimeBetweenBatchesMilliseconds = model.DataRetentionSettingsDefaultTimeBetweenBatchesMilliseconds
	minGlobalRelaySMTPTimeoutSeconds  = 30

	// The job is scheduled daily; the window tolerates one missed run.
	retentionJobWindow = 48 * time.Hour
)

var complianceNoDir = healthcheck.Rule{
	Code:     "COMPLIANCE_NO_DIR",
	Area:     model.AreaCompliance,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.compliance_no_dir.title"),
		RemediationID: healthcheck.TranslationId("health.rule.compliance_no_dir.remediation"),
		DocsURL:       "https://mattermost.com/pl/compliance-monitoring",
		ConsolePath:   "/admin_console/compliance/monitoring",
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Subject:    "ComplianceSettings.Directory",
	Eval:       evalComplianceNoDir,
}

var retentionTightBatches = healthcheck.Rule{
	Code:     "RETENTION_TIGHT_BATCHES",
	Area:     model.AreaCompliance,
	Severity: healthcheck.SeverityInfo,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.retention_tight_batches.title"),
		RemediationID: healthcheck.TranslationId("health.rule.retention_tight_batches.remediation"),
		DocsURL:       "https://mattermost.com/pl/data-retention-policy",
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Subject:    "DataRetentionSettings.TimeBetweenBatchesMilliseconds",
	Eval:       evalRetentionTightBatches,
}

var exportGRTimeoutLow = healthcheck.Rule{
	Code:     "EXPORT_GR_TIMEOUT_LOW",
	Area:     model.AreaCompliance,
	Severity: healthcheck.SeverityInfo,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.export_gr_timeout_low.title"),
		RemediationID: healthcheck.TranslationId("health.rule.export_gr_timeout_low.remediation"),
		DocsURL:       "https://mattermost.com/pl/compliance-export",
		ConsolePath:   "/admin_console/compliance/export",
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Subject:    "MessageExportSettings.GlobalRelaySettings.SMTPServerTimeout",
	Eval:       evalExportGRTimeoutLow,
}

// licensed reports whether the license grants a feature the rule's runtime requires.
func licensed(s *healthcheck.Snapshot, feature func(*model.Features) *bool) (granted bool, unknownReason string) {
	license, ok := s.License()
	if !ok {
		return false, healthcheck.ReasonLicenseUnavailable
	}
	// Unlicensed servers also report no features.
	if license.Features == nil && license.SkuShortName == "" {
		return false, ""
	}

	granted, ok = s.LicenseFeature(feature)
	if !ok {
		return false, healthcheck.ReasonLicenseUnavailable
	}
	return granted, ""
}

func evalComplianceNoDir(s *healthcheck.Snapshot) []healthcheck.Result {
	granted, reason := licensed(s, func(f *model.Features) *bool { return f.Compliance })
	if reason != "" {
		return []healthcheck.Result{healthcheck.Unknown(reason)}
	}
	if !granted {
		return []healthcheck.Result{healthcheck.Resolved()}
	}

	enabled, ok := s.ConfigBool(func(cfg *model.Config) *bool { return cfg.ComplianceSettings.Enable })
	if !ok {
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)}
	}
	if !enabled {
		return []healthcheck.Result{healthcheck.Resolved()}
	}

	dir, ok := s.ConfigString(func(cfg *model.Config) *string { return cfg.ComplianceSettings.Directory })
	switch {
	case !ok:
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)}
	case dir == "":
		return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.compliance_no_dir.message"))}
	default:
		return []healthcheck.Result{healthcheck.Resolved()}
	}
}

// retentionRuns reports whether the deletion job runs; custom policies run it with the global policy off, which only job history shows.
func retentionRuns(s *healthcheck.Snapshot) (runs bool, unknownReason string) {
	messages, ok := s.ConfigBool(func(cfg *model.Config) *bool { return cfg.DataRetentionSettings.EnableMessageDeletion })
	if !ok {
		return false, healthcheck.ReasonConfigUnavailable
	}
	files, ok := s.ConfigBool(func(cfg *model.Config) *bool { return cfg.DataRetentionSettings.EnableFileDeletion })
	if !ok {
		return false, healthcheck.ReasonConfigUnavailable
	}
	if messages || files {
		return true, ""
	}

	jobs, ok := s.JobsFor(model.JobTypeDataRetention)
	if !ok {
		return false, healthcheck.ReasonJobsUnavailable
	}
	if s.CollectedAt.IsZero() {
		return false, healthcheck.ReasonCollectedAtUnknown
	}
	for _, job := range jobs {
		if job != nil && s.CollectedAt.Sub(time.UnixMilli(job.CreateAt)) <= retentionJobWindow {
			return true, ""
		}
	}

	return false, ""
}

func evalRetentionTightBatches(s *healthcheck.Snapshot) []healthcheck.Result {
	granted, reason := licensed(s, func(f *model.Features) *bool { return f.DataRetention })
	if reason != "" {
		return []healthcheck.Result{healthcheck.Unknown(reason)}
	}
	if !granted {
		return []healthcheck.Result{healthcheck.Resolved()}
	}

	runs, reason := retentionRuns(s)
	if reason != "" {
		return []healthcheck.Result{healthcheck.Unknown(reason)}
	}
	if !runs {
		return []healthcheck.Result{healthcheck.Resolved()}
	}

	pause, ok := s.ConfigInt(func(cfg *model.Config) *int { return cfg.DataRetentionSettings.TimeBetweenBatchesMilliseconds })
	switch {
	case !ok:
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)}
	case pause < minTimeBetweenBatchesMilliseconds:
		return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.retention_tight_batches.message")).WithDetail("value", strconv.Itoa(pause))}
	default:
		return []healthcheck.Result{healthcheck.Resolved()}
	}
}

// globalRelayEnabled reports whether export delivers over SMTP; globalrelay-zip only produces a download.
func globalRelayEnabled(s *healthcheck.Snapshot) (enabled, ok bool) {
	export, ok := s.ConfigBool(func(cfg *model.Config) *bool { return cfg.MessageExportSettings.EnableExport })
	if !ok || !export {
		return false, ok
	}

	format, ok := s.ConfigString(func(cfg *model.Config) *string { return cfg.MessageExportSettings.ExportFormat })
	return format == model.ComplianceExportTypeGlobalrelay, ok
}

func evalExportGRTimeoutLow(s *healthcheck.Snapshot) []healthcheck.Result {
	granted, reason := licensed(s, func(f *model.Features) *bool { return f.MessageExport })
	if reason != "" {
		return []healthcheck.Result{healthcheck.Unknown(reason)}
	}
	if !granted {
		return []healthcheck.Result{healthcheck.Resolved()}
	}

	enabled, ok := globalRelayEnabled(s)
	if !ok {
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)}
	}
	if !enabled {
		return []healthcheck.Result{healthcheck.Resolved()}
	}

	timeout, ok := s.ConfigInt(func(cfg *model.Config) *int {
		if cfg.MessageExportSettings.GlobalRelaySettings == nil {
			return nil
		}
		return cfg.MessageExportSettings.GlobalRelaySettings.SMTPServerTimeout
	})
	switch {
	case !ok:
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)}
	case timeout < minGlobalRelaySMTPTimeoutSeconds:
		return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.export_gr_timeout_low.message")).WithDetail("value", strconv.Itoa(timeout))}
	default:
		return []healthcheck.Result{healthcheck.Resolved()}
	}
}
