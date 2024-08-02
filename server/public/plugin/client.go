// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"context"

	"github.com/hashicorp/go-plugin"
)

const (
	InternalKeyPrefix = "mmi_"
	BotUserKey        = InternalKeyPrefix + "botid"
)

// WithTestContext provides a context typically used to terminate a plugin from a unit test.
func WithTestContext(ctx context.Context) func(*plugin.ServeConfig) error {
	return func(config *plugin.ServeConfig) error {
		if config.Test == nil {
			config.Test = &plugin.ServeTestConfig{}
		}

		config.Test.Context = ctx

		return nil
	}
}

// WithTestReattachConfigCh configures the channel to receive the ReattachConfig used to reattach
// an externally launched plugin instance with the Mattermost server.
func WithTestReattachConfigCh(reattachConfigCh chan<- *plugin.ReattachConfig) func(*plugin.ServeConfig) error {
	return func(config *plugin.ServeConfig) error {
		if config.Test == nil {
			config.Test = &plugin.ServeTestConfig{}
		}

		config.Test.ReattachConfigCh = reattachConfigCh

		return nil
	}
}

// WithTestCloseCh provides a channel that signals when the plugin exits.
func WithTestCloseCh(closeCh chan<- struct{}) func(*plugin.ServeConfig) error {
	return func(config *plugin.ServeConfig) error {
		if config.Test == nil {
			config.Test = &plugin.ServeTestConfig{}
		}

		config.Test.CloseCh = closeCh

		return nil
	}
}

// Starts the serving of a Mattermost plugin over net/rpc. gRPC is not supported.
//
// Call this when your plugin is ready to start. Options allow configuring plugins for testing
// scenarios.
func ClientMain(pluginImplementation any, opts ...func(config *plugin.ServeConfig) error) {
	impl, ok := pluginImplementation.(interface {
		SetAPI(api API)
		SetDriver(driver Driver)
	})
	if !ok {
		panic("Plugin implementation given must embed plugin.MattermostPlugin")
	}
	impl.SetAPI(nil)
	impl.SetDriver(nil)

	pluginMap := map[string]plugin.Plugin{
		"hooks": &hooksPlugin{hooks: pluginImplementation},
	}

	serveConfig := &plugin.ServeConfig{
		HandshakeConfig: handshake,
		Plugins:         pluginMap,
	}

	for _, opt := range opts {
		err := opt(serveConfig)
		if err != nil {
			panic("failed to start serving plugin: " + err.Error())
		}
	}

	plugin.Serve(serveConfig)
}

type MattermostPlugin struct {
	// API exposes the plugin api, and becomes available just prior to the OnActive hook.
	API    API
	Driver Driver
}

// SetAPI persists the given API interface to the plugin. It is invoked just prior to the
// OnActivate hook, exposing the API for use by the plugin.
func (p *MattermostPlugin) SetAPI(api API) {
	p.API = api
}

// SetDriver sets the RPC client implementation to talk with the server.
func (p *MattermostPlugin) SetDriver(driver Driver) {
	p.Driver = driver
}
