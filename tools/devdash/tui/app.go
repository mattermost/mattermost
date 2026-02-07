package tui

import (
	"fmt"
	"sort"
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
	FocusLog
)

type App struct {
	repos   []model.Repo
	procMgr *process.Manager
	keys    KeyMap

	// Grid state
	cursorRow int
	cursorCol int
	gridCells [][]GridCell // cached per-repo cells
	hScrolls  []int        // per-row horizontal scroll offset (in chars)

	// Log panel
	logPanel    LogPanel
	logVisible  bool
	focusedProc string // process ID shown in log

	// UI state
	focus    FocusArea
	showHelp bool
	width    int
	height   int

	// Favorites: set of "repo:target" strings
	favorites map[string]bool

	// Target search
	gridSearching bool
	gridSearchInput textinput.Model
	gridSearchQuery string // live filter applied to grid cells

	// Command editing (dry-run mode)
	cmdEditing    bool
	cmdInput      textinput.Model
	cmdEditRepo   *model.Repo
	cmdEditTarget string
	cmdEditIsNpm  bool

	// Mouse hit zones (rebuilt each render)
	hitZones []HitZone

	// Double-click tracking
	lastClickRow int
	lastClickCol int
	lastClickTime time.Time

	// Paths
	repoRoot string

	// Scan info
	scanTime time.Time
}

func NewApp(repos []model.Repo, mgr *process.Manager, repoRoot string) *App {
	// Pre-build grid cells
	cells := make([][]GridCell, len(repos))
	for i := range repos {
		cells[i] = buildGridCells(&repos[i])
	}

	si := textinput.New()
	si.Placeholder = "filter targets..."
	si.CharLimit = 64
	si.Prompt = "/ "

	return &App{
		repos:           repos,
		procMgr:         mgr,
		keys:            DefaultKeyMap(),
		gridCells:       cells,
		hScrolls:        make([]int, len(repos)),
		repoRoot:        repoRoot,
		favorites:       config.LoadFavorites(repoRoot),
		gridSearchInput: si,
		logPanel:        NewLogPanel(),
		scanTime:        time.Now(),
	}
}

func (a *App) Init() tea.Cmd {
	return tea.Tick(time.Second, func(t time.Time) tea.Msg {
		return TickMsg(t)
	})
}

func (a *App) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {

	case tea.WindowSizeMsg:
		a.width = msg.Width
		a.height = msg.Height
		if a.logVisible {
			a.logPanel.SetSize(msg.Width, msg.Height/2)
		}
		return a, nil

	case TickMsg:
		// Refresh log content if visible
		if a.logVisible && a.focusedProc != "" {
			if proc, ok := a.procMgr.Get(a.focusedProc); ok {
				a.logPanel.UpdateContent(proc)
			}
		}
		return a, tea.Tick(time.Second, func(t time.Time) tea.Msg {
			return TickMsg(t)
		})

	case ProcessOutputMsg:
		// If this is the process we're watching, refresh the log
		if a.logVisible && msg.ProcessID == a.focusedProc {
			if proc, ok := a.procMgr.Get(a.focusedProc); ok {
				a.logPanel.UpdateContent(proc)
			}
		}
		return a, nil

	case ProcessExitMsg:
		// When the focused process exits, return to grid navigation
		if msg.ProcessID == a.focusedProc && a.focus == FocusLog {
			a.focus = FocusGrid
		}
		return a, nil

	case tea.MouseMsg:
		return a.handleMouse(msg)

	case tea.KeyMsg:
		return a.handleKey(msg)
	}

	return a, nil
}

