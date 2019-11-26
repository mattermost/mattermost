package pluginapi

import (
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin"
)

// TeamService exposes methods to manipulate teams and their members.
type TeamService struct {
	api plugin.API
}

// Get gets a team.
//
// Minimum server version: 5.2
func (t *TeamService) Get(teamID string) (*model.Team, error) {
	team, appErr := t.api.GetTeam(teamID)

	return team, normalizeAppErr(appErr)
}

// GetByName gets a team by its name.
//
// Minimum server version: 5.2
func (t *TeamService) GetByName(name string) (*model.Team, error) {
	team, appErr := t.api.GetTeamByName(name)

	return team, normalizeAppErr(appErr)
}

// List gets all teams.
//
// Minimum server version: 5.2
func (t *TeamService) List() ([]*model.Team, error) {
	teams, appErr := t.api.GetTeams()

	return teams, normalizeAppErr(appErr)
}

// ListForUser returns list of teams of given user ID.
//
// Minimum server version: 5.6
func (t *TeamService) ListForUser(userID string) ([]*model.Team, error) {
	teams, appErr := t.api.GetTeamsForUser(userID)

	return teams, normalizeAppErr(appErr)
}

// Search search a team.
//
// Minimum server version: 5.8
func (t *TeamService) Search(term string) ([]*model.Team, error) {
	teams, appErr := t.api.SearchTeams(term)

	return teams, normalizeAppErr(appErr)
}

// Create creates a team.
//
// Minimum server version: 5.2
func (t *TeamService) Create(team *model.Team) (*model.Team, error) {
	team, appErr := t.api.CreateTeam(team)

	return team, normalizeAppErr(appErr)
}

// UpdateTeam updates a team.
//
// Minimum server version: 5.2
func (t *TeamService) UpdateTeam(team *model.Team) (*model.Team, error) {
	team, appErr := t.api.UpdateTeam(team)

	return team, normalizeAppErr(appErr)
}

// Delete deletes a team.
//
// Minimum server version: 5.2
func (t *TeamService) Delete(teamID string) error {
	appErr := t.api.DeleteTeam(teamID)

	return normalizeAppErr(appErr)
}

// GetIcon gets the team icon.
//
// Minimum server version: 5.6
func (t *TeamService) GetIcon(teamID string) ([]byte, error) {
	icon, appErr := t.api.GetTeamIcon(teamID)

	return icon, normalizeAppErr(appErr)
}

// SetIcon sets the team icon.
//
// Minimum server version: 5.6
func (t *TeamService) SetIcon(teamID string, data []byte) error {
	appErr := t.api.SetTeamIcon(teamID, data)

	return normalizeAppErr(appErr)
}

// RemoveIcon removes the team icon.
//
// Minimum server version: 5.6
func (t *TeamService) RemoveIcon(teamID string) error {
	return normalizeAppErr(t.api.RemoveTeamIcon(teamID))
}

// ListUnreadForUser gets the unread message and mention counts for each team to which the given user belongs.
//
// Minimum server version: 5.6
func (t *TeamService) ListUnreadForUser(userID string) ([]*model.TeamUnread, error) {
	teamUnreads, appErr := t.api.GetTeamsUnreadForUser(userID)

	return teamUnreads, normalizeAppErr(appErr)
}

// GetMember returns a specific membership.
//
// Minimum server version: 5.2
func (t *TeamService) GetMember(teamID, userID string) (*model.TeamMember, error) {
	teamMember, appErr := t.api.GetTeamMember(teamID, userID)

	return teamMember, normalizeAppErr(appErr)
}

// ListMembers returns the memberships of a specific team.
//
// Minimum server version: 5.2
func (t *TeamService) ListMembers(teamID string, page, perPage int) ([]*model.TeamMember, error) {
	teamMembers, appErr := t.api.GetTeamMembers(teamID, page, perPage)

	return teamMembers, normalizeAppErr(appErr)
}

// ListMembersForUser returns all team memberships for a user.
//
// Minimum server version: 5.10
func (t *TeamService) ListMembersForUser(userID string, page, perPage int) ([]*model.TeamMember, error) {
	teamMembers, appErr := t.api.GetTeamMembersForUser(userID, page, perPage)

	return teamMembers, normalizeAppErr(appErr)
}

// CreateMember creates a team membership.
//
// Minimum server version: 5.2
func (t *TeamService) CreateMember(teamID, userID string) (*model.TeamMember, error) {
	teamMember, appErr := t.api.CreateTeamMember(teamID, userID)

	return teamMember, normalizeAppErr(appErr)
}

// CreateMembers creates a team membership for all provided user ids.
//
// Minimum server version: 5.2
func (t *TeamService) CreateMembers(teamID string, userIDs []string, requestorID string) ([]*model.TeamMember, error) {
	teamMembers, appErr := t.api.CreateTeamMembers(teamID, userIDs, requestorID)

	return teamMembers, normalizeAppErr(appErr)
}

// DeleteMember deletes a team membership.
//
// Minimum server version: 5.2
func (t *TeamService) DeleteMember(teamID, userID, requestorID string) error {
	appErr := t.api.DeleteTeamMember(teamID, userID, requestorID)

	return normalizeAppErr(appErr)
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
