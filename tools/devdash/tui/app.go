package tui

import (
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"

	"github.com/mattermost/mattermost/tools/devdash/config"
	"github.com/mattermost/mattermost/tools/devdash/model"
	"github.com/mattermost/mattermost/tools/devdash/process"
)

type FocusArea int

const (
	FocusGrid FocusArea = iota
	FocusTabBar
	FocusLog
)

type App struct {
	repos   []model.Repo
	procMgr *process.Manager
	keys    KeyMap

	// Grid state
	cursorRow   int
	cursorCol   int
	gridCells   [][]GridCell // cached per-repo cells
	hScrolls    []int        // per-row horizontal scroll offset (in chars)
	gridVScroll int          // vertical scroll: index into visibleRepoIndices to start rendering from

	// Log panel
	logPanel    LogPanel
	logVisible  bool
	focusedProc string // process ID shown in log

	// UI state
	focus    FocusArea
	showHelp bool
	width         int
	height        int

	// Favorites: set of "repo:target" strings
	favorites map[string]bool

	// Target search
	gridSearching   bool
	gridSearchInput textinput.Model
	gridSearchQuery string // live filter applied to grid cells

	// Favorites-only view
	showOnlyFavorites bool

	// Command editing (dry-run mode)
	cmdEditing    bool
	cmdInput      textinput.Model
	cmdEditRepo   *model.Repo
	cmdEditTarget string
	cmdEditIsNpm  bool

	// Mouse hit zones (rebuilt each render)
	hitZones    []HitZone
	tabHitZones []TabHitZone
	tabBarY     int // screen Y of the tab bar line
	tabHScroll  int // horizontal scroll offset for tab bar

	// Double-click tracking
	lastClickRow  int
	lastClickCol  int
	lastClickTime time.Time

	// Double-tap Esc tracking for exiting input mode
	lastEscTime time.Time

	// Paths
	repoRoot string

}

func NewApp(repos []model.Repo, mgr *process.Manager, repoRoot string) *App {
	// Pre-build grid cells
	cells := make([][]GridCell, len(repos))
	for i := range repos {
		cells[i] = buildGridCells(&repos[i])
	}

	si := textinput.New()
	si.Placeholder = ""
	si.CharLimit = 64
	si.Prompt = ""
	si.Focus()

	cfg := config.Load(repoRoot)

	return &App{
		repos:           repos,
		procMgr:         mgr,
		keys:            DefaultKeyMap(),
		gridCells:       cells,
		hScrolls:        make([]int, len(repos)),
		repoRoot:        repoRoot,
		favorites:        cfg.FavoritesMap(),
		showOnlyFavorites: cfg.FavsOnly,
		gridSearchInput:  si,
		gridSearching:    false,
		logPanel:         NewLogPanel(),
	}
}

const pollInterval = 200 * time.Millisecond

func (a *App) Init() tea.Cmd {
	return tea.Batch(
		a.gridSearchInput.Cursor.BlinkCmd(),
		tea.Tick(pollInterval, func(t time.Time) tea.Msg {
			return TickMsg(t)
		}),
	)
}

func (a *App) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {

	case tea.WindowSizeMsg:
		a.width = msg.Width
		a.height = msg.Height
		if a.logVisible {
			lpH := a.logPanelHeight()
			a.logPanel.SetSize(msg.Width, lpH)
			// Resize tmux pane to match log panel viewport
			if a.focusedProc != "" {
				a.procMgr.ResizeTmux(a.focusedProc, lpH, msg.Width)
			}
		}
		return a, nil

	case TickMsg:
		// Poll tmux capture-pane for the focused process
		if a.logVisible && a.focusedProc != "" {
			if a.logPanel.autoScroll {
				// Fast path: only capture visible pane
				content, err := a.procMgr.CapturePaneVisible(a.focusedProc)
				if err == nil {
					a.logPanel.UpdateContent(content)
					a.logPanel.historyDirty = true
				} else {
					// Clear cache so next tick retries instead of silently stalling
					a.logPanel.lastContent = ""
					a.logPanel.lastRaw = ""
				}
			}
			// When scroll-locked, don't poll — user is reading cached history
		}
		return a, tea.Tick(pollInterval, func(t time.Time) tea.Msg {
			return TickMsg(t)
		})

	case ProcessExitMsg:
		// Process exited — stay in log panel so output remains visible.
		return a, nil

	case tea.MouseMsg:
		return a.handleMouse(msg)

	case tea.KeyMsg:
		return a.handleKey(msg)
	}

	return a, nil
}

