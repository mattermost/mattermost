// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Command migration_check verifies that database migrations which already exist
// on the base branch are not renumbered or renamed in the current
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

// violation describes a migration whose version or name diverged from the base
// branch.
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
// a version or a name with a base branch migration but does not match it exactly,
// and for every base branch migration that is absent from the branch. Newly
// added migrations (version and name both absent from the base branch) are
// ignored, as are migrations that are identical to the base branch.
func compareMigrations(baseFiles, branchFiles []string) []violation {
	base := collectMigrations(baseFiles)

	// Index base branch migrations by driver+version and driver+name for lookups
	// in both directions.
	baseByVersion := make(map[string]migration)
	baseByName := make(map[string]migration)
	for _, m := range base {
		baseByVersion[m.driver+"/"+m.version] = m
		baseByName[m.driver+"/"+m.name] = m
	}

	var violations []violation
	reportedBaseChanges := make(map[string]bool)
	for _, b := range collectMigrations(branchFiles) {
		if m, ok := baseByVersion[b.driver+"/"+b.version]; ok && m.name != b.name {
			violations = append(violations, violation{
				driver: b.driver,
				message: fmt.Sprintf(
					"migration %s is named %q but the base branch has it named %q; renaming an existing migration breaks upgrades. Add a new migration instead.",
					b.version, b.name, m.name,
				),
			})
			reportedBaseChanges[m.driver+"/"+m.version] = true
			continue
		}

		if m, ok := baseByName[b.driver+"/"+b.name]; ok && m.version != b.version {
			violations = append(violations, violation{
				driver: b.driver,
				message: fmt.Sprintf(
					"migration %q is numbered %s but the base branch has it numbered %s; renumbering an existing migration breaks upgrades. Add a new migration instead.",
					b.name, b.version, m.version,
				),
			})
			reportedBaseChanges[m.driver+"/"+m.version] = true
		}
	}

	branch := collectMigrations(branchFiles)
	branchByExact := make(map[string]migration, len(branch))
	for _, m := range branch {
		branchByExact[m.driver+"/"+m.version+"/"+m.name] = m
	}

	for _, m := range base {
		if _, ok := branchByExact[m.driver+"/"+m.version+"/"+m.name]; ok {
			continue
		}
		if reportedBaseChanges[m.driver+"/"+m.version] {
			continue
		}
		violations = append(violations, violation{
			driver: m.driver,
			message: fmt.Sprintf(
				"migration %s (%s) exists on the base branch but is missing from the branch; deleting or fully replacing a shipped migration breaks upgrades. Add a new migration instead.",
				m.version, m.name,
			),
		})
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

// baseMigrationFiles lists the migration files tracked at baseRef.
func baseMigrationFiles(root, baseRef string) ([]string, error) {
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

	baseFiles, err := baseMigrationFiles(root, baseRef)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(2)
	}

	branchFiles, err := branchMigrationFiles(root)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(2)
	}

	violations := compareMigrations(baseFiles, branchFiles)
	if len(violations) > 0 {
		fmt.Fprintf(os.Stderr, "Found %d migration(s) that changed relative to base branch %s:\n", len(violations), baseRef)
		for _, v := range violations {
			fmt.Fprintf(os.Stderr, "  - [%s] %s\n", v.driver, v.message)
		}
		os.Exit(1)
	}

	fmt.Printf("All existing migrations match base branch %s.\n", baseRef)
}
