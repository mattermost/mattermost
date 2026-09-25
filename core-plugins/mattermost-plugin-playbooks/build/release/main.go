// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"fmt"
	"os"
	"os/exec"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/spf13/cobra"
)

var (
	version          string
	protectedBranch  string
	forceMode        bool
	dryRun           bool
	collectWarnings  bool     // collect warnings instead of printing (TUI mode)
	collectedWarnings []string // warnings collected during TUI operations
)

// Environment variable names for configuration defaults
const (
	envProtectedBranch = "RELEASE_PROTECTED_BRANCH"
)

// loadEnvDefaults loads configuration defaults from environment variables.
// These can be overridden by explicit CLI flags.
func loadEnvDefaults() {
	// Protected branch default
	if protectedBranch == "" {
		if env := os.Getenv(envProtectedBranch); env != "" {
			protectedBranch = env
		}
	}
}

// Styles
var (
	titleStyle    = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("99"))
	selectedStyle = lipgloss.NewStyle().Foreground(lipgloss.Color("212")).Bold(true)
	normalStyle   = lipgloss.NewStyle().Foreground(lipgloss.Color("252"))
	dimStyle      = lipgloss.NewStyle().Foreground(lipgloss.Color("240"))
	warnStyle     = lipgloss.NewStyle().Foreground(lipgloss.Color("214")).Bold(true)
	successStyle  = lipgloss.NewStyle().Foreground(lipgloss.Color("82")).Bold(true)
)

type stage int

const (
	stageSelect stage = iota
	stageCustom
	stageConfirm
)

type option struct {
	name       string
	value      string
	preview    string
	valid      bool   // Whether this option is valid from current branch
	validMsg   string // Validation message (e.g., "switch to release-2.6")
}

type model struct {
	stage       stage
	options     []option
	cursor      int
	selected    string
	newVersion  string
	mkBranch    string
	textInput   textinput.Model
	confirmed   bool
	err         error
	quitting    bool
	major       int
	minor       int
	patch       int
	rc          int
	branch      string
	warnings    []string // collected warnings to show before confirmation
}

func initialModel(major, minor, patch, rc int, branch string) model {
	ti := textinput.New()
	ti.Placeholder = "x.y.z or x.y.z-rcN"
	ti.CharLimit = 20
	ti.Width = 20

	// Helper to validate branch for patch-type releases (need matching release branch)
	releaseBranch := fmt.Sprintf("release-%d.%d", major, minor)
	onReleaseBranch := branch == releaseBranch
	onProtected := branch == protectedBranch

	// Release branches for minor/major bumps (based on NEW version)
	minorReleaseBranch := fmt.Sprintf("release-%d.%d", major, minor+1)
	majorReleaseBranch := fmt.Sprintf("release-%d.0", major+1)

	// Check if release branch exists (for validation messages)
	releaseBranchExists := branchExists(releaseBranch)

	// Build validation message for patch-type releases
	var patchValidMsg string
	patchValid := onReleaseBranch
	if !patchValid {
		if releaseBranchExists {
			patchValidMsg = fmt.Sprintf("switch to %s", releaseBranch)
		} else {
			patchValidMsg = fmt.Sprintf("create %s first", releaseBranch)
		}
	}

	// Build validation for minor/major releases
	// Minor/major bumps allowed from main/master OR matching target release branch
	onMinorReleaseBranch := branch == minorReleaseBranch
	onMajorReleaseBranch := branch == majorReleaseBranch

	minorValid := onProtected || onMinorReleaseBranch
	majorValid := onProtected || onMajorReleaseBranch

	var minorValidMsg, majorValidMsg string
	if !minorValid {
		minorValidMsg = fmt.Sprintf("switch to %s or %s", protectedBranch, minorReleaseBranch)
	}
	if !majorValid {
		majorValidMsg = fmt.Sprintf("switch to %s or %s", protectedBranch, majorReleaseBranch)
	}

	// RC validation: minor/major RCs follow same rules, patch RCs need matching release branch
	var rcValid bool
	var rcValidMsg string
	if rc > 0 {
		if patch == 0 {
			// Minor/major RC (e.g., v2.7.0-rc1) - allowed on main/master or matching release branch
			// Use releaseBranch since for RCs the current version already indicates the target
			rcValid = onProtected || onReleaseBranch
			if !rcValid {
				rcValidMsg = fmt.Sprintf("switch to %s or %s", protectedBranch, releaseBranch)
			}
		} else {
			// Patch RC (e.g., v2.6.2-rc1) - requires matching release branch
			rcValid = onReleaseBranch
			rcValidMsg = patchValidMsg
		}
	}

	var options []option

	// When on an RC, show rc and rc-finalize first (most common actions)
	if rc > 0 {
		options = append(options,
			option{name: "rc", value: "rc", preview: fmt.Sprintf("%d.%d.%d-rc%d", major, minor, patch, rc+1), valid: rcValid, validMsg: rcValidMsg},
			option{name: "rc-finalize", value: "rc-finalize", preview: fmt.Sprintf("%d.%d.%d", major, minor, patch), valid: rcValid, validMsg: rcValidMsg},
		)
	}

	options = append(options,
		option{name: "patch", value: "patch", preview: fmt.Sprintf("%d.%d.%d", major, minor, patch+1), valid: patchValid, validMsg: patchValidMsg},
		option{name: "patch-rc", value: "patch-rc", preview: fmt.Sprintf("%d.%d.%d-rc1", major, minor, patch+1), valid: patchValid, validMsg: patchValidMsg},
		option{name: "minor", value: "minor", preview: fmt.Sprintf("%d.%d.0", major, minor+1), valid: minorValid, validMsg: minorValidMsg},
		option{name: "minor-rc", value: "minor-rc", preview: fmt.Sprintf("%d.%d.0-rc1", major, minor+1), valid: minorValid, validMsg: minorValidMsg},
		option{name: "major", value: "major", preview: fmt.Sprintf("%d.0.0", major+1), valid: majorValid, validMsg: majorValidMsg},
		option{name: "major-rc", value: "major-rc", preview: fmt.Sprintf("%d.0.0-rc1", major+1), valid: majorValid, validMsg: majorValidMsg},
		option{name: "custom", value: "custom", preview: "enter version", valid: true},
	)

	return model{
		stage:     stageSelect,
		options:   options,
		textInput: ti,
		major:     major,
		minor:     minor,
		patch:     patch,
		rc:        rc,
		branch:    branch,
	}
}

