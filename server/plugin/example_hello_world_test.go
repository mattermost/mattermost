// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin_test

import (
	"fmt"
	"net/http"

	"github.com/mattermost/mattermost-server/server/v8/plugin"
)

// HelloWorldPlugin implements the interface expected by the Mattermost server to communicate
// between the server and plugin processes.
type HelloWorldPlugin struct {
	plugin.MattermostPlugin
}

// ServeHTTP demonstrates a plugin that handles HTTP requests by greeting the world.
func (p *HelloWorldPlugin) ServeHTTP(c *plugin.Context, w http.ResponseWriter, r *http.Request) {
	fmt.Fprint(w, "Hello, world!")
}

// This example demonstrates a plugin that handles HTTP requests which respond by greeting the
// world.
func Example_helloWorld() {
	plugin.ClientMain(&HelloWorldPlugin{})
}
