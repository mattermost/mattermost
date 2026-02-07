package tui

import (
	"time"

	"github.com/mattermost/mattermost/tools/devdash/process"
)

// Re-export process exit message so the TUI can handle it
type ProcessExitMsg = process.ExitMsg

// TickMsg for periodic refresh (capture-pane polling, elapsed timers)
type TickMsg time.Time

func tickCmd() func() TickMsg {
	return func() TickMsg {
		return TickMsg(time.Now())
	}
}
