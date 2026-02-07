package tui

import (
	"fmt"
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
	hitZones []HitZone

	// Double-click tracking
	lastClickRow  int
	lastClickCol  int
	lastClickTime time.Time

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

	return &App{
		repos:           repos,
		procMgr:         mgr,
		keys:            DefaultKeyMap(),
		gridCells:       cells,
		hScrolls:        make([]int, len(repos)),
		repoRoot:        repoRoot,
		favorites:        config.LoadFavorites(repoRoot),
		showOnlyFavorites: config.LoadSettings(repoRoot).FavsOnly,
		gridSearchInput:  si,
		gridSearching:    true,
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
			if content, err := a.procMgr.CapturePaneContent(a.focusedProc); err == nil {
				a.logPanel.UpdateContent(content)
			}
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
		config.SaveSettings(a.repoRoot, config.Settings{FavsOnly: a.showOnlyFavorites})
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
		case "enter", "down", "j":
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
		if msg.String() == "esc" {
			a.logPanel.inputting = false
			return a, nil
		}
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

	// Log viewport scrolling and input mode when focused
	if a.focus == FocusLog && a.logVisible {
		// Enter input mode from log focus
		if key.Matches(msg, a.keys.ProcInput) {
			if a.focusedProc != "" {
				a.logPanel.inputting = true
			}
			return a, nil
		}
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

	case key.Matches(msg, a.keys.ProcInput):
		a.executeWithInputMode()

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

	// Adjust Y for rows above the grid (header + search bar)
	yOffset := 2
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

// dismissProcess stops and removes the process for the current context.
// If viewing a log, dismisses that process. Otherwise dismisses the cursor's target.
func (a *App) dismissProcess() {
	var id string
	if a.focus == FocusLog && a.focusedProc != "" {
		id = a.focusedProc
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
		a.focus = FocusGrid
		return
	}

	a.focusedProc = ids[nextIdx]
	a.logPanel.SetProcess(ids[nextIdx])
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
}

// snapCursorToFirstMatch moves cursor to the first row/col with matching cells.
func (a *App) snapCursorToFirstMatch() {
	a.cursorCol = 0
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

func (a *App) gridHeight() int {
	h := len(a.repos) + 2 // repos + possible separator + header
	return h
}

// visibleGridRows returns the total number of lines the grid will render,
// including separator lines between repo kinds.
func (a *App) visibleGridRows() int {
	count := 0
	splitIdx := -1
	for i, r := range a.repos {
		if r.Kind == model.RepoKindPlugin {
			splitIdx = i
			break
		}
	}
	for i := range a.repos {
		// renderGrid emits a separator line before the first plugin repo
		if i == splitIdx && splitIdx > 0 {
			count++
		}
		cells, _ := a.displayCellsForRow(i)
		if len(cells) > 0 {
			count++
		}
	}
	return count
}

// logPanelHeight returns the height available for the log panel:
// total height minus header(1) + search bar(1) + tab bar(1 if procs) + grid rows.
func (a *App) logPanelHeight() int {
	chrome := 2 // header + search bar
	if len(a.procMgr.ProcessIDs()) > 0 {
		chrome++ // tab bar
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

	// Header: title + context-sensitive hotkey hints
	var keys []string
	if a.cmdEditing {
		keys = []string{"Enter Run", "Esc Cancel"}
	} else if a.logPanel.inputting {
		keys = []string{"Enter Send", "Esc Exit"}
	} else if a.logVisible {
		keys = []string{
			"1-9 Tab", "i Input",
			"s Stop", "R Restart", "x Dismiss",
			"Tab Next", "S-Tab Prev", "Esc Close",
		}
	} else {
		keys = []string{
			"Enter Run", "d DryRun", "f Focus", "F Fav", "L Logs",
			"s Stop", "/ Search",
		}
	}
	keys = append(keys, "? Help", "q Quit")
	logo := headerStyle.Render(" DevDash ")
	headerRight := renderHotkeyHints(keys)
	headerRightPlain := plainHotkeyHints(keys)
	logoWidth := lipgloss.Width(logo)
	headerGap := a.width - logoWidth - len(headerRightPlain) - 1
	if headerGap < 1 {
		headerGap = 1
	}
	b.WriteString(logo + strings.Repeat(" ", headerGap) + headerRight)
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

	// Grid
	maxGridRows := len(a.repos)
	if a.logVisible {
		// Show grid rows that fit above the log panel + tab bar
		chrome := 2 // header + search
		if len(a.orderedProcessIDs()) > 0 {
			chrome++ // tab bar
		}
		maxGridRows = a.height - chrome - a.logPanelHeight()
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
		a.gridSearching || (a.logVisible && a.focus == FocusLog),
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
		b.WriteString(RenderTabBar(tabs, a.focusedProc, a.focus == FocusLog, a.logPanel.inputting))
		b.WriteString("\n")
	}

	// Size log panel based on actual remaining space (grid lines + chrome already rendered)
	if a.logVisible {
		gridLines := strings.Count(gridStr, "\n")
		chrome := 2 // header + search bar
		if len(ids) > 0 {
			chrome++ // tab bar
		}
		lpH := a.height - chrome - gridLines
		if lpH < 4 {
			lpH = 4
		}
		a.logPanel.SetSize(a.width, lpH)
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
		"  Ctrl+F     Toggle favorites-only view",
		"",
		"Process Control:",
		"  s          Stop focused process",
		"  R          Restart focused process",
		"  x          Dismiss: stop + remove + close panel",
		"  Ctrl+X     Stop all processes",
		"",
		"Log Panel:",
		"  L          Toggle log panel",
		"  Tab        Cycle to next process log",
		"  Shift+Tab  Cycle to prev / back to grid",
		"  i          Run target + enter input mode (tmux)",
		"  1-9        Switch log tab by number",
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
