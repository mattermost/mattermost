package tui

import (
	"fmt"
	"sort"
	"strings"

	"github.com/charmbracelet/lipgloss"

	"github.com/mattermost/mattermost/tools/devdash/model"
)

// HitZone tracks where a clickable element was rendered on screen.
type HitZone struct {
	X, Y          int
	Width, Height int
	RepoIdx       int
	TargetIdx     int // -1 means the repo name itself
	IsNpm         bool
}

// GridCell represents one target/script in the grid.
type GridCell struct {
	Label     string
	IsNpm     bool
	Target    string // actual target/script name
	IsSep     bool   // separator between favorites and the rest
}

const repoColWidth = 16

// cellID returns a unique key for a cell within a repo.
// Uses "repo:npm:name" for npm scripts, "repo:name" for make targets.
func cellID(repoName string, c GridCell) string {
	if c.IsNpm {
		return repoName + ":npm:" + c.Target
	}
	return repoName + ":" + c.Target
}

func buildGridCells(repo *model.Repo) []GridCell {
	// Sort make targets by category (Run, Deploy, Lint, Test, Build, Clean, Other)
	sorted := make([]model.Target, len(repo.MakeTargets))
	copy(sorted, repo.MakeTargets)
	sort.SliceStable(sorted, func(i, j int) bool {
		return sorted[i].Category < sorted[j].Category
	})

	var cells []GridCell
	for _, t := range sorted {
		cells = append(cells, GridCell{
			Label:  t.Name,
			IsNpm:  false,
			Target: t.Name,
		})
	}
	for _, s := range repo.NpmScripts {
		cells = append(cells, GridCell{
			Label:  "npm:" + s.Name,
			IsNpm:  true,
			Target: s.Name,
		})
	}
	return cells
}

// reorderWithFavorites puts favorited cells first, adds a separator, then the rest.
// Returns reordered cells and a mapping from new index to original index.
func reorderWithFavorites(repoName string, cells []GridCell, favorites map[string]bool) ([]GridCell, []int) {
	var favCells, otherCells []GridCell
	var favIdx, otherIdx []int

	for i, c := range cells {
		id := cellID(repoName, c)
		if favorites[id] {
			favCells = append(favCells, c)
			favIdx = append(favIdx, i)
		} else {
			otherCells = append(otherCells, c)
			otherIdx = append(otherIdx, i)
		}
	}

	if len(favCells) == 0 {
		// No favorites — return original order, identity mapping
		idx := make([]int, len(cells))
		for i := range idx {
			idx[i] = i
		}
		return cells, idx
	}

	var result []GridCell
	var mapping []int
	result = append(result, favCells...)
	mapping = append(mapping, favIdx...)

	// Add separator
	result = append(result, GridCell{Label: "│", IsSep: true})
	mapping = append(mapping, -1)

	result = append(result, otherCells...)
	mapping = append(mapping, otherIdx...)

	return result, mapping
}

// chipInfo holds the pre-rendered chip and its logical width.
type chipInfo struct {
	rendered string
	width    int
	startX   int // x position in the full (unclipped) row
}

func renderGridRow(repo *model.Repo, cells []GridCell, cursorCol int, isActiveRow bool, width int, hScroll int, procStateFn func(string) model.ProcessState, favorites map[string]bool, hitZones *[]HitZone, rowY int, repoIdx int, focusedProc string, logFocusActive bool) string {
	// Repo name column (fixed, never scrolls) — with extra spacing
	nameStr := repo.Name
	if len(nameStr) > 13 {
		nameStr = nameStr[:12] + "~"
	}

	var nameRendered string
	if isActiveRow {
		nameRendered = repoNameActiveStyle.Render("▸ " + nameStr)
	} else {
		nameRendered = repoNameStyle.Render("  " + nameStr)
	}
	nameRendered += "  " // spacing between repo name and chips

	if hitZones != nil {
		*hitZones = append(*hitZones, HitZone{
			X: 0, Y: rowY, Width: repoColWidth, Height: 1,
			RepoIdx: repoIdx, TargetIdx: -1,
		})
	}

	// Reorder: favorites first, separator, then the rest
	displayCells, _ := reorderWithFavorites(repo.Name, cells, favorites)

	// Build all chips with their logical positions
	chips := make([]chipInfo, len(displayCells))
	logicalX := 0
	for i, cell := range displayCells {
		// Separator cell
		if cell.IsSep {
			sepStr := separatorStyle.Render(" │ ")
			w := lipgloss.Width(sepStr)
			chips[i] = chipInfo{rendered: sepStr, width: w, startX: logicalX}
			logicalX += w
			continue
		}

		id := cellID(repo.Name, cell)
		state := procStateFn(id)

		// Combined state + log-focus indicator
		label := cell.Label
		procID := repo.Name + ":" + cell.Target
		isFocused := focusedProc == procID
		switch state {
		case model.ProcessRunning:
			if isFocused {
				label = "▶ " + label // solid = focused
			} else {
				label = "▷ " + label // outline = not focused
			}
		case model.ProcessFailed, model.ProcessExited:
			if isFocused {
				label = "■ " + label // solid = focused
			} else {
				label = "□ " + label // outline = not focused
			}
		}

		isFav := favorites[id]
		isGridSelected := isActiveRow && i == cursorCol && !logFocusActive
		isLogTarget := isFocused && logFocusActive

		style := chipColorStyle(cell, repo, isFav, isGridSelected, isLogTarget)

		rendered := style.Render(label)
		w := lipgloss.Width(rendered)
		chips[i] = chipInfo{rendered: rendered, width: w, startX: logicalX}
		logicalX += w
	}

	totalChipsWidth := logicalX
	availableWidth := width - repoColWidth

	// Determine visible chips based on hScroll offset
	var visibleChips []string
	for i, chip := range chips {
		chipEnd := chip.startX + chip.width
		chipStart := chip.startX

		// Skip chips entirely before the scroll window
		if chipEnd <= hScroll {
			continue
		}
		// Stop if chip starts beyond visible area
		if chipStart-hScroll >= availableWidth {
			break
		}

		visibleChips = append(visibleChips, chip.rendered)

		// Track hit zone at screen position (skip separators)
		if hitZones != nil && !displayCells[i].IsSep {
			hzX := repoColWidth + 3 + (chipStart - hScroll) // +2 spacing +1 indicator
			if hzX < repoColWidth {
				hzX = repoColWidth
			}
			*hitZones = append(*hitZones, HitZone{
				X: hzX, Y: rowY, Width: chip.width, Height: 1,
				RepoIdx: repoIdx, TargetIdx: i, IsNpm: displayCells[i].IsNpm,
			})
		}
	}

	// Scroll indicators
	leftIndicator := " "
	rightIndicator := " "
	if hScroll > 0 {
		leftIndicator = "◂"
	}
	if totalChipsWidth-hScroll > availableWidth {
		rightIndicator = "▸"
	}

	chipsStr := strings.Join(visibleChips, "")

	// Truncate rendered chips to available width (rough safety net)
	rendered := chipsStr
	renderedWidth := lipgloss.Width(rendered)
	if renderedWidth > availableWidth-2 {
		// Trim by character — not perfect with ANSI but good enough
		for renderedWidth > availableWidth-2 && len(rendered) > 0 {
			rendered = rendered[:len(rendered)-1]
			renderedWidth = lipgloss.Width(rendered)
		}
	}

	return nameRendered + leftIndicator + rendered + rightIndicator
}