func (a *App) handleKey(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
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
		case "enter":
			// Lock in the filter and return to grid nav
			a.gridSearching = false
			a.gridSearchInput.Blur()
			return a, nil
		default:
			var cmd tea.Cmd
			a.gridSearchInput, cmd = a.gridSearchInput.Update(msg)
			a.gridSearchQuery = a.gridSearchInput.Value()
			// Move cursor to first row with matching cells
			a.cursorCol = 0
			a.cursorRow = 0
			for r := 0; r < len(a.repos); r++ {
				cells, _ := a.displayCellsForRow(r)
				if len(cells) > 0 {
					a.cursorRow = r
					break
				}
			}
			a.clampCol()
			return a, cmd
		}
	}

	// If searching in log panel, route to search input
	if a.focus == FocusLog && a.logPanel.searching {
		switch msg.String() {
		case "esc":
			a.logPanel.searching = false
			a.logPanel.searchInput.Blur()
			return a, nil
		case "enter":
			a.logPanel.searching = false
			a.logPanel.searchInput.Blur()
			// Refresh log with search filter
			if proc, ok := a.procMgr.Get(a.focusedProc); ok {
				a.logPanel.UpdateContent(proc)
			}
			return a, nil
		default:
			var cmd tea.Cmd
			a.logPanel.searchInput, cmd = a.logPanel.searchInput.Update(msg)
			return a, cmd
		}
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
		if a.logVisible && a.focus == FocusLog {
			a.focus = FocusGrid
		} else if a.logVisible {
			a.logVisible = false
			a.focus = FocusGrid
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
			a.logPanel.SetSize(a.width, a.height/2)
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

	case key.Matches(msg, a.keys.Search):
		if a.logVisible && a.focus == FocusLog {
			a.logPanel.searching = true
			a.logPanel.searchInput.Focus()
			return a, a.logPanel.searchInput.Cursor.BlinkCmd()
		}
		// Grid target search
		a.gridSearching = true
		a.gridSearchInput.Focus()
		return a, a.gridSearchInput.Cursor.BlinkCmd()
	}

	// Log panel keys (only when log panel is visible)
	if a.logVisible {
		// Log level cycle
		if key.Matches(msg, a.keys.LogLevelCycle) {
			switch a.logPanel.logLevel {
			case process.LogLevelAll:
				a.logPanel.logLevel = process.LogLevelError
			case process.LogLevelError:
				a.logPanel.logLevel = process.LogLevelWarn
			case process.LogLevelWarn:
				a.logPanel.logLevel = process.LogLevelInfo
			default:
				a.logPanel.logLevel = process.LogLevelAll
			}
			a.refreshLog()
			return a, nil
		}

		// Number keys 1-9 switch log tabs
		if k := msg.String(); len(k) == 1 && k[0] >= '1' && k[0] <= '9' {
			idx := int(k[0] - '1')
			a.switchLogTab(idx)
			return a, nil
		}
	}

	// Log viewport scrolling when focused
	if a.focus == FocusLog && a.logVisible {
		switch msg.String() {
		case "up", "k":
			a.logPanel.viewport.LineUp(1)
			a.logPanel.autoScroll = false
			return a, nil
		case "down", "j":
			a.logPanel.viewport.LineDown(1)
			return a, nil
		case "G":
			a.logPanel.viewport.GotoBottom()
			a.logPanel.autoScroll = true
			return a, nil
		case "g":
			a.logPanel.viewport.GotoTop()
			a.logPanel.autoScroll = false
			return a, nil
		}
		var cmd tea.Cmd
		a.logPanel.viewport, cmd = a.logPanel.viewport.Update(msg)
		return a, cmd
	}

	// Grid navigation
	switch {
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

	case key.Matches(msg, a.keys.Execute):
		a.executeAtCursor()

	case key.Matches(msg, a.keys.Restart):
		if a.focusedProc != "" {
			a.procMgr.Stop(a.focusedProc)
			// Re-execute after a brief pause
			repo, cell := a.cellAtCursor()
			if repo != nil {
				a.procMgr.Start(repo, cell.Target, cell.IsNpm)
			}
		}
	}

	return a, nil
}

const doubleClickThreshold = 400 * time.Millisecond

func (a *App) handleMouse(msg tea.MouseMsg) (tea.Model, tea.Cmd) {
	if msg.Action != tea.MouseActionPress || msg.Button != tea.MouseButtonLeft {
		// Handle scroll wheel in log panel
		if a.logVisible && msg.Y > a.gridHeight() {
			if msg.Button == tea.MouseButtonWheelUp {
				a.logPanel.viewport.LineUp(3)
				a.logPanel.autoScroll = false
			} else if msg.Button == tea.MouseButtonWheelDown {
				a.logPanel.viewport.LineDown(3)
			}
		}
		return a, nil
	}

	// Adjust Y for rows above the grid (header + optional search bar)
	yOffset := 1 // header
	if a.gridSearching || a.gridSearchQuery != "" {
		yOffset = 2 // header + search bar
	}
	clickY := msg.Y - yOffset
	clickX := msg.X

	for _, hz := range a.hitZones {
		if clickX >= hz.X && clickX < hz.X+hz.Width && clickY == hz.Y {
			if hz.TargetIdx == -1 {
				// Clicked repo name — just select the row
				a.cursorRow = hz.RepoIdx
				a.cursorCol = 0
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

	return a, nil
}

// displayCellsForRow returns the display-ordered cells and index mapping for a row,
// applying the current search filter if active.
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
	return reorderWithFavorites(a.repos[row].Name, cells, a.favorites)
}

// cellAtCursor returns the repo and cell at the current cursor, mapping
// from display index back to the original cell.
func (a *App) cellAtCursor() (*model.Repo, GridCell) {
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
		a.logPanel.SetSize(a.width, a.height/2)
		a.focus = FocusLog
		a.refreshLog()
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
	a.logPanel.SetSize(a.width, a.height/2)
	a.focus = FocusLog
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
	a.logPanel.SetSize(a.width, a.height/2)
	a.focus = FocusLog
	a.refreshLog()
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
	a.logPanel.SetSize(a.width, a.height/2)
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
		a.refreshLog()
	}
}

// sortedProcessIDs returns all started process IDs in stable sorted order.
func (a *App) sortedProcessIDs() []string {
	ids := a.procMgr.ProcessIDs()
	sort.Strings(ids)
	return ids
}

// switchLogTab switches to the log tab at the given 0-based index.
func (a *App) switchLogTab(idx int) {
	ids := a.sortedProcessIDs()
	if idx < 0 || idx >= len(ids) {
		return
	}
	a.focusedProc = ids[idx]
	a.logPanel.SetProcess(ids[idx])
	a.logVisible = true
	a.logPanel.SetSize(a.width, a.height/2)
	a.focus = FocusLog
	a.refreshLog()
}

// cycleLog cycles through: grid → proc1 log → proc2 log → ... → grid.
// dir=1 for forward (Tab), dir=-1 for backward (Shift+Tab).
func (a *App) cycleLog(dir int) {
	ids := a.sortedProcessIDs()
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
		a.logPanel.SetSize(a.width, a.height/2)
		a.focus = FocusLog
		a.refreshLog()
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
		a.focus = FocusGrid
		return
	}

	a.focusedProc = ids[nextIdx]
	a.logPanel.SetProcess(ids[nextIdx])
	a.refreshLog()
}