func (a *App) handleKey(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	// Ctrl+F toggles favorites-only view from anywhere
	if key.Matches(msg, a.keys.FavsOnly) {
		a.showOnlyFavorites = !a.showOnlyFavorites
		a.saveConfig()
		a.snapCursorToFirstMatch()
		return a, nil
	}

	// Help overlay intercepts everything
	if a.showHelp {
		if msg.String() == "esc" || msg.String() == "?" || msg.String() == "q" {
			a.showHelp = false
		}
		return a, nil
	}

	// Command editing mode — editable command before execution
	if a.cmdEditing {
		switch msg.String() {
		case "esc":
			a.cmdEditing = false
			a.logVisible = false
			a.focus = FocusGrid
			return a, nil
		case "enter":
			cmdStr := a.cmdInput.Value()
			a.cmdEditing = false
			if cmdStr != "" {
				a.procMgr.StartCustom(a.cmdEditRepo, a.cmdEditTarget, a.cmdEditIsNpm, cmdStr)
				id := a.cmdEditRepo.Name + ":" + a.cmdEditTarget
				a.focusedProc = id
				a.logPanel.SetProcess(id)
				a.focus = FocusLog
			}
			return a, nil
		default:
			var cmd tea.Cmd
			a.cmdInput, cmd = a.cmdInput.Update(msg)
			return a, cmd
		}
	}

	// If searching targets in grid
	if a.gridSearching {
		switch msg.String() {
		case "esc":
			a.gridSearching = false
			a.gridSearchQuery = ""
			a.gridSearchInput.Reset()
			a.gridSearchInput.Blur()
			return a, nil
		case "enter", "down":
			// Move focus to the filtered grid
			a.gridSearching = false
			a.gridSearchInput.Blur()
			a.snapCursorToFirstMatch()
			return a, nil
		default:
			var cmd tea.Cmd
			a.gridSearchInput, cmd = a.gridSearchInput.Update(msg)
			a.gridSearchQuery = a.gridSearchInput.Value()
			a.snapCursorToFirstMatch()
			return a, cmd
		}
	}

	// Raw input mode — forward keystrokes to process via tmux send-keys
	if a.focus == FocusLog && a.logPanel.inputting {
		// Ctrl+] — immediate exit from input mode
		if msg.String() == "ctrl+]" {
			a.logPanel.inputting = false
			return a, nil
		}
		if msg.String() == "esc" {
			now := time.Now()
			if now.Sub(a.lastEscTime) < doubleClickThreshold {
				// Double-tap Esc — exit input mode
				a.logPanel.inputting = false
				a.lastEscTime = time.Time{}
				return a, nil
			}
			// First Esc — forward to process and record time
			a.lastEscTime = now
			a.procMgr.WriteInput(a.focusedProc, "Escape")
			return a, nil
		}
		a.lastEscTime = time.Time{} // reset on any other key
		if args := keyToTmuxArgs(msg); args != nil {
			a.procMgr.WriteInput(a.focusedProc, args...)
		}
		return a, nil
	}

	switch {
	case key.Matches(msg, a.keys.Quit):
		a.procMgr.StopAll()
		return a, tea.Quit

	case key.Matches(msg, a.keys.Help):
		a.showHelp = !a.showHelp
		return a, nil

	case key.Matches(msg, a.keys.Escape):
		if a.gridSearchQuery != "" {
			// Clear active search filter
			a.gridSearchQuery = ""
			a.gridSearchInput.Reset()
			a.cursorCol = 0
			return a, nil
		}
		if a.focus == FocusTabBar {
			a.focus = FocusGrid
		} else if a.logVisible && a.focus == FocusLog {
			a.focus = FocusTabBar
		} else if a.logVisible {
			a.logVisible = false
			a.focus = FocusGrid
		} else if a.focus == FocusGrid {
			// Already on grid — snap to top-left
			a.snapCursorToFirstMatch()
		}
		return a, nil

	case key.Matches(msg, a.keys.TabNext):
		a.cycleLog(1)
		return a, nil

	case key.Matches(msg, a.keys.TabPrev):
		a.cycleLog(-1)
		return a, nil

	case key.Matches(msg, a.keys.ToggleLog):
		a.logVisible = !a.logVisible
		if a.logVisible {
			a.logPanel.SetSize(a.width, a.logPanelHeight())
			a.focus = FocusLog
			// Open log for current cursor's process if running
			a.openLogForCursor()
		} else {
			a.focus = FocusGrid
		}
		return a, nil

	case key.Matches(msg, a.keys.StopAll):
		a.procMgr.StopAll()
		return a, nil

	case key.Matches(msg, a.keys.Stop):
		if a.focusedProc != "" {
			a.procMgr.Stop(a.focusedProc)
		}
		return a, nil

	case key.Matches(msg, a.keys.Restart):
		a.runOrRestart()
		return a, nil

	case key.Matches(msg, a.keys.Search):
		// Grid target search — preserve existing filter text
		a.enterGridSearch()
		return a, a.gridSearchInput.Cursor.BlinkCmd()
	}

	// Dismiss: stop process, remove from manager, close log panel
	if key.Matches(msg, a.keys.Dismiss) {
		a.dismissProcess()
		return a, nil
	}

	// Number keys 1-9 switch log tabs (works from anywhere when processes exist)
	if k := msg.String(); len(k) == 1 && k[0] >= '1' && k[0] <= '9' {
		idx := int(k[0] - '1')
		if idx < len(a.orderedProcessIDs()) {
			a.switchLogTab(idx)
			return a, nil
		}
	}

	// Tab bar navigation
	if a.focus == FocusTabBar {
		ids := a.orderedProcessIDs()
		if len(ids) == 0 {
			a.focus = FocusGrid
			return a, nil
		}
		switch {
		case key.Matches(msg, a.keys.Up):
			// Back to grid (last visible row)
			a.focus = FocusGrid
			a.snapCursorToLastVisible()
			return a, nil
		case key.Matches(msg, a.keys.Left):
			idx := a.focusedTabIndex()
			if idx > 0 {
				idx--
			} else {
				idx = len(ids) - 1
			}
			a.focusedProc = ids[idx]
			a.logPanel.SetProcess(a.focusedProc)
			a.logVisible = true
			a.logPanel.SetSize(a.width, a.logPanelHeight())
			return a, nil
		case key.Matches(msg, a.keys.Right):
			idx := a.focusedTabIndex()
			if idx < len(ids)-1 {
				idx++
			} else {
				idx = 0
			}
			a.focusedProc = ids[idx]
			a.logPanel.SetProcess(a.focusedProc)
			a.logVisible = true
			a.logPanel.SetSize(a.width, a.logPanelHeight())
			return a, nil
		case key.Matches(msg, a.keys.Execute), key.Matches(msg, a.keys.FocusProc):
			// Enter log focus for the selected tab
			if a.focusedProc != "" {
				a.focus = FocusLog
			}
			return a, nil
		case key.Matches(msg, a.keys.Escape):
			a.focus = FocusGrid
			return a, nil
		}
		return a, nil
	}

	// Log search input mode
	if a.focus == FocusLog && a.logPanel.logSearching {
		switch msg.String() {
		case "esc":
			a.logPanel.logSearching = false
			a.logPanel.logSearchQuery = ""
			a.logPanel.logSearchInput.Blur()
			a.logPanel.SetSearchQuery("")
			return a, nil
		case "enter":
			// Close search bar but keep filter active
			a.logPanel.logSearching = false
			a.logPanel.logSearchInput.Blur()
			return a, nil
		default:
			var cmd tea.Cmd
			a.logPanel.logSearchInput, cmd = a.logPanel.logSearchInput.Update(msg)
			a.logPanel.SetSearchQuery(a.logPanel.logSearchInput.Value())
			return a, cmd
		}
	}

	// Log viewport scrolling and input mode when focused
	if a.focus == FocusLog && a.logVisible {
		// Enter input mode with i, Enter, or Space
		if key.Matches(msg, a.keys.ProcInput) || key.Matches(msg, a.keys.Execute) || key.Matches(msg, a.keys.FocusProc) {
			if a.focusedProc != "" {
				a.logPanel.inputting = true
			}
			return a, nil
		}
		switch {
		case msg.String() == "/":
			// Activate log search
			a.loadHistoryIfNeeded()
			a.logPanel.InitSearchInput()
			return a, a.logPanel.logSearchInput.Cursor.BlinkCmd()
		case msg.String() == "l":
			// Cycle log level filter
			a.loadHistoryIfNeeded()
			a.logPanel.CycleLogLevel()
			return a, nil
		case key.Matches(msg, a.keys.Up):
			a.loadHistoryIfNeeded()
			a.logPanel.viewport.LineUp(1)
			a.logPanel.autoScroll = false
			return a, nil
		case key.Matches(msg, a.keys.Down):
			a.logPanel.viewport.LineDown(1)
			return a, nil
		case key.Matches(msg, a.keys.Left):
			a.cycleLog(-1)
			return a, nil
		case key.Matches(msg, a.keys.Right):
			a.cycleLog(1)
			return a, nil
		case msg.String() == "G":
			// Return to auto-scroll: switch back to fast visible-only capture
			a.logPanel.autoScroll = true
			a.logPanel.lastContent = ""
			a.logPanel.lastRaw = "" // force refresh on next tick
			return a, nil
		case msg.String() == "g":
			a.loadHistoryIfNeeded()
			a.logPanel.viewport.GotoTop()
			a.logPanel.autoScroll = false
			return a, nil
		case key.Matches(msg, a.keys.PageUp):
			a.loadHistoryIfNeeded()
			a.logPanel.viewport.HalfViewUp()
			a.logPanel.autoScroll = false
			return a, nil
		case key.Matches(msg, a.keys.PageDown):
			a.logPanel.viewport.HalfViewDown()
			return a, nil
		}
		var cmd tea.Cmd
		a.logPanel.viewport, cmd = a.logPanel.viewport.Update(msg)
		return a, cmd
	}

	// Grid navigation
	switch {
	case key.Matches(msg, a.keys.PageUp):
		pageSize := a.maxGridLines() / 2
		if pageSize < 1 {
			pageSize = 1
		}
		for i := 0; i < pageSize; i++ {
			a.moveCursorUp()
		}
	case key.Matches(msg, a.keys.PageDown):
		pageSize := a.maxGridLines() / 2
		if pageSize < 1 {
			pageSize = 1
		}
		for i := 0; i < pageSize; i++ {
			a.moveCursorDown()
		}
	case key.Matches(msg, a.keys.Up):
		a.moveCursorUp()
	case key.Matches(msg, a.keys.Down):
		a.moveCursorDown()
	case key.Matches(msg, a.keys.Left):
		a.moveCursorLeft()
	case key.Matches(msg, a.keys.Right):
		a.moveCursorRight()

	case key.Matches(msg, a.keys.Favorite):
		a.toggleFavorite()

	case key.Matches(msg, a.keys.FocusProc):
		a.focusLogForCursor()

	case key.Matches(msg, a.keys.DryRun):
		a.dryRunAtCursor()

	case key.Matches(msg, a.keys.ProcInput):
		a.executeWithInputMode()

	case key.Matches(msg, a.keys.Execute):
		a.executeAtCursor()

	}

	return a, nil
}

