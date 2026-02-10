package tui

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/charmbracelet/bubbles/textinput"
	"github.com/charmbracelet/bubbles/viewport"
	"github.com/charmbracelet/lipgloss"

	"github.com/mattermost/mattermost/tools/devdash/model"
)

// Log levels for filtering (cumulative, index = minimum level shown)
var logLevelNames = []string{"ALL", "DEBUG", "INFO", "WARN", "ERROR"}

var levelRe = regexp.MustCompile(`(?i)^\s*(error|warn|info|debug|trace)\b`)
var levelOrder = map[string]int{"trace": 0, "debug": 1, "info": 2, "warn": 3, "error": 4}

// LogTab holds info for rendering a single tab in the log panel header.
type LogTab struct {
	ID    string
	State model.ProcessState
}

type LogPanel struct {
	viewport     viewport.Model
	processID    string
	inputting    bool   // true when raw keystrokes are forwarded to process via tmux
	autoScroll   bool
	lastContent  string // cache to skip redundant viewport updates
	lastRaw      string // raw unfiltered content (for re-filtering)
	historyCache string // cached full scrollback (loaded on first scroll-up)
	historyDirty bool   // true when history needs refresh on next scroll-up
	width        int
	height       int
	ready        bool

	// Log search
	logSearching   bool
	logSearchInput textinput.Model
	logSearchQuery string // active filter text

	// Log level filter
	logLevel int // 0=ALL, 1=DEBUG, 2=INFO, 3=WARN, 4=ERROR
}

func NewLogPanel() LogPanel {
	return LogPanel{
		autoScroll: true,
	}
}

func (lp *LogPanel) SetSize(width, height int) {
	lp.width = width
	lp.height = height

	if !lp.ready {
		lp.viewport = viewport.New(width, height)
		lp.ready = true
	} else {
		lp.viewport.Width = width
		lp.viewport.Height = height
	}
}

func (lp *LogPanel) SetProcess(id string) {
	lp.processID = id
	lp.autoScroll = true
	lp.lastContent = ""
	lp.lastRaw = ""
	lp.historyCache = ""
	lp.historyDirty = true
	lp.logSearching = false
	lp.logSearchQuery = ""
	lp.logLevel = 0
}

// UpdateContent sets the log panel content from a captured tmux pane string.
// Applies active filters (log level + search) before setting viewport content.
func (lp *LogPanel) UpdateContent(content string) {
	if !lp.ready || content == lp.lastRaw {
		return
	}
	lp.lastRaw = content
	lp.applyFilters()
}

// applyFilters re-filters lastRaw content and updates the viewport.
func (lp *LogPanel) applyFilters() {
	if !lp.ready {
		return
	}
	filtered := lp.filterContent(lp.lastRaw)
	if filtered == lp.lastContent {
		return
	}
	lp.lastContent = filtered
	lp.viewport.SetContent(filtered)

	if lp.autoScroll {
		lp.viewport.GotoBottom()
	}
}

// filterContent applies log level and search filters to raw content.
func (lp *LogPanel) filterContent(raw string) string {
	if lp.logLevel == 0 && lp.logSearchQuery == "" {
		return raw
	}

	lines := strings.Split(raw, "\n")
	var result []string
	query := strings.ToLower(lp.logSearchQuery)

	for _, line := range lines {
		// Log level filter
		if lp.logLevel > 0 {
			if m := levelRe.FindString(line); m != "" {
				lineLevel := levelOrder[strings.ToLower(strings.TrimSpace(m))]
				if lineLevel < lp.logLevel {
					continue
				}
			}
			// Non-log lines always pass through
		}

		// Search filter
		if query != "" {
			if !strings.Contains(strings.ToLower(line), query) {
				continue
			}
		}

		result = append(result, line)
	}
	return strings.Join(result, "\n")
}

// CycleLogLevel advances to the next log level filter.
func (lp *LogPanel) CycleLogLevel() {
	lp.logLevel = (lp.logLevel + 1) % len(logLevelNames)
	lp.lastContent = "" // force re-filter
	lp.applyFilters()
}

// LogLevelName returns the current log level filter name.
func (lp *LogPanel) LogLevelName() string {
	return logLevelNames[lp.logLevel]
}

// TabFocus represents the focus level of the current tab.
type TabFocus int

const (
	TabFocusNone  TabFocus = iota // tab bar visible but not focused
	TabFocusBar                   // tab bar arrow-nav focused
	TabFocusLog                   // log viewport focused
	TabFocusInput                 // input mode active
)

var (
	// Tab styles
	tabSelectedStyle = lipgloss.NewStyle().
				Bold(true).
				Reverse(true).
				Padding(0, 1)

	tabCurrentStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("15")).
			Padding(0, 1)

	tabOtherStyle = lipgloss.NewStyle().
			Foreground(colorMuted).
			Padding(0, 1)

	tabInputStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("15")).
			Background(colorPrimary).
			Padding(0, 1)
)