func (m model) Init() tea.Cmd {
	return nil
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch m.stage {
		case stageSelect:
			return m.updateSelect(msg)
		case stageCustom:
			return m.updateCustom(msg)
		case stageConfirm:
			return m.updateConfirm(msg)
		}
	}
	return m, nil
}

func (m model) updateSelect(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch msg.String() {
	case "ctrl+c", "q", "esc":
		m.quitting = true
		return m, tea.Quit
	case "up", "k":
		if m.cursor > 0 {
			m.cursor--
		}
	case "down", "j":
		if m.cursor < len(m.options)-1 {
			m.cursor++
		}
	case "enter":
		selectedOpt := m.options[m.cursor]
		m.selected = selectedOpt.value
		if m.selected == "custom" {
			m.stage = stageCustom
			m.textInput.Focus()
			return m, textinput.Blink
		}

		// Check if selecting an invalid option (e.g., patch from master)
		if !selectedOpt.valid {
			if forceMode {
				m.warnings = append(m.warnings, selectedOpt.validMsg)
			} else {
				m.err = fmt.Errorf("%s", selectedOpt.validMsg)
				m.quitting = true
				return m, tea.Quit
			}
		}

		// Clear and collect warnings during version calculation
		collectedWarnings = nil
		newVer, mkBranch, err := calculateVersion(m.selected, m.major, m.minor, m.patch, m.rc, m.branch)
		if err != nil && !forceMode {
			m.err = err
			m.quitting = true
			return m, tea.Quit
		}
		m.newVersion = newVer
		m.mkBranch = mkBranch
		// Merge collected warnings with any existing warnings (e.g., invalid option with --force)
		m.warnings = append(m.warnings, collectedWarnings...)

		// Preflight: check if creating RC when stable version already exists
		if strings.Contains(m.newVersion, "-rc") {
			stableVersion := strings.Split(m.newVersion, "-rc")[0]
			if tagExists("v" + stableVersion) {
				if forceMode {
					m.warnings = append(m.warnings, fmt.Sprintf("stable version v%s already exists, can't create RC", stableVersion))
				} else {
					m.err = fmt.Errorf("stable version v%s already exists, can't create RC", stableVersion)
					m.quitting = true
					return m, tea.Quit
				}
			}
		}

		// Preflight: check if tag already exists (skip in force mode)
		if tagExists("v" + m.newVersion) {
			if forceMode {
				m.warnings = append(m.warnings, fmt.Sprintf("tag v%s already exists", m.newVersion))
			} else {
				m.err = fmt.Errorf("tag v%s already exists", m.newVersion)
				m.quitting = true
				return m, tea.Quit
			}
		}

		// Preflight: check if release branch already exists (skip in force mode)
		if mkBranch != "" {
			exists := branchExists(mkBranch)
			if exists {
				if strings.Contains(m.selected, "rc") {
					if forceMode {
						m.warnings = append(m.warnings, fmt.Sprintf("release branch %s already exists", mkBranch))
					} else {
						m.err = fmt.Errorf("release branch %s already exists, can't start new RC cycle", mkBranch)
						m.quitting = true
						return m, tea.Quit
					}
				}
				m.mkBranch = "" // Skip branch creation for non-RC
			}
		}

		m.stage = stageConfirm
	}
	return m, nil
}

