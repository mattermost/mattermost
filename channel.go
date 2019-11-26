package pluginapi

import (
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin"
)

// ChannelService exposes methods to read and write channels and their members in a Mattermost server.
type ChannelService struct {
	api plugin.API
}

// CreateChannel creates a channel.
//
// Minimum server version: 5.2
func (c *ChannelService) CreateChannel(channel *model.Channel) (*model.Channel, error) {
	channel, appErr := c.api.CreateChannel(channel)

	return channel, normalizeAppErr(appErr)
}

// DeleteChannel deletes a channel.
//
// Minimum server version: 5.2
func (c *ChannelService) DeleteChannel(channelID string) error {
	appErr := c.api.DeleteChannel(channelID)

	return normalizeAppErr(appErr)
}

// GetPublicChannelsForTeam gets a list of all channels.
//
// Minimum server version: 5.2
func (c *ChannelService) GetPublicChannelsForTeam(teamID string, page, perPage int) ([]*model.Channel, error) {
	channels, appErr := c.api.GetPublicChannelsForTeam(teamID, page, perPage)

	return channels, normalizeAppErr(appErr)
}

// GetChannel gets a channel.
//
// Minimum server version: 5.2
func (c *ChannelService) GetChannel(channelID string) (*model.Channel, error) {
	channel, appErr := c.api.GetChannel(channelID)

	return channel, normalizeAppErr(appErr)
}

// GetChannelByName gets a channel by its name, given a team id.
//
// Minimum server version: 5.2
func (c *ChannelService) GetChannelByName(teamID, name string, includeDeleted bool) (*model.Channel, error) {
	channel, appErr := c.api.GetChannelByName(teamID, name, includeDeleted)

	return channel, normalizeAppErr(appErr)
}

// GetChannelByNameForTeamName gets a channel by its name, given a team name.
//
// Minimum server version: 5.2
func (c *ChannelService) GetChannelByNameForTeamName(teamName, channelName string, includeDeleted bool) (*model.Channel, error) {
	channel, appErr := c.api.GetChannelByNameForTeamName(teamName, channelName, includeDeleted)

	return channel, normalizeAppErr(appErr)
}

// GetChannelsForTeamForUser gets a list of channels for given user ID in given team ID.
//
// Minimum server version: 5.6
func (c *ChannelService) GetChannelsForTeamForUser(teamID, userID string, includeDeleted bool) ([]*model.Channel, error) {
	channels, appErr := c.api.GetChannelsForTeamForUser(teamID, userID, includeDeleted)

	return channels, normalizeAppErr(appErr)
}

// GetChannelStats gets statistics for a channel.
//
// Minimum server version: 5.6
func (c *ChannelService) GetChannelStats(channelID string) (*model.ChannelStats, error) {
	channelStats, appErr := c.api.GetChannelStats(channelID)

	return channelStats, normalizeAppErr(appErr)
}

// GetDirectChannel gets a direct message channel.
// If the channel does not exist it will create it.
//
// Minimum server version: 5.2
func (c *ChannelService) GetDirectChannel(userID1, userID2 string) (*model.Channel, error) {
	channel, appErr := c.api.GetDirectChannel(userID1, userID2)

	return channel, normalizeAppErr(appErr)
}

// GetGroupChannel gets a group message channel.
// If the channel does not exist it will create it.
//
// Minimum server version: 5.2
func (c *ChannelService) GetGroupChannel(userIDs []string) (*model.Channel, error) {
	channel, appErr := c.api.GetGroupChannel(userIDs)

	return channel, normalizeAppErr(appErr)
}

// UpdateChannel updates a channel.
//
// Minimum server version: 5.2
func (c *ChannelService) UpdateChannel(channel *model.Channel) (*model.Channel, error) {
	channel, appErr := c.api.UpdateChannel(channel)

	return channel, normalizeAppErr(appErr)
}

// SearchChannels returns the channels on a team matching the provided search term.
//
// Minimum server version: 5.6
func (c *ChannelService) SearchChannels(teamID string, term string) ([]*model.Channel, error) {
	channels, appErr := c.api.SearchChannels(teamID, term)

	return channel, normalizeAppErr(appErr)
}

// AddChannelMember joins a user to a channel (as if they joined themselves)
// This means the user will not receive notifications for joining the channel.
//
// Minimum server version: 5.2
func (c *ChannelService) AddChannelMember(channelID, userID string) (*model.ChannelMember, error) {
	channelMember, appErr := c.api.AddChannelMember(channelID, userID)

	return channelMember, normalizeAppErr(appErr)
}

// AddUserToChannel adds a user to a channel as if the specified user had invited them.
// This means the user will receive the regular notifications for being added to the channel.
//
// Minimum server version: 5.18
func (c *ChannelService) AddUserToChannel(channelID, userID, asUserID string) (*model.ChannelMember, error) {
	channelMember, appErr := c.api.AddUserToChannel(channelID, userID, asUserID)

	return channelMember, normalizeAppErr(appErr)
}

// GetChannelMember gets a channel membership for a user.
//
// Minimum server version: 5.2
func (c *ChannelService) GetChannelMember(channelID, userID string) (*model.ChannelMember, error) {
	channelMember, appErr := c.api.GetChannelMember(channelID, userID)

	return channelMember, normalizeAppErr(appErr)
}

// GetChannelMembers gets a channel membership for all users.
//
// Minimum server version: 5.6
func (c *ChannelService) GetChannelMembers(channelID string, page, perPage int) ([]*model.ChannelMember, error) {
	channelMembers, appErr := c.api.GetChannelMembers(channelID, page, perPage)

	return channelMembers, normalizeAppErr(appErr)
}

// GetChannelMembersByIDs gets a channel membership for a particular User
//
// Minimum server version: 5.6
func (c *ChannelService) GetChannelMembersByIDs(channelID string, userIDs []string) ([]*model.ChannelMember, error) {
	channelMembers, appErr := c.api.GetChannelMembersByIDs(channelID, userIDs)

	return channelMembers, normalizeAppErr(appErr)
}

// GetChannelMembersForUser returns all channel memberships on a team for a user.
//
// Minimum server version: 5.10
func (c *ChannelService) GetChannelMembersForUser(teamID, userID string, page, perPage int) ([]*model.ChannelMember, error) {
	channelMembers, appErr := c.api.GetChannelMembersForUser(teamID, userID, page, perPage)

	return channelMembers, normalizeAppErr(appErr)
}

// UpdateChannelMemberRoles updates a user's roles for a channel.
//
// Minimum server version: 5.2
func (c *ChannelService) UpdateChannelMemberRoles(channelID, userID, newRoles string) (*model.ChannelMember, error) {
	channelMember, appErr := c.api.UpdateChannelMemberRoles(channelID, userID, newRoles)

	return channelMember, normalizeAppErr(appErr)
}

// UpdateChannelMemberNotifications updates a user's notification properties for a channel.
//
// Minimum server version: 5.2
func (c *ChannelService) UpdateChannelMemberNotifications(channelID, userID string, notifications map[string]string) (*model.ChannelMember, error) {
	channelMember, appErr := c.api.UpdateChannelMemberNotifications(channelID, userID, notifications)

	return channelMember, normalizeAppErr(appErr)
}

// DeleteChannelMember deletes a channel membership for a user.
//
// Minimum server version: 5.2
func (c *ChannelService) DeleteChannelMember(channelID, userID string) error {
	appErr := c.api.DeleteChannelMember(channelID, userID)

	return normalizeAppErr(appErr)
}
