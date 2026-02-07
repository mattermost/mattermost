package process

import (
	"fmt"
	"path/filepath"
	"sync"
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
	Info        model.Process
	SessionName string // tmux session name
	cancel      func()
	done        chan struct{}
}

type Manager struct {
	mu        sync.RWMutex
	processes map[string]*ManagedProcess
	order     []string // insertion-order process IDs
	program   *tea.Program
	tmux      *TmuxClient
}

func NewManager(tmux *TmuxClient) *Manager {
	return &Manager{
		processes: make(map[string]*ManagedProcess),
		tmux:      tmux,
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

// StartCustom starts a process with a user-provided command string.
func (m *Manager) StartCustom(repo *model.Repo, targetName string, isNpm bool, cmdStr string) error {
	id := repo.Name + ":" + targetName
	m.mu.Lock()

	if existing, ok := m.processes[id]; ok && existing.Info.State == model.ProcessRunning {
		m.mu.Unlock()
		return fmt.Errorf("%s is already running", id)
	}

	dir := repo.Path
	if isNpm {
		dir = filepath.Dir(repo.PackageJSON)
	}

	return m.startProcess(id, repo.Name, targetName, cmdStr, dir)
}

func (m *Manager) Start(repo *model.Repo, targetName string, isNpm bool) error {
	id := repo.Name + ":" + targetName
	m.mu.Lock()

	if existing, ok := m.processes[id]; ok && existing.Info.State == model.ProcessRunning {
		m.mu.Unlock()
		return fmt.Errorf("%s is already running", id)
	}

	var cmdStr string
	var dir string
	if isNpm {
		cmdStr = fmt.Sprintf("npm run %s", targetName)
		dir = filepath.Dir(repo.PackageJSON)
	} else {
		cmdStr = fmt.Sprintf("make -C %s %s", repo.Path, targetName)
		dir = repo.Path
	}

	return m.startProcess(id, repo.Name, targetName, cmdStr, dir)
}

// startProcess is the shared implementation for Start and StartCustom.
// Caller must hold m.mu.Lock.
func (m *Manager) startProcess(id, repoName, targetName, cmdStr, dir string) error {
	sessionName := SessionName(repoName, targetName)

	// Kill any stale session with the same name
	if m.tmux.HasSession(sessionName) {
		_ = m.tmux.KillSession(sessionName)
	}

	err := m.tmux.NewSession(sessionName, cmdStr, dir, 40, 120)
	if err != nil {
		m.mu.Unlock()
		return err
	}

	done := make(chan struct{})
	stopped := make(chan struct{})
	var stopOnce sync.Once
	proc := &ManagedProcess{
		Info: model.Process{
			ID:        id,
			Repo:      repoName,
			Target:    targetName,
			Command:   cmdStr,
			State:     model.ProcessRunning,
			StartedAt: time.Now(),
		},
		SessionName: sessionName,
		cancel:      func() { stopOnce.Do(func() { close(stopped) }) },
		done:        done,
	}
	m.processes[id] = proc
	// Track insertion order — only append if this is a new ID
	found := false
	for _, oid := range m.order {
		if oid == id {
			found = true
			break
		}
	}
	if !found {
		m.order = append(m.order, id)
	}
	program := m.program
	m.mu.Unlock()

	// Poll to detect when the main command exits.
	// The tmux pane stays alive (sleep wrapper) so background processes keep logging.
	go func() {
		ticker := time.NewTicker(500 * time.Millisecond)
		defer ticker.Stop()

		for {
			select {
			case <-stopped:
				return
			case <-ticker.C:
				if !m.tmux.HasSession(sessionName) {
					// Session was killed externally
					m.mu.Lock()
					proc.Info.State = model.ProcessFailed
					proc.Info.ExitCode = -1
					m.mu.Unlock()
					close(done)
					if program != nil {
						program.Send(ExitMsg{ProcessID: id, ExitCode: -1})
					}
					return
				}
				if m.tmux.CommandExited(sessionName) {
					// Main command exited; pane stays alive for background output
					exitCode := m.tmux.CommandExitCode(sessionName)
					m.mu.Lock()
					if exitCode == 0 {
						proc.Info.State = model.ProcessExited
					} else {
						proc.Info.State = model.ProcessFailed
					}
					proc.Info.ExitCode = exitCode
					m.mu.Unlock()
					close(done)
					if program != nil {
						program.Send(ExitMsg{ProcessID: id, ExitCode: exitCode})
					}
					return
				}
			}
		}
	}()

	return nil
}

// WriteInput sends key sequences to a running process via tmux send-keys.
func (m *Manager) WriteInput(id string, keys ...string) error {
	m.mu.RLock()
	proc, ok := m.processes[id]
	m.mu.RUnlock()

	if !ok {
		return fmt.Errorf("process %s not found", id)
	}

	return m.tmux.SendKeys(proc.SessionName, keys...)
}

// ResizeTmux updates the tmux window size for a process.
func (m *Manager) ResizeTmux(id string, rows, cols int) {
	m.mu.RLock()
	proc, ok := m.processes[id]
	m.mu.RUnlock()

	if !ok {
		return
	}
	_ = m.tmux.ResizeWindow(proc.SessionName, rows, cols)
}

// CapturePaneContent returns the visible terminal content of a process's tmux pane.
func (m *Manager) CapturePaneContent(id string) (string, error) {
	m.mu.RLock()
	proc, ok := m.processes[id]
	m.mu.RUnlock()

	if !ok {
		return "", fmt.Errorf("process %s not found", id)
	}

	return m.tmux.CapturePaneANSI(proc.SessionName)
}

func (m *Manager) Stop(id string) error {
	m.mu.RLock()
	proc, ok := m.processes[id]
	m.mu.RUnlock()

	if !ok {
		return nil
	}

	if proc.Info.State == model.ProcessRunning {
		// Send Ctrl-C to the main command
		_ = m.tmux.SendKeys(proc.SessionName, "C-c")

		select {
		case <-proc.done:
		case <-time.After(5 * time.Second):
		}
	}

	// Always kill the session to clean up the sleep wrapper
	_ = m.tmux.KillSession(proc.SessionName)
	proc.cancel()

	// Wait for poll goroutine to finish
	select {
	case <-proc.done:
	default:
		// If done was already closed, that's fine
	}

	return nil
}

// Remove stops a process (if running) and removes it from the manager entirely.
func (m *Manager) Remove(id string) {
	m.mu.RLock()
	proc, ok := m.processes[id]
	m.mu.RUnlock()

	if ok {
		// Kill the tmux session directly
		_ = m.tmux.KillSession(proc.SessionName)
		proc.cancel()
	}

	m.mu.Lock()
	delete(m.processes, id)
	for i, oid := range m.order {
		if oid == id {
			m.order = append(m.order[:i], m.order[i+1:]...)
			break
		}
	}
	m.mu.Unlock()
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

	// Kill any remaining sessions
	m.tmux.KillAllSessions()
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

// ProcessIDs returns all process IDs in the order they were started.
func (m *Manager) ProcessIDs() []string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	ids := make([]string, len(m.order))
	copy(ids, m.order)
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
