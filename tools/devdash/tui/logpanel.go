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
	viewport   viewport.Model
	processID  string
	inputting  bool // true when raw keystrokes are forwarded to process via tmux
	autoScroll bool
	width      int
	height     int
	ready      bool
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
}

// UpdateContent sets the log panel content from a captured tmux pane string.
func (lp *LogPanel) UpdateContent(content string) {
	if !lp.ready {
		return
	}

	lp.viewport.SetContent(content)

	if lp.autoScroll {
		lp.viewport.GotoBottom()
	}
}

var (
	// Tab styles: only the focused tab gets the highlight
	tabFocusedStyle = lipgloss.NewStyle().
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
)

// RenderTabBar renders the numbered process tabs without the viewport.
// When inputting is true, the current tab gets an "Input (Esc to exit)" suffix.
func RenderTabBar(tabs []LogTab, currentID string, isFocused, inputting bool) string {
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

		isCurrent := tab.ID == currentID

		// Append input mode suffix to the focused tab
		if isCurrent && inputting {
			label += " — Input (Esc to exit)"
		}

		if isCurrent {
			if isFocused {
				tabParts = append(tabParts, tabFocusedStyle.Render(label))
			} else {
				tabParts = append(tabParts, tabCurrentStyle.Render(label))
			}
		} else {
			tabParts = append(tabParts, tabOtherStyle.Render(label))
		}
	}
	return strings.Join(tabParts, "")
}

func (lp *LogPanel) View(tabs []LogTab, isFocused bool) string {
	if !lp.ready {
		return ""
	}

	tabBar := RenderTabBar(tabs, lp.processID, isFocused, lp.inputting)

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