const doubleClickThreshold = 400 * time.Millisecond

func (a *App) handleMouse(msg tea.MouseMsg) (tea.Model, tea.Cmd) {
	if a.logPanel.inputting {
		return a, nil
	}
	if msg.Action != tea.MouseActionPress || msg.Button != tea.MouseButtonLeft {
		// Handle scroll wheel — route to grid or log based on mouse position
		if msg.Button == tea.MouseButtonWheelUp || msg.Button == tea.MouseButtonWheelDown {
			// Tab bar is the boundary: above = grid, below = log
			logStart := a.tabBarY + 1 // line after tab bar
			if a.logVisible && msg.Y >= logStart {
				// Log panel scroll
				if msg.Button == tea.MouseButtonWheelUp {
					a.loadHistoryIfNeeded()
					a.logPanel.viewport.LineUp(3)
					a.logPanel.autoScroll = false
				} else {
					a.logPanel.viewport.LineDown(3)
				}
			} else if msg.Y >= 2 {
				// Grid scroll — shift viewport without moving cursor
				vis := a.visibleRepoIndices()
				if len(vis) > 0 {
					if msg.Button == tea.MouseButtonWheelUp {
						a.gridVScroll -= 3
					} else {
						a.gridVScroll += 3
					}
					maxScroll := len(vis) - 1
					if maxScroll < 0 {
						maxScroll = 0
					}
					if a.gridVScroll > maxScroll {
						a.gridVScroll = maxScroll
					}
					if a.gridVScroll < 0 {
						a.gridVScroll = 0
					}
				}
			}
		}
		return a, nil
	}

	// Click on search bar (Y=1)
	if msg.Y == 1 {
		a.enterGridSearch()
		return a, a.gridSearchInput.Cursor.BlinkCmd()
	}

	// Adjust Y for rows above the grid (header + search bar)
	yOffset := 2
	clickY := msg.Y - yOffset
	clickX := msg.X

	for _, hz := range a.hitZones {
		if clickX >= hz.X && clickX < hz.X+hz.Width && clickY == hz.Y {
			a.focus = FocusGrid
			a.gridSearching = false
			a.gridSearchInput.Blur()
			if hz.TargetIdx == -1 {
				// Clicked repo name
				now := time.Now()
				sameCell := a.lastClickRow == hz.RepoIdx && a.lastClickCol == -1
				isDouble := sameCell && now.Sub(a.lastClickTime) < doubleClickThreshold

				a.cursorRow = hz.RepoIdx
				a.cursorCol = -1

				if isDouble {
					a.openShellForRepo()
					a.lastClickTime = time.Time{}
				} else {
					a.lastClickRow = hz.RepoIdx
					a.lastClickCol = -1
					a.lastClickTime = now
				}
			} else {
				now := time.Now()
				sameCell := a.lastClickRow == hz.RepoIdx && a.lastClickCol == hz.TargetIdx
				isDouble := sameCell && now.Sub(a.lastClickTime) < doubleClickThreshold

				a.cursorRow = hz.RepoIdx
				a.cursorCol = hz.TargetIdx
				a.ensureCursorVisible()

				if isDouble {
					// Double-click: execute
					a.executeAtCursor()
					a.lastClickTime = time.Time{} // reset so triple-click doesn't re-fire
				} else {
					// Single click: just select
					a.lastClickRow = hz.RepoIdx
					a.lastClickCol = hz.TargetIdx
					a.lastClickTime = now
				}
			}
			return a, nil
		}
	}

	// Tab bar clicks
	if msg.Y == a.tabBarY {
		for _, hz := range a.tabHitZones {
			if msg.X >= hz.X && msg.X < hz.X+hz.Width {
				a.gridSearching = false
				a.gridSearchInput.Blur()
				a.focusedProc = hz.ProcID
				a.logPanel.SetProcess(hz.ProcID)
				a.logVisible = true
				a.logPanel.SetSize(a.width, a.logPanelHeight())
				a.focus = FocusTabBar
				return a, nil
			}
		}
	}

	return a, nil
}

// displayCellsForRow returns the display-ordered cells and index mapping for a row,
// applying the current search filter and favorites-only filter if active.
func (a *App) displayCellsForRow(row int) ([]GridCell, []int) {
	if row >= len(a.repos) {
		return nil, nil
	}
	cells := a.gridCells[row]
	if a.gridSearchQuery != "" {
		q := strings.ToLower(a.gridSearchQuery)
		var filtered []GridCell
		for _, c := range cells {
			if strings.Contains(strings.ToLower(c.Label), q) {
				filtered = append(filtered, c)
			}
		}
		cells = filtered
	}
	if a.showOnlyFavorites {
		repoName := a.repos[row].Name
		var filtered []GridCell
		for _, c := range cells {
			if a.favorites[cellID(repoName, c)] {
				filtered = append(filtered, c)
			}
		}
		cells = filtered
	}
	return reorderWithFavorites(a.repos[row].Name, cells, a.favorites)
}

