package pluginapi

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
)

// FrontendService exposes methods to interact with the frontend.
type FrontendService struct {
	api plugin.API
}

// OpenInteractiveDialog will open an interactive dialog on a user's client that
// generated the trigger ID. Used with interactive message buttons, menus
// and slash commands.
//
// Minimum server version: 5.6
func (f *FrontendService) OpenInteractiveDialog(dialog model.OpenDialogRequest) error {
	return normalizeAppErr(f.api.OpenInteractiveDialog(dialog))
}

// PublishWebSocketEvent sends an event to WebSocket connections.
// event is the type and will be prepended with "custom_<pluginid>_".
// payload is the data sent with the event. Interface values must be primitive Go types or mattermost-server/model types.
// broadcast determines to which users to send the event.
//
// Minimum server version: 5.2
func (f *FrontendService) PublishWebSocketEvent(event string, payload map[string]interface{}, broadcast *model.WebsocketBroadcast) {
	f.api.PublishWebSocketEvent(event, payload, broadcast)
}
