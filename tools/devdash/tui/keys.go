package tui

import "github.com/charmbracelet/bubbles/key"

type KeyMap struct {
	Up            key.Binding
	Down          key.Binding
	Left          key.Binding
	Right         key.Binding
	Execute       key.Binding
	ToggleLog     key.Binding
	Stop          key.Binding
	Restart       key.Binding
	Search        key.Binding
	Help          key.Binding
	Quit          key.Binding
	StopAll       key.Binding
	Rescan        key.Binding
	TabNext       key.Binding
	TabPrev       key.Binding
	Escape        key.Binding
	Favorite      key.Binding
	FocusProc     key.Binding
	DryRun        key.Binding
	ProcInput key.Binding
	FavsOnly  key.Binding
	Dismiss       key.Binding
	PageUp        key.Binding
	PageDown      key.Binding
}

func DefaultKeyMap() KeyMap {
	return KeyMap{
		Up:            key.NewBinding(key.WithKeys("up", "k")),
		Down:          key.NewBinding(key.WithKeys("down", "j")),
		Left:          key.NewBinding(key.WithKeys("left", "h")),
		Right:         key.NewBinding(key.WithKeys("right", "l")),
		Execute:       key.NewBinding(key.WithKeys("enter")),
		ToggleLog:     key.NewBinding(key.WithKeys("L")),
		Stop:          key.NewBinding(key.WithKeys("s")),
		Restart:       key.NewBinding(key.WithKeys("r")),
		Search:        key.NewBinding(key.WithKeys("/", "f")),
		Help:          key.NewBinding(key.WithKeys("?", "f1")),
		Quit:          key.NewBinding(key.WithKeys("q", "ctrl+c")),
		StopAll:       key.NewBinding(key.WithKeys("ctrl+x")),
		Rescan:        key.NewBinding(key.WithKeys("ctrl+r")),
		TabNext:       key.NewBinding(key.WithKeys("tab")),
		TabPrev:       key.NewBinding(key.WithKeys("shift+tab")),
		Escape:        key.NewBinding(key.WithKeys("esc")),
		Favorite:      key.NewBinding(key.WithKeys("F")),
		FocusProc:     key.NewBinding(key.WithKeys(" ")),
		DryRun:        key.NewBinding(key.WithKeys("d")),
		ProcInput: key.NewBinding(key.WithKeys("i")),
		FavsOnly:  key.NewBinding(key.WithKeys("ctrl+f")),
		Dismiss:       key.NewBinding(key.WithKeys("x")),
		PageUp:        key.NewBinding(key.WithKeys("pgup", "shift+up")),
		PageDown:      key.NewBinding(key.WithKeys("pgdown", "shift+down")),
	}
}
