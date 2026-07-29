// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// TestAccessControlPolicyContainmentIndexes checks that the two jsonb GIN
// indexes can actually serve the containment predicates the store writes. The
// indexes only help if every call site spells the predicate in the indexed
// form, and a form that does not match is silently answered by a sequential
// scan — correct, but with the index unused.
//
// Sequential scans are disabled for the duration so the assertion is about
// whether the planner *can* use the index, not about row counts: on a small
// table a seq scan wins on cost even when the index matches.
func TestAccessControlPolicyContainmentIndexes(t *testing.T) {
	logger := mlog.CreateTestLogger(t)

	settings, err := makeSqlSettings(model.DatabaseDriverPostgres)
	if err != nil {
		t.Skip(err)
	}

	store, err := New(*settings, logger, nil)
	require.NoError(t, err)
	defer store.Close()

	master := store.GetMaster()

	// A row so the planner has something to reason about, and so a mismatched
	// predicate cannot be answered by a trivially empty scan.
	parentID := model.NewId()
	policy := &model.AccessControlPolicy{
		ID:       model.NewId(),
		Name:     "index-probe-" + model.NewId(),
		Type:     model.AccessControlPolicyTypeChannel,
		Revision: 1,
		Version:  model.AccessControlPolicyVersionV0_3,
		Imports:  []string{parentID},
		Rules: []model.AccessControlPolicyRule{{
			Actions:    []string{model.AccessControlPolicyActionMembership},
			Expression: `user.attributes.program == "engineering"`,
		}},
	}
	policy.SetAutoAddMode(model.AccessControlAutoAddAlways)
	_, err = store.AccessControlPolicy().Save(nil, policy)
	require.NoError(t, err)
	t.Cleanup(func() { _ = store.AccessControlPolicy().Delete(nil, policy.ID) })

	_, err = master.ExecNoTimeout("ANALYZE AccessControlPolicies")
	require.NoError(t, err)

	explain := func(t *testing.T, query string, args ...any) string {
		t.Helper()
		_, sErr := master.Exec("SET enable_seqscan = off")
		require.NoError(t, sErr)
		t.Cleanup(func() { master.Exec("SET enable_seqscan = on") }) //nolint:errcheck

		var lines []string
		require.NoError(t, master.Select(&lines, "EXPLAIN "+query, args...))
		return strings.Join(lines, "\n")
	}

	for _, tc := range []struct {
		name  string
		index string
		query string
		args  []any
	}{
		{
			name:  "auto-add containment uses the rules index",
			index: "idx_access_control_policies_rules",
			query: "SELECT ID FROM AccessControlPolicies WHERE " + autoAddMembersContainment,
		},
		{
			name:  "parent lookup uses the imports index",
			index: "idx_access_control_policies_imports",
			query: "SELECT ID FROM AccessControlPolicies WHERE Data->'imports' @> jsonb_build_array(?::text)",
			args:  []any{parentID},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			plan := explain(t, tc.query, tc.args...)
			require.Contains(t, plan, tc.index, "predicate must be served by the index, plan was:\n%s", plan)
		})
	}
}