// cellAtCursor returns the repo and cell at the current cursor, mapping
// from display index back to the original cell.
// When cursor is on the repo name (col -1), returns the repo with an empty cell.
func (a *App) cellAtCursor() (*model.Repo, GridCell) {
	if a.cursorCol == -1 {
		if a.cursorRow < len(a.repos) {
			return &a.repos[a.cursorRow], GridCell{}
		}
		return nil, GridCell{}
	}
	displayCells, _ := a.displayCellsForRow(a.cursorRow)
	if a.cursorCol >= len(displayCells) {
		return nil, GridCell{}
	}
	dc := displayCells[a.cursorCol]
	if dc.IsSep {
		return nil, GridCell{}
	}
	return &a.repos[a.cursorRow], dc
}

func (a *App) executeAtCursor() {
	// Repo name selected — open a shell
	if a.cursorCol == -1 {
		a.openShellForRepo()
		return
	}

	repo, cell := a.cellAtCursor()
	if repo == nil {
		return
	}

	id := repo.Name + ":" + cell.Target

	// If already running, open log instead
	state := a.procMgr.ProcessState(id)
	if state == model.ProcessRunning {
		a.focusedProc = id
		a.logPanel.SetProcess(id)
		a.logVisible = true
		a.logPanel.SetSize(a.width, a.logPanelHeight())
		a.focus = FocusLog
		return
	}

	// Start the process
	err := a.procMgr.Start(repo, cell.Target, cell.IsNpm)
	if err != nil {
		return
	}

	// Open log panel
	a.focusedProc = id
	a.logPanel.SetProcess(id)
	a.logVisible = true
	a.logPanel.SetSize(a.width, a.logPanelHeight())
	a.focus = FocusLog
}

// openShellForRepo starts an interactive shell session for the repo at the cursor.
func (a *App) openShellForRepo() {
	if a.cursorRow >= len(a.repos) {
		return
	}
	repo := &a.repos[a.cursorRow]

	shell := os.Getenv("SHELL")
	if shell == "" {
		shell = "/bin/sh"
	}

	id := repo.Name + ":shell"

	// If already running, just focus it
	if _, ok := a.procMgr.Get(id); ok {
		a.focusedProc = id
		a.logPanel.SetProcess(id)
		a.logVisible = true
		a.logPanel.SetSize(a.width, a.logPanelHeight())
		a.focus = FocusLog
		a.logPanel.inputting = true
		return
	}

	a.procMgr.StartCustom(repo, "shell", false, shell)

	a.focusedProc = id
	a.logPanel.SetProcess(id)
	a.logVisible = true
	a.logPanel.SetSize(a.width, a.logPanelHeight())
	a.focus = FocusLog
	a.logPanel.inputting = true
}

// executeWithInputMode runs the target at cursor and immediately enters input mode.
// If already running, just opens the log in input mode.
func (a *App) executeWithInputMode() {
	repo, cell := a.cellAtCursor()
	if repo == nil {
		return
	}

	id := repo.Name + ":" + cell.Target
	state := a.procMgr.ProcessState(id)

	if state != model.ProcessRunning {
		if err := a.procMgr.Start(repo, cell.Target, cell.IsNpm); err != nil {
			return
		}
	}

	a.focusedProc = id
	a.logPanel.SetProcess(id)
	a.logVisible = true
	a.logPanel.SetSize(a.width, a.logPanelHeight())
	a.focus = FocusLog
	a.logPanel.inputting = true
}

// loadHistoryIfNeeded does a one-time full scrollback capture when the user
// first scrolls up. The result is cached until new output arrives.
func (a *App) loadHistoryIfNeeded() {
	if a.focusedProc == "" || !a.logPanel.historyDirty {
		return
	}
	if content, err := a.procMgr.CapturePaneHistory(a.focusedProc); err == nil {
		a.logPanel.historyDirty = false
		a.logPanel.historyCache = content
		a.logPanel.lastRaw = ""    // force re-filter
		a.logPanel.lastContent = ""
		a.logPanel.UpdateContent(content)
	}
}

// dismissProcess stops and removes the process for the current context.
// If viewing a log, dismisses that process. Otherwise dismisses the cursor's target.
func (a *App) dismissProcess() {
	var id string
	if (a.focus == FocusLog || a.focus == FocusTabBar) && a.focusedProc != "" {
		id = a.focusedProc
	} else if a.cursorCol == -1 {
		// Repo name — dismiss the shell if running
		if a.cursorRow < len(a.repos) {
			id = a.repos[a.cursorRow].Name + ":shell"
		}
	} else {
		repo, cell := a.cellAtCursor()
		if repo == nil {
			return
		}
		id = repo.Name + ":" + cell.Target
	}

	// Only dismiss if the process has actually been started
	if _, ok := a.procMgr.Get(id); !ok {
		return
	}

	a.procMgr.Remove(id)

	// Close log panel if we just dismissed the focused process
	if a.focusedProc == id {
		a.focusedProc = ""
		a.logPanel.inputting = false
		a.logVisible = false
		a.focus = FocusGrid
	}
}

// runOrRestart runs the focused item if idle, or restarts it if already started.
// Works from both grid cursor and focused log tab.
func (a *App) runOrRestart() {
	// Repo name selected from grid — open a shell
	if a.focus == FocusGrid && a.cursorCol == -1 {
		a.openShellForRepo()
		return
	}

	var id string
	var repo *model.Repo
	var target string
	var isNpm bool

	if (a.focus == FocusLog || a.focus == FocusTabBar) && a.focusedProc != "" {
		// From log tab: look up process info from manager
		proc, ok := a.procMgr.Get(a.focusedProc)
		if !ok {
			return
		}
		id = a.focusedProc
		target = proc.Info.Target
		isNpm = strings.HasPrefix(proc.Info.Command, "npm ")
		for i := range a.repos {
			if a.repos[i].Name == proc.Info.Repo {
				repo = &a.repos[i]
				break
			}
		}
	} else {
		// From grid: use cursor position
		r, cell := a.cellAtCursor()
		if r == nil {
			return
		}
		repo = r
		id = r.Name + ":" + cell.Target
		target = cell.Target
		isNpm = cell.IsNpm
	}

	if repo == nil {
		return
	}

	// Stop if currently managed (running, exited, or failed)
	if _, ok := a.procMgr.Get(id); ok {
		a.procMgr.Stop(id)
	}

	a.procMgr.Start(repo, target, isNpm)

	a.focusedProc = id
	a.logPanel.SetProcess(id)
	a.logVisible = true
	a.logPanel.SetSize(a.width, a.logPanelHeight())

	// From grid: stay on grid so the user can quickly start multiple targets.
	// From tab bar / log: keep focus there.
	if a.focus == FocusGrid {
		// don't change focus
	} else {
		a.focus = FocusLog
	}
}

