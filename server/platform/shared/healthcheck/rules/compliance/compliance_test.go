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

type want struct {
	state     healthcheck.State
	messageID string
	details   map[string]string
	value     *float64
}

var (
	resolved      = want{state: healthcheck.StateResolved}
	configUnknown = want{state: healthcheck.StateUnknown, messageID: healthcheck.ReasonConfigUnavailable}
	statsUnknown  = want{state: healthcheck.StateUnknown, messageID: healthcheck.ReasonStatsUnavailable}
)

func firing(messageID string, details map[string]string) want {
	return want{state: healthcheck.StateFiring, messageID: messageID, details: details}
}

func (w want) withValue(v float64) want {
	w.value = &v
	return w
}

// configSnapshot returns a snapshot over nodes whose config holds the server defaults, changed by mutate.
func configSnapshot(mutate func(*model.Config), nodes ...*healthcheck.NodeSnapshot) *healthcheck.Snapshot {
	cfg := &model.Config{}
	cfg.SetDefaults()
	if mutate != nil {
		mutate(cfg)
	}

	s := healthcheck.NewSnapshot(nodes)
	s.Config = &model.SupportPacketConfig{Config: cfg}
	s.Sections = map[model.WorkspaceSection]error{model.SectionConfig: nil}
	return s
}

func withUsers(s *healthcheck.Snapshot, users int64) *healthcheck.Snapshot {
	s.Stats = &model.SupportPacketStats{RegisteredUsers: new(users)}
	s.Sections[model.SectionStats] = nil
	return s
}

func assertResult(t *testing.T, expected want, results []healthcheck.Result, msgAndArgs ...any) {
	t.Helper()

	require.Len(t, results, 1, msgAndArgs...)
	assert.Equal(t, expected.state, results[0].State, msgAndArgs...)
	assert.Equal(t, expected.messageID, results[0].MessageID, msgAndArgs...)
	assert.Equal(t, expected.details, results[0].Details, msgAndArgs...)
	assert.Equal(t, expected.value, results[0].Value, msgAndArgs...)
}

func TestRulesConfigUnavailable(t *testing.T) {
	t.Parallel()

	failed := configSnapshot(func(*model.Config) {})
	failed.Sections[model.SectionConfig] = errors.New("boom")

	for _, rule := range []healthcheck.Rule{complianceNoDir, auditLogOff, retentionTightBatches, exportGRTimeoutLow} {
		t.Run(rule.Code, func(t *testing.T) {
			t.Parallel()

			assertResult(t, configUnknown, rule.Eval(&healthcheck.Snapshot{}))
			assertResult(t, configUnknown, rule.Eval(failed))
		})
	}
}

func TestComplianceNoDir(t *testing.T) {
	t.Parallel()

	compliance := func(enable bool, dir string) func(cfg *model.Config) {
		return func(cfg *model.Config) {
			cfg.ComplianceSettings.Enable = new(enable)
			cfg.ComplianceSettings.Directory = new(dir)
		}
	}

	testCases := []struct {
		name   string
		update func(cfg *model.Config)
		want   want
	}{
		{name: "enabled with empty directory", update: compliance(true, ""), want: firing("health.rule.compliance_no_dir.message", nil)},
		{name: "enabled with directory", update: compliance(true, "/var/mattermost/compliance/"), want: resolved},
		{name: "disabled with empty directory", update: compliance(false, ""), want: resolved},
		{
			name:   "enable absent",
			update: func(cfg *model.Config) { cfg.ComplianceSettings.Enable = nil },
			want:   configUnknown,
		},
		{
			name: "enabled with directory absent",
			update: func(cfg *model.Config) {
				compliance(true, "")(cfg)
				cfg.ComplianceSettings.Directory = nil
			},
			want: configUnknown,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResult(t, tc.want, complianceNoDir.Eval(configSnapshot(tc.update)))
		})
	}
}

func TestRetentionTightBatches(t *testing.T) {
	t.Parallel()

	tight := func(value string) want {
		return firing("health.rule.retention_tight_batches.message", map[string]string{"value": value})
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
		want   want
	}{
		{name: "message deletion with no pause", update: retention(true, false, 0), want: tight("0")},
		{name: "file deletion just below the minimum", update: retention(false, true, 99), want: tight("99")},
		{name: "default pause", update: retention(true, true, 100), want: resolved},
		{name: "deletion off with tight batches", update: retention(false, false, 10), want: resolved},
		{
			name:   "message deletion absent",
			update: func(cfg *model.Config) { cfg.DataRetentionSettings.EnableMessageDeletion = nil },
			want:   configUnknown,
		},
		{
			name:   "file deletion absent",
			update: func(cfg *model.Config) { cfg.DataRetentionSettings.EnableFileDeletion = nil },
			want:   configUnknown,
		},
		{
			name: "pause absent",
			update: func(cfg *model.Config) {
				retention(true, false, 0)(cfg)
				cfg.DataRetentionSettings.TimeBetweenBatchesMilliseconds = nil
			},
			want: configUnknown,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResult(t, tc.want, retentionTightBatches.Eval(configSnapshot(tc.update)))
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
		want   want
	}{
		{
			name:   "globalrelay just below the minimum",
			update: export(model.ComplianceExportTypeGlobalrelay, 29),
			want:   firing("health.rule.export_gr_timeout_low.message", map[string]string{"value": "29"}),
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
			want:   configUnknown,
		},
		{
			name: "format absent",
			update: func(cfg *model.Config) {
				cfg.MessageExportSettings.EnableExport = new(true)
				cfg.MessageExportSettings.ExportFormat = nil
			},
			want: configUnknown,
		},
		{
			name: "global relay settings absent",
			update: func(cfg *model.Config) {
				export(model.ComplianceExportTypeGlobalrelay, 5)(cfg)
				cfg.MessageExportSettings.GlobalRelaySettings = nil
			},
			want: configUnknown,
		},
		{
			name: "timeout absent",
			update: func(cfg *model.Config) {
				export(model.ComplianceExportTypeGlobalrelay, 5)(cfg)
				cfg.MessageExportSettings.GlobalRelaySettings.SMTPServerTimeout = nil
			},
			want: configUnknown,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResult(t, tc.want, exportGRTimeoutLow.Eval(configSnapshot(tc.update)))
		})
	}
}
