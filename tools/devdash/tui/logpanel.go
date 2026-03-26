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

// Regex to strip ANSI escape codes for level matching
var ansiRe = regexp.MustCompile(`\x1b\[[0-9;]*m`)

// Plain text: level appears at or near the start of line (possibly after ANSI codes)
var plainLevelRe = regexp.MustCompile(`(?i)^(panic|fatal|critical|error|warn|info|debug|trace)\b`)

// JSON: "level":"<value>" anywhere in the line
var jsonLevelRe = regexp.MustCompile(`(?i)"level"\s*:\s*"(panic|fatal|critical|error|warn|info|debug|trace)"`)

var levelOrder = map[string]int{
	"trace": 0, "debug": 1, "info": 2, "warn": 3,
	"error": 4, "critical": 4, "fatal": 4, "panic": 4,
}

// LogTab holds info for rendering a single tab in the log panel header.
type LogTab struct {
	ID    string
	State model.ProcessState
}

type LogPanel struct {
	viewport   viewport.Model
	processID  string
	inputting  bool // true when raw keystrokes are forwarded to process via tmux
	autoScroll bool
	width      int
	height     int
	ready      bool

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
	lp.logSearching = false
	lp.logSearchQuery = ""
	lp.logLevel = 0
}

// UpdateContent sets the log panel content from a captured tmux pane string.
// Applies active filters (log level + search) before setting viewport content.
func (lp *LogPanel) UpdateContent(content string) {
	if !lp.ready {
		return
	}
	filtered := lp.filterContent(content)
	lp.viewport.SetContent(filtered)

	if lp.autoScroll {
		lp.viewport.GotoBottom()
	}
}

// detectLevel extracts the log level from a line, handling:
// - Plain text with ANSI codes: "\033[31merror\033[0m some message"
// - Plain text without codes: "error some message" or "error  some message"
// - JSON format: {"level":"error","msg":"..."}
// Returns the level string (lowercase) and true, or ("", false) if no level detected.
func detectLevel(line string) (string, bool) {
	// Try JSON format first
	if m := jsonLevelRe.FindStringSubmatch(line); m != nil {
		return strings.ToLower(m[1]), true
	}

	// Strip ANSI codes and leading whitespace for plain text matching
	stripped := ansiRe.ReplaceAllString(line, "")
	stripped = strings.TrimSpace(stripped)
	if m := plainLevelRe.FindStringSubmatch(stripped); m != nil {
		return strings.ToLower(m[1]), true
	}

	return "", false
}

// filterContent applies log level and search filters to raw content.
// Continuation lines (stack traces, indented lines) inherit the level
// of the preceding log line so they get filtered together.
func (lp *LogPanel) filterContent(raw string) string {
	if lp.logLevel == 0 && lp.logSearchQuery == "" {
		return raw
	}

	lines := strings.Split(raw, "\n")
	var result []string
	query := strings.ToLower(lp.logSearchQuery)
	lastLogLineVisible := true // tracks whether the last log-level line passed the filter

	for _, line := range lines {
		// Log level filter
		if lp.logLevel > 0 {
			if level, ok := detectLevel(line); ok {
				// This is a log line with a detectable level
				lvl := levelOrder[level]
				if lvl < lp.logLevel {
					lastLogLineVisible = false
					continue
				}
				lastLogLineVisible = true
			} else {
				// Continuation line (stack trace, indented text, blank) —
				// inherit visibility from the last log line
				if !lastLogLineVisible {
					continue
				}
			}
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

// SetSearchQuery updates the search filter. Next poll tick will apply it.
func (lp *LogPanel) SetSearchQuery(query string) {
	lp.logSearchQuery = query
}
