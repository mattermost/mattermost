package rpcplugin

import (
	"github.com/mattermost/platform/plugin"
)

// Supervisor implements a plugin.Supervisor that launches the plugin in a separate process and
// communicates via RPC.
type Supervisor struct {
}

var _ plugin.Supervisor = (*Supervisor)(nil)

func (s *Supervisor) Start() error {
	// TODO
	return nil
}

func (s *Supervisor) Stop() error {
	// TODO
	return nil
}

func (s *Supervisor) Hooks() plugin.Hooks {
	// TODO
	return nil
}

func SupervisorProvider(bundle *plugin.BundleInfo) (plugin.Supervisor, error) {
	return &Supervisor{}, nil
}
