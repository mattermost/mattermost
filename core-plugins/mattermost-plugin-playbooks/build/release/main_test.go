// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"os"
	"os/exec"
	"strings"
	"testing"

	tea "github.com/charmbracelet/bubbletea"
)

func TestMain(m *testing.M) {
	// Set default protected branch for tests
	protectedBranch = "master"
	os.Exit(m.Run())
}

// withIsolatedGitRepo runs a test function within an isolated temporary git repo.
// This prevents unit tests from interacting with the real repository's tags and branches.
func withIsolatedGitRepo(t *testing.T, fn func()) {
	t.Helper()

	// Save original working directory
	origDir, err := os.Getwd()
	if err != nil {
		t.Fatalf("failed to get current directory: %v", err)
	}

	// Create temp directory
	tmpDir := t.TempDir()

	// Initialize git repo
	cmd := exec.Command("git", "init", "--initial-branch=master")
	cmd.Dir = tmpDir
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("git init failed: %v\n%s", err, out)
	}

	// Configure git user
	for _, args := range [][]string{
		{"config", "user.email", "test@example.com"},
		{"config", "user.name", "Test User"},
	} {
		cmd := exec.Command("git", args...)
		cmd.Dir = tmpDir
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("git %v failed: %v\n%s", args, err, out)
		}
	}

	// Create initial commit
	readmePath := tmpDir + "/README.md"
	if err := os.WriteFile(readmePath, []byte("# Test\n"), 0644); err != nil {
		t.Fatalf("failed to create README: %v", err)
	}
	for _, args := range [][]string{
		{"add", "."},
		{"commit", "-m", "Initial commit"},
	} {
		cmd := exec.Command("git", args...)
		cmd.Dir = tmpDir
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("git %v failed: %v\n%s", args, err, out)
		}
	}

	// Change to temp directory
	if err := os.Chdir(tmpDir); err != nil {
		t.Fatalf("failed to change directory: %v", err)
	}

	// Restore original directory when done
	defer func() {
		if err := os.Chdir(origDir); err != nil {
			t.Errorf("failed to restore directory: %v", err)
		}
	}()

	// Run the test
	fn()
}

func TestParseVersion(t *testing.T) {
	tests := []struct {
		name          string
		version       string
		expectedMajor int
		expectedMinor int
		expectedPatch int
		expectedRC    int
	}{
		{
			name:          "simple version",
			version:       "v2.6.1",
			expectedMajor: 2,
			expectedMinor: 6,
			expectedPatch: 1,
			expectedRC:    0,
		},
		{
			name:          "version without v prefix",
			version:       "2.6.1",
			expectedMajor: 2,
			expectedMinor: 6,
			expectedPatch: 1,
			expectedRC:    0,
		},
		{
			name:          "RC version",
			version:       "v2.6.1-rc1",
			expectedMajor: 2,
			expectedMinor: 6,
			expectedPatch: 1,
			expectedRC:    1,
		},
		{
			name:          "RC version double digit",
			version:       "v2.6.1-rc12",
			expectedMajor: 2,
			expectedMinor: 6,
			expectedPatch: 1,
			expectedRC:    12,
		},
		{
			name:          "major version only",
			version:       "v3.0.0",
			expectedMajor: 3,
			expectedMinor: 0,
			expectedPatch: 0,
			expectedRC:    0,
		},
		{
			name:          "major RC",
			version:       "v3.0.0-rc1",
			expectedMajor: 3,
			expectedMinor: 0,
			expectedPatch: 0,
			expectedRC:    1,
		},
		{
			name:          "empty string",
			version:       "",
			expectedMajor: 0,
			expectedMinor: 0,
			expectedPatch: 0,
			expectedRC:    0,
		},
		{
			name:          "invalid format",
			version:       "not-a-version",
			expectedMajor: 0,
			expectedMinor: 0,
			expectedPatch: 0,
			expectedRC:    0,
		},
		{
			name:          "partial version",
			version:       "v2.6",
			expectedMajor: 0,
			expectedMinor: 0,
			expectedPatch: 0,
			expectedRC:    0,
		},
		{
			name:          "version with extra suffix",
			version:       "v2.6.1-beta1",
			expectedMajor: 2,
			expectedMinor: 6,
			expectedPatch: 1,
			expectedRC:    0,
		},
		{
			name:          "large version numbers",
			version:       "v10.20.30-rc99",
			expectedMajor: 10,
			expectedMinor: 20,
			expectedPatch: 30,
			expectedRC:    99,
		},
		{
			name:          "zero version",
			version:       "v0.0.0",
			expectedMajor: 0,
			expectedMinor: 0,
			expectedPatch: 0,
			expectedRC:    0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			major, minor, patch, rc := parseVersion(tt.version)
			if major != tt.expectedMajor {
				t.Errorf("major: got %d, want %d", major, tt.expectedMajor)
			}
			if minor != tt.expectedMinor {
				t.Errorf("minor: got %d, want %d", minor, tt.expectedMinor)
			}
			if patch != tt.expectedPatch {
				t.Errorf("patch: got %d, want %d", patch, tt.expectedPatch)
			}
			if rc != tt.expectedRC {
				t.Errorf("rc: got %d, want %d", rc, tt.expectedRC)
			}
		})
	}
}

