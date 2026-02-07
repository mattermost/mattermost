package tui

import (
	"strings"

	"github.com/charmbracelet/lipgloss"
)

var (
	// Colors
	colorPrimary = lipgloss.Color("62")  // purple
	colorWarning = lipgloss.Color("3")   // yellow
	colorMuted   = lipgloss.Color("241")

	// Category colors for target chips (keyed by TargetCategory iota)
	categoryColors = map[int]lipgloss.Color{
		0: lipgloss.Color("5"),   // Deploy = magenta
		1: lipgloss.Color("2"),   // Run = green
		2: lipgloss.Color("6"),   // Lint = cyan
		3: lipgloss.Color("3"),   // Test = yellow
		4: lipgloss.Color("4"),   // Build = blue
		5: lipgloss.Color("240"), // Clean = gray
		6: lipgloss.Color("240"), // Other = gray
	}

	// Header
	headerStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("15")).
			Background(colorPrimary).
			Padding(0, 1)

	// Repo name in grid
	repoNameStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("15")).
			Width(14)

	repoNameActiveStyle = lipgloss.NewStyle().
				Bold(true).
				Foreground(colorPrimary).
				Width(14)

	// Target chip (base)
	chipStyle = lipgloss.NewStyle().
			Padding(0, 1).
			MarginRight(1)

	// The ONE highlight: grid-focused selected chip
	chipSelectedStyle = lipgloss.NewStyle().
				Padding(0, 1).
				MarginRight(1).
				Bold(true).
				Reverse(true)

	// Favorite chip (bold + underline)
	chipFavoriteStyle = lipgloss.NewStyle().
				Padding(0, 1).
				MarginRight(1).
				Bold(true).
				Underline(true)

	// Log-target chip in grid: underline + primary color, distinct from highlight
	chipLogTargetStyle = lipgloss.NewStyle().
				Padding(0, 1).
				MarginRight(1).
				Bold(true).
				Underline(true).
				Foreground(colorPrimary)

	// Separator
	separatorStyle = lipgloss.NewStyle().
			Foreground(colorMuted)

	// Legend style
	legendStyle = lipgloss.NewStyle().Foreground(colorMuted)
)

// RenderLegend returns a compact color key for the status bar.
func RenderLegend() string {
	type entry struct {
		cat  int
		name string
	}
	entries := []entry{
		{0, "Deploy"},
		{1, "Run"},
		{2, "Lint"},
		{3, "Test"},
		{4, "Build"},
		{5, "Other"},
	}
	var parts []string
	for _, e := range entries {
		c := categoryColors[e.cat]
		dot := lipgloss.NewStyle().Foreground(c).Render("●")
		parts = append(parts, dot+legendStyle.Render(e.name))
	}
	npmDot := lipgloss.NewStyle().Foreground(lipgloss.Color("214")).Render("●")
	parts = append(parts, npmDot+legendStyle.Render("npm"))
	return strings.Join(parts, " ")
}