func (m model) updateCustom(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch msg.String() {
	case "ctrl+c", "esc":
		m.stage = stageSelect
		return m, nil
	case "enter":
		ver := m.textInput.Value()
		if ver == "" {
			return m, nil
		}
		m.newVersion = strings.TrimPrefix(ver, "v")
		m.warnings = nil // clear any previous warnings

		// Validate semver format
		if !isValidSemver(m.newVersion) {
			m.err = fmt.Errorf("invalid version format: %s (expected X.Y.Z or X.Y.Z-rcN)", m.newVersion)
			m.quitting = true
			return m, tea.Quit
		}

		// Validate and determine if we need a release branch
		newMajor, newMinor, newPatch, newRC := parseVersion("v" + m.newVersion)

		// Check for version regression (scoped to target release line)
		if newMajor == m.major && newMinor == m.minor {
			// Same release line - compare against current (global latest)
			if compareVersions(newMajor, newMinor, newPatch, newRC, m.major, m.minor, m.patch, m.rc) <= 0 {
				msg := fmt.Sprintf("new version v%s must be greater than current version v%d.%d.%d", m.newVersion, m.major, m.minor, m.patch)
				if forceMode {
					m.warnings = append(m.warnings, msg)
				} else {
					m.err = fmt.Errorf("%s", msg)
					m.quitting = true
					return m, tea.Quit
				}
			}
		} else {
			// Different release line - compare against latest in that line
			lineLatest := getLatestVersionForLine(newMajor, newMinor)
			if lineLatest != "" {
				lineMajor, lineMinor, linePatch, lineRC := parseVersion(lineLatest)
				if compareVersions(newMajor, newMinor, newPatch, newRC, lineMajor, lineMinor, linePatch, lineRC) <= 0 {
					msg := fmt.Sprintf("new version v%s must be greater than %s (latest in %d.%d.x line)", m.newVersion, lineLatest, newMajor, newMinor)
					if forceMode {
						m.warnings = append(m.warnings, msg)
					} else {
						m.err = fmt.Errorf("%s", msg)
						m.quitting = true
						return m, tea.Quit
					}
				}
			}
		}
		if newMajor > m.major || (newMajor == m.major && newMinor > m.minor) {
			// Minor/major bump - requires main/master or target release branch
			targetBranch := fmt.Sprintf("release-%d.%d", newMajor, newMinor)
			onValidBranch := m.branch == protectedBranch || m.branch == targetBranch
			if !onValidBranch {
				msg := fmt.Sprintf("version %s is a minor/major bump, requires %s or %s", m.newVersion, protectedBranch, targetBranch)
				if forceMode {
					m.warnings = append(m.warnings, msg)
				} else {
					m.err = fmt.Errorf("%s", msg)
					m.quitting = true
					return m, tea.Quit
				}
			}
			m.mkBranch = targetBranch
		} else if branchVer, ok := strings.CutPrefix(m.branch, "release-"); ok {
			// Patch bump on release branch - validate branch matches target version
			expectedVer := fmt.Sprintf("%d.%d", newMajor, newMinor)
			if branchVer != expectedVer {
				msg := fmt.Sprintf("branch %s doesn't match version %s", m.branch, expectedVer)
				if forceMode {
					m.warnings = append(m.warnings, msg)
				} else {
					m.err = fmt.Errorf("%s", msg)
					m.quitting = true
					return m, tea.Quit
				}
			}
		}

		// Preflight: check if creating RC when stable version already exists
		if strings.Contains(m.newVersion, "-rc") {
			stableVersion := strings.Split(m.newVersion, "-rc")[0]
			if tagExists("v" + stableVersion) {
				msg := fmt.Sprintf("stable version v%s already exists, can't create RC", stableVersion)
				if forceMode {
					m.warnings = append(m.warnings, msg)
				} else {
					m.err = fmt.Errorf("%s", msg)
					m.quitting = true
					return m, tea.Quit
				}
			}
		}

		// Preflight: check if tag already exists
		if tagExists("v" + m.newVersion) {
			msg := fmt.Sprintf("tag v%s already exists", m.newVersion)
			if forceMode {
				m.warnings = append(m.warnings, msg)
			} else {
				m.err = fmt.Errorf("%s", msg)
				m.quitting = true
				return m, tea.Quit
			}
		}

		// Preflight: check if release branch already exists
		if m.mkBranch != "" {
			exists := branchExists(m.mkBranch)
			if exists {
				m.mkBranch = "" // Skip branch creation, branch already exists
			}
		}

		m.stage = stageConfirm
		return m, nil
	}

	var cmd tea.Cmd
	m.textInput, cmd = m.textInput.Update(msg)
	return m, cmd
}

