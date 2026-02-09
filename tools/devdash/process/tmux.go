package process

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
)

// TmuxClient wraps tmux CLI interactions using a dedicated socket for isolation.
type TmuxClient struct {
	Socket  string // socket name (e.g., "devdash")
	ExitDir string // directory for exit-code marker files
}

// NewTmuxClient creates a client that uses a dedicated tmux socket.
func NewTmuxClient(socket string) *TmuxClient {
	dir := filepath.Join(os.TempDir(), "devdash-"+socket)
	os.MkdirAll(dir, 0700)
	return &TmuxClient{Socket: socket, ExitDir: dir}
}

// SessionName converts a repo:target ID to a valid tmux session name.
// tmux forbids ":" and "." in session names, so we replace them.
func SessionName(repoName, targetName string) string {
	name := fmt.Sprintf("dd_%s_%s", repoName, targetName)
	name = strings.ReplaceAll(name, ":", "_")
	name = strings.ReplaceAll(name, ".", "_")
	return name
}

// exitFilePath returns the marker file path for a session's exit code.
func (t *TmuxClient) exitFilePath(name string) string {
	return filepath.Join(t.ExitDir, name+".exit")
}

// NewSession creates a new detached tmux session running the given command.
// The command is wrapped so the shell stays alive after the command exits,
// allowing background processes to keep logging to the terminal.
// The exit code is written to a marker file for detection.
func (t *TmuxClient) NewSession(name, cmd, dir string, rows, cols int) error {
	exitFile := t.exitFilePath(name)

	// Remove stale exit file from a previous run
	os.Remove(exitFile)

	// Wrap: run command, save exit code to marker file, then sleep forever.
	// The sleep keeps the pane alive so background processes spawned by the
	// command can continue writing to the terminal.
	wrappedCmd := fmt.Sprintf(
		`%s; _ec=$?; printf '\n[exited %%d]\n' "$_ec"; echo "$_ec" > %s; while true; do sleep 86400; done`,
		cmd, exitFile,
	)

	args := []string{
		"-L", t.Socket,
		"new-session",
		"-d",       // detached
		"-s", name, // session name
		"-x", fmt.Sprintf("%d", cols),
		"-y", fmt.Sprintf("%d", rows),
		"sh", "-c", wrappedCmd,
	}

	tmuxCmd := exec.Command("tmux", args...)
	tmuxCmd.Dir = dir

	var stderr bytes.Buffer
	tmuxCmd.Stderr = &stderr

	if err := tmuxCmd.Run(); err != nil {
		return fmt.Errorf("tmux new-session: %w: %s", err, stderr.String())
	}

	// Set scrollback buffer to 10k lines
	_ = t.run("set-option", "-t", name, "history-limit", "10000")

	return nil
}

// KillSession destroys a tmux session and cleans up its exit marker file.
func (t *TmuxClient) KillSession(name string) error {
	os.Remove(t.exitFilePath(name))
	return t.run("kill-session", "-t", name)
}

// HasSession checks if a tmux session exists.
func (t *TmuxClient) HasSession(name string) bool {
	err := t.run("has-session", "-t", name)
	return err == nil
}

// CommandExited checks if the main command has exited by looking for the
// exit-code marker file. The pane itself stays alive (sleep wrapper).
func (t *TmuxClient) CommandExited(name string) bool {
	_, err := os.Stat(t.exitFilePath(name))
	return err == nil
}

// CommandExitCode reads the exit code from the marker file.
// Returns -1 if the file doesn't exist or can't be read.
func (t *TmuxClient) CommandExitCode(name string) int {
	data, err := os.ReadFile(t.exitFilePath(name))
	if err != nil {
		return -1
	}
	code, err := strconv.Atoi(strings.TrimSpace(string(data)))
	if err != nil {
		return -1
	}
	return code
}

// CapturePaneVisible captures just the visible pane content (fast, no scrollback).
func (t *TmuxClient) CapturePaneVisible(name string) (string, error) {
	return t.output("capture-pane", "-t", name, "-p", "-e")
}

// CapturePaneHistory captures the full scrollback buffer (slower, for on-demand scroll).
func (t *TmuxClient) CapturePaneHistory(name string) (string, error) {
	return t.output("capture-pane", "-t", name, "-p", "-e", "-S", "-")
}

// SendKeys sends key sequences to a tmux session.
func (t *TmuxClient) SendKeys(name string, keys ...string) error {
	args := append([]string{"send-keys", "-t", name}, keys...)
	return t.run(args...)
}

// ResizeWindow resizes the tmux window (and its pane) to the given dimensions.
func (t *TmuxClient) ResizeWindow(name string, rows, cols int) error {
	return t.run("resize-window", "-t", name,
		"-x", fmt.Sprintf("%d", cols),
		"-y", fmt.Sprintf("%d", rows))
}

// CleanStaleSessions kills all dd_* sessions from a previous crash and
// removes any leftover exit marker files.
func (t *TmuxClient) CleanStaleSessions() error {
	out, err := t.output("list-sessions", "-F", "#{session_name}")
	if err == nil {
		for _, name := range strings.Split(strings.TrimSpace(out), "\n") {
			if strings.HasPrefix(name, "dd_") {
				_ = t.KillSession(name)
			}
		}
	}

	// Clean up any orphaned exit files
	entries, _ := os.ReadDir(t.ExitDir)
	for _, e := range entries {
		if strings.HasSuffix(e.Name(), ".exit") {
			os.Remove(filepath.Join(t.ExitDir, e.Name()))
		}
	}
	return nil
}

// KillAllSessions kills all dd_* sessions (used on quit).
func (t *TmuxClient) KillAllSessions() error {
	return t.CleanStaleSessions()
}

// run executes a tmux command with the dedicated socket.
func (t *TmuxClient) run(args ...string) error {
	fullArgs := append([]string{"-L", t.Socket}, args...)
	cmd := exec.Command("tmux", fullArgs...)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("tmux %s: %w: %s", args[0], err, stderr.String())
	}
	return nil
}

// output executes a tmux command and returns its stdout.
func (t *TmuxClient) output(args ...string) (string, error) {
	fullArgs := append([]string{"-L", t.Socket}, args...)
	cmd := exec.Command("tmux", fullArgs...)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("tmux %s: %w: %s", args[0], err, stderr.String())
	}
	return stdout.String(), nil
}
