package pluginapi

import (
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin"
)

// TeamService exposes methods to read and write teams and their members in a Mattermost server.
type TeamService struct {
	api plugin.API
}

// GetTeamIcon gets the team icon.
//
// Minimum server version: 5.6
func (t *TeamService) GetTeamIcon(teamID string) ([]byte, error) {
	icon, appErr := t.api.GetTeamIcon(teamID)

	return icon, normalizeAppErr(appErr)
}

// SetTeamIcon sets the team icon.
//
// Minimum server version: 5.6
func (t *TeamService) SetTeamIcon(teamID string, data []byte) error {
	appErr := t.api.SetTeamIcon(teamID, data)

	return normalizeAppErr(appErr)
}

// RemoveTeamIcon removes the team icon.
//
// Minimum server version: 5.6
func (t *TeamService) RemoveTeamIcon(teamID string) error {
	appErr := t.api.RemoveTeamIcon(teamID, data)

	return normalizeAppErr(appErr)
}

// CreateTeam creates a team.
//
// Minimum server version: 5.2
func (t *TeamService) CreateTeam(team *model.Team) (*model.Team, error) {
	team, appErr := t.api.CreateTeam(team)

	return team, normalizeAppErr(appErr)
}

// DeleteTeam deletes a team.
//
// Minimum server version: 5.2
func (t *TeamService) DeleteTeam(teamID string) error {
	appErr := t.api.DeleteTeam(teamID)

	return normalizeAppErr(appErr)
}

// GetTeams gets all teams.
//
// Minimum server version: 5.2
func (t *TeamService) GetTeams() ([]*model.Team, error) {
	teams, appErr := t.api.GetTeams()

	return teams, normalizeAppErr(appErr)
}

// GetTeam gets a team.
//
// Minimum server version: 5.2
func (t *TeamService) GetTeam(teamID string) (*model.Team, error) {
	team, appErr := t.api.GetTeam(teamID)

	return team, normalizeAppErr(appErr)
}

// GetTeamByName gets a team by its name.
//
// Minimum server version: 5.2
func (t *TeamService) GetTeamByName(name string) (*model.Team, error) {
	team, appErr := t.api.GetTeamByName(name)

	return team, normalizeAppErr(appErr)
}

// GetTeamsUnreadForUser gets the unread message and mention counts for each team to which the given user belongs.
//
// Minimum server version: 5.6
func (t *TeamService) GetTeamsUnreadForUser(userID string) ([]*model.TeamUnread, error) {
	teamUnreads, appErr := t.api.GetTeamsUnreadForUser(userID)

	return teamUnreads, normalizeAppErr(appErr)
}

// UpdateTeam updates a team.
//
// Minimum server version: 5.2
func (t *TeamService) UpdateTeam(team *model.Team) (*model.Team, error) {
	team, appErr := t.api.UpdateTeam(team)

	return team, normalizeAppErr(appErr)
}

// SearchTeams search a team.
//
// Minimum server version: 5.8
func (t *TeamService) SearchTeams(term string) ([]*model.Team, error) {
	teams, appErr := t.api.SearchTeams(term)

	return teams, normalizeAppErr(appErr)
}

// GetTeamsForUser returns list of teams of given user ID.
//
// Minimum server version: 5.6
func (t *TeamService) GetTeamsForUser(userID string) ([]*model.Team, error) {
	teams, appErr := t.api.GetTeamsForUser(userID)

	return teams, normalizeAppErr(appErr)
}

// CreateTeamMember creates a team membership.
//
// Minimum server version: 5.2
func (t *TeamService) CreateTeamMember(teamID, userID string) (*model.TeamMember, error) {
	teamMember, appErr := t.api.CreateTeamMember(teamID, userID)

	return teamMember, normalizeAppErr(appErr)
}

// CreateTeamMembers creates a team membership for all provided user ids.
//
// Minimum server version: 5.2
func (t *TeamService) CreateTeamMembers(teamID string, userIDs []string, requestorID string) ([]*model.TeamMember, error) {
	teamMembers, appErr := t.api.CreateTeamMembers(teamID, userIDs, requestorID)

	return teamMembers, normalizeAppErr(appErr)
}

// DeleteTeamMember deletes a team membership.
//
// Minimum server version: 5.2
func (t *TeamService) DeleteTeamMember(teamID, userID, requestorID string) error {
	appErr := t.api.DeleteTeamMember(teamID, userID, requestorID)

	return normalizeAppErr(appErr)
}

// GetTeamMembers returns the memberships of a specific team.
//
// Minimum server version: 5.2
func (t *TeamService) GetTeamMembers(teamID string, page, perPage int) ([]*model.TeamMember, error) {
	teamMembers, appErr := t.api.GetTeamMembers(teamID, page, perPage)

	return teamMembers, normalizeAppErr(appErr)
}

// GetTeamMember returns a specific membership.
//
// Minimum server version: 5.2
func (t *TeamService) GetTeamMember(teamID, userID string) (*model.TeamMember, error) {
	teamMember, appErr := t.api.GetTeamMembers(teamID, userID)

	return teamMember, normalizeAppErr(appErr)
}

// GetTeamMembersForUser returns all team memberships for a user.
//
// Minimum server version: 5.10
func (t *TeamService) GetTeamMembersForUser(userID string, page int, perPage int) ([]*model.TeamMember, error) {
	teamMembers, appErr := t.api.GetTeamMembersForUser(userID, page, perPage)

	return teamMembers, normalizeAppErr(appErr)
}

// UpdateTeamMemberRoles updates the role for a team membership.
//
// Minimum server version: 5.2
func (t *TeamService) UpdateTeamMemberRoles(teamID, userID, newRoles string) (*model.TeamMember, error) {
	teamMember, appErr := t.api.UpdateTeamMemberRoles(teamID, userID, newRoles)

	return teamMember, normalizeAppErr(appErr)
}

// GetTeamStats gets a team's statistics
//
// Minimum server version: 5.8
func (t *TeamService) GetTeamStats(teamID string) (*model.TeamStats, error) {
	teamStats, appErr := t.api.GetTeamStats(teamID)

	return teamStats, normalizeAppErr(appErr)
}