func (m model) updateConfirm(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch msg.String() {
	case "ctrl+c", "esc", "n", "N":
		m.quitting = true
		return m, tea.Quit
	case "enter", "y", "Y":
		m.confirmed = true
		return m, tea.Quit
	}
	return m, nil
}

func (m model) View() string {
	// Don't print error here - let cobra handle it for consistent error display
	if m.quitting {
		if m.err == nil {
			return dimStyle.Render("Aborted.\n")
		}
		return "" // Error will be displayed by cobra
	}

	var s strings.Builder

	// Header (left-aligned)
	s.WriteString("\n")
	s.WriteString(titleStyle.Render(fmt.Sprintf("Current: v%d.%d.%d", m.major, m.minor, m.patch)))
	if m.rc > 0 {
		s.WriteString(titleStyle.Render(fmt.Sprintf("-rc%d", m.rc)))
	}
	s.WriteString(dimStyle.Render(fmt.Sprintf(" (%s)", m.branch)))
	s.WriteString("\n\n")

	switch m.stage {
	case stageSelect:
		s.WriteString("Select bump type:\n\n")
		for i, opt := range m.options {
			cursor := "  "
			style := normalStyle
			if i == m.cursor {
				cursor = "> "
				style = selectedStyle
			}
			// Pad option name to 12 chars (length of "rc-finalize")
			paddedName := fmt.Sprintf("%-12s", opt.name)
			var preview string
			if opt.value == "custom" {
				preview = dimStyle.Render(fmt.Sprintf("-> %s", opt.preview))
			} else {
				// Pad preview to consistent width (e.g., "-> v2.6.2-rc1" = 15 chars)
				preview = dimStyle.Render(fmt.Sprintf("-> v%-12s", opt.preview))
			}
			// Add validation message if option is not valid
			var validationMsg string
			if !opt.valid && opt.validMsg != "" {
				validationMsg = warnStyle.Render(fmt.Sprintf("  (%s)", opt.validMsg))
			}
			fmt.Fprintf(&s, "%s%s %s%s\n", cursor, style.Render(paddedName), preview, validationMsg)
		}
		s.WriteString(dimStyle.Render("\n[j/k or arrows to move, enter to select, q/esc to quit]\n"))

	case stageCustom:
		s.WriteString("Enter custom version:\n\n")
		s.WriteString(m.textInput.View())
		s.WriteString(dimStyle.Render("\n\n[enter to confirm, esc to go back]\n"))

	case stageConfirm:
		// Display any warnings collected during validation
		if len(m.warnings) > 0 {
			for _, w := range m.warnings {
				s.WriteString(warnStyle.Render("Warning: "+w) + "\n")
			}
			s.WriteString("\n")
		}
		msg := fmt.Sprintf("v%s", m.newVersion)
		if m.mkBranch != "" {
			msg += fmt.Sprintf(" (%s branch recommended for patches)", m.mkBranch)
		}
		s.WriteString(successStyle.Render("Will tag: "+msg) + "\n\n")
		yes := dimStyle.Render("[y]es")
		no := dimStyle.Render("[n]o")
		fmt.Fprintf(&s, "Proceed? %s / %s ", yes, no)
	}

	return s.String()
}

func main() {
	rootCmd := &cobra.Command{
		Use:   "release [bump-type]",
		Short: "Tag a release with semver versioning",
		Long: `Tag a release with automatic version calculation and branch management.

Bump types: patch, minor, major, patch-rc, minor-rc, major-rc, rc, rc-finalize

Examples:
  release              # Interactive mode
  release patch        # Bump patch version
  release minor-rc     # Start minor release candidate cycle
  release --version=2.6.2  # Explicit version
  release --protected-branch=main patch  # Use 'main' as protected branch
  release --force patch  # Skip validation enforcement (warnings only)

Environment Variables (for repo-specific defaults):
  RELEASE_PROTECTED_BRANCH     Default protected branch (e.g., "main")`,
		Args: cobra.MaximumNArgs(1),
		RunE: runRelease,
	}

	rootCmd.Flags().StringVarP(&version, "version", "v", "", "Explicit version to tag")
	rootCmd.Flags().StringVarP(&protectedBranch, "protected-branch", "b", "", "Protected branch for minor/major releases (env: RELEASE_PROTECTED_BRANCH)")
	rootCmd.Flags().BoolVarP(&forceMode, "force", "f", false, "Skip validation enforcement (show warnings instead of errors)")
	rootCmd.Flags().BoolVarP(&dryRun, "dry-run", "n", false, "Print commands instead of executing them")

	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}

