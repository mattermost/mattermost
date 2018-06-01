// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"github.com/hashicorp/go-plugin"
)

// Starts the serving of a Mattermost plugin over rpc or gRPC
// Call this when your plugin is ready to start
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
		"hooks": &HooksPlugin{hooks: pluginImplementation},
	}

	plugin.Serve(&plugin.ServeConfig{
		HandshakeConfig: Handshake,
		Plugins:         pluginMap,
	})
}

type MattermostPlugin struct {
	API     API
	selfRef interface{} // This is so we can unmarshal into our parent
}

func (p *MattermostPlugin) SetAPI(api API) {
	p.API = api
}

func (p *MattermostPlugin) SetSelfRef(ref interface{}) {
	p.selfRef = ref
}

func (p *MattermostPlugin) OnConfigurationChange() error {
	if p.selfRef != nil {
		return p.API.LoadPluginConfiguration(p.selfRef)
	}
	return nil
}