// chipColorStyle returns the appropriate style for a chip based on state.
func chipColorStyle(cell GridCell, repo *model.Repo, isFav, isGridSelected, isLogTarget bool) lipgloss.Style {
	// Grid-focused selection: the ONE highlight
	if isGridSelected {
		return chipSelectedStyle
	}

	// Log-focused target: double underline, no highlight
	if isLogTarget {
		base := chipLogTargetStyle
		fg := cellForeground(cell, repo)
		if fg != nil {
			base = base.Foreground(fg)
		}
		return base
	}

	// Default: category color, with favorite underline
	base := chipStyle
	if isFav {
		base = chipFavoriteStyle
	}

	fg := cellForeground(cell, repo)
	if fg != nil {
		return base.Foreground(fg)
	}
	return base
}

// cellForeground returns the category/npm color for a cell, or nil for default.
func cellForeground(cell GridCell, repo *model.Repo) lipgloss.TerminalColor {
	if cell.IsNpm {
		return lipgloss.Color("214")
	}
	for _, t := range repo.MakeTargets {
		if t.Name == cell.Target {
			if c, ok := categoryColors[int(t.Category)]; ok {
				return c
			}
			break
		}
	}
	return nil
}

func renderSeparator(width int) string {
	return separatorStyle.Render(strings.Repeat("─ ", width/2))
}

func renderGrid(repos []model.Repo, cursorRow, cursorCol int, width, maxRows int, hScrolls []int, favorites map[string]bool, searchQuery string, procStateFn func(string) model.ProcessState, focusedProc string, logFocusActive bool, showOnlyFavorites bool) (string, []HitZone) {
	var b strings.Builder
	var hitZones []HitZone

	splitIdx := -1
	for i, r := range repos {
		if r.Kind == model.RepoKindPlugin {
			splitIdx = i
			break
		}
	}

	rowY := 0
	rendered := 0
	for i, repo := range repos {
		if maxRows > 0 && rendered >= maxRows {
			b.WriteString(fmt.Sprintf("  ... and %d more repos\n", len(repos)-rendered))
			break
		}

		if i == splitIdx && splitIdx > 0 {
			b.WriteString(renderSeparator(width))
			b.WriteString("\n")
			rowY++
		}

		cells := buildGridCells(&repo)

		// Filter cells by search query
		if searchQuery != "" {
			q := strings.ToLower(searchQuery)
			var filtered []GridCell
			for _, c := range cells {
				if strings.Contains(strings.ToLower(c.Label), q) {
					filtered = append(filtered, c)
				}
			}
			cells = filtered
		}

		// Filter to favorites only
		if showOnlyFavorites {
			var filtered []GridCell
			for _, c := range cells {
				if favorites[cellID(repo.Name, c)] {
					filtered = append(filtered, c)
				}
			}
			cells = filtered
		}

		// Skip repos with no matching targets
		if len(cells) == 0 {
			continue
		}

		col := -1
		if i == cursorRow {
			col = cursorCol
		}

		hScroll := 0
		if i < len(hScrolls) {
			hScroll = hScrolls[i]
		}

		line := renderGridRow(&repo, cells, col, i == cursorRow, width, hScroll, procStateFn, favorites, &hitZones, rowY, i, focusedProc, logFocusActive)
		b.WriteString(line)
		b.WriteString("\n")
		rowY++
		rendered++
	}

	return b.String(), hitZones
}
