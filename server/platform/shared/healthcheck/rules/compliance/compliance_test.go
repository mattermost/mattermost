// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package compliance

import (
	"errors"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func configSnapshot(update func(cfg *model.Config)) *healthcheck.Snapshot {
	cfg := &model.Config{}
	cfg.SetDefaults()
	update(cfg)

	return &healthcheck.Snapshot{
		Config:   &model.SupportPacketConfig{Config: cfg},
		Sections: map[model.WorkspaceSection]error{model.SectionConfig: nil},
	}
}

type ruleWant struct {
	state     healthcheck.State
	messageID string
	value     string
}

func assertResult(t *testing.T, rule healthcheck.Rule, s *healthcheck.Snapshot, want ruleWant) {
	t.Helper()

	results := rule.Eval(s)
	require.Len(t, results, 1)
	assert.Equal(t, want.state, results[0].State)
	assert.Equal(t, want.messageID, results[0].MessageID)
	assert.Equal(t, want.value, results[0].Details["value"])
}

var (
	resolved = ruleWant{state: healthcheck.StateResolved}
	unknown  = ruleWant{state: healthcheck.StateUnknown, messageID: healthcheck.ReasonConfigUnavailable}
)

func TestRegistered(t *testing.T) {
	for _, code := range []string{"COMPLIANCE_NO_DIR", "AUDIT_LOG_OFF", "RETENTION_TIGHT_BATCHES", "EXPORT_GR_TIMEOUT_LOW"} {
		_, ok := healthcheck.Builtin().Get(code)
		assert.True(t, ok, code)
	}
}

func TestRulesConfigUnavailable(t *testing.T) {
	t.Parallel()

	failed := configSnapshot(func(*model.Config) {})
	failed.Sections[model.SectionConfig] = errors.New("boom")

	for _, rule := range []healthcheck.Rule{complianceNoDir, auditLogOff, retentionTightBatches, exportGRTimeoutLow} {
		t.Run(rule.Code, func(t *testing.T) {
			t.Parallel()

			assertResult(t, rule, &healthcheck.Snapshot{}, unknown)
			assertResult(t, rule, failed, unknown)
		})
	}
}

func TestComplianceNoDir(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name   string
		update func(cfg *model.Config)
		want   ruleWant
	}{
		{
			name: "enabled with empty directory",
			update: func(cfg *model.Config) {
				cfg.ComplianceSettings.Enable = new(true)
				cfg.ComplianceSettings.Directory = new("")
			},
			want: ruleWant{state: healthcheck.StateFiring, messageID: "health.rule.compliance_no_dir.message"},
		},
		{
			name: "enabled with directory",
			update: func(cfg *model.Config) {
				cfg.ComplianceSettings.Enable = new(true)
				cfg.ComplianceSettings.Directory = new("/var/mattermost/compliance/")
			},
			want: resolved,
		},
		{
			name: "disabled with empty directory",
			update: func(cfg *model.Config) {
				cfg.ComplianceSettings.Enable = new(false)
				cfg.ComplianceSettings.Directory = new("")
			},
			want: resolved,
		},
		{
			name:   "enable absent",
			update: func(cfg *model.Config) { cfg.ComplianceSettings.Enable = nil },
			want:   unknown,
		},
		{
			name: "enabled with directory absent",
			update: func(cfg *model.Config) {
				cfg.ComplianceSettings.Enable = new(true)
				cfg.ComplianceSettings.Directory = nil
			},
			want: unknown,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResult(t, complianceNoDir, configSnapshot(tc.update), tc.want)
		})
	}
}