func (a *App) refreshLog() {
	if a.focusedProc == "" {
		return
	}
	if proc, ok := a.procMgr.Get(a.focusedProc); ok {
		a.logPanel.UpdateContent(proc)
	}
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
	config.SaveFavorites(a.repoRoot, a.favorites)
}

// moveCursorUp moves cursor up, skipping rows with no matching cells when filtering.
func (a *App) moveCursorUp() {
	for r := a.cursorRow - 1; r >= 0; r-- {
		cells, _ := a.displayCellsForRow(r)
		if len(cells) > 0 {
			a.cursorRow = r
			a.clampCol()
			return
		}
	}
}

// moveCursorDown moves cursor down, skipping rows with no matching cells when filtering.
func (a *App) moveCursorDown() {
	for r := a.cursorRow + 1; r < len(a.repos); r++ {
		cells, _ := a.displayCellsForRow(r)
		if len(cells) > 0 {
			a.cursorRow = r
			a.clampCol()
			return
		}
	}
}

// moveCursorLeft moves cursor left in display order, skipping separators.
func (a *App) moveCursorLeft() {
	if a.cursorCol <= 0 {
		return
	}
	displayCells, _ := a.displayCellsForRow(a.cursorRow)
	a.cursorCol--
	// Skip separator
	if a.cursorCol >= 0 && a.cursorCol < len(displayCells) && displayCells[a.cursorCol].IsSep {
		a.cursorCol--
	}
	if a.cursorCol < 0 {
		a.cursorCol = 0
	}
	a.ensureCursorVisible()
}

// moveCursorRight moves cursor right in display order, skipping separators.
func (a *App) moveCursorRight() {
	displayCells, _ := a.displayCellsForRow(a.cursorRow)
	maxCol := len(displayCells) - 1
	if a.cursorCol >= maxCol {
		return
	}
	a.cursorCol++
	// Skip separator
	if a.cursorCol < len(displayCells) && displayCells[a.cursorCol].IsSep {
		a.cursorCol++
	}
	if a.cursorCol > maxCol {
		a.cursorCol = maxCol
	}
	a.ensureCursorVisible()
}

func (a *App) clampCol() {
	displayCells, _ := a.displayCellsForRow(a.cursorRow)
	maxCol := len(displayCells) - 1
	if maxCol < 0 {
		maxCol = 0
	}
	if a.cursorCol > maxCol {
		a.cursorCol = maxCol
	}
	// If landed on separator, nudge forward (or back if at end)
	if a.cursorCol < len(displayCells) && displayCells[a.cursorCol].IsSep {
		if a.cursorCol+1 < len(displayCells) {
			a.cursorCol++
		} else if a.cursorCol > 0 {
			a.cursorCol--
		}
	}
	a.ensureCursorVisible()
}