// focusLogForCursor opens the log panel for the cursor's process without running it.
func (a *App) focusLogForCursor() {
	repo, cell := a.cellAtCursor()
	if repo == nil {
		return
	}
	id := repo.Name + ":" + cell.Target
	if _, ok := a.procMgr.Get(id); !ok {
		return
	}
	a.focusedProc = id
	a.logPanel.SetProcess(id)
	a.logVisible = true
	a.logPanel.SetSize(a.width, a.logPanelHeight())
	a.focus = FocusLog
}

// dryRunAtCursor opens the command editor for the cursor's target, allowing
// the user to review and modify the command before executing.
func (a *App) dryRunAtCursor() {
	repo, cell := a.cellAtCursor()
	if repo == nil {
		return
	}

	cmdStr := process.CommandFor(repo, cell.Target, cell.IsNpm)
	a.cmdInput = textinput.New()
	a.cmdInput.Prompt = "$ "
	a.cmdInput.SetValue(cmdStr)
	a.cmdInput.Focus()
	a.cmdInput.CharLimit = 512
	a.cmdInput.Width = a.width - 10

	a.cmdEditing = true
	a.cmdEditRepo = repo
	a.cmdEditTarget = cell.Target
	a.cmdEditIsNpm = cell.IsNpm
	a.focusedProc = repo.Name + ":" + cell.Target
	a.logVisible = true
	a.logPanel.SetSize(a.width, a.logPanelHeight())
	a.focus = FocusLog
}

func (a *App) openLogForCursor() {
	repo, cell := a.cellAtCursor()
	if repo == nil {
		return
	}
	id := repo.Name + ":" + cell.Target
	if _, ok := a.procMgr.Get(id); ok {
		a.focusedProc = id
		a.logPanel.SetProcess(id)
	}
}

// orderedProcessIDs returns all started process IDs in launch order.
func (a *App) orderedProcessIDs() []string {
	return a.procMgr.ProcessIDs()
}

// switchLogTab switches to the log tab at the given 0-based index.
func (a *App) switchLogTab(idx int) {
	ids := a.orderedProcessIDs()
	if idx < 0 || idx >= len(ids) {
		return
	}
	a.focusedProc = ids[idx]
	a.logPanel.SetProcess(ids[idx])
	a.logVisible = true
	a.logPanel.SetSize(a.width, a.logPanelHeight())
	a.focus = FocusLog
}

// cycleLog cycles through: grid -> proc1 log -> proc2 log -> ... -> grid.
// dir=1 for forward (Tab), dir=-1 for backward (Shift+Tab).
func (a *App) cycleLog(dir int) {
	ids := a.orderedProcessIDs()
	if len(ids) == 0 {
		return
	}

	if a.focus == FocusGrid || a.focusedProc == "" {
		var target string
		if dir > 0 {
			target = ids[0]
		} else {
			target = ids[len(ids)-1]
		}
		a.focusedProc = target
		a.logPanel.SetProcess(target)
		a.logVisible = true
		a.logPanel.SetSize(a.width, a.logPanelHeight())
		a.focus = FocusLog
		return
	}

	curIdx := -1
	for i, id := range ids {
		if id == a.focusedProc {
			curIdx = i
			break
		}
	}

	nextIdx := curIdx + dir
	if nextIdx < 0 || nextIdx >= len(ids) {
		// Wrap when in log/tab bar focus; exit to grid when cycling via Tab/Shift+Tab
		if a.focus == FocusLog || a.focus == FocusTabBar {
			nextIdx = (nextIdx + len(ids)) % len(ids)
		} else {
			a.focus = FocusGrid
			return
		}
	}

	a.focusedProc = ids[nextIdx]
	a.logPanel.SetProcess(ids[nextIdx])
}

// tabFocus returns the current tab focus level for rendering.
func (a *App) tabFocus() TabFocus {
	if a.logPanel.inputting {
		return TabFocusInput
	}
	if a.focus == FocusLog {
		return TabFocusLog
	}
	if a.focus == FocusTabBar {
		return TabFocusBar
	}
	return TabFocusNone
}

// saveConfig persists favorites and settings to a single .devdash.json file.
func (a *App) saveConfig() {
	config.Save(a.repoRoot, config.Config{
		FavsOnly:  a.showOnlyFavorites,
		Favorites: config.FavoritesFromMap(a.favorites),
	})
}

func (a *App) toggleFavorite() {
	repo, cell := a.cellAtCursor()
	if repo == nil {
		return
	}
	id := cellID(repo.Name, cell)
	if a.favorites[id] {
		delete(a.favorites, id)
	} else {
		a.favorites[id] = true
	}
	a.saveConfig()
}

// moveCursorUp moves cursor up, skipping rows with no matching cells when filtering.
// If already at the top row and a search filter is active, re-enters search input.
func (a *App) moveCursorUp() {
	for r := a.cursorRow - 1; r >= 0; r-- {
		cells, _ := a.displayCellsForRow(r)
		if len(cells) > 0 {
			a.cursorRow = r
			a.clampCol()
			return
		}
	}
	// At the top — move focus to search input
	a.enterGridSearch()
}

// enterGridSearch focuses the search input, preserving existing filter text.
func (a *App) enterGridSearch() {
	a.gridSearching = true
	a.gridSearchInput.Focus()
	a.focus = FocusGrid
}

// focusedTabIndex returns the index of focusedProc in the ordered process list.
func (a *App) focusedTabIndex() int {
	ids := a.orderedProcessIDs()
	for i, id := range ids {
		if id == a.focusedProc {
			return i
		}
	}
	return 0
}

// enterTabBar focuses the tab bar, selecting the current focused proc's tab.
func (a *App) enterTabBar() {
	ids := a.orderedProcessIDs()
	if len(ids) == 0 {
		return
	}
	a.focus = FocusTabBar
	// If no proc is focused, default to first
	if a.focusedProc == "" {
		a.focusedProc = ids[0]
	}
	a.logPanel.SetProcess(a.focusedProc)
	a.logVisible = true
	a.logPanel.SetSize(a.width, a.logPanelHeight())
}

// snapCursorToLastVisible moves cursor to the last visible row.
func (a *App) snapCursorToLastVisible() {
	for r := len(a.repos) - 1; r >= 0; r-- {
		cells, _ := a.displayCellsForRow(r)
		if len(cells) > 0 {
			a.cursorRow = r
			a.clampCol()
			return
		}
	}
}