func TestRetentionTightBatches(t *testing.T) {
	t.Parallel()

	firing := func(value string) ruleWant {
		return ruleWant{state: healthcheck.StateFiring, messageID: "health.rule.retention_tight_batches.message", value: value}
	}
	retention := func(messages, files bool, pause int) func(cfg *model.Config) {
		return func(cfg *model.Config) {
			cfg.DataRetentionSettings.EnableMessageDeletion = new(messages)
			cfg.DataRetentionSettings.EnableFileDeletion = new(files)
			cfg.DataRetentionSettings.TimeBetweenBatchesMilliseconds = new(pause)
		}
	}

	testCases := []struct {
		name   string
		update func(cfg *model.Config)
		want   ruleWant
	}{
		{name: "message deletion with no pause", update: retention(true, false, 0), want: firing("0")},
		{name: "file deletion just below the minimum", update: retention(false, true, 99), want: firing("99")},
		{name: "default pause", update: retention(true, true, 100), want: resolved},
		{name: "deletion off with tight batches", update: retention(false, false, 10), want: resolved},
		{
			name:   "message deletion absent",
			update: func(cfg *model.Config) { cfg.DataRetentionSettings.EnableMessageDeletion = nil },
			want:   unknown,
		},
		{
			name:   "file deletion absent",
			update: func(cfg *model.Config) { cfg.DataRetentionSettings.EnableFileDeletion = nil },
			want:   unknown,
		},
		{
			name: "pause absent",
			update: func(cfg *model.Config) {
				retention(true, false, 0)(cfg)
				cfg.DataRetentionSettings.TimeBetweenBatchesMilliseconds = nil
			},
			want: unknown,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResult(t, retentionTightBatches, configSnapshot(tc.update), tc.want)
		})
	}
}

func TestExportGRTimeoutLow(t *testing.T) {
	t.Parallel()

	export := func(format string, timeout int) func(cfg *model.Config) {
		return func(cfg *model.Config) {
			cfg.MessageExportSettings.EnableExport = new(true)
			cfg.MessageExportSettings.ExportFormat = new(format)
			cfg.MessageExportSettings.GlobalRelaySettings.SMTPServerTimeout = new(timeout)
		}
	}

	testCases := []struct {
		name   string
		update func(cfg *model.Config)
		want   ruleWant
	}{
		{
			name:   "globalrelay just below the minimum",
			update: export(model.ComplianceExportTypeGlobalrelay, 29),
			want:   ruleWant{state: healthcheck.StateFiring, messageID: "health.rule.export_gr_timeout_low.message", value: "29"},
		},
		{name: "globalrelay at the minimum", update: export(model.ComplianceExportTypeGlobalrelay, 30), want: resolved},
		{name: "globalrelay default timeout", update: export(model.ComplianceExportTypeGlobalrelay, 1800), want: resolved},
		{name: "globalrelay-zip never opens SMTP", update: export(model.ComplianceExportTypeGlobalrelayZip, 5), want: resolved},
		{name: "actiance", update: export(model.ComplianceExportTypeActiance, 5), want: resolved},
		{
			name: "export disabled",
			update: func(cfg *model.Config) {
				export(model.ComplianceExportTypeGlobalrelay, 5)(cfg)
				cfg.MessageExportSettings.EnableExport = new(false)
			},
			want: resolved,
		},
		{
			name:   "enable absent",
			update: func(cfg *model.Config) { cfg.MessageExportSettings.EnableExport = nil },
			want:   unknown,
		},
		{
			name: "format absent",
			update: func(cfg *model.Config) {
				cfg.MessageExportSettings.EnableExport = new(true)
				cfg.MessageExportSettings.ExportFormat = nil
			},
			want: unknown,
		},
		{
			name: "global relay settings absent",
			update: func(cfg *model.Config) {
				export(model.ComplianceExportTypeGlobalrelay, 5)(cfg)
				cfg.MessageExportSettings.GlobalRelaySettings = nil
			},
			want: unknown,
		},
		{
			name: "timeout absent",
			update: func(cfg *model.Config) {
				export(model.ComplianceExportTypeGlobalrelay, 5)(cfg)
				cfg.MessageExportSettings.GlobalRelaySettings.SMTPServerTimeout = nil
			},
			want: unknown,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResult(t, exportGRTimeoutLow, configSnapshot(tc.update), tc.want)
		})
	}
}
