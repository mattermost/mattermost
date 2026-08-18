// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// TestMigration000216 covers the backfill that moves auto-add off the Active
// column and onto the membership rule's metadata as an auto-add mode. The three interesting shapes
// are a policy with a membership rule, an active import-only policy that needs a
// carrier rule, and an inactive policy that must stay untouched.
func TestMigration000216(t *testing.T) {
	logger := mlog.CreateTestLogger(t)

	settings, err := makeSqlSettings(model.DatabaseDriverPostgres)
	if err != nil {
		t.Skip(err)
	}

	store, err := New(*settings, logger, nil)
	require.NoError(t, err)
	defer store.Close()

	master := store.GetMaster()

	upSQL := readMigrationSQL(t, "000216_move_auto_add_to_membership_rule.up.sql")
	downSQL := readMigrationSQL(t, "000216_move_auto_add_to_membership_rule.down.sql")

	insert := func(t *testing.T, policyType string, active bool, data string) string {
		t.Helper()
		id := model.NewId()
		_, iErr := master.Exec(
			`INSERT INTO AccessControlPolicies (ID, Name, Type, Active, CreateAt, Revision, Version, Data)
			VALUES (?, ?, ?, ?, ?, 1, 'v0.3', ?::jsonb)`,
			id, "policy-"+id, policyType, active, model.GetMillis(), data,
		)
		require.NoError(t, iErr)
		t.Cleanup(func() {
			master.Exec("DELETE FROM AccessControlPolicies WHERE ID = ?", id) //nolint:errcheck
		})
		return id
	}

	// read returns the policy through the store so assertions go through the same
	// deserialization the application uses.
	read := func(t *testing.T, id string) *model.AccessControlPolicy {
		t.Helper()
		policy, gErr := store.AccessControlPolicy().Get(nil, id)
		require.NoError(t, gErr)
		return policy
	}

	activeWithRule := insert(t, model.AccessControlPolicyTypeChannel, true,
		`{"rules": [{"actions": ["membership"], "expression": "user.attributes.team == \"eng\""}]}`)
	activeLegacyWildcard := insert(t, model.AccessControlPolicyTypeChannel, true,
		`{"rules": [{"actions": ["*"], "expression": "true"}]}`)
	activeImportOnly := insert(t, model.AccessControlPolicyTypeChannel, true,
		`{"rules": [], "imports": ["`+model.NewId()+`"]}`)
	inactiveWithRule := insert(t, model.AccessControlPolicyTypeChannel, false,
		`{"rules": [{"actions": ["membership"], "expression": "user.attributes.team == \"eng\""}]}`)
	inactiveImportOnly := insert(t, model.AccessControlPolicyTypeChannel, false,
		`{"rules": [], "imports": ["`+model.NewId()+`"]}`)

	// A permission rule alongside the membership rule must not pick up the flag,
	// and rule order must survive the rewrite.
	activeMixedRules := insert(t, model.AccessControlPolicyTypeChannel, true,
		`{"rules": [
			{"name": "Uploads", "role": "channel_user", "actions": ["upload_file_attachment"], "expression": "a"},
			{"actions": ["membership"], "expression": "b"},
			{"name": "Downloads", "role": "channel_user", "actions": ["download_file_attachment"], "expression": "c"}
		]}`)

	_, err = master.ExecNoTimeout(upSQL)
	require.NoError(t, err, "up migration should succeed")

	t.Run("stamps the always mode on an existing membership rule", func(t *testing.T) {
		policy := read(t, activeWithRule)
		assert.Equal(t, model.AccessControlAutoAddAlways, policy.AutoAddMode())
		assert.Len(t, policy.Rules, 1, "no carrier rule is added when one already exists")
		assert.Equal(t, `user.attributes.team == "eng"`, policy.Rules[0].Expression)
	})

	t.Run("recognizes a legacy wildcard rule as the membership rule", func(t *testing.T) {
		policy := read(t, activeLegacyWildcard)
		assert.True(t, policy.AutoAddMembers())
		assert.Len(t, policy.Rules, 1)
	})

	t.Run("gives an active import-only policy a carrier rule", func(t *testing.T) {
		policy := read(t, activeImportOnly)
		assert.True(t, policy.AutoAddMembers())
		require.Len(t, policy.Rules, 1)
		assert.Empty(t, policy.Rules[0].Expression, "the carrier must not affect evaluation")
		assert.False(t, policy.HasEffectiveRules())
	})

	t.Run("leaves inactive policies alone", func(t *testing.T) {
		withRule := read(t, inactiveWithRule)
		assert.False(t, withRule.AutoAddMembers())
		assert.Nil(t, withRule.Rules[0].Metadata, "off is the absence of the key, not an empty mode")

		importOnly := read(t, inactiveImportOnly)
		assert.False(t, importOnly.AutoAddMembers())
		assert.Empty(t, importOnly.Rules, "an inactive import-only policy needs no carrier")
	})

	t.Run("only the membership rule is stamped, in place", func(t *testing.T) {
		policy := read(t, activeMixedRules)
		require.Len(t, policy.Rules, 3)
		assert.Equal(t, []string{"Uploads", "", "Downloads"}, []string{policy.Rules[0].Name, policy.Rules[1].Name, policy.Rules[2].Name})
		assert.Nil(t, policy.Rules[0].Metadata)
		assert.Equal(t, model.AccessControlAutoAddAlways, policy.Rules[1].AutoAddMode())
		assert.Nil(t, policy.Rules[2].Metadata)
	})

	t.Run("Active is left untouched so a rollback resumes prior behaviour", func(t *testing.T) {
		for _, tc := range []struct {
			id       string
			expected bool
		}{
			{activeWithRule, true},
			{activeImportOnly, true},
			{inactiveWithRule, false},
			{inactiveImportOnly, false},
		} {
			var active bool
			require.NoError(t, master.Get(&active, "SELECT Active FROM AccessControlPolicies WHERE ID = ?", tc.id))
			assert.Equal(t, tc.expected, active, "policy %s", tc.id)
		}
	})

	t.Run("re-running is idempotent", func(t *testing.T) {
		_, rErr := master.ExecNoTimeout(upSQL)
		require.NoError(t, rErr)

		assert.Len(t, read(t, activeImportOnly).Rules, 1, "a second run must not append another carrier")
		assert.Len(t, read(t, activeWithRule).Rules, 1)
	})

	t.Run("does not overwrite a mode that is already set", func(t *testing.T) {
		// A re-run after a rollback must not stamp "always" over a mode an
		// administrator chose in the meantime.
		id := insert(t, model.AccessControlPolicyTypeChannel, true,
			`{"rules": [{"actions": ["membership"], "expression": "x", "metadata": {"auto_add": "some_other_mode"}}]}`)

		_, upErr := master.ExecNoTimeout(upSQL)
		require.NoError(t, upErr)

		policy := read(t, id)
		require.Len(t, policy.Rules, 1, "the rule already anchors the membership slot, so no carrier is added")
		assert.Equal(t, "some_other_mode", policy.Rules[0].Metadata[model.AccessControlRuleMetadataAutoAdd])
	})

	t.Run("re-derives a cleared mode from Active", func(t *testing.T) {
		// Turning auto-add off deletes the key and the emptied bag, so the stored
		// shape becomes indistinguishable from a policy that predates the field.
		// A re-run therefore reads Active again. That is the intended coupling:
		// Active stays the rollback source of truth, and a re-run only happens
		// after a downgrade, which discards post-upgrade changes anyway.
		id := insert(t, model.AccessControlPolicyTypeChannel, true,
			`{"rules": [{"actions": ["membership"], "expression": "x"}]}`)

		_, upErr := master.ExecNoTimeout(upSQL)
		require.NoError(t, upErr)
		require.True(t, read(t, id).AutoAddMembers())

		// The shape an empty mode persists as: no key, and no bag either.
		_, updErr := master.Exec(
			`UPDATE AccessControlPolicies SET Data = ?::jsonb WHERE ID = ?`,
			`{"rules": [{"actions": ["membership"], "expression": "x"}]}`, id,
		)
		require.NoError(t, updErr)
		require.False(t, read(t, id).AutoAddMembers())

		_, upErr = master.ExecNoTimeout(upSQL)
		require.NoError(t, upErr)
		assert.True(t, read(t, id).AutoAddMembers())
	})

	t.Run("down strips the metadata and the carrier rules", func(t *testing.T) {
		_, dErr := master.ExecNoTimeout(downSQL)
		require.NoError(t, dErr)

		withRule := read(t, activeWithRule)
		assert.Nil(t, withRule.MembershipRule().Metadata)
		assert.Len(t, withRule.Rules, 1)

		importOnly := read(t, activeImportOnly)
		assert.Empty(t, importOnly.Rules, "the carrier rule must be gone; the old release rejects empty expressions")

		mixed := read(t, activeMixedRules)
		require.Len(t, mixed.Rules, 3, "real rules survive")
		assert.Equal(t, []string{"Uploads", "", "Downloads"}, []string{mixed.Rules[0].Name, mixed.Rules[1].Name, mixed.Rules[2].Name})
		assert.Nil(t, mixed.Rules[1].Metadata)
	})

	t.Run("down is a safe no-op on a second run", func(t *testing.T) {
		_, dErr := master.ExecNoTimeout(downSQL)
		assert.NoError(t, dErr)
		assert.Empty(t, read(t, activeImportOnly).Rules)
	})
}