// ensureCursorVisible adjusts the horizontal scroll of the current row
// so the cursor column is within the visible area.
func (a *App) ensureCursorVisible() {
	if a.cursorRow >= len(a.repos) || a.width == 0 {
		return
	}
	displayCells, _ := a.displayCellsForRow(a.cursorRow)
	if len(displayCells) == 0 {
		return
	}

	// Calculate chip positions (approximate: label + padding + margin = len + 3)
	chipPositions := make([]int, len(displayCells)+1)
	x := 0
	for i, c := range displayCells {
		chipPositions[i] = x
		x += len(c.Label) + 4 // padding(2) + margin(1) + state indicator wiggle room
	}
	chipPositions[len(displayCells)] = x

	availableWidth := a.width - repoColWidth - 2 // minus scroll indicators
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

func (a *App) gridHeight() int {
	h := len(a.repos) + 2 // repos + possible separator + header
	return h
}

func (a *App) View() string {
	if a.width == 0 {
		return "Loading..."
	}

	var b strings.Builder

	// Header
	running := a.procMgr.RunningCount()
	failed := a.procMgr.FailedCount()
	scanAgo := time.Since(a.scanTime).Truncate(time.Second)

	headerText := fmt.Sprintf("  DevDash  │ ●%d running  ✗%d failed  │  scanned %s ago  │  ? help  q quit",
		running, failed, scanAgo)
	b.WriteString(headerStyle.Width(a.width).Render(headerText))
	b.WriteString("\n")

	// Search bar (only shown when searching/filtered)
	if a.gridSearching {
		b.WriteString(a.gridSearchInput.View())
		b.WriteString("\n")
	} else if a.gridSearchQuery != "" {
		b.WriteString(lipgloss.NewStyle().Foreground(colorWarning).Render(
			fmt.Sprintf("  filter: %q  (Esc to clear)", a.gridSearchQuery)))
		b.WriteString("\n")
	}

	// Grid
	maxGridRows := len(a.repos)
	if a.logVisible {
		maxGridRows = (a.height - 4) / 2 // leave room for log panel
		if maxGridRows < 3 {
			maxGridRows = 3
		}
	}

	gridStr, hitZones := renderGrid(
		a.repos,
		a.cursorRow, a.cursorCol,
		a.width, maxGridRows,
		a.hScrolls,
		a.favorites,
		a.gridSearchQuery,
		a.procMgr.ProcessState,
		a.focusedProc,
		a.logVisible && a.focus == FocusLog,
	)
	a.hitZones = hitZones
	b.WriteString(gridStr)

	// Log panel / command editor
	if a.cmdEditing && a.logVisible {
		// Command edit mode: show editable command instead of log content
		cmdHeader := lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("15")).
			Background(colorPrimary).
			Padding(0, 1).
			Render(fmt.Sprintf(" %s ", a.focusedProc))
		hint := legendStyle.Render("  Enter:Run  Esc:Cancel")
		b.WriteString(cmdHeader + hint + "\n")
		b.WriteString(a.cmdInput.View() + "\n")
	} else if a.logVisible && a.focusedProc != "" {
		ids := a.sortedProcessIDs()
		tabs := make([]LogTab, len(ids))
		for i, id := range ids {
			tabs[i] = LogTab{ID: id, State: a.procMgr.ProcessState(id)}
		}
		b.WriteString(a.logPanel.View(tabs, a.focus == FocusLog))
	}

	// Status bar
	b.WriteString("\n")
	var keys []string
	if a.cmdEditing {
		keys = []string{
			"Enter:Run", "Esc:Cancel",
		}
	} else if a.logVisible {
		keys = []string{
			"1-9:Tab", "v:Level",
			"s:Stop", "R:Restart",
			"Tab:Next", "S-Tab:Prev", "Esc:Close",
		}
	} else {
		keys = []string{
			"Enter:Run", "d:DryRun", "f:Focus", "F:Fav", "L:Logs",
			"s:Stop", "/:Search", "?:Help", "q:Quit",
		}
	}
	statusLine := RenderLegend() + "  │  " + legendStyle.Render(strings.Join(keys, "  "))
	b.WriteString(statusBarStyle.Width(a.width).Render(statusLine))

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
		"DevDash Help",
		"",
		"Navigation:",
		"  j/k ↑/↓    Move between repos",
		"  h/l ←/→    Move between targets",
		"  Enter      Execute target",
		"  Dbl-Click  Click any target to run it",
		"  f          Focus log panel on target",
		"  d          Dry-run: edit command before running",
		"  F          Toggle favorite",
		"",
		"Process Control:",
		"  s          Stop focused process",
		"  R          Restart focused process",
		"  Ctrl+X     Stop all processes",
		"",
		"Log Panel:",
		"  L          Toggle log panel",
		"  Tab        Cycle to next process log",
		"  Shift+Tab  Cycle to prev / back to grid",
		"  /          Search targets (grid) or logs (log)",
		"  1-9        Switch log tab by number",
		"  v          Cycle log level filter",
		"  g/G        Jump to top/bottom",
		"  Esc        Close log panel",
		"",
		"Other:",
		"  Ctrl+R     Re-scan repos",
		"  ?/F1       This help",
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