// RenderTabBar renders the numbered process tabs with horizontal scrolling.
// hScroll is the pixel offset into the tab bar; width is the available screen width.
// Returns the rendered string, hit zones (adjusted for scroll), and the updated hScroll.
func RenderTabBar(tabs []LogTab, currentID string, focus TabFocus, width, hScroll int) (string, []TabHitZone, int) {
	type tabEntry struct {
		rendered string
		width    int
		startX   int // logical X before scrolling
		idx      int
		procID   string
	}

	var entries []tabEntry
	logicalX := 0
	currentStart := 0
	currentEnd := 0
	for i, tab := range tabs {
		num := fmt.Sprintf("%d", i+1)

		isCurrent := tab.ID == currentID

		// State indicator
		indicator := ""
		switch tab.State {
		case model.ProcessRunning:
			indicator = "▶"
		case model.ProcessExited, model.ProcessFailed:
			indicator = "■"
		}

		label := num + ":" + tab.ID
		if indicator != "" {
			label = indicator + " " + label
		}

		var rendered string
		if isCurrent {
			switch focus {
			case TabFocusInput, TabFocusLog:
				rendered = tabInputStyle.Render(label)
			case TabFocusBar:
				rendered = tabSelectedStyle.Render(label)
			default:
				rendered = tabCurrentStyle.Render(label)
			}
		} else {
			rendered = tabOtherStyle.Render(label)
		}

		w := lipgloss.Width(rendered)
		entries = append(entries, tabEntry{
			rendered: rendered, width: w, startX: logicalX,
			idx: i, procID: tab.ID,
		})
		if isCurrent {
			currentStart = logicalX
			currentEnd = logicalX + w
		}
		logicalX += w
	}

	totalWidth := logicalX
	availableWidth := width - 2 // reserve 2 chars for scroll indicators

	// Auto-scroll to keep the current tab visible
	if currentStart < hScroll {
		hScroll = currentStart
	}
	if currentEnd > hScroll+availableWidth {
		hScroll = currentEnd - availableWidth
	}
	if hScroll < 0 {
		hScroll = 0
	}

	// Collect visible tabs
	var visibleParts []string
	var hitZones []TabHitZone
	for _, e := range entries {
		eEnd := e.startX + e.width
		if eEnd <= hScroll {
			continue
		}
		if e.startX-hScroll >= availableWidth {
			break
		}
		screenX := 1 + (e.startX - hScroll) // +1 for left scroll indicator
		visibleParts = append(visibleParts, e.rendered)
		hitZones = append(hitZones, TabHitZone{
			X: screenX, Width: e.width, TabIdx: e.idx, ProcID: e.procID,
		})
	}

	// Scroll indicators
	leftInd := " "
	rightInd := " "
	if hScroll > 0 {
		leftInd = "◂"
	}
	if totalWidth-hScroll > availableWidth {
		rightInd = "▸"
	}

	return leftInd + strings.Join(visibleParts, "") + rightInd, hitZones, hScroll
}

func (lp *LogPanel) View(tabs []LogTab, focus TabFocus) string {
	if !lp.ready {
		return ""
	}

	tabBar, _, _ := RenderTabBar(tabs, lp.processID, focus, lp.width, 0)

	// Scroll indicator
	scrollIndicator := ""
	if !lp.autoScroll {
		scrollIndicator = lipgloss.NewStyle().
			Foreground(colorWarning).
			Render(" ▲ scroll-locked (press G for bottom)")
	}

	return tabBar + "\n" + lp.viewport.View() + scrollIndicator
}

// ViewContent renders just the viewport content (scrollable area),
// without the tab bar (which is rendered separately by the app).
func (lp *LogPanel) ViewContent() string {
	if !lp.ready {
		return ""
	}

	var b strings.Builder

	// Search bar
	if lp.logSearching {
		prefix := lipgloss.NewStyle().Bold(true).Reverse(true).Padding(0, 1).Render("Search")
		b.WriteString(prefix + " " + lp.logSearchInput.View() + "\n")
	} else if lp.logSearchQuery != "" {
		prefix := lipgloss.NewStyle().Bold(true).Foreground(colorPrimary).Padding(0, 1).Render("Search")
		b.WriteString(prefix + " " + lp.logSearchQuery + "\n")
	}

	// Log level badge (when not ALL)
	if lp.logLevel > 0 {
		badge := lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("3")).Render("[" + logLevelNames[lp.logLevel] + "+]")
		if lp.logSearching || lp.logSearchQuery != "" {
			// Append to search line — rewind the newline
			s := b.String()
			if strings.HasSuffix(s, "\n") {
				b.Reset()
				b.WriteString(s[:len(s)-1] + " " + badge + "\n")
			}
		} else {
			b.WriteString(badge + "\n")
		}
	}

	b.WriteString(lp.viewport.View())

	if !lp.autoScroll {
		b.WriteString(lipgloss.NewStyle().
			Foreground(colorWarning).
			Render(" ▲ scroll-locked (press G for bottom)"))
	}

	return b.String()
}

// InitSearchInput creates the search text input model.
func (lp *LogPanel) InitSearchInput() {
	si := textinput.New()
	si.Placeholder = ""
	si.CharLimit = 128
	si.Prompt = ""
	si.Focus()
	lp.logSearchInput = si
	lp.logSearching = true
}

// SetSearchQuery updates the search filter and re-applies filters.
func (lp *LogPanel) SetSearchQuery(query string) {
	lp.logSearchQuery = query
	lp.lastContent = "" // force re-filter
	lp.applyFilters()
}