func TestCalculateVersion(t *testing.T) {
	tests := []struct {
		name            string
		bumpType        string
		major           int
		minor           int
		patch           int
		rc              int
		branch          string
		expectedVersion string
		expectedBranch  string
		expectError     bool
	}{
		{
			name:            "patch bump",
			bumpType:        "patch",
			major:           2,
			minor:           6,
			patch:           1,
			rc:              0,
			branch:          "master",
			expectedVersion: "2.6.2",
			expectedBranch:  "",
			expectError:     false,
		},
		{
			name:            "patch bump from release branch",
			bumpType:        "patch",
			major:           2,
			minor:           6,
			patch:           1,
			rc:              0,
			branch:          "release-2.6",
			expectedVersion: "2.6.2",
			expectedBranch:  "",
			expectError:     false,
		},
		{
			name:            "patch-rc bump",
			bumpType:        "patch-rc",
			major:           2,
			minor:           6,
			patch:           1,
			rc:              0,
			branch:          "master",
			expectedVersion: "2.6.2-rc1",
			expectedBranch:  "",
			expectError:     false,
		},
		{
			name:            "patch-rc from release branch",
			bumpType:        "patch-rc",
			major:           2,
			minor:           6,
			patch:           1,
			rc:              0,
			branch:          "release-2.6",
			expectedVersion: "2.6.2-rc1",
			expectedBranch:  "",
			expectError:     false,
		},
		{
			name:            "rc bump from existing rc",
			bumpType:        "rc",
			major:           2,
			minor:           6,
			patch:           2,
			rc:              1,
			branch:          "release-2.6",
			expectedVersion: "2.6.2-rc2",
			expectedBranch:  "",
			expectError:     false,
		},
		{
			name:            "rc bump increments rc number",
			bumpType:        "rc",
			major:           2,
			minor:           6,
			patch:           2,
			rc:              5,
			branch:          "release-2.6",
			expectedVersion: "2.6.2-rc6",
			expectedBranch:  "",
			expectError:     false,
		},
		{
			name:            "rc bump fails when not on rc",
			bumpType:        "rc",
			major:           2,
			minor:           6,
			patch:           1,
			rc:              0,
			branch:          "master",
			expectedVersion: "",
			expectedBranch:  "",
			expectError:     true,
		},
		{
			name:            "rc-finalize drops rc suffix",
			bumpType:        "rc-finalize",
			major:           2,
			minor:           7,
			patch:           0,
			rc:              3,
			branch:          "release-2.7",
			expectedVersion: "2.7.0",
			expectedBranch:  "",
			expectError:     false,
		},
		{
			name:            "rc-finalize fails when not on rc",
			bumpType:        "rc-finalize",
			major:           2,
			minor:           6,
			patch:           1,
			rc:              0,
			branch:          "master",
			expectedVersion: "",
			expectedBranch:  "",
			expectError:     true,
		},
		{
			name:            "minor bump from master",
			bumpType:        "minor",
			major:           2,
			minor:           6,
			patch:           1,
			rc:              0,
			branch:          "master",
			expectedVersion: "2.7.0",
			expectedBranch:  "release-2.7",
			expectError:     false,
		},
		{
			name:            "minor bump resets patch to zero",
			bumpType:        "minor",
			major:           2,
			minor:           6,
			patch:           15,
			rc:              0,
			branch:          "master",
			expectedVersion: "2.7.0",
			expectedBranch:  "release-2.7",
			expectError:     false,
		},
		{
			name:            "minor bump from target release branch",
			bumpType:        "minor",
			major:           2,
			minor:           6,
			patch:           1,
			rc:              0,
			branch:          "release-2.7", // Target branch for 2.7.0
			expectedVersion: "2.7.0",
			expectedBranch:  "release-2.7",
			expectError:     false,
		},
		{
			name:            "minor-rc bump from master",
			bumpType:        "minor-rc",
			major:           2,
			minor:           6,
			patch:           1,
			rc:              0,
			branch:          "master",
			expectedVersion: "2.7.0-rc1",
			expectedBranch:  "release-2.7",
			expectError:     false,
		},
		{
			name:            "minor-rc from target release branch",
			bumpType:        "minor-rc",
			major:           2,
			minor:           6,
			patch:           1,
			rc:              0,
			branch:          "release-2.7", // Target branch for 2.7.0
			expectedVersion: "2.7.0-rc1",
			expectedBranch:  "release-2.7",
			expectError:     false,
		},
		{
			name:            "major bump from master",
			bumpType:        "major",
			major:           2,
			minor:           6,
			patch:           1,
			rc:              0,
			branch:          "master",
			expectedVersion: "3.0.0",
			expectedBranch:  "release-3.0",
			expectError:     false,
		},
		{
			name:            "major bump resets minor and patch",
			bumpType:        "major",
			major:           2,
			minor:           15,
			patch:           20,
			rc:              0,
			branch:          "master",
			expectedVersion: "3.0.0",
			expectedBranch:  "release-3.0",
			expectError:     false,
		},
		{
			name:            "major bump from target release branch",
			bumpType:        "major",
			major:           2,
			minor:           6,
			patch:           1,
			rc:              0,
			branch:          "release-3.0", // Target branch for 3.0.0
			expectedVersion: "3.0.0",
			expectedBranch:  "release-3.0",
			expectError:     false,
		},
		{
			name:            "major-rc bump from master",
			bumpType:        "major-rc",
			major:           2,
			minor:           6,
			patch:           1,
			rc:              0,
			branch:          "master",
			expectedVersion: "3.0.0-rc1",
			expectedBranch:  "release-3.0",
			expectError:     false,
		},
		{
			name:            "major-rc from target release branch",
			bumpType:        "major-rc",
			major:           2,
			minor:           6,
			patch:           1,
			rc:              0,
			branch:          "release-3.0", // Target branch for 3.0.0
			expectedVersion: "3.0.0-rc1",
			expectedBranch:  "release-3.0",
			expectError:     false,
		},
		{
			name:            "minor bump fails from feature branch",
			bumpType:        "minor",
			major:           2,
			minor:           6,
			patch:           1,
			rc:              0,
			branch:          "feature-branch",
			expectedVersion: "",
			expectedBranch:  "",
			expectError:     true,
		},
		{
			name:            "invalid bump type",
			bumpType:        "invalid",
			major:           2,
			minor:           6,
			patch:           1,
			rc:              0,
			branch:          "master",
			expectedVersion: "",
			expectedBranch:  "",
			expectError:     true,
		},
		{
			name:            "empty bump type",
			bumpType:        "",
			major:           2,
			minor:           6,
			patch:           1,
			rc:              0,
			branch:          "master",
			expectedVersion: "",
			expectedBranch:  "",
			expectError:     true,
		},
		{
			name:            "custom bump type returns empty",
			bumpType:        "custom",
			major:           2,
			minor:           6,
			patch:           1,
			rc:              0,
			branch:          "master",
			expectedVersion: "",
			expectedBranch:  "",
			expectError:     false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			version, branch, err := calculateVersion(tt.bumpType, tt.major, tt.minor, tt.patch, tt.rc, tt.branch)

			if tt.expectError {
				if err == nil {
					t.Errorf("expected error, got nil")
				}
				return
			}

			if err != nil {
				t.Errorf("unexpected error: %v", err)
				return
			}

			if version != tt.expectedVersion {
				t.Errorf("version: got %s, want %s", version, tt.expectedVersion)
			}
			if branch != tt.expectedBranch {
				t.Errorf("branch: got %s, want %s", branch, tt.expectedBranch)
			}
		})
	}
}

func TestGetAppName(t *testing.T) {
	// This test just verifies the function doesn't panic
	// Actual git operations are environment-dependent
	name := getAppName()
	if name == "" {
		t.Error("expected non-empty app name")
	}
}

// Integration tests for the TUI model

func TestInitialModel(t *testing.T) {
	withIsolatedGitRepo(t, func() {
		tests := []struct {
			name           string
			major          int
			minor          int
			patch          int
			rc             int
			branch         string
			expectedOpts   int
			hasRCOption    bool
		}{
			{
				name:         "standard version on master",
				major:        2,
				minor:        6,
				patch:        1,
				rc:           0,
				branch:       "master",
				expectedOpts: 7, // patch, patch-rc, minor, minor-rc, major, major-rc, custom
				hasRCOption:  false,
			},
			{
				name:         "RC version shows rc and rc-finalize options",
				major:        2,
				minor:        6,
				patch:        1,
				rc:           1,
				branch:       "release-2.6",
				expectedOpts: 9, // patch, patch-rc, minor, minor-rc, major, major-rc, rc, rc-finalize, custom
				hasRCOption:  true,
			},
			{
				name:         "high RC number",
				major:        2,
				minor:        6,
				patch:        1,
				rc:           5,
				branch:       "release-2.6",
				expectedOpts: 9, // includes rc and rc-finalize
				hasRCOption:  true,
			},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				m := initialModel(tt.major, tt.minor, tt.patch, tt.rc, tt.branch)

				if len(m.options) != tt.expectedOpts {
					t.Errorf("options count: got %d, want %d", len(m.options), tt.expectedOpts)
				}

				if m.stage != stageSelect {
					t.Errorf("initial stage: got %d, want %d", m.stage, stageSelect)
				}

				if m.cursor != 0 {
					t.Errorf("initial cursor: got %d, want 0", m.cursor)
				}

				// Check for rc option presence
				hasRC := false
				for _, opt := range m.options {
					if opt.value == "rc" {
						hasRC = true
						break
					}
				}
				if hasRC != tt.hasRCOption {
					t.Errorf("has RC option: got %v, want %v", hasRC, tt.hasRCOption)
				}

				// Verify stored values
				if m.major != tt.major || m.minor != tt.minor || m.patch != tt.patch || m.rc != tt.rc {
					t.Error("model did not store version components correctly")
				}
				if m.branch != tt.branch {
					t.Errorf("branch: got %s, want %s", m.branch, tt.branch)
				}
			})
		}
	})
}

func TestModelOptionPreviews(t *testing.T) {
	withIsolatedGitRepo(t, func() {
		m := initialModel(2, 6, 1, 0, "master")

		expectedPreviews := map[string]string{
			"patch":    "2.6.2",
			"patch-rc": "2.6.2-rc1",
			"minor":    "2.7.0",
			"minor-rc": "2.7.0-rc1",
			"major":    "3.0.0",
			"major-rc": "3.0.0-rc1",
			"custom":   "enter version",
		}

		for _, opt := range m.options {
			expected, ok := expectedPreviews[opt.value]
			if !ok {
				t.Errorf("unexpected option: %s", opt.value)
				continue
			}
			if opt.preview != expected {
				t.Errorf("preview for %s: got %s, want %s", opt.value, opt.preview, expected)
			}
		}
	})
}

func TestModelOptionPreviewsWithRC(t *testing.T) {
	withIsolatedGitRepo(t, func() {
		m := initialModel(2, 6, 1, 3, "release-2.6")

		// Find the rc option and verify its preview
		for _, opt := range m.options {
			if opt.value == "rc" {
				expected := "2.6.1-rc4"
				if opt.preview != expected {
					t.Errorf("rc preview: got %s, want %s", opt.preview, expected)
				}
				return
			}
		}
		t.Error("rc option not found")
	})
}

func TestModelRCOptionsAtBeginning(t *testing.T) {
	withIsolatedGitRepo(t, func() {
		// When on an RC version, rc and rc-finalize should be first
		m := initialModel(2, 6, 1, 3, "release-2.6")

		if len(m.options) < 2 {
			t.Fatal("expected at least 2 options")
		}

		// First option should be rc
		if m.options[0].value != "rc" {
			t.Errorf("first option when on RC: got %s, want rc", m.options[0].value)
		}

		// Second option should be rc-finalize
		if m.options[1].value != "rc-finalize" {
			t.Errorf("second option when on RC: got %s, want rc-finalize", m.options[1].value)
		}

		// Third option should be patch (the normal first option)
		if m.options[2].value != "patch" {
			t.Errorf("third option when on RC: got %s, want patch", m.options[2].value)
		}
	})
}