func runRelease(cmd *cobra.Command, args []string) error {
	// Load defaults from environment variables (CLI flags override)
	loadEnvDefaults()

	// Print dry-run header immediately
	if dryRun {
		fmt.Println()
		fmt.Println(warnStyle.Render("========================================================"))
		fmt.Println(warnStyle.Render("  DRY RUN MODE - No changes will be made"))
		fmt.Println(warnStyle.Render("========================================================"))
		fmt.Println()
	}

	// Auto-detect protected branch if still not specified
	if protectedBranch == "" {
		protectedBranch = detectProtectedBranch()
	}

	// Get current state
	branch, err := gitOutput("rev-parse", "--abbrev-ref", "HEAD")
	if err != nil {
		return fmt.Errorf("failed to get current branch: %w", err)
	}

	// Validate branch type (master or release-*)
	if branch != protectedBranch && !strings.HasPrefix(branch, "release-") {
		if err := warnOrFail("must be on %s or release-* branch (currently on %s)", protectedBranch, branch); err != nil {
			return err
		}
	} else {
		fmt.Println(successStyle.Render("✓") + dimStyle.Render(" on valid branch "+branch))
	}

	// Check for uncommitted changes
	if hasUncommittedChanges() {
		if err := warnOrFail("working directory has uncommitted changes"); err != nil {
			return err
		}
	} else {
		fmt.Println(successStyle.Render("✓") + dimStyle.Render(" working directory clean"))
	}

	// Check GPG signing is configured
	if !isGPGConfigured() {
		gpgErr := "GPG signing not configured. Please configure git signing:\n\n" +
			"  For GPG:\n" +
			"    gpg --gen-key\n" +
			"    git config --global user.signingkey <KEY_ID>\n\n" +
			"  For SSH signing:\n" +
			"    git config --global gpg.format ssh\n" +
			"    git config --global user.signingkey ~/.ssh/id_ed25519.pub\n\n" +
			"  See: https://docs.github.com/en/authentication/managing-commit-signature-verification"
		if err := warnOrFail("%s", gpgErr); err != nil {
			return err
		}
	} else {
		fmt.Println(successStyle.Render("✓") + dimStyle.Render(" GPG signing configured"))
	}

	// Check for pending changes
	if err := gitRun("fetch"); err != nil {
		return fmt.Errorf("failed to fetch: %w", err)
	}
	local, _ := gitOutput("rev-parse", "HEAD")
	remote, _ := gitOutput("rev-parse", "origin/"+branch)
	if local != remote {
		if err := warnOrFail("branch not up to date with origin/%s", branch); err != nil {
			return err
		}
	} else {
		fmt.Println(successStyle.Render("✓") + dimStyle.Render(" up to date with origin"))
	}

	fmt.Println()

	// Parse current version
	currentVersion := getLatestVersion()
	if currentVersion == "" {
		return fmt.Errorf("no version tags found")
	}
	major, minor, patch, rc := parseVersion(currentVersion)

	// Determine bump type
	var bumpType string
	var newVersion, mkBranch string
	var fromTUI bool // Track if we used TUI mode (to skip duplicate validations)

	if version != "" {
		// Explicit version provided via flag
		newVersion = strings.TrimPrefix(version, "v")

		// Validate semver format
		if !isValidSemver(newVersion) {
			if err := warnOrFail("invalid version format: %s (expected X.Y.Z or X.Y.Z-rcN)", newVersion); err != nil {
				return err
			}
		}

		newMajor, newMinor, _, _ := parseVersion("v" + newVersion)
		if newMajor > major || (newMajor == major && newMinor > minor) {
			// Minor/major bump - requires main/master or target release branch
			targetBranch := fmt.Sprintf("release-%d.%d", newMajor, newMinor)
			onValidBranch := branch == protectedBranch || branch == targetBranch
			if !onValidBranch {
				if err := warnOrFail("version %s is a minor/major bump, requires %s or %s", newVersion, protectedBranch, targetBranch); err != nil {
					return err
				}
			}
			mkBranch = targetBranch
		}
	} else if len(args) > 0 {
		// Bump type provided as argument
		bumpType = args[0]
		var err error
		newVersion, mkBranch, err = calculateVersion(bumpType, major, minor, patch, rc, branch)
		if err != nil {
			return err
		}
	} else {
		// Interactive mode with bubbletea
		collectWarnings = true // collect warnings to display in TUI
		m := initialModel(major, minor, patch, rc, branch)
		p := tea.NewProgram(m)
		finalModel, err := p.Run()
		collectWarnings = false
		if err != nil {
			return fmt.Errorf("TUI error: %w", err)
		}

		fm := finalModel.(model)
		if fm.err != nil {
			return fm.err
		}
		if fm.quitting && !fm.confirmed {
			return fmt.Errorf("aborted")
		}
		newVersion = fm.newVersion
		mkBranch = fm.mkBranch
		fromTUI = true // TUI already performed validations
	}

	// Skip these validations if TUI mode already performed them
	if !fromTUI {
		// Validate branch matches version
		tagMajor, tagMinor, _, _ := parseVersion("v" + newVersion)
		expectedBranch := fmt.Sprintf("release-%d.%d", tagMajor, tagMinor)
		if strings.HasPrefix(branch, "release-") {
			if branch == expectedBranch {
				fmt.Println(successStyle.Render("✓") + dimStyle.Render(" on version-matched release branch "+branch))
			} else {
				if err := warnOrFail("not on version-matched release branch (expected %s, on %s)", expectedBranch, branch); err != nil {
					return err
				}
			}
		} else if branch == protectedBranch {
			fmt.Println(successStyle.Render("✓") + dimStyle.Render(" on protected branch "+branch))
		}
		// Check for version regression (scoped to the target release line)
		newMajor, newMinor, newPatch, newRC := parseVersion("v" + newVersion)
		if newMajor == major && newMinor == minor {
			// Same release line - compare against global latest
			if compareVersions(newMajor, newMinor, newPatch, newRC, major, minor, patch, rc) <= 0 {
				if err := warnOrFail("new version v%s must be greater than current version %s", newVersion, currentVersion); err != nil {
					return err
				}
			}
		} else {
			// Different release line - compare against latest in that line
			lineLatest := getLatestVersionForLine(newMajor, newMinor)
			if lineLatest != "" {
				lineMajor, lineMinor, linePatch, lineRC := parseVersion(lineLatest)
				if compareVersions(newMajor, newMinor, newPatch, newRC, lineMajor, lineMinor, linePatch, lineRC) <= 0 {
					if err := warnOrFail("new version v%s must be greater than %s (latest in %d.%d.x line)", newVersion, lineLatest, newMajor, newMinor); err != nil {
						return err
					}
				}
			}
		}
		// Check if release branch already exists
		if mkBranch != "" {
			exists := branchExists(mkBranch)
			if exists {
				if bumpType != "" && strings.Contains(bumpType, "rc") {
					if err := warnOrFail("release branch %s already exists, can't start new RC cycle", mkBranch); err != nil {
						return err
					}
				}
				mkBranch = "" // Skip branch creation for non-RC
			}
		}

		// Check if creating RC when stable version already exists
		if strings.Contains(newVersion, "-rc") {
			stableVersion := strings.Split(newVersion, "-rc")[0]
			if tagExists("v" + stableVersion) {
				if err := warnOrFail("stable version v%s already exists, can't create RC", stableVersion); err != nil {
					return err
				}
			}
		}

		// Check if tag already exists
		if tagExists("v" + newVersion) {
			if err := warnOrFail("tag v%s already exists", newVersion); err != nil {
				return err
			}
		}
	}

	// Non-interactive confirm for CLI args mode
	if version != "" || len(args) > 0 {
		msg := fmt.Sprintf("v%s", newVersion)
		if mkBranch != "" {
			msg += fmt.Sprintf(" (%s branch recommended for patches)", mkBranch)
		}
		fmt.Printf("\nWill tag: %s\n", msg)
		if !confirm("Approve?") {
			return fmt.Errorf("aborted")
		}
	}

	// Print instructions for release branch creation if needed (before tagging)
	// Only show if we're not already on the target branch and it doesn't exist
	appName := getAppName()
	if mkBranch != "" && branch != mkBranch {
		exists := branchExists(mkBranch)
		if !exists {
			fmt.Println()
			fmt.Println(dimStyle.Render("Note: Create " + mkBranch + " branch for future patch releases"))
			fmt.Println()
			fmt.Println("Create the release branch:")
			fmt.Printf("  git branch %s\n", mkBranch)
			fmt.Printf("  git push origin %s\n", mkBranch)
			fmt.Println()
		}
	}

	// Create tag
	tagMsg := fmt.Sprintf("Release %s v%s", appName, newVersion)
	if dryRun {
		fmt.Println(dimStyle.Render("[dry-run] would execute:"))
		fmt.Printf("  git tag -s -a v%s -m %q\n", newVersion, tagMsg)
		fmt.Printf("  git push origin v%s\n", newVersion)
	} else {
		fmt.Printf("Tagging v%s...\n", newVersion)
		if err := gitRun("tag", "-s", "-a", "v"+newVersion, "-m", tagMsg); err != nil {
			return fmt.Errorf("failed to create tag: %w", err)
		}
		if err := gitRun("push", "origin", "v"+newVersion); err != nil {
			return fmt.Errorf("failed to push tag: %w", err)
		}
	}

	if dryRun {
		fmt.Printf("\n[dry-run] Would release %s v%s\n", appName, newVersion)
	} else {
		fmt.Printf("\nReleased %s v%s\n", appName, newVersion)
	}
	return nil
}

