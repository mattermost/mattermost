package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/mattermost/mattermost/tools/devdash/config"
	"github.com/mattermost/mattermost/tools/devdash/discovery"
	"github.com/mattermost/mattermost/tools/devdash/process"
	"github.com/mattermost/mattermost/tools/devdash/tui"
)

func main() {
	// Check tmux is available
	if _, err := exec.LookPath("tmux"); err != nil {
		fmt.Fprintln(os.Stderr, "error: tmux is required but not found in PATH")
		fmt.Fprintln(os.Stderr, "install with: make init-cli-tools")
		os.Exit(1)
	}

	// Find the mattermost repo root.
	mmRoot, err := findRepoRoot()
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	// Load config for saved depth setting
	cfg := config.Load(mmRoot)
	depth := cfg.Depth
	if depth <= 0 {
		depth = 1
	}

	// Discover repos
	repos, err := discovery.ScanAll(mmRoot, depth)
	if err != nil {
		fmt.Fprintf(os.Stderr, "scan error: %v\n", err)
		os.Exit(1)
	}

	if len(repos) == 0 {
		fmt.Fprintln(os.Stderr, "no repos discovered")
		os.Exit(1)
	}

	// Create tmux client and clean up stale sessions from previous crashes
	tmuxClient := process.NewTmuxClient("devdash")
	_ = tmuxClient.CleanStaleSessions()

	// Create process manager and launch TUI
	mgr := process.NewManager(tmuxClient)

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

