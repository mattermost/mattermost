// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"github.com/hashicorp/go-plugin"
)

// Starts the serving of a Mattermost plugin over net/rpc. gRPC is not yet supported.
//
// Call this when your plugin is ready to start.
func ClientMain(pluginImplementation interface{}) {
	if impl, ok := pluginImplementation.(interface {
		SetAPI(api API)
		SetSelfRef(ref interface{})
	}); !ok {
		panic("Plugin implementation given must embed plugin.MattermostPlugin")
	} else {
		impl.SetAPI(nil)
		impl.SetSelfRef(pluginImplementation)
	}

	pluginMap := map[string]plugin.Plugin{
		"hooks": &hooksPlugin{hooks: pluginImplementation},
	}

	plugin.Serve(&plugin.ServeConfig{
		HandshakeConfig: handshake,
		Plugins:         pluginMap,
	})
}

type MattermostPlugin struct {
	// API exposes the plugin api, and becomes available just prior to the OnActive hook.
	API API

	selfRef interface{} // This is so we can unmarshal into our parent
}

// SetAPI persists the given API interface to the plugin. It is invoked just prior to the
// OnActivate hook, exposing the API for use by the plugin.
func (p *MattermostPlugin) SetAPI(api API) {
	p.API = api
}

// SetSelfRef is called by ClientMain to maintain a pointer to the plugin interface originally
// registered. This allows for the default implementation of OnConfigurationChange.
func (p *MattermostPlugin) SetSelfRef(ref interface{}) {
	p.selfRef = ref
}

// OnConfigurationChange provides a default implementation of this hook event that unmarshals the
// plugin configuration directly onto the plugin struct.
//
// Feel free to implement your own version of OnConfigurationChange if you need more advanced
// configuration handling.
func (p *MattermostPlugin) OnConfigurationChange() error {
	if p.selfRef != nil {
		return p.API.LoadPluginConfiguration(p.selfRef)
	}
	return nil
}
