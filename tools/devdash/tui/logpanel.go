package tui

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/bubbles/textinput"
	"github.com/charmbracelet/bubbles/viewport"
	"github.com/charmbracelet/lipgloss"

	"github.com/mattermost/mattermost/tools/devdash/model"
	"github.com/mattermost/mattermost/tools/devdash/process"
)

// LogTab holds info for rendering a single tab in the log panel header.
type LogTab struct {
	ID    string
	State model.ProcessState
}

type LogPanel struct {
	viewport    viewport.Model
	searchInput textinput.Model
	processID   string
	logLevel    process.LogLevel
	searching   bool
	inputting   bool // true when raw keystrokes are forwarded to process PTY
	autoScroll  bool
	width       int
	height      int
	ready       bool
}

func NewLogPanel() LogPanel {
	ti := textinput.New()
	ti.Placeholder = ""
	ti.CharLimit = 128
	ti.Prompt = ""

	return LogPanel{
		logLevel:    process.LogLevelAll,
		autoScroll:  true,
		searchInput: ti,
	}
}

func (lp *LogPanel) SetSize(width, height int) {
	lp.width = width
	lp.height = height
	contentHeight := height - 3 // header + search/input + border

	if !lp.ready {
		lp.viewport = viewport.New(width, contentHeight)
		lp.ready = true
	} else {
		lp.viewport.Width = width
		lp.viewport.Height = contentHeight
	}
	lp.searchInput.Width = width - 20
}

func (lp *LogPanel) SetProcess(id string) {
	lp.processID = id
	lp.autoScroll = true
}

func (lp *LogPanel) UpdateContent(proc *process.ManagedProcess) {
	if proc == nil || !lp.ready {
		return
	}

	query := lp.searchInput.Value()
	lines := proc.LogBuffer.Filter(lp.logLevel, query)

	var b strings.Builder
	for _, line := range lines {
		ts := line.Timestamp.Format("15:04:05")
		text := line.Text

		var styled string
		switch line.Level {
		case process.LogLevelError:
			styled = logLineError.Render(fmt.Sprintf("[%s] %s", ts, text))
		case process.LogLevelWarn:
			styled = logLineWarn.Render(fmt.Sprintf("[%s] %s", ts, text))
		case process.LogLevelInfo:
			styled = logLineInfo.Render(fmt.Sprintf("[%s] %s", ts, text))
		case process.LogLevelDebug:
			styled = logLineDebug.Render(fmt.Sprintf("[%s] %s", ts, text))
		default:
			styled = fmt.Sprintf("[%s] %s", ts, text)
		}
		b.WriteString(styled)
		b.WriteString("\n")
	}

	lp.viewport.SetContent(b.String())

	if lp.autoScroll {
		lp.viewport.GotoBottom()
	}
}

var (
	// Tab styles: only the focused tab gets the highlight
	tabFocusedStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("15")).
			Background(colorPrimary).
			Padding(0, 1)

	tabCurrentStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("15")).
			Padding(0, 1)

	tabOtherStyle = lipgloss.NewStyle().
			Foreground(colorMuted).
			Padding(0, 1)
)

func (lp *LogPanel) View(tabs []LogTab, isFocused bool) string {
	if !lp.ready {
		return ""
	}

	// Render numbered tabs
	var tabParts []string
	for i, tab := range tabs {
		num := fmt.Sprintf("%d", i+1)

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

		if tab.ID == lp.processID {
			if isFocused {
				// Log panel has focus — this tab gets the ONE highlight
				tabParts = append(tabParts, tabFocusedStyle.Render(label))
			} else {
				// Grid has focus — current tab is bold but not highlighted
				tabParts = append(tabParts, tabCurrentStyle.Render(label))
			}
		} else {
			tabParts = append(tabParts, tabOtherStyle.Render(label))
		}
	}

	// Level indicator
	levelStr := "ALL"
	switch lp.logLevel {
	case process.LogLevelError:
		levelStr = "ERR"
	case process.LogLevelWarn:
		levelStr = "WARN"
	case process.LogLevelInfo:
		levelStr = "INFO"
	}
	levelPart := legendStyle.Render("  LEVEL:" + levelStr)

	tabBar := strings.Join(tabParts, "") + levelPart

	// Search bar or input mode indicator
	inputBar := ""
	if lp.searching {
		prefix := lipgloss.NewStyle().Bold(true).Reverse(true).Padding(0, 1).Render("Search")
		inputBar = prefix + " " + lp.searchInput.View() + "\n"
	} else if lp.inputting {
		inputBar = lipgloss.NewStyle().
			Bold(true).Foreground(colorWarning).
			Render("  INPUT MODE — keystrokes forwarded to process (Esc to exit)") + "\n"
	}

	// Scroll indicator
	scrollIndicator := ""
	if !lp.autoScroll {
		scrollIndicator = lipgloss.NewStyle().
			Foreground(colorWarning).
			Render(" ▲ scroll-locked (press G for bottom)")
	}

	return tabBar + "\n" + inputBar + lp.viewport.View() + scrollIndicator
}
