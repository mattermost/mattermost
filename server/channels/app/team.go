// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"sort"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app/email"
	"github.com/mattermost/mattermost/server/v8/channels/app/imaging"
	"github.com/mattermost/mattermost/server/v8/channels/app/teams"
	"github.com/mattermost/mattermost/server/v8/channels/app/users"
	"github.com/mattermost/mattermost/server/v8/channels/product"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/store/sqlstore"
)

// teamServiceWrapper provides an implementation of `product.TeamService` to be used by products.
type teamServiceWrapper struct {
	app AppIface
}

func (w *teamServiceWrapper) GetMember(teamID, userID string) (*model.TeamMember, *model.AppError) {
	return w.app.GetTeamMember(teamID, userID)
}

func (w *teamServiceWrapper) CreateMember(ctx *request.Context, teamID, userID string) (*model.TeamMember, *model.AppError) {
	return w.app.AddTeamMember(ctx, teamID, userID)
}

func (w *teamServiceWrapper) GetGroup(groupID string) (*model.Group, *model.AppError) {
	return w.app.GetGroup(groupID, nil, nil)
}

func (w *teamServiceWrapper) GetTeam(teamID string) (*model.Team, *model.AppError) {
	return w.app.GetTeam(teamID)
}

func (w *teamServiceWrapper) GetGroupMemberUsers(groupID string, page, perPage int) ([]*model.User, *model.AppError) {
	users, _, err := w.app.GetGroupMemberUsersPage(groupID, page, perPage, nil)
	return users, err
}

// Ensure the wrapper implements the product service.
var _ product.TeamService = (*teamServiceWrapper)(nil)

func (a *App) AdjustTeamsFromProductLimits(teamLimits *model.TeamsLimits) *model.AppError {
	maxActiveTeams := *teamLimits.Active
	teams, appErr := a.GetAllTeams()
	if appErr != nil {
		return appErr
	}

	if teams == nil {
		return nil
	}
	// Sort the list of teams based on their creation date
	sort.Slice(teams, func(i, j int) bool {
		return teams[i].CreateAt < teams[j].CreateAt
	})

	var activeTeams []*model.Team
	var cloudArchivedTeams []*model.Team
	for _, team := range teams {
		if team.DeleteAt == 0 {
			activeTeams = append(activeTeams, team)
		}
		if team.DeleteAt > 0 && team.CloudLimitsArchived {
			cloudArchivedTeams = append(cloudArchivedTeams, team)
		}
	}

	if len(activeTeams) > maxActiveTeams {
		// If there are more active teams than allowed, we must archive them
		// Remove the first n elements (where n is the allowed number of teams) so they aren't archived

		teamsToArchive := activeTeams[maxActiveTeams:]

		for _, team := range teamsToArchive {
			cloudLimitsArchived := true
			// Archive the remainder
			patch := model.TeamPatch{CloudLimitsArchived: &cloudLimitsArchived}
			_, err := a.PatchTeam(team.Id, &patch)
			if err != nil {
				return err
			}
			err = a.SoftDeleteTeam(team.Id)
			if err != nil {
				return err
			}
		}
	} else if len(activeTeams) < maxActiveTeams && len(cloudArchivedTeams) > 0 {
		// If the number of activeTeams is less than the allowed limit, and there are some cloudArchivedTeams, we can restore these cloudArchivedTeams
		activeTeamsBeforeLimit := maxActiveTeams - len(activeTeams)
		teamsToRestore := cloudArchivedTeams
		// If the number of active teams remaining before the limit is hit is fewer than the number of cloudArchivedTeams, trim the list (still according to CreateAt)
		// Otherwise, we can restore all of the cloudArchivedTeams without hitting the limit, so don't filter the list
		if activeTeamsBeforeLimit < len(cloudArchivedTeams) {
			teamsToRestore = cloudArchivedTeams[:(activeTeamsBeforeLimit)]
		}

		cloudLimitsArchived := false
		patch := &model.TeamPatch{CloudLimitsArchived: &cloudLimitsArchived}
		for _, team := range teamsToRestore {
			err := a.RestoreTeam(team.Id)
			if err != nil {
				return err
			}

			_, err = a.PatchTeam(team.Id, patch)
			if err != nil {
				return err
			}
		}
	}

	return nil
}