// snapCursorToFirstMatch moves cursor to the first row/col with matching cells.
func (a *App) snapCursorToFirstMatch() {
	a.cursorCol = 0
	a.gridVScroll = 0
	for r := 0; r < len(a.repos); r++ {
		cells, _ := a.displayCellsForRow(r)
		if len(cells) > 0 {
			a.cursorRow = r
			a.clampCol()
			return
		}
	}
}

// moveCursorDown moves cursor down, skipping rows with no matching cells when filtering.
// At the bottom, enters the tab bar if tabs exist, otherwise wraps to the top.
func (a *App) moveCursorDown() {
	for r := a.cursorRow + 1; r < len(a.repos); r++ {
		cells, _ := a.displayCellsForRow(r)
		if len(cells) > 0 {
			a.cursorRow = r
			a.clampCol()
			return
		}
	}
	// At the bottom — enter tab bar if tabs exist
	ids := a.orderedProcessIDs()
	if len(ids) > 0 {
		a.enterTabBar()
		return
	}
	// Otherwise wrap to first visible row
	for r := 0; r < a.cursorRow; r++ {
		cells, _ := a.displayCellsForRow(r)
		if len(cells) > 0 {
			a.cursorRow = r
			a.clampCol()
			return
		}
	}
}

// moveCursorLeft moves cursor left in display order, skipping separators.
// Goes to repo name (col -1) when at the first target. Wraps from repo name to last target.
func (a *App) moveCursorLeft() {
	displayCells, _ := a.displayCellsForRow(a.cursorRow)
	if a.cursorCol == -1 {
		// Wrap from repo name to last non-separator cell
		a.cursorCol = len(displayCells) - 1
		if a.cursorCol >= 0 && displayCells[a.cursorCol].IsSep {
			a.cursorCol--
		}
		if a.cursorCol < 0 {
			a.cursorCol = -1
		}
		a.ensureCursorVisible()
		return
	}
	if a.cursorCol <= 0 {
		// Move to repo name
		a.cursorCol = -1
		return
	}
	a.cursorCol--
	// Skip separator
	if a.cursorCol >= 0 && a.cursorCol < len(displayCells) && displayCells[a.cursorCol].IsSep {
		a.cursorCol--
	}
	if a.cursorCol < 0 {
		a.cursorCol = -1
	}
	a.ensureCursorVisible()
}

// moveCursorRight moves cursor right in display order, skipping separators.
// Wraps from last target to repo name (col -1).
func (a *App) moveCursorRight() {
	displayCells, _ := a.displayCellsForRow(a.cursorRow)
	maxCol := len(displayCells) - 1
	if a.cursorCol == -1 {
		// Move from repo name to first target
		a.cursorCol = 0
		if len(displayCells) > 0 && displayCells[0].IsSep {
			a.cursorCol = 1
		}
		a.ensureCursorVisible()
		return
	}
	if a.cursorCol >= maxCol {
		// Wrap to repo name
		a.cursorCol = -1
		return
	}
	a.cursorCol++
	// Skip separator
	if a.cursorCol < len(displayCells) && displayCells[a.cursorCol].IsSep {
		a.cursorCol++
	}
	if a.cursorCol > maxCol {
		a.cursorCol = -1
	}
	a.ensureCursorVisible()
}

func (a *App) clampCol() {
	if a.cursorCol == -1 {
		return // repo name is always valid
	}
	displayCells, _ := a.displayCellsForRow(a.cursorRow)
	maxCol := len(displayCells) - 1
	if maxCol < 0 {
		maxCol = 0
	}
	if a.cursorCol > maxCol {
		a.cursorCol = maxCol
	}
	// If landed on separator, nudge forward (or back if at end)
	if a.cursorCol >= 0 && a.cursorCol < len(displayCells) && displayCells[a.cursorCol].IsSep {
		if a.cursorCol+1 < len(displayCells) {
			a.cursorCol++
		} else if a.cursorCol > 0 {
			a.cursorCol--
		}
	}
	a.ensureCursorVisible()
}

// repoColumnWidth computes the dynamic repo name column width.
func (a *App) repoColumnWidth() int {
	w := repoColWidthMin
	for i := range a.repos {
		cells, _ := a.displayCellsForRow(i)
		if len(cells) == 0 {
			continue
		}
		nw := len(a.repos[i].Name) + 4
		if nw > w {
			w = nw
		}
	}
	maxCol := a.width / 3
	if w > maxCol {
		w = maxCol
	}
	return w
}

// ensureCursorVisible adjusts the horizontal scroll of the current row
// so the cursor column is within the visible area.
func (a *App) ensureCursorVisible() {
	if a.cursorRow >= len(a.repos) || a.width == 0 || a.cursorCol == -1 {
		return
	}
	displayCells, _ := a.displayCellsForRow(a.cursorRow)
	if len(displayCells) == 0 {
		return
	}

	// Calculate chip positions accounting for state indicators and padding
	repo := &a.repos[a.cursorRow]
	chipPositions := make([]int, len(displayCells)+1)
	x := 0
	for i, c := range displayCells {
		chipPositions[i] = x
		labelW := len(c.Label)
		if !c.IsSep {
			// Account for state indicator prefix (▶/▷/■/□ + space = 2 chars)
			procID := repo.Name + ":" + c.Target
			if state := a.procMgr.ProcessState(procID); state != model.ProcessIdle {
				labelW += 2
			}
		}
		x += labelW + 3 // padding(2) + margin(1)
	}
	chipPositions[len(displayCells)] = x

	availableWidth := a.width - a.repoColumnWidth() - 2 // minus scroll indicators
	if availableWidth < 10 {
		availableWidth = 10
	}

	col := a.cursorCol
	if col >= len(displayCells) {
		col = len(displayCells) - 1
	}

	cursorStart := chipPositions[col]
	cursorEnd := chipPositions[col+1]

	scroll := a.hScrolls[a.cursorRow]

	// If cursor is left of visible area, scroll left
	if cursorStart < scroll {
		scroll = cursorStart
	}
	// If cursor is right of visible area, scroll right
	if cursorEnd > scroll+availableWidth {
		scroll = cursorEnd - availableWidth
	}

	if scroll < 0 {
		scroll = 0
	}
	a.hScrolls[a.cursorRow] = scroll
}

var (
	hintKeyStyle   = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("15"))
	hintLabelStyle = lipgloss.NewStyle().Foreground(lipgloss.Color("245"))
)

// renderHotkeyHints renders "key label" pairs with the key in white and label in gray.
func renderHotkeyHints(hints []string) string {
	var parts []string
	for _, h := range hints {
		if k, l, ok := strings.Cut(h, " "); ok {
			parts = append(parts, hintKeyStyle.Render(k)+" "+hintLabelStyle.Render(l))
		} else {
			parts = append(parts, hintKeyStyle.Render(h))
		}
	}
	return strings.Join(parts, "  ")
}

