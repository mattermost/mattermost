package main

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/mattermost/mattermost/tools/devdash/discovery"
	"github.com/mattermost/mattermost/tools/devdash/process"
	"github.com/mattermost/mattermost/tools/devdash/tui"
)

func main() {
	// Find the mattermost repo root.
	// We expect to be run from the root, or we detect it.
	mmRoot, err := findRepoRoot()
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	// Discover repos
	repos, err := discovery.ScanAll(mmRoot)
	if err != nil {
		fmt.Fprintf(os.Stderr, "scan error: %v\n", err)
		os.Exit(1)
	}

	if len(repos) == 0 {
		fmt.Fprintln(os.Stderr, "no repos discovered")
		os.Exit(1)
	}

	// Create process manager and launch TUI
	mgr := process.NewManager(10000)

	if err := tui.Run(repos, mgr, mmRoot); err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
}

func findRepoRoot() (string, error) {
	// Try CWD first
	cwd, err := os.Getwd()
	if err != nil {
		return "", err
	}

	// Check if CWD is the mattermost root (has server/ and webapp/)
	if isMMRoot(cwd) {
		return cwd, nil
	}

	// Check if we're inside a subdirectory of the mattermost root
	dir := cwd
	for {
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		if isMMRoot(parent) {
			return parent, nil
		}
		dir = parent
	}

	return "", fmt.Errorf("could not find mattermost repo root from %s", cwd)
}

func isMMRoot(dir string) bool {
	// The mattermost root has both server/ and webapp/ directories
	_, errS := os.Stat(filepath.Join(dir, "server"))
	_, errW := os.Stat(filepath.Join(dir, "webapp"))
	return errS == nil && errW == nil
}