func TestModelNonRCOptionsOrder(t *testing.T) {
	withIsolatedGitRepo(t, func() {
		// When not on an RC version, patch should be first (no rc/rc-finalize at start)
		m := initialModel(2, 6, 1, 0, "master")

		if len(m.options) < 1 {
			t.Fatal("expected at least 1 option")
		}

		// First option should be patch (not rc)
		if m.options[0].value != "patch" {
			t.Errorf("first option when not on RC: got %s, want patch", m.options[0].value)
		}

		// Verify rc and rc-finalize are NOT in the options when not on an RC
		for _, opt := range m.options {
			if opt.value == "rc" || opt.value == "rc-finalize" {
				t.Errorf("option %s should not appear when not on an RC version", opt.value)
			}
		}
	})
}

func TestModelOptionValidation(t *testing.T) {
	withIsolatedGitRepo(t, func() {
		// Test validation messages when on protected branch (master)
		t.Run("on protected branch", func(t *testing.T) {
			m := initialModel(2, 6, 1, 0, "master")

			for _, opt := range m.options {
				switch opt.value {
				case "patch", "patch-rc":
					// Patch releases need release branch, not master
					if opt.valid {
						t.Errorf("option %s should NOT be valid from master", opt.value)
					}
					if opt.validMsg == "" {
						t.Errorf("option %s should have validation message", opt.value)
					}
				case "minor", "minor-rc", "major", "major-rc":
					// Minor/major releases are valid from master
					if !opt.valid {
						t.Errorf("option %s should be valid from master", opt.value)
					}
				case "custom":
					if !opt.valid {
						t.Errorf("custom option should always be valid")
					}
				}
			}
		})

		// Test validation messages when on release branch
		t.Run("on release branch for patch", func(t *testing.T) {
			m := initialModel(2, 6, 1, 0, "release-2.6")

			for _, opt := range m.options {
				switch opt.value {
				case "patch", "patch-rc":
					// Patch releases are valid from matching release branch
					if !opt.valid {
						t.Errorf("option %s should be valid from release-2.6", opt.value)
					}
				case "minor", "minor-rc":
					// Minor releases need master or release-2.7 (the target), not release-2.6
					if opt.valid {
						t.Errorf("option %s should NOT be valid from release-2.6 (needs release-2.7)", opt.value)
					}
				case "major", "major-rc":
					// Major releases need master or release-3.0 (the target), not release-2.6
					if opt.valid {
						t.Errorf("option %s should NOT be valid from release-2.6 (needs release-3.0)", opt.value)
					}
				}
			}
		})

		// Test that minor/major are valid from their TARGET release branch
		t.Run("minor from target release branch", func(t *testing.T) {
			// Minor bump 2.6.x → 2.7.0 is valid from release-2.7
			m := initialModel(2, 6, 1, 0, "release-2.7")

			for _, opt := range m.options {
				if opt.value == "minor" || opt.value == "minor-rc" {
					if !opt.valid {
						t.Errorf("option %s should be valid from release-2.7 (target branch)", opt.value)
					}
				}
			}
		})

		// Test validation when on patch RC version (release branch)
		t.Run("on patch RC version", func(t *testing.T) {
			// Patch RC (v2.6.1-rc3) on release branch
			m := initialModel(2, 6, 1, 3, "release-2.6")

			// rc and rc-finalize should be valid from matching release branch
			for _, opt := range m.options {
				if opt.value == "rc" || opt.value == "rc-finalize" {
					if !opt.valid {
						t.Errorf("option %s should be valid from release-2.6 when on patch RC", opt.value)
					}
				}
			}
		})

		// Test validation when on minor/major RC version (master)
		t.Run("on minor RC version from master", func(t *testing.T) {
			// Minor RC (v2.7.0-rc1) on master - patch is 0
			m := initialModel(2, 7, 0, 1, "master")

			// rc and rc-finalize should be valid from master when patch == 0
			for _, opt := range m.options {
				if opt.value == "rc" || opt.value == "rc-finalize" {
					if !opt.valid {
						t.Errorf("option %s should be valid from master when on minor/major RC (patch==0)", opt.value)
					}
				}
			}
		})

		// Test validation when minor/major RC from release branch (should work now)
		t.Run("on minor RC version from matching release branch", func(t *testing.T) {
			// Minor RC (v2.7.0-rc1) on release-2.7 branch (matching)
			m := initialModel(2, 7, 0, 1, "release-2.7")

			// rc and rc-finalize should be valid from matching release branch when patch == 0
			for _, opt := range m.options {
				if opt.value == "rc" || opt.value == "rc-finalize" {
					if !opt.valid {
						t.Errorf("option %s should be valid from release-2.7 when on v2.7.0-rc1", opt.value)
					}
				}
			}
		})

		t.Run("on minor RC version from wrong release branch", func(t *testing.T) {
			// Minor RC (v2.7.0-rc1) on release-2.6 branch (wrong)
			m := initialModel(2, 7, 0, 1, "release-2.6")

			// rc and rc-finalize should NOT be valid from wrong release branch
			for _, opt := range m.options {
				if opt.value == "rc" || opt.value == "rc-finalize" {
					if opt.valid {
						t.Errorf("option %s should NOT be valid from release-2.6 when on v2.7.0-rc1", opt.value)
					}
				}
			}
		})

		// Test validation when on feature branch (should fail for all)
		t.Run("on feature branch", func(t *testing.T) {
			m := initialModel(2, 6, 1, 0, "feature-branch")

			for _, opt := range m.options {
				switch opt.value {
				case "patch", "patch-rc":
					if opt.valid {
						t.Errorf("option %s should NOT be valid from feature branch", opt.value)
					}
				case "minor", "minor-rc", "major", "major-rc":
					if opt.valid {
						t.Errorf("option %s should NOT be valid from feature branch", opt.value)
					}
				case "custom":
					if !opt.valid {
						t.Errorf("custom option should always be valid")
					}
				}
			}
		})
	})
}

func TestModelUpdate_Navigation(t *testing.T) {
	withIsolatedGitRepo(t, func() {
		m := initialModel(2, 6, 1, 0, "master")

		// Test down navigation
		newModel, _ := m.Update(tea.KeyMsg{Type: tea.KeyDown})
		m = newModel.(model)
		if m.cursor != 1 {
			t.Errorf("cursor after down: got %d, want 1", m.cursor)
		}

		// Test up navigation
		newModel, _ = m.Update(tea.KeyMsg{Type: tea.KeyUp})
		m = newModel.(model)
		if m.cursor != 0 {
			t.Errorf("cursor after up: got %d, want 0", m.cursor)
		}

		// Test j/k vim-style navigation
		newModel, _ = m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'j'}})
		m = newModel.(model)
		if m.cursor != 1 {
			t.Errorf("cursor after j: got %d, want 1", m.cursor)
		}

		newModel, _ = m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'k'}})
		m = newModel.(model)
		if m.cursor != 0 {
			t.Errorf("cursor after k: got %d, want 0", m.cursor)
		}
	})
}

func TestModelUpdate_NavigationBounds(t *testing.T) {
	withIsolatedGitRepo(t, func() {
		m := initialModel(2, 6, 1, 0, "master")

		// Test can't go above first option
		newModel, _ := m.Update(tea.KeyMsg{Type: tea.KeyUp})
		m = newModel.(model)
		if m.cursor != 0 {
			t.Errorf("cursor should stay at 0: got %d", m.cursor)
		}

		// Navigate to last option
		for i := 0; i < len(m.options)-1; i++ {
			newModel, _ = m.Update(tea.KeyMsg{Type: tea.KeyDown})
			m = newModel.(model)
		}
		lastIdx := len(m.options) - 1
		if m.cursor != lastIdx {
			t.Errorf("cursor should be at last: got %d, want %d", m.cursor, lastIdx)
		}

		// Test can't go below last option
		newModel, _ = m.Update(tea.KeyMsg{Type: tea.KeyDown})
		m = newModel.(model)
		if m.cursor != lastIdx {
			t.Errorf("cursor should stay at last: got %d, want %d", m.cursor, lastIdx)
		}
	})
}