// plainHotkeyHints returns the plain-text width of hints (for gap calculation).
func plainHotkeyHints(hints []string) string {
	return strings.Join(hints, "  ")
}

// visibleRepoIndices returns the repo indices that have visible cells after filtering.
func (a *App) visibleRepoIndices() []int {
	var indices []int
	for i := range a.repos {
		cells, _ := a.displayCellsForRow(i)
		if len(cells) > 0 {
			indices = append(indices, i)
		}
	}
	return indices
}

// visibleGridRows returns the total number of lines the grid will render,
// including separator lines between repo kind groups.
func (a *App) visibleGridRows() int {
	count := 0
	prevKind := model.RepoKind(-1)
	for i := range a.repos {
		cells, _ := a.displayCellsForRow(i)
		if len(cells) == 0 {
			continue
		}
		if prevKind >= 0 && a.repos[i].Kind != prevKind {
			count++
		}
		count++
		prevKind = a.repos[i].Kind
	}
	return count
}

// maxGridLines returns the maximum number of grid lines available for rendering.
// When tabs/panels exist, caps to half the available height so the log panel
// has reserved space. Full height when no tabs are open.
func (a *App) maxGridLines() int {
	chrome := 2 // header + search
	hasTabs := len(a.procMgr.ProcessIDs()) > 0
	if hasTabs {
		chrome += 2 // spacer + tab bar
	}
	available := a.height - chrome
	if !hasTabs {
		// No tabs — grid gets full height (minus 1 for trailing \n)
		return available - 1
	}
	// Tabs exist — cap grid to half so log panel has room
	half := available / 2
	if half < 3 {
		half = 3
	}
	if !a.logVisible {
		return available - 1
	}
	return half
}

// ensureGridVScroll adjusts gridVScroll so the cursor row is visible within maxLines.
func (a *App) ensureGridVScroll(maxLines int) {
	vis := a.visibleRepoIndices()
	if len(vis) == 0 {
		a.gridVScroll = 0
		return
	}

	// Find cursor position in visible list
	cursorVisIdx := -1
	for vi, ri := range vis {
		if ri == a.cursorRow {
			cursorVisIdx = vi
			break
		}
	}
	if cursorVisIdx < 0 {
		a.gridVScroll = 0
		return
	}

	// Count how many visible rows fit in maxLines (accounting for separators)
	countLines := func(startVisIdx int) (repoCount, lineCount int) {
		prevKind := model.RepoKind(-1)
		for vi := startVisIdx; vi < len(vis); vi++ {
			ri := vis[vi]
			lines := 0
			if prevKind >= 0 && a.repos[ri].Kind != prevKind {
				lines++ // separator
			}
			lines++ // the row itself
			if lineCount+lines > maxLines {
				break
			}
			lineCount += lines
			repoCount++
			prevKind = a.repos[ri].Kind
		}
		return
	}

	// If cursor is above the scroll window, scroll up
	if cursorVisIdx < a.gridVScroll {
		a.gridVScroll = cursorVisIdx
	}

	// If cursor is below the scroll window, scroll down until it's visible
	for {
		repoCount, _ := countLines(a.gridVScroll)
		endVisIdx := a.gridVScroll + repoCount - 1
		if endVisIdx >= cursorVisIdx {
			break
		}
		a.gridVScroll++
		if a.gridVScroll >= len(vis) {
			a.gridVScroll = 0
			break
		}
	}

	// Clamp
	if a.gridVScroll >= len(vis) {
		a.gridVScroll = 0
	}
}

// logPanelHeight returns the height available for the log panel:
// total height minus header(1) + search bar(1) + tab bar(1 if procs) + grid rows.
func (a *App) logPanelHeight() int {
	chrome := 2 // header + search bar
	if len(a.procMgr.ProcessIDs()) > 0 {
		chrome += 2 // spacer + tab bar
	}
	gridRows := a.visibleGridRows()
	// Cap grid rows so the log panel gets at least 6 lines
	maxGrid := a.height - chrome - 6
	if maxGrid < 3 {
		maxGrid = 3
	}
	if gridRows > maxGrid {
		gridRows = maxGrid
	}
	h := a.height - chrome - gridRows
	if h < 4 {
		h = 4
	}
	return h
}

