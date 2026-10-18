// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package compliance

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

func audit(fileEnabled bool, advanced string) func(cfg *model.Config) {
	return func(cfg *model.Config) {
		cfg.ExperimentalAuditSettings.FileEnabled = new(fileEnabled)
		cfg.ExperimentalAuditSettings.AdvancedLoggingJSON = json.RawMessage(advanced)
	}
}

func leaderWithAdvancedLogging(licensed bool) *healthcheck.NodeSnapshot {
	diag := &model.SupportPacketDiagnostics{License: model.SupportPacketLicense{
		Features: &model.Features{AdvancedLogging: new(licensed)},
	}}
	return &healthcheck.NodeSnapshot{
		Hostname:    "app-1",
		IsLeader:    true,
		Diagnostics: &model.NodeDiagnostics{Diagnostics: diag},
	}
}

func auditTarget(levels ...string) string {
	return `{"audit": {"type": "file", "format": "json", "levels": [` + strings.Join(levels, ",") + `], "options": {"filename": "audit.log"}}}`
}

func TestAuditLogOff(t *testing.T) {
	t.Parallel()

	apiTarget := auditTarget(`{"id": 100, "name": "audit-api"}`)
	off := func(users string) want {
		return firing("health.rule.audit_log_off.message", map[string]string{"users": users})
	}

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     want
	}{
		{"file enabled with stats absent", configSnapshot(audit(true, "")), resolved},
		{"advanced audit-api target with many users", withUsers(configSnapshot(audit(false, apiTarget)), 50000), resolved},
		{"advanced audit-api target with advanced logging licensed", withUsers(configSnapshot(audit(false, apiTarget), leaderWithAdvancedLogging(true)), 50000), resolved},
		{"advanced audit-api target without advanced logging license", withUsers(configSnapshot(audit(false, apiTarget), leaderWithAdvancedLogging(false)), 5001), off("5001").withValue(5001)},
		{"advanced audit-delivery only counts as inactive", withUsers(configSnapshot(audit(false, auditTarget(`{"id": 104, "name": "audit-delivery"}`))), 5001), off("5001").withValue(5001)},
		{"inactive with stats absent", configSnapshot(audit(false, "")), statsUnknown},
		{"inactive at the threshold", withUsers(configSnapshot(audit(false, "")), 5000), resolved.withValue(5000)},
		{"inactive above the threshold", withUsers(configSnapshot(audit(false, "")), 5001), off("5001").withValue(5001)},
		{"file enabled absent", configSnapshot(func(cfg *model.Config) { cfg.ExperimentalAuditSettings.FileEnabled = nil }), configUnknown},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResult(t, tc.want, evalAuditLogOff(tc.snapshot))
		})
	}
}
