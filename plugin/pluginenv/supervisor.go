package pluginenv

import (
	"github.com/mattermost/platform/plugin"
)

// Supervisor provides the interface for an object that controls the execution of a plugin.
type Supervisor interface {
	Start() error
	Stop() error
	Dispatcher() plugin.Hooks
}
