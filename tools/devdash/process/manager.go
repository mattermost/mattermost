package process

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/creack/pty"

	"github.com/mattermost/mattermost/tools/devdash/model"
)

// Messages sent back to the TUI
type OutputMsg struct {
	ProcessID string
	Line      string
}

type ExitMsg struct {
	ProcessID string
	ExitCode  int
}

type ManagedProcess struct {
	Info      model.Process
	LogBuffer *LogBuffer
	cmd       *exec.Cmd
	ptmx      *os.File // PTY master — nil if process has exited and PTY was closed
	cancel    context.CancelFunc
	done      chan struct{}
}

type Manager struct {
	mu        sync.RWMutex
	processes map[string]*ManagedProcess
	program   *tea.Program
	maxLog    int
}

func NewManager(maxLogLines int) *Manager {
	if maxLogLines <= 0 {
		maxLogLines = 10000
	}
	return &Manager{
		processes: make(map[string]*ManagedProcess),
		maxLog:    maxLogLines,
	}
}

func (m *Manager) SetProgram(p *tea.Program) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.program = p
}

// CommandFor returns the command string that would be executed for a target.
func CommandFor(repo *model.Repo, targetName string, isNpm bool) string {
	if isNpm {
		return fmt.Sprintf("npm run %s", targetName)
	}
	return fmt.Sprintf("make -C %s %s", repo.Path, targetName)
}

// StartCustom starts a process with a user-provided command string, run via sh -c.
func (m *Manager) StartCustom(repo *model.Repo, targetName string, isNpm bool, cmdStr string) error {
	id := repo.Name + ":" + targetName
	m.mu.Lock()

	if existing, ok := m.processes[id]; ok && existing.Info.State == model.ProcessRunning {
		m.mu.Unlock()
		return fmt.Errorf("%s is already running", id)
	}

	ctx, cancel := context.WithCancel(context.Background())

	cmd := exec.CommandContext(ctx, "sh", "-c", cmdStr)
	if isNpm {
		cmd.Dir = filepath.Dir(repo.PackageJSON)
	} else {
		cmd.Dir = repo.Path
	}

	return m.startProcess(id, repo.Name, targetName, cmdStr, cmd, cancel)
}

func (m *Manager) Start(repo *model.Repo, targetName string, isNpm bool) error {
	id := repo.Name + ":" + targetName
	m.mu.Lock()

	if existing, ok := m.processes[id]; ok && existing.Info.State == model.ProcessRunning {
		m.mu.Unlock()
		return fmt.Errorf("%s is already running", id)
	}

	ctx, cancel := context.WithCancel(context.Background())

	var cmd *exec.Cmd
	var cmdStr string
	if isNpm {
		cmd = exec.CommandContext(ctx, "npm", "run", targetName)
		cmd.Dir = filepath.Dir(repo.PackageJSON)
		cmdStr = fmt.Sprintf("npm run %s", targetName)
	} else {
		cmd = exec.CommandContext(ctx, "make", "-C", repo.Path, targetName)
		cmdStr = fmt.Sprintf("make -C %s %s", repo.Path, targetName)
	}

	return m.startProcess(id, repo.Name, targetName, cmdStr, cmd, cancel)
}