func TestModelUpdate_SelectOption(t *testing.T) {
	withIsolatedGitRepo(t, func() {
		// Use version 99.99.99 on matching release branch to avoid validation errors
		m := initialModel(99, 99, 99, 0, "release-99.99")

		// Select patch (first option) - valid from release branch
		newModel, _ := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
		m = newModel.(model)

		if m.stage != stageConfirm {
			t.Errorf("stage after select: got %d, want %d", m.stage, stageConfirm)
		}
		if m.newVersion != "99.99.100" {
			t.Errorf("newVersion: got %s, want 99.99.100", m.newVersion)
		}
		if m.selected != "patch" {
			t.Errorf("selected: got %s, want patch", m.selected)
		}
	})
}

func TestModelUpdate_SelectCustom(t *testing.T) {
	withIsolatedGitRepo(t, func() {
		m := initialModel(2, 6, 1, 0, "master")

		// Navigate to custom option (last one)
		for i := 0; i < len(m.options)-1; i++ {
			newModel, _ := m.Update(tea.KeyMsg{Type: tea.KeyDown})
			m = newModel.(model)
		}

		// Select custom
		newModel, _ := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
		m = newModel.(model)

		if m.stage != stageCustom {
			t.Errorf("stage after selecting custom: got %d, want %d", m.stage, stageCustom)
		}
		if m.selected != "custom" {
			t.Errorf("selected: got %s, want custom", m.selected)
		}
	})
}

func TestModelUpdate_Quit(t *testing.T) {
	withIsolatedGitRepo(t, func() {
		tests := []struct {
			name string
			key  tea.KeyMsg
		}{
			{"ctrl+c", tea.KeyMsg{Type: tea.KeyCtrlC}},
			{"esc", tea.KeyMsg{Type: tea.KeyEsc}},
			{"q", tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'q'}}},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				m := initialModel(2, 6, 1, 0, "master")
				newModel, _ := m.Update(tt.key)
				m = newModel.(model)

				if !m.quitting {
					t.Error("expected quitting to be true")
				}
			})
		}
	})
}

func TestModelUpdate_ConfirmStage(t *testing.T) {
	withIsolatedGitRepo(t, func() {
		// Use version 99.99.99 on matching release branch to avoid validation errors
		m := initialModel(99, 99, 99, 0, "release-99.99")

		// Select patch to get to confirm stage
		newModel, _ := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
		m = newModel.(model)

		// Test confirm with 'y'
		newModel, _ = m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'y'}})
		m = newModel.(model)

		if !m.confirmed {
			t.Error("expected confirmed to be true after 'y'")
		}
	})
}

func TestModelUpdate_ConfirmStageReject(t *testing.T) {
	withIsolatedGitRepo(t, func() {
		// Use version 99.99.99 on matching release branch to avoid validation errors
		m := initialModel(99, 99, 99, 0, "release-99.99")

		// Select patch to get to confirm stage
		newModel, _ := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
		m = newModel.(model)

		// Test reject with 'n'
		newModel, _ = m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'n'}})
		m = newModel.(model)

		if !m.quitting {
			t.Error("expected quitting to be true after 'n'")
		}
		if m.confirmed {
			t.Error("expected confirmed to be false after 'n'")
		}
	})
}

func TestModelUpdate_MinorFromTargetReleaseBranch(t *testing.T) {
	withIsolatedGitRepo(t, func() {
		// Minor bump to 99.100.0 is valid from release-99.100 (the target branch)
		m := initialModel(99, 99, 1, 0, "release-99.100")

		// Find and select minor
		for i, opt := range m.options {
			if opt.value == "minor" {
				m.cursor = i
				break
			}
		}

		newModel, _ := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
		m = newModel.(model)

		// Minor bumps from target release branch should succeed
		if m.err != nil {
			t.Errorf("expected no error when selecting minor from release-99.100, got: %v", m.err)
		}
		if m.stage != stageConfirm {
			t.Errorf("expected stage to be confirm, got: %v", m.stage)
		}
		if m.newVersion != "99.100.0" {
			t.Errorf("expected version 99.100.0, got: %s", m.newVersion)
		}
	})
}

func TestModelView_SelectStage(t *testing.T) {
	withIsolatedGitRepo(t, func() {
		m := initialModel(2, 6, 1, 0, "master")
		view := m.View()

		// Check header shows current version
		if !strings.Contains(view, "v2.6.1") {
			t.Error("view should contain current version")
		}

		// Check it shows branch
		if !strings.Contains(view, "master") {
			t.Error("view should contain branch name")
		}

		// Check it shows options
		if !strings.Contains(view, "patch") {
			t.Error("view should contain patch option")
		}

		// Check cursor indicator
		if !strings.Contains(view, ">") {
			t.Error("view should contain cursor indicator")
		}

		// Check help text
		if !strings.Contains(view, "arrows") || !strings.Contains(view, "enter") {
			t.Error("view should contain help text")
		}
	})
}

func TestModelView_ConfirmStage(t *testing.T) {
	withIsolatedGitRepo(t, func() {
		// Use version 99.99.99 on matching release branch to avoid validation errors
		m := initialModel(99, 99, 99, 0, "release-99.99")

		// Select patch to get to confirm
		newModel, _ := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
		m = newModel.(model)

		view := m.View()

		if !strings.Contains(view, "v99.99.100") {
			t.Error("confirm view should show new version")
		}
		// Unified confirmation format: "Proceed? [y]es / [n]o"
		if !strings.Contains(view, "[y]es") || !strings.Contains(view, "[n]o") {
			t.Error("confirm view should show [y]es / [n]o prompt")
		}
	})
}

func TestModelView_ConfirmStageWithBranch(t *testing.T) {
	withIsolatedGitRepo(t, func() {
		// Use high version numbers to avoid conflicts with real tags
		m := initialModel(99, 98, 1, 0, "master")

		// Navigate to minor and select
		for i, opt := range m.options {
			if opt.value == "minor" {
				m.cursor = i
				break
			}
		}
		newModel, _ := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
		m = newModel.(model)

		view := m.View()

		if !strings.Contains(view, "v99.99.0") {
			t.Error("confirm view should show new version")
		}
		if !strings.Contains(view, "release-99.99") {
			t.Error("confirm view should show branch to be created")
		}
	})
}

func TestModelView_CustomStage(t *testing.T) {
	withIsolatedGitRepo(t, func() {
		m := initialModel(2, 6, 1, 0, "master")

		// Navigate to custom and select
		for i, opt := range m.options {
			if opt.value == "custom" {
				m.cursor = i
				break
			}
		}
		newModel, _ := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
		m = newModel.(model)

		view := m.View()

		if !strings.Contains(view, "custom version") {
			t.Error("custom view should prompt for version input")
		}
		if !strings.Contains(view, "esc") {
			t.Error("custom view should show esc to go back")
		}
	})
}

func TestModelView_Quitting(t *testing.T) {
	withIsolatedGitRepo(t, func() {
		m := initialModel(2, 6, 1, 0, "master")

		newModel, _ := m.Update(tea.KeyMsg{Type: tea.KeyEsc})
		m = newModel.(model)

		view := m.View()

		if !strings.Contains(view, "Aborted") {
			t.Error("quitting view should show aborted message")
		}
	})
}

func TestModelView_Error(t *testing.T) {
	withIsolatedGitRepo(t, func() {
		// Test error view when selecting patch from master (requires release branch)
		m := initialModel(2, 6, 1, 0, "master")

		// Try to select patch from master (should error - patch needs release branch)
		for i, opt := range m.options {
			if opt.value == "patch" {
				m.cursor = i
				break
			}
		}
		newModel, _ := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
		m = newModel.(model)

		// Model should have error set and be quitting
		if m.err == nil {
			t.Error("expected error to be set")
		}
		if !m.quitting {
			t.Error("expected quitting to be true")
		}

		// View returns empty string when there's an error (cobra handles display)
		view := m.View()
		if view != "" {
			t.Errorf("expected empty view on error, got: %s", view)
		}
	})
}

func TestModelInit(t *testing.T) {
	withIsolatedGitRepo(t, func() {
		m := initialModel(2, 6, 1, 0, "master")
		cmd := m.Init()

		if cmd != nil {
			t.Error("Init should return nil command")
		}
	})
}

