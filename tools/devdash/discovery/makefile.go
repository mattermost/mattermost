package discovery

import (
	"bufio"
	"os"
	"regexp"
	"strings"

	"github.com/mattermost/mattermost/tools/devdash/model"
)

var (
	// Match lines starting with a valid target name followed by a colon.
	// We filter out variable assignments (:=, ?=, +=) separately.
	targetRe = regexp.MustCompile(`^([a-zA-Z][a-zA-Z0-9_.-]*)\s*:`)
	commentRe = regexp.MustCompile(`##\s*(.+)$`)
	// Variable assignment patterns to reject
	varAssignRe = regexp.MustCompile(`^[a-zA-Z_][a-zA-Z0-9_]*\s*[:?+]?=`)
)

func ParseMakeTargets(path string) ([]model.Target, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	var targets []model.Target
	seen := make(map[string]bool)
	var prevComment string

	// Collect all lines
	var lines []string
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		lines = append(lines, scanner.Text())
	}
	if err := scanner.Err(); err != nil {
		return nil, err
	}

	// Parse targets
	for _, line := range lines {
		// Capture ## comments for the next target
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "#") {
			if m := commentRe.FindStringSubmatch(line); m != nil {
				prevComment = strings.TrimSpace(m[1])
			}
			continue
		}

		// Skip blank lines (preserve comment for next target)
		if trimmed == "" {
			continue
		}

		// Skip variable assignments: FOO =, FOO :=, FOO ?=, FOO +=
		if varAssignRe.MatchString(line) {
			prevComment = ""
			continue
		}

		// Skip include/export/define directives
		if strings.HasPrefix(trimmed, "include ") || strings.HasPrefix(trimmed, "-include ") ||
			strings.HasPrefix(trimmed, "export ") || strings.HasPrefix(trimmed, "define ") ||
			strings.HasPrefix(trimmed, "ifdef ") || strings.HasPrefix(trimmed, "ifndef ") ||
			strings.HasPrefix(trimmed, "ifeq ") || strings.HasPrefix(trimmed, "ifneq ") ||
			strings.HasPrefix(trimmed, "else") || strings.HasPrefix(trimmed, "endif") {
			prevComment = ""
			continue
		}

		// Skip recipe lines (start with tab)
		if strings.HasPrefix(line, "\t") {
			prevComment = ""
			continue
		}

		m := targetRe.FindStringSubmatch(line)
		if m == nil {
			prevComment = ""
			continue
		}

		name := m[1]

		// Skip internal/special targets
		if strings.HasPrefix(name, ".") || strings.HasPrefix(name, "_") {
			prevComment = ""
			continue
		}

		if seen[name] {
			prevComment = ""
			continue
		}
		seen[name] = true

		// Check for inline ## comment
		desc := prevComment
		if cm := commentRe.FindStringSubmatch(line); cm != nil {
			desc = strings.TrimSpace(cm[1])
		}

		targets = append(targets, model.Target{
			Name:        name,
			Description: desc,
			Category:    classifyTarget(name),
		})
		prevComment = ""
	}

	// Use .PHONY as a hint to prioritize user-facing targets, but don't
	// exclude targets that aren't declared phony — many real targets
	// (e.g. test-data) simply lack the declaration.
	// Instead, filter out likely internal targets by naming convention.
	var filtered []model.Target
	for _, t := range targets {
		// Skip targets that look like intermediate build artifacts
		if isInternalTarget(t.Name) {
			continue
		}
		filtered = append(filtered, t)
	}
	if len(filtered) > 0 {
		targets = filtered
	}

	return targets, nil
}

func classifyTarget(name string) model.TargetCategory {
	n := strings.ToLower(name)
	switch {
	case containsAny(n, "run", "start", "stop", "dev", "watch", "debug"):
		return model.CategoryRun
	case containsAny(n, "test", "coverage", "e2e"):
		return model.CategoryTest
	case containsAny(n, "check", "lint", "style", "vet", "i18n"):
		return model.CategoryLint
	case containsAny(n, "build", "dist", "package", "bundle", "compile"):
		return model.CategoryBuild
	case containsAny(n, "clean", "nuke", "reset"):
		return model.CategoryClean
	case containsAny(n, "deploy", "upload", "install"):
		return model.CategoryDeploy
	default:
		return model.CategoryOther
	}
}

// isInternalTarget returns true for targets that are likely intermediate
// build artifacts rather than user-facing commands.
func isInternalTarget(name string) bool {
	// File-like targets (contain a path separator or common extensions)
	if strings.Contains(name, "/") {
		return true
	}
	for _, ext := range []string{".o", ".a", ".so", ".tar", ".gz", ".zip"} {
		if strings.HasSuffix(name, ext) {
			return true
		}
	}
	return false
}

func containsAny(s string, substrs ...string) bool {
	for _, sub := range substrs {
		if strings.Contains(s, sub) {
			return true
		}
	}
	return false
}
