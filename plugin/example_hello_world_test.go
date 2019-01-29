package plugin_test

import (
	"fmt"
	"net/http"

	"github.com/mattermost/mattermost-server/plugin"
)

type HelloWorldPlugin struct {
	plugin.MattermostPlugin
}

func (p *HelloWorldPlugin) ServeHTTP(c *plugin.Context, w http.ResponseWriter, r *http.Request) {
	fmt.Fprint(w, "Hello, world!")
}

// This example demonstrates a plugin that handles HTTP requests which respond by greeting the
// world.
func Example_helloWorld() {
	plugin.ClientMain(&HelloWorldPlugin{})
}