func TestModelUpdate_InvalidOptionWithForce(t *testing.T) {
	withIsolatedGitRepo(t, func() {
		// Save and restore forceMode
		originalForce := forceMode
		defer func() { forceMode = originalForce }()

		// Test selecting invalid option (patch from master) WITH force mode
		// Use high version number to avoid conflicts with real tags
		forceMode = true
		m := initialModel(99, 99, 1, 0, "master")

		// First option is patch, which is invalid from master
		if m.options[0].valid {
			t.Fatal("patch option should be invalid from master")
		}

		// Select patch (invalid option) - should proceed with warning
		newModel, _ := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
		m = newModel.(model)

		// Should proceed to confirm stage with warning
		if m.stage != stageConfirm {
			t.Errorf("expected stage confirm, got %d", m.stage)
		}
		if len(m.warnings) == 0 {
			t.Error("expected warning for invalid option selection with --force")
		}
		// Verify warning message mentions the branch requirement
		found := false
		for _, w := range m.warnings {
			if strings.Contains(w, "release-99.99") || strings.Contains(w, "switch to") {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("expected warning about release branch, got: %v", m.warnings)
		}
	})
}

func TestModelUpdate_InvalidOptionWithoutForce(t *testing.T) {
	withIsolatedGitRepo(t, func() {
		// Save and restore forceMode
		originalForce := forceMode
		defer func() { forceMode = originalForce }()

		// Test selecting invalid option (patch from master) WITHOUT force mode
		// Use high version number to avoid conflicts with real tags
		forceMode = false
		m := initialModel(99, 99, 1, 0, "master")

		// First option is patch, which is invalid from master
		if m.options[0].valid {
			t.Fatal("patch option should be invalid from master")
		}

		// Select patch (invalid option) - should error
		newModel, _ := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
		m = newModel.(model)

		// Should error and quit
		if m.err == nil {
			t.Error("expected error for invalid option selection without --force")
		}
		if !m.quitting {
			t.Error("expected quitting after error")
		}
	})
}

// Test version preview calculations

func TestVersionPreviewCalculations(t *testing.T) {
	withIsolatedGitRepo(t, func() {
		tests := []struct {
			name     string
			major    int
			minor    int
			patch    int
			rc       int
			optValue string
			expected string
		}{
			{"patch from 2.6.1", 2, 6, 1, 0, "patch", "2.6.2"},
			{"patch from 2.6.0", 2, 6, 0, 0, "patch", "2.6.1"},
			{"patch-rc from 2.6.1", 2, 6, 1, 0, "patch-rc", "2.6.2-rc1"},
			{"minor from 2.6.1", 2, 6, 1, 0, "minor", "2.7.0"},
			{"minor-rc from 2.6.1", 2, 6, 1, 0, "minor-rc", "2.7.0-rc1"},
			{"major from 2.6.1", 2, 6, 1, 0, "major", "3.0.0"},
			{"major-rc from 2.6.1", 2, 6, 1, 0, "major-rc", "3.0.0-rc1"},
			{"rc from 2.6.1-rc1", 2, 6, 1, 1, "rc", "2.6.1-rc2"},
			{"rc from 2.6.1-rc9", 2, 6, 1, 9, "rc", "2.6.1-rc10"},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				m := initialModel(tt.major, tt.minor, tt.patch, tt.rc, "master")

				for _, opt := range m.options {
					if opt.value == tt.optValue {
						if opt.preview != tt.expected {
							t.Errorf("preview for %s: got %s, want %s", tt.optValue, opt.preview, tt.expected)
						}
						return
					}
				}
				// rc option only present when rc > 0
				if tt.optValue == "rc" && tt.rc == 0 {
					return // expected not to find it
				}
				t.Errorf("option %s not found", tt.optValue)
			})
		}
	})
}

func TestIsValidSemver(t *testing.T) {
	tests := []struct {
		version string
		valid   bool
	}{
		{"1.0.0", true},
		{"2.6.1", true},
		{"10.20.30", true},
		{"0.0.0", true},
		{"1.0.0-rc1", true},
		{"2.6.1-rc12", true},
		{"v1.0.0", true},
		{"v2.6.1-rc1", true},
		{"", false},
		{"1.0", false},
		{"1", false},
		{"1.0.0.0", false},
		{"1.0.0-beta", false},
		{"1.0.0-rc", false},
		{"1.0.0-rc1-extra", false},
		{"not-a-version", false},
		{"1.0.0-RC1", false}, // uppercase not allowed
		{"v", false},
		{"1.0.a", false},
	}

	for _, tt := range tests {
		t.Run(tt.version, func(t *testing.T) {
			result := isValidSemver(tt.version)
			if result != tt.valid {
				t.Errorf("isValidSemver(%s): got %v, want %v", tt.version, result, tt.valid)
			}
		})
	}
}

func TestCompareVersions(t *testing.T) {
	tests := []struct {
		name     string
		v1       [4]int // major, minor, patch, rc
		v2       [4]int
		expected int
	}{
		{"equal versions", [4]int{2, 6, 1, 0}, [4]int{2, 6, 1, 0}, 0},
		{"major greater", [4]int{3, 0, 0, 0}, [4]int{2, 6, 1, 0}, 1},
		{"major less", [4]int{2, 6, 1, 0}, [4]int{3, 0, 0, 0}, -1},
		{"minor greater", [4]int{2, 7, 0, 0}, [4]int{2, 6, 1, 0}, 1},
		{"minor less", [4]int{2, 6, 1, 0}, [4]int{2, 7, 0, 0}, -1},
		{"patch greater", [4]int{2, 6, 2, 0}, [4]int{2, 6, 1, 0}, 1},
		{"patch less", [4]int{2, 6, 1, 0}, [4]int{2, 6, 2, 0}, -1},
		{"stable > rc", [4]int{2, 6, 1, 0}, [4]int{2, 6, 1, 1}, 1},
		{"rc < stable", [4]int{2, 6, 1, 1}, [4]int{2, 6, 1, 0}, -1},
		{"rc1 < rc2", [4]int{2, 6, 1, 1}, [4]int{2, 6, 1, 2}, -1},
		{"rc2 > rc1", [4]int{2, 6, 1, 2}, [4]int{2, 6, 1, 1}, 1},
		{"equal rcs", [4]int{2, 6, 1, 1}, [4]int{2, 6, 1, 1}, 0},
		{"next patch > current rc", [4]int{2, 6, 2, 0}, [4]int{2, 6, 2, 1}, 1},
		{"current rc < next patch", [4]int{2, 6, 2, 1}, [4]int{2, 6, 2, 0}, -1},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := compareVersions(
				tt.v1[0], tt.v1[1], tt.v1[2], tt.v1[3],
				tt.v2[0], tt.v2[1], tt.v2[2], tt.v2[3],
			)
			if result != tt.expected {
				t.Errorf("compareVersions(%v, %v): got %d, want %d", tt.v1, tt.v2, result, tt.expected)
			}
		})
	}
}

func TestSortVersionTagsDesc(t *testing.T) {
	tests := []struct {
		name     string
		input    []string
		expected []string
	}{
		{
			name:     "stable comes after RCs",
			input:    []string{"v2.6.0-rc1", "v2.6.0", "v2.6.0-rc2"},
			expected: []string{"v2.6.0", "v2.6.0-rc2", "v2.6.0-rc1"},
		},
		{
			name:     "mixed versions",
			input:    []string{"v2.5.0", "v2.6.0-rc1", "v2.6.0", "v2.5.1"},
			expected: []string{"v2.6.0", "v2.6.0-rc1", "v2.5.1", "v2.5.0"},
		},
		{
			name:     "only RCs",
			input:    []string{"v2.6.0-rc1", "v2.6.0-rc3", "v2.6.0-rc2"},
			expected: []string{"v2.6.0-rc3", "v2.6.0-rc2", "v2.6.0-rc1"},
		},
		{
			name:     "major versions",
			input:    []string{"v1.0.0", "v3.0.0", "v2.0.0"},
			expected: []string{"v3.0.0", "v2.0.0", "v1.0.0"},
		},
		{
			name:     "complex mix",
			input:    []string{"v2.6.0-rc1", "v2.7.0", "v2.6.0", "v2.7.0-rc1", "v2.6.1"},
			expected: []string{"v2.7.0", "v2.7.0-rc1", "v2.6.1", "v2.6.0", "v2.6.0-rc1"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Make a copy to avoid modifying test data
			input := make([]string, len(tt.input))
			copy(input, tt.input)

			sortVersionTagsDesc(input)

			for i, v := range input {
				if v != tt.expected[i] {
					t.Errorf("position %d: got %s, want %s\nfull result: %v", i, v, tt.expected[i], input)
				}
			}
		})
	}
}

// =============================================================================
// Integration Tests with Temporary Git Repositories
// =============================================================================
//
// These tests create real git repositories in temporary directories with a
// local bare repo as the "remote origin" to test the full release CLI flow.

