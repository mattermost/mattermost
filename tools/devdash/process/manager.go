package process

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"syscall"
	"time"

	tea "github.com/charmbracelet/bubbletea"

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
	// Create a new process group so we can signal all children
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}

	// Don't let context cancellation auto-kill; we handle signals ourselves
	cmd.Cancel = func() error { return nil }

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		cancel()
		m.mu.Unlock()
		return err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		cancel()
		m.mu.Unlock()
		return err
	}

	if err := cmd.Start(); err != nil {
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
		cancel:    cancel,
		done:      make(chan struct{}),
	}
	m.processes[id] = proc
	program := m.program
	m.mu.Unlock()

	// Stream output in background
	var wg sync.WaitGroup
	streamPipe := func(r io.Reader) {
		defer wg.Done()
		s := bufio.NewScanner(r)
		s.Buffer(make([]byte, 0, 64*1024), 1024*1024)
		for s.Scan() {
			line := s.Text()
			logBuf.Append(line)
			if program != nil {
				program.Send(OutputMsg{ProcessID: id, Line: line})
			}
		}
	}

	wg.Add(2)
	go streamPipe(stdout)
	go streamPipe(stderr)

	go func() {
		wg.Wait()

		exitCode := 0
		if err := cmd.Wait(); err != nil {
			if exitErr, ok := err.(*exec.ExitError); ok {
				exitCode = exitErr.ExitCode()
			} else {
				exitCode = -1
			}
		}

		m.mu.Lock()
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

// signalProcessGroup sends a signal to the entire process group.
func signalProcessGroup(cmd *exec.Cmd, sig syscall.Signal) error {
	if cmd.Process == nil {
		return nil
	}
	pgid, err := syscall.Getpgid(cmd.Process.Pid)
	if err != nil {
		// Fallback: signal just the process
		return cmd.Process.Signal(sig)
	}
	// Negative PID signals the entire process group
	return syscall.Kill(-pgid, sig)
}

func (m *Manager) Stop(id string) error {
	m.mu.RLock()
	proc, ok := m.processes[id]
	m.mu.RUnlock()

	if !ok || proc.Info.State != model.ProcessRunning {
		return nil
	}

	// SIGTERM the entire process group
	_ = signalProcessGroup(proc.cmd, syscall.SIGTERM)

	// Wait for graceful exit
	select {
	case <-proc.done:
		return nil
	case <-time.After(5 * time.Second):
	}

	// SIGKILL the entire process group
	_ = signalProcessGroup(proc.cmd, syscall.SIGKILL)

	// Cancel the context to clean up
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

// ProcessIDs returns all process IDs that have been started (in insertion-ish order).
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

// Suppress unused import warning
var _ = os.Interrupt
