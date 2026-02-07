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
func RenderTabBar(tabs []LogTab, currentID string, isFocused bool) string {
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

		if tab.ID == currentID {
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

	tabBar := RenderTabBar(tabs, lp.processID, isFocused)

	// Input mode indicator
	inputBar := ""
	if lp.inputting {
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

// ViewContent renders just the viewport content (input bar + scrollable area),
// without the tab bar (which is rendered separately by the app).
func (lp *LogPanel) ViewContent() string {
	if !lp.ready {
		return ""
	}

	inputBar := ""
	if lp.inputting {
		inputBar = lipgloss.NewStyle().
			Bold(true).Foreground(colorWarning).
			Render("  INPUT MODE — keystrokes forwarded to process (Esc to exit)") + "\n"
	}

	scrollIndicator := ""
	if !lp.autoScroll {
		scrollIndicator = lipgloss.NewStyle().
			Foreground(colorWarning).
			Render(" ▲ scroll-locked (press G for bottom)")
	}

	return inputBar + lp.viewport.View() + scrollIndicator
}