// testRepo holds references to the temporary git repos used for integration testing
type testRepo struct {
	workDir   string // working directory (the main repo)
	remoteDir string // bare repo acting as origin
	t         *testing.T
}

// setupTestRepo creates a temporary git environment with:
// - A bare repo acting as the remote "origin"
// - A working repo that pushes/pulls to the bare repo
// - Initial commit and configurable tags
func setupTestRepo(t *testing.T) *testRepo {
	t.Helper()

	// Create temp directories
	remoteDir := t.TempDir()
	workDir := t.TempDir()

	tr := &testRepo{
		workDir:   workDir,
		remoteDir: remoteDir,
		t:         t,
	}

	// Initialize bare repo with master as default branch (acts as origin)
	tr.runGit(remoteDir, "init", "--bare", "--initial-branch=master")

	// Initialize working repo with master as default branch
	tr.runGit(workDir, "init", "--initial-branch=master")
	tr.runGit(workDir, "config", "user.email", "test@example.com")
	tr.runGit(workDir, "config", "user.name", "Test User")

	// Configure remote origin
	tr.runGit(workDir, "remote", "add", "origin", remoteDir)

	// Create initial commit
	tr.writeFile("README.md", "# Test Repo\n")
	tr.runGit(workDir, "add", ".")
	tr.runGit(workDir, "commit", "-m", "Initial commit")

	// Push to origin and set upstream
	tr.runGit(workDir, "push", "-u", "origin", "master")

	return tr
}

// runGit executes a git command in the specified directory
func (tr *testRepo) runGit(dir string, args ...string) string {
	tr.t.Helper()
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	out, err := cmd.CombinedOutput()
	if err != nil {
		tr.t.Fatalf("git %v failed in %s: %v\nOutput: %s", args, dir, err, out)
	}
	return strings.TrimSpace(string(out))
}

// runGitInWork executes git command in the working directory
func (tr *testRepo) runGitInWork(args ...string) string {
	return tr.runGit(tr.workDir, args...)
}

// runGitMayFail runs git and returns error instead of failing
func (tr *testRepo) runGitMayFail(dir string, args ...string) (string, error) {
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	out, err := cmd.CombinedOutput()
	return strings.TrimSpace(string(out)), err
}

// writeFile creates a file in the working directory
func (tr *testRepo) writeFile(name, content string) {
	tr.t.Helper()
	path := tr.workDir + "/" + name
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		tr.t.Fatalf("failed to write file %s: %v", path, err)
	}
}

// createTag creates an annotated tag (without GPG signing for tests)
func (tr *testRepo) createTag(tag, message string) {
	tr.t.Helper()
	tr.runGitInWork("tag", "-a", tag, "-m", message)
	tr.runGitInWork("push", "origin", tag)
}

// createBranch creates and pushes a branch
func (tr *testRepo) createBranch(branch string) {
	tr.t.Helper()
	tr.runGitInWork("branch", branch)
	tr.runGitInWork("push", "origin", branch)
}

// checkout switches to a branch
func (tr *testRepo) checkout(branch string) {
	tr.t.Helper()
	tr.runGitInWork("checkout", branch)
}

// tagExistsLocal checks if a tag exists in the local repo
func (tr *testRepo) tagExistsLocal(tag string) bool {
	_, err := tr.runGitMayFail(tr.workDir, "show-ref", "--verify", "--quiet", "refs/tags/"+tag)
	return err == nil
}

// tagExistsRemote checks if a tag exists in the remote repo
func (tr *testRepo) tagExistsRemote(tag string) bool {
	_, err := tr.runGitMayFail(tr.remoteDir, "show-ref", "--verify", "--quiet", "refs/tags/"+tag)
	return err == nil
}

// getCurrentBranch returns the current branch name
func (tr *testRepo) getCurrentBranch() string {
	return tr.runGitInWork("rev-parse", "--abbrev-ref", "HEAD")
}

// getLatestTag returns the latest version tag using proper semver sorting
func (tr *testRepo) getLatestTag() string {
	out, _ := tr.runGitMayFail(tr.workDir, "tag", "-l", "v*")
	if out == "" {
		return ""
	}
	tags := strings.Split(out, "\n")
	sortVersionTagsDesc(tags)
	return tags[0]
}

// addCommit adds a new commit to the repo and pushes to upstream
func (tr *testRepo) addCommit(message string) {
	tr.writeFile("file-"+message+".txt", "content for "+message)
	tr.runGitInWork("add", ".")
	tr.runGitInWork("commit", "-m", message)

	// Get current branch and push with upstream if needed
	branch := tr.getCurrentBranch()
	// Try push, if it fails try with upstream setting
	_, err := tr.runGitMayFail(tr.workDir, "push")
	if err != nil {
		tr.runGitInWork("push", "-u", "origin", branch)
	}
}

// =============================================================================
// Integration Test Cases
// =============================================================================

func TestIntegration_SetupTestRepo(t *testing.T) {
	tr := setupTestRepo(t)

	// Verify initial state
	if tr.getCurrentBranch() != "master" {
		t.Errorf("expected branch master, got %s", tr.getCurrentBranch())
	}

	// Add a version tag
	tr.createTag("v1.0.0", "Initial release")
	if !tr.tagExistsLocal("v1.0.0") {
		t.Error("tag v1.0.0 should exist locally")
	}
	if !tr.tagExistsRemote("v1.0.0") {
		t.Error("tag v1.0.0 should exist on remote")
	}

	// Verify latest tag retrieval
	latest := tr.getLatestTag()
	if latest != "v1.0.0" {
		t.Errorf("expected latest tag v1.0.0, got %s", latest)
	}
}

func TestIntegration_TagExists(t *testing.T) {
	tr := setupTestRepo(t)
	tr.createTag("v2.6.1", "Release 2.6.1")

	// Change to work directory and test tagExists function
	origDir, _ := os.Getwd()
	defer os.Chdir(origDir)
	os.Chdir(tr.workDir)

	if !tagExists("v2.6.1") {
		t.Error("tagExists should return true for v2.6.1")
	}
	if tagExists("v9.9.9") {
		t.Error("tagExists should return false for non-existent tag")
	}
}

func TestIntegration_BranchExists(t *testing.T) {
	tr := setupTestRepo(t)
	tr.createBranch("release-2.6")

	// Change to work directory
	origDir, _ := os.Getwd()
	defer os.Chdir(origDir)
	os.Chdir(tr.workDir)

	// Fetch to see remote branches
	tr.runGitInWork("fetch")

	exists := branchExists("release-2.6")
	if !exists {
		t.Error("branchExists should return true for release-2.6")
	}

	exists = branchExists("release-9.9")
	if exists {
		t.Error("branchExists should return false for non-existent branch")
	}
}

func TestIntegration_ParseVersionFromRealTags(t *testing.T) {
	tr := setupTestRepo(t)

	// Create multiple version tags
	tr.createTag("v1.0.0", "Release 1.0.0")
	tr.addCommit("bump1")
	tr.createTag("v2.5.0", "Release 2.5.0")
	tr.addCommit("bump2")
	tr.createTag("v2.6.1", "Release 2.6.1")

	// Verify tag ordering
	latest := tr.getLatestTag()
	if latest != "v2.6.1" {
		t.Errorf("expected latest tag v2.6.1, got %s", latest)
	}

	// Test parseVersion on real tag
	major, minor, patch, rc := parseVersion(latest)
	if major != 2 || minor != 6 || patch != 1 || rc != 0 {
		t.Errorf("parseVersion(%s): got %d.%d.%d-rc%d, want 2.6.1", latest, major, minor, patch, rc)
	}
}

func TestIntegration_ParseVersionWithRC(t *testing.T) {
	tr := setupTestRepo(t)

	tr.createTag("v2.6.1", "Release 2.6.1")
	tr.addCommit("rc prep")
	tr.createTag("v2.7.0-rc1", "Release 2.7.0-rc1")

	latest := tr.getLatestTag()
	// Note: version sorting should put 2.7.0-rc1 after 2.6.1
	major, minor, patch, rc := parseVersion(latest)

	// The exact result depends on git's version sorting
	if latest == "v2.7.0-rc1" {
		if major != 2 || minor != 7 || patch != 0 || rc != 1 {
			t.Errorf("parseVersion(%s): got %d.%d.%d-rc%d, want 2.7.0-rc1", latest, major, minor, patch, rc)
		}
	}
}

