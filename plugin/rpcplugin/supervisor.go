package rpcplugin

import (
	"github.com/mattermost/platform/plugin"
	"github.com/mattermost/platform/plugin/pluginenv"
)

// Supervisor implements a plugin.Supervisor that launches the plugin in a separate process and
// communicates via RPCs.
type Supervisor struct {
}

var _ pluginenv.Supervisor = (*Supervisor)(nil)

func (s *Supervisor) Start() error {
	// TODO
	return nil
}

func (s *Supervisor) Stop() error {
	// TODO
	return nil
}

func (s *Supervisor) Dispatcher() plugin.Hooks {
	// TODO
	return nil
}
