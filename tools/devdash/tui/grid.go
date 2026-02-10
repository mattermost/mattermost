package tui

import (
	"sort"
	"strings"

	"github.com/charmbracelet/lipgloss"

	"github.com/mattermost/mattermost/tools/devdash/discovery"
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

// TabHitZone tracks where a tab was rendered for mouse click detection.
type TabHitZone struct {
	X, Width int
	TabIdx   int
	ProcID   string
}

// GridCell represents one target/script in the grid.
type GridCell struct {
	Label    string
	IsNpm    bool
	Target   string // actual target/script name
	IsSep    bool   // separator between favorites and the rest
	Category model.TargetCategory
}

// repoColWidth is computed dynamically per render based on the longest repo name.
// The constant is kept as a minimum width.
const repoColWidthMin = 14

// cellID returns a unique key for a cell within a repo.
// Uses "repo:npm:name" for npm scripts, "repo:name" for make targets.
func cellID(repoName string, c GridCell) string {
	if c.IsNpm {
		return repoName + ":npm:" + c.Target
	}
	return repoName + ":" + c.Target
}

func buildGridCells(repo *model.Repo) []GridCell {
	var cells []GridCell

	// Make targets
	for _, t := range repo.MakeTargets {
		cells = append(cells, GridCell{
			Label:    t.Name,
			IsNpm:    false,
			Target:   t.Name,
			Category: t.Category,
		})
	}

	// npm run scripts — labeled "run:<name>", categorized like make targets
	scriptNames := make(map[string]bool)
	for _, s := range repo.NpmScripts {
		scriptNames[s.Name] = true
		cells = append(cells, GridCell{
			Label:    "run:" + s.Name,
			IsNpm:    true,
			Target:   s.Name,
			Category: discovery.ClassifyTarget(s.Name),
		})
	}

	// Built-in npm commands — labeled "npm:<cmd>"
	if repo.PackageJSON != "" {
		for _, cmd := range []string{"install", "ci", "start", "test", "build"} {
			if scriptNames[cmd] {
				continue
			}
			cells = append(cells, GridCell{
				Label:    "npm:" + cmd,
				IsNpm:    true,
				Target:   cmd,
				Category: discovery.ClassifyTarget(cmd),
			})
		}
	}

	// Sort all cells together by category
	sort.SliceStable(cells, func(i, j int) bool {
		return cells[i].Category < cells[j].Category
	})

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

func renderGridRow(repo *model.Repo, cells []GridCell, cursorCol int, isActiveRow bool, width int, hScroll int, procStateFn func(string) model.ProcessState, favorites map[string]bool, hitZones *[]HitZone, rowY int, repoIdx int, focusedProc string, logFocusActive bool, repoColWidth int) string {
	// Repo name column (fixed width, never scrolls)
	nameStyle := repoNameStyle.Width(repoColWidth).MaxWidth(repoColWidth)
	activeStyle := repoNameActiveStyle.Width(repoColWidth).MaxWidth(repoColWidth)
	selectedStyle := lipgloss.NewStyle().Bold(true).Reverse(true).Width(repoColWidth).MaxWidth(repoColWidth)

	var nameRendered string
	if isActiveRow && cursorCol == -1 && !logFocusActive {
		nameRendered = selectedStyle.Render("▸ " + repo.Name)
	} else if isActiveRow && !logFocusActive {
		nameRendered = activeStyle.Render("▸ " + repo.Name)
	} else {
		nameRendered = nameStyle.Render("  " + repo.Name)
	}

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

		procID := repo.Name + ":" + cell.Target
		state := procStateFn(procID)

		// Combined state + log-focus indicator
		label := cell.Label
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

		isFav := favorites[cellID(repo.Name, cell)]
		isGridSelected := isActiveRow && i == cursorCol && !logFocusActive
		isLogTarget := isFocused && logFocusActive

		style := chipColorStyle(cell, isFav, isGridSelected, isLogTarget)

		rendered := style.Render(label)
		w := lipgloss.Width(rendered)
		chips[i] = chipInfo{rendered: rendered, width: w, startX: logicalX}
		logicalX += w
	}

	totalChipsWidth := logicalX
	nameRenderedWidth := lipgloss.Width(nameRendered)
	availableWidth := width - nameRenderedWidth

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
func chipColorStyle(cell GridCell, isFav, isGridSelected, isLogTarget bool) lipgloss.Style {
	// Grid-focused selection: the ONE highlight
	if isGridSelected {
		return chipSelectedStyle
	}

	// Log-focused target: double underline, no highlight
	if isLogTarget {
		base := chipLogTargetStyle
		fg := cellForeground(cell)
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

	fg := cellForeground(cell)
	if fg != nil {
		return base.Foreground(fg)
	}
	return base
}

// cellForeground returns the category color for a cell, or nil for default.
func cellForeground(cell GridCell) lipgloss.TerminalColor {
	if c, ok := categoryColors[int(cell.Category)]; ok {
		return c
	}
	return nil
}

func renderSeparator(_ int) string {
	return ""
}

func renderGrid(repos []model.Repo, cursorRow, cursorCol int, width, maxLines, skipRows int, hScrolls []int, favorites map[string]bool, searchQuery string, procStateFn func(string) model.ProcessState, focusedProc string, logFocusActive bool, showOnlyFavorites bool) (string, []HitZone) {
	var b strings.Builder
	var hitZones []HitZone

	// Compute column width from the longest visible repo name
	// "▸ " prefix = 2 chars, plus 2 chars spacing after
	repoColWidth := repoColWidthMin
	for _, repo := range repos {
		cells := filteredCells(repo, favorites, searchQuery, showOnlyFavorites)
		if len(cells) == 0 {
			continue
		}
		w := len(repo.Name) + 4 // "▸ " + name + "  "
		if w > repoColWidth {
			repoColWidth = w
		}
	}
	// Cap so chips still have room
	maxNameCol := width / 3
	if repoColWidth > maxNameCol {
		repoColWidth = maxNameCol
	}

	rowY := 0
	lineCount := 0
	visibleIdx := 0 // count of visible repo rows encountered
	prevKind := model.RepoKind(-1)
	for i, repo := range repos {
		if maxLines > 0 && lineCount >= maxLines {
			break
		}

		cells := filteredCells(repo, favorites, searchQuery, showOnlyFavorites)

		// Skip repos with no matching targets
		if len(cells) == 0 {
			continue
		}

		// Skip rows before the scroll offset
		if visibleIdx < skipRows {
			visibleIdx++
			prevKind = repo.Kind
			continue
		}

		// Separator between repo kind groups (only before a visible row)
		if prevKind >= 0 && repo.Kind != prevKind {
			if maxLines > 0 && lineCount >= maxLines {
				break
			}
			b.WriteString(renderSeparator(width))
			b.WriteString("\n")
			rowY++
			lineCount++
		}

		if maxLines > 0 && lineCount >= maxLines {
			break
		}

		col := -1
		if i == cursorRow {
			col = cursorCol
		}

		hScroll := 0
		if i < len(hScrolls) {
			hScroll = hScrolls[i]
		}

		line := renderGridRow(&repo, cells, col, i == cursorRow, width, hScroll, procStateFn, favorites, &hitZones, rowY, i, focusedProc, logFocusActive, repoColWidth)
		b.WriteString(line)
		b.WriteString("\n")
		rowY++
		lineCount++
		visibleIdx++
		prevKind = repo.Kind
	}

	return b.String(), hitZones
}

// filteredCells returns the grid cells for a repo after applying search and favorites filters.
func filteredCells(repo model.Repo, favorites map[string]bool, searchQuery string, showOnlyFavorites bool) []GridCell {
	cells := buildGridCells(&repo)
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
	if showOnlyFavorites {
		var filtered []GridCell
		for _, c := range cells {
			if favorites[cellID(repo.Name, c)] {
				filtered = append(filtered, c)
			}
		}
		cells = filtered
	}
	return cells
}