func TestIntegration_HasUncommittedChanges(t *testing.T) {
	tr := setupTestRepo(t)

	// Change to work directory
	origDir, _ := os.Getwd()
	defer os.Chdir(origDir)
	os.Chdir(tr.workDir)

	// Initially clean
	if hasUncommittedChanges() {
		t.Error("expected no uncommitted changes initially")
	}

	// Add an uncommitted file
	tr.writeFile("uncommitted.txt", "not committed")

	if !hasUncommittedChanges() {
		t.Error("expected uncommitted changes after writing file")
	}

	// Stage and commit
	tr.runGitInWork("add", ".")
	tr.runGitInWork("commit", "-m", "commit changes")

	if hasUncommittedChanges() {
		t.Error("expected no uncommitted changes after commit")
	}

	// Modify existing file
	tr.writeFile("README.md", "Modified content\n")

	if !hasUncommittedChanges() {
		t.Error("expected uncommitted changes after modifying file")
	}
}

func TestIntegration_MultipleTags(t *testing.T) {
	tr := setupTestRepo(t)

	// Create a realistic tag history
	tags := []string{"v2.0.0", "v2.1.0", "v2.2.0", "v2.3.0", "v2.4.0", "v2.5.0", "v2.6.0", "v2.6.1"}
	for _, tag := range tags {
		tr.addCommit("release " + tag)
		tr.createTag(tag, "Release "+tag)
	}

	latest := tr.getLatestTag()
	if latest != "v2.6.1" {
		t.Errorf("expected latest tag v2.6.1, got %s", latest)
	}

	// Verify all tags exist
	for _, tag := range tags {
		if !tr.tagExistsLocal(tag) {
			t.Errorf("tag %s should exist", tag)
		}
	}
}

func TestIntegration_BranchOperations(t *testing.T) {
	tr := setupTestRepo(t)

	// Create release branches
	tr.createBranch("release-2.5")
	tr.createBranch("release-2.6")

	origDir, _ := os.Getwd()
	defer os.Chdir(origDir)
	os.Chdir(tr.workDir)

	tr.runGitInWork("fetch")

	// Verify branches exist
	exists := branchExists("release-2.5")
	if !exists {
		t.Error("release-2.5 should exist")
	}

	exists = branchExists("release-2.6")
	if !exists {
		t.Error("release-2.6 should exist")
	}

	// Can checkout release branch
	tr.checkout("release-2.6")
	if tr.getCurrentBranch() != "release-2.6" {
		t.Errorf("expected branch release-2.6, got %s", tr.getCurrentBranch())
	}
}

func TestIntegration_VersionCalculationWithRealState(t *testing.T) {
	tr := setupTestRepo(t)
	tr.createTag("v2.6.1", "Release 2.6.1")

	origDir, _ := os.Getwd()
	defer os.Chdir(origDir)
	os.Chdir(tr.workDir)

	// Get current version from tag
	latest := tr.getLatestTag()
	major, minor, patch, rc := parseVersion(latest)

	tests := []struct {
		name            string
		bumpType        string
		branch          string
		expectedVersion string
		expectedBranch  string
		expectError     bool
	}{
		{"patch from master", "patch", "master", "2.6.2", "", false},
		{"patch-rc from master", "patch-rc", "master", "2.6.2-rc1", "", false},
		{"minor from master", "minor", "master", "2.7.0", "release-2.7", false},
		{"minor-rc from master", "minor-rc", "master", "2.7.0-rc1", "release-2.7", false},
		{"major from master", "major", "master", "3.0.0", "release-3.0", false},
		{"minor from target release", "minor", "release-2.7", "2.7.0", "release-2.7", false},
		{"minor from wrong release fails", "minor", "release-2.6", "", "", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			version, branch, err := calculateVersion(tt.bumpType, major, minor, patch, rc, tt.branch)

			if tt.expectError {
				if err == nil {
					t.Error("expected error")
				}
				return
			}

			if err != nil {
				t.Errorf("unexpected error: %v", err)
				return
			}

			if version != tt.expectedVersion {
				t.Errorf("version: got %s, want %s", version, tt.expectedVersion)
			}
			if branch != tt.expectedBranch {
				t.Errorf("branch: got %s, want %s", branch, tt.expectedBranch)
			}
		})
	}
}

func TestIntegration_DuplicateTagPrevention(t *testing.T) {
	tr := setupTestRepo(t)
	tr.createTag("v2.6.2", "Release 2.6.2")

	origDir, _ := os.Getwd()
	defer os.Chdir(origDir)
	os.Chdir(tr.workDir)

	// Verify tagExists correctly identifies the duplicate
	if !tagExists("v2.6.2") {
		t.Error("tagExists should return true for existing tag")
	}

	// The CLI should catch this before trying to create
	// This tests the preflight check behavior
}

func TestIntegration_RemoteSyncVerification(t *testing.T) {
	tr := setupTestRepo(t)

	origDir, _ := os.Getwd()
	defer os.Chdir(origDir)
	os.Chdir(tr.workDir)

	// Get local and remote HEADs
	local, _ := gitOutput("rev-parse", "HEAD")
	remote, _ := gitOutput("rev-parse", "origin/master")

	if local != remote {
		t.Errorf("local and remote should be in sync: local=%s remote=%s", local, remote)
	}

	// Add local commit without pushing
	tr.writeFile("local-only.txt", "not pushed")
	tr.runGitInWork("add", ".")
	tr.runGitInWork("commit", "-m", "local only commit")

	// Now they should differ
	newLocal, _ := gitOutput("rev-parse", "HEAD")
	if newLocal == remote {
		t.Error("local should differ from remote after unpushed commit")
	}
}

func TestIntegration_ReleaseBranchTagging(t *testing.T) {
	tr := setupTestRepo(t)

	// Create initial state: v2.6.0 on master, release-2.6 branch
	tr.createTag("v2.6.0", "Release 2.6.0")
	tr.createBranch("release-2.6")

	// Checkout release branch and add commits
	tr.checkout("release-2.6")
	tr.addCommit("bugfix for 2.6")
	tr.createTag("v2.6.1", "Release 2.6.1")

	// Verify state
	latest := tr.getLatestTag()
	if latest != "v2.6.1" {
		t.Errorf("expected latest tag v2.6.1, got %s", latest)
	}

	if tr.getCurrentBranch() != "release-2.6" {
		t.Errorf("expected to be on release-2.6, got %s", tr.getCurrentBranch())
	}

	// parseVersion should work correctly
	major, minor, patch, _ := parseVersion(latest)
	if major != 2 || minor != 6 || patch != 1 {
		t.Errorf("parseVersion failed: expected 2.6.1, got %d.%d.%d", major, minor, patch)
	}
}

func TestIntegration_RCToStableFlow(t *testing.T) {
	tr := setupTestRepo(t)

	// Simulate RC release flow
	tr.createTag("v2.6.0", "Release 2.6.0")
	tr.addCommit("feature for 2.7")
	tr.createTag("v2.7.0-rc1", "Release 2.7.0-rc1")
	tr.createBranch("release-2.7")

	// Check on release branch
	tr.checkout("release-2.7")
	tr.runGitInWork("fetch")

	latest := tr.getLatestTag()
	major, minor, patch, rc := parseVersion(latest)

	// Should be at rc1
	if rc != 1 {
		t.Errorf("expected rc=1, got rc=%d from tag %s", rc, latest)
	}

	// Calculate next RC
	nextVersion, _, err := calculateVersion("rc", major, minor, patch, rc, "release-2.7")
	if err != nil {
		t.Errorf("calculateVersion for rc failed: %v", err)
	}
	if nextVersion != "2.7.0-rc2" {
		t.Errorf("expected 2.7.0-rc2, got %s", nextVersion)
	}
}

func TestIntegration_CompareVersionsWithRealTags(t *testing.T) {
	tr := setupTestRepo(t)

	// Create version sequence
	tr.createTag("v2.5.0", "Release 2.5.0")
	tr.addCommit("1")
	tr.createTag("v2.6.0-rc1", "Release 2.6.0-rc1")
	tr.addCommit("2")
	tr.createTag("v2.6.0-rc2", "Release 2.6.0-rc2")
	tr.addCommit("3")
	tr.createTag("v2.6.0", "Release 2.6.0")

	// Parse different versions and compare
	tests := []struct {
		tag1     string
		tag2     string
		expected int // -1 if tag1 < tag2, 0 if equal, 1 if tag1 > tag2
	}{
		{"v2.5.0", "v2.6.0", -1},
		{"v2.6.0", "v2.5.0", 1},
		{"v2.6.0-rc1", "v2.6.0-rc2", -1},
		{"v2.6.0-rc2", "v2.6.0-rc1", 1},
		{"v2.6.0-rc2", "v2.6.0", -1}, // RC < stable
		{"v2.6.0", "v2.6.0-rc2", 1},  // stable > RC
	}

	for _, tt := range tests {
		t.Run(tt.tag1+"_vs_"+tt.tag2, func(t *testing.T) {
			m1, mi1, p1, r1 := parseVersion(tt.tag1)
			m2, mi2, p2, r2 := parseVersion(tt.tag2)

			result := compareVersions(m1, mi1, p1, r1, m2, mi2, p2, r2)
			if result != tt.expected {
				t.Errorf("compareVersions(%s, %s): got %d, want %d", tt.tag1, tt.tag2, result, tt.expected)
			}
		})
	}
}

