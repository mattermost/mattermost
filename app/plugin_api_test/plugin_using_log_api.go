// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package main

import (
	"github.com/mattermost/mattermost-server/plugin"
)

type PluginUsingLogAPI struct {
	plugin.MattermostPlugin
}

type Foo struct {
	bar float64
}

func main() {
	plugin.ClientMain(&PluginUsingLogAPI{})
}

func (p *PluginUsingLogAPI) OnActivate() error {
	p.API.LogDebug("LogDebug", "one", 1, "two", "two", "foo", Foo{bar: 3.1416})
	p.API.LogInfo("LogInfo", "one", 1, "two", "two", "foo", Foo{bar: 3.1416})
	p.API.LogWarn("LogWarn", "one", 1, "two", "two", "foo", Foo{bar: 3.1416})
	p.API.LogError("LogError", "one", 1, "two", "two", "foo", Foo{bar: 3.1416})
	return nil
}