// startProcess is the shared implementation for Start and StartCustom.
// Caller must hold m.mu.Lock and have verified no duplicate running process.
func (m *Manager) startProcess(id, repoName, targetName, cmdStr string, cmd *exec.Cmd, cancel context.CancelFunc) error {
	// Don't let context cancellation auto-kill; we handle signals ourselves
	cmd.Cancel = func() error { return nil }

	// Start with a PTY for full terminal support (colors, prompts, etc.)
	ptmx, err := pty.StartWithSize(cmd, &pty.Winsize{Rows: 40, Cols: 120})
	if err != nil {
		cancel()
		m.mu.Unlock()
		return err
	}

	logBuf := NewLogBuffer(m.maxLog)
	proc := &ManagedProcess{
		Info: model.Process{
			ID:        id,
			Repo:      repoName,
			Target:    targetName,
			Command:   cmdStr,
			State:     model.ProcessRunning,
			StartedAt: time.Now(),
		},
		LogBuffer: logBuf,
		cmd:       cmd,
		ptmx:      ptmx,
		cancel:    cancel,
		done:      make(chan struct{}),
	}
	m.processes[id] = proc
	program := m.program
	m.mu.Unlock()

	// Read PTY output in background.
	// Sanitizes terminal control sequences and handles \r for progress bars.
	go func() {
		buf := make([]byte, 8192)
		var partial string
		for {
			n, readErr := ptmx.Read(buf)
			if n > 0 {
				raw := partial + string(buf[:n])
				partial = ""

				// Strip non-color ANSI sequences (cursor movement, clearing, etc.)
				raw = sanitizePTY(raw)

				// Split into lines, keeping the last partial
				lines := strings.Split(raw, "\n")
				for i, line := range lines {
					if i == len(lines)-1 {
						if line != "" {
							partial = line
						}
						continue
					}
					// Handle \r: text after the last \r overwrites the line
					line = handleCR(line)
					logBuf.Append(line)
					if program != nil {
						program.Send(OutputMsg{ProcessID: id, Line: line})
					}
				}
			}
			if readErr != nil {
				// Flush remaining partial line
				if partial != "" {
					partial = handleCR(partial)
					logBuf.Append(partial)
					if program != nil {
						program.Send(OutputMsg{ProcessID: id, Line: partial})
					}
				}
				break
			}
		}

		exitCode := 0
		if err := cmd.Wait(); err != nil {
			if exitErr, ok := err.(*exec.ExitError); ok {
				exitCode = exitErr.ExitCode()
			} else {
				exitCode = -1
			}
		}

		ptmx.Close()

		m.mu.Lock()
		proc.ptmx = nil
		if exitCode == 0 {
			proc.Info.State = model.ProcessExited
		} else {
			proc.Info.State = model.ProcessFailed
		}
		proc.Info.ExitCode = exitCode
		m.mu.Unlock()

		close(proc.done)
		if program != nil {
			program.Send(ExitMsg{ProcessID: id, ExitCode: exitCode})
		}
	}()

	return nil
}

// WriteInput sends input to a running process's PTY (stdin).
func (m *Manager) WriteInput(id, input string) error {
	m.mu.RLock()
	proc, ok := m.processes[id]
	m.mu.RUnlock()

	if !ok || proc.Info.State != model.ProcessRunning || proc.ptmx == nil {
		return fmt.Errorf("process %s not running", id)
	}

	_, err := proc.ptmx.WriteString(input)
	return err
}

// ResizePTY updates the PTY window size for a running process.
func (m *Manager) ResizePTY(id string, rows, cols uint16) {
	m.mu.RLock()
	proc, ok := m.processes[id]
	m.mu.RUnlock()

	if !ok || proc.ptmx == nil {
		return
	}
	_ = pty.Setsize(proc.ptmx, &pty.Winsize{Rows: rows, Cols: cols})
}

// signalProcess sends a signal to the process and its children.
// With PTY, the child runs in its own session (via Setsid from pty.Start),
// so we signal via the process group.
func signalProcess(cmd *exec.Cmd, sig syscall.Signal) error {
	if cmd.Process == nil {
		return nil
	}
	pgid, err := syscall.Getpgid(cmd.Process.Pid)
	if err != nil {
		return cmd.Process.Signal(sig)
	}
	return syscall.Kill(-pgid, sig)
}

func (m *Manager) Stop(id string) error {
	m.mu.RLock()
	proc, ok := m.processes[id]
	m.mu.RUnlock()

	if !ok || proc.Info.State != model.ProcessRunning {
		return nil
	}

	_ = signalProcess(proc.cmd, syscall.SIGTERM)

	select {
	case <-proc.done:
		return nil
	case <-time.After(5 * time.Second):
	}

	_ = signalProcess(proc.cmd, syscall.SIGKILL)
	proc.cancel()

	select {
	case <-proc.done:
	case <-time.After(2 * time.Second):
	}

	return nil
}

func (m *Manager) StopAll() {
	m.mu.RLock()
	ids := make([]string, 0, len(m.processes))
	for id, p := range m.processes {
		if p.Info.State == model.ProcessRunning {
			ids = append(ids, id)
		}
	}
	m.mu.RUnlock()

	for _, id := range ids {
		m.Stop(id)
	}
}

func (m *Manager) Get(id string) (*ManagedProcess, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	p, ok := m.processes[id]
	return p, ok
}

func (m *Manager) RunningCount() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	count := 0
	for _, p := range m.processes {
		if p.Info.State == model.ProcessRunning {
			count++
		}
	}
	return count
}

func (m *Manager) FailedCount() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	count := 0
	for _, p := range m.processes {
		if p.Info.State == model.ProcessFailed {
			count++
		}
	}
	return count
}

// ProcessIDs returns all process IDs that have been started.
func (m *Manager) ProcessIDs() []string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	ids := make([]string, 0, len(m.processes))
	for id := range m.processes {
		ids = append(ids, id)
	}
	return ids
}

func (m *Manager) ProcessState(id string) model.ProcessState {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if p, ok := m.processes[id]; ok {
		return p.Info.State
	}
	return model.ProcessIdle
}
