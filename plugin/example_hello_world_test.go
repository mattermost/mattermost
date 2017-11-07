package plugin_test

import (
	"fmt"
	"net/http"

	"github.com/mattermost/mattermost-server/plugin/rpcplugin"
)

type HelloWorldPlugin struct{}

func (p *HelloWorldPlugin) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintf(w, "Hello, world!")
}

// This example demonstrates a plugin that handles HTTP requests which respond by greeting the
// world.
func Example_helloWorld() {
	rpcplugin.Main(&HelloWorldPlugin{})
}
