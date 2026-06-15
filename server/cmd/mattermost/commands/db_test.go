// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"testing"

	"github.com/stretchr/testify/require"
)

// TestMigrateCmdRegistered confirms the `migrate` subcommand is wired into the
// existing `db` group. A regression here would silently break the CLI entry
// point that cloud upgrades depend on.
func TestMigrateCmdRegistered(t *testing.T) {
	require.Contains(t, DbCmd.Commands(), MigrateCmd,
		"MigrateCmd should be registered as a subcommand of DbCmd")
	require.Equal(t, "migrate", MigrateCmd.Use)

	// Flags that the cloud upgrade tooling and operators rely on must remain
	// available. Defaults should stay false so a bare `db migrate` actually
	// applies migrations.
	for _, name := range []string{"auto-recover", "save-plan", "dry-run"} {
		f := MigrateCmd.Flags().Lookup(name)
		require.NotNil(t, f, "expected --%s flag on db migrate", name)
		require.Equal(t, "false", f.DefValue, "--%s should default to false", name)
	}
}

// TestMigrateCmdHappyPath runs `db migrate` end-to-end against the live test
// DB. The harness has already migrated the DB during setup, so the command
// should short-circuit with "No migrations to apply." — confirming the wire-up
// and config loading work end-to-end.
func TestMigrateCmdHappyPath(t *testing.T) {
	if testing.Short() {
		t.Skip("requires live test database")
	}

	th := SetupWithStoreMock(t)
	output := th.CheckCommand(t, "db", "migrate")
	require.Contains(t, output, "No migrations to apply.",
		"expected no-op message when DB is already up to date; got: %s", output)
}

// TestMigrateCmdDryRun verifies that --dry-run is accepted and does not error
// against a healthy DB. The handler skips PreMigrate under --dry-run because
// preMigration writes directly via GetMaster().Exec() and does not participate
// in Morph's dry-run.
func TestMigrateCmdDryRun(t *testing.T) {
	if testing.Short() {
		t.Skip("requires live test database")
	}

	th := SetupWithStoreMock(t)
	output, err := th.RunCommandWithOutput(t, "db", "migrate", "--dry-run")
	require.NoError(t, err, "db migrate --dry-run should succeed; output: %s", output)
}