func parseVersion(v string) (major, minor, patch, rc int) {
	v = strings.TrimPrefix(v, "v")
	re := regexp.MustCompile(`^(\d+)\.(\d+)\.(\d+)(?:-rc(\d+))?`)
	m := re.FindStringSubmatch(v)
	if len(m) >= 4 {
		major, _ = strconv.Atoi(m[1])
		minor, _ = strconv.Atoi(m[2])
		patch, _ = strconv.Atoi(m[3])
		if len(m) > 4 && m[4] != "" {
			rc, _ = strconv.Atoi(m[4])
		}
	}
	return
}

func calculateVersion(bumpType string, major, minor, patch, rc int, branch string) (string, string, error) {
	var newVersion, mkBranch string

	// Check branch requirement for minor/major (can be bypassed with --force)
	// Minor/major bumps allowed from main/master or the matching target release branch
	isMinor := strings.HasPrefix(bumpType, "minor")
	isMajor := strings.HasPrefix(bumpType, "major")
	if isMinor || isMajor {
		var targetBranch string
		if isMinor {
			targetBranch = fmt.Sprintf("release-%d.%d", major, minor+1)
		} else {
			targetBranch = fmt.Sprintf("release-%d.0", major+1)
		}
		onValidBranch := branch == protectedBranch || branch == targetBranch
		if !onValidBranch {
			if err := warnOrFail("%s bumps require %s or %s", bumpType, protectedBranch, targetBranch); err != nil {
				return "", "", err
			}
		}
	}

	switch bumpType {
	case "patch":
		newVersion = fmt.Sprintf("%d.%d.%d", major, minor, patch+1)
	case "patch-rc":
		newVersion = fmt.Sprintf("%d.%d.%d-rc1", major, minor, patch+1)
	case "rc":
		if rc == 0 {
			return "", "", fmt.Errorf("current version is not an RC, use patch-rc, minor-rc, or major-rc")
		}
		newVersion = fmt.Sprintf("%d.%d.%d-rc%d", major, minor, patch, rc+1)
	case "rc-finalize":
		if rc == 0 {
			return "", "", fmt.Errorf("current version is not an RC, nothing to finalize")
		}
		newVersion = fmt.Sprintf("%d.%d.%d", major, minor, patch)
	case "minor":
		minor++
		newVersion = fmt.Sprintf("%d.%d.0", major, minor)
		mkBranch = fmt.Sprintf("release-%d.%d", major, minor)
	case "minor-rc":
		minor++
		newVersion = fmt.Sprintf("%d.%d.0-rc1", major, minor)
		mkBranch = fmt.Sprintf("release-%d.%d", major, minor)
	case "major":
		major++
		newVersion = fmt.Sprintf("%d.0.0", major)
		mkBranch = fmt.Sprintf("release-%d.0", major)
	case "major-rc":
		major++
		newVersion = fmt.Sprintf("%d.0.0-rc1", major)
		mkBranch = fmt.Sprintf("release-%d.0", major)
	case "custom":
		// Version set via flag
	default:
		return "", "", fmt.Errorf("invalid bump type: %s", bumpType)
	}

	return newVersion, mkBranch, nil
}