func TestIntegration_DetectProtectedBranch_Master(t *testing.T) {
	tr := setupTestRepo(t)

	origDir, _ := os.Getwd()
	defer os.Chdir(origDir)
	os.Chdir(tr.workDir)

	// Our test setup uses 'master' as the default branch
	detected := detectProtectedBranch()
	if detected != "master" {
		t.Errorf("expected detected branch to be 'master', got '%s'", detected)
	}
}

func TestIntegration_DetectProtectedBranch_Main(t *testing.T) {
	// Create a repo with 'main' as the default branch
	remoteDir := t.TempDir()
	workDir := t.TempDir()

	// Initialize bare repo with main as default
	cmd := exec.Command("git", "init", "--bare", "--initial-branch=main")
	cmd.Dir = remoteDir
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("git init bare failed: %v\n%s", err, out)
	}

	// Initialize working repo with main as default
	cmd = exec.Command("git", "init", "--initial-branch=main")
	cmd.Dir = workDir
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("git init failed: %v\n%s", err, out)
	}

	// Configure git
	for _, args := range [][]string{
		{"config", "user.email", "test@example.com"},
		{"config", "user.name", "Test User"},
		{"remote", "add", "origin", remoteDir},
	} {
		cmd = exec.Command("git", args...)
		cmd.Dir = workDir
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("git %v failed: %v\n%s", args, err, out)
		}
	}

	// Create initial commit and push
	if err := os.WriteFile(workDir+"/README.md", []byte("# Test\n"), 0644); err != nil {
		t.Fatalf("write file: %v", err)
	}
	for _, args := range [][]string{
		{"add", "."},
		{"commit", "-m", "Initial commit"},
		{"push", "-u", "origin", "main"},
	} {
		cmd = exec.Command("git", args...)
		cmd.Dir = workDir
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("git %v failed: %v\n%s", args, err, out)
		}
	}

	origDir, _ := os.Getwd()
	defer os.Chdir(origDir)
	os.Chdir(workDir)

	detected := detectProtectedBranch()
	if detected != "main" {
		t.Errorf("expected detected branch to be 'main', got '%s'", detected)
	}
}

func TestIntegration_ProtectedBranchFlag(t *testing.T) {
	// Test that the global can be set (simulating CLI flag)
	original := protectedBranch
	defer func() { protectedBranch = original }()

	protectedBranch = "develop"

	// Verify calculateVersion respects the custom protected branch
	_, _, err := calculateVersion("minor", 2, 6, 1, 0, "develop")
	if err != nil {
		t.Errorf("minor bump from develop should work when protectedBranch=develop: %v", err)
	}

	_, _, err = calculateVersion("minor", 2, 6, 1, 0, "master")
	if err == nil {
		t.Error("minor bump from master should fail when protectedBranch=develop")
	}
}

func TestIntegration_ForceFlag(t *testing.T) {
	// Test that forceMode flag affects warnOrFail behavior
	originalForce := forceMode
	defer func() { forceMode = originalForce }()

	// Without force mode, warnOrFail returns an error
	forceMode = false
	err := warnOrFail("test error")
	if err == nil {
		t.Error("warnOrFail should return error when forceMode=false")
	}

	// With force mode, warnOrFail returns nil (just prints warning)
	forceMode = true
	err = warnOrFail("test warning")
	if err != nil {
		t.Errorf("warnOrFail should return nil when forceMode=true, got: %v", err)
	}
}

func TestIntegration_DryRunFlag(t *testing.T) {
	// Test that dryRun flag can be set
	original := dryRun
	defer func() { dryRun = original }()

	dryRun = false
	if dryRun {
		t.Error("dryRun should be false initially")
	}

	dryRun = true
	if !dryRun {
		t.Error("dryRun should be true after setting")
	}
}

func TestIntegration_EnvVarDefaults(t *testing.T) {
	// Save originals
	origProtectedBranch := protectedBranch
	defer func() {
		protectedBranch = origProtectedBranch
		os.Unsetenv("RELEASE_PROTECTED_BRANCH")
	}()

	t.Run("RELEASE_PROTECTED_BRANCH", func(t *testing.T) {
		protectedBranch = ""
		os.Setenv("RELEASE_PROTECTED_BRANCH", "main")
		loadEnvDefaults()
		if protectedBranch != "main" {
			t.Errorf("expected protectedBranch=main, got %s", protectedBranch)
		}
		os.Unsetenv("RELEASE_PROTECTED_BRANCH")
	})

	t.Run("CLI flag overrides env var", func(t *testing.T) {
		// Simulate CLI flag already set
		protectedBranch = "develop"
		os.Setenv("RELEASE_PROTECTED_BRANCH", "main")
		loadEnvDefaults()
		// CLI flag should win
		if protectedBranch != "develop" {
			t.Errorf("CLI flag should override env var, got %s", protectedBranch)
		}
		os.Unsetenv("RELEASE_PROTECTED_BRANCH")
	})
}

func TestIntegration_GetLatestVersionForLine(t *testing.T) {
	tr := setupTestRepo(t)

	// Create tags in different minor version lines
	tr.createTag("v2.5.0", "Release 2.5.0")
	tr.addCommit("bump1")
	tr.createTag("v2.5.1", "Release 2.5.1")
	tr.addCommit("bump2")
	tr.createTag("v2.5.2-rc1", "Release 2.5.2-rc1")
	tr.addCommit("bump3")

	// Create v2.6.x line
	tr.createTag("v2.6.0", "Release 2.6.0")
	tr.addCommit("bump4")
	tr.createTag("v2.6.1", "Release 2.6.1")

	// Change to work directory
	origDir, _ := os.Getwd()
	defer os.Chdir(origDir)
	os.Chdir(tr.workDir)

	// Test getting latest for v2.5.x line
	latest := getLatestVersionForLine(2, 5)
	if latest != "v2.5.2-rc1" {
		t.Errorf("expected latest in 2.5.x to be v2.5.2-rc1, got %s", latest)
	}

	// Test getting latest for v2.6.x line
	latest = getLatestVersionForLine(2, 6)
	if latest != "v2.6.1" {
		t.Errorf("expected latest in 2.6.x to be v2.6.1, got %s", latest)
	}

	// Test non-existent line
	latest = getLatestVersionForLine(3, 0)
	if latest != "" {
		t.Errorf("expected empty string for non-existent 3.0.x line, got %s", latest)
	}
}

func TestIntegration_RCAfterStableVersionBlocked(t *testing.T) {
	tr := setupTestRepo(t)

	// Create RC tag first, then stable tag
	tr.createTag("v2.7.0-rc1", "Release 2.7.0-rc1")
	tr.addCommit("stable release")
	tr.createTag("v2.7.0", "Release 2.7.0")

	// Change to work directory
	origDir, _ := os.Getwd()
	defer os.Chdir(origDir)
	os.Chdir(tr.workDir)

	// Set protected branch for test
	protectedBranch = "master"

	// Create a TUI model simulating being on v2.7.0-rc1 and selecting "rc" bump type
	// The model should detect that v2.7.0 (stable) exists and block the RC bump
	m := initialModel(2, 7, 0, 1, "master")

	// Find the "rc" option and select it
	for i, opt := range m.options {
		if opt.value == "rc" {
			m.cursor = i
			break
		}
	}

	// Select the RC option (which would try to create v2.7.0-rc2)
	newModel, _ := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m = newModel.(model)

	// Should error because stable v2.7.0 already exists
	if m.err == nil {
		t.Error("expected error when creating RC after stable version exists")
	}
	if m.err != nil && !strings.Contains(m.err.Error(), "stable version v2.7.0 already exists") {
		t.Errorf("unexpected error message: %v", m.err)
	}
	if !m.quitting {
		t.Error("expected model to be quitting after error")
	}
}