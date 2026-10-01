// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package compliance

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func auditSnapshot(fileEnabled bool, advanced string, users *int64) *healthcheck.Snapshot {
	s := configSnapshot(func(cfg *model.Config) {
		cfg.ExperimentalAuditSettings.FileEnabled = new(fileEnabled)
		cfg.ExperimentalAuditSettings.AdvancedLoggingJSON = json.RawMessage(advanced)
	})
	if users != nil {
		s.Stats = &model.SupportPacketStats{RegisteredUsers: users}
		s.Sections[model.SectionStats] = nil
	}
	return s
}

func auditTarget(levels ...string) string {
	return `{"audit": {"type": "file", "format": "json", "levels": [` + strings.Join(levels, ",") + `], "options": {"filename": "audit.log"}}}`
}

func TestAuditLoggingActive(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name     string
		settings model.ExperimentalAuditSettings
		want     bool
	}{
		{name: "file enabled", settings: model.ExperimentalAuditSettings{FileEnabled: new(true)}, want: true},
		{name: "file enabled absent", settings: model.ExperimentalAuditSettings{}, want: false},
		{name: "file disabled, empty advanced", settings: model.ExperimentalAuditSettings{FileEnabled: new(false), AdvancedLoggingJSON: json.RawMessage(`{}`)}, want: false},
		{name: "advanced audit-api target", settings: model.ExperimentalAuditSettings{FileEnabled: new(false), AdvancedLoggingJSON: json.RawMessage(auditTarget(`{"id": 100, "name": "audit-api"}`))}, want: true},
		{name: "advanced audit-cli target", settings: model.ExperimentalAuditSettings{FileEnabled: new(false), AdvancedLoggingJSON: json.RawMessage(auditTarget(`{"id": 103, "name": "audit-cli"}`))}, want: true},
		{name: "advanced audit-delivery only", settings: model.ExperimentalAuditSettings{FileEnabled: new(false), AdvancedLoggingJSON: json.RawMessage(auditTarget(`{"id": 104, "name": "audit-delivery"}`))}, want: false},
		{name: "advanced non-audit levels", settings: model.ExperimentalAuditSettings{FileEnabled: new(false), AdvancedLoggingJSON: json.RawMessage(auditTarget(`{"id": 4, "name": "info"}`, `{"id": 2, "name": "error"}`))}, want: false},
		{name: "advanced malformed", settings: model.ExperimentalAuditSettings{FileEnabled: new(false), AdvancedLoggingJSON: json.RawMessage(`{"audit":`)}, want: false},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assert.Equal(t, tc.want, auditLoggingActive(tc.settings))
		})
	}
}

func TestAuditLogOff(t *testing.T) {
	t.Parallel()

	firing := "health.rule.audit_log_off.message"

	testCases := []struct {
		name      string
		snapshot  *healthcheck.Snapshot
		state     healthcheck.State
		messageID string
		value     *float64
		users     string
	}{
		{
			name:     "file enabled with stats absent",
			snapshot: auditSnapshot(true, "", nil),
			state:    healthcheck.StateResolved,
		},
		{
			name:     "advanced audit-api target with many users",
			snapshot: auditSnapshot(false, auditTarget(`{"id": 100, "name": "audit-api"}`), new(int64(50000))),
			state:    healthcheck.StateResolved,
		},
		{
			name:      "advanced audit-delivery only counts as inactive",
			snapshot:  auditSnapshot(false, auditTarget(`{"id": 104, "name": "audit-delivery"}`), new(int64(5001))),
			state:     healthcheck.StateFiring,
			messageID: firing,
			value:     new(5001.0),
			users:     "5001",
		},
		{
			name:      "inactive with stats absent",
			snapshot:  auditSnapshot(false, "", nil),
			state:     healthcheck.StateUnknown,
			messageID: healthcheck.ReasonStatsUnavailable,
		},
		{
			name:     "inactive at the threshold",
			snapshot: auditSnapshot(false, "", new(int64(5000))),
			state:    healthcheck.StateResolved,
			value:    new(5000.0),
		},
		{
			name:      "inactive above the threshold",
			snapshot:  auditSnapshot(false, "", new(int64(5001))),
			state:     healthcheck.StateFiring,
			messageID: firing,
			value:     new(5001.0),
			users:     "5001",
		},
		{
			name:      "file enabled absent",
			snapshot:  configSnapshot(func(cfg *model.Config) { cfg.ExperimentalAuditSettings.FileEnabled = nil }),
			state:     healthcheck.StateUnknown,
			messageID: healthcheck.ReasonConfigUnavailable,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			results := evalAuditLogOff(tc.snapshot)
			require.Len(t, results, 1)
			assert.Equal(t, tc.state, results[0].State)
			assert.Equal(t, tc.messageID, results[0].MessageID)
			assert.Equal(t, tc.value, results[0].Value)
			assert.Equal(t, tc.users, results[0].Details["users"])
		})
	}
}