// confirmModel is a bubbletea model for y/n confirmation
type confirmModel struct {
	prompt    string
	confirmed bool
	done      bool
}

func (m confirmModel) Init() tea.Cmd {
	return nil
}

func (m confirmModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "y", "Y":
			m.confirmed = true
			m.done = true
			return m, tea.Quit
		case "n", "N", "q", "esc", "ctrl+c":
			m.confirmed = false
			m.done = true
			return m, tea.Quit
		}
	}
	return m, nil
}

func (m confirmModel) View() string {
	if m.done {
		return ""
	}
	yes := dimStyle.Render("[y]es")
	no := dimStyle.Render("[n]o")
	return fmt.Sprintf("%s %s / %s ", m.prompt, yes, no)
}

func confirm(prompt string) bool {
	m := confirmModel{prompt: prompt}
	p := tea.NewProgram(m)
	finalModel, err := p.Run()
	if err != nil {
		return false
	}
	return finalModel.(confirmModel).confirmed
}

// warnOrFail returns an error if forceMode is false, otherwise prints a warning and returns nil.
// In collectWarnings mode (TUI), warnings are collected instead of printed.
func warnOrFail(format string, args ...any) error {
	msg := fmt.Sprintf(format, args...)
	if forceMode {
		if collectWarnings {
			collectedWarnings = append(collectedWarnings, msg)
		} else {
			fmt.Println(warnStyle.Render("Warning: " + msg))
		}
		return nil
	}
	return fmt.Errorf("%s", msg)
}

func gitOutput(args ...string) (string, error) {
	cmd := exec.Command("git", args...)
	out, err := cmd.Output()
	return strings.TrimSpace(string(out)), err
}

