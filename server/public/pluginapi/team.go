package pluginapi

import (
	"bytes"
	"io"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
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

// TeamListOption is used to filter team listing.
type TeamListOption func(*ListTeamsOptions)

// ListTeamsOptions holds options about filter out team listing.
type ListTeamsOptions struct {
	UserID string
}

// FilterTeamsByUser option is used to filter teams by user.
func FilterTeamsByUser(userID string) TeamListOption {
	return func(o *ListTeamsOptions) {
		o.UserID = userID
	}
}

// List gets a list of teams by options.
//
// Minimum server version: 5.2
// Minimum server version when LimitTeamsToUser() option is used: 5.6
func (t *TeamService) List(options ...TeamListOption) ([]*model.Team, error) {
	opts := ListTeamsOptions{}
	for _, o := range options {
		o(&opts)
	}

	var teams []*model.Team
	var appErr *model.AppError
	if opts.UserID != "" {
		teams, appErr = t.api.GetTeamsForUser(opts.UserID)
	} else {
		teams, appErr = t.api.GetTeams()
	}

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
func (t *TeamService) Create(team *model.Team) error {
	createdTeam, appErr := t.api.CreateTeam(team)
	if appErr != nil {
		return normalizeAppErr(appErr)
	}

	*team = *createdTeam

	return nil
}

// Update updates a team.
//
// Minimum server version: 5.2
func (t *TeamService) Update(team *model.Team) error {
	updatedTeam, appErr := t.api.UpdateTeam(team)
	if appErr != nil {
		return normalizeAppErr(appErr)
	}

	*team = *updatedTeam

	return nil
}

// Delete deletes a team.
//
// Minimum server version: 5.2
func (t *TeamService) Delete(teamID string) error {
	return normalizeAppErr(t.api.DeleteTeam(teamID))
}

// GetIcon gets the team icon.
//
// Minimum server version: 5.6
func (t *TeamService) GetIcon(teamID string) (io.Reader, error) {
	contentBytes, appErr := t.api.GetTeamIcon(teamID)
	if appErr != nil {
		return nil, normalizeAppErr(appErr)
	}

	return bytes.NewReader(contentBytes), nil
}

// SetIcon sets the team icon.
//
// Minimum server version: 5.6
func (t *TeamService) SetIcon(teamID string, content io.Reader) error {
	contentBytes, err := io.ReadAll(content)
	if err != nil {
		return err
	}

	return normalizeAppErr(t.api.SetTeamIcon(teamID, contentBytes))
}

// DeleteIcon removes the team icon.
//
// Minimum server version: 5.6
func (t *TeamService) DeleteIcon(teamID string) error {
	return normalizeAppErr(t.api.RemoveTeamIcon(teamID))
}

// GetUsers lists users of the team.
//
// Minimum server version: 5.6
func (t *TeamService) ListUsers(teamID string, page, count int) ([]*model.User, error) {
	users, appErr := t.api.GetUsersInTeam(teamID, page, count)

	return users, normalizeAppErr(appErr)
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
	return normalizeAppErr(t.api.DeleteTeamMember(teamID, userID, requestorID))
}

// UpdateMemberRoles updates the role for a team membership.
//
// Minimum server version: 5.2
func (t *TeamService) UpdateMemberRoles(teamID, userID, newRoles string) (*model.TeamMember, error) {
	teamMember, appErr := t.api.UpdateTeamMemberRoles(teamID, userID, newRoles)

	return teamMember, normalizeAppErr(appErr)
}

// GetStats gets a team's statistics
//
// Minimum server version: 5.8
func (t *TeamService) GetStats(teamID string) (*model.TeamStats, error) {
	teamStats, appErr := t.api.GetTeamStats(teamID)

	return teamStats, normalizeAppErr(appErr)
}
