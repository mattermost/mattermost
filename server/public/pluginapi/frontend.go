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
func (f *FrontendService) PublishWebSocketEvent(event string, payload map[string]any, broadcast *model.WebsocketBroadcast) {
	f.api.PublishWebSocketEvent(event, payload, broadcast)
}

// SendToastMessage sends a toast notification to a specific user or user session.
// The userID parameter specifies the user to send the toast to.
// If connectionID is set, the toast will only be sent to that specific connection.
//
// Minimum server version: 11.5
func (f *FrontendService) SendToastMessage(userID, connectionID, message string, options model.SendToastMessageOptions) error {
	return normalizeAppErr(f.api.SendToastMessage(userID, connectionID, message, options))
}