func (a *App) View() string {
	if a.width == 0 {
		return "Loading..."
	}

	var b strings.Builder

	// Header: title + context-sensitive hotkey hints (only for active state)
	var keys []string
	if a.gridSearching {
		keys = []string{"Enter Select", "Esc Clear", "↓ Grid"}
	} else if a.cmdEditing {
		keys = []string{"Enter Run", "Esc Cancel"}
	} else if a.logPanel.inputting {
		keys = []string{"Esc×2 Exit", "C-] Exit"}
	} else if a.focus == FocusTabBar {
		keys = []string{
			"←/→ Switch", "Enter Focus",
			"r Run", "s Stop", "x Dismiss",
			"↑ Grid", "Esc Grid",
			"? Help", "q Quit",
		}
	} else if a.logPanel.logSearching {
		keys = []string{"Enter Keep", "Esc Clear"}
	} else if a.focus == FocusLog && a.logVisible {
		keys = []string{
			"/ Search", "l Level",
			"Enter Input", "i Input",
			"r Run", "s Stop", "x Dismiss",
			"Esc Tab",
			"? Help", "q Quit",
		}
	} else if a.logVisible {
		keys = []string{
			"1-9 Tab", "i Input",
			"r Run", "s Stop", "x Dismiss",
			"Tab Next", "S-Tab Prev", "Esc Close",
			"? Help", "q Quit",
		}
	} else {
		keys = []string{
			"r Run", "Enter Run", "d DryRun", "Space Focus", "F Fav", "L Logs",
			"s Stop", "f Search",
			"? Help", "q Quit",
		}
	}
	logo := headerStyle.Render(" MM DevDash ")
	headerRight := renderHotkeyHints(keys)
	headerRightPlain := plainHotkeyHints(keys)
	logoWidth := lipgloss.Width(logo)
	headerGap := a.width - logoWidth - lipgloss.Width(headerRightPlain) - 1
	if headerGap < 1 {
		headerGap = 1
	}
	headerLine := logo + strings.Repeat(" ", headerGap) + headerRight
	b.WriteString(lipgloss.NewStyle().MaxWidth(a.width).Render(headerLine))
	b.WriteString("\n")

	// Active filter badges
	var badges string
	if a.showOnlyFavorites {
		badges += " " + lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("3")).Render("[favs]")
	}

	// Search bar — always visible, with category legend right-aligned
	legend := RenderLegend()
	legendWidth := lipgloss.Width(legend)

	var searchLeft string
	if a.gridSearching {
		prefix := lipgloss.NewStyle().Bold(true).Reverse(true).Padding(0, 1).Render("Search")
		searchLeft = prefix + " " + a.gridSearchInput.View() + badges
	} else {
		prefix := lipgloss.NewStyle().Bold(true).Foreground(colorMuted).Padding(0, 1).Render("Search")
		text := a.gridSearchQuery
		if text == "" {
			text = legendStyle.Render("/")
		}
		searchLeft = prefix + " " + text + badges
	}

	leftWidth := lipgloss.Width(searchLeft)
	gap := a.width - leftWidth - legendWidth
	if gap < 1 {
		gap = 1
	}
	b.WriteString(searchLeft + strings.Repeat(" ", gap) + legend)
	b.WriteString("\n")

	// Grid — compute max lines and scroll offset
	maxLines := a.maxGridLines()
	a.ensureGridVScroll(maxLines)

	gridStr, hitZones := renderGrid(
		a.repos,
		a.cursorRow, a.cursorCol,
		a.width, maxLines, a.gridVScroll,
		a.hScrolls,
		a.favorites,
		a.gridSearchQuery,
		a.procMgr.ProcessState,
		a.focusedProc,
		a.gridSearching || a.focus == FocusTabBar || (a.logVisible && a.focus == FocusLog),
		a.showOnlyFavorites,
	)
	a.hitZones = hitZones
	b.WriteString(gridStr)

	// Tab bar — always visible when processes exist
	ids := a.orderedProcessIDs()
	var tabs []LogTab
	if len(ids) > 0 {
		tabs = make([]LogTab, len(ids))
		for i, id := range ids {
			tabs[i] = LogTab{ID: id, State: a.procMgr.ProcessState(id)}
		}
		tabBar, tabHZ, newHScroll := RenderTabBar(tabs, a.focusedProc, a.tabFocus(), a.width, a.tabHScroll)
		a.tabHScroll = newHScroll
		a.tabHitZones = tabHZ
		// Tab bar Y = header(1) + search(1) + grid lines + spacer/INPUT line(1)
		gridLines := strings.Count(gridStr, "\n")
		a.tabBarY = 2 + gridLines + 1
		if a.logPanel.inputting {
			// Find the focused tab's hit zone for offset and width
			var offset, tabWidth int
			for _, hz := range tabHZ {
				if hz.ProcID == a.focusedProc {
					offset = hz.X
					tabWidth = hz.Width
					break
				}
			}
			bg := lipgloss.NewStyle().Background(colorPrimary)
			white := lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("15")).Background(colorPrimary)
			faded := lipgloss.NewStyle().Foreground(lipgloss.Color("183")).Background(colorPrimary)

			left := white.Render(" INPUT ")
			right := white.Render("Esc×2") + bg.Render(" ") + faded.Render("Exit") + bg.Render(" ")
			leftW := lipgloss.Width(left)
			rightW := lipgloss.Width(right)
			remaining := tabWidth - leftW
			var content string
			if remaining >= rightW {
				// Both fit — pad between them
				content = left + bg.Render(strings.Repeat(" ", remaining-rightW)) + right
			} else if remaining > 0 {
				// Truncate hint to fit
				content = left + lipgloss.NewStyle().MaxWidth(remaining).Render(right)
			} else {
				content = left
			}
			inputTag := lipgloss.NewStyle().
				MaxWidth(tabWidth).
				Render(content)
			b.WriteString(strings.Repeat(" ", offset) + inputTag + "\n")
		} else {
			b.WriteString("\n")
		}
		b.WriteString(tabBar)
		b.WriteString("\n")
	}

	// Size log panel based on actual remaining space (grid lines + chrome already rendered)
	if a.logVisible {
		gridLines := strings.Count(gridStr, "\n")
		chrome := 2 // header + search bar
		if len(ids) > 0 {
			chrome += 2 // spacer + tab bar
		}
		lpH := a.height - chrome - gridLines
		if lpH < 4 {
			lpH = 4
		}
		a.logPanel.SetSize(a.width, lpH)
		// Keep tmux pane sized to match the log panel
		if a.focusedProc != "" {
			a.procMgr.ResizeTmux(a.focusedProc, lpH, a.width)
		}
	}

	// Log panel / command editor (viewport only — tab bar already rendered above)
	if a.cmdEditing && a.logVisible {
		cmdHeader := lipgloss.NewStyle().
			Bold(true).
			Reverse(true).
			Padding(0, 1).
			Render(fmt.Sprintf(" %s ", a.focusedProc))
		hint := legendStyle.Render("  Enter Run  Esc Cancel")
		b.WriteString(cmdHeader + hint + "\n")
		b.WriteString(a.cmdInput.View() + "\n")
	} else if a.logVisible && a.focusedProc != "" {
		b.WriteString(a.logPanel.ViewContent())
	}

	// Help overlay
	if a.showHelp {
		return a.renderHelp()
	}

	return b.String()
}

func (a *App) renderHelp() string {
	help := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(colorPrimary).
		Padding(1, 2).
		Width(60).
		Render(strings.Join([]string{
		"DevDash Help — Mattermost (MM) Dev Dashboard",
		"",
		"Navigation:",
		"  j or k     Move between repos",
		"  h or l     Move between targets",
		"  Enter      Execute target (or shell on repo name)",
		"  Dbl-Click  Click any target to run it",
		"  Space      Focus log panel on target",
		"  f or /     Search targets",
		"  d          Dry-run: edit command before running",
		"  F          Toggle favorite",
		"  Ctrl+f     Toggle favorites-only view",
		"",
		"Process Control:",
		"  s          Stop focused process",
		"  r          Run target or restart process",
		"  x          Dismiss: stop + remove + close panel",
		"  Ctrl+x     Stop all processes",
		"",
		"Log Panel:",
		"  L          Toggle log panel",
		"  Tab        Cycle to next process log",
		"  Shift+Tab  Cycle to prev or back to grid",
		"  i          Run target + enter input mode (tmux)",
		"  1-9        Switch log tab by number",
		"  /          Search log output (fzf-style filter)",
		"  l          Cycle log level (ALL→DEBUG→INFO→WARN→ERROR)",
		"  g or G     Jump to top or bottom",
		"  Esc×2      Exit input mode",
		"  Esc        Close log panel",
		"",
		"Other:",
		"  Ctrl+r     Re-scan repos",
		"  ? or F1    This help",
		"  q          Quit",
	}, "\n"))

	// Center it
	return lipgloss.Place(a.width, a.height, lipgloss.Center, lipgloss.Center, help)
}

func Run(repos []model.Repo, mgr *process.Manager, repoRoot string) error {
	app := NewApp(repos, mgr, repoRoot)

	p := tea.NewProgram(
		app,
		tea.WithAltScreen(),
		tea.WithMouseCellMotion(),
	)

	mgr.SetProgram(p)

	_, err := p.Run()
	return err
}
