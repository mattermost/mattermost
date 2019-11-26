package pluginapi

import (
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/v5/plugin"
)

// CommandService exposes methods to read and write the groups of a Mattermost server.
type CommandService struct {
	api plugin.API
}

// Register registers a custom slash command. When the command is triggered, your plugin
// can fulfill it via the ExecuteCommand hook.
//
// Minimum server version: 5.2
func (c *CommandService) Register(command *model.Command) error {
	return c.api.RegisterCommand(command)
}

// Unregister unregisters a command previously registered via Register.
//
// Minimum server version: 5.2
func (c *CommandService) Unregister(teamID, trigger string) error {
	return c.api.UnregisterCommand(teamID, trigger)
}