func (a *App) CreateTeam(c request.CTX, team *model.Team) (*model.Team, *model.AppError) {
	rteam, err := a.ch.srv.teamService.CreateTeam(team)
	if err != nil {
		var invErr *store.ErrInvalidInput

		var cErr *store.ErrConflict
		var ltErr *store.ErrLimitExceeded
		var appErr *model.AppError
		switch {
		case errors.As(err, &invErr):
			switch {
			case invErr.Entity == "Channel" && invErr.Field == "DeleteAt":
				return nil, model.NewAppError("CreateTeam", "store.sql_channel.save.archived_channel.app_error", nil, "", http.StatusBadRequest).Wrap(err)
			case invErr.Entity == "Channel" && invErr.Field == "Type":
				return nil, model.NewAppError("CreateTeam", "store.sql_channel.save.direct_channel.app_error", nil, "", http.StatusBadRequest).Wrap(err)
			case invErr.Entity == "Channel" && invErr.Field == "Id":
				return nil, model.NewAppError("CreateTeam", "store.sql_channel.save_channel.existing.app_error", nil, "id="+invErr.Value.(string), http.StatusBadRequest).Wrap(err)
			default:
				return nil, model.NewAppError("CreateTeam", "app.team.save.existing.app_error", nil, "", http.StatusBadRequest).Wrap(err)
			}
		case errors.As(err, &cErr):
			return nil, model.NewAppError("CreateTeam", store.ChannelExistsError, nil, "", http.StatusBadRequest).Wrap(err)
		case errors.As(err, &ltErr):
			return nil, model.NewAppError("CreateTeam", "store.sql_channel.save_channel.limit.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		case errors.As(err, &appErr):
			return nil, appErr
		default:
			return nil, model.NewAppError("CreateTeam", "app.team.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return rteam, nil
}

func (a *App) CreateTeamWithUser(c *request.Context, team *model.Team, userID string) (*model.Team, *model.AppError) {
	user, err := a.GetUser(userID)
	if err != nil {
		return nil, err
	}
	team.Email = user.Email

	if !a.ch.srv.teamService.IsTeamEmailAllowed(user, team) {
		return nil, model.NewAppError("CreateTeamWithUser", "api.team.is_team_creation_allowed.domain.app_error", nil, "", http.StatusBadRequest)
	}

	rteam, err := a.CreateTeam(c, team)
	if err != nil {
		return nil, err
	}

	if _, err := a.JoinUserToTeam(c, rteam, user, ""); err != nil {
		return nil, err
	}

	return rteam, nil
}

func (a *App) UpdateTeam(team *model.Team) (*model.Team, *model.AppError) {
	oldTeam, err := a.ch.srv.teamService.UpdateTeam(team, teams.UpdateOptions{Sanitized: true})
	if err != nil {
		var invErr *store.ErrInvalidInput
		var appErr *model.AppError
		var domErr *teams.DomainError
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("UpdateTeam", "app.team.get.find.app_error", nil, "", http.StatusNotFound).Wrap(err)
		case errors.As(err, &invErr):
			return nil, model.NewAppError("UpdateTeam", "app.team.update.find.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		case errors.As(err, &appErr):
			return nil, appErr
		case errors.As(err, &domErr):
			return nil, model.NewAppError("UpdateTeam", "api.team.update_restricted_domains.mismatch.app_error", map[string]any{"Domain": domErr.Domain}, "", http.StatusBadRequest).Wrap(err)
		default:
			return nil, model.NewAppError("UpdateTeam", "app.team.update.updating.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	if appErr := a.sendTeamEvent(oldTeam, model.WebsocketEventUpdateTeam); appErr != nil {
		return nil, appErr
	}

	return oldTeam, nil
}

// RenameTeam is used to rename the team Name and the DisplayName fields
func (a *App) RenameTeam(team *model.Team, newTeamName string, newDisplayName string) (*model.Team, *model.AppError) {

	// check if name is occupied
	_, errnf := a.GetTeamByName(newTeamName)

	// "-" can be used as a newTeamName if only DisplayName change is wanted
	if errnf == nil && newTeamName != "-" {
		errbody := fmt.Sprintf("team with name %s already exists", newTeamName)
		return nil, model.NewAppError("RenameTeam", "app.team.rename_team.name_occupied", nil, errbody, http.StatusBadRequest)
	}

	if newTeamName != "-" {
		team.Name = newTeamName
	}

	if newDisplayName != "" {
		team.DisplayName = newDisplayName
	}

	newTeam, err := a.ch.srv.teamService.UpdateTeam(team, teams.UpdateOptions{})
	if err != nil {
		var invErr *store.ErrInvalidInput
		var appErr *model.AppError
		var domErr *teams.DomainError
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("RenameTeam", "app.team.get.find.app_error", nil, "", http.StatusNotFound).Wrap(err)
		case errors.As(err, &invErr):
			return nil, model.NewAppError("RenameTeam", "app.team.update.find.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		case errors.As(err, &appErr):
			return nil, appErr
		case errors.As(err, &domErr):
			return nil, model.NewAppError("RenameTeam", "api.team.update_restricted_domains.mismatch.app_error", map[string]any{"Domain": domErr.Domain}, "", http.StatusBadRequest).Wrap(err)
		default:
			return nil, model.NewAppError("RenameTeam", "app.team.update.updating.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return newTeam, nil
}

func (a *App) UpdateTeamScheme(team *model.Team) (*model.Team, *model.AppError) {
	oldTeam, err := a.GetTeam(team.Id)
	if err != nil {
		return nil, err
	}

	oldTeam.SchemeId = team.SchemeId

	oldTeam, nErr := a.Srv().Store().Team().Update(oldTeam)
	if nErr != nil {
		var invErr *store.ErrInvalidInput
		var appErr *model.AppError
		switch {
		case errors.As(nErr, &invErr):
			return nil, model.NewAppError("UpdateTeamScheme", "app.team.update.find.app_error", nil, "", http.StatusBadRequest).Wrap(nErr)
		case errors.As(nErr, &appErr):
			return nil, appErr
		default:
			return nil, model.NewAppError("UpdateTeamScheme", "app.team.update.updating.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}
	}

	nErr = a.ClearTeamMembersCache(team.Id)
	if nErr != nil {
		return nil, model.NewAppError("UpdateTeamScheme", "app.team.clear_cache.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}

	a.Srv().Store().Channel().ClearMembersForUserCache()

	if appErr := a.sendTeamEvent(oldTeam, model.WebsocketEventUpdateTeamScheme); appErr != nil {
		return nil, appErr
	}

	return oldTeam, nil
}

func (a *App) UpdateTeamPrivacy(teamID string, teamType string, allowOpenInvite bool) *model.AppError {
	oldTeam, err := a.GetTeam(teamID)
	if err != nil {
		return err
	}

	// Force a regeneration of the invite token if changing a team to restricted.
	if (allowOpenInvite != oldTeam.AllowOpenInvite || teamType != oldTeam.Type) && (!allowOpenInvite || teamType == model.TeamInvite) {
		oldTeam.InviteId = model.NewId()
	}

	oldTeam.Type = teamType
	oldTeam.AllowOpenInvite = allowOpenInvite

	oldTeam, nErr := a.Srv().Store().Team().Update(oldTeam)
	if nErr != nil {
		var invErr *store.ErrInvalidInput
		var appErr *model.AppError
		switch {
		case errors.As(nErr, &invErr):
			return model.NewAppError("UpdateTeamPrivacy", "app.team.update.find.app_error", nil, "", http.StatusBadRequest).Wrap(nErr)
		case errors.As(nErr, &appErr):
			return appErr
		default:
			return model.NewAppError("UpdateTeamPrivacy", "app.team.update.updating.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}
	}

	if appErr := a.sendTeamEvent(oldTeam, model.WebsocketEventUpdateTeam); appErr != nil {
		return appErr
	}

	return nil
}

func (a *App) PatchTeam(teamID string, patch *model.TeamPatch) (*model.Team, *model.AppError) {
	team, err := a.ch.srv.teamService.PatchTeam(teamID, patch)
	if err != nil {
		var invErr *store.ErrInvalidInput
		var appErr *model.AppError
		var domErr *teams.DomainError
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("PatchTeam", "app.team.get.find.app_error", nil, "", http.StatusNotFound).Wrap(err)
		case errors.As(err, &invErr):
			return nil, model.NewAppError("PatchTeam", "app.team.update.find.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		case errors.As(err, &appErr):
			return nil, appErr
		case errors.As(err, &domErr):
			return nil, model.NewAppError("PatchTeam", "api.team.update_restricted_domains.mismatch.app_error", map[string]any{"Domain": domErr.Domain}, "", http.StatusBadRequest).Wrap(err)
		default:
			return nil, model.NewAppError("PatchTeam", "app.team.update.updating.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	if appErr := a.sendTeamEvent(team, model.WebsocketEventUpdateTeam); appErr != nil {
		return nil, appErr
	}

	return team, nil
}

func (a *App) RegenerateTeamInviteId(teamID string) (*model.Team, *model.AppError) {
	team, err := a.GetTeam(teamID)
	if err != nil {
		return nil, err
	}

	team.InviteId = model.NewId()

	updatedTeam, nErr := a.Srv().Store().Team().Update(team)
	if nErr != nil {
		var invErr *store.ErrInvalidInput
		var appErr *model.AppError
		switch {
		case errors.As(nErr, &invErr):
			return nil, model.NewAppError("RegenerateTeamInviteId", "app.team.update.find.app_error", nil, "", http.StatusBadRequest).Wrap(nErr)
		case errors.As(nErr, &appErr):
			return nil, appErr
		default:
			return nil, model.NewAppError("RegenerateTeamInviteId", "app.team.update.updating.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}
	}

	if appErr := a.sendTeamEvent(updatedTeam, model.WebsocketEventUpdateTeam); appErr != nil {
		return nil, appErr
	}

	return updatedTeam, nil
}

func (a *App) sendTeamEvent(team *model.Team, event string) *model.AppError {
	sanitizedTeam := &model.Team{}
	*sanitizedTeam = *team
	sanitizedTeam.Sanitize()

	message := model.NewWebSocketEvent(event, sanitizedTeam.Id, "", "", nil, "")
	teamJSON, jsonErr := json.Marshal(sanitizedTeam)
	if jsonErr != nil {
		return model.NewAppError("sendTeamEvent", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(jsonErr)
	}
	message.Add("team", string(teamJSON))
	a.Publish(message)
	return nil
}

func (a *App) GetSchemeRolesForTeam(teamID string) (string, string, string, *model.AppError) {
	team, err := a.GetTeam(teamID)
	if err != nil {
		return "", "", "", err
	}

	if team.SchemeId != nil && *team.SchemeId != "" {
		scheme, err := a.GetScheme(*team.SchemeId)
		if err != nil {
			return "", "", "", err
		}
		return scheme.DefaultTeamGuestRole, scheme.DefaultTeamUserRole, scheme.DefaultTeamAdminRole, nil
	}

	return model.TeamGuestRoleId, model.TeamUserRoleId, model.TeamAdminRoleId, nil
}

func (a *App) UpdateTeamMemberRoles(teamID string, userID string, newRoles string) (*model.TeamMember, *model.AppError) {
	member, nErr := a.Srv().Store().Team().GetMember(context.Background(), teamID, userID)
	if nErr != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(nErr, &nfErr):
			return nil, model.NewAppError("UpdateTeamMemberRoles", "app.team.get_member.missing.app_error", nil, "", http.StatusNotFound).Wrap(nErr)
		default:
			return nil, model.NewAppError("UpdateTeamMemberRoles", "app.team.get_member.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}
	}

	if member == nil {
		return nil, model.NewAppError("UpdateTeamMemberRoles", "api.team.update_member_roles.not_a_member", nil, "userId="+userID+" teamId="+teamID, http.StatusBadRequest)
	}

	schemeGuestRole, schemeUserRole, schemeAdminRole, err := a.GetSchemeRolesForTeam(teamID)
	if err != nil {
		return nil, err
	}

	prevSchemeGuestValue := member.SchemeGuest

	var newExplicitRoles []string
	member.SchemeGuest = false
	member.SchemeUser = false
	member.SchemeAdmin = false

	for _, roleName := range strings.Fields(newRoles) {
		var role *model.Role
		role, err = a.GetRoleByName(context.Background(), roleName)
		if err != nil {
			err.StatusCode = http.StatusBadRequest
			return nil, err
		}
		if !role.SchemeManaged {
			// The role is not scheme-managed, so it's OK to apply it to the explicit roles field.
			newExplicitRoles = append(newExplicitRoles, roleName)
		} else {
			// The role is scheme-managed, so need to check if it is part of the scheme for this channel or not.
			switch roleName {
			case schemeAdminRole:
				member.SchemeAdmin = true
			case schemeUserRole:
				member.SchemeUser = true
			case schemeGuestRole:
				member.SchemeGuest = true
			default:
				// If not part of the scheme for this team, then it is not allowed to apply it as an explicit role.
				return nil, model.NewAppError("UpdateTeamMemberRoles", "api.channel.update_team_member_roles.scheme_role.app_error", nil, "role_name="+roleName, http.StatusBadRequest)
			}
		}
	}

	if member.SchemeGuest && member.SchemeUser {
		return nil, model.NewAppError("UpdateTeamMemberRoles", "api.team.update_team_member_roles.guest_and_user.app_error", nil, "", http.StatusBadRequest)
	}

	if prevSchemeGuestValue != member.SchemeGuest {
		return nil, model.NewAppError("UpdateTeamMemberRoles", "api.channel.update_team_member_roles.changing_guest_role.app_error", nil, "", http.StatusBadRequest)
	}

	member.ExplicitRoles = strings.Join(newExplicitRoles, " ")

	member, nErr = a.Srv().Store().Team().UpdateMember(member)
	if nErr != nil {
		var appErr *model.AppError
		switch {
		case errors.As(nErr, &appErr):
			return nil, appErr
		default:
			return nil, model.NewAppError("UpdateTeamMemberRoles", "app.team.save_member.save.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}
	}

	a.ClearSessionCacheForUser(userID)

	if appErr := a.sendUpdatedMemberRoleEvent(userID, member); appErr != nil {
		return nil, appErr
	}

	return member, nil
}

func (a *App) UpdateTeamMemberSchemeRoles(teamID string, userID string, isSchemeGuest bool, isSchemeUser bool, isSchemeAdmin bool) (*model.TeamMember, *model.AppError) {
	member, err := a.GetTeamMember(teamID, userID)
	if err != nil {
		return nil, err
	}

	member.SchemeAdmin = isSchemeAdmin
	member.SchemeUser = isSchemeUser
	member.SchemeGuest = isSchemeGuest

	if member.SchemeUser && member.SchemeGuest {
		return nil, model.NewAppError("UpdateTeamMemberSchemeRoles", "api.team.update_team_member_roles.guest_and_user.app_error", nil, "", http.StatusBadRequest)
	}

	// If the migration is not completed, we also need to check the default team_admin/team_user roles are not present in the roles field.
	if err = a.IsPhase2MigrationCompleted(); err != nil {
		member.ExplicitRoles = RemoveRoles([]string{model.TeamGuestRoleId, model.TeamUserRoleId, model.TeamAdminRoleId}, member.ExplicitRoles)
	}

	member, nErr := a.Srv().Store().Team().UpdateMember(member)
	if nErr != nil {
		var appErr *model.AppError
		switch {
		case errors.As(nErr, &appErr):
			return nil, appErr
		default:
			return nil, model.NewAppError("UpdateTeamMemberSchemeRoles", "app.team.save_member.save.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}
	}

	a.ClearSessionCacheForUser(userID)

	if appErr := a.sendUpdatedMemberRoleEvent(userID, member); appErr != nil {
		return nil, appErr
	}

	return member, nil
}

func (a *App) sendUpdatedMemberRoleEvent(userID string, member *model.TeamMember) *model.AppError {
	message := model.NewWebSocketEvent(model.WebsocketEventMemberroleUpdated, "", "", userID, nil, "")
	tmJSON, jsonErr := json.Marshal(member)
	if jsonErr != nil {
		return model.NewAppError("sendUpdatedMemberRoleEvent", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(jsonErr)
	}
	message.Add("member", string(tmJSON))
	a.Publish(message)
	return nil
}

func (a *App) AddUserToTeam(c request.CTX, teamID string, userID string, userRequestorId string) (*model.Team, *model.TeamMember, *model.AppError) {
	tchan := make(chan store.StoreResult, 1)
	go func() {
		team, err := a.Srv().Store().Team().Get(teamID)
		tchan <- store.StoreResult{Data: team, NErr: err}
		close(tchan)
	}()

	uchan := make(chan store.StoreResult, 1)
	go func() {
		user, err := a.Srv().Store().User().Get(context.Background(), userID)
		uchan <- store.StoreResult{Data: user, NErr: err}
		close(uchan)
	}()

	result := <-tchan
	if result.NErr != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(result.NErr, &nfErr):
			return nil, nil, model.NewAppError("AddUserToTeam", "app.team.get.find.app_error", nil, "", http.StatusNotFound).Wrap(result.NErr)
		default:
			return nil, nil, model.NewAppError("AddUserToTeam", "app.team.get.finding.app_error", nil, "", http.StatusInternalServerError).Wrap(result.NErr)
		}
	}
	team := result.Data.(*model.Team)

	result = <-uchan
	if result.NErr != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(result.NErr, &nfErr):
			return nil, nil, model.NewAppError("AddUserToTeam", MissingAccountError, nil, "", http.StatusNotFound).Wrap(result.NErr)
		default:
			return nil, nil, model.NewAppError("AddUserToTeam", "app.user.get.app_error", nil, "", http.StatusInternalServerError).Wrap(result.NErr)
		}
	}
	user := result.Data.(*model.User)

	teamMember, err := a.JoinUserToTeam(c, team, user, userRequestorId)
	if err != nil {
		return nil, nil, err
	}

	return team, teamMember, nil
}

func (a *App) AddUserToTeamByTeamId(c *request.Context, teamID string, user *model.User) *model.AppError {
	team, err := a.Srv().Store().Team().Get(teamID)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return model.NewAppError("AddUserToTeamByTeamId", "app.team.get.find.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return model.NewAppError("AddUserToTeamByTeamId", "app.team.get.finding.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	if _, err := a.JoinUserToTeam(c, team, user, ""); err != nil {
		return err
	}
	return nil
}

func (a *App) AddUserToTeamByToken(c *request.Context, userID string, tokenID string) (*model.Team, *model.TeamMember, *model.AppError) {
	token, err := a.Srv().Store().Token().GetByToken(tokenID)
	if err != nil {
		return nil, nil, model.NewAppError("AddUserToTeamByToken", "api.user.create_user.signup_link_invalid.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	if token.Type != TokenTypeTeamInvitation && token.Type != TokenTypeGuestInvitation {
		return nil, nil, model.NewAppError("AddUserToTeamByToken", "api.user.create_user.signup_link_invalid.app_error", nil, "", http.StatusBadRequest)
	}

	if model.GetMillis()-token.CreateAt >= InvitationExpiryTime {
		a.DeleteToken(token)
		return nil, nil, model.NewAppError("AddUserToTeamByToken", "api.user.create_user.signup_link_expired.app_error", nil, "", http.StatusBadRequest)
	}

	tokenData := model.MapFromJSON(strings.NewReader(token.Extra))

	tchan := make(chan store.StoreResult, 1)
	go func() {
		team, err := a.Srv().Store().Team().Get(tokenData["teamId"])
		tchan <- store.StoreResult{Data: team, NErr: err}
		close(tchan)
	}()

	uchan := make(chan store.StoreResult, 1)
	go func() {
		user, err := a.Srv().Store().User().Get(context.Background(), userID)
		uchan <- store.StoreResult{Data: user, NErr: err}
		close(uchan)
	}()

	result := <-tchan
	if result.NErr != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(result.NErr, &nfErr):
			return nil, nil, model.NewAppError("AddUserToTeamByToken", "app.team.get.find.app_error", nil, "", http.StatusNotFound).Wrap(result.NErr)
		default:
			return nil, nil, model.NewAppError("AddUserToTeamByToken", "app.team.get.finding.app_error", nil, "", http.StatusInternalServerError).Wrap(result.NErr)
		}
	}
	team := result.Data.(*model.Team)

	if team.IsGroupConstrained() {
		return nil, nil, model.NewAppError("AddUserToTeamByToken", "app.team.invite_token.group_constrained.error", nil, "", http.StatusForbidden)
	}

	result = <-uchan
	if result.NErr != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(result.NErr, &nfErr):
			return nil, nil, model.NewAppError("AddUserToTeamByToken", MissingAccountError, nil, "", http.StatusNotFound).Wrap(result.NErr)
		default:
			return nil, nil, model.NewAppError("AddUserToTeamByToken", "app.user.get.app_error", nil, "", http.StatusInternalServerError).Wrap(result.NErr)
		}
	}
	user := result.Data.(*model.User)

	if user.IsGuest() && token.Type == TokenTypeTeamInvitation {
		return nil, nil, model.NewAppError("AddUserToTeamByToken", "api.user.create_user.invalid_invitation_type.app_error", nil, "", http.StatusBadRequest)
	}
	if !user.IsGuest() && token.Type == TokenTypeGuestInvitation {
		return nil, nil, model.NewAppError("AddUserToTeamByToken", "api.user.create_user.invalid_invitation_type.app_error", nil, "", http.StatusBadRequest)
	}

	teamMember, appErr := a.JoinUserToTeam(c, team, user, "")
	if appErr != nil {
		return nil, nil, appErr
	}

	if token.Type == TokenTypeGuestInvitation {
		channels, err := a.Srv().Store().Channel().GetChannelsByIds(strings.Split(tokenData["channels"], " "), false)
		if err != nil {
			return nil, nil, model.NewAppError("AddUserToTeamByToken", "app.channel.get_channels_by_ids.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		for _, channel := range channels {
			_, err := a.AddUserToChannel(c, user, channel, false)
			if err != nil {
				mlog.Warn("Error adding user to channel", mlog.Err(err))
			}
		}
	}

	if err := a.DeleteToken(token); err != nil {
		mlog.Warn("Error while deleting token", mlog.Err(err))
	}

	return team, teamMember, nil
}

func (a *App) AddUserToTeamByInviteId(c *request.Context, inviteId string, userID string) (*model.Team, *model.TeamMember, *model.AppError) {
	tchan := make(chan store.StoreResult, 1)
	go func() {
		team, err := a.Srv().Store().Team().GetByInviteId(inviteId)
		tchan <- store.StoreResult{Data: team, NErr: err}
		close(tchan)
	}()

	uchan := make(chan store.StoreResult, 1)
	go func() {
		user, err := a.Srv().Store().User().Get(context.Background(), userID)
		uchan <- store.StoreResult{Data: user, NErr: err}
		close(uchan)
	}()

	result := <-tchan
	if result.NErr != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(result.NErr, &nfErr):
			return nil, nil, model.NewAppError("AddUserToTeamByInviteId", "app.team.get_by_invite_id.finding.app_error", nil, "", http.StatusNotFound).Wrap(result.NErr)
		default:
			return nil, nil, model.NewAppError("AddUserToTeamByInviteId", "app.team.get_by_invite_id.finding.app_error", nil, "", http.StatusInternalServerError).Wrap(result.NErr)
		}
	}
	team := result.Data.(*model.Team)

	result = <-uchan
	if result.NErr != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(result.NErr, &nfErr):
			return nil, nil, model.NewAppError("AddUserToTeamByInviteId", MissingAccountError, nil, "", http.StatusNotFound).Wrap(result.NErr)
		default:
			return nil, nil, model.NewAppError("AddUserToTeamByInviteId", "app.user.get.app_error", nil, "", http.StatusInternalServerError).Wrap(result.NErr)
		}
	}
	user := result.Data.(*model.User)

	teamMember, err := a.JoinUserToTeam(c, team, user, "")
	if err != nil {
		return nil, nil, err
	}

	return team, teamMember, nil
}

func (a *App) JoinUserToTeam(c request.CTX, team *model.Team, user *model.User, userRequestorId string) (*model.TeamMember, *model.AppError) {
	teamMember, alreadyAdded, err := a.ch.srv.teamService.JoinUserToTeam(team, user)
	if err != nil {
		var appErr *model.AppError
		var conflictErr *store.ErrConflict
		var limitExceededErr *store.ErrLimitExceeded
		switch {
		case errors.Is(err, teams.AcceptedDomainError):
			return nil, model.NewAppError("JoinUserToTeam", "api.team.join_user_to_team.allowed_domains.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		case errors.Is(err, teams.MemberCountError):
			return nil, model.NewAppError("JoinUserToTeam", "app.team.get_active_member_count.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		case errors.Is(err, teams.MaxMemberCountError):
			return nil, model.NewAppError("JoinUserToTeam", "app.team.join_user_to_team.max_accounts.app_error", nil, "teamId="+team.Id, http.StatusBadRequest).Wrap(err)
		case errors.As(err, &appErr): // in case we haven't converted to plain error.
			return nil, appErr
		case errors.As(err, &conflictErr):
			return nil, model.NewAppError("JoinUserToTeam", "app.team.join_user_to_team.save_member.conflict.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		case errors.As(err, &limitExceededErr):
			return nil, model.NewAppError("JoinUserToTeam", "app.team.join_user_to_team.save_member.max_accounts.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		default: // last fallback in case it doesn't map to an existing app error.
			return nil, model.NewAppError("JoinUserToTeam", "app.team.join_user_to_team.save_member.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	if alreadyAdded {
		return teamMember, nil
	}

	if _, err := a.Srv().Store().User().UpdateUpdateAt(user.Id); err != nil {
		return nil, model.NewAppError("JoinUserToTeam", "app.user.update_update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	opts := &store.SidebarCategorySearchOpts{
		TeamID:      team.Id,
		ExcludeTeam: false,
	}
	if _, err := a.createInitialSidebarCategories(user.Id, opts); err != nil {
		mlog.Warn(
			"Encountered an issue creating default sidebar categories.",
			mlog.String("user_id", user.Id),
			mlog.String("team_id", team.Id),
			mlog.Err(err),
		)
	}

	shouldBeAdmin := team.Email == user.Email

	if !user.IsGuest() {
		// Soft error if there is an issue joining the default channels
		if err := a.JoinDefaultChannels(c, team.Id, user, shouldBeAdmin, userRequestorId); err != nil {
			mlog.Warn(
				"Encountered an issue joining default channels.",
				mlog.String("user_id", user.Id),
				mlog.String("team_id", team.Id),
				mlog.Err(err),
			)
		}
	}

	a.ClearSessionCacheForUser(user.Id)
	a.InvalidateCacheForUser(user.Id)
	a.invalidateCacheForUserTeams(user.Id)

	var actor *model.User
	if userRequestorId != "" {
		actor, _ = a.GetUser(userRequestorId)
	}

	a.Srv().Go(func() {
		pluginContext := pluginContext(c)
		a.ch.RunMultiHook(func(hooks plugin.Hooks) bool {
			hooks.UserHasJoinedTeam(pluginContext, teamMember, actor)
			return true
		}, plugin.UserHasJoinedTeamID)
	})

	message := model.NewWebSocketEvent(model.WebsocketEventAddedToTeam, "", "", user.Id, nil, "")
	message.Add("team_id", team.Id)
	message.Add("user_id", user.Id)
	a.Publish(message)

	return teamMember, nil
}

func (a *App) GetTeam(teamID string) (*model.Team, *model.AppError) {
	team, err := a.ch.srv.teamService.GetTeam(teamID)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetTeam", "app.team.get.find.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetTeam", "app.team.get.finding.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return team, nil
}

func (a *App) GetTeams(teamIDs []string) ([]*model.Team, *model.AppError) {
	teams, err := a.ch.srv.teamService.GetTeams(teamIDs)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetTeam", "app.team.get.find.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetTeam", "app.team.get.finding.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return teams, nil
}

func (a *App) GetTeamByName(name string) (*model.Team, *model.AppError) {
	team, err := a.Srv().Store().Team().GetByName(name)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetTeamByName", "app.team.get_by_name.missing.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetTeamByName", "app.team.get_by_name.app_error", nil, "", http.StatusNotFound).Wrap(err)
		}
	}

	return team, nil
}

func (a *App) GetTeamByInviteId(inviteId string) (*model.Team, *model.AppError) {
	team, err := a.Srv().Store().Team().GetByInviteId(inviteId)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetTeamByInviteId", "app.team.get_by_invite_id.finding.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetTeamByInviteId", "app.team.get_by_invite_id.finding.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return team, nil
}

func (a *App) GetAllTeams() ([]*model.Team, *model.AppError) {
	teams, err := a.Srv().Store().Team().GetAll()
	if err != nil {
		return nil, model.NewAppError("GetAllTeams", "app.team.get_all.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return teams, nil
}

func (a *App) GetAllTeamsPage(offset int, limit int, opts *model.TeamSearch) ([]*model.Team, *model.AppError) {
	teams, err := a.Srv().Store().Team().GetAllPage(offset, limit, opts)
	if err != nil {
		return nil, model.NewAppError("GetAllTeamsPage", "app.team.get_all.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return teams, nil
}

func (a *App) GetAllTeamsPageWithCount(offset int, limit int, opts *model.TeamSearch) (*model.TeamsWithCount, *model.AppError) {
	totalCount, err := a.Srv().Store().Team().AnalyticsTeamCount(opts)
	if err != nil {
		return nil, model.NewAppError("GetAllTeamsPageWithCount", "app.team.analytics_team_count.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	teams, err := a.Srv().Store().Team().GetAllPage(offset, limit, opts)
	if err != nil {
		return nil, model.NewAppError("GetAllTeamsPageWithCount", "app.team.get_all.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &model.TeamsWithCount{Teams: teams, TotalCount: totalCount}, nil
}

func (a *App) GetAllPrivateTeams() ([]*model.Team, *model.AppError) {
	teams, err := a.Srv().Store().Team().GetAllPrivateTeamListing()
	if err != nil {
		return nil, model.NewAppError("GetAllPrivateTeams", "app.team.get_all_private_team_listing.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return teams, nil
}

func (a *App) GetAllPublicTeams() ([]*model.Team, *model.AppError) {
	teams, err := a.Srv().Store().Team().GetAllTeamListing()
	if err != nil {
		return nil, model.NewAppError("GetAllPublicTeams", "app.team.get_all_team_listing.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return teams, nil
}

// SearchAllTeams returns a team list and the total count of the results
func (a *App) SearchAllTeams(searchOpts *model.TeamSearch) ([]*model.Team, int64, *model.AppError) {
	if searchOpts.IsPaginated() {
		teams, count, err := a.Srv().Store().Team().SearchAllPaged(searchOpts)
		if err != nil {
			return nil, 0, model.NewAppError("SearchAllTeams", "app.team.search_all_team.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		return teams, count, nil
	}
	results, err := a.Srv().Store().Team().SearchAll(searchOpts)
	if err != nil {
		return nil, 0, model.NewAppError("SearchAllTeams", "app.team.search_all_team.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return results, int64(len(results)), nil
}

func (a *App) SearchPublicTeams(searchOpts *model.TeamSearch) ([]*model.Team, *model.AppError) {
	teams, err := a.Srv().Store().Team().SearchOpen(searchOpts)
	if err != nil {
		return nil, model.NewAppError("SearchPublicTeams", "app.team.search_open_team.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return teams, nil
}

func (a *App) SearchPrivateTeams(searchOpts *model.TeamSearch) ([]*model.Team, *model.AppError) {
	teams, err := a.Srv().Store().Team().SearchPrivate(searchOpts)
	if err != nil {
		return nil, model.NewAppError("SearchPrivateTeams", "app.team.search_private_team.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return teams, nil
}

func (a *App) GetTeamsForUser(userID string) ([]*model.Team, *model.AppError) {
	teams, err := a.Srv().Store().Team().GetTeamsByUserId(userID)
	if err != nil {
		return nil, model.NewAppError("GetTeamsForUser", "app.team.get_all.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return teams, nil
}

func (a *App) GetTeamMember(teamID, userID string) (*model.TeamMember, *model.AppError) {
	teamMember, err := a.Srv().Store().Team().GetMember(sqlstore.WithMaster(context.Background()), teamID, userID)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetTeamMember", "app.team.get_member.missing.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetTeamMember", "app.team.get_member.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return teamMember, nil
}

func (a *App) GetTeamMembersForUser(userID string, excludeTeamID string, includeDeleted bool) ([]*model.TeamMember, *model.AppError) {
	teamMembers, err := a.Srv().Store().Team().GetTeamsForUser(context.Background(), userID, excludeTeamID, includeDeleted)
	if err != nil {
		return nil, model.NewAppError("GetTeamMembersForUser", "app.team.get_members.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return teamMembers, nil
}

func (a *App) GetTeamMembersForUserWithPagination(userID string, page, perPage int) ([]*model.TeamMember, *model.AppError) {
	teamMembers, err := a.Srv().Store().Team().GetTeamsForUserWithPagination(userID, page, perPage)
	if err != nil {
		return nil, model.NewAppError("GetTeamMembersForUserWithPagination", "app.team.get_members.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return teamMembers, nil
}

func (a *App) GetTeamMembers(teamID string, offset int, limit int, teamMembersGetOptions *model.TeamMembersGetOptions) ([]*model.TeamMember, *model.AppError) {
	teamMembers, err := a.Srv().Store().Team().GetMembers(teamID, offset, limit, teamMembersGetOptions)
	if err != nil {
		return nil, model.NewAppError("GetTeamMembers", "app.team.get_members.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return teamMembers, nil
}

func (a *App) GetTeamMembersByIds(teamID string, userIDs []string, restrictions *model.ViewUsersRestrictions) ([]*model.TeamMember, *model.AppError) {
	teamMembers, err := a.Srv().Store().Team().GetMembersByIds(teamID, userIDs, restrictions)
	if err != nil {
		return nil, model.NewAppError("GetTeamMembersByIds", "app.team.get_members_by_ids.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return teamMembers, nil
}

func (a *App) GetCommonTeamIDsForTwoUsers(userID, otherUserID string) ([]string, *model.AppError) {
	teamIDs, err := a.Srv().Store().Team().GetCommonTeamIDsForTwoUsers(userID, otherUserID)
	if err != nil {
		return nil, model.NewAppError("GetCommonTeamIDsForUsers", "app.team.get_common_team_ids_for_users.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return teamIDs, nil
}

func (a *App) AddTeamMember(c request.CTX, teamID, userID string) (*model.TeamMember, *model.AppError) {
	_, teamMember, err := a.AddUserToTeam(c, teamID, userID, "")
	if err != nil {
		return nil, err
	}

	message := model.NewWebSocketEvent(model.WebsocketEventAddedToTeam, "", "", userID, nil, "")
	message.Add("team_id", teamID)
	message.Add("user_id", userID)
	a.Publish(message)

	return teamMember, nil
}

func (a *App) AddTeamMembers(c *request.Context, teamID string, userIDs []string, userRequestorId string, graceful bool) ([]*model.TeamMemberWithError, *model.AppError) {
	var membersWithErrors []*model.TeamMemberWithError

	for _, userID := range userIDs {
		_, teamMember, err := a.AddUserToTeam(c, teamID, userID, userRequestorId)
		if err != nil {
			if graceful {
				membersWithErrors = append(membersWithErrors, &model.TeamMemberWithError{
					UserId: userID,
					Error:  err,
				})
				continue
			}
			return nil, err
		}

		membersWithErrors = append(membersWithErrors, &model.TeamMemberWithError{
			UserId: userID,
			Member: teamMember,
		})

		message := model.NewWebSocketEvent(model.WebsocketEventAddedToTeam, "", "", userID, nil, "")
		message.Add("team_id", teamID)
		message.Add("user_id", userID)
		a.Publish(message)
	}

	return membersWithErrors, nil
}

func (a *App) AddTeamMemberByToken(c *request.Context, userID, tokenID string) (*model.TeamMember, *model.AppError) {
	_, teamMember, err := a.AddUserToTeamByToken(c, userID, tokenID)
	if err != nil {
		return nil, err
	}

	return teamMember, nil
}

func (a *App) AddTeamMemberByInviteId(c *request.Context, inviteId, userID string) (*model.TeamMember, *model.AppError) {
	team, teamMember, err := a.AddUserToTeamByInviteId(c, inviteId, userID)
	if err != nil {
		return nil, err
	}

	if team.IsGroupConstrained() {
		return nil, model.NewAppError("AddTeamMemberByInviteId", "app.team.invite_id.group_constrained.error", nil, "", http.StatusForbidden)
	}

	return teamMember, nil
}

func (a *App) GetTeamUnread(teamID, userID string) (*model.TeamUnread, *model.AppError) {
	channelUnreads, err := a.Srv().Store().Team().GetChannelUnreadsForTeam(teamID, userID)

	if err != nil {
		return nil, model.NewAppError("GetTeamUnread", "app.team.get_unread.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	var teamUnread = &model.TeamUnread{
		MsgCount:         0,
		MentionCount:     0,
		MentionCountRoot: 0,
		MsgCountRoot:     0,
		TeamId:           teamID,
	}
	for _, cu := range channelUnreads {
		teamUnread.MentionCount += cu.MentionCount
		teamUnread.MentionCountRoot += cu.MentionCountRoot

		if cu.NotifyProps[model.MarkUnreadNotifyProp] != model.ChannelMarkUnreadMention {
			teamUnread.MsgCount += cu.MsgCount
			teamUnread.MsgCountRoot += cu.MsgCountRoot
		}
	}

	return teamUnread, nil
}

func (a *App) RemoveUserFromTeam(c request.CTX, teamID string, userID string, requestorId string) *model.AppError {
	tchan := make(chan store.StoreResult, 1)
	go func() {
		team, err := a.Srv().Store().Team().Get(teamID)
		tchan <- store.StoreResult{Data: team, NErr: err}
		close(tchan)
	}()

	uchan := make(chan store.StoreResult, 1)
	go func() {
		user, err := a.Srv().Store().User().Get(context.Background(), userID)
		uchan <- store.StoreResult{Data: user, NErr: err}
		close(uchan)
	}()

	result := <-tchan
	if result.NErr != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(result.NErr, &nfErr):
			return model.NewAppError("RemoveUserFromTeam", "app.team.get_by_invite_id.finding.app_error", nil, "", http.StatusNotFound).Wrap(result.NErr)
		default:
			return model.NewAppError("RemoveUserFromTeam", "app.team.get_by_invite_id.finding.app_error", nil, "", http.StatusInternalServerError).Wrap(result.NErr)
		}
	}
	team := result.Data.(*model.Team)

	result = <-uchan
	if result.NErr != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(result.NErr, &nfErr):
			return model.NewAppError("RemoveUserFromTeam", MissingAccountError, nil, "", http.StatusNotFound).Wrap(result.NErr)
		default:
			return model.NewAppError("RemoveUserFromTeam", "app.user.get.app_error", nil, "", http.StatusInternalServerError).Wrap(result.NErr)
		}
	}
	user := result.Data.(*model.User)

	if err := a.LeaveTeam(c, team, user, requestorId); err != nil {
		return err
	}

	return nil
}

func (a *App) postProcessTeamMemberLeave(c request.CTX, teamMember *model.TeamMember, requestorId string) *model.AppError {
	var actor *model.User
	if requestorId != "" {
		actor, _ = a.GetUser(requestorId)
	}

	a.Srv().Go(func() {
		pluginContext := pluginContext(c)
		a.ch.RunMultiHook(func(hooks plugin.Hooks) bool {
			hooks.UserHasLeftTeam(pluginContext, teamMember, actor)
			return true
		}, plugin.UserHasLeftTeamID)
	})

	user, nErr := a.Srv().Store().User().Get(context.Background(), teamMember.UserId)
	if nErr != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(nErr, &nfErr):
			return model.NewAppError("postProcessTeamMemberLeave", MissingAccountError, nil, "", http.StatusNotFound).Wrap(nErr)
		default:
			return model.NewAppError("postProcessTeamMemberLeave", "app.user.get.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}
	}

	if _, err := a.Srv().Store().User().UpdateUpdateAt(user.Id); err != nil {
		return model.NewAppError("postProcessTeamMemberLeave", "app.user.update_update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if err := a.Srv().Store().Channel().ClearSidebarOnTeamLeave(user.Id, teamMember.TeamId); err != nil {
		return model.NewAppError("postProcessTeamMemberLeave", "app.channel.sidebar_categories.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// delete the preferences that set the last channel used in the team and other team specific preferences
	if err := a.Srv().Store().Preference().DeleteCategory(user.Id, teamMember.TeamId); err != nil {
		return model.NewAppError("postProcessTeamMemberLeave", "app.preference.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	a.ClearSessionCacheForUser(user.Id)
	a.InvalidateCacheForUser(user.Id)
	a.invalidateCacheForUserTeams(user.Id)

	return nil
}

func (a *App) LeaveTeam(c request.CTX, team *model.Team, user *model.User, requestorId string) *model.AppError {
	teamMember, err := a.GetTeamMember(team.Id, user.Id)
	if err != nil {
		return model.NewAppError("LeaveTeam", "api.team.remove_user_from_team.missing.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	var channelList model.ChannelList
	var nErr error
	if channelList, nErr = a.Srv().Store().Channel().GetChannels(team.Id, user.Id, &model.ChannelSearchOpts{
		IncludeDeleted: true,
		LastDeleteAt:   0,
	}); nErr != nil {
		var nfErr *store.ErrNotFound
		if errors.As(nErr, &nfErr) {
			channelList = model.ChannelList{}
		} else {
			return model.NewAppError("LeaveTeam", "app.channel.get_channels.get.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}
	}

	for _, channel := range channelList {
		if !channel.IsGroupOrDirect() {
			a.invalidateCacheForChannelMembers(channel.Id)
			if nErr = a.Srv().Store().Channel().RemoveMember(channel.Id, user.Id); nErr != nil {
				return model.NewAppError("LeaveTeam", "app.channel.remove_member.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
			}
		}
	}

	if *a.Config().ServiceSettings.ExperimentalEnableDefaultChannelLeaveJoinMessages {
		channel, cErr := a.Srv().Store().Channel().GetByName(team.Id, model.DefaultChannelName, false)
		if cErr != nil {
			var nfErr *store.ErrNotFound
			switch {
			case errors.As(cErr, &nfErr):
				return model.NewAppError("LeaveTeam", "app.channel.get_by_name.missing.app_error", nil, "", http.StatusNotFound).Wrap(cErr)
			default:
				return model.NewAppError("LeaveTeam", "app.channel.get_by_name.existing.app_error", nil, "", http.StatusInternalServerError).Wrap(cErr)
			}
		}

		if requestorId == user.Id {
			if err = a.postLeaveTeamMessage(c, user, channel); err != nil {
				c.Logger().Warn("Failed to post join/leave message", mlog.Err(err))
			}
		} else {
			if err = a.postRemoveFromTeamMessage(c, user, channel); err != nil {
				c.Logger().Warn("Failed to post join/leave message", mlog.Err(err))
			}
		}
	}

	if err := a.ch.srv.teamService.RemoveTeamMember(teamMember); err != nil {
		return model.NewAppError("RemoveTeamMemberFromTeam", "app.team.save_member.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if err := a.postProcessTeamMemberLeave(c, teamMember, requestorId); err != nil {
		return err
	}

	return nil
}

func (a *App) postLeaveTeamMessage(c request.CTX, user *model.User, channel *model.Channel) *model.AppError {
	post := &model.Post{
		ChannelId: channel.Id,
		Message:   fmt.Sprintf(i18n.T("api.team.leave.left"), user.Username),
		Type:      model.PostTypeLeaveTeam,
		UserId:    user.Id,
		Props: model.StringInterface{
			"username": user.Username,
		},
	}

	if _, err := a.CreatePost(c, post, channel, false, true); err != nil {
		return model.NewAppError("postRemoveFromChannelMessage", "api.channel.post_user_add_remove_message_and_forget.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

func (a *App) postRemoveFromTeamMessage(c request.CTX, user *model.User, channel *model.Channel) *model.AppError {
	post := &model.Post{
		ChannelId: channel.Id,
		Message:   fmt.Sprintf(i18n.T("api.team.remove_user_from_team.removed"), user.Username),
		Type:      model.PostTypeRemoveFromTeam,
		UserId:    user.Id,
		Props: model.StringInterface{
			"username": user.Username,
		},
	}

	if _, err := a.CreatePost(c, post, channel, false, true); err != nil {
		return model.NewAppError("postRemoveFromTeamMessage", "api.channel.post_user_add_remove_message_and_forget.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

func (a *App) prepareInviteNewUsersToTeam(teamID, senderId string, channelIds []string) (*model.User, *model.Team, []*model.Channel, *model.AppError) {
	tchan := make(chan store.StoreResult, 1)
	go func() {
		team, err := a.Srv().Store().Team().Get(teamID)
		tchan <- store.StoreResult{Data: team, NErr: err}
		close(tchan)
	}()

	uchan := make(chan store.StoreResult, 1)
	go func() {
		user, err := a.Srv().Store().User().Get(context.Background(), senderId)
		uchan <- store.StoreResult{Data: user, NErr: err}
		close(uchan)
	}()

	var channels []*model.Channel
	var err error
	if len(channelIds) > 0 {
		channels, err = a.Srv().Store().Channel().GetChannelsByIds(channelIds, false)
		if err != nil {
			return nil, nil, nil, model.NewAppError("prepareInviteNewUsersToTeam", "app.channel.get_channels_by_ids.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	result := <-tchan
	if result.NErr != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(result.NErr, &nfErr):
			return nil, nil, nil, model.NewAppError("prepareInviteNewUsersToTeam", "app.team.get_by_invite_id.finding.app_error", nil, "", http.StatusNotFound).Wrap(result.NErr)
		default:
			return nil, nil, nil, model.NewAppError("prepareInviteNewUsersToTeam", "app.team.get_by_invite_id.finding.app_error", nil, "", http.StatusInternalServerError).Wrap(result.NErr)
		}
	}
	team := result.Data.(*model.Team)

	result = <-uchan
	if result.NErr != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(result.NErr, &nfErr):
			return nil, nil, nil, model.NewAppError("prepareInviteNewUsersToTeam", MissingAccountError, nil, "", http.StatusNotFound).Wrap(result.NErr)
		default:
			return nil, nil, nil, model.NewAppError("prepareInviteNewUsersToTeam", "app.user.get.app_error", nil, "", http.StatusInternalServerError).Wrap(result.NErr)
		}
	}
	user := result.Data.(*model.User)

	for _, channel := range channels {
		if channel.TeamId != teamID {
			return nil, nil, nil, model.NewAppError("prepareInviteGuestsToChannels", "api.team.invite_guests.channel_in_invalid_team.app_error", nil, "", http.StatusBadRequest)
		}
	}

	return user, team, channels, nil
}

func (a *App) InviteNewUsersToTeamGracefully(memberInvite *model.MemberInvite, teamID, senderId string, reminderInterval string) ([]*model.EmailInviteWithError, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableEmailInvitations {
		return nil, model.NewAppError("InviteNewUsersToTeam", "api.team.invite_members.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	emailList := memberInvite.Emails

	if len(emailList) == 0 {
		err := model.NewAppError("InviteNewUsersToTeam", "api.team.invite_members.no_one.app_error", nil, "", http.StatusBadRequest)
		return nil, err
	}
	user, team, channels, err := a.prepareInviteNewUsersToTeam(teamID, senderId, memberInvite.ChannelIds)
	if err != nil {
		return nil, err
	}
	allowedDomains := a.ch.srv.teamService.GetAllowedDomains(user, team)
	var inviteListWithErrors []*model.EmailInviteWithError
	var goodEmails []string
	for _, email := range emailList {
		invite := &model.EmailInviteWithError{
			Email: email,
			Error: nil,
		}
		if !teams.IsEmailAddressAllowed(email, allowedDomains) {
			invite.Error = model.NewAppError("InviteNewUsersToTeam", "api.team.invite_members.invalid_email.app_error", map[string]any{"Addresses": email}, "", http.StatusBadRequest)
		} else {
			goodEmails = append(goodEmails, email)
		}
		inviteListWithErrors = append(inviteListWithErrors, invite)
	}

	var reminderData *model.TeamInviteReminderData
	if reminderInterval != "" {
		reminderData = &model.TeamInviteReminderData{Interval: reminderInterval}
	}

	if len(goodEmails) > 0 {
		nameFormat := *a.Config().TeamSettings.TeammateNameDisplay
		senderProfileImage, _, err := a.GetProfileImage(user)
		if err != nil {
			a.Log().Warn("Unable to get the sender user profile image.", mlog.String("user_id", user.Id), mlog.String("team_id", team.Id), mlog.Err(err))
		}

		userIsFirstAdmin := a.UserIsFirstAdmin(user)
		var eErr error
		var invitesWithErrors2 []*model.EmailInviteWithError
		if len(channels) > 0 {
			invitesWithErrors2, eErr = a.Srv().EmailService.SendInviteEmailsToTeamAndChannels(team, channels, user.GetDisplayName(nameFormat), user.Id, senderProfileImage, goodEmails, a.GetSiteURL(), reminderData, memberInvite.Message, true, user.IsSystemAdmin(), userIsFirstAdmin)
			inviteListWithErrors = append(inviteListWithErrors, invitesWithErrors2...)
		} else {
			eErr = a.Srv().EmailService.SendInviteEmails(team, user.GetDisplayName(nameFormat), user.Id, goodEmails, a.GetSiteURL(), reminderData, true, user.IsSystemAdmin(), userIsFirstAdmin)
		}
		if eErr != nil {
			switch {
			case errors.Is(eErr, email.SendMailError):
				for i := range inviteListWithErrors {
					if inviteListWithErrors[i].Error == nil {
						if *a.Config().EmailSettings.SMTPServer == model.EmailSMTPDefaultServer && *a.Config().EmailSettings.SMTPPort == model.EmailSMTPDefaultPort {
							inviteListWithErrors[i].Error = model.NewAppError("InviteNewUsersToTeamGracefully", "api.team.invite_members.unable_to_send_email_with_defaults.app_error", nil, "", http.StatusInternalServerError)
						} else {
							inviteListWithErrors[i].Error = model.NewAppError("InviteNewUsersToTeamGracefully", "api.team.invite_members.unable_to_send_email.app_error", nil, "", http.StatusInternalServerError)
						}
					}
				}
			case errors.Is(eErr, email.NoRateLimiterError):
				return nil, model.NewAppError("InviteNewUsersToTeamGracefully", "app.email.no_rate_limiter.app_error", nil, fmt.Sprintf("user_id=%s, team_id=%s", user.Id, team.Id), http.StatusInternalServerError)
			case errors.Is(eErr, email.SetupRateLimiterError):
				return nil, model.NewAppError("InviteNewUsersToTeamGracefully", "app.email.setup_rate_limiter.app_error", nil, fmt.Sprintf("user_id=%s, team_id=%s, error=%v", user.Id, team.Id, eErr), http.StatusInternalServerError)
			default:
				return nil, model.NewAppError("InviteNewUsersToTeamGracefully", "app.email.rate_limit_exceeded.app_error", nil, fmt.Sprintf("user_id=%s, team_id=%s, error=%v", user.Id, team.Id, eErr), http.StatusRequestEntityTooLarge)
			}
		}
	}

	return inviteListWithErrors, nil
}

func (a *App) prepareInviteGuestsToChannels(teamID string, guestsInvite *model.GuestsInvite, senderId string) (*model.User, *model.Team, []*model.Channel, *model.AppError) {
	if err := guestsInvite.IsValid(); err != nil {
		return nil, nil, nil, err
	}

	tchan := make(chan store.StoreResult, 1)
	go func() {
		team, err := a.Srv().Store().Team().Get(teamID)
		tchan <- store.StoreResult{Data: team, NErr: err}
		close(tchan)
	}()
	cchan := make(chan store.StoreResult, 1)
	go func() {
		channels, err := a.Srv().Store().Channel().GetChannelsByIds(guestsInvite.Channels, false)
		cchan <- store.StoreResult{Data: channels, NErr: err}
		close(cchan)
	}()
	uchan := make(chan store.StoreResult, 1)
	go func() {
		user, err := a.Srv().Store().User().Get(context.Background(), senderId)
		uchan <- store.StoreResult{Data: user, NErr: err}
		close(uchan)
	}()

	result := <-cchan
	if result.NErr != nil {
		return nil, nil, nil, model.NewAppError("prepareInviteGuestsToChannels", "app.channel.get_channels_by_ids.app_error", nil, "", http.StatusInternalServerError).Wrap(result.NErr)
	}
	channels := result.Data.([]*model.Channel)

	result = <-uchan
	if result.NErr != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(result.NErr, &nfErr):
			return nil, nil, nil, model.NewAppError("prepareInviteGuestsToChannels", MissingAccountError, nil, "", http.StatusNotFound).Wrap(result.NErr)
		default:
			return nil, nil, nil, model.NewAppError("prepareInviteGuestsToChannels", "app.user.get.app_error", nil, "", http.StatusInternalServerError).Wrap(result.NErr)
		}
	}
	user := result.Data.(*model.User)

	result = <-tchan
	if result.NErr != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(result.NErr, &nfErr):
			return nil, nil, nil, model.NewAppError("prepareInviteGuestsToChannels", "app.team.get_by_invite_id.finding.app_error", nil, "", http.StatusNotFound).Wrap(result.NErr)
		default:
			return nil, nil, nil, model.NewAppError("prepareInviteGuestsToChannels", "app.team.get_by_invite_id.finding.app_error", nil, "", http.StatusInternalServerError).Wrap(result.NErr)
		}
	}
	team := result.Data.(*model.Team)

	for _, channel := range channels {
		if channel.TeamId != teamID {
			return nil, nil, nil, model.NewAppError("prepareInviteGuestsToChannels", "api.team.invite_guests.channel_in_invalid_team.app_error", nil, "", http.StatusBadRequest)
		}
	}
	return user, team, channels, nil
}

func (a *App) InviteGuestsToChannelsGracefully(teamID string, guestsInvite *model.GuestsInvite, senderId string) ([]*model.EmailInviteWithError, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableEmailInvitations {
		return nil, model.NewAppError("InviteGuestsToChannelsGracefully", "api.team.invite_members.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	user, team, channels, err := a.prepareInviteGuestsToChannels(teamID, guestsInvite, senderId)
	if err != nil {
		return nil, err
	}

	var inviteListWithErrors []*model.EmailInviteWithError
	var goodEmails []string
	for _, email := range guestsInvite.Emails {
		invite := &model.EmailInviteWithError{
			Email: email,
			Error: nil,
		}
		if !users.CheckEmailDomain(email, *a.Config().GuestAccountsSettings.RestrictCreationToDomains) {
			invite.Error = model.NewAppError("InviteGuestsToChannelsGracefully", "api.team.invite_members.invalid_email.app_error", map[string]any{"Addresses": email}, "", http.StatusBadRequest)
		} else {
			goodEmails = append(goodEmails, email)
		}
		inviteListWithErrors = append(inviteListWithErrors, invite)
	}

	if len(goodEmails) > 0 {
		nameFormat := *a.Config().TeamSettings.TeammateNameDisplay
		senderProfileImage, _, err := a.GetProfileImage(user)
		if err != nil {
			a.Log().Warn("Unable to get the sender user profile image.", mlog.String("user_id", user.Id), mlog.String("team_id", team.Id), mlog.Err(err))
		}

		eErr := a.Srv().EmailService.SendGuestInviteEmails(team, channels, user.GetDisplayName(nameFormat), user.Id, senderProfileImage, goodEmails, a.GetSiteURL(), guestsInvite.Message, true, user.IsSystemAdmin(), a.UserIsFirstAdmin(user))
		if eErr != nil {
			switch {
			case errors.Is(eErr, email.SendMailError):
				for i := range inviteListWithErrors {
					if inviteListWithErrors[i].Error == nil {
						if *a.Config().EmailSettings.SMTPServer == model.EmailSMTPDefaultServer && *a.Config().EmailSettings.SMTPPort == model.EmailSMTPDefaultPort {
							inviteListWithErrors[i].Error = model.NewAppError("InviteGuestsToChannelsGracefully", "api.team.invite_members.unable_to_send_email_with_defaults.app_error", nil, "", http.StatusInternalServerError)
						} else {
							inviteListWithErrors[i].Error = model.NewAppError("InviteGuestsToChannelsGracefully", "api.team.invite_members.unable_to_send_email.app_error", nil, "", http.StatusInternalServerError)
						}

					}
				}
			case errors.Is(eErr, email.NoRateLimiterError):
				return nil, model.NewAppError("SendInviteEmails", "app.email.no_rate_limiter.app_error", nil, fmt.Sprintf("user_id=%s, team_id=%s", user.Id, team.Id), http.StatusInternalServerError)
			case errors.Is(eErr, email.SetupRateLimiterError):
				return nil, model.NewAppError("SendInviteEmails", "app.email.setup_rate_limiter.app_error", nil, fmt.Sprintf("user_id=%s, team_id=%s, error=%v", user.Id, team.Id, eErr), http.StatusInternalServerError)
			default:
				return nil, model.NewAppError("SendInviteEmails", "app.email.rate_limit_exceeded.app_error", nil, fmt.Sprintf("user_id=%s, team_id=%s, error=%v", user.Id, team.Id, eErr), http.StatusRequestEntityTooLarge)
			}
		}
	}

	return inviteListWithErrors, nil
}

func (a *App) InviteNewUsersToTeam(emailList []string, teamID, senderId string) *model.AppError {
	if !*a.Config().ServiceSettings.EnableEmailInvitations {
		return model.NewAppError("InviteNewUsersToTeam", "api.team.invite_members.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	if len(emailList) == 0 {
		err := model.NewAppError("InviteNewUsersToTeam", "api.team.invite_members.no_one.app_error", nil, "", http.StatusBadRequest)
		return err
	}

	user, team, _, err := a.prepareInviteNewUsersToTeam(teamID, senderId, []string{})
	if err != nil {
		return err
	}

	allowedDomains := a.ch.srv.teamService.GetAllowedDomains(user, team)
	var invalidEmailList []string

	for _, email := range emailList {
		if !teams.IsEmailAddressAllowed(email, allowedDomains) {
			invalidEmailList = append(invalidEmailList, email)
		}
	}

	if len(invalidEmailList) > 0 {
		s := strings.Join(invalidEmailList, ", ")
		return model.NewAppError("InviteNewUsersToTeam", "api.team.invite_members.invalid_email.app_error", map[string]any{"Addresses": s}, "", http.StatusBadRequest)
	}

	nameFormat := *a.Config().TeamSettings.TeammateNameDisplay
	eErr := a.Srv().EmailService.SendInviteEmails(team, user.GetDisplayName(nameFormat), user.Id, emailList, a.GetSiteURL(), nil, false, user.IsSystemAdmin(), a.UserIsFirstAdmin(user))
	if eErr != nil {
		switch {
		case errors.Is(eErr, email.NoRateLimiterError):
			return model.NewAppError("SendInviteEmails", "app.email.no_rate_limiter.app_error", nil, fmt.Sprintf("user_id=%s, team_id=%s", user.Id, team.Id), http.StatusInternalServerError)
		case errors.Is(eErr, email.SetupRateLimiterError):
			return model.NewAppError("SendInviteEmails", "app.email.setup_rate_limiter.app_error", nil, fmt.Sprintf("user_id=%s, team_id=%s, error=%v", user.Id, team.Id, eErr), http.StatusInternalServerError)
		default:
			return model.NewAppError("SendInviteEmails", "app.email.rate_limit_exceeded.app_error", nil, fmt.Sprintf("user_id=%s, team_id=%s, error=%v", user.Id, team.Id, eErr), http.StatusRequestEntityTooLarge)
		}
	}

	return nil
}

func (a *App) InviteGuestsToChannels(teamID string, guestsInvite *model.GuestsInvite, senderId string) *model.AppError {
	if !*a.Config().ServiceSettings.EnableEmailInvitations {
		return model.NewAppError("InviteNewUsersToTeam", "api.team.invite_members.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	user, team, channels, err := a.prepareInviteGuestsToChannels(teamID, guestsInvite, senderId)
	if err != nil {
		return err
	}

	var invalidEmailList []string
	for _, email := range guestsInvite.Emails {
		if !users.CheckEmailDomain(email, *a.Config().GuestAccountsSettings.RestrictCreationToDomains) {
			invalidEmailList = append(invalidEmailList, email)
		}
	}

	if len(invalidEmailList) > 0 {
		s := strings.Join(invalidEmailList, ", ")
		return model.NewAppError("InviteGuestsToChannels", "api.team.invite_members.invalid_email.app_error", map[string]any{"Addresses": s}, "", http.StatusBadRequest)
	}

	nameFormat := *a.Config().TeamSettings.TeammateNameDisplay
	senderProfileImage, _, err := a.GetProfileImage(user)
	if err != nil {
		a.Log().Warn("Unable to get the sender user profile image.", mlog.String("user_id", user.Id), mlog.String("team_id", team.Id), mlog.Err(err))
	}

	eErr := a.Srv().EmailService.SendGuestInviteEmails(team, channels, user.GetDisplayName(nameFormat), user.Id, senderProfileImage, guestsInvite.Emails, a.GetSiteURL(), guestsInvite.Message, false, user.IsSystemAdmin(), a.UserIsFirstAdmin(user))
	if eErr != nil {
		switch {
		case errors.Is(eErr, email.NoRateLimiterError):
			return model.NewAppError("SendInviteEmails", "app.email.no_rate_limiter.app_error", nil, fmt.Sprintf("user_id=%s, team_id=%s", user.Id, team.Id), http.StatusInternalServerError)
		case errors.Is(eErr, email.SetupRateLimiterError):
			return model.NewAppError("SendInviteEmails", "app.email.setup_rate_limiter.app_error", nil, fmt.Sprintf("user_id=%s, team_id=%s, error=%v", user.Id, team.Id, err), http.StatusInternalServerError)
		default:
			return model.NewAppError("SendInviteEmails", "app.email.rate_limit_exceeded.app_error", nil, fmt.Sprintf("user_id=%s, team_id=%s, error=%v", user.Id, team.Id, err), http.StatusRequestEntityTooLarge)
		}
	}

	return nil
}

func (a *App) FindTeamByName(name string) bool {
	if _, err := a.Srv().Store().Team().GetByName(name); err != nil {
		return false
	}
	return true
}

func (a *App) GetTeamsUnreadForUser(excludeTeamId string, userID string, includeCollapsedThreads bool) ([]*model.TeamUnread, *model.AppError) {
	data, err := a.Srv().Store().Team().GetChannelUnreadsForAllTeams(excludeTeamId, userID)
	if err != nil {
		return nil, model.NewAppError("GetTeamsUnreadForUser", "app.team.get_unread.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	members := []*model.TeamUnread{}
	membersMap := make(map[string]*model.TeamUnread)

	unreads := func(cu *model.ChannelUnread, tu *model.TeamUnread) *model.TeamUnread {
		tu.MentionCount += cu.MentionCount
		tu.MentionCountRoot += cu.MentionCountRoot

		if cu.NotifyProps[model.MarkUnreadNotifyProp] != model.ChannelMarkUnreadMention {
			tu.MsgCount += cu.MsgCount
			tu.MsgCountRoot += cu.MsgCountRoot
		}

		return tu
	}

	teamIDs := make([]string, 0, len(data))
	for i := range data {
		id := data[i].TeamId
		if mu, ok := membersMap[id]; ok {
			membersMap[id] = unreads(data[i], mu)
		} else {
			teamIDs = append(teamIDs, id)
			membersMap[id] = unreads(data[i], &model.TeamUnread{
				MsgCount:                 0,
				MentionCount:             0,
				MentionCountRoot:         0,
				MsgCountRoot:             0,
				ThreadCount:              0,
				ThreadMentionCount:       0,
				ThreadUrgentMentionCount: 0,
				TeamId:                   id,
			})
		}
	}

	includeCollapsedThreads = includeCollapsedThreads && *a.Config().ServiceSettings.CollapsedThreads != model.CollapsedThreadsDisabled

	if includeCollapsedThreads {
		teamUnreads, err := a.Srv().Store().Thread().GetTeamsUnreadForUser(userID, teamIDs, a.IsPostPriorityEnabled())
		if err != nil {
			return nil, model.NewAppError("GetTeamsUnreadForUser", "app.team.get_unread.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		for teamID, member := range membersMap {
			if _, ok := teamUnreads[teamID]; ok {
				member.ThreadCount = teamUnreads[teamID].ThreadCount
				member.ThreadMentionCount = teamUnreads[teamID].ThreadMentionCount
				member.ThreadUrgentMentionCount = teamUnreads[teamID].ThreadUrgentMentionCount
			}
		}
	}

	for _, member := range membersMap {
		members = append(members, member)
	}
	return members, nil
}

func (a *App) PermanentDeleteTeamId(c request.CTX, teamID string) *model.AppError {
	team, err := a.GetTeam(teamID)
	if err != nil {
		return err
	}

	return a.PermanentDeleteTeam(c, team)
}

func (a *App) PermanentDeleteTeam(c request.CTX, team *model.Team) *model.AppError {
	team.DeleteAt = model.GetMillis()
	if _, err := a.Srv().Store().Team().Update(team); err != nil {
		var invErr *store.ErrInvalidInput
		var appErr *model.AppError
		switch {
		case errors.As(err, &invErr):
			return model.NewAppError("PermanentDeleteTeam", "app.team.update.find.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		case errors.As(err, &appErr):
			return appErr
		default:
			return model.NewAppError("PermanentDeleteTeam", "app.team.update.updating.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	if channels, err := a.Srv().Store().Channel().GetTeamChannels(team.Id); err != nil {
		var nfErr *store.ErrNotFound
		if !errors.As(err, &nfErr) {
			return model.NewAppError("PermanentDeleteTeam", "app.channel.get_channels.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	} else {
		for _, ch := range channels {
			a.PermanentDeleteChannel(c, ch)
		}
	}

	if err := a.Srv().Store().Team().RemoveAllMembersByTeam(team.Id); err != nil {
		return model.NewAppError("PermanentDeleteTeam", "app.team.remove_member.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if err := a.Srv().Store().Command().PermanentDeleteByTeam(team.Id); err != nil {
		return model.NewAppError("PermanentDeleteTeam", "app.team.permanentdeleteteam.internal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if err := a.Srv().Store().Team().PermanentDelete(team.Id); err != nil {
		return model.NewAppError("PermanentDeleteTeam", "app.team.permanent_delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if appErr := a.sendTeamEvent(team, model.WebsocketEventDeleteTeam); appErr != nil {
		return appErr
	}

	return nil
}

func (a *App) SoftDeleteTeam(teamID string) *model.AppError {
	team, err := a.GetTeam(teamID)
	if err != nil {
		return err
	}

	if err := a.Srv().Store().PostPersistentNotification().DeleteByTeam([]string{team.Id}); err != nil {
		return model.NewAppError("SoftDeleteTeam", "app.post_persistent_notification.delete_by_team.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	team.DeleteAt = model.GetMillis()
	team, nErr := a.Srv().Store().Team().Update(team)
	if nErr != nil {
		var invErr *store.ErrInvalidInput
		var appErr *model.AppError
		switch {
		case errors.As(nErr, &invErr):
			return model.NewAppError("SoftDeleteTeam", "app.team.update.find.app_error", nil, "", http.StatusBadRequest).Wrap(nErr)
		case errors.As(nErr, &appErr):
			return appErr
		default:
			return model.NewAppError("SoftDeleteTeam", "app.team.update.updating.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}
	}

	if appErr := a.sendTeamEvent(team, model.WebsocketEventDeleteTeam); appErr != nil {
		return appErr
	}

	return nil
}

func (a *App) RestoreTeam(teamID string) *model.AppError {
	team, err := a.GetTeam(teamID)
	if err != nil {
		return err
	}

	team.DeleteAt = 0
	team, nErr := a.Srv().Store().Team().Update(team)
	if nErr != nil {
		var invErr *store.ErrInvalidInput
		var appErr *model.AppError
		switch {
		case errors.As(nErr, &invErr):
			return model.NewAppError("RestoreTeam", "app.team.update.find.app_error", nil, "", http.StatusBadRequest).Wrap(nErr)
		case errors.As(nErr, &appErr):
			return appErr
		default:
			return model.NewAppError("RestoreTeam", "app.team.update.updating.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}
	}

	if appErr := a.sendTeamEvent(team, model.WebsocketEventRestoreTeam); appErr != nil {
		return appErr
	}

	return nil
}

func (a *App) GetTeamStats(teamID string, restrictions *model.ViewUsersRestrictions) (*model.TeamStats, *model.AppError) {
	tchan := make(chan store.StoreResult, 1)
	go func() {
		totalMemberCount, err := a.Srv().Store().Team().GetTotalMemberCount(teamID, restrictions)
		tchan <- store.StoreResult{Data: totalMemberCount, NErr: err}
		close(tchan)
	}()
	achan := make(chan store.StoreResult, 1)
	go func() {
		memberCount, err := a.Srv().Store().Team().GetActiveMemberCount(teamID, restrictions)
		achan <- store.StoreResult{Data: memberCount, NErr: err}
		close(achan)
	}()

	stats := &model.TeamStats{}
	stats.TeamId = teamID

	result := <-tchan
	if result.NErr != nil {
		return nil, model.NewAppError("GetTeamStats", "app.team.get_member_count.app_error", nil, "", http.StatusInternalServerError).Wrap(result.NErr)
	}
	stats.TotalMemberCount = result.Data.(int64)

	result = <-achan
	if result.NErr != nil {
		return nil, model.NewAppError("GetTeamStats", "app.team.get_active_member_count.app_error", nil, "", http.StatusInternalServerError).Wrap(result.NErr)
	}
	stats.ActiveMemberCount = result.Data.(int64)

	return stats, nil
}

func (a *App) GetTeamIdFromQuery(query url.Values) (string, *model.AppError) {
	tokenID := query.Get("t")
	inviteId := query.Get("id")

	if tokenID != "" {
		token, err := a.Srv().Store().Token().GetByToken(tokenID)
		if err != nil {
			return "", model.NewAppError("GetTeamIdFromQuery", "api.oauth.singup_with_oauth.invalid_link.app_error", nil, "", http.StatusBadRequest)
		}

		if token.Type != TokenTypeTeamInvitation && token.Type != TokenTypeGuestInvitation {
			return "", model.NewAppError("GetTeamIdFromQuery", "api.oauth.singup_with_oauth.invalid_link.app_error", nil, "", http.StatusBadRequest)
		}

		if model.GetMillis()-token.CreateAt >= InvitationExpiryTime {
			a.DeleteToken(token)
			return "", model.NewAppError("GetTeamIdFromQuery", "api.oauth.singup_with_oauth.expired_link.app_error", nil, "", http.StatusBadRequest)
		}

		tokenData := model.MapFromJSON(strings.NewReader(token.Extra))

		return tokenData["teamId"], nil
	}
	if inviteId != "" {
		team, err := a.Srv().Store().Team().GetByInviteId(inviteId)
		if err == nil {
			return team.Id, nil
		}
		// soft fail, so we still create user but don't auto-join team
		mlog.Warn("Error getting team by inviteId.", mlog.String("invite_id", inviteId), mlog.Err(err))
	}

	return "", nil
}

func (a *App) SanitizeTeam(session model.Session, team *model.Team) *model.Team {
	if a.SessionHasPermissionToTeam(session, team.Id, model.PermissionManageTeam) {
		return team
	}

	if a.SessionHasPermissionToTeam(session, team.Id, model.PermissionInviteUser) {
		inviteId := team.InviteId
		team.Sanitize()
		team.InviteId = inviteId
		return team
	}

	team.Sanitize()

	return team
}

func (a *App) SanitizeTeams(session model.Session, teams []*model.Team) []*model.Team {
	for _, team := range teams {
		a.SanitizeTeam(session, team)
	}

	return teams
}

func (a *App) GetTeamIcon(team *model.Team) ([]byte, *model.AppError) {
	if *a.Config().FileSettings.DriverName == "" {
		return nil, model.NewAppError("GetTeamIcon", "api.team.get_team_icon.filesettings_no_driver.app_error", nil, "", http.StatusNotImplemented)
	}

	path := "teams/" + team.Id + "/teamIcon.png"
	data, err := a.ReadFile(path)
	if err != nil {
		return nil, model.NewAppError("GetTeamIcon", "api.team.get_team_icon.read_file.app_error", nil, "", http.StatusNotFound).Wrap(err)
	}

	return data, nil
}

func (a *App) SetTeamIcon(teamID string, imageData *multipart.FileHeader) *model.AppError {
	file, err := imageData.Open()
	if err != nil {
		return model.NewAppError("SetTeamIcon", "api.team.set_team_icon.open.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}
	defer file.Close()
	return a.SetTeamIconFromMultiPartFile(teamID, file)
}

func (a *App) SetTeamIconFromMultiPartFile(teamID string, file multipart.File) *model.AppError {
	team, getTeamErr := a.GetTeam(teamID)

	if getTeamErr != nil {
		return model.NewAppError("SetTeamIcon", "api.team.set_team_icon.get_team.app_error", nil, "", http.StatusBadRequest).Wrap(getTeamErr)
	}

	if *a.Config().FileSettings.DriverName == "" {
		return model.NewAppError("setTeamIcon", "api.team.set_team_icon.storage.app_error", nil, "", http.StatusNotImplemented)
	}

	if limitErr := checkImageLimits(file, *a.Config().FileSettings.MaxImageResolution); limitErr != nil {
		return model.NewAppError("SetTeamIcon", "api.team.set_team_icon.check_image_limits.app_error",
			nil, "", http.StatusBadRequest).Wrap(limitErr)
	}

	return a.SetTeamIconFromFile(team, file)
}

func (a *App) SetTeamIconFromFile(team *model.Team, file io.Reader) *model.AppError {
	// Decode image into Image object
	img, _, err := image.Decode(file)
	if err != nil {
		return model.NewAppError("SetTeamIcon", "api.team.set_team_icon.decode.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	orientation, _ := imaging.GetImageOrientation(file)
	img = imaging.MakeImageUpright(img, orientation)

	// Scale team icon
	teamIconWidthAndHeight := 128
	img = imaging.FillCenter(img, teamIconWidthAndHeight, teamIconWidthAndHeight)

	buf := new(bytes.Buffer)
	err = a.ch.imgEncoder.EncodePNG(buf, img)
	if err != nil {
		return model.NewAppError("SetTeamIcon", "api.team.set_team_icon.encode.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	path := "teams/" + team.Id + "/teamIcon.png"

	if _, err := a.WriteFile(buf, path); err != nil {
		return model.NewAppError("SetTeamIcon", "api.team.set_team_icon.write_file.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	curTime := model.GetMillis()

	if err := a.Srv().Store().Team().UpdateLastTeamIconUpdate(team.Id, curTime); err != nil {
		return model.NewAppError("SetTeamIcon", "api.team.team_icon.update.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	// manually set time to avoid possible cluster inconsistencies
	team.LastTeamIconUpdate = curTime

	if appErr := a.sendTeamEvent(team, model.WebsocketEventUpdateTeam); appErr != nil {
		return appErr
	}

	return nil
}

func (a *App) RemoveTeamIcon(teamID string) *model.AppError {
	team, err := a.GetTeam(teamID)
	if err != nil {
		return model.NewAppError("RemoveTeamIcon", "api.team.remove_team_icon.get_team.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	if err := a.Srv().Store().Team().UpdateLastTeamIconUpdate(teamID, 0); err != nil {
		return model.NewAppError("RemoveTeamIcon", "api.team.team_icon.update.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	team.LastTeamIconUpdate = 0

	if appErr := a.sendTeamEvent(team, model.WebsocketEventUpdateTeam); appErr != nil {
		return appErr
	}

	return nil
}

func (a *App) InvalidateAllEmailInvites(c *request.Context) *model.AppError {
	if err := a.Srv().Store().Token().RemoveAllTokensByType(TokenTypeTeamInvitation); err != nil {
		return model.NewAppError("InvalidateAllEmailInvites", "api.team.invalidate_all_email_invites.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if err := a.Srv().Store().Token().RemoveAllTokensByType(TokenTypeGuestInvitation); err != nil {
		return model.NewAppError("InvalidateAllEmailInvites", "api.team.invalidate_all_email_invites.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if err := a.InvalidateAllResendInviteEmailJobs(c); err != nil {
		return model.NewAppError("InvalidateAllEmailInvites", "api.team.invalidate_all_email_invites.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return nil
}

func (a *App) InvalidateAllResendInviteEmailJobs(c *request.Context) *model.AppError {
	jobs, appErr := a.Srv().Jobs.GetJobsByTypeAndStatus(c, model.JobTypeResendInvitationEmail, model.JobStatusPending)
	if appErr != nil {
		return appErr
	}

	for _, j := range jobs {
		a.Srv().Jobs.SetJobCanceled(j)
		// clean up any system values this job was using
		a.Srv().Store().System().PermanentDeleteByName(j.Id)
	}

	return nil
}

func (a *App) ClearTeamMembersCache(teamID string) error {
	perPage := 100
	page := 0

	for {
		teamMembers, err := a.Srv().Store().Team().GetMembers(teamID, page*perPage, perPage, nil)
		if err != nil {
			return fmt.Errorf("failed to get team members: %v", err)
		}

		for _, teamMember := range teamMembers {
			a.ClearSessionCacheForUser(teamMember.UserId)

			message := model.NewWebSocketEvent(model.WebsocketEventMemberroleUpdated, "", "", teamMember.UserId, nil, "")
			tmJSON, jsonErr := json.Marshal(teamMember)
			if jsonErr != nil {
				return jsonErr
			}
			message.Add("member", string(tmJSON))
			a.Publish(message)
		}

		length := len(teamMembers)
		if length < perPage {
			break
		}

		page++
	}
	return nil
}
