package pluginapi

import (
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin"
)

// SlashCommandService exposes methods to manipulate slash commands.
type SlashCommandService struct {
	api plugin.API
}

// Register registers a custom slash command. When the command is triggered, your plugin
// can fulfill it via the ExecuteCommand hook.
//
// Minimum server version: 5.2
func (c *SlashCommandService) Register(command *model.Command) error {
	return c.api.RegisterCommand(command)
}

// Unregister unregisters a command previously registered via Register.
//
// Minimum server version: 5.2
func (c *SlashCommandService) Unregister(teamID, trigger string) error {
	return c.api.UnregisterCommand(teamID, trigger)
}

// ExecuteSlashCommand executes a slash command.
//
// Minimum server version: 5.26
func (c *SlashCommandService) ExecuteSlashCommand(command *model.CommandArgs) (*model.CommandResponse, error) {
	return c.api.ExecuteSlashCommand(command)
}
