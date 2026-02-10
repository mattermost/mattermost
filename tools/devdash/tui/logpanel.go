package tui

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/bubbles/viewport"
	"github.com/charmbracelet/lipgloss"

	"github.com/mattermost/mattermost/tools/devdash/model"
)

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
	historyCache string // cached full scrollback (loaded on first scroll-up)
	historyDirty bool   // true when history needs refresh on next scroll-up
	width        int
	height       int
	ready        bool
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
	lp.historyCache = ""
	lp.historyDirty = true
}

// UpdateContent sets the log panel content from a captured tmux pane string.
// Skips the viewport update if content hasn't changed.
func (lp *LogPanel) UpdateContent(content string) {
	if !lp.ready || content == lp.lastContent {
		return
	}
	lp.lastContent = content

	lp.viewport.SetContent(content)

	if lp.autoScroll {
		lp.viewport.GotoBottom()
	}
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

	scrollIndicator := ""
	if !lp.autoScroll {
		scrollIndicator = lipgloss.NewStyle().
			Foreground(colorWarning).
			Render(" ▲ scroll-locked (press G for bottom)")
	}

	return lp.viewport.View() + scrollIndicator
}
