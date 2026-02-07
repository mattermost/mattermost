package tui

import (
	"time"

	"github.com/mattermost/mattermost/tools/devdash/process"
)

// Re-export process messages so the TUI can handle them
type ProcessOutputMsg = process.OutputMsg
type ProcessExitMsg = process.ExitMsg

// TickMsg for periodic refresh (elapsed timers)
type TickMsg time.Time

func tickCmd() func() TickMsg {
	return func() TickMsg {
		return TickMsg(time.Now())
	}
}
