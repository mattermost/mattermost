package tui

import tea "github.com/charmbracelet/bubbletea"

// keyToTmuxArgs translates a bubbletea KeyMsg into tmux send-keys arguments.
// Returns nil if the key cannot be translated.
func keyToTmuxArgs(msg tea.KeyMsg) []string {
	switch msg.Type {
	case tea.KeyRunes:
		// Each rune is sent as a literal character.
		// Use -l flag to send literal string (avoids tmux interpreting special names).
		return []string{"-l", string(msg.Runes)}
	case tea.KeySpace:
		return []string{"Space"}
	case tea.KeyEnter:
		return []string{"Enter"}
	case tea.KeyTab:
		return []string{"Tab"}
	case tea.KeyBackspace:
		return []string{"BSpace"}
	case tea.KeyDelete:
		return []string{"DC"}
	case tea.KeyUp:
		return []string{"Up"}
	case tea.KeyDown:
		return []string{"Down"}
	case tea.KeyRight:
		return []string{"Right"}
	case tea.KeyLeft:
		return []string{"Left"}
	case tea.KeyHome:
		return []string{"Home"}
	case tea.KeyEnd:
		return []string{"End"}
	case tea.KeyPgUp:
		return []string{"PPage"}
	case tea.KeyPgDown:
		return []string{"NPage"}
	case tea.KeyEscape:
		return []string{"Escape"}

	// Ctrl sequences
	case tea.KeyCtrlA:
		return []string{"C-a"}
	case tea.KeyCtrlB:
		return []string{"C-b"}
	case tea.KeyCtrlC:
		return []string{"C-c"}
	case tea.KeyCtrlD:
		return []string{"C-d"}
	case tea.KeyCtrlE:
		return []string{"C-e"}
	case tea.KeyCtrlF:
		return []string{"C-f"}
	case tea.KeyCtrlG:
		return []string{"C-g"}
	case tea.KeyCtrlK:
		return []string{"C-k"}
	case tea.KeyCtrlL:
		return []string{"C-l"}
	case tea.KeyCtrlN:
		return []string{"C-n"}
	case tea.KeyCtrlO:
		return []string{"C-o"}
	case tea.KeyCtrlP:
		return []string{"C-p"}
	case tea.KeyCtrlR:
		return []string{"C-r"}
	case tea.KeyCtrlS:
		return []string{"C-s"}
	case tea.KeyCtrlT:
		return []string{"C-t"}
	case tea.KeyCtrlU:
		return []string{"C-u"}
	case tea.KeyCtrlW:
		return []string{"C-w"}
	case tea.KeyCtrlZ:
		return []string{"C-z"}
	}

	return nil
}