func gitRun(args ...string) error {
	cmd := exec.Command("git", args...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

func branchExists(name string) bool {
	if err := exec.Command("git", "show-ref", "--verify", "--quiet", "refs/heads/"+name).Run(); err == nil {
		return true
	}
	if err := exec.Command("git", "show-ref", "--verify", "--quiet", "refs/remotes/origin/"+name).Run(); err == nil {
		return true
	}
	return false
}

// sortVersionTagsDesc sorts version tags in descending order (newest first)
// using proper semver comparison where stable > RC (e.g., v2.6.0 > v2.6.0-rc1)
func sortVersionTagsDesc(tags []string) {
	sort.Slice(tags, func(i, j int) bool {
		m1, mi1, p1, r1 := parseVersion(tags[i])
		m2, mi2, p2, r2 := parseVersion(tags[j])
		return compareVersions(m1, mi1, p1, r1, m2, mi2, p2, r2) > 0
	})
}

// getLatestVersion returns the latest version tag using proper semver sorting.
func getLatestVersion() string {
	out, err := gitOutput("tag", "-l", "v*")
	if err != nil || out == "" {
		return ""
	}
	tags := strings.Split(out, "\n")
	sortVersionTagsDesc(tags)
	return tags[0]
}

// getLatestVersionForLine returns the latest tag for a specific major.minor line.
// For example, getLatestVersionForLine(2, 5) returns the latest v2.5.* tag.
// Returns empty string if no tags exist for that line.
func getLatestVersionForLine(major, minor int) string {
	pattern := fmt.Sprintf("v%d.%d.*", major, minor)
	out, err := gitOutput("tag", "-l", pattern)
	if err != nil || out == "" {
		return ""
	}
	tags := strings.Split(out, "\n")
	sortVersionTagsDesc(tags)
	return tags[0]
}

func tagExists(name string) bool {
	err := exec.Command("git", "show-ref", "--verify", "--quiet", "refs/tags/"+name).Run()
	return err == nil
}

func hasUncommittedChanges() bool {
	// Check for staged or unstaged changes
	out, err := gitOutput("status", "--porcelain")
	if err != nil {
		return false
	}
	return strings.TrimSpace(out) != ""
}

func isGPGConfigured() bool {
	// Check if user has explicit signing key configured
	key, _ := gitOutput("config", "--get", "user.signingkey")
	if key != "" {
		return true
	}
	// SSH signing requires explicit signingkey, so if format is ssh but no key, fail
	format, _ := gitOutput("config", "--get", "gpg.format")
	if format == "ssh" {
		return false // SSH signing requires explicit user.signingkey
	}
	// For GPG, try to detect if any secret keys exist
	gpgProgram, _ := gitOutput("config", "--get", "gpg.program")
	if gpgProgram == "" {
		gpgProgram = "gpg"
	}
	err := exec.Command(gpgProgram, "--list-secret-keys", "--keyid-format", "LONG").Run()
	return err == nil
}

func isValidSemver(v string) bool {
	v = strings.TrimPrefix(v, "v")
	re := regexp.MustCompile(`^(\d+)\.(\d+)\.(\d+)(?:-rc(\d+))?$`)
	return re.MatchString(v)
}

func compareVersions(major1, minor1, patch1, rc1, major2, minor2, patch2, rc2 int) int {
	// Returns: -1 if v1 < v2, 0 if equal, 1 if v1 > v2
	if major1 != major2 {
		if major1 < major2 {
			return -1
		}
		return 1
	}
	if minor1 != minor2 {
		if minor1 < minor2 {
			return -1
		}
		return 1
	}
	if patch1 != patch2 {
		if patch1 < patch2 {
			return -1
		}
		return 1
	}
	// RC handling: 0 means stable release, which is > any RC
	if rc1 == 0 && rc2 > 0 {
		return 1 // stable > RC
	}
	if rc1 > 0 && rc2 == 0 {
		return -1 // RC < stable
	}
	if rc1 != rc2 {
		if rc1 < rc2 {
			return -1
		}
		return 1
	}
	return 0
}

func getAppName() string {
	out, err := gitOutput("config", "--get", "remote.origin.url")
	if err != nil {
		return "app"
	}
	// Extract repo name from URL
	out = strings.TrimSuffix(out, ".git")
	parts := strings.Split(out, "/")
	if len(parts) > 0 {
		return parts[len(parts)-1]
	}
	return "app"
}

// detectProtectedBranch attempts to auto-detect the main/master branch.
// Checks in order: origin/HEAD, common branch names, falls back to "master".
func detectProtectedBranch() string {
	// Try to get the default branch from origin/HEAD
	out, err := gitOutput("symbolic-ref", "refs/remotes/origin/HEAD")
	if err == nil && out != "" {
		// Format: refs/remotes/origin/main -> main
		parts := strings.Split(out, "/")
		if len(parts) > 0 {
			return parts[len(parts)-1]
		}
	}

	// Check if common branches exist locally or on remote
	for _, candidate := range []string{"main", "master"} {
		exists := branchExists(candidate)
		if exists {
			return candidate
		}
	}

	// Default to master for backward compatibility
	return "master"
}