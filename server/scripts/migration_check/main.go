// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Command migration_check verifies that database migrations which already exist
// on the base branch (master) are not renumbered or renamed in the current
// branch. Backporting or rebasing can accidentally change the sequence number
// or description of an already-shipped migration, which corrupts the upgrade
// path for existing installations. Brand new migrations are ignored.
package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

// migrationsRelDir is the path, relative to the repository root, that holds the
// per-driver migration directories.
const migrationsRelDir = "server/channels/db/migrations"

// migrationFileRE matches a migration file name such as
// "000195_threadmemberships_cleanup_v2.up.sql" capturing the version number and
// the descriptive name.
var migrationFileRE = regexp.MustCompile(`^(\d+)_(.+)\.(?:up|down)\.sql$`)

// migration identifies a single migration within a driver directory.
type migration struct {
	driver  string
	version string
	name    string
}

// violation describes a migration whose version or name diverged from master.
type violation struct {
	driver  string
	message string
}

// parseMigration extracts the driver, version and name from a migration file
// path. It returns false for paths that are not migration files (such as the
// generated migrations.list or README.md).
func parseMigration(path string) (migration, bool) {
	parts := strings.Split(filepath.ToSlash(path), "/")

	// Match the last "migrations" segment so an absolute working-tree path
	// whose prefix happens to contain "migrations" still resolves the driver
	// correctly.
	idx := -1
	for i, part := range parts {
		if part == "migrations" {
			idx = i
		}
	}
	// Need exactly "migrations/<driver>/<file>".
	if idx == -1 || idx != len(parts)-3 {
		return migration{}, false
	}

	driver := parts[idx+1]
	file := parts[len(parts)-1]

	m := migrationFileRE.FindStringSubmatch(file)
	if m == nil {
		return migration{}, false
	}

	return migration{driver: driver, version: m[1], name: m[2]}, true
}

// collectMigrations reduces a list of file paths to the set of unique
// migrations keyed by driver and version. The up and down files of a migration
// collapse into a single entry.
func collectMigrations(files []string) map[string]migration {
	out := make(map[string]migration)
	for _, f := range files {
		m, ok := parseMigration(f)
		if !ok {
			continue
		}
		out[m.driver+"/"+m.version] = m
	}
	return out
}

// compareMigrations returns a violation for every branch migration that shares
// a version or a name with a master migration but does not match it exactly.
// Newly added migrations (version and name both absent from master) are
// ignored, as are migrations that are identical to master. A migration whose
// version and name both change at once is indistinguishable from a brand new
// migration and is therefore not flagged.
func compareMigrations(masterFiles, branchFiles []string) []violation {
	master := collectMigrations(masterFiles)

	// Index master migrations by driver+version and driver+name for lookups in
	// both directions.
	masterByVersion := make(map[string]migration)
	masterByName := make(map[string]migration)
	for _, m := range master {
		masterByVersion[m.driver+"/"+m.version] = m
		masterByName[m.driver+"/"+m.name] = m
	}

	var violations []violation
	for _, b := range collectMigrations(branchFiles) {
		if m, ok := masterByVersion[b.driver+"/"+b.version]; ok && m.name != b.name {
			violations = append(violations, violation{
				driver: b.driver,
				message: fmt.Sprintf(
					"migration %s is named %q but master has it named %q; renaming an existing migration breaks upgrades. Add a new migration instead.",
					b.version, b.name, m.name,
				),
			})
			continue
		}

		if m, ok := masterByName[b.driver+"/"+b.name]; ok && m.version != b.version {
			violations = append(violations, violation{
				driver: b.driver,
				message: fmt.Sprintf(
					"migration %q is numbered %s but master has it numbered %s; renumbering an existing migration breaks upgrades. Add a new migration instead.",
					b.name, b.version, m.version,
				),
			})
		}
	}

	sort.Slice(violations, func(i, j int) bool {
		if violations[i].driver != violations[j].driver {
			return violations[i].driver < violations[j].driver
		}
		return violations[i].message < violations[j].message
	})

	return violations
}

// repoRoot returns the absolute path to the git repository root.
func repoRoot() (string, error) {
	out, err := exec.Command("git", "rev-parse", "--show-toplevel").Output()
	if err != nil {
		return "", fmt.Errorf("failed to determine repository root: %w", err)
	}
	return strings.TrimSpace(string(out)), nil
}

// masterMigrationFiles lists the migration files tracked at baseRef.
func masterMigrationFiles(root, baseRef string) ([]string, error) {
	cmd := exec.Command("git", "-C", root, "ls-tree", "-r", "--name-only", baseRef, "--", migrationsRelDir)
	out, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("failed to list migrations on %s (is it fetched?): %w", baseRef, err)
	}
	return splitLines(string(out)), nil
}

// branchMigrationFiles lists the migration files present in the working tree.
func branchMigrationFiles(root string) ([]string, error) {
	dir := filepath.Join(root, migrationsRelDir)
	var files []string
	err := filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() {
			files = append(files, path)
		}
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("failed to walk %s: %w", dir, err)
	}
	return files, nil
}

func splitLines(s string) []string {
	var lines []string
	for line := range strings.SplitSeq(s, "\n") {
		if strings.TrimSpace(line) != "" {
			lines = append(lines, line)
		}
	}
	return lines
}

func main() {
	baseRef := os.Getenv("MM_MIGRATION_CHECK_BASE_REF")
	if baseRef == "" {
		baseRef = "origin/master"
	}

	root, err := repoRoot()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(2)
	}

	masterFiles, err := masterMigrationFiles(root, baseRef)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(2)
	}

	branchFiles, err := branchMigrationFiles(root)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(2)
	}

	violations := compareMigrations(masterFiles, branchFiles)
	if len(violations) > 0 {
		fmt.Fprintf(os.Stderr, "Found %d migration(s) that changed relative to %s:\n", len(violations), baseRef)
		for _, v := range violations {
			fmt.Fprintf(os.Stderr, "  - [%s] %s\n", v.driver, v.message)
		}
		os.Exit(1)
	}

	fmt.Printf("All existing migrations match %s.\n", baseRef)
}
