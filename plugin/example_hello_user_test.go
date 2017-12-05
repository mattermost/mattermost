package plugin_test

import (
	"fmt"
	"net/http"

	"github.com/mattermost/mattermost-server/plugin"
	"github.com/mattermost/mattermost-server/plugin/rpcplugin"
)

type HelloUserPlugin struct {
	api plugin.API
}

func (p *HelloUserPlugin) OnActivate(api plugin.API) error {
	// Just save api for later when we need to look up users.
	p.api = api
	return nil
}

func (p *HelloUserPlugin) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if userId := r.Header.Get("Mattermost-User-Id"); userId == "" {
		// Our visitor is unauthenticated.
		fmt.Fprintf(w, "Hello, stranger!")
	} else if user, err := p.api.GetUser(userId); err == nil {
		// Greet the user by name!
		fmt.Fprintf(w, "Welcome back, %v!", user.Username)
	} else {
		// This won't happen in normal circumstances, but let's just be safe.
		w.WriteHeader(http.StatusInternalServerError)
		fmt.Fprintf(w, err.Error())
	}
}

// This example demonstrates a plugin that handles HTTP requests which respond by greeting the user
// by name.
func Example_helloUser() {
	rpcplugin.Main(&HelloUserPlugin{})
}
